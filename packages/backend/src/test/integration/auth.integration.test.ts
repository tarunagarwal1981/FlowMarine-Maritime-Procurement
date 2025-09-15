import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@/utils/password';

describe('Authentication Integration Tests', () => {
  let prisma: PrismaClient;
  let testUser: any;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    const passwordHash = await hashPassword('TestPassword123!');
    testUser = await prisma.user.create({
      data: {
        email: 'test@flowmarine.com',
        passwordHash,
        firstName: 'Test',
        lastName: 'User',
        role: 'CAPTAIN',
        emailVerified: true,
        isActive: true
      }
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user successfully', async () => {
      const userData = {
        email: 'newuser@flowmarine.com',
        password: 'NewPassword123!',
        firstName: 'New',
        lastName: 'User',
        role: 'CREW'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.passwordHash).toBeUndefined(); // Should not return password hash

      // Verify user was created in database
      const createdUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });
      expect(createdUser).toBeTruthy();
      expect(createdUser!.emailVerified).toBe(false); // Should require email verification
    });

    it('should reject registration with existing email', async () => {
      const userData = {
        email: testUser.email,
        password: 'AnotherPassword123!',
        firstName: 'Another',
        lastName: 'User',
        role: 'CREW'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email already registered');
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        email: 'incomplete@flowmarine.com',
        // Missing password, firstName, lastName, role
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        email: 'invalid-email',
        password: 'ValidPassword123!',
        firstName: 'Test',
        lastName: 'User',
        role: 'CREW'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidEmailData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate password strength', async () => {
      const weakPasswordData = {
        email: 'weakpass@flowmarine.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
        role: 'CREW'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const credentials = {
        email: testUser.email,
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user.passwordHash).toBeUndefined();

      // Verify refresh token was stored
      const refreshToken = await prisma.refreshToken.findFirst({
        where: { userId: testUser.id }
      });
      expect(refreshToken).toBeTruthy();
    });

    it('should reject invalid credentials', async () => {
      const credentials = {
        email: testUser.email,
        password: 'WrongPassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const credentials = {
        email: 'nonexistent@flowmarine.com',
        password: 'AnyPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle account lockout', async () => {
      // Update user to be locked
      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          failedLoginAttempts: 5,
          accountLockedUntil: new Date(Date.now() + 30 * 60 * 1000)
        }
      });

      const credentials = {
        email: testUser.email,
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(423);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Account locked');
    });

    it('should reject inactive users', async () => {
      // Deactivate user
      await prisma.user.update({
        where: { id: testUser.id },
        data: { isActive: false }
      });

      const credentials = {
        email: testUser.email,
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Account deactivated');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Login to get refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!'
        });

      refreshToken = loginResponse.body.tokens.refreshToken;
    });

    it('should refresh tokens successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
      expect(response.body.tokens.refreshToken).not.toBe(refreshToken); // Should be new token
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid refresh token');
    });

    it('should reject expired refresh token', async () => {
      // Manually expire the refresh token
      await prisma.refreshToken.updateMany({
        where: { userId: testUser.id },
        data: { expiresAt: new Date(Date.now() - 1000) }
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Refresh token expired');
    });
  });

  describe('POST /api/auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!'
        });

      accessToken = loginResponse.body.tokens.accessToken;
      refreshToken = loginResponse.body.tokens.refreshToken;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify refresh token was deleted
      const deletedToken = await prisma.refreshToken.findFirst({
        where: { token: refreshToken }
      });
      expect(deletedToken).toBeNull();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.error).toBe('Access token required');
    });
  });

  describe('Maritime-Specific Authentication', () => {
    it('should handle emergency captain override', async () => {
      // Update user to captain role
      await prisma.user.update({
        where: { id: testUser.id },
        data: { role: 'CAPTAIN' }
      });

      const response = await request(app)
        .post('/api/auth/emergency-login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
          emergencyReason: 'Critical engine failure requiring immediate procurement'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.emergencyAccess).toBe(true);
      expect(response.body.tokens.accessToken).toBeDefined();
    });

    it('should reject emergency access for non-captain roles', async () => {
      // Ensure user is not captain
      await prisma.user.update({
        where: { id: testUser.id },
        data: { role: 'CREW' }
      });

      const response = await request(app)
        .post('/api/auth/emergency-login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
          emergencyReason: 'Emergency situation'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Captain role required');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on login attempts', async () => {
      const credentials = {
        email: testUser.email,
        password: 'WrongPassword'
      };

      // Make multiple failed login attempts
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send(credentials)
      );

      const responses = await Promise.all(promises);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});