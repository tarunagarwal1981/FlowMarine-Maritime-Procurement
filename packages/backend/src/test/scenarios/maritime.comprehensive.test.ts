import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken } from '@/utils/jwt';

const prisma = new PrismaClient();

describe('Maritime Business Scenarios', () => {
  let containerVessel: any;
  let tankerVessel: any;
  let captain: any;
  let chiefEngineer: any;
  let superintendent: any;
  let procurementManager: any;
  let captainToken: string;
  let chiefEngineerToken: string;
  let superintendentToken: string;
  let procurementManagerToken: string;

  beforeAll(async () => {
    // Create test vessels
    containerVessel = await prisma.vessel.create({
      data: {
        name: 'MV Ocean Pioneer',
        imoNumber: 'IMO9876543',
        vesselType: 'Container Ship',
        flag: 'Singapore',
        engineType: 'MAN B&W 8S90ME-C',
        cargoCapacity: 18000,
        fuelConsumption: 280,
        crewComplement: 22,
        currentLatitude: 1.2966,
        currentLongitude: 103.7764,
        currentDeparture: 'Port of Singapore',
        currentDestination: 'Port of Rotterdam',
        currentETA: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    tankerVessel = await prisma.vessel.create({
      data: {
        name: 'MT Maritime Star',
        imoNumber: 'IMO1357924',
        vesselType: 'Oil Tanker',
        flag: 'Marshall Islands',
        engineType: 'Wartsila RT-flex96C',
        cargoCapacity: 320000,
        fuelConsumption: 220,
        crewComplement: 25,
        currentLatitude: 25.2048,
        currentLongitude: 55.2708,
        currentDeparture: 'Port of Jebel Ali',
        currentDestination: 'Port of Houston',
        currentETA: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      },
    });

    // Create test users
    captain = await prisma.user.create({
      data: {
        email: 'captain@oceanpioneer.com',
        passwordHash: 'hashed-password',
        firstName: 'Sarah',
        lastName: 'Johnson',
        role: 'CAPTAIN',
        isActive: true,
        emailVerified: true,
      },
    });

    chiefEngineer = await prisma.user.create({
      data: {
        email: 'chief@oceanpioneer.com',
        passwordHash: 'hashed-password',
        firstName: 'Michael',
        lastName: 'Chen',
        role: 'CHIEF_ENGINEER',
        isActive: true,
        emailVerified: true,
      },
    });

    superintendent = await prisma.user.create({
      data: {
        email: 'superintendent@maritimefleet.com',
        passwordHash: 'hashed-password',
        firstName: 'David',
        lastName: 'Rodriguez',
        role: 'SUPERINTENDENT',
        isActive: true,
        emailVerified: true,
      },
    });

    procurementManager = await prisma.user.create({
      data: {
        email: 'procurement@maritimefleet.com',
        passwordHash: 'hashed-password',
        firstName: 'Lisa',
        lastName: 'Wang',
        role: 'PROCUREMENT_MANAGER',
        isActive: true,
        emailVerified: true,
      },
    });

    // Create vessel assignments
    await prisma.vesselAssignment.createMany({
      data: [
        { userId: captain.id, vesselId: containerVessel.id, role: 'CAPTAIN' },
        { userId: chiefEngineer.id, vesselId: containerVessel.id, role: 'CHIEF_ENGINEER' },
        { userId: superintendent.id, vesselId: containerVessel.id, role: 'SUPERINTENDENT' },
        { userId: superintendent.id, vesselId: tankerVessel.id, role: 'SUPERINTENDENT' },
      ],
    });

    // Generate tokens
    captainToken = generateAccessToken(captain.id);
    chiefEngineerToken = generateAccessToken(chiefEngineer.id);
    superintendentToken = generateAccessToken(superintendent.id);
    procurementManagerToken = generateAccessToken(procurementManager.id);

    // Create test catalog items
    await prisma.itemCatalog.createMany({
      data: [
        {
          impaCode: '613.11.01',
          issaCode: 'ISSA-613-11-01',
          name: 'Main Engine Cylinder Oil',
          description: 'High-performance cylinder oil for large marine engines',
          category: 'ENGINE_PARTS',
          criticalityLevel: 'OPERATIONAL_CRITICAL',
          unitOfMeasure: 'LITER',
          averagePrice: 12.50,
          leadTime: 7,
          compatibleEngineTypes: ['MAN B&W', 'Wartsila'],
        },
        {
          impaCode: '593.21.01',
          issaCode: 'ISSA-593-21-01',
          name: 'SOLAS Life Jacket',
          description: 'SOLAS approved life jacket with whistle and light',
          category: 'SAFETY_EQUIPMENT',
          criticalityLevel: 'SAFETY_CRITICAL',
          unitOfMeasure: 'PIECE',
          averagePrice: 95.00,
          leadTime: 3,
        },
        {
          impaCode: '751.31.05',
          issaCode: 'ISSA-751-31-05',
          name: 'Navigation Chart Paper',
          description: 'High-quality chart paper for navigation plotting',
          category: 'NAVIGATION_EQUIPMENT',
          criticalityLevel: 'ROUTINE',
          unitOfMeasure: 'SHEET',
          averagePrice: 2.50,
          leadTime: 14,
        },
      ],
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.vesselAssignment.deleteMany({
      where: { vesselId: { in: [containerVessel.id, tankerVessel.id] } },
    });
    await prisma.itemCatalog.deleteMany({
      where: { impaCode: { in: ['613.11.01', '593.21.01', '751.31.05'] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [captain.id, chiefEngineer.id, superintendent.id, procurementManager.id] } },
    });
    await prisma.vessel.deleteMany({
      where: { id: { in: [containerVessel.id, tankerVessel.id] } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up requisitions and related data before each test
    await prisma.requisition.deleteMany({
      where: { vesselId: { in: [containerVessel.id, tankerVessel.id] } },
    });
  });

  describe('Emergency Engine Failure Scenario', () => {
    it('should handle critical engine failure with emergency procurement', async () => {
      // Scenario: Container ship experiences main engine failure in the middle of the ocean
      // Chief Engineer creates emergency requisition for critical spare parts
      
      const emergencyRequisition = {
        vesselId: containerVessel.id,
        urgencyLevel: 'EMERGENCY',
        deliveryLocation: 'Port of Colombo (Emergency Diversion)',
        deliveryDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
        justification: 'Main engine cylinder head gasket failure. Engine stopped. Safety risk in heavy weather.',
        items: [
          {
            name: 'Main Engine Cylinder Head Gasket Set',
            description: 'Complete gasket set for MAN B&W 8S90ME-C engine',
            quantity: 1,
            unitPrice: 25000,
            totalPrice: 25000,
            urgencyLevel: 'EMERGENCY',
            criticalityLevel: 'SAFETY_CRITICAL',
          },
          {
            name: 'Emergency Repair Tools',
            description: 'Specialized tools for cylinder head removal',
            quantity: 1,
            unitPrice: 5000,
            totalPrice: 5000,
            urgencyLevel: 'EMERGENCY',
          },
        ],
      };

      // Chief Engineer creates emergency requisition
      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${chiefEngineerToken}`)
        .send(emergencyRequisition)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Captain performs emergency override due to safety risk
      const overrideResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/emergency-override`)
        .set('Authorization', `Bearer ${captainToken}`)
        .send({
          reason: 'Engine failure poses immediate safety risk in heavy weather. Vessel unable to maintain position.',
          requiresPostApproval: true,
          safetyJustification: 'SOLAS Chapter V - Safe Navigation requirements',
        })
        .expect(200);

      expect(overrideResponse.body.success).toBe(true);
      expect(overrideResponse.body.requisition.status).toBe('APPROVED');
      expect(overrideResponse.body.emergencyOverride).toBe(true);
      expect(overrideResponse.body.requiresPostApproval).toBe(true);

      // System should automatically generate RFQ to nearby suppliers
      const rfqResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}/rfqs`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      expect(rfqResponse.body.success).toBe(true);
      expect(rfqResponse.body.rfqs.length).toBeGreaterThan(0);
      expect(rfqResponse.body.rfqs[0].urgencyLevel).toBe('EMERGENCY');

      // Verify audit trail for emergency override
      const auditResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}/audit-trail`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      expect(auditResponse.body.success).toBe(true);
      expect(auditResponse.body.auditTrail.some((entry: any) => 
        entry.action === 'EMERGENCY_OVERRIDE' && entry.userId === captain.id
      )).toBe(true);
    });
  });

  describe('Routine Maintenance Planning Scenario', () => {
    it('should handle planned maintenance procurement workflow', async () => {
      // Scenario: Chief Engineer plans routine maintenance for upcoming port call
      
      const maintenanceRequisition = {
        vesselId: containerVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Rotterdam',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Scheduled maintenance during port call - 3000 running hours service',
        maintenanceScheduleId: 'MAINT-2024-001',
        items: [
          {
            itemCatalogId: null, // Will be resolved by IMPA code
            impaCode: '613.11.01',
            name: 'Main Engine Cylinder Oil',
            quantity: 500,
            unitPrice: 12.50,
            totalPrice: 6250,
            urgencyLevel: 'ROUTINE',
          },
          {
            name: 'Air Filter Elements',
            description: 'Main engine air intake filters',
            quantity: 8,
            unitPrice: 125,
            totalPrice: 1000,
            urgencyLevel: 'ROUTINE',
          },
          {
            name: 'Fuel Filter Cartridges',
            description: 'High-efficiency fuel filters',
            quantity: 12,
            unitPrice: 85,
            totalPrice: 1020,
            urgencyLevel: 'ROUTINE',
          },
        ],
      };

      // Chief Engineer creates maintenance requisition
      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${chiefEngineerToken}`)
        .send(maintenanceRequisition)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;
      expect(createResponse.body.requisition.totalAmount).toBe(8270);

      // Submit for approval (should route to Superintendent for $5K-$25K)
      const submitResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${chiefEngineerToken}`)
        .expect(200);

      expect(submitResponse.body.success).toBe(true);
      expect(submitResponse.body.requisition.status).toBe('PENDING_APPROVAL');
      expect(submitResponse.body.approvalLevel).toBe('SUPERINTENDENT');

      // Superintendent reviews and approves
      const approveResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .send({
          comments: 'Approved for scheduled maintenance. Ensure delivery before port departure.',
          budgetCode: 'MAINT-2024-Q1',
        })
        .expect(200);

      expect(approveResponse.body.success).toBe(true);
      expect(approveResponse.body.requisition.status).toBe('APPROVED');

      // System generates RFQ to qualified suppliers
      const rfqResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/generate-rfq`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .expect(200);

      expect(rfqResponse.body.success).toBe(true);
      expect(rfqResponse.body.rfq.deliveryLocation).toBe('Port of Rotterdam');
      expect(rfqResponse.body.vendorsNotified).toBeGreaterThan(0);
    });
  });

  describe('Safety Equipment Compliance Scenario', () => {
    it('should handle safety equipment replacement with compliance tracking', async () => {
      // Scenario: Annual safety equipment inspection reveals expired life jackets
      
      const safetyRequisition = {
        vesselId: containerVessel.id,
        urgencyLevel: 'URGENT',
        deliveryLocation: 'Port of Singapore',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Annual safety inspection - life jackets expired. SOLAS compliance required.',
        complianceFlags: ['SOLAS', 'ISM'],
        inspectionReference: 'SAFETY-INSP-2024-001',
        items: [
          {
            itemCatalogId: null,
            impaCode: '593.21.01',
            name: 'SOLAS Life Jacket',
            quantity: 30,
            unitPrice: 95.00,
            totalPrice: 2850,
            urgencyLevel: 'URGENT',
            criticalityLevel: 'SAFETY_CRITICAL',
            complianceStandards: ['SOLAS Chapter III', 'IMO Resolution MSC.200(80)'],
          },
        ],
      };

      // Captain creates safety requisition
      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${captainToken}`)
        .send(safetyRequisition)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Safety-critical items should be expedited
      const submitResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      expect(submitResponse.body.success).toBe(true);
      expect(submitResponse.body.safetyCritical).toBe(true);
      expect(submitResponse.body.expedited).toBe(true);
      expect(submitResponse.body.complianceFlags).toContain('SOLAS');

      // Superintendent approves with compliance notes
      const approveResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .send({
          comments: 'Approved for SOLAS compliance. Ensure certificates are provided.',
          complianceNotes: 'Required for port state control inspection in Singapore.',
        })
        .expect(200);

      expect(approveResponse.body.success).toBe(true);
      expect(approveResponse.body.requisition.status).toBe('APPROVED');

      // Verify compliance tracking
      const complianceResponse = await request(app)
        .get(`/api/vessels/${containerVessel.id}/compliance-status`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      expect(complianceResponse.body.success).toBe(true);
      expect(complianceResponse.body.pendingCompliance.some((item: any) => 
        item.requisitionId === requisitionId && item.standard === 'SOLAS Chapter III'
      )).toBe(true);
    });
  });

  describe('Multi-Vessel Fleet Management Scenario', () => {
    it('should handle fleet-wide procurement coordination', async () => {
      // Scenario: Superintendent manages procurement for multiple vessels
      
      // Create requisitions for both vessels
      const containerRequisition = {
        vesselId: containerVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Rotterdam',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Navigation chart updates',
        items: [
          {
            impaCode: '751.31.05',
            name: 'Navigation Chart Paper',
            quantity: 100,
            unitPrice: 2.50,
            totalPrice: 250,
          },
        ],
      };

      const tankerRequisition = {
        vesselId: tankerVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Houston',
        deliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Navigation chart updates',
        items: [
          {
            impaCode: '751.31.05',
            name: 'Navigation Chart Paper',
            quantity: 100,
            unitPrice: 2.50,
            totalPrice: 250,
          },
        ],
      };

      // Create both requisitions
      const containerResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${chiefEngineerToken}`)
        .send(containerRequisition)
        .expect(201);

      const tankerResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${superintendentToken}`)
        .send(tankerRequisition)
        .expect(201);

      // Superintendent views fleet-wide requisitions
      const fleetResponse = await request(app)
        .get('/api/fleet/requisitions')
        .set('Authorization', `Bearer ${superintendentToken}`)
        .query({ status: 'DRAFT' })
        .expect(200);

      expect(fleetResponse.body.success).toBe(true);
      expect(fleetResponse.body.requisitions.length).toBeGreaterThanOrEqual(2);

      // Superintendent can consolidate similar items for bulk purchasing
      const consolidateResponse = await request(app)
        .post('/api/fleet/consolidate-requisitions')
        .set('Authorization', `Bearer ${superintendentToken}`)
        .send({
          requisitionIds: [containerResponse.body.requisition.id, tankerResponse.body.requisition.id],
          consolidationReason: 'Bulk purchase for better pricing',
        })
        .expect(200);

      expect(consolidateResponse.body.success).toBe(true);
      expect(consolidateResponse.body.consolidatedRfq).toBeDefined();
      expect(consolidateResponse.body.consolidatedRfq.totalQuantity).toBe(200);
    });
  });

  describe('Port Delivery Coordination Scenario', () => {
    it('should coordinate delivery with vessel schedule and port capabilities', async () => {
      // Scenario: Vessel approaching port, need to coordinate delivery timing
      
      const portDeliveryRequisition = {
        vesselId: containerVessel.id,
        urgencyLevel: 'URGENT',
        deliveryLocation: 'Port of Rotterdam',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Critical spares needed before next voyage',
        portCallDetails: {
          berthNumber: 'ECT Delta Terminal - Berth 1405',
          arrivalTime: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString(),
          departureTime: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString(),
          agentContact: 'Rotterdam Maritime Services',
        },
        items: [
          {
            name: 'Propeller Shaft Bearing',
            description: 'Stern tube bearing replacement',
            quantity: 1,
            unitPrice: 8500,
            totalPrice: 8500,
            urgencyLevel: 'URGENT',
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${chiefEngineerToken}`)
        .send(portDeliveryRequisition)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Validate delivery feasibility
      const validationResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/validate-port-delivery`)
        .set('Authorization', `Bearer ${chiefEngineerToken}`)
        .expect(200);

      expect(validationResponse.body.success).toBe(true);
      expect(validationResponse.body.validation.deliveryFeasible).toBe(true);
      expect(validationResponse.body.validation.portCapabilities).toBeDefined();

      // Submit and approve
      await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${chiefEngineerToken}`)
        .expect(200);

      await request(app)
        .post(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .send({ comments: 'Approved for port delivery coordination' })
        .expect(200);

      // Generate RFQ with port-specific requirements
      const rfqResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/generate-rfq`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .expect(200);

      expect(rfqResponse.body.success).toBe(true);
      expect(rfqResponse.body.rfq.deliveryRequirements.portAccess).toBe(true);
      expect(rfqResponse.body.rfq.deliveryRequirements.customsClearance).toBe(true);
    });
  });

  describe('Budget Management and Currency Scenario', () => {
    it('should handle multi-currency procurement with budget controls', async () => {
      // Scenario: Vessel operating in different regions with local currency requirements
      
      const eurRequisition = {
        vesselId: containerVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Hamburg',
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Local supplier in EUR region',
        currency: 'EUR',
        items: [
          {
            name: 'Hydraulic Oil',
            description: 'Marine grade hydraulic oil',
            quantity: 200,
            unitPrice: 8.50, // EUR
            totalPrice: 1700, // EUR
            currency: 'EUR',
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${chiefEngineerToken}`)
        .send(eurRequisition)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Check budget validation with currency conversion
      const budgetResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}/budget-validation`)
        .set('Authorization', `Bearer ${chiefEngineerToken}`)
        .expect(200);

      expect(budgetResponse.body.success).toBe(true);
      expect(budgetResponse.body.budgetValidation.originalCurrency).toBe('EUR');
      expect(budgetResponse.body.budgetValidation.convertedAmount).toBeDefined();
      expect(budgetResponse.body.budgetValidation.exchangeRate).toBeDefined();
      expect(budgetResponse.body.budgetValidation.withinBudget).toBe(true);

      // Submit for approval
      const submitResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${chiefEngineerToken}`)
        .expect(200);

      expect(submitResponse.body.success).toBe(true);
      expect(submitResponse.body.requisition.status).toBe('APPROVED'); // Auto-approved under $500 USD equivalent
    });
  });

  describe('Crew Rotation and Delegation Scenario', () => {
    it('should handle approval delegation during crew rotation', async () => {
      // Scenario: Chief Engineer going on leave, needs to delegate approval authority
      
      // Create a new temporary chief engineer
      const tempChiefEngineer = await prisma.user.create({
        data: {
          email: 'temp.chief@oceanpioneer.com',
          passwordHash: 'hashed-password',
          firstName: 'Alex',
          lastName: 'Thompson',
          role: 'CHIEF_ENGINEER',
          isActive: true,
          emailVerified: true,
        },
      });

      await prisma.vesselAssignment.create({
        data: {
          userId: tempChiefEngineer.id,
          vesselId: containerVessel.id,
          role: 'CHIEF_ENGINEER',
        },
      });

      const tempChiefToken = generateAccessToken(tempChiefEngineer.id);

      // Create delegation
      const delegationResponse = await request(app)
        .post('/api/delegations')
        .set('Authorization', `Bearer ${chiefEngineerToken}`)
        .send({
          toUserId: tempChiefEngineer.id,
          vesselId: containerVessel.id,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          reason: 'Annual leave - crew rotation',
          permissions: ['APPROVE_REQUISITIONS', 'CREATE_REQUISITIONS'],
        })
        .expect(201);

      expect(delegationResponse.body.success).toBe(true);

      // Create requisition that would normally require chief engineer approval
      const requisition = {
        vesselId: containerVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Antwerp',
        deliveryDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Routine maintenance during delegation period',
        items: [
          {
            name: 'Engine Spare Parts',
            quantity: 1,
            unitPrice: 1200,
            totalPrice: 1200,
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${tempChiefToken}`)
        .send(requisition)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Temporary chief engineer can approve due to delegation
      const submitResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${tempChiefToken}`)
        .expect(200);

      expect(submitResponse.body.success).toBe(true);
      expect(submitResponse.body.delegated).toBe(true);
      expect(submitResponse.body.originalApprover).toBe(chiefEngineer.id);

      // Cleanup
      await prisma.vesselAssignment.deleteMany({
        where: { userId: tempChiefEngineer.id },
      });
      await prisma.user.delete({
        where: { id: tempChiefEngineer.id },
      });
    });
  });

  describe('Audit Trail and Compliance Reporting Scenario', () => {
    it('should maintain comprehensive audit trail for regulatory compliance', async () => {
      // Scenario: Port state control inspection requires complete procurement audit trail
      
      const auditRequisition = {
        vesselId: containerVessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Singapore',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Safety equipment maintenance for PSC inspection',
        complianceFlags: ['SOLAS', 'MARPOL', 'ISM'],
        items: [
          {
            name: 'Fire Detection System Components',
            quantity: 5,
            unitPrice: 450,
            totalPrice: 2250,
            criticalityLevel: 'SAFETY_CRITICAL',
          },
        ],
      };

      // Create, submit, and approve requisition
      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${captainToken}`)
        .send(auditRequisition)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      await request(app)
        .post(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .send({ comments: 'Approved for PSC compliance' })
        .expect(200);

      // Generate comprehensive audit report
      const auditResponse = await request(app)
        .get(`/api/vessels/${containerVessel.id}/audit-report`)
        .set('Authorization', `Bearer ${captainToken}`)
        .query({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          includeCompliance: 'true',
        })
        .expect(200);

      expect(auditResponse.body.success).toBe(true);
      expect(auditResponse.body.auditReport.totalTransactions).toBeGreaterThan(0);
      expect(auditResponse.body.auditReport.complianceItems).toBeDefined();
      expect(auditResponse.body.auditReport.userAccountability).toBeDefined();

      // Verify specific audit trail for the requisition
      const specificAuditResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}/audit-trail`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      expect(specificAuditResponse.body.success).toBe(true);
      expect(specificAuditResponse.body.auditTrail.length).toBeGreaterThan(0);
      expect(specificAuditResponse.body.auditTrail.some((entry: any) => 
        entry.action === 'CREATED' && entry.userId === captain.id
      )).toBe(true);
      expect(specificAuditResponse.body.auditTrail.some((entry: any) => 
        entry.action === 'APPROVED' && entry.userId === superintendent.id
      )).toBe(true);
    });
  });
});