import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken } from '@/utils/jwt';

const prisma = new PrismaClient();

describe('End-to-End User Workflows', () => {
  let testVessel: any;
  let crewMember: any;
  let chiefEngineer: any;
  let captain: any;
  let superintendent: any;
  let procurementManager: any;
  let vendor: any;
  let crewToken: string;
  let chiefToken: string;
  let captainToken: string;
  let superintendentToken: string;
  let procurementToken: string;

  beforeAll(async () => {
    // Create comprehensive test environment
    testVessel = await prisma.vessel.create({
      data: {
        name: 'MV E2E Test Ship',
        imoNumber: 'IMO1111111',
        vesselType: 'Container Ship',
        flag: 'Singapore',
        engineType: 'MAN B&W',
        cargoCapacity: 15000,
        fuelConsumption: 250,
        crewComplement: 20,
        currentLatitude: 1.2966,
        currentLongitude: 103.7764,
        currentDeparture: 'Port of Singapore',
        currentDestination: 'Port of Hamburg',
        currentETA: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
      },
    });

    // Create users with different roles
    crewMember = await prisma.user.create({
      data: {
        email: 'crew@e2etest.com',
        passwordHash: '$2a$12$hashedpassword',
        firstName: 'John',
        lastName: 'Crew',
        role: 'CREW',
        isActive: true,
        emailVerified: true,
      },
    });

    chiefEngineer = await prisma.user.create({
      data: {
        email: 'chief@e2etest.com',
        passwordHash: '$2a$12$hashedpassword',
        firstName: 'Maria',
        lastName: 'Chief',
        role: 'CHIEF_ENGINEER',
        isActive: true,
        emailVerified: true,
      },
    });

    captain = await prisma.user.create({
      data: {
        email: 'captain@e2etest.com',
        passwordHash: '$2a$12$hashedpassword',
        firstName: 'James',
        lastName: 'Captain',
        role: 'CAPTAIN',
        isActive: true,
        emailVerified: true,
      },
    });

    superintendent = await prisma.user.create({
      data: {
        email: 'superintendent@e2etest.com',
        passwordHash: '$2a$12$hashedpassword',
        firstName: 'Sarah',
        lastName: 'Superintendent',
        role: 'SUPERINTENDENT',
        isActive: true,
        emailVerified: true,
      },
    });

    procurementManager = await prisma.user.create({
      data: {
        email: 'procurement@e2etest.com',
        passwordHash: '$2a$12$hashedpassword',
        firstName: 'David',
        lastName: 'Procurement',
        role: 'PROCUREMENT_MANAGER',
        isActive: true,
        emailVerified: true,
      },
    });

    // Create vessel assignments
    await prisma.vesselAssignment.createMany({
      data: [
        { userId: crewMember.id, vesselId: testVessel.id, role: 'CREW' },
        { userId: chiefEngineer.id, vesselId: testVessel.id, role: 'CHIEF_ENGINEER' },
        { userId: captain.id, vesselId: testVessel.id, role: 'CAPTAIN' },
        { userId: superintendent.id, vesselId: testVessel.id, role: 'SUPERINTENDENT' },
      ],
    });

    // Create vendor
    vendor = await prisma.vendor.create({
      data: {
        name: 'E2E Test Marine Supplies',
        code: 'E2E-VENDOR-001',
        email: 'sales@e2evendor.com',
        phone: '+65-1234-5678',
        address: '123 Marine Drive, Singapore',
        paymentTerms: 'NET 30',
        creditLimit: 100000,
        qualityRating: 4.5,
        deliveryRating: 4.2,
        priceRating: 4.0,
        overallScore: 4.2,
        isActive: true,
      },
    });

    // Create catalog items
    await prisma.itemCatalog.createMany({
      data: [
        {
          impaCode: '613.11.01',
          name: 'Engine Oil SAE 40',
          description: 'Marine engine lubricating oil',
          category: 'ENGINE_PARTS',
          criticalityLevel: 'OPERATIONAL_CRITICAL',
          unitOfMeasure: 'LITER',
          averagePrice: 15.50,
          leadTime: 5,
        },
        {
          impaCode: '593.21.01',
          name: 'Life Jacket Adult',
          description: 'SOLAS approved life jacket',
          category: 'SAFETY_EQUIPMENT',
          criticalityLevel: 'SAFETY_CRITICAL',
          unitOfMeasure: 'PIECE',
          averagePrice: 85.00,
          leadTime: 3,
        },
      ],
    });

    // Generate tokens
    crewToken = generateAccessToken(crewMember.id);
    chiefToken = generateAccessToken(chiefEngineer.id);
    captainToken = generateAccessToken(captain.id);
    superintendentToken = generateAccessToken(superintendent.id);
    procurementToken = generateAccessToken(procurementManager.id);
  });

  afterAll(async () => {
    // Comprehensive cleanup
    await prisma.vesselAssignment.deleteMany({
      where: { vesselId: testVessel.id },
    });
    await prisma.itemCatalog.deleteMany({
      where: { impaCode: { in: ['613.11.01', '593.21.01'] } },
    });
    await prisma.vendor.delete({ where: { id: vendor.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [crewMember.id, chiefEngineer.id, captain.id, superintendent.id, procurementManager.id] } },
    });
    await prisma.vessel.delete({ where: { id: testVessel.id } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.requisition.deleteMany({
      where: { vesselId: testVessel.id },
    });
  });

  describe('Complete Procurement Workflow - Routine Purchase', () => {
    it('should complete full procurement cycle for routine items', async () => {
      // Step 1: Crew member creates requisition
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Hamburg',
        deliveryDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Routine engine maintenance supplies',
        items: [
          {
            impaCode: '613.11.01',
            name: 'Engine Oil SAE 40',
            quantity: 200,
            unitPrice: 15.50,
            totalPrice: 3100,
            urgencyLevel: 'ROUTINE',
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${crewToken}`)
        .send(requisitionData)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;
      expect(createResponse.body.requisition.status).toBe('DRAFT');

      // Step 2: Crew member submits requisition for approval
      const submitResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      expect(submitResponse.body.requisition.status).toBe('PENDING_APPROVAL');
      expect(submitResponse.body.approvalLevel).toBe('SUPERINTENDENT');

      // Step 3: Superintendent approves requisition
      const approveResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .send({
          comments: 'Approved for routine maintenance',
          budgetCode: 'MAINT-2024-Q1',
        })
        .expect(200);

      expect(approveResponse.body.requisition.status).toBe('APPROVED');

      // Step 4: System generates RFQ automatically
      const rfqResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/generate-rfq`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .expect(200);

      const rfqId = rfqResponse.body.rfq.id;
      expect(rfqResponse.body.vendorsNotified).toBeGreaterThan(0);

      // Step 5: Vendor submits quote
      const quoteData = {
        rfqId: rfqId,
        vendorId: vendor.id,
        totalAmount: 2950, // Competitive price
        currency: 'USD',
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        terms: 'FOB Hamburg, NET 30',
        lineItems: [
          {
            itemId: requisitionData.items[0].impaCode,
            quantity: 200,
            unitPrice: 14.75,
            totalPrice: 2950,
          },
        ],
      };

      const quoteResponse = await request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${procurementToken}`)
        .send(quoteData)
        .expect(201);

      const quoteId = quoteResponse.body.quote.id;

      // Step 6: Procurement manager selects winning quote
      const selectQuoteResponse = await request(app)
        .post(`/api/quotes/${quoteId}/select`)
        .set('Authorization', `Bearer ${procurementToken}`)
        .send({
          selectionReason: 'Best price and delivery terms',
        })
        .expect(200);

      expect(selectQuoteResponse.body.success).toBe(true);

      // Step 7: System generates purchase order
      const poResponse = await request(app)
        .post(`/api/purchase-orders/generate`)
        .set('Authorization', `Bearer ${procurementToken}`)
        .send({
          quoteId: quoteId,
          deliveryInstructions: 'Deliver to vessel at Berth 15, Port of Hamburg',
        })
        .expect(201);

      const purchaseOrderId = poResponse.body.purchaseOrder.id;
      expect(poResponse.body.purchaseOrder.status).toBe('ISSUED');

      // Step 8: Vendor confirms delivery
      const deliveryResponse = await request(app)
        .post(`/api/purchase-orders/${purchaseOrderId}/delivery-confirmation`)
        .set('Authorization', `Bearer ${procurementToken}`)
        .send({
          deliveryDate: new Date().toISOString(),
          deliveredQuantity: 200,
          deliveryNotes: 'Delivered to vessel as requested',
          receivedBy: chiefEngineer.id,
        })
        .expect(200);

      expect(deliveryResponse.body.success).toBe(true);

      // Step 9: Chief Engineer confirms receipt
      const receiptResponse = await request(app)
        .post(`/api/purchase-orders/${purchaseOrderId}/receipt-confirmation`)
        .set('Authorization', `Bearer ${chiefToken}`)
        .send({
          receivedQuantity: 200,
          condition: 'GOOD',
          notes: 'All items received in good condition',
        })
        .expect(200);

      expect(receiptResponse.body.success).toBe(true);

      // Step 10: Vendor submits invoice
      const invoiceResponse = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${procurementToken}`)
        .send({
          purchaseOrderId: purchaseOrderId,
          invoiceNumber: 'INV-E2E-001',
          invoiceDate: new Date().toISOString(),
          totalAmount: 2950,
          currency: 'USD',
          lineItems: [
            {
              description: 'Engine Oil SAE 40',
              quantity: 200,
              unitPrice: 14.75,
              totalPrice: 2950,
            },
          ],
        })
        .expect(201);

      const invoiceId = invoiceResponse.body.invoice.id;

      // Step 11: System performs three-way matching
      const matchingResponse = await request(app)
        .post(`/api/invoices/${invoiceId}/three-way-match`)
        .set('Authorization', `Bearer ${procurementToken}`)
        .expect(200);

      expect(matchingResponse.body.success).toBe(true);
      expect(matchingResponse.body.matching.poMatch).toBe(true);
      expect(matchingResponse.body.matching.receiptMatch).toBe(true);
      expect(matchingResponse.body.matching.priceVariance).toBeLessThan(0.02); // Within 2%

      // Step 12: Invoice approved for payment
      const paymentApprovalResponse = await request(app)
        .post(`/api/invoices/${invoiceId}/approve-payment`)
        .set('Authorization', `Bearer ${procurementToken}`)
        .expect(200);

      expect(paymentApprovalResponse.body.success).toBe(true);
      expect(paymentApprovalResponse.body.invoice.status).toBe('APPROVED_FOR_PAYMENT');

      // Verify complete audit trail
      const auditResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}/audit-trail`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .expect(200);

      expect(auditResponse.body.auditTrail.length).toBeGreaterThan(5);
      expect(auditResponse.body.auditTrail.some((entry: any) => entry.action === 'CREATED')).toBe(true);
      expect(auditResponse.body.auditTrail.some((entry: any) => entry.action === 'APPROVED')).toBe(true);
      expect(auditResponse.body.auditTrail.some((entry: any) => entry.action === 'DELIVERED')).toBe(true);
    });
  });

  describe('Emergency Procurement Workflow', () => {
    it('should handle emergency procurement with captain override', async () => {
      // Step 1: Chief Engineer creates emergency requisition
      const emergencyRequisition = {
        vesselId: testVessel.id,
        urgencyLevel: 'EMERGENCY',
        deliveryLocation: 'Current Position - Emergency',
        deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Main engine bearing failure - immediate replacement required',
        items: [
          {
            name: 'Main Engine Bearing Set',
            description: 'Emergency replacement for MAN B&W engine',
            quantity: 1,
            unitPrice: 15000,
            totalPrice: 15000,
            urgencyLevel: 'EMERGENCY',
            criticalityLevel: 'SAFETY_CRITICAL',
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${chiefToken}`)
        .send(emergencyRequisition)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Step 2: Captain performs emergency override
      const overrideResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/emergency-override`)
        .set('Authorization', `Bearer ${captainToken}`)
        .send({
          reason: 'Engine failure poses immediate safety risk. Vessel unable to maintain course.',
          safetyJustification: 'SOLAS Chapter V compliance - safe navigation',
          requiresPostApproval: true,
        })
        .expect(200);

      expect(overrideResponse.body.success).toBe(true);
      expect(overrideResponse.body.requisition.status).toBe('APPROVED');
      expect(overrideResponse.body.emergencyOverride).toBe(true);

      // Step 3: System immediately generates emergency RFQ
      const emergencyRfqResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}/rfqs`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      expect(emergencyRfqResponse.body.rfqs.length).toBeGreaterThan(0);
      expect(emergencyRfqResponse.body.rfqs[0].urgencyLevel).toBe('EMERGENCY');

      // Step 4: Verify post-approval documentation requirement
      const postApprovalResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}/post-approval-requirements`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      expect(postApprovalResponse.body.requiresDocumentation).toBe(true);
      expect(postApprovalResponse.body.requiredDocuments).toContain('EMERGENCY_JUSTIFICATION');

      // Step 5: Verify audit trail includes emergency override
      const auditResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}/audit-trail`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      expect(auditResponse.body.auditTrail.some((entry: any) => 
        entry.action === 'EMERGENCY_OVERRIDE' && entry.userId === captain.id
      )).toBe(true);
    });
  });

  describe('Safety Equipment Compliance Workflow', () => {
    it('should handle safety equipment procurement with compliance tracking', async () => {
      // Step 1: Captain creates safety equipment requisition
      const safetyRequisition = {
        vesselId: testVessel.id,
        urgencyLevel: 'URGENT',
        deliveryLocation: 'Port of Hamburg',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Annual safety inspection - life jackets require replacement',
        complianceFlags: ['SOLAS', 'ISM'],
        inspectionReference: 'SAFETY-2024-001',
        items: [
          {
            impaCode: '593.21.01',
            name: 'Life Jacket Adult',
            quantity: 25,
            unitPrice: 85.00,
            totalPrice: 2125,
            urgencyLevel: 'URGENT',
            criticalityLevel: 'SAFETY_CRITICAL',
            complianceStandards: ['SOLAS Chapter III', 'IMO MSC.200(80)'],
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${captainToken}`)
        .send(safetyRequisition)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Step 2: Submit for expedited approval (safety critical)
      const submitResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      expect(submitResponse.body.safetyCritical).toBe(true);
      expect(submitResponse.body.expedited).toBe(true);
      expect(submitResponse.body.complianceFlags).toContain('SOLAS');

      // Step 3: Superintendent approves with compliance notes
      const approveResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .send({
          comments: 'Approved for SOLAS compliance',
          complianceNotes: 'Required for upcoming port state control inspection',
          priorityLevel: 'HIGH',
        })
        .expect(200);

      expect(approveResponse.body.success).toBe(true);

      // Step 4: Verify compliance tracking
      const complianceResponse = await request(app)
        .get(`/api/vessels/${testVessel.id}/compliance-status`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      expect(complianceResponse.body.pendingCompliance.some((item: any) => 
        item.requisitionId === requisitionId && item.standard === 'SOLAS Chapter III'
      )).toBe(true);

      // Step 5: Generate compliance report
      const reportResponse = await request(app)
        .get(`/api/vessels/${testVessel.id}/compliance-report`)
        .set('Authorization', `Bearer ${captainToken}`)
        .query({
          standards: 'SOLAS,ISM',
          format: 'json',
        })
        .expect(200);

      expect(reportResponse.body.complianceReport.standards).toContain('SOLAS');
      expect(reportResponse.body.complianceReport.pendingItems).toBeDefined();
    });
  });

  describe('Multi-Currency Procurement Workflow', () => {
    it('should handle procurement with currency conversion and budget validation', async () => {
      // Step 1: Create requisition in EUR
      const eurRequisition = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Hamburg',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'European supplier - local currency',
        currency: 'EUR',
        items: [
          {
            name: 'Navigation Equipment',
            description: 'GPS chart plotter',
            quantity: 1,
            unitPrice: 2500, // EUR
            totalPrice: 2500, // EUR
            currency: 'EUR',
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${crewToken}`)
        .send(eurRequisition)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Step 2: Validate budget with currency conversion
      const budgetResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}/budget-validation`)
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      expect(budgetResponse.body.budgetValidation.originalCurrency).toBe('EUR');
      expect(budgetResponse.body.budgetValidation.convertedAmount).toBeDefined();
      expect(budgetResponse.body.budgetValidation.exchangeRate).toBeDefined();
      expect(budgetResponse.body.budgetValidation.withinBudget).toBe(true);

      // Step 3: Submit and approve
      await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      const approveResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .send({
          comments: 'Approved with currency conversion',
          budgetCode: 'EUR-BUDGET-2024',
        })
        .expect(200);

      expect(approveResponse.body.success).toBe(true);

      // Step 4: Verify financial reporting includes currency data
      const financialResponse = await request(app)
        .get(`/api/vessels/${testVessel.id}/financial-summary`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .query({
          currency: 'USD',
          includeCurrencyBreakdown: 'true',
        })
        .expect(200);

      expect(financialResponse.body.currencyBreakdown.EUR).toBeDefined();
      expect(financialResponse.body.totalInBaseCurrency).toBeDefined();
    });
  });

  describe('Offline Synchronization Workflow', () => {
    it('should handle offline requisition creation and synchronization', async () => {
      // Step 1: Create offline requisition
      const offlineRequisition = {
        vesselId: testVessel.id,
        urgencyLevel: 'URGENT',
        deliveryLocation: 'Next Port',
        deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Created offline during poor connectivity',
        offlineId: 'offline-req-e2e-001',
        createdOffline: true,
        offlineTimestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        items: [
          {
            name: 'Emergency Repair Kit',
            description: 'Basic repair tools and supplies',
            quantity: 1,
            unitPrice: 750,
            totalPrice: 750,
          },
        ],
      };

      // Step 2: Sync offline requisition
      const syncResponse = await request(app)
        .post('/api/requisitions/sync-offline')
        .set('Authorization', `Bearer ${crewToken}`)
        .send(offlineRequisition)
        .expect(201);

      expect(syncResponse.body.success).toBe(true);
      expect(syncResponse.body.requisition.offlineId).toBe('offline-req-e2e-001');
      expect(syncResponse.body.requisition.syncedAt).toBeDefined();

      const requisitionId = syncResponse.body.requisition.id;

      // Step 3: Verify offline data integrity
      const verifyResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}`)
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      expect(verifyResponse.body.requisition.createdOffline).toBe(true);
      expect(verifyResponse.body.requisition.offlineTimestamp).toBeDefined();

      // Step 4: Continue normal workflow
      const submitResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      expect(submitResponse.body.success).toBe(true);
      expect(submitResponse.body.requisition.status).toBe('APPROVED'); // Auto-approved under $500
    });
  });

  describe('Delegation and Crew Rotation Workflow', () => {
    it('should handle approval delegation during crew changes', async () => {
      // Step 1: Create temporary replacement user
      const tempSuperintendent = await prisma.user.create({
        data: {
          email: 'temp.super@e2etest.com',
          passwordHash: '$2a$12$hashedpassword',
          firstName: 'Temp',
          lastName: 'Superintendent',
          role: 'SUPERINTENDENT',
          isActive: true,
          emailVerified: true,
        },
      });

      await prisma.vesselAssignment.create({
        data: {
          userId: tempSuperintendent.id,
          vesselId: testVessel.id,
          role: 'SUPERINTENDENT',
        },
      });

      const tempSuperToken = generateAccessToken(tempSuperintendent.id);

      // Step 2: Create delegation
      const delegationResponse = await request(app)
        .post('/api/delegations')
        .set('Authorization', `Bearer ${superintendentToken}`)
        .send({
          toUserId: tempSuperintendent.id,
          vesselId: testVessel.id,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          reason: 'Crew rotation - annual leave',
          permissions: ['APPROVE_REQUISITIONS', 'MANAGE_BUDGETS'],
        })
        .expect(201);

      expect(delegationResponse.body.success).toBe(true);

      // Step 3: Create requisition requiring superintendent approval
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Hamburg',
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'During delegation period',
        items: [
          {
            name: 'Maintenance Supplies',
            quantity: 1,
            unitPrice: 1500,
            totalPrice: 1500,
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${crewToken}`)
        .send(requisitionData)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Step 4: Submit for approval
      const submitResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      expect(submitResponse.body.approvalLevel).toBe('SUPERINTENDENT');

      // Step 5: Temporary superintendent approves (using delegation)
      const approveResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${tempSuperToken}`)
        .send({
          comments: 'Approved under delegation authority',
        })
        .expect(200);

      expect(approveResponse.body.success).toBe(true);
      expect(approveResponse.body.delegated).toBe(true);
      expect(approveResponse.body.originalApprover).toBe(superintendent.id);

      // Step 6: Verify audit trail shows delegation
      const auditResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}/audit-trail`)
        .set('Authorization', `Bearer ${tempSuperToken}`)
        .expect(200);

      expect(auditResponse.body.auditTrail.some((entry: any) => 
        entry.action === 'APPROVED' && 
        entry.userId === tempSuperintendent.id &&
        entry.delegatedFrom === superintendent.id
      )).toBe(true);

      // Cleanup
      await prisma.vesselAssignment.deleteMany({
        where: { userId: tempSuperintendent.id },
      });
      await prisma.user.delete({
        where: { id: tempSuperintendent.id },
      });
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent requisition creation', async () => {
      // Create multiple requisitions concurrently
      const concurrentRequests = Array.from({ length: 10 }, (_, index) => 
        request(app)
          .post('/api/requisitions')
          .set('Authorization', `Bearer ${crewToken}`)
          .send({
            vesselId: testVessel.id,
            urgencyLevel: 'ROUTINE',
            deliveryLocation: 'Port of Hamburg',
            deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            justification: `Concurrent test requisition ${index + 1}`,
            items: [
              {
                name: `Test Item ${index + 1}`,
                quantity: 1,
                unitPrice: 100,
                totalPrice: 100,
              },
            ],
          })
      );

      const responses = await Promise.all(concurrentRequests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Verify all requisitions were created
      const listResponse = await request(app)
        .get(`/api/vessels/${testVessel.id}/requisitions`)
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      expect(listResponse.body.requisitions.length).toBe(10);
    });

    it('should handle high-frequency API calls with rate limiting', async () => {
      const startTime = Date.now();
      
      // Make rapid API requests to test rate limiting
      const rapidRequests = Array.from({ length: 50 }, () =>
        request(app)
          .get(`/api/vessels/${testVessel.id}/requisitions`)
          .set('Authorization', `Bearer ${crewToken}`)
      );

      const responses = await Promise.all(rapidRequests);
      const duration = Date.now() - startTime;

      // Some requests should be rate limited
      const successfulResponses = responses.filter(r => r.status === 200);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(successfulResponses.length).toBeGreaterThan(0);

      console.log(`Rate Limiting Test:
        - Total Requests: ${responses.length}
        - Successful: ${successfulResponses.length}
        - Rate Limited: ${rateLimitedResponses.length}
        - Duration: ${duration}ms`);
    });
  });

  describe('Cross-Browser Compatibility Workflows', () => {
    it('should handle different user agent strings', async () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      ];

      for (const userAgent of userAgents) {
        const response = await request(app)
          .get(`/api/vessels/${testVessel.id}/requisitions`)
          .set('Authorization', `Bearer ${crewToken}`)
          .set('User-Agent', userAgent)
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });

    it('should handle different content types and encodings', async () => {
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Test Port with Special Characters: åäö',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Testing UTF-8 encoding: 中文测试 🚢',
        items: [
          {
            name: 'Test Item with Émojis 🔧',
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${crewToken}`)
        .set('Content-Type', 'application/json; charset=utf-8')
        .send(requisitionData)
        .expect(201);

      expect(response.body.requisition.deliveryLocation).toContain('åäö');
      expect(response.body.requisition.justification).toContain('中文测试');
      expect(response.body.requisition.items[0].name).toContain('🔧');
    });
  });

  describe('Data Integrity and Consistency Workflows', () => {
    it('should maintain data consistency during concurrent operations', async () => {
      // Create a requisition
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Consistency Test Port',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Testing data consistency',
        items: [
          {
            name: 'Consistency Test Item',
            quantity: 1,
            unitPrice: 1000,
            totalPrice: 1000,
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${crewToken}`)
        .send(requisitionData)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Submit for approval
      await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      // Try concurrent approval attempts (should only succeed once)
      const approvalAttempts = Array.from({ length: 5 }, () =>
        request(app)
          .post(`/api/requisitions/${requisitionId}/approve`)
          .set('Authorization', `Bearer ${superintendentToken}`)
          .send({ comments: 'Concurrent approval test' })
      );

      const approvalResponses = await Promise.all(approvalAttempts);
      
      // Only one approval should succeed
      const successfulApprovals = approvalResponses.filter(r => r.status === 200);
      const conflictResponses = approvalResponses.filter(r => r.status === 409);

      expect(successfulApprovals.length).toBe(1);
      expect(conflictResponses.length).toBeGreaterThan(0);

      // Verify final state
      const finalStateResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}`)
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      expect(finalStateResponse.body.requisition.status).toBe('APPROVED');
    });

    it('should handle transaction rollbacks on failures', async () => {
      // Test scenario where part of a complex operation fails
      const invalidRequisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Rollback Test Port',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Testing transaction rollback',
        items: [
          {
            name: 'Valid Item',
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
          {
            name: 'Invalid Item',
            quantity: -1, // Invalid quantity should cause rollback
            unitPrice: 100,
            totalPrice: -100,
          },
        ],
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${crewToken}`)
        .send(invalidRequisitionData)
        .expect(400);

      expect(response.body.success).toBe(false);

      // Verify no partial data was created
      const listResponse = await request(app)
        .get(`/api/vessels/${testVessel.id}/requisitions`)
        .set('Authorization', `Bearer ${crewToken}`)
        .query({ search: 'Rollback Test Port' })
        .expect(200);

      expect(listResponse.body.requisitions.length).toBe(0);
    });
  });

  describe('Error Recovery and Resilience Workflows', () => {
    it('should handle network interruption simulation', async () => {
      // Create requisition
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Network Test Port',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Testing network resilience',
        items: [
          {
            name: 'Network Test Item',
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${crewToken}`)
        .send(requisitionData)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Simulate timeout scenario
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100);
      });

      const requestPromise = request(app)
        .get(`/api/requisitions/${requisitionId}`)
        .set('Authorization', `Bearer ${crewToken}`)
        .timeout(50); // Very short timeout

      try {
        await Promise.race([requestPromise, timeoutPromise]);
      } catch (error) {
        // Expected timeout error
        expect(error.message).toContain('timeout');
      }

      // Verify data integrity after timeout
      const recoveryResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}`)
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      expect(recoveryResponse.body.requisition.id).toBe(requisitionId);
    });

    it('should handle graceful degradation scenarios', async () => {
      // Test with missing optional services
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Degradation Test Port',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Testing graceful degradation',
        items: [
          {
            name: 'Degradation Test Item',
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
      };

      // Create requisition even if some services are unavailable
      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${crewToken}`)
        .set('X-Simulate-Service-Degradation', 'email-service')
        .send(requisitionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.warnings).toBeDefined();
      expect(response.body.warnings.some((w: any) => w.includes('email'))).toBe(true);
    });
  });

  describe('Accessibility and Usability Workflows', () => {
    it('should provide proper API response structure for screen readers', async () => {
      const response = await request(app)
        .get(`/api/vessels/${testVessel.id}/requisitions`)
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      // Verify response structure supports accessibility
      expect(response.body.success).toBeDefined();
      expect(response.body.requisitions).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBeDefined();
      expect(response.body.pagination.page).toBeDefined();
      expect(response.body.pagination.limit).toBeDefined();

      // Verify each requisition has required accessibility fields
      if (response.body.requisitions.length > 0) {
        const requisition = response.body.requisitions[0];
        expect(requisition.id).toBeDefined();
        expect(requisition.requisitionNumber).toBeDefined();
        expect(requisition.status).toBeDefined();
        expect(requisition.urgencyLevel).toBeDefined();
        expect(requisition.createdAt).toBeDefined();
      }
    });

    it('should support keyboard-only navigation patterns', async () => {
      // Test API endpoints that support keyboard navigation
      const response = await request(app)
        .get('/api/navigation/keyboard-shortcuts')
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      expect(response.body.shortcuts).toBeDefined();
      expect(response.body.shortcuts.length).toBeGreaterThan(0);
      
      // Verify shortcuts have proper structure
      response.body.shortcuts.forEach((shortcut: any) => {
        expect(shortcut.key).toBeDefined();
        expect(shortcut.description).toBeDefined();
        expect(shortcut.action).toBeDefined();
      });
    });
  });

  describe('Internationalization and Localization Workflows', () => {
    it('should handle different locale formats', async () => {
      const locales = ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES'];

      for (const locale of locales) {
        const response = await request(app)
          .get(`/api/vessels/${testVessel.id}/requisitions`)
          .set('Authorization', `Bearer ${crewToken}`)
          .set('Accept-Language', locale)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.headers['content-language']).toBeDefined();
      }
    });

    it('should handle different date and number formats', async () => {
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Localization Test Port',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Testing localization',
        items: [
          {
            name: 'Localization Test Item',
            quantity: 1,
            unitPrice: 1234.56,
            totalPrice: 1234.56,
          },
        ],
      };

      const response = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${crewToken}`)
        .set('Accept-Language', 'de-DE')
        .send(requisitionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.requisition.items[0].unitPrice).toBe(1234.56);
    });
  });

  describe('Mobile and Responsive Workflows', () => {
    it('should handle mobile-specific API requests', async () => {
      const mobileHeaders = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Mobile-App': 'FlowMarine-iOS/1.0',
      };

      const response = await request(app)
        .get(`/api/vessels/${testVessel.id}/requisitions`)
        .set('Authorization', `Bearer ${crewToken}`)
        .set(mobileHeaders)
        .query({ mobile: 'true', limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.mobileOptimized).toBe(true);
      expect(response.body.requisitions.length).toBeLessThanOrEqual(10);
    });

    it('should handle touch-friendly API responses', async () => {
      const response = await request(app)
        .get('/api/ui/touch-targets')
        .set('Authorization', `Bearer ${crewToken}`)
        .set('X-Touch-Interface', 'true')
        .expect(200);

      expect(response.body.touchTargets).toBeDefined();
      expect(response.body.minTouchSize).toBe(44); // 44px minimum
    });
  });

  describe('Performance Monitoring Workflows', () => {
    it('should track response times and provide metrics', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/vessels/${testVessel.id}/requisitions`)
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      expect(response.headers['x-response-time']).toBeDefined();
      expect(response.body.success).toBe(true);
    });

    it('should provide health check endpoints', async () => {
      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body.timestamp).toBeDefined();
      expect(healthResponse.body.version).toBeDefined();
      expect(healthResponse.body.services).toBeDefined();

      // Check individual service health
      Object.values(healthResponse.body.services).forEach((service: any) => {
        expect(['healthy', 'degraded', 'unhealthy']).toContain(service.status);
      });
    });
  });

  describe('Compliance and Audit Workflows', () => {
    it('should maintain complete audit trails for all operations', async () => {
      // Create and modify a requisition
      const requisitionData = {
        vesselId: testVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Audit Test Port',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Testing audit trail',
        items: [
          {
            name: 'Audit Test Item',
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${crewToken}`)
        .send(requisitionData)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Submit for approval
      await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      // Approve
      await request(app)
        .post(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .send({ comments: 'Audit test approval' })
        .expect(200);

      // Get complete audit trail
      const auditResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}/audit-trail`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .expect(200);

      expect(auditResponse.body.auditTrail.length).toBeGreaterThanOrEqual(3);
      
      const actions = auditResponse.body.auditTrail.map((entry: any) => entry.action);
      expect(actions).toContain('CREATED');
      expect(actions).toContain('SUBMITTED');
      expect(actions).toContain('APPROVED');

      // Verify audit entries have required fields
      auditResponse.body.auditTrail.forEach((entry: any) => {
        expect(entry.id).toBeDefined();
        expect(entry.userId).toBeDefined();
        expect(entry.action).toBeDefined();
        expect(entry.timestamp).toBeDefined();
        expect(entry.ipAddress).toBeDefined();
        expect(entry.userAgent).toBeDefined();
      });
    });

    it('should support compliance reporting requirements', async () => {
      const complianceResponse = await request(app)
        .get('/api/compliance/report')
        .set('Authorization', `Bearer ${superintendentToken}`)
        .query({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          standards: 'SOLAS,MARPOL,ISM',
        })
        .expect(200);

      expect(complianceResponse.body.success).toBe(true);
      expect(complianceResponse.body.report).toBeDefined();
      expect(complianceResponse.body.report.standards).toContain('SOLAS');
      expect(complianceResponse.body.report.period).toBeDefined();
      expect(complianceResponse.body.report.summary).toBeDefined();
    });
  });ing', async () => {
      // Make rapid API calls to test rate limiting
      const rapidRequests = Array.from({ length: 50 }, () => 
        request(app)
          .get(`/api/vessels/${testVessel.id}/requisitions`)
          .set('Authorization', `Bearer ${crewToken}`)
      );

      const responses = await Promise.all(rapidRequests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Successful requests should still work
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(0);
    });
  });
});