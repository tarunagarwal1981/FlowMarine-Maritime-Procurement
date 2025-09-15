import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../services/authService.js';
import { RefreshTokenService } from '../services/refreshTokenService.js';
import { hashPassword } from '../utils/password.js';
import { generateAccessToken, verifyAccessToken } from '../utils/jwt.js';

const prisma = new PrismaClient();

describe('Authentication Service', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.refreshToken.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.vesselAssignment.deleteMany();
    await prisma.user.deleteMany();
    await prisma.vessel.deleteMany();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.refreshToken.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.vesselAssignment.deleteMany();
    await prisma.user.deleteMany();
    await prisma.vessel.deleteMany();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        role: 'VESSEL_CREW' as const
      };

      const result = await AuthService.register(userData);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('test@example.com');
      expect(result.user?.emailVerified).toBe(false);
      expect(result.requiresEmailVerification).toBe(true);
    });

    it('should reject weak passwords', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak',
        firstName: 'John',
        lastName: 'Doe',
        role: 'VESSEL_CREW' as const
      };

      const result = await AuthService.register(userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Password validation failed');
    });

    it('should prevent duplicate email registration', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        role: 'VESSEL_CREW' as const
      };

      // Register first user
      await AuthService.register(userData);

      // Try to register with same email
      const result = await AuthService.register(userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User with this email already exists');
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      // Create a test user
      const passwordHash = await hashPassword('SecurePass123!');
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash,
          firstName: 'John',
          lastName: 'Doe',
          role: 'VESSEL_CREW',
          emailVerified: true,
          isActive: true
        }
      });
    });

    it('should login successfully with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      const result = await AuthService.login(credentials);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.tokens?.accessToken).toBeDefined();
      expect(result.tokens?.refreshToken).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      const result = await AuthService.login(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });

    it('should lock account after max failed attempts', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await AuthService.login(credentials);
      }

      // 6th attempt should show account locked
      const result = await AuthService.login(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toContain('locked');
      expect(result.accountLocked).toBeDefined();
    });

    it('should require email verification', async () => {
      // Create unverified user
      const passwordHash = await hashPassword('SecurePass123!');
      await prisma.user.create({
        data: {
          email: 'unverified@example.com',
          passwordHash,
          firstName: 'Jane',
          lastName: 'Doe',
          role: 'VESSEL_CREW',
          emailVerified: false,
          isActive: true
        }
      });

      const credentials = {
        email: 'unverified@example.com',
        password: 'SecurePass123!'
      };

      const result = await AuthService.login(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email verification required');
      expect(result.requiresEmailVerification).toBe(true);
    });
  });

  describe('Token Management', () => {
    let userId: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Create a test user
      const passwordHash = await hashPassword('SecurePass123!');
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash,
          firstName: 'John',
          lastName: 'Doe',
          role: 'VESSEL_CREW',
          emailVerified: true,
          isActive: true
        }
      });
      userId = user.id;
      refreshToken = await RefreshTokenService.createRefreshToken(userId);
    });

    it('should refresh access token successfully', async () => {
      const result = await AuthService.refreshToken(refreshToken);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.newRefreshToken).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      const result = await AuthService.refreshToken('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired refresh token');
    });

    it('should logout successfully', async () => {
      const result = await AuthService.logout(refreshToken, userId);

      expect(result.success).toBe(true);

      // Token should be revoked
      const validateResult = await RefreshTokenService.validateRefreshToken(refreshToken);
      expect(validateResult).toBeNull();
    });

    it('should logout from all devices', async () => {
      // Create multiple refresh tokens
      const token1 = await RefreshTokenService.createRefreshToken(userId);
      const token2 = await RefreshTokenService.createRefreshToken(userId);

      const result = await AuthService.logoutAll(userId);

      expect(result.success).toBe(true);

      // All tokens should be revoked
      expect(await RefreshTokenService.validateRefreshToken(token1)).toBeNull();
      expect(await RefreshTokenService.validateRefreshToken(token2)).toBeNull();
    });
  });

  describe('JWT Token Utilities', () => {
    it('should generate and verify access token', () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'VESSEL_CREW',
        vessels: ['vessel1'],
        permissions: ['read:requisitions']
      };

      const token = generateAccessToken(payload);
      expect(token).toBeDefined();

      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should reject invalid token', () => {
      expect(() => {
        verifyAccessToken('invalid-token');
      }).toThrow('Invalid token');
    });
  });

  describe('Password Reset', () => {
    beforeEach(async () => {
      // Create a test user
      const passwordHash = await hashPassword('SecurePass123!');
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash,
          firstName: 'John',
          lastName: 'Doe',
          role: 'VESSEL_CREW',
          emailVerified: true,
          isActive: true
        }
      });
    });

    it('should initiate password reset', async () => {
      const result = await AuthService.initiatePasswordReset('test@example.com');

      expect(result.success).toBe(true);
      expect(result.resetToken).toBeDefined();
    });

    it('should complete password reset', async () => {
      const resetResult = await AuthService.initiatePasswordReset('test@example.com');
      expect(resetResult.success).toBe(true);
      expect(resetResult.resetToken).toBeDefined();

      const completeResult = await AuthService.completePasswordReset(
        resetResult.resetToken!,
        'NewSecurePass123!'
      );

      expect(completeResult.success).toBe(true);
    });

    it('should reject weak password in reset', async () => {
      const resetResult = await AuthService.initiatePasswordReset('test@example.com');
      expect(resetResult.success).toBe(true);

      const completeResult = await AuthService.completePasswordReset(
        resetResult.resetToken!,
        'weak'
      );

      expect(completeResult.success).toBe(false);
      expect(completeResult.error).toContain('Password validation failed');
    });
  });

  describe('Email Verification', () => {
    it('should verify email successfully', async () => {
      const passwordHash = await hashPassword('SecurePass123!');
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash,
          firstName: 'John',
          lastName: 'Doe',
          role: 'VESSEL_CREW',
          emailVerified: false,
          emailVerificationToken: 'verification-token',
          isActive: true
        }
      });

      const result = await AuthService.verifyEmail('verification-token');

      expect(result.success).toBe(true);

      // Check that user is now verified
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id }
      });
      expect(updatedUser?.emailVerified).toBe(true);
      expect(updatedUser?.emailVerificationToken).toBeNull();
    });

    it('should reject invalid verification token', async () => {
      const result = await AuthService.verifyEmail('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired verification token');
    });
  });
});