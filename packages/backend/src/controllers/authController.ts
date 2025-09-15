import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../services/authService.js';
import { RefreshTokenService } from '../services/refreshTokenService.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { logSecurityEvent } from '../middleware/auditLogger.js';
import crypto from 'crypto';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  vesselIds: z.array(z.string()).optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  deviceInfo: z.object({
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    deviceName: z.string().optional()
  }).optional()
});

const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email format')
});

const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters')
});

/**
 * User registration with email verification
 */
export const register = async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { email, password, firstName, lastName, role, vesselIds = [] } = validatedData;
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      await logSecurityEvent({
        action: 'REGISTRATION_DUPLICATE_EMAIL',
        resource: '/api/auth/register',
        ipAddress: req.ip,
        metadata: {
          email,
          existingUserId: existingUser.id
        }
      });
      
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists',
        code: 'USER_EXISTS'
      });
    }
    
    // Validate vessel IDs if provided
    if (vesselIds.length > 0) {
      const vessels = await prisma.vessel.findMany({
        where: { id: { in: vesselIds } },
        select: { id: true }
      });
      
      if (vessels.length !== vesselIds.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more vessel IDs are invalid',
          code: 'INVALID_VESSEL_IDS'
        });
      }
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        emailVerificationToken,
        isActive: true,
        emailVerified: false
      }
    });
    
    // Create vessel assignments if provided
    if (vesselIds.length > 0) {
      await prisma.vesselAssignment.createMany({
        data: vesselIds.map(vesselId => ({
          userId: user.id,
          vesselId,
          isActive: true
        }))
      });
    }
    
    // TODO: Send email verification email
    // await emailService.sendVerificationEmail(email, emailVerificationToken);
    
    // Log successful registration
    await logSecurityEvent({
      action: 'USER_REGISTERED',
      resource: '/api/auth/register',
      ipAddress: req.ip,
      userId: user.id,
      metadata: {
        email,
        role,
        vesselCount: vesselIds.length,
        userAgent: req.get('User-Agent')
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
      data: {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    
    await logSecurityEvent({
      action: 'REGISTRATION_ERROR',
      resource: '/api/auth/register',
      ipAddress: req.ip,
      severity: 'HIGH',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
};

/**
 * Secure login with device tracking and account lockout
 */
export const login = async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password, deviceInfo } = validatedData;
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
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
      await logSecurityEvent({
        action: 'LOGIN_USER_NOT_FOUND',
        resource: '/api/auth/login',
        ipAddress: req.ip,
        metadata: {
          email,
          userAgent: req.get('User-Agent')
        }
      });
      
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const lockTimeRemaining = Math.ceil((user.accountLockedUntil.getTime() - Date.now()) / 1000 / 60);
      
      await logSecurityEvent({
        action: 'LOGIN_ACCOUNT_LOCKED',
        resource: '/api/auth/login',
        ipAddress: req.ip,
        userId: user.id,
        severity: 'HIGH',
        metadata: {
          email,
          lockTimeRemaining,
          userAgent: req.get('User-Agent')
        }
      });
      
      return res.status(423).json({
        success: false,
        error: `Account is locked. Try again in ${lockTimeRemaining} minutes.`,
        code: 'ACCOUNT_LOCKED',
        lockTimeRemaining
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      await logSecurityEvent({
        action: 'LOGIN_INACTIVE_USER',
        resource: '/api/auth/login',
        ipAddress: req.ip,
        userId: user.id,
        metadata: {
          email,
          userAgent: req.get('User-Agent')
        }
      });
      
      return res.status(403).json({
        success: false,
        error: 'Account is inactive',
        code: 'ACCOUNT_INACTIVE'
      });
    }
    
    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    
    if (!isPasswordValid) {
      // Increment failed login attempts
      const failedAttempts = user.failedLoginAttempts + 1;
      const shouldLockAccount = failedAttempts >= 5;
      
      const updateData: any = {
        failedLoginAttempts: failedAttempts
      };
      
      if (shouldLockAccount) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 30); // Lock for 30 minutes
        updateData.accountLockedUntil = lockUntil;
      }
      
      await prisma.user.update({
        where: { id: user.id },
        data: updateData
      });
      
      await logSecurityEvent({
        action: shouldLockAccount ? 'LOGIN_ACCOUNT_LOCKED_ATTEMPTS' : 'LOGIN_INVALID_PASSWORD',
        resource: '/api/auth/login',
        ipAddress: req.ip,
        userId: user.id,
        severity: shouldLockAccount ? 'HIGH' : 'MEDIUM',
        metadata: {
          email,
          failedAttempts,
          accountLocked: shouldLockAccount,
          userAgent: req.get('User-Agent')
        }
      });
      
      return res.status(401).json({
        success: false,
        error: shouldLockAccount 
          ? 'Account locked due to multiple failed login attempts'
          : 'Invalid credentials',
        code: shouldLockAccount ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS',
        ...(shouldLockAccount && { lockTimeRemaining: 30 })
      });
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
    
    // Generate tokens
    const vessels = user.vessels.map(v => v.vesselId);
    const permissions = user.permissions.map(p => p.permission.name);
    
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      vessels,
      permissions
    });
    
    const refreshToken = await RefreshTokenService.createRefreshToken(user.id, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      deviceName: deviceInfo?.deviceName
    });
    
    // Log successful login
    await logSecurityEvent({
      action: 'LOGIN_SUCCESS',
      resource: '/api/auth/login',
      ipAddress: req.ip,
      userId: user.id,
      metadata: {
        email,
        role: user.role,
        vesselCount: vessels.length,
        deviceInfo,
        userAgent: req.get('User-Agent')
      }
    });
    
    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          vessels,
          permissions,
          emailVerified: user.emailVerified,
          lastLogin: user.lastLogin
        },
        accessToken,
        expiresIn: '15m'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    
    await logSecurityEvent({
      action: 'LOGIN_ERROR',
      resource: '/api/auth/login',
      ipAddress: req.ip,
      severity: 'HIGH',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
};/**

 * Logout endpoint with token invalidation
 */
export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.headers['x-refresh-token'];
    
    if (refreshToken) {
      // Invalidate refresh token
      await RefreshTokenService.revokeRefreshToken(refreshToken);
    }
    
    // Log logout
    await logSecurityEvent({
      action: 'LOGOUT_SUCCESS',
      resource: '/api/auth/logout',
      ipAddress: req.ip,
      userId: req.user?.id,
      metadata: {
        userAgent: req.get('User-Agent'),
        hadRefreshToken: !!refreshToken
      }
    });
    
    // Clear refresh token cookie
    res.clearCookie('refreshToken');
    
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    
    await logSecurityEvent({
      action: 'LOGOUT_ERROR',
      resource: '/api/auth/logout',
      ipAddress: req.ip,
      userId: req.user?.id,
      severity: 'MEDIUM',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
};

/**
 * Token refresh endpoint without re-authentication
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.headers['x-refresh-token'];
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token required',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }
    
    // Validate refresh token and get user data
    const tokenData = await RefreshTokenService.validateRefreshToken(refreshToken);
    
    if (!tokenData) {
      await logSecurityEvent({
        action: 'REFRESH_TOKEN_INVALID',
        resource: '/api/auth/refresh',
        ipAddress: req.ip,
        severity: 'MEDIUM',
        metadata: {
          userAgent: req.get('User-Agent')
        }
      });
      
      res.clearCookie('refreshToken');
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'REFRESH_TOKEN_INVALID'
      });
    }
    
    // Get updated user data
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
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
      await logSecurityEvent({
        action: 'REFRESH_TOKEN_USER_INACTIVE',
        resource: '/api/auth/refresh',
        ipAddress: req.ip,
        userId: tokenData.userId,
        metadata: {
          userExists: !!user,
          userActive: user?.isActive
        }
      });
      
      res.clearCookie('refreshToken');
      return res.status(401).json({
        success: false,
        error: 'User account is inactive',
        code: 'USER_INACTIVE'
      });
    }
    
    // Generate new access token
    const vessels = user.vessels.map(v => v.vesselId);
    const permissions = user.permissions.map(p => p.permission.name);
    
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      vessels,
      permissions
    });
    
    // Optionally rotate refresh token for enhanced security
    let newRefreshToken = refreshToken;
    if (process.env.ROTATE_REFRESH_TOKENS === 'true') {
      await RefreshTokenService.revokeRefreshToken(refreshToken);
      newRefreshToken = await RefreshTokenService.createRefreshToken(user.id, {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    }
    
    // Log successful token refresh
    await logSecurityEvent({
      action: 'TOKEN_REFRESHED',
      resource: '/api/auth/refresh',
      ipAddress: req.ip,
      userId: user.id,
      metadata: {
        tokenRotated: newRefreshToken !== refreshToken,
        userAgent: req.get('User-Agent')
      }
    });
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        expiresIn: '15m',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          vessels,
          permissions,
          emailVerified: user.emailVerified
        }
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    await logSecurityEvent({
      action: 'TOKEN_REFRESH_ERROR',
      resource: '/api/auth/refresh',
      ipAddress: req.ip,
      severity: 'HIGH',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
      code: 'TOKEN_REFRESH_ERROR'
    });
  }
};

/**
 * Password reset request with secure token generation
 */
export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const validatedData = passwordResetRequestSchema.parse(req.body);
    const { email } = validatedData;
    
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    // Always return success to prevent email enumeration
    if (!user) {
      await logSecurityEvent({
        action: 'PASSWORD_RESET_EMAIL_NOT_FOUND',
        resource: '/api/auth/password-reset-request',
        ipAddress: req.ip,
        metadata: {
          email,
          userAgent: req.get('User-Agent')
        }
      });
      
      return res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent.'
      });
    }
    
    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // 1 hour expiry
    
    // Save reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiry: resetTokenExpiry
      }
    });
    
    // TODO: Send password reset email
    // await emailService.sendPasswordResetEmail(email, resetToken);
    
    // Log password reset request
    await logSecurityEvent({
      action: 'PASSWORD_RESET_REQUESTED',
      resource: '/api/auth/password-reset-request',
      ipAddress: req.ip,
      userId: user.id,
      metadata: {
        email,
        userAgent: req.get('User-Agent')
      }
    });
    
    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    
    await logSecurityEvent({
      action: 'PASSWORD_RESET_REQUEST_ERROR',
      resource: '/api/auth/password-reset-request',
      ipAddress: req.ip,
      severity: 'MEDIUM',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Password reset request failed',
      code: 'PASSWORD_RESET_REQUEST_ERROR'
    });
  }
};

/**
 * Password reset with token validation
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const validatedData = passwordResetSchema.parse(req.body);
    const { token, newPassword } = validatedData;
    
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: {
          gt: new Date()
        }
      }
    });
    
    if (!user) {
      await logSecurityEvent({
        action: 'PASSWORD_RESET_INVALID_TOKEN',
        resource: '/api/auth/password-reset',
        ipAddress: req.ip,
        severity: 'HIGH',
        metadata: {
          token: token.substring(0, 8) + '...',
          userAgent: req.get('User-Agent')
        }
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN'
      });
    }
    
    // Hash new password
    const passwordHash = await hashPassword(newPassword);
    
    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
        failedLoginAttempts: 0,
        accountLockedUntil: null
      }
    });
    
    // Revoke all refresh tokens for security
    await RefreshTokenService.revokeAllUserTokens(user.id);
    
    // Log successful password reset
    await logSecurityEvent({
      action: 'PASSWORD_RESET_SUCCESS',
      resource: '/api/auth/password-reset',
      ipAddress: req.ip,
      userId: user.id,
      metadata: {
        email: user.email,
        userAgent: req.get('User-Agent')
      }
    });
    
    res.json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    
    await logSecurityEvent({
      action: 'PASSWORD_RESET_ERROR',
      resource: '/api/auth/password-reset',
      ipAddress: req.ip,
      severity: 'HIGH',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Password reset failed',
      code: 'PASSWORD_RESET_ERROR'
    });
  }
};

/**
 * Change password for authenticated users
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const validatedData = changePasswordSchema.parse(req.body);
    const { currentPassword, newPassword } = validatedData;
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
    
    if (!isCurrentPasswordValid) {
      await logSecurityEvent({
        action: 'PASSWORD_CHANGE_INVALID_CURRENT',
        resource: '/api/auth/change-password',
        ipAddress: req.ip,
        userId: user.id,
        severity: 'MEDIUM',
        metadata: {
          userAgent: req.get('User-Agent')
        }
      });
      
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }
    
    // Hash new password
    const passwordHash = await hashPassword(newPassword);
    
    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });
    
    // Revoke all refresh tokens except current one for security
    const currentRefreshToken = req.cookies?.refreshToken || req.headers['x-refresh-token'];
    await RefreshTokenService.revokeAllUserTokensExcept(user.id, currentRefreshToken);
    
    // Log successful password change
    await logSecurityEvent({
      action: 'PASSWORD_CHANGED',
      resource: '/api/auth/change-password',
      ipAddress: req.ip,
      userId: user.id,
      metadata: {
        userAgent: req.get('User-Agent')
      }
    });
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    
    await logSecurityEvent({
      action: 'PASSWORD_CHANGE_ERROR',
      resource: '/api/auth/change-password',
      ipAddress: req.ip,
      userId: req.user?.id,
      severity: 'MEDIUM',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Password change failed',
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        vessels: {
          where: { isActive: true },
          include: {
            vessel: {
              select: {
                id: true,
                name: true,
                imoNumber: true,
                vesselType: true
              }
            }
          }
        },
        permissions: {
          include: {
            permission: {
              select: { name: true, description: true }
            }
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        vessels: user.vessels.map(va => ({
          id: va.vessel.id,
          name: va.vessel.name,
          imoNumber: va.vessel.imoNumber,
          vesselType: va.vessel.vesselType,
          assignedAt: va.createdAt
        })),
        permissions: user.permissions.map(up => ({
          name: up.permission.name,
          description: up.permission.description,
          assignedAt: up.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get profile',
      code: 'GET_PROFILE_ERROR'
    });
  }
};

/**
 * Update user profile with audit logging
 */
export const updateProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const updateSchema = z.object({
      firstName: z.string().min(1, 'First name is required').optional(),
      lastName: z.string().min(1, 'Last name is required').optional()
    });
    
    const validatedData = updateSchema.parse(req.body);
    
    // Get current user data for audit
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { firstName: true, lastName: true }
    });
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: validatedData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        updatedAt: true
      }
    });
    
    // Log profile update
    await logSecurityEvent({
      action: 'PROFILE_UPDATED',
      resource: '/api/auth/profile',
      ipAddress: req.ip,
      userId: req.user.id,
      metadata: {
        changes: validatedData,
        previousData: {
          firstName: currentUser.firstName,
          lastName: currentUser.lastName
        },
        userAgent: req.get('User-Agent')
      }
    });
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    
    await logSecurityEvent({
      action: 'PROFILE_UPDATE_ERROR',
      resource: '/api/auth/profile',
      ipAddress: req.ip,
      userId: req.user?.id,
      severity: 'MEDIUM',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Profile update failed',
      code: 'PROFILE_UPDATE_ERROR'
    });
  }
};

/**
 * Get user sessions for session management
 */
export const getSessions = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const sessions = await prisma.refreshToken.findMany({
      where: {
        userId: req.user.id,
        isRevoked: false,
        expiresAt: { gt: new Date() }
      },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        createdAt: true,
        lastUsed: true,
        expiresAt: true
      },
      orderBy: { lastUsed: 'desc' }
    });
    
    res.json({
      success: true,
      data: sessions.map(session => ({
        id: session.id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastUsed: session.lastUsed,
        expiresAt: session.expiresAt,
        isCurrent: req.cookies?.refreshToken && 
                   session.id === req.cookies.refreshToken // This would need token lookup
      }))
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get sessions',
      code: 'GET_SESSIONS_ERROR'
    });
  }
};

/**
 * Remote logout - revoke specific session
 */
export const revokeSession = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
        code: 'SESSION_ID_REQUIRED'
      });
    }
    
    // Verify session belongs to user
    const session = await prisma.refreshToken.findFirst({
      where: {
        id: sessionId,
        userId: req.user.id
      }
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    // Revoke session
    await prisma.refreshToken.update({
      where: { id: sessionId },
      data: {
        isRevoked: true,
        revokedAt: new Date()
      }
    });
    
    // Log session revocation
    await logSecurityEvent({
      action: 'SESSION_REVOKED',
      resource: '/api/auth/sessions',
      ipAddress: req.ip,
      userId: req.user.id,
      metadata: {
        revokedSessionId: sessionId,
        revokedSessionInfo: {
          deviceInfo: session.deviceInfo,
          ipAddress: session.ipAddress,
          createdAt: session.createdAt
        },
        userAgent: req.get('User-Agent')
      }
    });
    
    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    
    await logSecurityEvent({
      action: 'SESSION_REVOKE_ERROR',
      resource: '/api/auth/sessions',
      ipAddress: req.ip,
      userId: req.user?.id,
      severity: 'MEDIUM',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: req.params.sessionId
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to revoke session',
      code: 'REVOKE_SESSION_ERROR'
    });
  }
};

/**
 * Email verification
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required',
        code: 'TOKEN_REQUIRED'
      });
    }
    
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerified: false
      }
    });
    
    if (!user) {
      await logSecurityEvent({
        action: 'EMAIL_VERIFICATION_INVALID_TOKEN',
        resource: '/api/auth/verify-email',
        ipAddress: req.ip,
        severity: 'MEDIUM',
        metadata: {
          token: token.substring(0, 8) + '...',
          userAgent: req.get('User-Agent')
        }
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token',
        code: 'INVALID_VERIFICATION_TOKEN'
      });
    }
    
    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null
      }
    });
    
    // Log successful email verification
    await logSecurityEvent({
      action: 'EMAIL_VERIFIED',
      resource: '/api/auth/verify-email',
      ipAddress: req.ip,
      userId: user.id,
      metadata: {
        email: user.email,
        userAgent: req.get('User-Agent')
      }
    });
    
    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    
    await logSecurityEvent({
      action: 'EMAIL_VERIFICATION_ERROR',
      resource: '/api/auth/verify-email',
      ipAddress: req.ip,
      severity: 'MEDIUM',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Email verification failed',
      code: 'EMAIL_VERIFICATION_ERROR'
    });
  }
};