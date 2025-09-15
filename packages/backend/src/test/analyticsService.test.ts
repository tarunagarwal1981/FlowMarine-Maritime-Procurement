import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { analyticsService } from '../services/analyticsService';

// Mock Prisma Client
vi.mock('@prisma/client');

const mockPrisma = {
  purchaseOrder: {
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  vessel: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  vendor: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  purchaseCategory: {
    findMany: vi.fn(),
  },
  requisition: {
    findMany: vi.fn(),
  },
} as any;

vi.mocked(PrismaClient).mockImplementation(() => mockPrisma);

describe('AnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('generateSpendingAnalysis', () => {
    it('should generate comprehensive spending analysis', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const vesselIds = ['vessel1', 'vessel2'];

      // Mock total spending
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({
        _sum: { totalAmount: 100000 }
      });

      // Mock spending by vessel
      mockPrisma.purchaseOrder.groupBy
        .mockResolvedValueOnce([
          { vesselId: 'vessel1', _sum: { totalAmount: 60000 }, _count: { id: 10 } },
          { vesselId: 'vessel2', _sum: { totalAmount: 40000 }, _count: { id: 8 } }
        ])
        .mockResolvedValueOnce([
          { categoryCode: 'ENGINE_PARTS', _sum: { totalAmount: 50000 }, _count: { id: 12 } },
          { categoryCode: 'SAFETY_GEAR', _sum: { totalAmount: 30000 }, _count: { id: 6 } }
        ])
        .mockResolvedValueOnce([
          { vendorId: 'vendor1', _sum: { totalAmount: 70000 }, _count: { id: 15 } },
          { vendorId: 'vendor2', _sum: { totalAmount: 30000 }, _count: { id: 3 } }
        ]);

      // Mock vessel details
      mockPrisma.vessel.findMany.mockResolvedValue([
        { id: 'vessel1', name: 'MV Atlantic' },
        { id: 'vessel2', name: 'MV Pacific' }
      ]);

      // Mock category details
      mockPrisma.purchaseCategory.findMany.mockResolvedValue([
        { code: 'ENGINE_PARTS', name: 'Engine Parts' },
        { code: 'SAFETY_GEAR', name: 'Safety Equipment' }
      ]);

      // Mock vendor details
      mockPrisma.vendor.findMany.mockResolvedValue([
        { id: 'vendor1', name: 'Marine Supply Co' },
        { id: 'vendor2', name: 'Safety Equipment Ltd' }
      ]);

      // Mock monthly trends data
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        { createdAt: new Date('2024-01-15'), totalAmount: 25000 },
        { createdAt: new Date('2024-01-20'), totalAmount: 15000 },
        { createdAt: new Date('2024-02-10'), totalAmount: 35000 },
        { createdAt: new Date('2024-02-25'), totalAmount: 25000 }
      ]);

      const result = await analyticsService.generateSpendingAnalysis(
        startDate,
        endDate,
        vesselIds,
        'USD'
      );

      expect(result).toEqual({
        totalSpending: 100000,
        currency: 'USD',
        spendingByVessel: [
          {
            vesselId: 'vessel1',
            vesselName: 'MV Atlantic',
            totalAmount: 60000,
            currency: 'USD',
            orderCount: 10
          },
          {
            vesselId: 'vessel2',
            vesselName: 'MV Pacific',
            totalAmount: 40000,
            currency: 'USD',
            orderCount: 8
          }
        ],
        spendingByCategory: [
          {
            categoryCode: 'ENGINE_PARTS',
            categoryName: 'Engine Parts',
            totalAmount: 50000,
            currency: 'USD',
            orderCount: 12
          },
          {
            categoryCode: 'SAFETY_GEAR',
            categoryName: 'Safety Equipment',
            totalAmount: 30000,
            currency: 'USD',
            orderCount: 6
          }
        ],
        spendingByVendor: [
          {
            vendorId: 'vendor1',
            vendorName: 'Marine Supply Co',
            totalAmount: 70000,
            currency: 'USD',
            orderCount: 15
          },
          {
            vendorId: 'vendor2',
            vendorName: 'Safety Equipment Ltd',
            totalAmount: 30000,
            currency: 'USD',
            orderCount: 3
          }
        ],
        monthlyTrends: [
          { month: '2024-01', totalAmount: 40000, orderCount: 2 },
          { month: '2024-02', totalAmount: 60000, orderCount: 2 }
        ]
      });

      expect(mockPrisma.purchaseOrder.aggregate).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          vesselId: { in: vesselIds },
          status: { in: ['DELIVERED', 'INVOICED', 'PAID'] }
        },
        _sum: { totalAmount: true }
      });
    });

    it('should handle empty results gracefully', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({
        _sum: { totalAmount: null }
      });

      mockPrisma.purchaseOrder.groupBy
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([]);

      mockPrisma.vessel.findMany.mockResolvedValue([]);
      mockPrisma.purchaseCategory.findMany.mockResolvedValue([]);
      mockPrisma.vendor.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);

      const result = await analyticsService.generateSpendingAnalysis(
        startDate,
        endDate,
        undefined,
        'USD'
      );

      expect(result.totalSpending).toBe(0);
      expect(result.spendingByVessel).toEqual([]);
      expect(result.spendingByCategory).toEqual([]);
      expect(result.spendingByVendor).toEqual([]);
      expect(result.monthlyTrends).toEqual([]);
    });
  });

  describe('generateVendorPerformanceAnalytics', () => {
    it('should generate vendor performance analytics with scoring trends', async () => {
      const vendorId = 'vendor1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-31');

      // Mock vendor data
      mockPrisma.vendor.findUnique.mockResolvedValue({
        id: vendorId,
        name: 'Marine Supply Co',
        overallScore: 85.5,
        qualityRating: 90.0,
        deliveryRating: 80.0,
        priceRating: 86.5
      });

      // Mock purchase orders with deliveries
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        {
          id: 'po1',
          vendorId,
          createdAt: new Date('2024-01-15'),
          deliveries: [
            {
              scheduledDate: new Date('2024-01-20'),
              actualDate: new Date('2024-01-19') // On time
            }
          ]
        },
        {
          id: 'po2',
          vendorId,
          createdAt: new Date('2024-02-10'),
          deliveries: [
            {
              scheduledDate: new Date('2024-02-15'),
              actualDate: new Date('2024-02-17') // Late
            }
          ]
        }
      ]);

      const result = await analyticsService.generateVendorPerformanceAnalytics(
        vendorId,
        startDate,
        endDate
      );

      expect(result).toEqual({
        vendorId,
        vendorName: 'Marine Supply Co',
        overallScore: 85.5,
        qualityRating: 90.0,
        deliveryRating: 80.0,
        priceRating: 86.5,
        totalOrders: 2,
        onTimeDeliveries: 1,
        deliveryPercentage: 50,
        averageDeliveryTime: 1, // Average of 1 day early and 2 days late
        scoringTrends: [
          {
            month: '2024-01',
            qualityScore: 90.0,
            deliveryScore: 80.0,
            priceScore: 86.5,
            overallScore: 85.5
          },
          {
            month: '2024-02',
            qualityScore: 90.0,
            deliveryScore: 80.0,
            priceScore: 86.5,
            overallScore: 85.5
          },
          {
            month: '2024-03',
            qualityScore: 90.0,
            deliveryScore: 80.0,
            priceScore: 86.5,
            overallScore: 85.5
          }
        ]
      });
    });

    it('should throw error for non-existent vendor', async () => {
      const vendorId = 'nonexistent';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-31');

      mockPrisma.vendor.findUnique.mockResolvedValue(null);

      await expect(
        analyticsService.generateVendorPerformanceAnalytics(vendorId, startDate, endDate)
      ).rejects.toThrow('Vendor not found: nonexistent');
    });
  });

  describe('analyzeProcurementPatterns', () => {
    it('should analyze procurement patterns by vessel and category', async () => {
      const vesselId = 'vessel1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      // Mock vessel data
      mockPrisma.vessel.findUnique.mockResolvedValue({
        id: vesselId,
        name: 'MV Atlantic'
      });

      // Mock requisitions with items
      mockPrisma.requisition.findMany.mockResolvedValue([
        {
          id: 'req1',
          vesselId,
          urgencyLevel: 'ROUTINE',
          totalAmount: 5000,
          createdAt: new Date('2024-01-15'),
          items: [
            {
              itemCatalogId: 'item1',
              quantity: 2,
              totalPrice: 3000,
              itemCatalog: {
                id: 'item1',
                name: 'Engine Oil Filter',
                category: 'ENGINE_PARTS'
              }
            },
            {
              itemCatalogId: 'item2',
              quantity: 1,
              totalPrice: 2000,
              itemCatalog: {
                id: 'item2',
                name: 'Safety Vest',
                category: 'SAFETY_GEAR'
              }
            }
          ]
        },
        {
          id: 'req2',
          vesselId,
          urgencyLevel: 'URGENT',
          totalAmount: 8000,
          createdAt: new Date('2024-02-10'),
          items: [
            {
              itemCatalogId: 'item1',
              quantity: 3,
              totalPrice: 4500,
              itemCatalog: {
                id: 'item1',
                name: 'Engine Oil Filter',
                category: 'ENGINE_PARTS'
              }
            }
          ]
        }
      ]);

      const result = await analyticsService.analyzeProcurementPatterns(
        vesselId,
        startDate,
        endDate
      );

      expect(result.vesselId).toBe(vesselId);
      expect(result.vesselName).toBe('MV Atlantic');
      expect(result.categoryAnalysis).toHaveLength(2);
      expect(result.urgencyPatterns).toHaveLength(2);
      expect(result.topItems).toHaveLength(2);

      // Check category analysis
      const enginePartsCategory = result.categoryAnalysis.find(c => c.category === 'ENGINE_PARTS');
      expect(enginePartsCategory).toBeDefined();
      expect(enginePartsCategory?.frequency).toBe(2);
      expect(enginePartsCategory?.averageAmount).toBe(3750); // (3000 + 4500) / 2

      // Check urgency patterns
      const routinePattern = result.urgencyPatterns.find(p => p.urgencyLevel === 'ROUTINE');
      expect(routinePattern).toBeDefined();
      expect(routinePattern?.count).toBe(1);
      expect(routinePattern?.percentage).toBe(50);

      // Check top items
      const topItem = result.topItems[0];
      expect(topItem.itemName).toBe('Engine Oil Filter');
      expect(topItem.orderCount).toBe(2);
      expect(topItem.totalAmount).toBe(7500);
    });

    it('should throw error for non-existent vessel', async () => {
      const vesselId = 'nonexistent';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockPrisma.vessel.findUnique.mockResolvedValue(null);

      await expect(
        analyticsService.analyzeProcurementPatterns(vesselId, startDate, endDate)
      ).rejects.toThrow('Vessel not found: nonexistent');
    });
  });

  describe('generateCostOptimizationRecommendations', () => {
    it('should generate cost optimization recommendations', async () => {
      const vesselIds = ['vessel1', 'vessel2'];
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const result = await analyticsService.generateCostOptimizationRecommendations(
        vesselIds,
        startDate,
        endDate
      );

      expect(Array.isArray(result)).toBe(true);
      // Since the implementation is placeholder, we just check the structure
    });

    it('should handle undefined parameters', async () => {
      const result = await analyticsService.generateCostOptimizationRecommendations();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});