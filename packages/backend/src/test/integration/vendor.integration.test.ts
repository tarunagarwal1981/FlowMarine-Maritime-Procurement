import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { prisma } from '@/config/database';
import { generateTestToken, createTestUser, createTestVessel, createTestVendor } from '../helpers/testHelpers';

describe('Vendor Integration Tests', () => {
  let authToken: string;
  let testUser: any;
  let testVessel: any;
  let testVendor: any;

  beforeAll(async () => {
    // Setup test database
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup test database
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create test user with appropriate permissions
    testUser = await createTestUser({
      role: 'PROCUREMENT_MANAGER',
      permissions: ['MANAGE_VENDORS', 'CREATE_RFQ', 'APPROVE_QUOTES'],
    });

    testVessel = await createTestVessel({
      name: 'MV Test Explorer',
      imoNumber: '1234567',
      vesselType: 'CONTAINER_SHIP',
    });

    testVendor = await createTestVendor({
      name: 'Test Marine Supplies',
      serviceAreas: ['EUROPE', 'NORTH_AMERICA'],
      portCapabilities: ['HAMBURG', 'ROTTERDAM', 'NEW_YORK'],
    });

    authToken = generateTestToken(testUser);
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.quote.deleteMany();
    await prisma.rFQ.deleteMany();
    await prisma.vendor.deleteMany();
    await prisma.vessel.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Vendor Management', () => {
    it('should create a new vendor with complete information', async () => {
      const vendorData = {
        name: 'New Marine Supplier',
        code: 'NMS001',
        contactInfo: {
          email: 'contact@newmarinesupplier.com',
          phone: '+49-40-123456',
          address: {
            street: '123 Harbor Street',
            city: 'Hamburg',
            country: 'Germany',
            postalCode: '20095',
          },
        },
        bankingDetails: {
          bankName: 'Deutsche Bank',
          accountNumber: '1234567890',
          routingNumber: 'DEUTDEFF',
          swiftCode: 'DEUTDEFFXXX',
        },
        serviceAreas: ['EUROPE', 'MEDITERRANEAN'],
        portCapabilities: [
          {
            portCode: 'DEHAM',
            portName: 'Hamburg',
            services: ['DELIVERY', 'CUSTOMS_CLEARANCE', 'WAREHOUSING'],
            coordinates: { latitude: 53.5511, longitude: 9.9937 },
          },
        ],
        paymentTerms: 'Net 30',
        creditLimit: 50000,
        certifications: ['ISO_9001', 'ISO_14001'],
        specializations: ['ENGINE_PARTS', 'DECK_EQUIPMENT'],
      };

      const response = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vendorData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(vendorData.name);
      expect(response.body.data.code).toBe(vendorData.code);
      expect(response.body.data.serviceAreas).toEqual(vendorData.serviceAreas);
      expect(response.body.data.bankingDetails.accountNumber).toBe('******7890'); // Should be masked
    });

    it('should update vendor performance ratings', async () => {
      const performanceUpdate = {
        qualityRating: 4.5,
        deliveryRating: 4.2,
        priceRating: 3.8,
        communicationRating: 4.0,
        notes: 'Excellent quality, slightly higher prices but reliable delivery',
      };

      const response = await request(app)
        .put(`/api/vendors/${testVendor.id}/performance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(performanceUpdate)
        .expect(200);

      expect(response.body.data.qualityRating).toBe(4.5);
      expect(response.body.data.overallScore).toBeGreaterThan(0);
    });

    it('should search vendors by capabilities and location', async () => {
      const searchCriteria = {
        serviceArea: 'EUROPE',
        portCapability: 'HAMBURG',
        specialization: 'ENGINE_PARTS',
        minRating: 3.0,
      };

      const response = await request(app)
        .get('/api/vendors/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query(searchCriteria)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('RFQ Management', () => {
    it('should create and send RFQ to qualified vendors', async () => {
      // First create a requisition
      const requisition = await prisma.requisition.create({
        data: {
          requisitionNumber: 'REQ-TEST-001',
          vesselId: testVessel.id,
          requestedById: testUser.id,
          urgencyLevel: 'ROUTINE',
          status: 'APPROVED',
          totalAmount: 5000,
          currency: 'USD',
          deliveryLocation: 'Hamburg',
          deliveryDate: new Date('2024-03-15'),
          items: {
            create: [
              {
                itemId: 'item-123',
                quantity: 10,
                unitPrice: 300,
                totalPrice: 3000,
                specifications: 'SAE 15W-40 Marine Engine Oil',
              },
              {
                itemId: 'item-124',
                quantity: 2,
                unitPrice: 1000,
                totalPrice: 2000,
                specifications: 'Heavy Duty Air Filter',
              },
            ],
          },
        },
      });

      const rfqData = {
        requisitionId: requisition.id,
        vendorIds: [testVendor.id],
        responseDeadline: new Date('2024-02-25'),
        deliveryRequirements: {
          location: 'Port of Hamburg',
          coordinates: { latitude: 53.5511, longitude: 9.9937 },
          contactPerson: 'Chief Engineer',
          specialInstructions: 'Deliver to berth 12, contact vessel 2 hours before arrival',
        },
        technicalSpecifications: {
          engineOil: {
            viscosity: 'SAE 15W-40',
            apiRating: 'CF-4',
            quantity: '10 x 20L drums',
          },
        },
      };

      const response = await request(app)
        .post('/api/rfqs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(rfqData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rfqNumber).toMatch(/^RFQ-\d{4}-\d{3}$/);
      expect(response.body.data.status).toBe('SENT');
      expect(response.body.data.vendorRFQs).toHaveLength(1);
    });

    it('should automatically select vendors based on criteria', async () => {
      const autoSelectionCriteria = {
        requisitionId: 'req-123',
        maxVendors: 5,
        criteria: {
          serviceArea: 'EUROPE',
          minRating: 3.5,
          specialization: 'ENGINE_PARTS',
          maxDistance: 500, // km from delivery location
        },
        deliveryLocation: { latitude: 53.5511, longitude: 9.9937 },
      };

      const response = await request(app)
        .post('/api/rfqs/auto-select-vendors')
        .set('Authorization', `Bearer ${authToken}`)
        .send(autoSelectionCriteria)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.selectedVendors).toBeDefined();
      expect(response.body.data.selectionReason).toBeDefined();
    });
  });

  describe('Quote Management', () => {
    let testRFQ: any;

    beforeEach(async () => {
      // Create a test RFQ
      testRFQ = await prisma.rFQ.create({
        data: {
          rfqNumber: 'RFQ-TEST-001',
          requisitionId: 'req-123',
          status: 'SENT',
          responseDeadline: new Date('2024-02-25'),
          vendorRFQs: {
            create: [
              {
                vendorId: testVendor.id,
                status: 'SENT',
                sentAt: new Date(),
              },
            ],
          },
        },
      });
    });

    it('should receive and process vendor quotes', async () => {
      const quoteData = {
        rfqId: testRFQ.id,
        vendorId: testVendor.id,
        totalAmount: 4800,
        currency: 'USD',
        validUntil: new Date('2024-03-10'),
        deliveryTime: 7, // days
        paymentTerms: 'Net 30',
        lineItems: [
          {
            itemDescription: 'Marine Engine Oil SAE 15W-40',
            quantity: 10,
            unitPrice: 280,
            totalPrice: 2800,
            deliveryTime: 5,
            specifications: 'API CF-4 certified, 20L drums',
          },
          {
            itemDescription: 'Heavy Duty Air Filter',
            quantity: 2,
            unitPrice: 1000,
            totalPrice: 2000,
            deliveryTime: 7,
            specifications: 'OEM equivalent, includes gaskets',
          },
        ],
        notes: 'Bulk discount applied. Free delivery to Hamburg port.',
        attachments: ['quote-details.pdf', 'technical-specs.pdf'],
      };

      const response = await request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(quoteData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalAmount).toBe(4800);
      expect(response.body.data.lineItems).toHaveLength(2);
      expect(response.body.data.status).toBe('RECEIVED');
    });

    it('should compare multiple quotes with scoring algorithm', async () => {
      // Create multiple quotes for comparison
      const quotes = await Promise.all([
        prisma.quote.create({
          data: {
            rfqId: testRFQ.id,
            vendorId: testVendor.id,
            totalAmount: 4800,
            currency: 'USD',
            deliveryTime: 7,
            status: 'RECEIVED',
          },
        }),
        prisma.quote.create({
          data: {
            rfqId: testRFQ.id,
            vendorId: testVendor.id,
            totalAmount: 5200,
            currency: 'USD',
            deliveryTime: 5,
            status: 'RECEIVED',
          },
        }),
      ]);

      const response = await request(app)
        .get(`/api/quotes/compare/${testRFQ.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comparison).toBeDefined();
      expect(response.body.data.recommendation).toBeDefined();
      expect(response.body.data.scoringBreakdown).toBeDefined();
    });

    it('should handle quote negotiations', async () => {
      const quote = await prisma.quote.create({
        data: {
          rfqId: testRFQ.id,
          vendorId: testVendor.id,
          totalAmount: 5500,
          currency: 'USD',
          deliveryTime: 10,
          status: 'RECEIVED',
        },
      });

      const negotiationRequest = {
        requestedAmount: 5000,
        requestedDeliveryTime: 7,
        justification: 'Budget constraints and urgent delivery required',
        counterOfferTerms: {
          paymentTerms: 'Net 15',
          additionalServices: ['Express delivery', 'Installation support'],
        },
      };

      const response = await request(app)
        .post(`/api/quotes/${quote.id}/negotiate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(negotiationRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('UNDER_NEGOTIATION');
      expect(response.body.data.negotiationHistory).toBeDefined();
    });
  });

  describe('Vendor Performance Tracking', () => {
    it('should track delivery performance', async () => {
      const deliveryData = {
        vendorId: testVendor.id,
        purchaseOrderId: 'po-123',
        scheduledDate: new Date('2024-02-15'),
        actualDate: new Date('2024-02-14'),
        deliveryQuality: 'EXCELLENT',
        onTimeDelivery: true,
        itemsCorrect: true,
        packagingQuality: 'GOOD',
        documentationComplete: true,
      };

      const response = await request(app)
        .post('/api/vendors/performance/delivery')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deliveryData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.performanceUpdate).toBeDefined();
    });

    it('should generate vendor performance reports', async () => {
      const reportCriteria = {
        vendorId: testVendor.id,
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-02-29'),
        },
        metrics: ['DELIVERY_TIME', 'QUALITY', 'PRICING', 'COMMUNICATION'],
      };

      const response = await request(app)
        .post('/api/vendors/performance/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportCriteria)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.performanceMetrics).toBeDefined();
      expect(response.body.data.trends).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
    });

    it('should identify underperforming vendors', async () => {
      const response = await request(app)
        .get('/api/vendors/performance/underperforming')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ threshold: 3.0, period: '6months' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Vendor Compliance and Certification', () => {
    it('should validate vendor certifications', async () => {
      const certificationData = {
        vendorId: testVendor.id,
        certifications: [
          {
            type: 'ISO_9001',
            issuer: 'TUV SUD',
            issueDate: new Date('2023-01-15'),
            expiryDate: new Date('2026-01-15'),
            certificateNumber: 'ISO9001-2023-001',
          },
          {
            type: 'MARITIME_SUPPLIER',
            issuer: 'Maritime Authority',
            issueDate: new Date('2023-06-01'),
            expiryDate: new Date('2024-06-01'),
            certificateNumber: 'MS-2023-456',
          },
        ],
      };

      const response = await request(app)
        .post(`/api/vendors/${testVendor.id}/certifications`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(certificationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.validCertifications).toBeDefined();
      expect(response.body.data.expiringCertifications).toBeDefined();
    });

    it('should check vendor compliance status', async () => {
      const response = await request(app)
        .get(`/api/vendors/${testVendor.id}/compliance`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.complianceStatus).toBeDefined();
      expect(response.body.data.requiredCertifications).toBeDefined();
      expect(response.body.data.complianceScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid vendor data gracefully', async () => {
      const invalidVendorData = {
        name: '', // Empty name
        contactInfo: {
          email: 'invalid-email', // Invalid email
        },
        serviceAreas: [], // Empty service areas
      };

      const response = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidVendorData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should handle RFQ to non-existent vendor', async () => {
      const rfqData = {
        requisitionId: 'req-123',
        vendorIds: ['non-existent-vendor-id'],
        responseDeadline: new Date('2024-02-25'),
      };

      const response = await request(app)
        .post('/api/rfqs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(rfqData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('vendor');
    });

    it('should handle quote submission after deadline', async () => {
      // Create RFQ with past deadline
      const pastRFQ = await prisma.rFQ.create({
        data: {
          rfqNumber: 'RFQ-PAST-001',
          requisitionId: 'req-123',
          status: 'SENT',
          responseDeadline: new Date('2024-01-01'), // Past date
          vendorRFQs: {
            create: [
              {
                vendorId: testVendor.id,
                status: 'SENT',
                sentAt: new Date('2024-01-01'),
              },
            ],
          },
        },
      });

      const lateQuoteData = {
        rfqId: pastRFQ.id,
        vendorId: testVendor.id,
        totalAmount: 5000,
        currency: 'USD',
      };

      const response = await request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(lateQuoteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('deadline');
    });
  });
});