import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { prisma } from '@/config/database';
import { generateTestToken, createTestUser, createTestVessel } from '../helpers/testHelpers';

describe('Maritime Emergency Scenarios', () => {
  let captainToken: string;
  let chiefEngineerToken: string;
  let superintendentToken: string;
  let testVessel: any;
  let captainUser: any;
  let chiefEngineerUser: any;
  let superintendentUser: any;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create test users with different roles
    captainUser = await createTestUser({
      role: 'CAPTAIN',
      permissions: ['EMERGENCY_OVERRIDE', 'APPROVE_EMERGENCY_REQUISITION'],
    });

    chiefEngineerUser = await createTestUser({
      role: 'CHIEF_ENGINEER',
      permissions: ['CREATE_EMERGENCY_REQUISITION', 'TECHNICAL_APPROVAL'],
    });

    superintendentUser = await createTestUser({
      role: 'SUPERINTENDENT',
      permissions: ['APPROVE_REQUISITION', 'MANAGE_VESSEL_OPERATIONS'],
    });

    testVessel = await createTestVessel({
      name: 'MV Emergency Test',
      imoNumber: '9876543',
      currentPosition: { latitude: 35.6762, longitude: 139.6503 }, // Tokyo Bay
      vesselType: 'CONTAINER_SHIP',
      engineType: 'MAN_B&W',
    });

    // Assign users to vessel
    await Promise.all([
      prisma.vesselAssignment.create({
        data: { userId: captainUser.id, vesselId: testVessel.id, role: 'CAPTAIN' },
      }),
      prisma.vesselAssignment.create({
        data: { userId: chiefEngineerUser.id, vesselId: testVessel.id, role: 'CHIEF_ENGINEER' },
      }),
      prisma.vesselAssignment.create({
        data: { userId: superintendentUser.id, vesselId: testVessel.id, role: 'SUPERINTENDENT' },
      }),
    ]);

    captainToken = generateTestToken(captainUser);
    chiefEngineerToken = generateTestToken(chiefEngineerUser);
    superintendentToken = generateTestToken(superintendentUser);
  });

  afterEach(async () => {
    await prisma.emergencyOverride.deleteMany();
    await prisma.requisition.deleteMany();
    await prisma.vesselAssignment.deleteMany();
    await prisma.vessel.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Critical Engine Failure Scenario', () => {
    it('should handle emergency requisition for critical engine parts', async () => {
      const emergencyRequisition = {
        vesselId: testVessel.id,
        urgencyLevel: 'EMERGENCY',
        emergencyType: 'ENGINE_FAILURE',
        description: 'Main engine bearing failure - vessel dead in water',
        items: [
          {
            itemId: 'bearing-main-001',
            name: 'Main Engine Bearing Set',
            quantity: 1,
            estimatedPrice: 25000,
            specifications: 'MAN B&W 6S60MC-C bearing set',
            criticalityLevel: 'SAFETY_CRITICAL',
            reason: 'Main engine seized, bearing replacement required immediately',
          },
          {
            itemId: 'gasket-set-001',
            name: 'Engine Gasket Set',
            quantity: 1,
            estimatedPrice: 3000,
            specifications: 'Complete gasket set for MAN B&W 6S60MC-C',
            criticalityLevel: 'OPERATIONAL_CRITICAL',
            reason: 'Required for bearing replacement',
          },
        ],
        vesselPosition: {
          latitude: 35.6762,
          longitude: 139.6503,
          timestamp: new Date(),
        },
        nearestPorts: ['TOKYO', 'YOKOHAMA'],
        estimatedRepairTime: '48 hours',
        safetyImpact: 'Vessel unable to maneuver, potential collision risk',
        environmentalImpact: 'None at present, monitoring for oil leaks',
      };

      const response = await request(app)
        .post('/api/requisitions/emergency')
        .set('Authorization', `Bearer ${chiefEngineerToken}`)
        .send(emergencyRequisition)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.urgencyLevel).toBe('EMERGENCY');
      expect(response.body.data.status).toBe('EMERGENCY_PENDING');
      expect(response.body.data.emergencyCode).toMatch(/^EMG-\d{4}-\d{3}$/);
      expect(response.body.data.autoNotifications).toContain('CAPTAIN');
      expect(response.body.data.autoNotifications).toContain('SUPERINTENDENT');
    });

    it('should allow captain emergency override for immediate procurement', async () => {
      // First create emergency requisition
      const requisition = await prisma.requisition.create({
        data: {
          requisitionNumber: 'REQ-EMG-001',
          vesselId: testVessel.id,
          requestedById: chiefEngineerUser.id,
          urgencyLevel: 'EMERGENCY',
          status: 'EMERGENCY_PENDING',
          totalAmount: 28000,
          currency: 'USD',
          emergencyType: 'ENGINE_FAILURE',
          items: {
            create: [
              {
                itemId: 'bearing-main-001',
                quantity: 1,
                unitPrice: 25000,
                totalPrice: 25000,
                specifications: 'MAN B&W 6S60MC-C bearing set',
              },
            ],
          },
        },
      });

      const emergencyOverride = {
        requisitionId: requisition.id,
        overrideReason: 'Vessel safety critical - immediate procurement required to prevent collision',
        safetyJustification: 'Dead ship situation in busy shipping lane',
        estimatedDelay: 'Every hour increases collision risk',
        alternativeOptions: 'None - nearest shipyard 200nm away',
        postApprovalRequired: true,
        notifyManagement: true,
        vesselPosition: {
          latitude: 35.6762,
          longitude: 139.6503,
          timestamp: new Date(),
        },
      };

      const response = await request(app)
        .post('/api/emergency-override')
        .set('Authorization', `Bearer ${captainToken}`)
        .send(emergencyOverride)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('EMERGENCY_APPROVED');
      expect(response.body.data.overrideCode).toMatch(/^OVR-\d{4}-\d{3}$/);
      expect(response.body.data.requiresPostApproval).toBe(true);
      expect(response.body.data.managementNotified).toBe(true);
    });

    it('should automatically generate RFQ to nearest qualified vendors', async () => {
      const approvedEmergencyReq = await prisma.requisition.create({
        data: {
          requisitionNumber: 'REQ-EMG-002',
          vesselId: testVessel.id,
          requestedById: chiefEngineerUser.id,
          urgencyLevel: 'EMERGENCY',
          status: 'EMERGENCY_APPROVED',
          totalAmount: 28000,
          currency: 'USD',
          emergencyType: 'ENGINE_FAILURE',
        },
      });

      const rfqData = {
        requisitionId: approvedEmergencyReq.id,
        emergencyProcurement: true,
        maxResponseTime: 2, // hours
        deliveryRequirements: {
          urgentDelivery: true,
          helicopterDelivery: true,
          vesselPosition: { latitude: 35.6762, longitude: 139.6503 },
          maxDeliveryTime: 24, // hours
        },
        vendorSelectionCriteria: {
          maxDistance: 500, // km
          emergencyCapability: true,
          engineSpecialization: 'MAN_B&W',
          certifications: ['EMERGENCY_SUPPLIER'],
        },
      };

      const response = await request(app)
        .post('/api/rfqs/emergency')
        .set('Authorization', `Bearer ${captainToken}`)
        .send(rfqData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.emergencyRFQ).toBe(true);
      expect(response.body.data.responseDeadline).toBeDefined();
      expect(response.body.data.selectedVendors.length).toBeGreaterThan(0);
      expect(response.body.data.deliveryOptions).toContain('HELICOPTER');
    });
  });

  describe('Fire Emergency Scenario', () => {
    it('should handle fire suppression equipment emergency', async () => {
      const fireEmergency = {
        vesselId: testVessel.id,
        urgencyLevel: 'EMERGENCY',
        emergencyType: 'FIRE',
        description: 'Engine room fire - CO2 system discharged, need immediate replacement',
        items: [
          {
            itemId: 'co2-bottles-001',
            name: 'CO2 Fire Suppression Bottles',
            quantity: 12,
            estimatedPrice: 15000,
            specifications: '45kg CO2 bottles with valves',
            criticalityLevel: 'SAFETY_CRITICAL',
            reason: 'Fire suppression system empty after discharge',
          },
          {
            itemId: 'fire-suits-001',
            name: 'Emergency Fire Suits',
            quantity: 6,
            estimatedPrice: 3000,
            specifications: 'SOLAS approved fire suits size M-XL',
            criticalityLevel: 'SAFETY_CRITICAL',
            reason: 'Current suits damaged in fire',
          },
        ],
        safetyStatus: 'FIRE_EXTINGUISHED',
        crewSafety: 'ALL_CREW_SAFE',
        vesselCondition: 'OPERATIONAL_WITH_RESTRICTIONS',
        complianceImpact: 'SOLAS_NON_COMPLIANT_WITHOUT_FIRE_SYSTEM',
      };

      const response = await request(app)
        .post('/api/requisitions/emergency')
        .set('Authorization', `Bearer ${captainToken}`)
        .send(fireEmergency)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.complianceFlags).toContain('SOLAS_FIRE_SAFETY');
      expect(response.body.data.portStateControlAlert).toBe(true);
      expect(response.body.data.recommendedAction).toBe('IMMEDIATE_PORT_ENTRY');
    });

    it('should coordinate with port authorities for emergency entry', async () => {
      const portCoordination = {
        vesselId: testVessel.id,
        emergencyType: 'FIRE',
        requestType: 'EMERGENCY_PORT_ENTRY',
        targetPort: 'TOKYO',
        vesselCondition: 'FIRE_DAMAGE_ENGINE_ROOM',
        crewStatus: 'ALL_SAFE',
        pollutionRisk: 'LOW',
        cargoStatus: 'SECURE',
        assistanceRequired: ['FIRE_BRIGADE', 'MARINE_SURVEYOR', 'EMERGENCY_SUPPLIES'],
        eta: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
      };

      const response = await request(app)
        .post('/api/emergency/port-coordination')
        .set('Authorization', `Bearer ${captainToken}`)
        .send(portCoordination)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.portAuthority).toBe('TOKYO_PORT_AUTHORITY');
      expect(response.body.data.emergencyBerth).toBeDefined();
      expect(response.body.data.supportServices).toContain('FIRE_BRIGADE');
    });
  });

  describe('Medical Emergency Scenario', () => {
    it('should handle medical emergency with helicopter evacuation', async () => {
      const medicalEmergency = {
        vesselId: testVessel.id,
        urgencyLevel: 'EMERGENCY',
        emergencyType: 'MEDICAL',
        description: 'Crew member serious injury - requires immediate medical evacuation',
        medicalDetails: {
          patientCondition: 'SERIOUS_INJURY',
          injuryType: 'HEAD_TRAUMA',
          consciousness: 'CONSCIOUS',
          vitalSigns: 'STABLE',
          firstAidProvided: true,
          medicationRequired: ['PAIN_RELIEF', 'ANTIBIOTICS'],
        },
        evacuationRequest: {
          method: 'HELICOPTER',
          urgency: 'IMMEDIATE',
          weatherConditions: 'SUITABLE',
          deckSpace: 'AVAILABLE',
          landingCoordinates: { latitude: 35.6762, longitude: 139.6503 },
        },
        medicalSupplies: [
          {
            itemId: 'morphine-001',
            name: 'Morphine Injection',
            quantity: 5,
            estimatedPrice: 500,
            specifications: '10mg/ml ampoules',
            criticalityLevel: 'SAFETY_CRITICAL',
            reason: 'Pain management for injured crew member',
          },
        ],
      };

      const response = await request(app)
        .post('/api/emergency/medical')
        .set('Authorization', `Bearer ${captainToken}`)
        .send(medicalEmergency)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.evacuationCoordinated).toBe(true);
      expect(response.body.data.coastGuardNotified).toBe(true);
      expect(response.body.data.medicalSuppliesRush).toBe(true);
      expect(response.body.data.estimatedHelicopterArrival).toBeDefined();
    });
  });

  describe('Collision Damage Scenario', () => {
    it('should handle collision damage assessment and emergency repairs', async () => {
      const collisionDamage = {
        vesselId: testVessel.id,
        urgencyLevel: 'EMERGENCY',
        emergencyType: 'COLLISION',
        description: 'Minor collision with fishing vessel - hull damage above waterline',
        damageAssessment: {
          location: 'STARBOARD_BOW',
          severity: 'MODERATE',
          waterIngress: false,
          structuralIntegrity: 'COMPROMISED_NON_CRITICAL',
          safetyRisk: 'LOW',
          operationalImpact: 'MINIMAL',
        },
        repairRequirements: [
          {
            itemId: 'steel-plates-001',
            name: 'Steel Repair Plates',
            quantity: 10,
            estimatedPrice: 5000,
            specifications: 'Grade A steel plates 10mm thickness',
            criticalityLevel: 'OPERATIONAL_CRITICAL',
            reason: 'Temporary hull repair',
          },
          {
            itemId: 'welding-rods-001',
            name: 'Welding Electrodes',
            quantity: 50,
            estimatedPrice: 1000,
            specifications: 'E7018 welding rods 3.2mm',
            criticalityLevel: 'OPERATIONAL_CRITICAL',
            reason: 'Hull plate welding',
          },
        ],
        regulatoryRequirements: {
          classificationSurvey: true,
          flagStateNotification: true,
          portStateInspection: true,
          insuranceNotification: true,
        },
      };

      const response = await request(app)
        .post('/api/emergency/collision')
        .set('Authorization', `Bearer ${captainToken}`)
        .send(collisionDamage)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classificationSocietyNotified).toBe(true);
      expect(response.body.data.flagStateNotified).toBe(true);
      expect(response.body.data.repairPlan).toBeDefined();
      expect(response.body.data.surveyRequired).toBe(true);
    });
  });

  describe('Piracy/Security Threat Scenario', () => {
    it('should handle security threat with emergency supplies', async () => {
      const securityThreat = {
        vesselId: testVessel.id,
        urgencyLevel: 'EMERGENCY',
        emergencyType: 'SECURITY_THREAT',
        description: 'Transiting high-risk area - need additional security equipment',
        threatLevel: 'HIGH',
        location: 'GULF_OF_ADEN',
        securityMeasures: {
          armedGuards: true,
          citadelProcedure: true,
          communicationProtocol: 'ENHANCED',
          routeDeviation: false,
        },
        emergencySupplies: [
          {
            itemId: 'razor-wire-001',
            name: 'Razor Wire Barriers',
            quantity: 500, // meters
            estimatedPrice: 2000,
            specifications: 'Galvanized razor wire 450mm coils',
            criticalityLevel: 'SAFETY_CRITICAL',
            reason: 'Perimeter security enhancement',
          },
          {
            itemId: 'flares-001',
            name: 'Distress Flares',
            quantity: 24,
            estimatedPrice: 800,
            specifications: 'SOLAS approved parachute flares',
            criticalityLevel: 'SAFETY_CRITICAL',
            reason: 'Emergency signaling',
          },
        ],
      };

      const response = await request(app)
        .post('/api/emergency/security')
        .set('Authorization', `Bearer ${captainToken}`)
        .send(securityThreat)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.navyNotified).toBe(true);
      expect(response.body.data.securityLevel).toBe('MARSEC_3');
      expect(response.body.data.escortRecommended).toBe(true);
    });
  });

  describe('Weather Emergency Scenario', () => {
    it('should handle severe weather damage and emergency repairs', async () => {
      const weatherDamage = {
        vesselId: testVessel.id,
        urgencyLevel: 'EMERGENCY',
        emergencyType: 'WEATHER_DAMAGE',
        description: 'Typhoon damage - container lashings failed, deck equipment damaged',
        weatherConditions: {
          event: 'TYPHOON',
          windSpeed: 85, // knots
          waveHeight: 12, // meters
          visibility: 'POOR',
          currentConditions: 'IMPROVING',
        },
        damageReport: {
          containerLashings: 'MULTIPLE_FAILURES',
          deckEquipment: 'DAMAGED',
          bridgeWindows: 'CRACKED',
          navigationEquipment: 'OPERATIONAL',
          safetyEquipment: 'NEEDS_INSPECTION',
        },
        emergencyRepairs: [
          {
            itemId: 'lashing-chains-001',
            name: 'Container Lashing Chains',
            quantity: 20,
            estimatedPrice: 8000,
            specifications: 'Grade 80 lashing chains 13mm',
            criticalityLevel: 'SAFETY_CRITICAL',
            reason: 'Secure loose containers',
          },
          {
            itemId: 'tarpaulins-001',
            name: 'Heavy Duty Tarpaulins',
            quantity: 10,
            estimatedPrice: 2000,
            specifications: 'Waterproof PVC tarpaulins 6x8m',
            criticalityLevel: 'OPERATIONAL_CRITICAL',
            reason: 'Weather protection for damaged areas',
          },
        ],
      };

      const response = await request(app)
        .post('/api/emergency/weather')
        .set('Authorization', `Bearer ${captainToken}`)
        .send(weatherDamage)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.weatherRouting).toBeDefined();
      expect(response.body.data.nearestShelter).toBeDefined();
      expect(response.body.data.cargoSecurityPlan).toBeDefined();
    });
  });

  describe('Emergency Workflow Integration', () => {
    it('should integrate emergency requisition with complete workflow', async () => {
      // 1. Create emergency requisition
      const emergencyReq = await request(app)
        .post('/api/requisitions/emergency')
        .set('Authorization', `Bearer ${chiefEngineerToken}`)
        .send({
          vesselId: testVessel.id,
          urgencyLevel: 'EMERGENCY',
          emergencyType: 'ENGINE_FAILURE',
          description: 'Critical engine failure',
          items: [
            {
              itemId: 'emergency-part-001',
              name: 'Emergency Engine Part',
              quantity: 1,
              estimatedPrice: 15000,
              criticalityLevel: 'SAFETY_CRITICAL',
            },
          ],
        })
        .expect(201);

      const requisitionId = emergencyReq.body.data.id;

      // 2. Captain emergency override
      await request(app)
        .post('/api/emergency-override')
        .set('Authorization', `Bearer ${captainToken}`)
        .send({
          requisitionId,
          overrideReason: 'Safety critical situation',
          safetyJustification: 'Immediate procurement required',
        })
        .expect(200);

      // 3. Auto-generate emergency RFQ
      const rfqResponse = await request(app)
        .post('/api/rfqs/emergency')
        .set('Authorization', `Bearer ${captainToken}`)
        .send({
          requisitionId,
          emergencyProcurement: true,
          maxResponseTime: 2,
        })
        .expect(201);

      // 4. Verify emergency workflow completion
      const workflowStatus = await request(app)
        .get(`/api/emergency/workflow-status/${requisitionId}`)
        .set('Authorization', `Bearer ${captainToken}`)
        .expect(200);

      expect(workflowStatus.body.data.emergencyApproved).toBe(true);
      expect(workflowStatus.body.data.rfqGenerated).toBe(true);
      expect(workflowStatus.body.data.vendorsNotified).toBe(true);
      expect(workflowStatus.body.data.managementAlerted).toBe(true);
    });

    it('should handle post-emergency approval documentation', async () => {
      const emergencyOverride = await prisma.emergencyOverride.create({
        data: {
          overrideCode: 'OVR-2024-001',
          requisitionId: 'req-123',
          authorizedById: captainUser.id,
          vesselId: testVessel.id,
          reason: 'Critical engine failure',
          status: 'APPROVED',
          requiresPostApproval: true,
        },
      });

      const postApprovalDoc = {
        overrideId: emergencyOverride.id,
        detailedJustification: 'Main engine bearing failure caused complete loss of propulsion in busy shipping lane',
        alternativesConsidered: 'Anchoring not possible due to water depth and traffic',
        costBenefit: 'Emergency procurement cost $25,000 vs potential collision damage $2M+',
        lessonsLearned: 'Increase bearing inspection frequency, maintain emergency spares',
        preventiveMeasures: 'Enhanced maintenance schedule, additional spare parts inventory',
        supportingDocuments: ['engine-log.pdf', 'damage-photos.zip', 'weather-report.pdf'],
      };

      const response = await request(app)
        .post('/api/emergency/post-approval-documentation')
        .set('Authorization', `Bearer ${superintendentToken}`)
        .send(postApprovalDoc)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.documentationComplete).toBe(true);
      expect(response.body.data.auditTrailUpdated).toBe(true);
    });
  });
});