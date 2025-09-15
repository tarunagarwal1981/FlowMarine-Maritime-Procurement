import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient, POStatus, QuoteStatus } from '@prisma/client';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { AppError } from '../utils/errors';

// Mock Prisma
const mockPrisma = {
  quote: {
    findUnique: vi.fn(),
  },
  purchaseOrder: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  pOLineItem: {
    createMany: vi.fn(),
  },
  exchangeRate: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
  POStatus: {
    DRAFT: 'DRAFT',
    SENT: 'SENT',
    ACKNOWLEDGED: 'ACKNOWLEDGED',
    IN_PROGRESS: 'IN_PROGRESS',
    DELIVERED: 'DELIVERED',
    INVOICED: 'INVOICED',
    PAID: 'PAID',
    CANCELLED: 'CANCELLED',
  },
  QuoteStatus: {
    PENDING: 'PENDING',
    SUBMITTED: 'SUBMITTED',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    EXPIRED: 'EXPIRED',
  },
}));

// Mock audit service
vi.mock('../services/auditService', () => ({
  auditService: {
    log: vi.fn(),
  },
}));

describe('PurchaseOrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generatePurchaseOrder', () => {
    const mockQuote = {
      id: 'quote-1',
      status: 'ACCEPTED',
      totalAmount: 15000,
      currency: 'USD',
      deliveryDate: new Date('2024-02-15'),
      paymentTerms: 'Net 30',
      vendorId: 'vendor-1',
      rfqId: 'rfq-1',
      vendor: {
        id: 'vendor-1',
        name: 'Test Vendor',
        serviceAreas: [],
        portCapabilities: [],
      },
      rfq: {
        id: 'rfq-1',
        requisitionId: 'req-1',
        requisition: {
          id: 'req-1',
          vesselId: 'vessel-1',
          vessel: {
            id: 'vessel-1',
            name: 'Test Vessel',
            imoNumber: '1234567',
            currentLatitude: 40.7128,
            currentLongitude: -74.0060,
            positionUpdatedAt: new Date(),
            currentDestination: 'New York',
            currentDeparture: 'London',
            currentETA: new Date('2024-02-10'),
          },
          items: [
            {
              itemCatalog: {
                name: 'Test Item',
                description: 'Test Description',
              },
            },
          ],
        },
      },
      lineItems: [
        {
          id: 'line-1',
          quantity: 2,
          unitPrice: 7500,
          totalPrice: 15000,
          currency: 'USD',
          specifications: 'Test specs',
          itemCatalog: {
            name: 'Test Item',
            description: 'Test Description',
          },
        },
      ],
    };

    const mockPO = {
      id: 'po-1',
      poNumber: 'PO-202401-0001',
      quoteId: 'quote-1',
      vendorId: 'vendor-1',
      vesselId: 'vessel-1',
      status: 'SENT',
      totalAmount: 15000,
      currency: 'USD',
      exchangeRate: 1,
    };

    it('should generate purchase order successfully for low-value quote', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue(mockQuote);
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
      mockPrisma.exchangeRate.findFirst.mockResolvedValue({ rate: 1 });
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          purchaseOrder: {
            create: vi.fn().mockResolvedValue(mockPO),
          },
          pOLineItem: {
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return callback(mockTx);
      });

      const result = await purchaseOrderService.generatePurchaseOrder({
        quoteId: 'quote-1',
        approvedBy: 'user-1',
      });

      expect(result).toEqual(mockPO);
      expect(mockPrisma.quote.findUnique).toHaveBeenCalledWith({
        where: { id: 'quote-1' },
        include: expect.any(Object),
      });
    });

    it('should create draft PO for high-value quote', async () => {
      const highValueQuote = {
        ...mockQuote,
        totalAmount: 30000, // Above threshold
      };

      const draftPO = {
        ...mockPO,
        status: 'DRAFT',
        totalAmount: 30000,
      };

      mockPrisma.quote.findUnique.mockResolvedValue(highValueQuote);
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
      mockPrisma.exchangeRate.findFirst.mockResolvedValue({ rate: 1 });
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          purchaseOrder: {
            create: vi.fn().mockResolvedValue(draftPO),
          },
          pOLineItem: {
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return callback(mockTx);
      });

      const result = await purchaseOrderService.generatePurchaseOrder({
        quoteId: 'quote-1',
        approvedBy: 'user-1',
      });

      expect(result.status).toBe('DRAFT');
    });

    it('should throw error if quote not found', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue(null);

      await expect(
        purchaseOrderService.generatePurchaseOrder({
          quoteId: 'nonexistent',
          approvedBy: 'user-1',
        })
      ).rejects.toThrow(AppError);
    });

    it('should throw error if quote not accepted', async () => {
      const pendingQuote = {
        ...mockQuote,
        status: 'SUBMITTED',
      };

      mockPrisma.quote.findUnique.mockResolvedValue(pendingQuote);

      await expect(
        purchaseOrderService.generatePurchaseOrder({
          quoteId: 'quote-1',
          approvedBy: 'user-1',
        })
      ).rejects.toThrow(AppError);
    });

    it('should throw error if PO already exists', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue(mockQuote);
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(mockPO);

      await expect(
        purchaseOrderService.generatePurchaseOrder({
          quoteId: 'quote-1',
          approvedBy: 'user-1',
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('approvePurchaseOrder', () => {
    const mockDraftPO = {
      id: 'po-1',
      poNumber: 'PO-202401-0001',
      status: 'DRAFT',
      vesselId: 'vessel-1',
      vendorId: 'vendor-1',
      totalAmount: 30000,
      notes: 'Initial notes',
      vendor: { name: 'Test Vendor' },
      vessel: { name: 'Test Vessel' },
    };

    it('should approve draft purchase order successfully', async () => {
      const approvedPO = {
        ...mockDraftPO,
        status: 'SENT',
        notes: 'Initial notes\n\nApproval Comments: Approved for urgent delivery',
      };

      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(mockDraftPO);
      mockPrisma.purchaseOrder.update.mockResolvedValue(approvedPO);

      const result = await purchaseOrderService.approvePurchaseOrder({
        purchaseOrderId: 'po-1',
        approvedBy: 'user-1',
        comments: 'Approved for urgent delivery',
      });

      expect(result.status).toBe('SENT');
      expect(result.notes).toContain('Approved for urgent delivery');
    });

    it('should throw error if PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(
        purchaseOrderService.approvePurchaseOrder({
          purchaseOrderId: 'nonexistent',
          approvedBy: 'user-1',
        })
      ).rejects.toThrow(AppError);
    });

    it('should throw error if PO not in draft status', async () => {
      const sentPO = {
        ...mockDraftPO,
        status: 'SENT',
      };

      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(sentPO);

      await expect(
        purchaseOrderService.approvePurchaseOrder({
          purchaseOrderId: 'po-1',
          approvedBy: 'user-1',
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('getPurchaseOrderById', () => {
    it('should return purchase order with full details', async () => {
      const mockPOWithDetails = {
        id: 'po-1',
        poNumber: 'PO-202401-0001',
        vendor: { name: 'Test Vendor' },
        vessel: { name: 'Test Vessel' },
        lineItems: [],
        deliveries: [],
        invoices: [],
      };

      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(mockPOWithDetails);

      const result = await purchaseOrderService.getPurchaseOrderById('po-1');

      expect(result).toEqual(mockPOWithDetails);
      expect(mockPrisma.purchaseOrder.findUnique).toHaveBeenCalledWith({
        where: { id: 'po-1' },
        include: expect.any(Object),
      });
    });

    it('should return null if PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);

      const result = await purchaseOrderService.getPurchaseOrderById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updatePurchaseOrderStatus', () => {
    const mockPO = {
      id: 'po-1',
      poNumber: 'PO-202401-0001',
      status: 'SENT',
      vesselId: 'vessel-1',
      notes: 'Original notes',
    };

    it('should update status successfully', async () => {
      const updatedPO = {
        ...mockPO,
        status: 'ACKNOWLEDGED',
        notes: 'Original notes\n\nVendor acknowledged receipt',
      };

      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(mockPO);
      mockPrisma.purchaseOrder.update.mockResolvedValue(updatedPO);

      const result = await purchaseOrderService.updatePurchaseOrderStatus(
        'po-1',
        POStatus.ACKNOWLEDGED,
        'user-1',
        'Vendor acknowledged receipt'
      );

      expect(result.status).toBe('ACKNOWLEDGED');
      expect(result.notes).toContain('Vendor acknowledged receipt');
    });

    it('should throw error if PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(
        purchaseOrderService.updatePurchaseOrderStatus('nonexistent', POStatus.ACKNOWLEDGED, 'user-1')
      ).rejects.toThrow(AppError);
    });
  });

  describe('getPurchaseOrdersByVessel', () => {
    it('should return purchase orders for vessel', async () => {
      const mockPOs = [
        {
          id: 'po-1',
          vesselId: 'vessel-1',
          vendor: { name: 'Vendor 1' },
          vessel: { name: 'Test Vessel' },
        },
        {
          id: 'po-2',
          vesselId: 'vessel-1',
          vendor: { name: 'Vendor 2' },
          vessel: { name: 'Test Vessel' },
        },
      ];

      mockPrisma.purchaseOrder.findMany.mockResolvedValue(mockPOs);

      const result = await purchaseOrderService.getPurchaseOrdersByVessel('vessel-1');

      expect(result).toEqual(mockPOs);
      expect(mockPrisma.purchaseOrder.findMany).toHaveBeenCalledWith({
        where: { vesselId: 'vessel-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by status when provided', async () => {
      const mockPOs = [
        {
          id: 'po-1',
          vesselId: 'vessel-1',
          status: 'SENT',
        },
      ];

      mockPrisma.purchaseOrder.findMany.mockResolvedValue(mockPOs);

      await purchaseOrderService.getPurchaseOrdersByVessel('vessel-1', POStatus.SENT);

      expect(mockPrisma.purchaseOrder.findMany).toHaveBeenCalledWith({
        where: { vesselId: 'vessel-1', status: 'SENT' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});