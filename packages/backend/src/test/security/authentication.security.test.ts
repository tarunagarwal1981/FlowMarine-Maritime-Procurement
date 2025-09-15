import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { prisma } from '@/config/database';
import { generateTestToken, createTestUser } from '../helpers/testHelpers';
import jwt from 'jsonwebtoken';

describe('Authentication Security Tests', () => {
  let testUser: any;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    testUser = await createTestUser({
      email: 'security.test@example.com',
      role: 'VESSEL_CREW',
      isActive: true,
      emailVerified: true,
    });
  });

  afterEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('JWT Token Security', () => {
    it('should reject requests with no authentication token', async () => {
      const response = await request(app)
        .get('/api/vessels')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Access token required');
    });

    it('should reject requests with invalid JWT token', async () => {
      const invalidToken = 'invalid.jwt.token';

      const response = await request(app)
        .get('/api/vessels')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid or expired token');
    });

    it('should reject requests with expired JWT token', async () => {
      const expiredToken = jwt.sign(
        { userId: testUser.id, exp: Math.floor(Date.now() / 1000) - 3600 }, // Expired 1 hour ago
        process.env.JWT_SECRET!
      );

      const response = await request(app)
        .get('/api/vessels')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid or expired token');
    });

    it('should reject tokens with invalid signature', async () => {
      const tokenWithInvalidSignature = jwt.sign(
        { userId: testUser.id, exp: Math.floor(Date.now() / 1000) + 3600 },
        'wrong-secret'
      );

      const response = await request(app)
        .get('/api/vessels')
        .set('Authorization', `Bearer ${tokenWithInvalidSignature}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid or expired token');
    });

    it('should automatically refresh tokens close to expiry', async () => {
      const nearExpiryToken = jwt.sign(
        { 
          userId: testUser.id, 
          exp: Math.floor(Date.now() / 1000) + 200 // Expires in 200 seconds
        },
        process.env.JWT_SECRET!
      );

      // Create refresh token
      await prisma.refreshToken.create({
        data: {
          userId: testUser.id,
          token: 'refresh-token-123',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      const response = await request(app)
        .get('/api/vessels')
        .set('Authorization', `Bearer ${nearExpiryToken}`)
        .expect(200);

      expect(response.headers['x-new-token']).toBeDefined();
    });
  });

  describe('Brute Force Protection', () => {
    it('should lock account after 5 failed login attempts', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword',
      };

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(401);
      }

      // 6th attempt should result in account lock
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(423);

      expect(response.body.error).toContain('Account locked');
      expect(response.body.lockoutDuration).toBeDefined();
    });

    it('should reset failed attempts counter after successful login', async () => {
      const wrongLoginData = {
        email: testUser.email,
        password: 'wrongpassword',
      };

      const correctLoginData = {
        email: testUser.email,
        password: 'correctpassword',
      };

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(wrongLoginData)
          .expect(401);
      }

      // Successful login should reset counter
      await request(app)
        .post('/api/auth/login')
        .send(correctLoginData)
        .expect(200);

      // Verify counter was reset by checking user record
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(updatedUser?.failedLoginAttempts).toBe(0);
    });

    it('should implement progressive lockout delays', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword',
      };

      // First lockout (5 failed attempts)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(loginData);
      }

      const firstLockResponse = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(423);

      expect(firstLockResponse.body.lockoutDuration).toBe(15); // 15 minutes

      // Simulate unlocking and second lockout
      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          failedLoginAttempts: 0,
          accountLockedUntil: null,
        },
      });

      // Second lockout should have longer duration
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(loginData);
      }

      const secondLockResponse = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(423);

      expect(secondLockResponse.body.lockoutDuration).toBe(30); // 30 minutes
    });
  });

  describe('Session Management Security', () => {
    it('should invalidate all sessions on password change', async () => {
      const validToken = generateTestToken(testUser);

      // Create multiple refresh tokens (simulating multiple sessions)
      await Promise.all([
        prisma.refreshToken.create({
          data: {
            userId: testUser.id,
            token: 'refresh-token-1',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        }),
        prisma.refreshToken.create({
          data: {
            userId: testUser.id,
            token: 'refresh-token-2',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        }),
      ]);

      // Change password
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          currentPassword: 'currentpassword',
          newPassword: 'NewSecurePassword123!',
        })
        .expect(200);

      // All refresh tokens should be invalidated
      const remainingTokens = await prisma.refreshToken.findMany({
        where: { userId: testUser.id },
      });

      expect(remainingTokens).toHaveLength(0);
    });

    it('should track and limit concurrent sessions', async () => {
      const maxSessions = 3;

      // Create maximum allowed sessions
      const refreshTokens = [];
      for (let i = 0; i < maxSessions; i++) {
        const token = await prisma.refreshToken.create({
          data: {
            userId: testUser.id,
            token: `refresh-token-${i}`,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        refreshTokens.push(token);
      }

      // Attempt to create one more session
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'correctpassword',
        })
        .expect(200);

      // Should have removed oldest session
      const activeSessions = await prisma.refreshToken.findMany({
        where: { userId: testUser.id },
      });

      expect(activeSessions).toHaveLength(maxSessions);
      expect(activeSessions.find(t => t.token === 'refresh-token-0')).toBeUndefined();
    });

    it('should detect and prevent session hijacking', async () => {
      const validToken = generateTestToken(testUser);
      const userAgent1 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      const userAgent2 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
      const ip1 = '192.168.1.100';
      const ip2 = '10.0.0.50';

      // First request from IP1 with UserAgent1
      await request(app)
        .get('/api/vessels')
        .set('Authorization', `Bearer ${validToken}`)
        .set('User-Agent', userAgent1)
        .set('X-Forwarded-For', ip1)
        .expect(200);

      // Second request from different IP and UserAgent (suspicious)
      const response = await request(app)
        .get('/api/vessels')
        .set('Authorization', `Bearer ${validToken}`)
        .set('User-Agent', userAgent2)
        .set('X-Forwarded-For', ip2)
        .expect(403);

      expect(response.body.error).toContain('Suspicious session activity');
    });
  });

  describe('Multi-Factor Authentication', () => {
    beforeEach(async () => {
      await prisma.user.update({
        where: { id: testUser.id },
        data: { mfaEnabled: true, mfaSecret: 'test-mfa-secret' },
      });
    });

    it('should require MFA token for sensitive operations', async () => {
      const validToken = generateTestToken(testUser);

      const response = await request(app)
        .post('/api/auth/emergency-override')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          requisitionId: 'req-123',
          reason: 'Emergency repair needed',
        })
        .expect(403);

      expect(response.body.error).toContain('MFA token required');
    });

    it('should validate TOTP codes correctly', async () => {
      const validToken = generateTestToken(testUser);
      const validTOTP = '123456'; // Mock valid TOTP

      const response = await request(app)
        .post('/api/auth/verify-mfa')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ totpCode: validTOTP })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.mfaVerified).toBe(true);
    });

    it('should reject invalid TOTP codes', async () => {
      const validToken = generateTestToken(testUser);
      const invalidTOTP = '000000';

      const response = await request(app)
        .post('/api/auth/verify-mfa')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ totpCode: invalidTOTP })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid MFA token');
    });

    it('should provide backup codes for MFA recovery', async () => {
      const validToken = generateTestToken(testUser);

      const response = await request(app)
        .post('/api/auth/generate-backup-codes')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.backupCodes).toHaveLength(10);
      expect(response.body.data.backupCodes[0]).toMatch(/^[A-Z0-9]{8}$/);
    });
  });

  describe('Password Security', () => {
    it('should enforce strong password requirements', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'Password',
        'Password123',
        'password123!',
        'PASSWORD123!',
      ];

      for (const weakPassword of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: weakPassword,
            firstName: 'Test',
            lastName: 'User',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Password does not meet security requirements');
      }
    });

    it('should prevent password reuse', async () => {
      const validToken = generateTestToken(testUser);
      const currentPassword = 'CurrentPassword123!';
      const newPassword = 'NewPassword123!';

      // First password change
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          currentPassword,
          newPassword,
        })
        .expect(200);

      // Attempt to reuse previous password
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          currentPassword: newPassword,
          newPassword: currentPassword, // Reusing old password
        })
        .expect(400);

      expect(response.body.error).toContain('Password has been used recently');
    });

    it('should enforce password expiration for high-privilege users', async () => {
      const captainUser = await createTestUser({
        role: 'CAPTAIN',
        lastPasswordChange: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000), // 91 days ago
      });

      const expiredToken = generateTestToken(captainUser);

      const response = await request(app)
        .get('/api/vessels')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(403);

      expect(response.body.error).toContain('Password expired');
      expect(response.body.requiresPasswordChange).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit login attempts per IP', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword',
      };

      // Make requests up to rate limit
      const maxAttempts = 10;
      for (let i = 0; i < maxAttempts; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(loginData);
      }

      // Next request should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(429);

      expect(response.body.error).toContain('Too many requests');
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should have different rate limits for vessel vs shore operations', async () => {
      const vesselToken = generateTestToken({ ...testUser, location: 'VESSEL' });
      const shoreToken = generateTestToken({ ...testUser, location: 'SHORE' });

      // Vessel operations should have higher rate limits
      const vesselRequests = [];
      for (let i = 0; i < 100; i++) {
        vesselRequests.push(
          request(app)
            .get('/api/vessels')
            .set('Authorization', `Bearer ${vesselToken}`)
        );
      }

      const vesselResponses = await Promise.all(vesselRequests);
      const vesselRateLimited = vesselResponses.filter(r => r.status === 429);

      // Shore operations should have lower rate limits
      const shoreRequests = [];
      for (let i = 0; i < 100; i++) {
        shoreRequests.push(
          request(app)
            .get('/api/vessels')
            .set('Authorization', `Bearer ${shoreToken}`)
        );
      }

      const shoreResponses = await Promise.all(shoreRequests);
      const shoreRateLimited = shoreResponses.filter(r => r.status === 429);

      expect(shoreRateLimited.length).toBeGreaterThan(vesselRateLimited.length);
    });
  });

  describe('Security Headers and HTTPS', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should enforce HTTPS in production', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/health')
        .set('X-Forwarded-Proto', 'http') // Simulate HTTP request
        .expect(301);

      expect(response.headers.location).toMatch(/^https:/);
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should prevent SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE users; --";

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: maliciousInput,
          password: 'password',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid email format');
    });

    it('should prevent XSS attacks in input fields', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      const validToken = generateTestToken(testUser);

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          firstName: xssPayload,
          lastName: 'User',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid characters in name');
    });

    it('should validate and sanitize file uploads', async () => {
      const validToken = generateTestToken(testUser);

      const response = await request(app)
        .post('/api/auth/upload-avatar')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('avatar', Buffer.from('fake-executable-content'), 'malicious.exe')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid file type');
    });
  });

  describe('Audit Logging', () => {
    it('should log all authentication events', async () => {
      const loginData = {
        email: testUser.email,
        password: 'correctpassword',
      };

      await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          userId: testUser.id,
          action: 'LOGIN_SUCCESS',
        },
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].details).toContain('ip');
      expect(auditLogs[0].details).toContain('userAgent');
    });

    it('should log security violations', async () => {
      const invalidToken = 'invalid.jwt.token';

      await request(app)
        .get('/api/vessels')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(403);

      const securityLogs = await prisma.auditLog.findMany({
        where: {
          action: 'INVALID_TOKEN_ATTEMPT',
        },
      });

      expect(securityLogs.length).toBeGreaterThan(0);
    });
  });
});