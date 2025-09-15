import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { rfqService, RFQCreationData } from '../services/rfqService';
import { AppError } from '../utils/errors';

// Mock Prisma
vi.mock('@prisma/client');
const mockPrisma = {
  requisition: {
    findUnique: vi.fn()
  },
  rFQ: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn()
  },
  rFQVendor: {
    createMany: vi.fn()
  },
  vendor: {
    findMany: vi.fn()
  },
  $transaction: vi.fn()
};

// Mock services
vi.mock('../services/auditService', () => ({
  auditService: {
    log: vi.fn()
  }
}));

vi.mock('../services/emailService', () => ({
  emailService: {
    sendEmail: vi.fn()
  }
}));

describe('RFQService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      return await callback(mockPrisma);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createRFQFromRequisition', () => {
    const mockRequisition = {
      id: 'req1',
      status: 'APPROVED',
      currency: 'USD',
      deliveryLocation: 'New York, USA',
      deliveryDate: new Date('2024-03-01'),
      vessel: {
        id: 'vessel1',
        name: 'Test Vessel'
      },
      items: [
        {
          id: 'item1',
          itemCatalog: {
            id: 'catalog1',
            name: 'Engine Part'
          }
        }
      ]
    };

    const mockRFQData: RFQCreationData = {
      requisitionId: 'req1',
      title: 'Test RFQ',
      description: 'Test RFQ Description'
    };

    it('should create RFQ from approved requisition successfully', async () => {
      const mockRFQ = {
        id: 'rfq1',
        rfqNumber: 'RFQ-2024-0001',
        requisitionId: 'req1',
        title: 'Test RFQ',
        status: 'DRAFT'
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(mockRequisition);
      mockPrisma.rFQ.findFirst.mockResolvedValue(null);
      mockPrisma.rFQ.count.mockResolvedValue(0);
      mockPrisma.rFQ.create.mockResolvedValue(mockRFQ);
      mockPrisma.requisition.update = vi.fn().mockResolvedValue({});

      const result = await rfqService.createRFQFromRequisition(mockRFQData, 'user1');

      expect(result).toEqual(mockRFQ);
      expect(mockPrisma.rFQ.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          rfqNumber: 'RFQ-2024-0001',
          requisitionId: 'req1',
          title: 'Test RFQ',
          status: 'DRAFT'
        })
      });
    });

    it('should throw error if requisition not found', async () => {
      mockPrisma.requisition.findUnique.mockResolvedValue(null);

      await expect(rfqService.createRFQFromRequisition(mockRFQData, 'user1'))
        .rejects.toThrow(AppError);
    });

    it('should throw error if requisition not approved', async () => {
      const unapprovedRequisition = { ...mockRequisition, status: 'SUBMITTED' };
      mockPrisma.requisition.findUnique.mockResolvedValue(unapprovedRequisition);

      await expect(rfqService.createRFQFromRequisition(mockRFQData, 'user1'))
        .rejects.toThrow(AppError);
    });

    it('should throw error if RFQ already exists for requisition', async () => {
      const existingRFQ = { id: 'existing-rfq', requisitionId: 'req1' };
      
      mockPrisma.requisition.findUnique.mockResolvedValue(mockRequisition);
      mockPrisma.rFQ.findFirst.mockResolvedValue(existingRFQ);

      await expect(rfqService.createRFQFromRequisition(mockRFQData, 'user1'))
        .rejects.toThrow(AppError);
    });
  });

  describe('selectVendorsForRFQ', () => {
    const mockRFQ = {
      id: 'rfq1',
      requisition: {
        vessel: { name: 'Test Vessel' },
        items: []
      },
      deliveryLocation: 'New York, USA'
    };

    const mockVendors = [
      {
        id: 'vendor1',
        name: 'Vendor 1',
        overallScore: 8.5,
        serviceAreas: [{ country: 'USA', ports: ['USNYC'] }],
        portCapabilities: [{ capabilities: ['delivery'] }],
        certifications: []
      },
      {
        id: 'vendor2',
        name: 'Vendor 2',
        overallScore: 7.0,
        serviceAreas: [{ country: 'USA', ports: ['USMIA'] }],
        portCapabilities: [{ capabilities: ['delivery', 'customs'] }],
        certifications: []
      }
    ];

    it('should select vendors for RFQ successfully', async () => {
      mockPrisma.rFQ.findUnique.mockResolvedValue(mockRFQ);
      mockPrisma.vendor.findMany.mockResolvedValue(mockVendors);

      const result = await rfqService.selectVendorsForRFQ('rfq1');

      expect(result.selectedVendors).toHaveLength(2);
      expect(result.totalEligibleVendors).toBe(2);
      expect(result.selectionCriteria).toBeDefined();
    });

    it('should throw error if RFQ not found', async () => {
      mockPrisma.rFQ.findUnique.mockResolvedValue(null);

      await expect(rfqService.selectVendorsForRFQ('nonexistent'))
        .rejects.toThrow(AppError);
    });

    it('should limit vendors based on maxVendors criteria', async () => {
      const criteria = { maxVendors: 1 };
      
      mockPrisma.rFQ.findUnique.mockResolvedValue(mockRFQ);
      mockPrisma.vendor.findMany.mockResolvedValue(mockVendors);

      const result = await rfqService.selectVendorsForRFQ('rfq1', criteria);

      expect(result.selectedVendors).toHaveLength(1);
      expect(result.totalEligibleVendors).toBe(2);
    });
  });

  describe('distributeRFQ', () => {
    const mockRFQ = {
      id: 'rfq1',
      status: 'DRAFT',
      rfqNumber: 'RFQ-2024-0001',
      title: 'Test RFQ',
      requisition: {
        vessel: { name: 'Test Vessel' },
        items: []
      }
    };

    const mockVendors = [
      {
        id: 'vendor1',
        name: 'Vendor 1',
        email: 'vendor1@example.com',
        contactEmail: null,
        contactPersonName: 'John Doe'
      },
      {
        id: 'vendor2',
        name: 'Vendor 2',
        email: null,
        contactEmail: 'contact@vendor2.com',
        contactPersonName: 'Jane Smith'
      }
    ];

    it('should distribute RFQ to vendors successfully', async () => {
      mockPrisma.rFQ.findUnique.mockResolvedValue(mockRFQ);
      mockPrisma.vendor.findMany.mockResolvedValue(mockVendors);
      mockPrisma.rFQVendor.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.rFQ.update.mockResolvedValue({ ...mockRFQ, status: 'SENT' });

      const result = await rfqService.distributeRFQ('rfq1', ['vendor1', 'vendor2'], 'user1');

      expect(result.rfqId).toBe('rfq1');
      expect(result.totalSent).toBe(2);
      expect(result.sentToVendors).toEqual(['vendor1', 'vendor2']);
      expect(result.failedVendors).toEqual([]);
    });

    it('should throw error if RFQ not found', async () => {
      mockPrisma.rFQ.findUnique.mockResolvedValue(null);

      await expect(rfqService.distributeRFQ('nonexistent', ['vendor1'], 'user1'))
        .rejects.toThrow(AppError);
    });

    it('should throw error if RFQ not in draft status', async () => {
      const sentRFQ = { ...mockRFQ, status: 'SENT' };
      mockPrisma.rFQ.findUnique.mockResolvedValue(sentRFQ);

      await expect(rfqService.distributeRFQ('rfq1', ['vendor1'], 'user1'))
        .rejects.toThrow(AppError);
    });

    it('should throw error if some vendors are not found or inactive', async () => {
      mockPrisma.rFQ.findUnique.mockResolvedValue(mockRFQ);
      mockPrisma.vendor.findMany.mockResolvedValue([mockVendors[0]]); // Only one vendor found

      await expect(rfqService.distributeRFQ('rfq1', ['vendor1', 'vendor2'], 'user1'))
        .rejects.toThrow(AppError);
    });
  });

  describe('getRFQById', () => {
    const mockRFQ = {
      id: 'rfq1',
      rfqNumber: 'RFQ-2024-0001',
      title: 'Test RFQ',
      requisition: {
        vessel: { name: 'Test Vessel' },
        items: []
      },
      vendors: [],
      quotes: []
    };

    it('should get RFQ by ID successfully', async () => {
      mockPrisma.rFQ.findUnique.mockResolvedValue(mockRFQ);

      const result = await rfqService.getRFQById('rfq1');

      expect(result).toEqual(mockRFQ);
      expect(mockPrisma.rFQ.findUnique).toHaveBeenCalledWith({
        where: { id: 'rfq1' },
        include: expect.any(Object)
      });
    });

    it('should throw error if RFQ not found', async () => {
      mockPrisma.rFQ.findUnique.mockResolvedValue(null);

      await expect(rfqService.getRFQById('nonexistent'))
        .rejects.toThrow(AppError);
    });
  });

  describe('getRFQs', () => {
    const mockRFQs = [
      {
        id: 'rfq1',
        status: 'SENT',
        createdAt: new Date('2024-01-01'),
        requisition: { vessel: { name: 'Vessel 1' } }
      },
      {
        id: 'rfq2',
        status: 'DRAFT',
        createdAt: new Date('2024-01-02'),
        requisition: { vessel: { name: 'Vessel 2' } }
      }
    ];

    it('should get RFQs with filters', async () => {
      mockPrisma.rFQ.findMany.mockResolvedValue(mockRFQs);

      const result = await rfqService.getRFQs({
        status: 'SENT',
        dateFrom: new Date('2024-01-01')
      });

      expect(result).toEqual(mockRFQs);
      expect(mockPrisma.rFQ.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'SENT',
          createdAt: expect.objectContaining({
            gte: expect.any(Date)
          })
        }),
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should get all RFQs when no filters provided', async () => {
      mockPrisma.rFQ.findMany.mockResolvedValue(mockRFQs);

      const result = await rfqService.getRFQs();

      expect(result).toEqual(mockRFQs);
      expect(mockPrisma.rFQ.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('cancelRFQ', () => {
    const mockRFQ = {
      id: 'rfq1',
      status: 'SENT'
    };

    it('should cancel RFQ successfully', async () => {
      const cancelledRFQ = { ...mockRFQ, status: 'CANCELLED' };
      
      mockPrisma.rFQ.findUnique.mockResolvedValue(mockRFQ);
      mockPrisma.rFQ.update.mockResolvedValue(cancelledRFQ);

      const result = await rfqService.cancelRFQ('rfq1', 'No longer needed', 'user1');

      expect(result).toEqual(cancelledRFQ);
      expect(mockPrisma.rFQ.update).toHaveBeenCalledWith({
        where: { id: 'rfq1' },
        data: { status: 'CANCELLED' }
      });
    });

    it('should throw error if RFQ not found', async () => {
      mockPrisma.rFQ.findUnique.mockResolvedValue(null);

      await expect(rfqService.cancelRFQ('nonexistent', 'reason', 'user1'))
        .rejects.toThrow(AppError);
    });

    it('should throw error if RFQ already cancelled', async () => {
      const cancelledRFQ = { ...mockRFQ, status: 'CANCELLED' };
      mockPrisma.rFQ.findUnique.mockResolvedValue(cancelledRFQ);

      await expect(rfqService.cancelRFQ('rfq1', 'reason', 'user1'))
        .rejects.toThrow(AppError);
    });
  });
});