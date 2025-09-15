import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken } from '@/utils/jwt';
import { hashPassword } from '@/utils/password';

describe('Requisition Integration Tests', () => {
  let prisma: PrismaClient;
  let testUser: any;
  let testVessel: any;
  let testItem: any;
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
    await prisma.requisitionItem.deleteMany();
    await prisma.requisition.deleteMany();
    await prisma.itemCatalog.deleteMany();
    await prisma.vesselAssignment.deleteMany();
    await prisma.vessel.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    const passwordHash = await hashPassword('TestPassword123!');
    testUser = await prisma.user.create({
      data: {
        email: 'crew@flowmarine.com',
        passwordHash,
        firstName: 'Test',
        lastName: 'Crew',
        role: 'CREW',
        emailVerified: true,
        isActive: true
      }
    });

    // Create test vessel
    testVessel = await prisma.vessel.create({
      data: {
        name: 'MV Test Vessel',
        imoNumber: 'IMO1234567',
        vesselType: 'CONTAINER',
        flag: 'PANAMA',
        engineType: 'DIESEL',
        cargoCapacity: 50000,
        fuelConsumption: 150,
        crewComplement: 25,
        currentLatitude: 51.5074,
        currentLongitude: -0.1278
      }
    });

    // Assign user to vessel
    await prisma.vesselAssignment.create({
      data: {
        userId: testUser.id,
        vesselId: testVessel.id,
        role: 'CREW',
        assignedAt: new Date()
      }
    });

    // Create test item
    testItem = await prisma.itemCatalog.create({
      data: {
        impaCode: '123456',
        issaCode: '12.34.56',
        name: 'Engine Oil Filter',
        description: 'High-performance engine oil filter',
        category: 'ENGINE_PARTS',
        criticalityLevel: 'OPERATIONAL_CRITICAL',
        unitOfMeasure: 'PIECE',
        averagePrice: 45.99,
        leadTime: 7,
        compatibleVesselTypes: ['CONTAINER', 'BULK_CARRIER'],
        compatibleEngineTypes: ['DIESEL']
      }
    });

    // Generate access token
    accessToken = generateAccessToken(testUser.id, [testVessel.id], testUser.role);
  });

  describe('POST /api/requisitions', () => {
    it('should create requisition successfully', async () => {
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Singapore',
        deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Scheduled maintenance requirement',
        items: [
          {
            itemId: testItem.id,
            quantity: 2,
            unitPrice: 45.99,
            justification: 'Replace worn filters during maintenance'
          }
        ]
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(requisitionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.requisition.vesselId).toBe(testVessel.id);
      expect(response.body.requisition.status).toBe('DRAFT');
      expect(response.body.requisition.items).toHaveLength(1);
      expect(response.body.requisition.totalAmount).toBe(91.98); // 2 * 45.99

      // Verify in database
      const createdRequisition = await prisma.requisition.findUnique({
        where: { id: response.body.requisition.id },
        include: { items: true }
      });
      expect(createdRequisition).toBeTruthy();
      expect(createdRequisition!.items).toHaveLength(1);
    });

    it('should validate vessel access', async () => {
      // Create another vessel not assigned to user
      const otherVessel = await prisma.vessel.create({
        data: {
          name: 'MV Other Vessel',
          imoNumber: 'IMO7654321',
          vesselType: 'TANKER',
          flag: 'LIBERIA',
          engineType: 'DIESEL',
          cargoCapacity: 75000,
          fuelConsumption: 200,
          crewComplement: 30
        }
      });

      const requisitionData = {
        vesselId: otherVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Rotterdam',
        deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Unauthorized vessel access attempt',
        items: [
          {
            itemId: testItem.id,
            quantity: 1,
            unitPrice: 45.99,
            justification: 'Test item'
          }
        ]
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(requisitionData)
        .expect(403);

      expect(response.body.error).toBe('Access denied to vessel');
    });

    it('should validate item compatibility', async () => {
      // Create incompatible item
      const incompatibleItem = await prisma.itemCatalog.create({
        data: {
          impaCode: '654321',
          name: 'Steam Engine Part',
          description: 'Part for steam engines only',
          category: 'ENGINE_PARTS',
          criticalityLevel: 'OPERATIONAL_CRITICAL',
          unitOfMeasure: 'PIECE',
          compatibleVesselTypes: ['PASSENGER'],
          compatibleEngineTypes: ['STEAM']
        }
      });

      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Hamburg',
        deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Testing compatibility validation',
        items: [
          {
            itemId: incompatibleItem.id,
            quantity: 1,
            unitPrice: 100.00,
            justification: 'Incompatible item test'
          }
        ]
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(requisitionData)
        .expect(400);

      expect(response.body.error).toContain('not compatible');
    });

    it('should handle emergency requisitions', async () => {
      const emergencyRequisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'EMERGENCY',
        deliveryLocation: 'Current Position',
        deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Critical engine failure - immediate replacement required',
        emergencyReason: 'Main engine bearing failure causing complete shutdown',
        items: [
          {
            itemId: testItem.id,
            quantity: 4,
            unitPrice: 45.99,
            justification: 'Emergency replacement of all engine filters'
          }
        ]
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(emergencyRequisitionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.requisition.urgencyLevel).toBe('EMERGENCY');
      expect(response.body.requisition.status).toBe('PENDING_APPROVAL');
      expect(response.body.emergencyProcessing).toBe(true);
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        vesselId: testVessel.id,
        // Missing urgencyLevel, deliveryLocation, items
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/requisitions', () => {
    let testRequisition: any;

    beforeEach(async () => {
      // Create test requisition
      testRequisition = await prisma.requisition.create({
        data: {
          requisitionNumber: 'REQ-2024-001',
          vesselId: testVessel.id,
          requestedById: testUser.id,
          urgencyLevel: 'ROUTINE',
          status: 'DRAFT',
          totalAmount: 91.98,
          currency: 'USD',
          deliveryLocation: 'Port of Singapore',
          deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          justification: 'Test requisition'
        }
      });

      await prisma.requisitionItem.create({
        data: {
          requisitionId: testRequisition.id,
          itemId: testItem.id,
          quantity: 2,
          unitPrice: 45.99,
          totalPrice: 91.98,
          justification: 'Test item'
        }
      });
    });

    it('should retrieve user requisitions', async () => {
      const response = await request(app)
        .get('/api/requisitions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.requisitions).toHaveLength(1);
      expect(response.body.requisitions[0].id).toBe(testRequisition.id);
      expect(response.body.requisitions[0].items).toHaveLength(1);
    });

    it('should filter by vessel', async () => {
      const response = await request(app)
        .get(`/api/requisitions?vesselId=${testVessel.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.requisitions).toHaveLength(1);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/requisitions?status=DRAFT')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.requisitions).toHaveLength(1);
    });

    it('should filter by urgency level', async () => {
      const response = await request(app)
        .get('/api/requisitions?urgencyLevel=ROUTINE')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.requisitions).toHaveLength(1);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/requisitions?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });
  });

  describe('PUT /api/requisitions/:id', () => {
    let testRequisition: any;

    beforeEach(async () => {
      testRequisition = await prisma.requisition.create({
        data: {
          requisitionNumber: 'REQ-2024-002',
          vesselId: testVessel.id,
          requestedById: testUser.id,
          urgencyLevel: 'ROUTINE',
          status: 'DRAFT',
          totalAmount: 45.99,
          currency: 'USD',
          deliveryLocation: 'Port of Singapore',
          deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          justification: 'Test requisition for update'
        }
      });
    });

    it('should update requisition successfully', async () => {
      const updateData = {
        urgencyLevel: 'URGENT',
        deliveryLocation: 'Port of Rotterdam',
        justification: 'Updated delivery location due to route change'
      };

      const response = await request(app)
        .put(`/api/requisitions/${testRequisition.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.requisition.urgencyLevel).toBe('URGENT');
      expect(response.body.requisition.deliveryLocation).toBe('Port of Rotterdam');

      // Verify in database
      const updatedRequisition = await prisma.requisition.findUnique({
        where: { id: testRequisition.id }
      });
      expect(updatedRequisition!.urgencyLevel).toBe('URGENT');
    });

    it('should prevent updates to submitted requisitions', async () => {
      // Update requisition status to submitted
      await prisma.requisition.update({
        where: { id: testRequisition.id },
        data: { status: 'PENDING_APPROVAL' }
      });

      const updateData = {
        urgencyLevel: 'EMERGENCY'
      };

      const response = await request(app)
        .put(`/api/requisitions/${testRequisition.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error).toContain('cannot be modified');
    });

    it('should validate ownership', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@flowmarine.com',
          passwordHash: await hashPassword('OtherPassword123!'),
          firstName: 'Other',
          lastName: 'User',
          role: 'CREW',
          emailVerified: true,
          isActive: true
        }
      });

      const otherToken = generateAccessToken(otherUser.id, [testVessel.id], 'CREW');

      const updateData = {
        urgencyLevel: 'URGENT'
      };

      const response = await request(app)
        .put(`/api/requisitions/${testRequisition.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error).toContain('not authorized');
    });
  });

  describe('POST /api/requisitions/:id/submit', () => {
    let testRequisition: any;

    beforeEach(async () => {
      testRequisition = await prisma.requisition.create({
        data: {
          requisitionNumber: 'REQ-2024-003',
          vesselId: testVessel.id,
          requestedById: testUser.id,
          urgencyLevel: 'ROUTINE',
          status: 'DRAFT',
          totalAmount: 91.98,
          currency: 'USD',
          deliveryLocation: 'Port of Singapore',
          deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          justification: 'Test requisition for submission'
        }
      });

      await prisma.requisitionItem.create({
        data: {
          requisitionId: testRequisition.id,
          itemId: testItem.id,
          quantity: 2,
          unitPrice: 45.99,
          totalPrice: 91.98,
          justification: 'Test item'
        }
      });
    });

    it('should submit requisition for approval', async () => {
      const response = await request(app)
        .post(`/api/requisitions/${testRequisition.id}/submit`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.requisition.status).toBe('PENDING_APPROVAL');
      expect(response.body.workflowInitiated).toBe(true);

      // Verify status change in database
      const submittedRequisition = await prisma.requisition.findUnique({
        where: { id: testRequisition.id }
      });
      expect(submittedRequisition!.status).toBe('PENDING_APPROVAL');
    });

    it('should validate requisition completeness before submission', async () => {
      // Create incomplete requisition (no items)
      const incompleteRequisition = await prisma.requisition.create({
        data: {
          requisitionNumber: 'REQ-2024-004',
          vesselId: testVessel.id,
          requestedById: testUser.id,
          urgencyLevel: 'ROUTINE',
          status: 'DRAFT',
          totalAmount: 0,
          currency: 'USD',
          deliveryLocation: 'Port of Singapore',
          deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          justification: 'Incomplete requisition'
        }
      });

      const response = await request(app)
        .post(`/api/requisitions/${incompleteRequisition.id}/submit`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.error).toContain('no items');
    });

    it('should prevent duplicate submission', async () => {
      // Submit once
      await request(app)
        .post(`/api/requisitions/${testRequisition.id}/submit`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to submit again
      const response = await request(app)
        .post(`/api/requisitions/${testRequisition.id}/submit`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.error).toContain('already submitted');
    });
  });

  describe('Maritime-Specific Features', () => {
    it('should handle offline requisition sync', async () => {
      const offlineRequisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Singapore',
        deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Created offline during voyage',
        offlineCreatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            itemId: testItem.id,
            quantity: 1,
            unitPrice: 45.99,
            justification: 'Offline requisition item'
          }
        ]
      };

      const response = await request(app)
        .post('/api/requisitions/sync-offline')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(offlineRequisitionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.requisition.offlineSync).toBe(true);
    });

    it('should validate vessel position for delivery coordination', async () => {
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'URGENT',
        deliveryLocation: 'Current Position',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Delivery to vessel at sea',
        currentPosition: {
          latitude: 51.5074,
          longitude: -0.1278
        },
        items: [
          {
            itemId: testItem.id,
            quantity: 1,
            unitPrice: 45.99,
            justification: 'Sea delivery item'
          }
        ]
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(requisitionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.requisition.deliveryCoordination).toBeDefined();
    });
  });
});