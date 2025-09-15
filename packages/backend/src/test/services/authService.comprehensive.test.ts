import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuthService } from '@/services/authService';
import { hashPassword } from '@/utils/password';
import { generateAccessToken, generateRefreshToken } from '@/utils/jwt';

// Mock dependencies
vi.mock('@/utils/password');
vi.mock('@/utils/jwt');
vi.mock('@/services/refreshTokenService');
vi.mock('@/services/auditService');
vi.mock('@/utils/logger');

describe('AuthService Comprehensive Tests', () => {
  let authService: AuthService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn()
      },
      refreshToken: {
        create: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn()
      }
    };

    authService = new AuthService(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('User Registration', () => {
    it('should register new user successfully', async () => {
      const userData = {
        email: 'captain@vessel.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Smith',
        role: 'CAPTAIN'
      };

      mockPrisma.user.findUnique.mockResolvedValue(null); // Email not exists
      mockPrisma.user.create.mockResolvedValue({
        id: 'user123',
        ...userData,
        passwordHash: 'hashed-password'
      });

      vi.mocked(hashPassword).mockResolvedValue('hashed-password');

      const result = await authService.register(userData);

      expect(result.success).toBe(true);
      expect(result.user.email).toBe(userData.email);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: userData.email,
          passwordHash: 'hashed-password',
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          emailVerified: false
        }
      });
    });

    it('should reject registration with existing email', async () => {
      const userData = {
        email: 'existing@vessel.com',
        password: 'SecurePass123!',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'CREW'
      };

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      const result = await authService.register(userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already registered');
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should handle database errors during registration', async () => {
      const userData = {
        email: 'test@vessel.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        role: 'CREW'
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockRejectedValue(new Error('Database error'));

      const result = await authService.register(userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Registration failed');
    });
  });

  describe('User Authentication', () => {
    it('should authenticate valid credentials', async () => {
      const credentials = {
        email: 'captain@vessel.com',
        password: 'CorrectPassword123!'
      };

      const mockUser = {
        id: 'user123',
        email: credentials.email,
        passwordHash: 'hashed-password',
        isActive: true,
        emailVerified: true,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        vessels: [{ id: 'vessel1' }],
        role: 'CAPTAIN'
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(require('@/utils/password').verifyPassword).mockResolvedValue(true);
      vi.mocked(generateAccessToken).mockReturnValue('access-token');
      vi.mocked(generateRefreshToken).mockReturnValue('refresh-token');

      const result = await authService.login(credentials);

      expect(result.success).toBe(true);
      expect(result.tokens.accessToken).toBe('access-token');
      expect(result.tokens.refreshToken).toBe('refresh-token');
      expect(result.user.id).toBe('user123');
    });

    it('should reject invalid credentials', async () => {
      const credentials = {
        email: 'captain@vessel.com',
        password: 'WrongPassword'
      };

      const mockUser = {
        id: 'user123',
        email: credentials.email,
        passwordHash: 'hashed-password',
        isActive: true,
        emailVerified: true,
        failedLoginAttempts: 0,
        accountLockedUntil: null
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(require('@/utils/password').verifyPassword).mockResolvedValue(false);

      const result = await authService.login(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should handle account lockout after failed attempts', async () => {
      const credentials = {
        email: 'captain@vessel.com',
        password: 'WrongPassword'
      };

      const mockUser = {
        id: 'user123',
        email: credentials.email,
        passwordHash: 'hashed-password',
        isActive: true,
        emailVerified: true,
        failedLoginAttempts: 5,
        accountLockedUntil: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.login(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Account locked');
    });

    it('should reject inactive users', async () => {
      const credentials = {
        email: 'inactive@vessel.com',
        password: 'CorrectPassword123!'
      };

      const mockUser = {
        id: 'user123',
        email: credentials.email,
        passwordHash: 'hashed-password',
        isActive: false,
        emailVerified: true,
        failedLoginAttempts: 0,
        accountLockedUntil: null
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.login(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account deactivated');
    });

    it('should reject unverified email addresses', async () => {
      const credentials = {
        email: 'unverified@vessel.com',
        password: 'CorrectPassword123!'
      };

      const mockUser = {
        id: 'user123',
        email: credentials.email,
        passwordHash: 'hashed-password',
        isActive: true,
        emailVerified: false,
        failedLoginAttempts: 0,
        accountLockedUntil: null
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.login(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email not verified');
    });
  });

  describe('Token Management', () => {
    it('should refresh tokens successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockRefreshToken = {
        id: 'token123',
        userId: 'user123',
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: {
          id: 'user123',
          vessels: [{ id: 'vessel1' }],
          role: 'CAPTAIN'
        }
      };

      mockPrisma.refreshToken.findFirst.mockResolvedValue(mockRefreshToken);
      vi.mocked(generateAccessToken).mockReturnValue('new-access-token');
      vi.mocked(generateRefreshToken).mockReturnValue('new-refresh-token');

      const result = await authService.refreshTokens(refreshToken);

      expect(result.success).toBe(true);
      expect(result.tokens.accessToken).toBe('new-access-token');
      expect(result.tokens.refreshToken).toBe('new-refresh-token');
    });

    it('should reject invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';

      mockPrisma.refreshToken.findFirst.mockResolvedValue(null);

      const result = await authService.refreshTokens(refreshToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid refresh token');
    });

    it('should reject expired refresh token', async () => {
      const refreshToken = 'expired-refresh-token';
      const mockRefreshToken = {
        id: 'token123',
        userId: 'user123',
        token: refreshToken,
        expiresAt: new Date(Date.now() - 1000), // Expired
        user: {
          id: 'user123',
          vessels: [{ id: 'vessel1' }],
          role: 'CAPTAIN'
        }
      };

      mockPrisma.refreshToken.findFirst.mockResolvedValue(mockRefreshToken);

      const result = await authService.refreshTokens(refreshToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Refresh token expired');
    });
  });

  describe('Password Management', () => {
    it('should change password successfully', async () => {
      const userId = 'user123';
      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewPassword456!';

      const mockUser = {
        id: userId,
        passwordHash: 'old-hashed-password'
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(require('@/utils/password').verifyPassword).mockResolvedValue(true);
      vi.mocked(hashPassword).mockResolvedValue('new-hashed-password');
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, passwordHash: 'new-hashed-password' });

      const result = await authService.changePassword(userId, oldPassword, newPassword);

      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { passwordHash: 'new-hashed-password' }
      });
    });

    it('should reject password change with incorrect old password', async () => {
      const userId = 'user123';
      const oldPassword = 'WrongOldPassword';
      const newPassword = 'NewPassword456!';

      const mockUser = {
        id: userId,
        passwordHash: 'old-hashed-password'
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(require('@/utils/password').verifyPassword).mockResolvedValue(false);

      const result = await authService.changePassword(userId, oldPassword, newPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Current password is incorrect');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('Maritime-Specific Authentication', () => {
    it('should handle captain emergency access', async () => {
      const credentials = {
        email: 'captain@vessel.com',
        password: 'EmergencyAccess123!',
        emergencyOverride: true
      };

      const mockUser = {
        id: 'captain123',
        email: credentials.email,
        passwordHash: 'hashed-password',
        isActive: true,
        emailVerified: true,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        vessels: [{ id: 'vessel1' }],
        role: 'CAPTAIN'
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(require('@/utils/password').verifyPassword).mockResolvedValue(true);
      vi.mocked(generateAccessToken).mockReturnValue('emergency-access-token');

      const result = await authService.emergencyLogin(credentials);

      expect(result.success).toBe(true);
      expect(result.emergencyAccess).toBe(true);
      expect(result.tokens.accessToken).toBe('emergency-access-token');
    });

    it('should validate vessel-specific authentication', async () => {
      const credentials = {
        email: 'crew@vessel.com',
        password: 'CrewPassword123!',
        vesselId: 'vessel1'
      };

      const mockUser = {
        id: 'crew123',
        email: credentials.email,
        passwordHash: 'hashed-password',
        isActive: true,
        emailVerified: true,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        vessels: [{ id: 'vessel1' }, { id: 'vessel2' }],
        role: 'CREW'
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(require('@/utils/password').verifyPassword).mockResolvedValue(true);

      const result = await authService.vesselLogin(credentials);

      expect(result.success).toBe(true);
      expect(result.vesselAccess).toContain('vessel1');
    });
  });
});