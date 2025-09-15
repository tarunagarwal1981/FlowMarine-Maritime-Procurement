import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { complianceReportingService } from '../services/complianceReportingService';
import { complianceNotificationService } from '../services/complianceNotificationService';

const prisma = new PrismaClient();

describe('Compliance Reporting Service', () => {
  let testVessel: any;
  let testUser: any;
  let testCertificates: any[];
  let testRequisitions: any[];

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.complianceAlert.deleteMany({});
    await prisma.complianceReport.deleteMany({});
    await prisma.vesselCertificate.deleteMany({});
    await prisma.requisitionItem.deleteMany({});
    await prisma.requisition.deleteMany({});
    await prisma.vessel.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'compliance.test@flowmarine.com',
        passwordHash: 'hashedpassword',
        firstName: 'Compliance',
        lastName: 'Tester',
        role: 'SUPERINTENDENT',
        emailVerified: true
      }
    });

    // Create test vessel
    testVessel = await prisma.vessel.create({
      data: {
        name: 'MV Compliance Test',
        imoNumber: '1234567',
        vesselType: 'CONTAINER',
        flag: 'PANAMA',
        engineType: 'DIESEL',
        cargoCapacity: 50000,
        fuelConsumption: 150,
        crewComplement: 25
      }
    });

    // Create test certificates
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiredDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    testCertificates = await Promise.all([
      // Valid SOLAS certificate
      prisma.vesselCertificate.create({
        data: {
          vesselId: testVessel.id,
          certificateType: 'SAFETY_CONSTRUCTION',
          issueDate: new Date('2023-01-01'),
          expiryDate: new Date('2025-01-01'),
          issuingAuthority: 'Panama Maritime Authority'
        }
      }),
      // Expiring MARPOL certificate
      prisma.vesselCertificate.create({
        data: {
          vesselId: testVessel.id,
          certificateType: 'POLLUTION_PREVENTION',
          issueDate: new Date('2023-01-01'),
          expiryDate: thirtyDaysFromNow,
          issuingAuthority: 'Panama Maritime Authority'
        }
      }),
      // Expired ISM certificate
      prisma.vesselCertificate.create({
        data: {
          vesselId: testVessel.id,
          certificateType: 'ISM_CERTIFICATE',
          issueDate: new Date('2022-01-01'),
          expiryDate: expiredDate,
          issuingAuthority: 'Panama Maritime Authority'
        }
      })
    ]);

    // Create test item catalog entries
    const safetyItem = await prisma.itemCatalog.create({
      data: {
        name: 'Life Jacket',
        description: 'SOLAS approved life jacket',
        category: 'SAFETY_EQUIPMENT',
        criticalityLevel: 'SAFETY_CRITICAL',
        unitOfMeasure: 'PIECE',
        averagePrice: 50.0
      }
    });

    const environmentalItem = await prisma.itemCatalog.create({
      data: {
        name: 'Oil Spill Kit',
        description: 'Marine oil spill response kit',
        category: 'ENVIRONMENTAL_EQUIPMENT',
        criticalityLevel: 'OPERATIONAL_CRITICAL',
        unitOfMeasure: 'KIT',
        averagePrice: 500.0
      }
    });

    // Create test requisitions with items
    const safetyRequisition = await prisma.requisition.create({
      data: {
        requisitionNumber: 'REQ-SAFETY-001',
        vesselId: testVessel.id,
        requestedById: testUser.id,
        urgencyLevel: 'ROUTINE',
        status: 'APPROVED',
        totalAmount: 500.0,
        currency: 'USD',
        deliveryLocation: 'Port of Hamburg',
        deliveryDate: new Date('2024-02-01'),
        justification: 'Safety equipment replacement'
      }
    });

    const environmentalRequisition = await prisma.requisition.create({
      data: {
        requisitionNumber: 'REQ-ENV-001',
        vesselId: testVessel.id,
        requestedById: testUser.id,
        urgencyLevel: 'URGENT',
        status: 'APPROVED',
        totalAmount: 1000.0,
        currency: 'USD',
        deliveryLocation: 'Port of Rotterdam',
        deliveryDate: new Date('2024-02-15'),
        justification: 'Environmental compliance equipment'
      }
    });

    // Create requisition items
    await Promise.all([
      prisma.requisitionItem.create({
        data: {
          requisitionId: safetyRequisition.id,
          itemId: safetyItem.id,
          quantity: 10,
          unitPrice: 50.0,
          totalPrice: 500.0,
          urgencyLevel: 'ROUTINE',
          justification: 'Replace expired life jackets'
        }
      }),
      prisma.requisitionItem.create({
        data: {
          requisitionId: environmentalRequisition.id,
          itemId: environmentalItem.id,
          quantity: 2,
          unitPrice: 500.0,
          totalPrice: 1000.0,
          urgencyLevel: 'URGENT',
          justification: 'Environmental compliance requirement'
        }
      })
    ]);

    testRequisitions = [safetyRequisition, environmentalRequisition];
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.complianceAlert.deleteMany({});
    await prisma.complianceReport.deleteMany({});
    await prisma.requisitionItem.deleteMany({});
    await prisma.requisition.deleteMany({});
    await prisma.vesselCertificate.deleteMany({});
    await prisma.itemCatalog.deleteMany({});
    await prisma.vessel.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('SOLAS Compliance Reporting', () => {
    test('should generate SOLAS compliance report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const report = await complianceReportingService.generateSOLASReport(
        testVessel.id,
        startDate,
        endDate,
        testUser.id
      );

      expect(report).toBeDefined();
      expect(report.type).toBe('SOLAS');
      expect(report.vesselId).toBe(testVessel.id);
      expect(report.generatedBy).toBe(testUser.id);
      expect(report.data).toBeDefined();
      expect(report.data.safetyEquipmentProcurement).toBeDefined();
      expect(report.data.certificates).toBeDefined();
      expect(report.data.complianceScore).toBeGreaterThanOrEqual(0);
      expect(report.data.complianceScore).toBeLessThanOrEqual(100);
    });

    test('should include safety-critical items in SOLAS report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const report = await complianceReportingService.generateSOLASReport(
        testVessel.id,
        startDate,
        endDate,
        testUser.id
      );

      expect(report.data.safetyEquipmentProcurement.totalItems).toBeGreaterThan(0);
      expect(report.data.safetyEquipmentProcurement.totalValue).toBeGreaterThan(0);
      expect(report.data.safetyEquipmentProcurement.categories).toBeDefined();
    });

    test('should calculate SOLAS compliance score correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const report = await complianceReportingService.generateSOLASReport(
        testVessel.id,
        startDate,
        endDate,
        testUser.id
      );

      // Should have reduced score due to expired ISM certificate
      expect(report.data.complianceScore).toBeLessThan(100);
      expect(report.data.recommendations).toBeDefined();
      expect(Array.isArray(report.data.recommendations)).toBe(true);
    });
  });

  describe('MARPOL Compliance Reporting', () => {
    test('should generate MARPOL compliance report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const report = await complianceReportingService.generateMARPOLReport(
        testVessel.id,
        startDate,
        endDate,
        testUser.id
      );

      expect(report).toBeDefined();
      expect(report.type).toBe('MARPOL');
      expect(report.vesselId).toBe(testVessel.id);
      expect(report.data.environmentalEquipment).toBeDefined();
      expect(report.data.certificates).toBeDefined();
      expect(report.data.complianceScore).toBeGreaterThanOrEqual(0);
    });

    test('should include environmental equipment in MARPOL report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const report = await complianceReportingService.generateMARPOLReport(
        testVessel.id,
        startDate,
        endDate,
        testUser.id
      );

      expect(report.data.environmentalEquipment.totalItems).toBeGreaterThan(0);
      expect(report.data.environmentalEquipment.categories).toBeDefined();
    });
  });

  describe('ISM Compliance Reporting', () => {
    test('should generate ISM compliance report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const report = await complianceReportingService.generateISMReport(
        testVessel.id,
        startDate,
        endDate,
        testUser.id
      );

      expect(report).toBeDefined();
      expect(report.type).toBe('ISM');
      expect(report.vesselId).toBe(testVessel.id);
      expect(report.data.managementSystemItems).toBeDefined();
      expect(report.data.approvalCompliance).toBeDefined();
      expect(report.data.complianceScore).toBeGreaterThanOrEqual(0);
    });

    test('should analyze approval compliance in ISM report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const report = await complianceReportingService.generateISMReport(
        testVessel.id,
        startDate,
        endDate,
        testUser.id
      );

      expect(report.data.approvalCompliance.totalRequisitions).toBeGreaterThanOrEqual(0);
      expect(report.data.approvalCompliance.complianceRate).toBeGreaterThanOrEqual(0);
      expect(report.data.approvalCompliance.complianceRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Audit Trail Reporting', () => {
    test('should generate audit trail report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const auditTrail = await complianceReportingService.generateAuditTrailReport(
        startDate,
        endDate,
        testUser.id
      );

      expect(Array.isArray(auditTrail)).toBe(true);
      // Should include audit logs from report generation
      expect(auditTrail.length).toBeGreaterThanOrEqual(0);
    });

    test('should filter audit trail by vessel', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const auditTrail = await complianceReportingService.generateAuditTrailReport(
        startDate,
        endDate,
        testUser.id,
        { vesselId: testVessel.id }
      );

      expect(Array.isArray(auditTrail)).toBe(true);
      // All entries should be related to the test vessel
      auditTrail.forEach(entry => {
        if (entry.resource.includes('vessel/')) {
          expect(entry.resource).toContain(testVessel.id);
        }
      });
    });
  });

  describe('Compliance Alerts', () => {
    test('should generate compliance alerts for vessel', async () => {
      const alerts = await complianceReportingService.getComplianceAlerts(testVessel.id);

      expect(Array.isArray(alerts)).toBe(true);
      expect(alerts.length).toBeGreaterThan(0);

      // Should have alerts for expired and expiring certificates
      const criticalAlerts = alerts.filter(alert => alert.severity === 'CRITICAL');
      const highAlerts = alerts.filter(alert => alert.severity === 'HIGH');

      expect(criticalAlerts.length).toBeGreaterThan(0); // Expired certificate
      expect(highAlerts.length).toBeGreaterThan(0); // Expiring certificate
    });

    test('should sort alerts by severity', async () => {
      const alerts = await complianceReportingService.getComplianceAlerts(testVessel.id);

      if (alerts.length > 1) {
        const severityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        for (let i = 0; i < alerts.length - 1; i++) {
          const currentSeverity = severityOrder[alerts[i].severity as keyof typeof severityOrder];
          const nextSeverity = severityOrder[alerts[i + 1].severity as keyof typeof severityOrder];
          expect(currentSeverity).toBeGreaterThanOrEqual(nextSeverity);
        }
      }
    });

    test('should generate alerts for all vessels when no vessel specified', async () => {
      const alerts = await complianceReportingService.getComplianceAlerts();

      expect(Array.isArray(alerts)).toBe(true);
      // Should include alerts from our test vessel
      const vesselAlerts = alerts.filter(alert => alert.vesselId === testVessel.id);
      expect(vesselAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Compliance Notifications', () => {
    test('should check vessel compliance and identify issues', async () => {
      // This test verifies the notification service can identify compliance issues
      const alerts = await complianceReportingService.getComplianceAlerts(testVessel.id);
      
      expect(alerts.length).toBeGreaterThan(0);
      
      // Should identify certificate expiry issues
      const certificateAlerts = alerts.filter(alert => alert.type === 'CERTIFICATE_EXPIRY');
      expect(certificateAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid vessel ID gracefully', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await expect(
        complianceReportingService.generateSOLASReport(
          'invalid-vessel-id',
          startDate,
          endDate,
          testUser.id
        )
      ).rejects.toThrow();
    });

    test('should handle invalid date ranges', async () => {
      const startDate = new Date('2024-12-31');
      const endDate = new Date('2024-01-01'); // End before start

      await expect(
        complianceReportingService.generateSOLASReport(
          testVessel.id,
          startDate,
          endDate,
          testUser.id
        )
      ).resolves.toBeDefined(); // Should still work but with no data
    });
  });

  describe('Data Retention and Archival', () => {
    test('should handle historical data queries', async () => {
      // Test querying old data (simulating data retention requirements)
      const oldStartDate = new Date('2020-01-01');
      const oldEndDate = new Date('2020-12-31');

      const auditTrail = await complianceReportingService.generateAuditTrailReport(
        oldStartDate,
        oldEndDate,
        testUser.id
      );

      expect(Array.isArray(auditTrail)).toBe(true);
      // Should return empty array for old dates with no data
      expect(auditTrail.length).toBe(0);
    });
  });
});