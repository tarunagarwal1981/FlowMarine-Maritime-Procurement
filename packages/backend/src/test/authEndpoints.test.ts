import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../server.js';

const prisma = new PrismaClient();

describe('Authentication Endpoints', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.refreshToken.deleteMany();
    await prisma.emergencyOverride.deleteMany();
    await prisma.userPermission.deleteMany();
    await prisma.vesselAssignment.deleteMany();
    await prisma.user.deleteMany();
    await prisma.vessel.deleteMany();
    await prisma.permission.deleteMany();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.refreshToken.deleteMany();
    await prisma.emergencyOverride.deleteMany();
    await prisma.userPermission.deleteMany();
    await prisma.vesselAssignment.deleteMany();
    await prisma.user.deleteMany();
    await prisma.vessel.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.refreshToken.deleteMany();
    await prisma.emergencyOverride.deleteMany();
    await prisma.userPermission.deleteMany();
    await prisma.vesselAssignment.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'VESSEL_CREW'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(userData.email);
      expect(response.body.data.firstName).toBe(userData.firstName);
      expect(response.body.data.lastName).toBe(userData.lastName);
      expect(response.body.data.role).toBe(userData.role);
      expect(response.body.data.emailVerified).toBe(false);
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'VESSEL_CREW'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'VESSEL_CREW'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'VESSEL_CREW'
      };

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('USER_EXISTS');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      const userData = {
        email: 'login@example.com',
        password: 'password123',
        firstName: 'Login',
        lastName: 'User',
        role: 'VESSEL_CREW'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(loginData.email);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.expiresIn).toBe('15m');
      expect(response.headers['set-cookie']).toBeDefined(); // Refresh token cookie
    });

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should lock account after 5 failed login attempts', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'wrongpassword'
      };

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(401);
      }

      // 6th attempt should lock the account
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.code).toBe('ACCOUNT_LOCKED');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Create and login a user to get refresh token
      const userData = {
        email: 'refresh@example.com',
        password: 'password123',
        firstName: 'Refresh',
        lastName: 'User',
        role: 'VESSEL_CREW'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      // Extract refresh token from cookie
      const cookies = loginResponse.headers['set-cookie'];
      const refreshCookie = cookies.find((cookie: string) => cookie.startsWith('refreshToken='));
      refreshToken = refreshCookie?.split('=')[1]?.split(';')[0] || '';
    });

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user).toBeDefined();
    });

    it('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('REFRESH_TOKEN_REQUIRED');
    });
  });

  describe('POST /api/auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Create and login a user
      const userData = {
        email: 'logout@example.com',
        password: 'password123',
        firstName: 'Logout',
        lastName: 'User',
        role: 'VESSEL_CREW'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      accessToken = loginResponse.body.data.accessToken;
      
      // Extract refresh token from cookie
      const cookies = loginResponse.headers['set-cookie'];
      const refreshCookie = cookies.find((cookie: string) => cookie.startsWith('refreshToken='));
      refreshToken = refreshCookie?.split('=')[1]?.split(';')[0] || '';
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');
    });
  });

  describe('GET /api/auth/profile', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Create and login a user
      const userData = {
        email: 'profile@example.com',
        password: 'password123',
        firstName: 'Profile',
        lastName: 'User',
        role: 'VESSEL_CREW'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      accessToken = loginResponse.body.data.accessToken;
    });

    it('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('profile@example.com');
      expect(response.body.data.firstName).toBe('Profile');
      expect(response.body.data.lastName).toBe('User');
      expect(response.body.data.role).toBe('VESSEL_CREW');
    });

    it('should reject profile request without authentication', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_REQUIRED');
    });
  });
});