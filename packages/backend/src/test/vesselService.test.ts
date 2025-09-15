import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { vesselService } from '../services/vesselService.js';
import { auditService } from '../services/auditService.js';

// Mock Prisma
vi.mock('@prisma/client');
vi.mock('../services/auditService.js');

const mockPrisma = {
  vessel: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  vesselCertificate: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  vesselSpecification: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
} as any;

vi.mocked(PrismaClient).mockImplementation(() => mockPrisma);

const mockAuditService = vi.mocked(auditService);

describe('VesselService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createVessel', () => {
    it('should create a vessel successfully', async () => {
      const vesselData = {
        name: 'Test Vessel',
        imoNumber: '1234567',
        vesselType: 'Container Ship',
        flag: 'Panama',
        engineType: 'Diesel',
        cargoCapacity: 50000,
        fuelConsumption: 200,
        crewComplement: 25,
        currentLatitude: 40.7128,
        currentLongitude: -74.0060,
      };

      const mockVessel = {
        id: 'vessel-1',
        ...vesselData,
        positionUpdatedAt: new Date(),
        certificates: [],
        specifications: [],
        assignments: [],
      };

      mockPrisma.vessel.create.mockResolvedValue(mockVessel);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await vesselService.createVessel(vesselData, 'user-1');

      expect(mockPrisma.vessel.create).toHaveBeenCalledWith({
        data: {
          ...vesselData,
          positionUpdatedAt: expect.any(Date),
        },
        include: {
          certificates: true,
          specifications: true,
          assignments: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'CREATE',
        resource: 'vessel',
        resourceId: 'vessel-1',
        newValues: vesselData,
      });

      expect(result).toEqual(mockVessel);
    });

    it('should handle creation errors', async () => {
      const vesselData = {
        name: 'Test Vessel',
        imoNumber: '1234567',
        vesselType: 'Container Ship',
        flag: 'Panama',
        engineType: 'Diesel',
        cargoCapacity: 50000,
        fuelConsumption: 200,
        crewComplement: 25,
      };

      const error = new Error('Database error');
      mockPrisma.vessel.create.mockRejectedValue(error);

      await expect(vesselService.createVessel(vesselData, 'user-1')).rejects.toThrow('Database error');
    });
  });

  describe('getVesselById', () => {
    it('should return vessel with all related data', async () => {
      const mockVessel = {
        id: 'vessel-1',
        name: 'Test Vessel',
        imoNumber: '1234567',
        certificates: [
          {
            id: 'cert-1',
            certificateType: 'Safety Certificate',
            expiryDate: new Date('2024-12-31'),
          },
        ],
        specifications: [
          {
            id: 'spec-1',
            category: 'Engine',
            specification: 'Power',
            value: '10000',
            unit: 'HP',
          },
        ],
        assignments: [
          {
            id: 'assign-1',
            isActive: true,
            user: {
              id: 'user-1',
              firstName: 'John',
              lastName: 'Doe',
              role: 'CAPTAIN',
              email: 'john@example.com',
            },
          },
        ],
        requisitions: [],
      };

      mockPrisma.vessel.findUnique.mockResolvedValue(mockVessel);

      const result = await vesselService.getVesselById('vessel-1');

      expect(mockPrisma.vessel.findUnique).toHaveBeenCalledWith({
        where: { id: 'vessel-1' },
        include: {
          certificates: {
            orderBy: { expiryDate: 'asc' },
          },
          specifications: {
            orderBy: { category: 'asc' },
          },
          assignments: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  email: true,
                },
              },
            },
          },
          requisitions: {
            where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] } },
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      expect(result).toEqual(mockVessel);
    });

    it('should return null for non-existent vessel', async () => {
      mockPrisma.vessel.findUnique.mockResolvedValue(null);

      const result = await vesselService.getVesselById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateVesselPosition', () => {
    it('should update vessel position successfully', async () => {
      const positionData = {
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: new Date(),
      };

      const mockVessel = {
        id: 'vessel-1',
        currentLatitude: 40.7128,
        currentLongitude: -74.0060,
        positionUpdatedAt: positionData.timestamp,
      };

      mockPrisma.vessel.update.mockResolvedValue(mockVessel);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await vesselService.updateVesselPosition('vessel-1', positionData, 'user-1');

      expect(mockPrisma.vessel.update).toHaveBeenCalledWith({
        where: { id: 'vessel-1' },
        data: {
          currentLatitude: 40.7128,
          currentLongitude: -74.0060,
          positionUpdatedAt: positionData.timestamp,
        },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'UPDATE',
        resource: 'vessel_position',
        resourceId: 'vessel-1',
        newValues: positionData,
      });

      expect(result).toEqual(mockVessel);
    });

    it('should update position without user ID (automated tracking)', async () => {
      const positionData = {
        latitude: 40.7128,
        longitude: -74.0060,
      };

      const mockVessel = {
        id: 'vessel-1',
        currentLatitude: 40.7128,
        currentLongitude: -74.0060,
        positionUpdatedAt: expect.any(Date),
      };

      mockPrisma.vessel.update.mockResolvedValue(mockVessel);

      const result = await vesselService.updateVesselPosition('vessel-1', positionData);

      expect(mockPrisma.vessel.update).toHaveBeenCalledWith({
        where: { id: 'vessel-1' },
        data: {
          currentLatitude: 40.7128,
          currentLongitude: -74.0060,
          positionUpdatedAt: expect.any(Date),
        },
      });

      expect(mockAuditService.log).not.toHaveBeenCalled();
      expect(result).toEqual(mockVessel);
    });
  });

  describe('addVesselCertificate', () => {
    it('should add certificate successfully', async () => {
      const certificateData = {
        vesselId: 'vessel-1',
        certificateType: 'Safety Certificate',
        certificateNumber: 'SC-12345',
        issuedBy: 'Maritime Authority',
        issueDate: new Date('2024-01-01'),
        expiryDate: new Date('2024-12-31'),
        documentUrl: 'https://example.com/cert.pdf',
      };

      const mockCertificate = {
        id: 'cert-1',
        ...certificateData,
      };

      mockPrisma.vesselCertificate.create.mockResolvedValue(mockCertificate);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await vesselService.addVesselCertificate(certificateData, 'user-1');

      expect(mockPrisma.vesselCertificate.create).toHaveBeenCalledWith({
        data: certificateData,
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'CREATE',
        resource: 'vessel_certificate',
        resourceId: 'cert-1',
        newValues: certificateData,
        vesselId: 'vessel-1',
      });

      expect(result).toEqual(mockCertificate);
    });
  });

  describe('getExpiringCertificates', () => {
    it('should return certificates expiring within specified days', async () => {
      const mockCertificates = [
        {
          id: 'cert-1',
          certificateType: 'Safety Certificate',
          expiryDate: new Date('2024-02-15'),
          vessel: {
            id: 'vessel-1',
            name: 'Test Vessel',
            imoNumber: '1234567',
          },
        },
        {
          id: 'cert-2',
          certificateType: 'Insurance Certificate',
          expiryDate: new Date('2024-02-20'),
          vessel: {
            id: 'vessel-2',
            name: 'Another Vessel',
            imoNumber: '7654321',
          },
        },
      ];

      mockPrisma.vesselCertificate.findMany.mockResolvedValue(mockCertificates);

      const result = await vesselService.getExpiringCertificates(30);

      expect(mockPrisma.vesselCertificate.findMany).toHaveBeenCalledWith({
        where: {
          expiryDate: {
            lte: expect.any(Date),
            gte: expect.any(Date),
          },
        },
        include: {
          vessel: {
            select: {
              id: true,
              name: true,
              imoNumber: true,
            },
          },
        },
        orderBy: { expiryDate: 'asc' },
      });

      expect(result).toEqual(mockCertificates);
    });
  });

  describe('getVesselsByUser', () => {
    it('should return vessels accessible by user', async () => {
      const mockVessels = [
        {
          id: 'vessel-1',
          name: 'Test Vessel 1',
          certificates: [
            {
              id: 'cert-1',
              certificateType: 'Safety Certificate',
              expiryDate: new Date('2024-12-31'),
            },
          ],
        },
        {
          id: 'vessel-2',
          name: 'Test Vessel 2',
          certificates: [],
        },
      ];

      mockPrisma.vessel.findMany.mockResolvedValue(mockVessels);

      const result = await vesselService.getVesselsByUser('user-1');

      expect(mockPrisma.vessel.findMany).toHaveBeenCalledWith({
        where: {
          assignments: {
            some: {
              userId: 'user-1',
              isActive: true,
            },
          },
        },
        include: {
          certificates: {
            where: {
              expiryDate: { gte: expect.any(Date) },
            },
            take: 3,
            orderBy: { expiryDate: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      });

      expect(result).toEqual(mockVessels);
    });
  });

  describe('updateVesselVoyage', () => {
    it('should update voyage information successfully', async () => {
      const voyageData = {
        departure: 'New York',
        destination: 'London',
        eta: new Date('2024-03-15'),
        route: 'Atlantic Route',
      };

      const existingVessel = {
        id: 'vessel-1',
        currentDeparture: 'Boston',
        currentDestination: 'Hamburg',
        currentETA: new Date('2024-03-10'),
        currentRoute: 'Northern Route',
      };

      const updatedVessel = {
        id: 'vessel-1',
        ...voyageData,
        currentDeparture: voyageData.departure,
        currentDestination: voyageData.destination,
        currentETA: voyageData.eta,
        currentRoute: voyageData.route,
        certificates: [],
        specifications: [],
      };

      mockPrisma.vessel.findUnique.mockResolvedValue(existingVessel);
      mockPrisma.vessel.update.mockResolvedValue(updatedVessel);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await vesselService.updateVesselVoyage('vessel-1', voyageData, 'user-1');

      expect(mockPrisma.vessel.update).toHaveBeenCalledWith({
        where: { id: 'vessel-1' },
        data: {
          currentDeparture: 'New York',
          currentDestination: 'London',
          currentETA: voyageData.eta,
          currentRoute: 'Atlantic Route',
        },
        include: {
          certificates: true,
          specifications: true,
        },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'UPDATE',
        resource: 'vessel_voyage',
        resourceId: 'vessel-1',
        oldValues: {
          currentDeparture: 'Boston',
          currentDestination: 'Hamburg',
          currentETA: new Date('2024-03-10'),
          currentRoute: 'Northern Route',
        },
        newValues: voyageData,
      });

      expect(result).toEqual(updatedVessel);
    });

    it('should throw error for non-existent vessel', async () => {
      mockPrisma.vessel.findUnique.mockResolvedValue(null);

      await expect(
        vesselService.updateVesselVoyage('non-existent', {}, 'user-1')
      ).rejects.toThrow('Vessel not found');
    });
  });
});