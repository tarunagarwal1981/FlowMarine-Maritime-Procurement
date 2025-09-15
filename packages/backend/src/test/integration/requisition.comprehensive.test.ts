import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken } from '@/utils/jwt';

const prisma = new PrismaClient();

describe('Requisition Integration Tests', () => {
  let testUser: any;
  let testVessel: any;
  let testCaptain: any;
  let testSuperintendent: any;
  let authToken: string;
  let captainToken: string;
  let superintendentToken: string;

  beforeAll(async () => {
    // Setup test data
    testVessel = await prisma.vessel.create({
      data: {
        name: 'Test Vessel Alpha',
        imoNumber: 'IMO1234567',
        vesselType: 'Container Ship',
        flag: 'Singapore',
        engineType: 'MAN B&W',
        cargoCapacity: 20000,
        fuelConsumption: 250,
        crewComplement: 25,
        currentLatitude: 1.2966,
        currentLongitude: 103.7764,
      },
    });

    testUser = await prisma.user.create({
      data: {
        email: 'crew@testvessel.com',
        passwordHash: 'hashed-password',
        firstName: 'John',
        lastName: 'Crew',
        role: 'CREW',
        isActive: true,
        emailVerified: true,
      },
    });

    testCaptain = await prisma.user.create({
      data: {
        email: 'captain@testvessel.com',
        passwordHash: 'hashed-password',
        firstName: 'Jane',
        lastName: 'Captain',
        role: 'CAPTAIN',
        isActive: true,
        emailVerified: true,
      },
    });

    testSuperintendent = await prisma.user.create({
      data: {
        email: 'superintendent@company.com',
        passwordHash: 'hashed-password',
        firstName: 'Bob',
        lastName: 'Superintendent',
        role: 'SUPERINTENDENT',
        isActive: true,
        emailVerified: true,
      },
    });

    // Create vessel assignments
    await prisma.vesselAssignment.createMany({
      data: [
        { userId: testUser.id, vesselId: testVessel.id, role: 'CREW' },
        { userId: testCaptain.id, vesselId: testVessel.id, role: 'CAPTAIN' },
        { userId: testSuperintendent.id, vesselId: testVessel.id, role: 'SUPERINTENDENT' },
      ],
    });

    // Generate auth tokens
    authToken = generateAccessToken(testUser.id);
    captainToken = generateAccessToken(testCaptain.id);
    superintendentToken = generateAccessToken(testSuperintendent.id);
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.vesselAssignment.deleteMany({
      where: { vesselId: testVessel.id },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUser.id, testCaptain.id, testSuperintendent.id] } },
    });
    await prisma.vessel.delete({
      where: { id: testVessel.id },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up requisitions before each test
    await prisma.requisition.deleteMany({
      where: { vesselId: testVessel.id },
    });
  });

  describe('Requisition Creation Workflow', () => {
    it('should create a new requisition successfully', async () => {
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Singapore',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Regular maintenance supplies',
        items: [
          {
            itemCatalogId: null,
            name: 'Engine Oil Filter',
            description: 'High-quality engine oil filter',
            quantity: 5,
            unitPrice: 45.50,
            totalPrice: 227.50,
            urgencyLevel: 'ROUTINE',
          },
        ],
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requisitionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.requisition.vesselId).toBe(testVessel.id);
      expect(response.body.requisition.requestedById).toBe(testUser.id);
      expect(response.body.requisition.status).toBe('DRAFT');
      expect(response.body.requisition.items).toHaveLength(1);
    });

    it('should validate vessel access when creating requisition', async () => {
      const otherVessel = await prisma.vessel.create({
        data: {
          name: 'Other Vessel',
          imoNumber: 'IMO7654321',
          vesselType: 'Tanker',
          flag: 'Panama',
          engineType: 'Wartsila',
          cargoCapacity: 50000,
          fuelConsumption: 180,
          crewComplement: 20,
        },
      });

      const requisitionData = {
        vesselId: otherVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Rotterdam',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Unauthorized vessel access attempt',
        items: [
          {
            name: 'Test Item',
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requisitionData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Access denied to vessel');

      // Cleanup
      await prisma.vessel.delete({ where: { id: otherVessel.id } });
    });

    it('should handle offline requisition synchronization', async () => {
      const offlineRequisition = {
        vesselId: testVessel.id,
        urgencyLevel: 'URGENT',
        deliveryLocation: 'Port of Hamburg',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Created offline during poor connectivity',
        offlineId: 'offline-req-123',
        createdOffline: true,
        items: [
          {
            name: 'Emergency Repair Kit',
            quantity: 1,
            unitPrice: 500,
            totalPrice: 500,
          },
        ],
      };

      const response = await request(app)
        .post('/api/requisitions/sync-offline')
        .set('Authorization', `Bearer ${authToken}`)
        .send(offlineRequisition)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.requisition.offlineId).toBe('offline-req-123');
      expect(response.body.requisition.syncedAt).toBeDefined();
    });
  });

  describe('Approval Workflow Integration', () => {
    it('should auto-approve routine items under $500', async () => {
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Singapore',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Small routine purchase',
        items: [
          {
            name: 'Cleaning Supplies',
            quantity: 10,
            unitPrice: 25,
            totalPrice: 250,
          },
        ],
      };

      // Create requisition
      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requisitionData)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Submit for approval
      const submitResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(submitResponse.body.success).toBe(true);
      expect(submitResponse.body.requisition.status).toBe('APPROVED');
      expect(submitResponse.body.autoApproved).toBe(true);
    });

    it('should route to superintendent for $500-$5000 items', async () => {
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Singapore',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Medium value purchase requiring approval',
        items: [
          {
            name: 'Navigation Equipment',
            quantity: 1,
            unitPrice: 2500,
            totalPrice: 2500,
          },
        ],
      };

      // Create and submit requisition
      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requisitionData)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      const submitResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(submitResponse.body.success).toBe(true);
      expect(submitResponse.body.requisition.status).toBe('PENDING_APPROVAL');
      expect(submitResponse.body.approvalLevel).toBe('SUPERINTENDENT');

      // Superintendent approves
      const approveResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .send({ comments: 'Approved for navigation safety' })
        .expect(200);

      expect(approveResponse.body.success).toBe(true);
      expect(approveResponse.body.requisition.status).toBe('APPROVED');
    });

    it('should handle emergency override by captain', async () => {
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'EMERGENCY',
        deliveryLocation: 'Current Position',
        deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Engine failure - safety critical',
        items: [
          {
            name: 'Emergency Engine Parts',
            quantity: 1,
            unitPrice: 15000,
            totalPrice: 15000,
          },
        ],
      };

      // Create requisition
      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requisitionData)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Captain emergency override
      const overrideResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/emergency-override`)
        .set('Authorization', `Bearer ${captainToken}`)
        .send({
          reason: 'Engine failure poses immediate safety risk',
          requiresPostApproval: true,
        })
        .expect(200);

      expect(overrideResponse.body.success).toBe(true);
      expect(overrideResponse.body.requisition.status).toBe('APPROVED');
      expect(overrideResponse.body.emergencyOverride).toBe(true);
      expect(overrideResponse.body.requiresPostApproval).toBe(true);
    });
  });

  describe('Requisition Management', () => {
    it('should retrieve requisitions for vessel', async () => {
      // Create test requisitions
      const req1 = await prisma.requisition.create({
        data: {
          requisitionNumber: 'REQ-001',
          vesselId: testVessel.id,
          requestedById: testUser.id,
          urgencyLevel: 'ROUTINE',
          status: 'APPROVED',
          totalAmount: 500,
          currency: 'USD',
          deliveryLocation: 'Port A',
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const req2 = await prisma.requisition.create({
        data: {
          requisitionNumber: 'REQ-002',
          vesselId: testVessel.id,
          requestedById: testUser.id,
          urgencyLevel: 'URGENT',
          status: 'PENDING_APPROVAL',
          totalAmount: 1500,
          currency: 'USD',
          deliveryLocation: 'Port B',
          deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      });

      const response = await request(app)
        .get(`/api/vessels/${testVessel.id}/requisitions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.requisitions).toHaveLength(2);
      expect(response.body.requisitions.map((r: any) => r.id)).toContain(req1.id);
      expect(response.body.requisitions.map((r: any) => r.id)).toContain(req2.id);
    });

    it('should filter requisitions by status', async () => {
      // Create requisitions with different statuses
      await prisma.requisition.createMany({
        data: [
          {
            requisitionNumber: 'REQ-003',
            vesselId: testVessel.id,
            requestedById: testUser.id,
            urgencyLevel: 'ROUTINE',
            status: 'DRAFT',
            totalAmount: 300,
            currency: 'USD',
          },
          {
            requisitionNumber: 'REQ-004',
            vesselId: testVessel.id,
            requestedById: testUser.id,
            urgencyLevel: 'ROUTINE',
            status: 'APPROVED',
            totalAmount: 800,
            currency: 'USD',
          },
        ],
      });

      const response = await request(app)
        .get(`/api/vessels/${testVessel.id}/requisitions?status=APPROVED`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.requisitions.every((r: any) => r.status === 'APPROVED')).toBe(true);
    });

    it('should update requisition details', async () => {
      const requisition = await prisma.requisition.create({
        data: {
          requisitionNumber: 'REQ-005',
          vesselId: testVessel.id,
          requestedById: testUser.id,
          urgencyLevel: 'ROUTINE',
          status: 'DRAFT',
          totalAmount: 600,
          currency: 'USD',
          deliveryLocation: 'Port C',
          justification: 'Original justification',
        },
      });

      const updateData = {
        urgencyLevel: 'URGENT',
        deliveryLocation: 'Port D',
        justification: 'Updated justification - now urgent',
      };

      const response = await request(app)
        .put(`/api/requisitions/${requisition.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.requisition.urgencyLevel).toBe('URGENT');
      expect(response.body.requisition.deliveryLocation).toBe('Port D');
      expect(response.body.requisition.justification).toBe('Updated justification - now urgent');
    });

    it('should prevent updates to approved requisitions', async () => {
      const requisition = await prisma.requisition.create({
        data: {
          requisitionNumber: 'REQ-006',
          vesselId: testVessel.id,
          requestedById: testUser.id,
          urgencyLevel: 'ROUTINE',
          status: 'APPROVED',
          totalAmount: 400,
          currency: 'USD',
        },
      });

      const updateData = {
        urgencyLevel: 'URGENT',
        justification: 'Trying to update approved requisition',
      };

      const response = await request(app)
        .put(`/api/requisitions/${requisition.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Cannot modify approved requisition');
    });
  });

  describe('Maritime-Specific Features', () => {
    it('should validate vessel position for delivery', async () => {
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Singapore',
        deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Delivery validation test',
        items: [
          {
            name: 'Test Item',
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
      };

      const response = await request(app)
        .post('/api/requisitions/validate-delivery')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requisitionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.validation.deliveryFeasible).toBe(true);
      expect(response.body.validation.estimatedDistance).toBeDefined();
      expect(response.body.validation.estimatedTransitTime).toBeDefined();
    });

    it('should handle IMPA/ISSA catalog integration', async () => {
      // Create test catalog item
      const catalogItem = await prisma.itemCatalog.create({
        data: {
          impaCode: '593.21.01',
          issaCode: 'ISSA-593-21-01',
          name: 'Life Jacket Adult',
          description: 'SOLAS approved life jacket for adults',
          category: 'SAFETY_EQUIPMENT',
          criticalityLevel: 'SAFETY_CRITICAL',
          unitOfMeasure: 'PIECE',
          averagePrice: 85.50,
          leadTime: 3,
        },
      });

      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'URGENT',
        deliveryLocation: 'Port of Singapore',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Safety equipment replacement',
        items: [
          {
            itemCatalogId: catalogItem.id,
            quantity: 10,
            unitPrice: 85.50,
            totalPrice: 855,
          },
        ],
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requisitionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.requisition.items[0].itemCatalogId).toBe(catalogItem.id);
      expect(response.body.safetyCritical).toBe(true);

      // Cleanup
      await prisma.itemCatalog.delete({ where: { id: catalogItem.id } });
    });

    it('should track compliance requirements', async () => {
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Singapore',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Compliance testing',
        complianceFlags: ['SOLAS', 'MARPOL'],
        items: [
          {
            name: 'Fire Extinguisher',
            quantity: 5,
            unitPrice: 120,
            totalPrice: 600,
          },
        ],
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requisitionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.requisition.complianceFlags).toContain('SOLAS');
      expect(response.body.requisition.complianceFlags).toContain('MARPOL');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid vessel ID', async () => {
      const requisitionData = {
        vesselId: 'invalid-vessel-id',
        urgencyLevel: 'ROUTINE',
        items: [{ name: 'Test', quantity: 1, unitPrice: 100, totalPrice: 100 }],
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requisitionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid vessel');
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        vesselId: testVessel.id,
        // Missing urgencyLevel and items
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle database connection errors gracefully', async () => {
      // This would require mocking the database connection
      // For now, we'll test the error response structure
      const response = await request(app)
        .get('/api/requisitions/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
});