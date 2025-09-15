/**
 * Requisition Service Tests
 * Tests for requisition creation, validation, and management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { requisitionService, CreateRequisitionData } from '../services/requisitionService';
import { vesselService } from '../services/vesselService';
import { itemCatalogService } from '../services/itemCatalogService';
import { auditService } from '../services/auditService';

// Mock dependencies
vi.mock('../services/vesselService');
vi.mock('../services/itemCatalogService');
vi.mock('../services/auditService');

const mockPrisma = {
  requisition: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  vessel: {
    findUnique: vi.fn(),
  },
} as any;

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

describe('RequisitionService', () => {
  const mockUserId = 'user-123';
  const mockVesselId = 'vessel-123';
  
  const mockVessel = {
    id: mockVesselId,
    name: 'Test Vessel',
    imoNumber: 'IMO1234567',
    vesselType: 'CONTAINER',
    engineType: 'DIESEL',
    cargoCapacity: 10000,
    fuelConsumption: 50,
    crewComplement: 20,
  };

  const mockCatalogItem = {
    id: 'item-123',
    name: 'Test Item',
    impaCode: '123456',
    category: 'ENGINE_PARTS',
    criticalityLevel: 'OPERATIONAL_CRITICAL',
    compatibleVesselTypes: ['CONTAINER'],
    compatibleEngineTypes: ['DIESEL'],
    averagePrice: 100,
    specifications: {},
  };

  const mockCreateData: CreateRequisitionData = {
    vesselId: mockVesselId,
    urgencyLevel: 'ROUTINE',
    totalAmount: 200,
    currency: 'USD',
    deliveryLocation: 'Port of Singapore',
    deliveryDate: new Date('2024-12-31'),
    justification: 'Routine maintenance',
    items: [
      {
        itemCatalogId: 'item-123',
        quantity: 2,
        unitPrice: 100,
        urgencyLevel: 'ROUTINE',
        justification: 'Replacement parts',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    vi.mocked(vesselService.getVesselById).mockResolvedValue(mockVessel as any);
    vi.mocked(vesselService.validateUserVesselAccess).mockResolvedValue(true);
    vi.mocked(vesselService.getUserVessels).mockResolvedValue([mockVessel] as any);
    vi.mocked(itemCatalogService.getItemById).mockResolvedValue(mockCatalogItem as any);
    vi.mocked(auditService.logEvent).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createRequisition', () => {
    it('should create a requisition successfully', async () => {
      const mockRequisition = {
        id: 'req-123',
        requisitionNumber: 'TES-2024-0001',
        ...mockCreateData,
        status: 'DRAFT',
        items: [
          {
            id: 'item-req-123',
            itemCatalogId: 'item-123',
            quantity: 2,
            unitPrice: 100,
            totalPrice: 200,
            urgencyLevel: 'ROUTINE',
            justification: 'Replacement parts',
            itemCatalog: mockCatalogItem,
          },
        ],
        vessel: mockVessel,
        requestedBy: {
          id: mockUserId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.vessel.findUnique.mockResolvedValue(mockVessel);
      mockPrisma.requisition.findFirst.mockResolvedValue(null);
      mockPrisma.requisition.create.mockResolvedValue(mockRequisition);

      const result = await requisitionService.createRequisition(mockCreateData, mockUserId);

      expect(result).toEqual(mockRequisition);
      expect(vesselService.getVesselById).toHaveBeenCalledWith(mockVesselId);
      expect(vesselService.validateUserVesselAccess).toHaveBeenCalledWith(mockUserId, mockVesselId);
      expect(mockPrisma.requisition.create).toHaveBeenCalled();
      expect(auditService.logEvent).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'REQUISITION_CREATED',
        resourceType: 'REQUISITION',
        resourceId: 'req-123',
        details: expect.any(Object),
      });
    });

    it('should throw error if vessel not found', async () => {
      vi.mocked(vesselService.getVesselById).mockResolvedValue(null);

      await expect(
        requisitionService.createRequisition(mockCreateData, mockUserId)
      ).rejects.toThrow('Vessel not found');
    });

    it('should throw error if user has no vessel access', async () => {
      vi.mocked(vesselService.validateUserVesselAccess).mockResolvedValue(false);

      await expect(
        requisitionService.createRequisition(mockCreateData, mockUserId)
      ).rejects.toThrow('Access denied to vessel');
    });

    it('should throw error if validation fails', async () => {
      const invalidData = {
        ...mockCreateData,
        items: [], // No items
      };

      await expect(
        requisitionService.createRequisition(invalidData, mockUserId)
      ).rejects.toThrow('Validation failed');
    });

    it('should generate unique requisition number', async () => {
      mockPrisma.vessel.findUnique.mockResolvedValue(mockVessel);
      mockPrisma.requisition.findFirst.mockResolvedValue(null);
      mockPrisma.requisition.create.mockResolvedValue({
        id: 'req-123',
        requisitionNumber: 'TES-2024-0001',
      });

      await requisitionService.createRequisition(mockCreateData, mockUserId);

      expect(mockPrisma.requisition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requisitionNumber: expect.stringMatching(/^TES-\d{4}-\d{4}$/),
          }),
        })
      );
    });
  });

  describe('getRequisitions', () => {
    it('should get requisitions with filters', async () => {
      const mockRequisitions = [
        {
          id: 'req-123',
          requisitionNumber: 'TES-2024-0001',
          vesselId: mockVesselId,
          status: 'DRAFT',
          totalAmount: 200,
          currency: 'USD',
        },
      ];

      mockPrisma.requisition.findMany.mockResolvedValue(mockRequisitions);
      mockPrisma.requisition.count.mockResolvedValue(1);

      const result = await requisitionService.getRequisitions(
        { vesselId: mockVesselId },
        mockUserId,
        1,
        20
      );

      expect(result.requisitions).toEqual(mockRequisitions);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        pages: 1,
      });
    });

    it('should filter by user vessels', async () => {
      mockPrisma.requisition.findMany.mockResolvedValue([]);
      mockPrisma.requisition.count.mockResolvedValue(0);

      await requisitionService.getRequisitions({}, mockUserId);

      expect(vesselService.getUserVessels).toHaveBeenCalledWith(mockUserId);
      expect(mockPrisma.requisition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vesselId: { in: [mockVesselId] },
          }),
        })
      );
    });
  });

  describe('getRequisitionById', () => {
    it('should get requisition by ID', async () => {
      const mockRequisition = {
        id: 'req-123',
        vesselId: mockVesselId,
        requisitionNumber: 'TES-2024-0001',
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(mockRequisition);

      const result = await requisitionService.getRequisitionById('req-123', mockUserId);

      expect(result).toEqual(mockRequisition);
      expect(vesselService.validateUserVesselAccess).toHaveBeenCalledWith(mockUserId, mockVesselId);
    });

    it('should return null if requisition not found', async () => {
      mockPrisma.requisition.findUnique.mockResolvedValue(null);

      const result = await requisitionService.getRequisitionById('req-123', mockUserId);

      expect(result).toBeNull();
    });

    it('should throw error if user has no access', async () => {
      const mockRequisition = {
        id: 'req-123',
        vesselId: mockVesselId,
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(mockRequisition);
      vi.mocked(vesselService.validateUserVesselAccess).mockResolvedValue(false);

      await expect(
        requisitionService.getRequisitionById('req-123', mockUserId)
      ).rejects.toThrow('Access denied to requisition');
    });
  });

  describe('updateRequisition', () => {
    it('should update requisition in DRAFT status', async () => {
      const mockRequisition = {
        id: 'req-123',
        vesselId: mockVesselId,
        status: 'DRAFT',
      };

      const updates = {
        urgencyLevel: 'URGENT' as const,
        justification: 'Updated justification',
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(mockRequisition);
      mockPrisma.requisition.update.mockResolvedValue({
        ...mockRequisition,
        ...updates,
      });

      const result = await requisitionService.updateRequisition('req-123', updates, mockUserId);

      expect(mockPrisma.requisition.update).toHaveBeenCalledWith({
        where: { id: 'req-123' },
        data: expect.objectContaining(updates),
        include: expect.any(Object),
      });
      expect(auditService.logEvent).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'REQUISITION_UPDATED',
        resourceType: 'REQUISITION',
        resourceId: 'req-123',
        details: { updates: Object.keys(updates) },
      });
    });

    it('should throw error if requisition not in DRAFT status', async () => {
      const mockRequisition = {
        id: 'req-123',
        vesselId: mockVesselId,
        status: 'PENDING_APPROVAL',
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(mockRequisition);

      await expect(
        requisitionService.updateRequisition('req-123', {}, mockUserId)
      ).rejects.toThrow('Can only update requisitions in DRAFT status');
    });
  });

  describe('submitRequisition', () => {
    it('should submit requisition for approval', async () => {
      const mockRequisition = {
        id: 'req-123',
        vesselId: mockVesselId,
        status: 'DRAFT',
        requisitionNumber: 'TES-2024-0001',
        totalAmount: 200,
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(mockRequisition);
      mockPrisma.requisition.update.mockResolvedValue({
        ...mockRequisition,
        status: 'PENDING_APPROVAL',
        submittedAt: new Date(),
      });

      const result = await requisitionService.submitRequisition('req-123', mockUserId);

      expect(mockPrisma.requisition.update).toHaveBeenCalledWith({
        where: { id: 'req-123' },
        data: {
          status: 'PENDING_APPROVAL',
          submittedAt: expect.any(Date),
        },
        include: expect.any(Object),
      });
      expect(auditService.logEvent).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'REQUISITION_SUBMITTED',
        resourceType: 'REQUISITION',
        resourceId: 'req-123',
        details: {
          requisitionNumber: 'TES-2024-0001',
          totalAmount: 200,
        },
      });
    });

    it('should throw error if requisition not in DRAFT status', async () => {
      const mockRequisition = {
        id: 'req-123',
        vesselId: mockVesselId,
        status: 'PENDING_APPROVAL',
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(mockRequisition);

      await expect(
        requisitionService.submitRequisition('req-123', mockUserId)
      ).rejects.toThrow('Can only submit requisitions in DRAFT status');
    });
  });

  describe('deleteRequisition', () => {
    it('should delete requisition in DRAFT status', async () => {
      const mockRequisition = {
        id: 'req-123',
        vesselId: mockVesselId,
        status: 'DRAFT',
        requisitionNumber: 'TES-2024-0001',
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(mockRequisition);
      mockPrisma.requisition.delete.mockResolvedValue(mockRequisition);

      await requisitionService.deleteRequisition('req-123', mockUserId);

      expect(mockPrisma.requisition.delete).toHaveBeenCalledWith({
        where: { id: 'req-123' },
      });
      expect(auditService.logEvent).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'REQUISITION_DELETED',
        resourceType: 'REQUISITION',
        resourceId: 'req-123',
        details: {
          requisitionNumber: 'TES-2024-0001',
        },
      });
    });

    it('should throw error if requisition not in DRAFT status', async () => {
      const mockRequisition = {
        id: 'req-123',
        vesselId: mockVesselId,
        status: 'APPROVED',
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(mockRequisition);

      await expect(
        requisitionService.deleteRequisition('req-123', mockUserId)
      ).rejects.toThrow('Can only delete requisitions in DRAFT status');
    });
  });

  describe('getRequisitionStats', () => {
    it('should get requisition statistics', async () => {
      mockPrisma.requisition.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3)  // draft
        .mockResolvedValueOnce(4)  // pending
        .mockResolvedValueOnce(2)  // approved
        .mockResolvedValueOnce(1); // emergency

      mockPrisma.requisition.aggregate.mockResolvedValue({
        _sum: { totalAmount: 5000 },
      });

      const result = await requisitionService.getRequisitionStats(mockUserId);

      expect(result).toEqual({
        totalCount: 10,
        draftCount: 3,
        pendingCount: 4,
        approvedCount: 2,
        emergencyCount: 1,
        totalValue: 5000,
      });
    });
  });
});

// Validation tests
describe('RequisitionService - Validation', () => {
  const mockVessel = {
    id: 'vessel-123',
    vesselType: 'CONTAINER',
    engineType: 'DIESEL',
  };

  const mockCatalogItem = {
    id: 'item-123',
    name: 'Test Item',
    criticalityLevel: 'SAFETY_CRITICAL',
    compatibleVesselTypes: ['CONTAINER'],
    compatibleEngineTypes: ['DIESEL'],
  };

  beforeEach(() => {
    vi.mocked(itemCatalogService.getItemById).mockResolvedValue(mockCatalogItem as any);
  });

  it('should validate requisition with no items', async () => {
    const data: CreateRequisitionData = {
      vesselId: 'vessel-123',
      urgencyLevel: 'ROUTINE',
      totalAmount: 0,
      currency: 'USD',
      items: [],
    };

    // Access private method through service instance
    const service = requisitionService as any;
    const result = await service.validateRequisition(data, mockVessel);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Requisition must have at least one item');
  });

  it('should validate emergency requisition without justification', async () => {
    const data: CreateRequisitionData = {
      vesselId: 'vessel-123',
      urgencyLevel: 'EMERGENCY',
      totalAmount: 100,
      currency: 'USD',
      items: [
        {
          itemCatalogId: 'item-123',
          quantity: 1,
          unitPrice: 100,
          urgencyLevel: 'EMERGENCY',
        },
      ],
    };

    const service = requisitionService as any;
    const result = await service.validateRequisition(data, mockVessel);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Emergency requisitions require justification');
  });

  it('should warn about safety critical items with routine urgency', async () => {
    const data: CreateRequisitionData = {
      vesselId: 'vessel-123',
      urgencyLevel: 'ROUTINE',
      totalAmount: 100,
      currency: 'USD',
      items: [
        {
          itemCatalogId: 'item-123',
          quantity: 1,
          unitPrice: 100,
          urgencyLevel: 'ROUTINE',
        },
      ],
    };

    const service = requisitionService as any;
    const result = await service.validateRequisition(data, mockVessel);

    expect(result.warnings).toContain(
      'Safety critical item "Test Item" marked as routine urgency'
    );
  });
});