import { PrismaClient, User, UserRole } from '@prisma/client';
import { hashPassword, verifyPassword, validatePasswordStrength, generateTokenWithExpiry } from '../utils/password.js';
import { generateAccessToken, TokenPair } from '../utils/jwt.js';
import { RefreshTokenService } from './refreshTokenService.js';

const prisma = new PrismaClient();

export interface LoginCredentials {
  email: string;
  password: string;
  deviceInfo?: {
    userAgent?: string;
    ipAddress?: string;
  };
}

export interface RegisterUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  vesselIds?: string[];
}

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    vessels: string[];
    permissions: string[];
    emailVerified: boolean;
  };
  tokens?: TokenPair;
  error?: string;
  requiresEmailVerification?: boolean;
  accountLocked?: {
    until: Date;
    attemptsRemaining: number;
  };
}

export interface PasswordResetResult {
  success: boolean;
  error?: string;
  resetToken?: string;
}

export class AuthService {
  private static readonly MAX_LOGIN_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION_MINUTES = 30;
  
  /**
   * Authenticate user with email and password
   */
  static async login(credentials: LoginCredentials): Promise<AuthResult> {
    const { email, password, deviceInfo } = credentials;
    
    try {
      // Find user with related data
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          vessels: {
            where: { isActive: true },
            select: { vesselId: true }
          },
          permissions: {
            include: {
              permission: {
                select: { name: true }
              }
            }
          }
        }
      });
      
      if (!user) {
        // Log failed attempt for security monitoring
        await this.logSecurityEvent('LOGIN_FAILED', email, deviceInfo?.ipAddress, 'User not found');
        return { success: false, error: 'Invalid credentials' };
      }
      
      // Check if account is locked
      if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
        const attemptsRemaining = 0;
        return {
          success: false,
          error: 'Account is temporarily locked due to too many failed login attempts',
          accountLocked: {
            until: user.accountLockedUntil,
            attemptsRemaining
          }
        };
      }
      
      // Check if account is active
      if (!user.isActive) {
        await this.logSecurityEvent('LOGIN_FAILED', email, deviceInfo?.ipAddress, 'Account inactive');
        return { success: false, error: 'Account is inactive' };
      }
      
      // Verify password
      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      
      if (!isPasswordValid) {
        // Increment failed login attempts
        const newFailedAttempts = user.failedLoginAttempts + 1;
        let accountLockedUntil: Date | null = null;
        
        if (newFailedAttempts >= this.MAX_LOGIN_ATTEMPTS) {
          accountLockedUntil = new Date();
          accountLockedUntil.setMinutes(accountLockedUntil.getMinutes() + this.LOCKOUT_DURATION_MINUTES);
        }
        
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newFailedAttempts,
            accountLockedUntil
          }
        });
        
        await this.logSecurityEvent('LOGIN_FAILED', email, deviceInfo?.ipAddress, 'Invalid password');
        
        if (accountLockedUntil) {
          return {
            success: false,
            error: 'Too many failed login attempts. Account has been temporarily locked.',
            accountLocked: {
              until: accountLockedUntil,
              attemptsRemaining: 0
            }
          };
        }
        
        const attemptsRemaining = this.MAX_LOGIN_ATTEMPTS - newFailedAttempts;
        return {
          success: false,
          error: `Invalid credentials. ${attemptsRemaining} attempts remaining.`,
          accountLocked: {
            until: new Date(),
            attemptsRemaining
          }
        };
      }
      
      // Check email verification
      if (!user.emailVerified) {
        return {
          success: false,
          error: 'Email verification required',
          requiresEmailVerification: true
        };
      }
      
      // Reset failed login attempts on successful login
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          accountLockedUntil: null,
          lastLogin: new Date()
        }
      });
      
      // Prepare user data
      const vessels = user.vessels.map(v => v.vesselId);
      const permissions = user.permissions.map(p => p.permission.name);
      
      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        vessels,
        permissions
      });
      
      // Enforce refresh token limit before creating new one
      await RefreshTokenService.enforceTokenLimit(user.id);
      const refreshToken = await RefreshTokenService.createRefreshToken(user.id);
      
      // Log successful login
      await this.logSecurityEvent('LOGIN_SUCCESS', email, deviceInfo?.ipAddress);
      
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          vessels,
          permissions,
          emailVerified: user.emailVerified
        },
        tokens: {
          accessToken,
          refreshToken
        }
      };
      
    } catch (error) {
      console.error('Login error:', error);
      await this.logSecurityEvent('LOGIN_ERROR', email, deviceInfo?.ipAddress, 'System error');
      return { success: false, error: 'An error occurred during login' };
    }
  }
  
  /**
   * Register a new user
   */
  static async register(userData: RegisterUserData): Promise<AuthResult> {
    const { email, password, firstName, lastName, role, vesselIds = [] } = userData;
    
    try {
      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: `Password validation failed: ${passwordValidation.errors.join(', ')}`
        };
      }
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });
      
      if (existingUser) {
        return { success: false, error: 'User with this email already exists' };
      }
      
      // Hash password
      const passwordHash = await hashPassword(password);
      
      // Generate email verification token
      const { token: emailVerificationToken } = generateTokenWithExpiry(24);
      
      // Create user in transaction with vessel assignments
      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: email.toLowerCase(),
            passwordHash,
            firstName,
            lastName,
            role,
            emailVerificationToken,
            emailVerified: false,
            isActive: true
          }
        });
        
        // Create vessel assignments if provided
        if (vesselIds.length > 0) {
          await tx.vesselAssignment.createMany({
            data: vesselIds.map(vesselId => ({
              userId: newUser.id,
              vesselId,
              startDate: new Date(),
              isActive: true
            }))
          });
        }
        
        return newUser;
      });
      
      // Log user registration
      await this.logSecurityEvent('USER_REGISTERED', email);
      
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          vessels: vesselIds,
          permissions: [],
          emailVerified: false
        },
        requiresEmailVerification: true
      };
      
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'An error occurred during registration' };
    }
  }
  
  /**
   * Logout user by revoking refresh token
   */
  static async logout(refreshToken: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      await RefreshTokenService.revokeRefreshToken(refreshToken);
      
      if (userId) {
        await this.logSecurityEvent('LOGOUT', undefined, undefined, undefined, userId);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'An error occurred during logout' };
    }
  }
  
  /**
   * Logout from all devices
   */
  static async logoutAll(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await RefreshTokenService.revokeAllUserTokens(userId);
      await this.logSecurityEvent('LOGOUT_ALL', undefined, undefined, undefined, userId);
      
      return { success: true };
    } catch (error) {
      console.error('Logout all error:', error);
      return { success: false, error: 'An error occurred during logout' };
    }
  }
  
  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<{
    success: boolean;
    accessToken?: string;
    newRefreshToken?: string;
    error?: string;
  }> {
    try {
      const userId = await RefreshTokenService.validateRefreshToken(refreshToken);
      
      if (!userId) {
        return { success: false, error: 'Invalid or expired refresh token' };
      }
      
      // Get user data for new access token
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          vessels: {
            where: { isActive: true },
            select: { vesselId: true }
          },
          permissions: {
            include: {
              permission: {
                select: { name: true }
              }
            }
          }
        }
      });
      
      if (!user || !user.isActive) {
        await RefreshTokenService.revokeRefreshToken(refreshToken);
        return { success: false, error: 'User account is inactive' };
      }
      
      const vessels = user.vessels.map(v => v.vesselId);
      const permissions = user.permissions.map(p => p.permission.name);
      
      // Generate new access token
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        vessels,
        permissions
      });
      
      // Rotate refresh token for security
      const newRefreshToken = await RefreshTokenService.rotateRefreshToken(refreshToken);
      
      return {
        success: true,
        accessToken,
        newRefreshToken: newRefreshToken || undefined
      };
      
    } catch (error) {
      console.error('Token refresh error:', error);
      return { success: false, error: 'An error occurred during token refresh' };
    }
  }
  
  /**
   * Initiate password reset
   */
  static async initiatePasswordReset(email: string): Promise<PasswordResetResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });
      
      if (!user) {
        // Don't reveal if user exists for security
        return { success: true };
      }
      
      if (!user.isActive) {
        return { success: false, error: 'Account is inactive' };
      }
      
      // Generate reset token
      const { token: resetToken, expiresAt } = generateTokenWithExpiry(1); // 1 hour expiry
      
      // Store reset token (you might want to create a separate table for this)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: resetToken // Reusing this field for reset token
        }
      });
      
      await this.logSecurityEvent('PASSWORD_RESET_REQUESTED', email);
      
      return { success: true, resetToken };
      
    } catch (error) {
      console.error('Password reset error:', error);
      return { success: false, error: 'An error occurred during password reset' };
    }
  }
  
  /**
   * Complete password reset
   */
  static async completePasswordReset(
    resetToken: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate new password
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: `Password validation failed: ${passwordValidation.errors.join(', ')}`
        };
      }
      
      // Find user with reset token
      const user = await prisma.user.findFirst({
        where: { emailVerificationToken: resetToken }
      });
      
      if (!user) {
        return { success: false, error: 'Invalid or expired reset token' };
      }
      
      // Hash new password
      const passwordHash = await hashPassword(newPassword);
      
      // Update password and clear reset token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          emailVerificationToken: null,
          failedLoginAttempts: 0,
          accountLockedUntil: null
        }
      });
      
      // Revoke all existing refresh tokens for security
      await RefreshTokenService.revokeAllUserTokens(user.id);
      
      await this.logSecurityEvent('PASSWORD_RESET_COMPLETED', user.email, undefined, undefined, user.id);
      
      return { success: true };
      
    } catch (error) {
      console.error('Password reset completion error:', error);
      return { success: false, error: 'An error occurred during password reset' };
    }
  }
  
  /**
   * Verify email address
   */
  static async verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await prisma.user.findFirst({
        where: { emailVerificationToken: token }
      });
      
      if (!user) {
        return { success: false, error: 'Invalid or expired verification token' };
      }
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null
        }
      });
      
      await this.logSecurityEvent('EMAIL_VERIFIED', user.email, undefined, undefined, user.id);
      
      return { success: true };
      
    } catch (error) {
      console.error('Email verification error:', error);
      return { success: false, error: 'An error occurred during email verification' };
    }
  }
  
  /**
   * Log security events for audit trail
   */
  private static async logSecurityEvent(
    action: string,
    email?: string,
    ipAddress?: string,
    details?: string,
    userId?: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: action as any, // Cast to AuditAction enum
          resource: 'authentication',
          ipAddress,
          metadata: {
            email,
            details,
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}