import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken } from '@/utils/jwt';
import { hashPassword } from '@/utils/password';

describe('Maritime Scenarios Integration Tests', () => {
  let prisma: PrismaClient;
  let captain: any;
  let chiefEngineer: any;
  let crewMember: any;
  let superintendent: any;
  let procurementManager: any;
  let vessel: any;
  let emergencyItem: any;
  let routineItem: any;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up all test data
    await prisma.approval.deleteMany();
    await prisma.requisitionItem.deleteMany();
    await prisma.requisition.deleteMany();
    await prisma.itemCatalog.deleteMany();
    await prisma.vesselAssignment.deleteMany();
    await prisma.vessel.deleteMany();
    await prisma.userPermission.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.user.deleteMany();

    // Create permissions
    const permissions = await Promise.all([
      prisma.permission.create({ data: { name: 'requisition:create', description: 'Create requisitions' } }),
      prisma.permission.create({ data: { name: 'requisition:approve', description: 'Approve requisitions' } }),
      prisma.permission.create({ data: { name: 'emergency:override', description: 'Emergency override' } }),
      prisma.permission.create({ data: { name: 'procurement:manage', description: 'Manage procurement' } }),
      prisma.permission.create({ data: { name: 'budget:allocate', description: 'Allocate budget' } })
    ]);

    // Create users with different roles
    const passwordHash = await hashPassword('MaritimePass123!');

    captain = await prisma.user.create({
      data: {
        email: 'captain@vessel.com',
        passwordHash,
        firstName: 'Captain',
        lastName: 'Smith',
        role: 'CAPTAIN',
        emailVerified: true,
        isActive: true
      }
    });

    chiefEngineer = await prisma.user.create({
      data: {
        email: 'chief@vessel.com',
        passwordHash,
        firstName: 'Chief',
        lastName: 'Engineer',
        role: 'CHIEF_ENGINEER',
        emailVerified: true,
        isActive: true
      }
    });

    crewMember = await prisma.user.create({
      data: {
        email: 'crew@vessel.com',
        passwordHash,
        firstName: 'Crew',
        lastName: 'Member',
        role: 'CREW',
        emailVerified: true,
        isActive: true
      }
    });

    superintendent = await prisma.user.create({
      data: {
        email: 'superintendent@company.com',
        passwordHash,
        firstName: 'Fleet',
        lastName: 'Superintendent',
        role: 'SUPERINTENDENT',
        emailVerified: true,
        isActive: true
      }
    });

    procurementManager = await prisma.user.create({
      data: {
        email: 'procurement@company.com',
        passwordHash,
        firstName: 'Procurement',
        lastName: 'Manager',
        role: 'PROCUREMENT_MANAGER',
        emailVerified: true,
        isActive: true
      }
    });

    // Assign permissions
    await Promise.all([
      // Captain permissions
      prisma.userPermission.create({ data: { userId: captain.id, permissionId: permissions[0].id } }),
      prisma.userPermission.create({ data: { userId: captain.id, permissionId: permissions[1].id } }),
      prisma.userPermission.create({ data: { userId: captain.id, permissionId: permissions[2].id } }),
      
      // Chief Engineer permissions
      prisma.userPermission.create({ data: { userId: chiefEngineer.id, permissionId: permissions[0].id } }),
      prisma.userPermission.create({ data: { userId: chiefEngineer.id, permissionId: permissions[1].id } }),
      
      // Crew permissions
      prisma.userPermission.create({ data: { userId: crewMember.id, permissionId: permissions[0].id } }),
      
      // Superintendent permissions
      prisma.userPermission.create({ data: { userId: superintendent.id, permissionId: permissions[1].id } }),
      prisma.userPermission.create({ data: { userId: superintendent.id, permissionId: permissions[3].id } }),
      
      // Procurement Manager permissions
      prisma.userPermission.create({ data: { userId: procurementManager.id, permissionId: permissions[3].id } }),
      prisma.userPermission.create({ data: { userId: procurementManager.id, permissionId: permissions[4].id } })
    ]);

    // Create vessel
    vessel = await prisma.vessel.create({
      data: {
        name: 'MV Atlantic Pioneer',
        imoNumber: 'IMO9876543',
        vesselType: 'CONTAINER',
        flag: 'PANAMA',
        engineType: 'DIESEL',
        cargoCapacity: 80000,
        fuelConsumption: 180,
        crewComplement: 28,
        currentLatitude: 35.6762,
        currentLongitude: 139.6503, // Tokyo Bay
        currentDeparture: 'Port of Singapore',
        currentDestination: 'Port of Los Angeles',
        currentETA: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      }
    });

    // Assign all users to vessel
    await Promise.all([
      prisma.vesselAssignment.create({ data: { userId: captain.id, vesselId: vessel.id, role: 'CAPTAIN', assignedAt: new Date() } }),
      prisma.vesselAssignment.create({ data: { userId: chiefEngineer.id, vesselId: vessel.id, role: 'CHIEF_ENGINEER', assignedAt: new Date() } }),
      prisma.vesselAssignment.create({ data: { userId: crewMember.id, vesselId: vessel.id, role: 'CREW', assignedAt: new Date() } })
    ]);

    // Create items
    emergencyItem = await prisma.itemCatalog.create({
      data: {
        impaCode: '591234',
        issaCode: '59.12.34',
        name: 'Emergency Fire Pump',
        description: 'Critical safety equipment - emergency fire pump',
        category: 'SAFETY_EQUIPMENT',
        criticalityLevel: 'SAFETY_CRITICAL',
        unitOfMeasure: 'PIECE',
        averagePrice: 15000.00,
        leadTime: 3,
        compatibleVesselTypes: ['CONTAINER', 'BULK_CARRIER', 'TANKER'],
        compatibleEngineTypes: ['DIESEL', 'STEAM']
      }
    });

    routineItem = await prisma.itemCatalog.create({
      data: {
        impaCode: '123456',
        issaCode: '12.34.56',
        name: 'Engine Oil Filter',
        description: 'Standard engine oil filter for routine maintenance',
        category: 'ENGINE_PARTS',
        criticalityLevel: 'OPERATIONAL_CRITICAL',
        unitOfMeasure: 'PIECE',
        averagePrice: 45.99,
        leadTime: 7,
        compatibleVesselTypes: ['CONTAINER'],
        compatibleEngineTypes: ['DIESEL']
      }
    });
  });

  describe('Emergency Procurement Scenario', () => {
    it('should handle critical safety equipment failure', async () => {
      // Scenario: Fire pump fails during voyage, captain needs emergency procurement
      const captainToken = generateAccessToken(captain.id, [vessel.id], 'CAPTAIN');

      // Step 1: Captain creates emergency requisition
      const emergencyRequisition = {
        vesselId: vessel.id,
        urgencyLevel: 'EMERGENCY',
        deliveryLocation: 'Next Port of Call - Yokohama',
        deliveryDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
        justification: 'Main fire pump failed during safety drill. Critical safety equipment replacement required immediately.',
        emergencyReason: 'Fire safety system compromised - SOLAS compliance at risk',
        items: [
          {
            itemId: emergencyItem.id,
            quantity: 1,
            unitPrice: 15000.00,
            justification: 'Emergency replacement for failed fire pump'
          }
        ]
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${captainToken}`)
        .send(emergencyRequisition)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.requisition.urgencyLevel).toBe('EMERGENCY');
      expect(createResponse.body.emergencyProcessing).toBe(true);

      const requisitionId = createResponse.body.requisition.id;

      // Step 2: Captain uses emergency override to expedite approval
      const overrideResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/emergency-override`)
        .set('Authorization', `Bearer ${captainToken}`)
        .send({
          reason: 'Critical safety equipment failure - immediate procurement required for SOLAS compliance',
          vesselPosition: { latitude: 35.6762, longitude: 139.6503 },
          estimatedArrival: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString()
        })
        .expect(200);

      expect(overrideResponse.body.success).toBe(true);
      expect(overrideResponse.body.emergencyOverride).toBe(true);
      expect(overrideResponse.body.requiresPostApproval).toBe(true);

      // Step 3: Verify emergency workflow was triggered
      const workflowResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}/workflow-status`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      expect(workflowResponse.body.emergencyWorkflow).toBe(true);
      expect(workflowResponse.body.status).toBe('EMERGENCY_APPROVED');
    });

    it('should prevent non-captain emergency override', async () => {
      const crewToken = generateAccessToken(crewMember.id, [vessel.id], 'CREW');

      const emergencyRequisition = {
        vesselId: vessel.id,
        urgencyLevel: 'EMERGENCY',
        deliveryLocation: 'Current Position',
        deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Crew member attempting emergency override',
        items: [
          {
            itemId: emergencyItem.id,
            quantity: 1,
            unitPrice: 15000.00,
            justification: 'Unauthorized emergency attempt'
          }
        ]
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${crewToken}`)
        .send(emergencyRequisition)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Attempt emergency override as crew member
      const overrideResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/emergency-override`)
        .set('Authorization', `Bearer ${crewToken}`)
        .send({
          reason: 'Unauthorized override attempt'
        })
        .expect(403);

      expect(overrideResponse.body.error).toContain('Captain role required');
    });
  });

  describe('Routine Procurement Workflow', () => {
    it('should handle standard approval workflow', async () => {
      // Scenario: Crew member creates routine maintenance requisition
      const crewToken = generateAccessToken(crewMember.id, [vessel.id], 'CREW');
      const superintendentToken = generateAccessToken(superintendent.id, [vessel.id], 'SUPERINTENDENT');

      // Step 1: Crew creates routine requisition
      const routineRequisition = {
        vesselId: vessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Los Angeles',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Scheduled maintenance - engine oil filter replacement',
        items: [
          {
            itemId: routineItem.id,
            quantity: 12,
            unitPrice: 45.99,
            justification: 'Quarterly maintenance filter replacement'
          }
        ]
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${crewToken}`)
        .send(routineRequisition)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.requisition.status).toBe('DRAFT');

      const requisitionId = createResponse.body.requisition.id;

      // Step 2: Submit for approval
      const submitResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      expect(submitResponse.body.success).toBe(true);
      expect(submitResponse.body.requisition.status).toBe('PENDING_APPROVAL');

      // Step 3: Chief Engineer approves (first level)
      const chiefToken = generateAccessToken(chiefEngineer.id, [vessel.id], 'CHIEF_ENGINEER');
      
      const chiefApprovalResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${chiefToken}`)
        .send({
          comments: 'Approved for scheduled maintenance',
          approvalLevel: 'TECHNICAL'
        })
        .expect(200);

      expect(chiefApprovalResponse.body.success).toBe(true);

      // Step 4: Superintendent approves (budget level)
      const superintendentApprovalResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${superintendentToken}`)
        .send({
          comments: 'Budget approved for routine maintenance',
          approvalLevel: 'BUDGET'
        })
        .expect(200);

      expect(superintendentApprovalResponse.body.success).toBe(true);
      expect(superintendentApprovalResponse.body.requisition.status).toBe('APPROVED');
    });

    it('should handle budget threshold escalation', async () => {
      // Scenario: High-value requisition requiring procurement manager approval
      const chiefToken = generateAccessToken(chiefEngineer.id, [vessel.id], 'CHIEF_ENGINEER');
      const procurementToken = generateAccessToken(procurementManager.id, [], 'PROCUREMENT_MANAGER');

      // Create high-value requisition
      const highValueRequisition = {
        vesselId: vessel.id,
        urgencyLevel: 'URGENT',
        deliveryLocation: 'Port of Los Angeles',
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Major engine overhaul - multiple critical components',
        items: [
          {
            itemId: emergencyItem.id,
            quantity: 2,
            unitPrice: 15000.00,
            justification: 'Backup fire pumps for engine room overhaul'
          },
          {
            itemId: routineItem.id,
            quantity: 50,
            unitPrice: 45.99,
            justification: 'Complete filter set for overhaul'
          }
        ]
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${chiefToken}`)
        .send(highValueRequisition)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;
      const totalAmount = createResponse.body.requisition.totalAmount;

      expect(totalAmount).toBeGreaterThan(25000); // Should trigger procurement manager approval

      // Submit for approval
      await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${chiefToken}`)
        .expect(200);

      // Check workflow routing
      const workflowResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}/workflow-status`)
        .set('Authorization', `Bearer ${chiefToken}`)
        .expect(200);

      expect(workflowResponse.body.requiredApprovals).toContain('PROCUREMENT_MANAGER');
      expect(workflowResponse.body.budgetThreshold).toBe('HIGH_VALUE');

      // Procurement manager approval required
      const procurementApprovalResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${procurementToken}`)
        .send({
          comments: 'High-value procurement approved with budget allocation',
          approvalLevel: 'PROCUREMENT',
          budgetAllocation: 'CAPEX_MAINTENANCE'
        })
        .expect(200);

      expect(procurementApprovalResponse.body.success).toBe(true);
    });
  });

  describe('Crew Rotation Scenario', () => {
    it('should handle responsibility transfer during crew change', async () => {
      // Scenario: Chief Engineer rotation with pending requisitions
      const outgoingChiefToken = generateAccessToken(chiefEngineer.id, [vessel.id], 'CHIEF_ENGINEER');

      // Create requisition by outgoing chief
      const requisitionData = {
        vesselId: vessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Los Angeles',
        deliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Maintenance items for next port',
        items: [
          {
            itemId: routineItem.id,
            quantity: 6,
            unitPrice: 45.99,
            justification: 'Routine maintenance items'
          }
        ]
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${outgoingChiefToken}`)
        .send(requisitionData)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Submit requisition
      await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${outgoingChiefToken}`)
        .expect(200);

      // Create new chief engineer
      const newChiefEngineer = await prisma.user.create({
        data: {
          email: 'newchief@vessel.com',
          passwordHash: await hashPassword('NewChiefPass123!'),
          firstName: 'New',
          lastName: 'Chief',
          role: 'CHIEF_ENGINEER',
          emailVerified: true,
          isActive: true
        }
      });

      // Assign permissions to new chief
      const permissions = await prisma.permission.findMany();
      await Promise.all([
        prisma.userPermission.create({ 
          data: { 
            userId: newChiefEngineer.id, 
            permissionId: permissions.find(p => p.name === 'requisition:create')!.id 
          } 
        }),
        prisma.userPermission.create({ 
          data: { 
            userId: newChiefEngineer.id, 
            permissionId: permissions.find(p => p.name === 'requisition:approve')!.id 
          } 
        })
      ]);

      // Perform crew rotation
      const rotationResponse = await request(app)
        .post('/api/crew-rotation/transfer-responsibilities')
        .set('Authorization', `Bearer ${outgoingChiefToken}`)
        .send({
          outgoingUserId: chiefEngineer.id,
          incomingUserId: newChiefEngineer.id,
          vesselId: vessel.id,
          transferDate: new Date().toISOString(),
          pendingRequisitions: [requisitionId]
        })
        .expect(200);

      expect(rotationResponse.body.success).toBe(true);
      expect(rotationResponse.body.transferredRequisitions).toContain(requisitionId);

      // Assign new chief to vessel
      await prisma.vesselAssignment.create({
        data: {
          userId: newChiefEngineer.id,
          vesselId: vessel.id,
          role: 'CHIEF_ENGINEER',
          assignedAt: new Date()
        }
      });

      // New chief should be able to approve the requisition
      const newChiefToken = generateAccessToken(newChiefEngineer.id, [vessel.id], 'CHIEF_ENGINEER');
      
      const approvalResponse = await request(app)
        .post(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${newChiefToken}`)
        .send({
          comments: 'Approved by new chief engineer after rotation',
          approvalLevel: 'TECHNICAL'
        })
        .expect(200);

      expect(approvalResponse.body.success).toBe(true);
    });
  });

  describe('Offline Operations Scenario', () => {
    it('should handle offline requisition creation and sync', async () => {
      // Scenario: Vessel loses connectivity, crew creates requisitions offline
      const crewToken = generateAccessToken(crewMember.id, [vessel.id], 'CREW');

      // Simulate offline requisitions created during connectivity loss
      const offlineRequisitions = [
        {
          vesselId: vessel.id,
          urgencyLevel: 'ROUTINE',
          deliveryLocation: 'Port of Los Angeles',
          deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          justification: 'Created offline - routine maintenance',
          offlineCreatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
          offlineId: 'offline-req-001',
          items: [
            {
              itemId: routineItem.id,
              quantity: 4,
              unitPrice: 45.99,
              justification: 'Offline maintenance item'
            }
          ]
        },
        {
          vesselId: vessel.id,
          urgencyLevel: 'URGENT',
          deliveryLocation: 'Next Port',
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          justification: 'Created offline - urgent repair',
          offlineCreatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          offlineId: 'offline-req-002',
          items: [
            {
              itemId: routineItem.id,
              quantity: 8,
              unitPrice: 45.99,
              justification: 'Urgent repair items'
            }
          ]
        }
      ];

      // Sync offline requisitions when connectivity is restored
      const syncResponse = await request(app)
        .post('/api/requisitions/sync-offline-batch')
        .set('Authorization', `Bearer ${crewToken}`)
        .send({ requisitions: offlineRequisitions })
        .expect(200);

      expect(syncResponse.body.success).toBe(true);
      expect(syncResponse.body.syncedRequisitions).toHaveLength(2);
      expect(syncResponse.body.conflicts).toHaveLength(0);

      // Verify requisitions were created with offline metadata
      const syncedRequisitions = syncResponse.body.syncedRequisitions;
      
      for (const syncedReq of syncedRequisitions) {
        expect(syncedReq.offlineSync).toBe(true);
        expect(syncedReq.offlineCreatedAt).toBeDefined();
        expect(syncedReq.syncedAt).toBeDefined();
      }

      // Verify requisitions can be retrieved
      const retrieveResponse = await request(app)
        .get('/api/requisitions?offlineSync=true')
        .set('Authorization', `Bearer ${crewToken}`)
        .expect(200);

      expect(retrieveResponse.body.requisitions).toHaveLength(2);
    });

    it('should handle offline sync conflicts', async () => {
      const crewToken = generateAccessToken(crewMember.id, [vessel.id], 'CREW');

      // Create online requisition first
      const onlineRequisition = {
        vesselId: vessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Los Angeles',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Online requisition',
        items: [
          {
            itemId: routineItem.id,
            quantity: 2,
            unitPrice: 45.99,
            justification: 'Online item'
          }
        ]
      };

      const onlineResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${crewToken}`)
        .send(onlineRequisition)
        .expect(201);

      // Simulate offline requisition with same delivery date (potential conflict)
      const conflictingOfflineRequisition = {
        vesselId: vessel.id,
        urgencyLevel: 'ROUTINE',
        deliveryLocation: 'Port of Los Angeles',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // Same date
        justification: 'Offline requisition - potential conflict',
        offlineCreatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        offlineId: 'offline-conflict-001',
        items: [
          {
            itemId: routineItem.id,
            quantity: 10, // Different quantity
            unitPrice: 45.99,
            justification: 'Conflicting offline item'
          }
        ]
      };

      const syncResponse = await request(app)
        .post('/api/requisitions/sync-offline-batch')
        .set('Authorization', `Bearer ${crewToken}`)
        .send({ requisitions: [conflictingOfflineRequisition] })
        .expect(200);

      expect(syncResponse.body.success).toBe(true);
      expect(syncResponse.body.conflicts).toHaveLength(1);
      expect(syncResponse.body.conflicts[0].type).toBe('DELIVERY_DATE_CONFLICT');
      expect(syncResponse.body.conflicts[0].resolution).toBe('MERGED');
    });
  });

  describe('Port Delivery Coordination', () => {
    it('should coordinate delivery with port agents', async () => {
      const captainToken = generateAccessToken(captain.id, [vessel.id], 'CAPTAIN');

      // Create requisition with specific port delivery requirements
      const portDeliveryRequisition = {
        vesselId: vessel.id,
        urgencyLevel: 'URGENT',
        deliveryLocation: 'Port of Los Angeles - Terminal Island',
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Port delivery coordination test',
        portDeliveryRequirements: {
          portCode: 'USLAX',
          terminalCode: 'TI',
          berthNumber: 'B-47',
          contactPerson: 'Port Agent Smith',
          contactPhone: '+1-310-555-0123',
          deliveryWindow: {
            start: '08:00',
            end: '17:00'
          },
          specialInstructions: 'Deliver to engine room entrance, crane required'
        },
        items: [
          {
            itemId: emergencyItem.id,
            quantity: 1,
            unitPrice: 15000.00,
            justification: 'Port delivery item'
          }
        ]
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${captainToken}`)
        .send(portDeliveryRequisition)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.requisition.portDeliveryRequirements).toBeDefined();

      const requisitionId = createResponse.body.requisition.id;

      // Submit and approve requisition
      await request(app)
        .post(`/api/requisitions/${requisitionId}/submit`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      // Check port coordination status
      const coordinationResponse = await request(app)
        .get(`/api/requisitions/${requisitionId}/port-coordination`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      expect(coordinationResponse.body.portAgent).toBeDefined();
      expect(coordinationResponse.body.deliverySchedule).toBeDefined();
      expect(coordinationResponse.body.customsRequirements).toBeDefined();
    });
  });

  describe('Compliance and Audit Scenarios', () => {
    it('should maintain complete audit trail for emergency procedures', async () => {
      const captainToken = generateAccessToken(captain.id, [vessel.id], 'CAPTAIN');

      // Create and process emergency requisition
      const emergencyRequisition = {
        vesselId: vessel.id,
        urgencyLevel: 'EMERGENCY',
        deliveryLocation: 'Current Position',
        deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Emergency safety equipment replacement',
        emergencyReason: 'Fire detection system failure - SOLAS compliance critical',
        items: [
          {
            itemId: emergencyItem.id,
            quantity: 1,
            unitPrice: 15000.00,
            justification: 'Emergency fire pump replacement'
          }
        ]
      };

      const createResponse = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${captainToken}`)
        .send(emergencyRequisition)
        .expect(201);

      const requisitionId = createResponse.body.requisition.id;

      // Use emergency override
      await request(app)
        .post(`/api/requisitions/${requisitionId}/emergency-override`)
        .set('Authorization', `Bearer ${captainToken}`)
        .send({
          reason: 'Critical safety system failure',
          vesselPosition: { latitude: 35.6762, longitude: 139.6503 },
          witnessOfficer: chiefEngineer.id
        })
        .expect(200);

      // Check audit trail
      const auditResponse = await request(app)
        .get(`/api/audit/requisition/${requisitionId}`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      expect(auditResponse.body.auditTrail).toBeDefined();
      expect(auditResponse.body.auditTrail.length).toBeGreaterThan(0);
      
      const emergencyOverrideAudit = auditResponse.body.auditTrail.find(
        (entry: any) => entry.action === 'EMERGENCY_OVERRIDE'
      );
      
      expect(emergencyOverrideAudit).toBeDefined();
      expect(emergencyOverrideAudit.userId).toBe(captain.id);
      expect(emergencyOverrideAudit.metadata.reason).toBeDefined();
      expect(emergencyOverrideAudit.metadata.vesselPosition).toBeDefined();
    });

    it('should generate compliance reports for maritime authorities', async () => {
      const superintendentToken = generateAccessToken(superintendent.id, [vessel.id], 'SUPERINTENDENT');

      // Generate SOLAS compliance report
      const solasReportResponse = await request(app)
        .get('/api/compliance/solas-report')
        .query({
          vesselId: vessel.id,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        })
        .set('Authorization', `Bearer ${superintendentToken}`)
        .expect(200);

      expect(solasReportResponse.body.complianceReport).toBeDefined();
      expect(solasReportResponse.body.safetyEquipmentProcurements).toBeDefined();
      expect(solasReportResponse.body.emergencyProcedures).toBeDefined();

      // Generate ISM compliance report
      const ismReportResponse = await request(app)
        .get('/api/compliance/ism-report')
        .query({
          vesselId: vessel.id,
          reportPeriod: 'QUARTERLY'
        })
        .set('Authorization', `Bearer ${superintendentToken}`)
        .expect(200);

      expect(ismReportResponse.body.ismCompliance).toBeDefined();
      expect(ismReportResponse.body.procurementProcedures).toBeDefined();
      expect(ismReportResponse.body.documentControl).toBeDefined();
    });
  });
});