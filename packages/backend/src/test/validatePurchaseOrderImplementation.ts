/**
 * Validation test for Task 11.1: Automated PO Generation
 * 
 * This test validates that the purchase order implementation meets all requirements:
 * - Create automatic purchase order generation from selected quotes
 * - Implement maritime-specific terms and conditions integration
 * - Build vessel position and port delivery requirement inclusion
 * - Create PO approval workflow for high-value orders
 * 
 * Requirements: 5.1, 5.2
 */

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

describe('Task 11.1: Automated PO Generation - Validation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockQuoteWithVesselData = {
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
      name: 'Maritime Supplies Ltd',
      serviceAreas: [
        {
          country: 'USA',
          region: 'East Coast',
          ports: ['USNYC', 'USBOS', 'USBAL']
        }
      ],
      portCapabilities: [
        {
          portCode: 'USNYC',
          portName: 'New York',
          capabilities: ['delivery', 'customs', 'warehousing']
        }
      ],
    },
    rfq: {
      id: 'rfq-1',
      requisitionId: 'req-1',
      requisition: {
        id: 'req-1',
        vesselId: 'vessel-1',
        vessel: {
          id: 'vessel-1',
          name: 'MV Atlantic Pioneer',
          imoNumber: '9123456',
          vesselType: 'Container Ship',
          flag: 'Liberia',
          engineType: 'MAN B&W',
          currentLatitude: 40.7128,
          currentLongitude: -74.0060,
          positionUpdatedAt: new Date('2024-01-15T10:30:00Z'),
          currentDestination: 'Port of New York',
          currentDeparture: 'Port of Hamburg',
          currentETA: new Date('2024-02-10T08:00:00Z'),
        },
        items: [
          {
            itemCatalog: {
              name: 'Engine Oil Filter',
              description: 'High-performance marine engine oil filter',
              impaCode: '550123',
              criticalityLevel: 'OPERATIONAL_CRITICAL'
            },
          },
        ],
      },
    },
    lineItems: [
      {
        id: 'line-1',
        quantity: 12,
        unitPrice: 1250,
        totalPrice: 15000,
        currency: 'USD',
        specifications: 'OEM specification, suitable for MAN B&W engines',
        itemCatalog: {
          name: 'Engine Oil Filter',
          description: 'High-performance marine engine oil filter',
          impaCode: '550123',
        },
      },
    ],
  };

  describe('Requirement 5.1: Automatic PO generation with maritime-specific terms', () => {
    it('should automatically generate PO from accepted quote', async () => {
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
        paymentTerms: expect.stringContaining('MARITIME PAYMENT CONDITIONS'),
        deliveryTerms: expect.stringContaining('VESSEL DELIVERY REQUIREMENTS'),
        notes: expect.stringContaining('MARITIME PURCHASE ORDER'),
      };

      mockPrisma.quote.findUnique.mockResolvedValue(mockQuoteWithVesselData);
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

      expect(result).toBeDefined();
      expect(result.poNumber).toMatch(/^PO-\d{6}-\d{4}$/);
      
      // Verify maritime-specific terms are included
      const createCall = mockPrisma.$transaction.mock.calls[0][0];
      const mockTx = {
        purchaseOrder: { create: vi.fn() },
        pOLineItem: { createMany: vi.fn() }
      };
      await createCall(mockTx);
      
      const createData = mockTx.purchaseOrder.create.mock.calls[0][0].data;
      expect(createData.paymentTerms).toContain('MARITIME PAYMENT CONDITIONS');
      expect(createData.deliveryTerms).toContain('VESSEL DELIVERY REQUIREMENTS');
      expect(createData.notes).toContain('MARITIME PURCHASE ORDER');
    });

    it('should include maritime-specific payment terms', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue(mockQuoteWithVesselData);
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
      mockPrisma.exchangeRate.findFirst.mockResolvedValue({ rate: 1 });
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          purchaseOrder: { create: vi.fn() },
          pOLineItem: { createMany: vi.fn() }
        };
        await callback(mockTx);
        
        const createData = mockTx.purchaseOrder.create.mock.calls[0][0].data;
        
        // Verify maritime payment conditions
        expect(createData.paymentTerms).toContain('Payment subject to satisfactory delivery and inspection by vessel crew');
        expect(createData.paymentTerms).toContain('All banking charges outside seller\'s country for buyer\'s account');
        expect(createData.paymentTerms).toContain('Late payment charges: 1.5% per month');
        expect(createData.paymentTerms).toContain('Retention: 5% of invoice value held for 30 days');
        
        return { id: 'po-1', poNumber: 'PO-202401-0001' };
      });

      await purchaseOrderService.generatePurchaseOrder({
        quoteId: 'quote-1',
        approvedBy: 'user-1',
      });
    });
  });

  describe('Requirement 5.2: Vessel position and port delivery requirements', () => {
    it('should include vessel position in delivery terms', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue(mockQuoteWithVesselData);
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
      mockPrisma.exchangeRate.findFirst.mockResolvedValue({ rate: 1 });
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          purchaseOrder: { create: vi.fn() },
          pOLineItem: { createMany: vi.fn() }
        };
        await callback(mockTx);
        
        const createData = mockTx.purchaseOrder.create.mock.calls[0][0].data;
        
        // Verify vessel position is included
        expect(createData.deliveryTerms).toContain('MV Atlantic Pioneer');
        expect(createData.deliveryTerms).toContain('IMO: 9123456');
        expect(createData.deliveryTerms).toContain('40.7128°N, -74.0060°E');
        expect(createData.deliveryTerms).toContain('Position updated:');
        
        return { id: 'po-1', poNumber: 'PO-202401-0001' };
      });

      await purchaseOrderService.generatePurchaseOrder({
        quoteId: 'quote-1',
        approvedBy: 'user-1',
      });
    });

    it('should include current voyage information', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue(mockQuoteWithVesselData);
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
      mockPrisma.exchangeRate.findFirst.mockResolvedValue({ rate: 1 });
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          purchaseOrder: { create: vi.fn() },
          pOLineItem: { createMany: vi.fn() }
        };
        await callback(mockTx);
        
        const createData = mockTx.purchaseOrder.create.mock.calls[0][0].data;
        
        // Verify voyage information is included
        expect(createData.deliveryTerms).toContain('Current voyage: Port of Hamburg to Port of New York');
        expect(createData.deliveryTerms).toContain('ETA:');
        
        return { id: 'po-1', poNumber: 'PO-202401-0001' };
      });

      await purchaseOrderService.generatePurchaseOrder({
        quoteId: 'quote-1',
        approvedBy: 'user-1',
      });
    });
  });

  describe('High-value PO approval workflow', () => {
    it('should create draft PO for high-value orders requiring approval', async () => {
      const highValueQuote = {
        ...mockQuoteWithVesselData,
        totalAmount: 30000, // Above $25,000 threshold
      };

      mockPrisma.quote.findUnique.mockResolvedValue(highValueQuote);
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
      mockPrisma.exchangeRate.findFirst.mockResolvedValue({ rate: 1 });
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          purchaseOrder: { create: vi.fn() },
          pOLineItem: { createMany: vi.fn() }
        };
        await callback(mockTx);
        
        const createData = mockTx.purchaseOrder.create.mock.calls[0][0].data;
        
        // High-value orders should be created as DRAFT
        expect(createData.status).toBe('DRAFT');
        
        return { 
          id: 'po-1', 
          poNumber: 'PO-202401-0001',
          status: 'DRAFT',
          totalAmount: 30000
        };
      });

      const result = await purchaseOrderService.generatePurchaseOrder({
        quoteId: 'quote-1',
        approvedBy: 'user-1',
      });

      expect(result.status).toBe('DRAFT');
    });

    it('should create sent PO for low-value orders not requiring approval', async () => {
      const lowValueQuote = {
        ...mockQuoteWithVesselData,
        totalAmount: 5000, // Below $25,000 threshold
      };

      mockPrisma.quote.findUnique.mockResolvedValue(lowValueQuote);
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
      mockPrisma.exchangeRate.findFirst.mockResolvedValue({ rate: 1 });
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          purchaseOrder: { create: vi.fn() },
          pOLineItem: { createMany: vi.fn() }
        };
        await callback(mockTx);
        
        const createData = mockTx.purchaseOrder.create.mock.calls[0][0].data;
        
        // Low-value orders should be created as SENT
        expect(createData.status).toBe('SENT');
        
        return { 
          id: 'po-1', 
          poNumber: 'PO-202401-0001',
          status: 'SENT',
          totalAmount: 5000
        };
      });

      const result = await purchaseOrderService.generatePurchaseOrder({
        quoteId: 'quote-1',
        approvedBy: 'user-1',
      });

      expect(result.status).toBe('SENT');
    });
  });
});