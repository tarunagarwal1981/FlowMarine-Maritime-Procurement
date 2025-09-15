import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { prisma } from '@/config/database';
import { generateTestToken, createTestUser, createTestVessel, createTestVendor } from '../helpers/testHelpers';

describe('Purchase Order Integration Tests', () => {
  let authToken: string;
  let testUser: any;
  let testVessel: any;
  let testVendor: any;
  let testQuote: any;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    testUser = await createTestUser({
      role: 'PROCUREMENT_MANAGER',
      permissions: ['CREATE_PURCHASE_ORDER', 'APPROVE_PURCHASE_ORDER', 'MANAGE_DELIVERIES'],
    });

    testVessel = await createTestVessel({
      name: 'MV Test Explorer',
      imoNumber: '1234567',
      currentPosition: { latitude: 53.5511, longitude: 9.9937 },
    });

    testVendor = await createTestVendor({
      name: 'Test Marine Supplies',
      paymentTerms: 'Net 30',
      creditLimit: 100000,
    });

    // Create a test quote for PO generation
    testQuote = await prisma.quote.create({
      data: {
        rfqId: 'rfq-123',
        vendorId: testVendor.id,
        totalAmount: 5000,
        currency: 'USD',
        validUntil: new Date('2024-03-15'),
        deliveryTime: 7,
        status: 'APPROVED',
        lineItems: {
          create: [
            {
              itemDescription: 'Marine Engine Oil',
              quantity: 10,
              unitPrice: 300,
              totalPrice: 3000,
              specifications: 'SAE 15W-40',
            },
            {
              itemDescription: 'Air Filter',
              quantity: 2,
              unitPrice: 1000,
              totalPrice: 2000,
              specifications: 'Heavy duty',
            },
          ],
        },
      },
    });

    authToken = generateTestToken(testUser);
  });

  afterEach(async () => {
    await prisma.delivery.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.quote.deleteMany();
    await prisma.vendor.deleteMany();
    await prisma.vessel.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Purchase Order Creation', () => {
    it('should create PO from approved quote automatically', async () => {
      const poData = {
        quoteId: testQuote.id,
        vesselId: testVessel.id,
        deliveryInstructions: {
          location: 'Port of Hamburg',
          coordinates: { latitude: 53.5511, longitude: 9.9937 },
          contactPerson: 'Chief Engineer John Smith',
          contactPhone: '+49-40-123456',
          specialInstructions: 'Deliver to berth 12, contact vessel 2 hours before arrival',
        },
        paymentTerms: 'Net 30',
        incoterms: 'DDP',
        requestedDeliveryDate: new Date('2024-02-20'),
      };

      const response = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(poData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.poNumber).toMatch(/^PO-\d{4}-\d{3}$/);
      expect(response.body.data.status).toBe('PENDING_APPROVAL');
      expect(response.body.data.totalAmount).toBe(5000);
      expect(response.body.data.currency).toBe('USD');
      expect(response.body.data.vesselId).toBe(testVessel.id);
      expect(response.body.data.vendorId).toBe(testVendor.id);
    });

    it('should include maritime-specific terms and conditions', async () => {
      const poData = {
        quoteId: testQuote.id,
        vesselId: testVessel.id,
        maritimeTerms: {
          portOfDelivery: 'DEHAM',
          vesselETA: new Date('2024-02-18'),
          laycanStart: new Date('2024-02-17'),
          laycanEnd: new Date('2024-02-21'),
          demurrageRate: 5000, // USD per day
          despatchRate: 2500, // USD per day
        },
        customsRequirements: {
          hsCode: '2710.19.99',
          countryOfOrigin: 'Germany',
          certificatesRequired: ['CERTIFICATE_OF_ORIGIN', 'QUALITY_CERTIFICATE'],
        },
      };

      const response = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(poData)
        .expect(201);

      expect(response.body.data.maritimeTerms).toBeDefined();
      expect(response.body.data.customsRequirements).toBeDefined();
      expect(response.body.data.maritimeTerms.portOfDelivery).toBe('DEHAM');
    });

    it('should validate vessel position and delivery feasibility', async () => {
      const poData = {
        quoteId: testQuote.id,
        vesselId: testVessel.id,
        deliveryInstructions: {
          location: 'Port of Singapore', // Far from vessel position
          coordinates: { latitude: 1.2966, longitude: 103.7764 },
        },
        requestedDeliveryDate: new Date('2024-02-16'), // Very soon
      };

      const response = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(poData)
        .expect(201);

      expect(response.body.data.deliveryWarnings).toBeDefined();
      expect(response.body.data.deliveryWarnings).toContain('LONG_DISTANCE_DELIVERY');
      expect(response.body.data.estimatedDeliveryTime).toBeGreaterThan(7);
    });
  });

  describe('Purchase Order Approval Workflow', () => {
    let testPO: any;

    beforeEach(async () => {
      testPO = await prisma.purchaseOrder.create({
        data: {
          poNumber: 'PO-TEST-001',
          quoteId: testQuote.id,
          vesselId: testVessel.id,
          vendorId: testVendor.id,
          totalAmount: 25000, // High value requiring approval
          currency: 'USD',
          status: 'PENDING_APPROVAL',
          paymentTerms: 'Net 30',
          requestedDeliveryDate: new Date('2024-02-20'),
        },
      });
    });

    it('should require approval for high-value purchase orders', async () => {
      const approvalData = {
        approved: true,
        approverComments: 'Approved - critical engine parts needed urgently',
        budgetCode: 'VESSEL-MAINT-2024',
      };

      const response = await request(app)
        .post(`/api/purchase-orders/${testPO.id}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(approvalData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('APPROVED');
      expect(response.body.data.approvals).toBeDefined();
    });

    it('should handle rejection with reason', async () => {
      const rejectionData = {
        approved: false,
        approverComments: 'Budget exceeded for this quarter',
        rejectionReason: 'BUDGET_EXCEEDED',
        suggestedActions: ['Defer to next quarter', 'Reduce order quantity'],
      };

      const response = await request(app)
        .post(`/api/purchase-orders/${testPO.id}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(rejectionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('REJECTED');
      expect(response.body.data.rejectionReason).toBe('BUDGET_EXCEEDED');
    });

    it('should auto-approve low-value orders', async () => {
      const lowValuePO = await prisma.purchaseOrder.create({
        data: {
          poNumber: 'PO-LOW-001',
          quoteId: testQuote.id,
          vesselId: testVessel.id,
          vendorId: testVendor.id,
          totalAmount: 500, // Low value
          currency: 'USD',
          status: 'PENDING_APPROVAL',
          paymentTerms: 'Net 30',
        },
      });

      const response = await request(app)
        .post(`/api/purchase-orders/${lowValuePO.id}/auto-approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('APPROVED');
      expect(response.body.data.autoApproved).toBe(true);
    });
  });

  describe('Delivery Management', () => {
    let approvedPO: any;

    beforeEach(async () => {
      approvedPO = await prisma.purchaseOrder.create({
        data: {
          poNumber: 'PO-APPROVED-001',
          quoteId: testQuote.id,
          vesselId: testVessel.id,
          vendorId: testVendor.id,
          totalAmount: 5000,
          currency: 'USD',
          status: 'APPROVED',
          paymentTerms: 'Net 30',
          requestedDeliveryDate: new Date('2024-02-20'),
        },
      });
    });

    it('should create delivery schedule from approved PO', async () => {
      const deliveryData = {
        purchaseOrderId: approvedPO.id,
        scheduledDate: new Date('2024-02-18'),
        deliveryLocation: 'Port of Hamburg',
        coordinates: { latitude: 53.5511, longitude: 9.9937 },
        contactPerson: 'Chief Engineer',
        contactPhone: '+49-40-123456',
        specialInstructions: 'Call vessel 2 hours before arrival',
      };

      const response = await request(app)
        .post('/api/deliveries')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deliveryData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('SCHEDULED');
      expect(response.body.data.trackingNumber).toBeDefined();
      expect(response.body.data.estimatedArrival).toBeDefined();
    });

    it('should track delivery status updates', async () => {
      const delivery = await prisma.delivery.create({
        data: {
          purchaseOrderId: approvedPO.id,
          vesselId: testVessel.id,
          scheduledDate: new Date('2024-02-18'),
          status: 'SCHEDULED',
          trackingNumber: 'TRK-123456',
        },
      });

      const statusUpdates = [
        { status: 'DISPATCHED', timestamp: new Date('2024-02-16T08:00:00Z') },
        { status: 'IN_TRANSIT', timestamp: new Date('2024-02-17T10:00:00Z') },
        { status: 'ARRIVED_AT_PORT', timestamp: new Date('2024-02-18T14:00:00Z') },
      ];

      for (const update of statusUpdates) {
        const response = await request(app)
          .put(`/api/deliveries/${delivery.id}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(update)
          .expect(200);

        expect(response.body.data.status).toBe(update.status);
      }
    });

    it('should handle delivery confirmation with photo documentation', async () => {
      const delivery = await prisma.delivery.create({
        data: {
          purchaseOrderId: approvedPO.id,
          vesselId: testVessel.id,
          scheduledDate: new Date('2024-02-18'),
          status: 'ARRIVED_AT_PORT',
          trackingNumber: 'TRK-123456',
        },
      });

      const confirmationData = {
        confirmedBy: testUser.id,
        confirmationDate: new Date(),
        receivedItems: [
          {
            itemDescription: 'Marine Engine Oil',
            quantityOrdered: 10,
            quantityReceived: 10,
            condition: 'GOOD',
            notes: 'All drums intact, proper labeling',
          },
          {
            itemDescription: 'Air Filter',
            quantityOrdered: 2,
            quantityReceived: 2,
            condition: 'GOOD',
            notes: 'Original packaging, includes gaskets',
          },
        ],
        photoUrls: [
          'https://storage.example.com/delivery-photos/photo1.jpg',
          'https://storage.example.com/delivery-photos/photo2.jpg',
        ],
        deliveryNotes: 'All items received in good condition. Delivery completed on time.',
        signatureUrl: 'https://storage.example.com/signatures/signature1.png',
      };

      const response = await request(app)
        .post(`/api/deliveries/${delivery.id}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(confirmationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('DELIVERED');
      expect(response.body.data.deliveryConfirmation).toBeDefined();
      expect(response.body.data.deliveryConfirmation.photoUrls).toHaveLength(2);
    });

    it('should handle partial deliveries', async () => {
      const delivery = await prisma.delivery.create({
        data: {
          purchaseOrderId: approvedPO.id,
          vesselId: testVessel.id,
          scheduledDate: new Date('2024-02-18'),
          status: 'ARRIVED_AT_PORT',
          trackingNumber: 'TRK-123456',
        },
      });

      const partialConfirmation = {
        confirmedBy: testUser.id,
        confirmationDate: new Date(),
        receivedItems: [
          {
            itemDescription: 'Marine Engine Oil',
            quantityOrdered: 10,
            quantityReceived: 8, // Partial delivery
            condition: 'GOOD',
            notes: '2 drums damaged in transit, not accepted',
          },
          {
            itemDescription: 'Air Filter',
            quantityOrdered: 2,
            quantityReceived: 2,
            condition: 'GOOD',
            notes: 'Complete delivery',
          },
        ],
        partialDelivery: true,
        remainingItems: [
          {
            itemDescription: 'Marine Engine Oil',
            quantityRemaining: 2,
            expectedDeliveryDate: new Date('2024-02-25'),
          },
        ],
      };

      const response = await request(app)
        .post(`/api/deliveries/${delivery.id}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(partialConfirmation)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PARTIALLY_DELIVERED');
      expect(response.body.data.remainingDeliveries).toBeDefined();
    });
  });

  describe('Purchase Order Modifications', () => {
    let testPO: any;

    beforeEach(async () => {
      testPO = await prisma.purchaseOrder.create({
        data: {
          poNumber: 'PO-MODIFY-001',
          quoteId: testQuote.id,
          vesselId: testVessel.id,
          vendorId: testVendor.id,
          totalAmount: 5000,
          currency: 'USD',
          status: 'APPROVED',
          paymentTerms: 'Net 30',
        },
      });
    });

    it('should handle quantity changes with price recalculation', async () => {
      const modification = {
        type: 'QUANTITY_CHANGE',
        changes: [
          {
            lineItemId: 'item-1',
            originalQuantity: 10,
            newQuantity: 12,
            reason: 'Additional requirement identified',
          },
        ],
        requestedBy: testUser.id,
        justification: 'Vessel inspection revealed need for additional oil reserves',
      };

      const response = await request(app)
        .post(`/api/purchase-orders/${testPO.id}/modify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(modification)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PENDING_MODIFICATION_APPROVAL');
      expect(response.body.data.modifications).toBeDefined();
    });

    it('should handle delivery date changes', async () => {
      const modification = {
        type: 'DELIVERY_DATE_CHANGE',
        originalDeliveryDate: new Date('2024-02-20'),
        newDeliveryDate: new Date('2024-02-25'),
        reason: 'Vessel schedule change',
        urgencyLevel: 'ROUTINE',
      };

      const response = await request(app)
        .post(`/api/purchase-orders/${testPO.id}/modify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(modification)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requestedDeliveryDate).toEqual(
        modification.newDeliveryDate.toISOString()
      );
    });

    it('should handle emergency modifications', async () => {
      const emergencyModification = {
        type: 'EMERGENCY_CHANGE',
        urgencyLevel: 'EMERGENCY',
        changes: [
          {
            type: 'ADD_ITEM',
            itemDescription: 'Emergency Repair Kit',
            quantity: 1,
            estimatedPrice: 2000,
            reason: 'Critical equipment failure',
          },
        ],
        authorizedBy: testUser.id,
        emergencyJustification: 'Main engine bearing failure requires immediate repair',
        vesselPosition: { latitude: 53.5511, longitude: 9.9937 },
      };

      const response = await request(app)
        .post(`/api/purchase-orders/${testPO.id}/emergency-modify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(emergencyModification)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('EMERGENCY_MODIFIED');
      expect(response.body.data.requiresPostApproval).toBe(true);
    });
  });

  describe('Purchase Order Reporting and Analytics', () => {
    beforeEach(async () => {
      // Create multiple POs for reporting
      await Promise.all([
        prisma.purchaseOrder.create({
          data: {
            poNumber: 'PO-RPT-001',
            quoteId: testQuote.id,
            vesselId: testVessel.id,
            vendorId: testVendor.id,
            totalAmount: 3000,
            currency: 'USD',
            status: 'DELIVERED',
            createdAt: new Date('2024-01-15'),
          },
        }),
        prisma.purchaseOrder.create({
          data: {
            poNumber: 'PO-RPT-002',
            quoteId: testQuote.id,
            vesselId: testVessel.id,
            vendorId: testVendor.id,
            totalAmount: 7500,
            currency: 'USD',
            status: 'APPROVED',
            createdAt: new Date('2024-02-01'),
          },
        }),
      ]);
    });

    it('should generate purchase order summary report', async () => {
      const reportCriteria = {
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-02-29'),
        },
        vesselId: testVessel.id,
        groupBy: 'VENDOR',
      };

      const response = await request(app)
        .post('/api/purchase-orders/reports/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportCriteria)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalOrders).toBeGreaterThan(0);
      expect(response.body.data.totalValue).toBeGreaterThan(0);
      expect(response.body.data.byVendor).toBeDefined();
    });

    it('should analyze delivery performance', async () => {
      const response = await request(app)
        .get('/api/purchase-orders/analytics/delivery-performance')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ vesselId: testVessel.id, period: '3months' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.onTimeDeliveryRate).toBeDefined();
      expect(response.body.data.averageDeliveryTime).toBeDefined();
      expect(response.body.data.trends).toBeDefined();
    });

    it('should identify cost optimization opportunities', async () => {
      const response = await request(app)
        .get('/api/purchase-orders/analytics/cost-optimization')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ vesselId: testVessel.id })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations).toBeDefined();
      expect(response.body.data.potentialSavings).toBeDefined();
      expect(response.body.data.spendingPatterns).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle PO creation with insufficient vendor credit limit', async () => {
      // Create vendor with low credit limit
      const lowCreditVendor = await createTestVendor({
        name: 'Low Credit Vendor',
        creditLimit: 1000, // Lower than PO amount
      });

      const poData = {
        quoteId: testQuote.id,
        vesselId: testVessel.id,
        vendorId: lowCreditVendor.id,
        totalAmount: 5000, // Exceeds credit limit
      };

      const response = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(poData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('credit limit');
    });

    it('should handle delivery to vessel in restricted waters', async () => {
      const restrictedVessel = await createTestVessel({
        name: 'MV Restricted',
        currentPosition: { latitude: 0, longitude: 0 }, // Restricted area
      });

      const deliveryData = {
        purchaseOrderId: 'po-123',
        vesselId: restrictedVessel.id,
        deliveryLocation: 'Restricted Waters',
      };

      const response = await request(app)
        .post('/api/deliveries')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deliveryData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('restricted');
    });

    it('should handle currency conversion errors', async () => {
      const multiCurrencyPO = {
        quoteId: testQuote.id,
        vesselId: testVessel.id,
        totalAmount: 5000,
        currency: 'INVALID_CURRENCY',
      };

      const response = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(multiCurrencyPO)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('currency');
    });
  });
});