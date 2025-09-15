import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken } from '@/utils/jwt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Security Penetration Tests', () => {
  let testUser: any;
  let testVessel: any;
  let validToken: string;
  let expiredToken: string;
  let malformedToken: string;

  beforeAll(async () => {
    // Create test data
    testVessel = await prisma.vessel.create({
      data: {
        name: 'Security Test Vessel',
        imoNumber: 'IMO9999999',
        vesselType: 'Test Ship',
        flag: 'Test Flag',
        engineType: 'Test Engine',
        cargoCapacity: 1000,
        fuelConsumption: 100,
        crewComplement: 10,
      },
    });

    testUser = await prisma.user.create({
      data: {
        email: 'security.test@vessel.com',
        passwordHash: 'hashed-password',
        firstName: 'Security',
        lastName: 'Tester',
        role: 'CREW',
        isActive: true,
        emailVerified: true,
      },
    });

    await prisma.vesselAssignment.create({
      data: {
        userId: testUser.id,
        vesselId: testVessel.id,
        role: 'CREW',
      },
    });

    // Generate tokens
    validToken = generateAccessToken(testUser.id);
    
    // Create expired token
    expiredToken = jwt.sign(
      { userId: testUser.id, exp: Math.floor(Date.now() / 1000) - 3600 },
      process.env.JWT_SECRET!
    );

    // Create malformed token
    malformedToken = 'invalid.jwt.token';
  });

  afterAll(async () => {
    await prisma.vesselAssignment.deleteMany({
      where: { vesselId: testVessel.id },
    });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.vessel.delete({ where: { id: testVessel.id } });
    await prisma.$disconnect();
  });

  describe('Authentication Security Tests', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/requisitions')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Access token required');
    });

    it('should reject malformed JWT tokens', async () => {
      const response = await request(app)
        .get('/api/requisitions')
        .set('Authorization', `Bearer ${malformedToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid or expired token');
    });

    it('should reject expired JWT tokens', async () => {
      const response = await request(app)
        .get('/api/requisitions')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid or expired token');
    });

    it('should prevent token manipulation attacks', async () => {
      // Try to modify token payload
      const tokenParts = validToken.split('.');
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      payload.role = 'ADMIN'; // Try to escalate privileges
      
      const manipulatedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const manipulatedToken = `${tokenParts[0]}.${manipulatedPayload}.${tokenParts[2]}`;

      const response = await request(app)
        .get('/api/requisitions')
        .set('Authorization', `Bearer ${manipulatedToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should implement proper token refresh security', async () => {
      // Test refresh token reuse detection
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'correct-password',
        });

      if (loginResponse.status === 200) {
        const refreshToken = loginResponse.body.tokens.refreshToken;

        // Use refresh token once
        const firstRefresh = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken });

        // Try to reuse the same refresh token
        const secondRefresh = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken })
          .expect(403);

        expect(secondRefresh.body.error).toContain('Invalid refresh token');
      }
    });
  });

  describe('Authorization Security Tests', () => {
    it('should prevent horizontal privilege escalation', async () => {
      // Create another user and vessel
      const otherVessel = await prisma.vessel.create({
        data: {
          name: 'Other Vessel',
          imoNumber: 'IMO8888888',
          vesselType: 'Other Ship',
          flag: 'Other Flag',
          engineType: 'Other Engine',
          cargoCapacity: 2000,
          fuelConsumption: 200,
          crewComplement: 15,
        },
      });

      // Try to access other vessel's data
      const response = await request(app)
        .get(`/api/vessels/${otherVessel.id}/requisitions`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Access denied to vessel');

      // Cleanup
      await prisma.vessel.delete({ where: { id: otherVessel.id } });
    });

    it('should prevent vertical privilege escalation', async () => {
      // Try to access admin-only endpoints
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should validate role-based access controls', async () => {
      // Crew member trying to approve requisitions (should fail)
      const requisition = await prisma.requisition.create({
        data: {
          requisitionNumber: 'SEC-TEST-001',
          vesselId: testVessel.id,
          requestedById: testUser.id,
          urgencyLevel: 'ROUTINE',
          status: 'PENDING_APPROVAL',
          totalAmount: 1000,
          currency: 'USD',
        },
      });

      const response = await request(app)
        .post(`/api/requisitions/${requisition.id}/approve`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ comments: 'Unauthorized approval attempt' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient permissions');

      // Cleanup
      await prisma.requisition.delete({ where: { id: requisition.id } });
    });
  });

  describe('Input Validation Security Tests', () => {
    it('should prevent SQL injection attacks', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .get('/api/requisitions')
        .set('Authorization', `Bearer ${validToken}`)
        .query({ search: maliciousInput })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid input');
    });

    it('should prevent XSS attacks in input fields', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      
      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          vesselId: testVessel.id,
          urgencyLevel: 'ROUTINE',
          justification: xssPayload,
          items: [
            {
              name: 'Test Item',
              quantity: 1,
              unitPrice: 100,
              totalPrice: 100,
            },
          ],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should validate file upload security', async () => {
      // Test malicious file upload
      const response = await request(app)
        .post('/api/requisitions/upload-document')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', Buffer.from('<?php system($_GET["cmd"]); ?>'), 'malicious.php')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid file type');
    });

    it('should prevent path traversal attacks', async () => {
      const maliciousPath = '../../../etc/passwd';
      
      const response = await request(app)
        .get(`/api/documents/${maliciousPath}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid path');
    });
  });

  describe('Rate Limiting Security Tests', () => {
    it('should implement rate limiting for login attempts', async () => {
      const loginAttempts = [];
      
      // Make multiple rapid login attempts
      for (let i = 0; i < 10; i++) {
        loginAttempts.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'nonexistent@test.com',
              password: 'wrong-password',
            })
        );
      }

      const responses = await Promise.all(loginAttempts);
      
      // Should start rate limiting after several attempts
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should implement rate limiting for API endpoints', async () => {
      const apiRequests = [];
      
      // Make rapid API requests
      for (let i = 0; i < 100; i++) {
        apiRequests.push(
          request(app)
            .get('/api/requisitions')
            .set('Authorization', `Bearer ${validToken}`)
        );
      }

      const responses = await Promise.all(apiRequests);
      
      // Should start rate limiting
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Session Security Tests', () => {
    it('should implement secure session management', async () => {
      // Test concurrent session limits
      const tokens = [];
      
      for (let i = 0; i < 10; i++) {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'correct-password',
          });

        if (loginResponse.status === 200) {
          tokens.push(loginResponse.body.tokens.accessToken);
        }
      }

      // Older tokens should be invalidated
      if (tokens.length > 5) {
        const oldTokenResponse = await request(app)
          .get('/api/requisitions')
          .set('Authorization', `Bearer ${tokens[0]}`)
          .expect(403);

        expect(oldTokenResponse.body.error).toContain('Session expired');
      }
    });

    it('should handle session fixation attacks', async () => {
      // Attempt to use a pre-generated session ID
      const fixedSessionId = 'fixed-session-id-123';
      
      const response = await request(app)
        .post('/api/auth/login')
        .set('Cookie', `sessionId=${fixedSessionId}`)
        .send({
          email: testUser.email,
          password: 'correct-password',
        });

      if (response.status === 200) {
        // Session ID should be regenerated
        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
          expect(setCookieHeader.toString()).not.toContain(fixedSessionId);
        }
      }
    });
  });

  describe('Data Protection Security Tests', () => {
    it('should not expose sensitive data in error messages', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'wrong-password',
        })
        .expect(401);

      expect(response.body.error).not.toContain('password');
      expect(response.body.error).not.toContain('hash');
      expect(response.body.error).not.toContain('database');
    });

    it('should implement proper data sanitization', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      if (response.status === 200) {
        expect(response.body.user.passwordHash).toBeUndefined();
        expect(response.body.user.refreshTokens).toBeUndefined();
      }
    });

    it('should prevent information disclosure through timing attacks', async () => {
      const startTime1 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'existing@test.com',
          password: 'wrong-password',
        });
      const endTime1 = Date.now();

      const startTime2 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'wrong-password',
        });
      const endTime2 = Date.now();

      // Response times should be similar to prevent user enumeration
      const timeDiff = Math.abs((endTime1 - startTime1) - (endTime2 - startTime2));
      expect(timeDiff).toBeLessThan(100); // Within 100ms
    });
  });

  describe('Maritime-Specific Security Tests', () => {
    it('should validate emergency override security', async () => {
      // Non-captain trying to perform emergency override
      const requisition = await prisma.requisition.create({
        data: {
          requisitionNumber: 'SEC-EMERGENCY-001',
          vesselId: testVessel.id,
          requestedById: testUser.id,
          urgencyLevel: 'EMERGENCY',
          status: 'PENDING_APPROVAL',
          totalAmount: 10000,
          currency: 'USD',
        },
      });

      const response = await request(app)
        .post(`/api/requisitions/${requisition.id}/emergency-override`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          reason: 'Unauthorized emergency override attempt',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Only captains can perform emergency overrides');

      // Cleanup
      await prisma.requisition.delete({ where: { id: requisition.id } });
    });

    it('should validate vessel access controls', async () => {
      // Test access to vessel data without proper assignment
      const response = await request(app)
        .get(`/api/vessels/${testVessel.id}/sensitive-data`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient vessel permissions');
    });

    it('should implement audit trail security', async () => {
      // Attempt to modify audit logs
      const response = await request(app)
        .post('/api/audit-logs/modify')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          logId: 'some-log-id',
          newData: 'modified data',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Audit logs are immutable');
    });
  });

  describe('Compliance Security Tests', () => {
    it('should enforce GDPR data protection requirements', async () => {
      // Test data export request
      const response = await request(app)
        .get('/api/users/data-export')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.personalData).toBeDefined();
      expect(response.body.data.processingPurpose).toBeDefined();
    });

    it('should implement data retention policies', async () => {
      // Test automatic data deletion for expired records
      const response = await request(app)
        .get('/api/data-retention/status')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.retentionPolicies).toBeDefined();
    });

    it('should maintain SOX compliance for financial data', async () => {
      // Test financial data access controls
      const response = await request(app)
        .get('/api/financial/sensitive-reports')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Financial data access restricted');
    });
  });

  describe('Infrastructure Security Tests', () => {
    it('should implement proper HTTPS enforcement', async () => {
      // This would typically be tested at the infrastructure level
      // Here we test that security headers are present
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should prevent clickjacking attacks', async () => {
      const response = await request(app)
        .get('/api/requisitions')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should implement content security policy', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('Advanced Penetration Testing Scenarios', () => {
    it('should prevent HTTP parameter pollution attacks', async () => {
      const response = await request(app)
        .get('/api/requisitions')
        .set('Authorization', `Bearer ${validToken}`)
        .query('status=APPROVED&status=PENDING&status[]=DRAFT')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid parameter format');
    });

    it('should prevent mass assignment vulnerabilities', async () => {
      const maliciousData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        justification: 'Test requisition',
        status: 'APPROVED', // Should not be settable by user
        approvedBy: 'malicious-user-id', // Should not be settable
        totalAmount: 100,
        items: [
          {
            name: 'Test Item',
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
            isApproved: true, // Should not be settable
          },
        ],
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${validToken}`)
        .send(maliciousData)
        .expect(201);

      // Verify protected fields were not set
      expect(response.body.requisition.status).toBe('DRAFT');
      expect(response.body.requisition.approvedBy).toBeNull();
      expect(response.body.requisition.items[0].isApproved).toBeFalsy();
    });

    it('should prevent XML External Entity (XXE) attacks', async () => {
      const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
        <requisition>
          <description>&xxe;</description>
        </requisition>`;

      const response = await request(app)
        .post('/api/requisitions/import-xml')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'application/xml')
        .send(xmlPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('XML parsing not allowed');
    });

    it('should prevent Server-Side Request Forgery (SSRF)', async () => {
      const maliciousUrl = 'http://localhost:22/admin';
      
      const response = await request(app)
        .post('/api/external/fetch-data')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ url: maliciousUrl })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid URL');
    });

    it('should prevent command injection attacks', async () => {
      const maliciousCommand = 'test; rm -rf /';
      
      const response = await request(app)
        .post('/api/system/execute')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ command: maliciousCommand })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unauthorized operation');
    });

    it('should prevent LDAP injection attacks', async () => {
      const maliciousLdapQuery = 'admin)(|(password=*)';
      
      const response = await request(app)
        .get('/api/users/search')
        .set('Authorization', `Bearer ${validToken}`)
        .query({ filter: maliciousLdapQuery })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid search filter');
    });

    it('should prevent NoSQL injection attacks', async () => {
      const maliciousQuery = { $where: 'function() { return true; }' };
      
      const response = await request(app)
        .get('/api/requisitions')
        .set('Authorization', `Bearer ${validToken}`)
        .query({ filter: JSON.stringify(maliciousQuery) })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid query format');
    });

    it('should prevent template injection attacks', async () => {
      const maliciousTemplate = '{{constructor.constructor("return process")().exit()}}';
      
      const response = await request(app)
        .post('/api/notifications/custom')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ template: maliciousTemplate, data: {} })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid template');
    });

    it('should prevent prototype pollution attacks', async () => {
      const maliciousPayload = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        justification: 'Test',
        '__proto__': { isAdmin: true },
        'constructor.prototype.isAdmin': true,
        items: [
          {
            name: 'Test Item',
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
            '__proto__': { approved: true },
          },
        ],
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${validToken}`)
        .send(maliciousPayload)
        .expect(201);

      // Verify prototype pollution didn't occur
      expect(({} as any).isAdmin).toBeUndefined();
      expect(({} as any).approved).toBeUndefined();
    });

    it('should prevent deserialization attacks', async () => {
      const maliciousSerializedData = 'rO0ABXNyABFqYXZhLnV0aWwuSGFzaE1hcAUH2sHDFmDRAwACRgAKbG9hZEZhY3RvckkACXRocmVzaG9sZHhwP0AAAAAAAAx3CAAAABAAAAABdAAEZXhpdHQABGV4aXR4';
      
      const response = await request(app)
        .post('/api/data/deserialize')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ data: maliciousSerializedData })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Deserialization not allowed');
    });
  });

  describe('Business Logic Security Tests', () => {
    it('should prevent price manipulation attacks', async () => {
      const requisition = await prisma.requisition.create({
        data: {
          requisitionNumber: 'PRICE-TEST-001',
          vesselId: testVessel.id,
          requestedById: testUser.id,
          urgencyLevel: 'ROUTINE',
          status: 'APPROVED',
          totalAmount: 1000,
          currency: 'USD',
        },
      });

      // Try to manipulate price during quote submission
      const maliciousQuote = {
        rfqId: 'fake-rfq-id',
        vendorId: 'fake-vendor-id',
        totalAmount: -1000, // Negative amount
        currency: 'USD',
        lineItems: [
          {
            itemId: 'test-item',
            quantity: 1,
            unitPrice: -1000, // Negative price
            totalPrice: -1000,
          },
        ],
      };

      const response = await request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${validToken}`)
        .send(maliciousQuote)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid price');

      // Cleanup
      await prisma.requisition.delete({ where: { id: requisition.id } });
    });

    it('should prevent quantity manipulation attacks', async () => {
      const maliciousRequisition = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        justification: 'Quantity manipulation test',
        items: [
          {
            name: 'Test Item',
            quantity: Number.MAX_SAFE_INTEGER, // Extremely large quantity
            unitPrice: 0.01,
            totalPrice: Number.MAX_SAFE_INTEGER * 0.01,
          },
        ],
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${validToken}`)
        .send(maliciousRequisition)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid quantity');
    });

    it('should prevent workflow bypass attacks', async () => {
      const requisition = await prisma.requisition.create({
        data: {
          requisitionNumber: 'WORKFLOW-TEST-001',
          vesselId: testVessel.id,
          requestedById: testUser.id,
          urgencyLevel: 'ROUTINE',
          status: 'DRAFT',
          totalAmount: 10000,
          currency: 'USD',
        },
      });

      // Try to skip approval workflow
      const response = await request(app)
        .post(`/api/requisitions/${requisition.id}/force-approve`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ bypassWorkflow: true })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient permissions');

      // Cleanup
      await prisma.requisition.delete({ where: { id: requisition.id } });
    });

    it('should prevent budget bypass attacks', async () => {
      const maliciousRequisition = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        justification: 'Budget bypass test',
        budgetOverride: true, // Should not be allowed
        items: [
          {
            name: 'Expensive Item',
            quantity: 1,
            unitPrice: 1000000, // Exceeds budget
            totalPrice: 1000000,
          },
        ],
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${validToken}`)
        .send(maliciousRequisition)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Exceeds budget limit');
    });
  });

  describe('API Security Stress Tests', () => {
    it('should handle malformed JSON gracefully', async () => {
      const malformedJson = '{"vesselId": "test", "items": [{"name": "test"';
      
      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'application/json')
        .send(malformedJson)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid JSON');
    });

    it('should handle extremely large payloads', async () => {
      const largePayload = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        justification: 'A'.repeat(10000), // Very long justification
        items: Array.from({ length: 1000 }, (_, i) => ({
          name: `Item ${i}`,
          quantity: 1,
          unitPrice: 100,
          totalPrice: 100,
        })),
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${validToken}`)
        .send(largePayload)
        .expect(413);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Payload too large');
    });

    it('should handle deeply nested objects', async () => {
      let deepObject: any = { vesselId: testVessel.id };
      for (let i = 0; i < 100; i++) {
        deepObject = { nested: deepObject };
      }

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${validToken}`)
        .send(deepObject)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Object too deeply nested');
    });

    it('should handle circular references in JSON', async () => {
      const circularObject: any = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        justification: 'Circular reference test',
      };
      circularObject.self = circularObject;

      // This should be caught by JSON.stringify before reaching the server
      expect(() => JSON.stringify(circularObject)).toThrow();
    });
  });

  describe('Cryptographic Security Tests', () => {
    it('should use secure random number generation', async () => {
      const response = await request(app)
        .get('/api/security/random-token')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(response.body.token.length).toBeGreaterThan(32);
      expect(response.body.entropy).toBeGreaterThan(128); // bits of entropy
    });

    it('should properly validate cryptographic signatures', async () => {
      const invalidSignature = 'invalid-signature-data';
      
      const response = await request(app)
        .post('/api/security/verify-signature')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          data: 'test data',
          signature: invalidSignature,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid signature');
    });

    it('should prevent timing attacks on sensitive operations', async () => {
      const validEmail = testUser.email;
      const invalidEmail = 'nonexistent@test.com';

      // Measure response times
      const startTime1 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({ email: validEmail, password: 'wrong-password' });
      const time1 = Date.now() - startTime1;

      const startTime2 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({ email: invalidEmail, password: 'wrong-password' });
      const time2 = Date.now() - startTime2;

      // Response times should be similar (within 50ms)
      const timeDifference = Math.abs(time1 - time2);
      expect(timeDifference).toBeLessThan(50);
    });
  });

  describe('Compliance and Regulatory Security Tests', () => {
    it('should enforce data retention policies', async () => {
      const response = await request(app)
        .get('/api/compliance/data-retention-status')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.policies).toBeDefined();
      expect(response.body.policies.length).toBeGreaterThan(0);
      
      response.body.policies.forEach((policy: any) => {
        expect(policy.dataType).toBeDefined();
        expect(policy.retentionPeriod).toBeDefined();
        expect(policy.deletionMethod).toBeDefined();
      });
    });

    it('should support right to be forgotten (GDPR)', async () => {
      const response = await request(app)
        .post('/api/compliance/delete-user-data')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ userId: testUser.id, reason: 'User request' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.deletionId).toBeDefined();
      expect(response.body.estimatedCompletion).toBeDefined();
    });

    it('should maintain audit logs for security events', async () => {
      // Trigger a security event
      await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrong-password' })
        .expect(401);

      const auditResponse = await request(app)
        .get('/api/security/audit-logs')
        .set('Authorization', `Bearer ${validToken}`)
        .query({ eventType: 'FAILED_LOGIN' })
        .expect(200);

      expect(auditResponse.body.logs).toBeDefined();
      expect(auditResponse.body.logs.length).toBeGreaterThan(0);
      
      const failedLoginLog = auditResponse.body.logs.find((log: any) => 
        log.eventType === 'FAILED_LOGIN' && log.userId === testUser.id
      );
      expect(failedLoginLog).toBeDefined();
    });
  });
});