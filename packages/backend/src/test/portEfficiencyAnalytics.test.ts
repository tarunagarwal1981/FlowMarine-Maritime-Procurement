import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { dashboardAnalyticsService, DashboardFilters } from '../services/dashboardAnalyticsService';

// Mock Prisma Client
const mockPrisma = {
  purchaseOrder: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
} as unknown as PrismaClient;

// Mock dependencies
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('./cacheService', () => ({
  cacheService: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe('Port Efficiency Analytics Service', () => {
  const mockFilters: DashboardFilters = {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    vesselIds: ['vessel-1', 'vessel-2'],
    categories: ['ENGINE', 'DECK'],
    vendorIds: ['vendor-1', 'vendor-2'],
    baseCurrency: 'USD',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generatePortEfficiencyAnalytics', () => {
    it('should generate comprehensive port efficiency analytics', async () => {
      // Mock purchase order data with deliveries
      const mockPurchaseOrders = [
        {
          id: 'po-1',
          totalAmount: 10000,
          deliveries: [
            {
              id: 'delivery-1',
              portCode: 'SGSIN',
              portName: 'Singapore',
              country: 'Singapore',
              scheduledDeliveryDate: new Date('2024-01-15T10:00:00Z'),
              deliveredAt: new Date('2024-01-15T11:00:00Z'),
            },
          ],
          vessel: {
            id: 'vessel-1',
            name: 'Test Vessel 1',
          },
        },
        {
          id: 'po-2',
          totalAmount: 15000,
          deliveries: [
            {
              id: 'delivery-2',
              portCode: 'NLRTM',
              portName: 'Rotterdam',
              country: 'Netherlands',
              scheduledDeliveryDate: new Date('2024-01-20T14:00:00Z'),
              deliveredAt: new Date('2024-01-20T16:30:00Z'),
            },
          ],
          vessel: {
            id: 'vessel-2',
            name: 'Test Vessel 2',
          },
        },
      ];

      mockPrisma.purchaseOrder.findMany.mockResolvedValue(mockPurchaseOrders);

      const result = await dashboardAnalyticsService.generatePortEfficiencyAnalytics(mockFilters);

      expect(result).toBeDefined();
      expect(result.overview).toBeDefined();
      expect(result.portRankings).toBeDefined();
      expect(result.logisticsOptimizations).toBeDefined();
      expect(result.seasonalForecasts).toBeDefined();
      expect(result.regionalAnalysis).toBeDefined();
      expect(result.alerts).toBeDefined();

      // Verify overview data
      expect(result.overview.totalPorts).toBeGreaterThan(0);
      expect(result.overview.totalDeliveries).toBe(2);
      expect(typeof result.overview.averageEfficiency).toBe('number');
      expect(typeof result.overview.overallOnTimeRate).toBe('number');

      // Verify port rankings
      expect(Array.isArray(result.portRankings)).toBe(true);
      if (result.portRankings.length > 0) {
        const port = result.portRankings[0];
        expect(port.portId).toBeDefined();
        expect(port.portName).toBeDefined();
        expect(port.country).toBeDefined();
        expect(port.region).toBeDefined();
        expect(typeof port.totalDeliveries).toBe('number');
        expect(typeof port.onTimeDeliveryRate).toBe('number');
        expect(typeof port.averageDeliveryTime).toBe('number');
        expect(typeof port.costEfficiency).toBe('number');
        expect(typeof port.rating).toBe('number');
      }

      // Verify logistics optimizations
      expect(Array.isArray(result.logisticsOptimizations)).toBe(true);
      if (result.logisticsOptimizations.length > 0) {
        const optimization = result.logisticsOptimizations[0];
        expect(optimization.id).toBeDefined();
        expect(optimization.type).toBeDefined();
        expect(optimization.title).toBeDefined();
        expect(optimization.description).toBeDefined();
        expect(typeof optimization.currentCost).toBe('number');
        expect(typeof optimization.optimizedCost).toBe('number');
        expect(typeof optimization.potentialSavings).toBe('number');
        expect(typeof optimization.savingsPercentage).toBe('number');
      }

      // Verify seasonal forecasts
      expect(Array.isArray(result.seasonalForecasts)).toBe(true);
      expect(result.seasonalForecasts).toHaveLength(12); // 12 months
      if (result.seasonalForecasts.length > 0) {
        const forecast = result.seasonalForecasts[0];
        expect(typeof forecast.month).toBe('number');
        expect(forecast.monthName).toBeDefined();
        expect(typeof forecast.demandMultiplier).toBe('number');
        expect(typeof forecast.predictedVolume).toBe('number');
        expect(typeof forecast.confidence).toBe('number');
        expect(Array.isArray(forecast.factors)).toBe(true);
        expect(Array.isArray(forecast.recommendations)).toBe(true);
      }

      // Verify regional analysis
      expect(Array.isArray(result.regionalAnalysis)).toBe(true);
      if (result.regionalAnalysis.length > 0) {
        const region = result.regionalAnalysis[0];
        expect(region.region).toBeDefined();
        expect(typeof region.portCount).toBe('number');
        expect(typeof region.averageEfficiency).toBe('number');
        expect(typeof region.totalVolume).toBe('number');
        expect(typeof region.costIndex).toBe('number');
        expect(Array.isArray(region.strengths)).toBe(true);
        expect(Array.isArray(region.challenges)).toBe(true);
        expect(Array.isArray(region.opportunities)).toBe(true);
      }

      // Verify alerts
      expect(Array.isArray(result.alerts)).toBe(true);
      if (result.alerts.length > 0) {
        const alert = result.alerts[0];
        expect(alert.id).toBeDefined();
        expect(alert.portId).toBeDefined();
        expect(alert.portName).toBeDefined();
        expect(alert.type).toBeDefined();
        expect(alert.severity).toBeDefined();
        expect(alert.message).toBeDefined();
        expect(alert.impact).toBeDefined();
        expect(alert.recommendedAction).toBeDefined();
        expect(alert.estimatedDuration).toBeDefined();
        expect(alert.createdAt).toBeInstanceOf(Date);
      }
    });

    it('should handle empty delivery data gracefully', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);

      const result = await dashboardAnalyticsService.generatePortEfficiencyAnalytics(mockFilters);

      expect(result).toBeDefined();
      expect(result.overview.totalPorts).toBe(0);
      expect(result.overview.totalDeliveries).toBe(0);
      expect(result.overview.averageEfficiency).toBe(0);
      expect(result.overview.overallOnTimeRate).toBe(0);
      expect(result.portRankings).toHaveLength(0);
    });

    it('should calculate on-time delivery rates correctly', async () => {
      const mockPurchaseOrders = [
        {
          id: 'po-1',
          totalAmount: 10000,
          deliveries: [
            {
              id: 'delivery-1',
              portCode: 'SGSIN',
              portName: 'Singapore',
              country: 'Singapore',
              scheduledDeliveryDate: new Date('2024-01-15T10:00:00Z'),
              deliveredAt: new Date('2024-01-15T10:30:00Z'), // 30 minutes late - on time
            },
          ],
          vessel: { id: 'vessel-1', name: 'Test Vessel 1' },
        },
        {
          id: 'po-2',
          totalAmount: 15000,
          deliveries: [
            {
              id: 'delivery-2',
              portCode: 'SGSIN',
              portName: 'Singapore',
              country: 'Singapore',
              scheduledDeliveryDate: new Date('2024-01-20T10:00:00Z'),
              deliveredAt: new Date('2024-01-22T10:00:00Z'), // 2 days late - not on time
            },
          ],
          vessel: { id: 'vessel-2', name: 'Test Vessel 2' },
        },
      ];

      mockPrisma.purchaseOrder.findMany.mockResolvedValue(mockPurchaseOrders);

      const result = await dashboardAnalyticsService.generatePortEfficiencyAnalytics(mockFilters);

      expect(result.overview.totalDeliveries).toBe(2);
      expect(result.overview.overallOnTimeRate).toBe(50); // 1 out of 2 deliveries on time
    });

    it('should generate seasonal patterns correctly', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);

      const result = await dashboardAnalyticsService.generatePortEfficiencyAnalytics(mockFilters);

      expect(result.seasonalForecasts).toHaveLength(12);
      
      // Check that seasonal multipliers are reasonable
      result.seasonalForecasts.forEach((forecast) => {
        expect(forecast.demandMultiplier).toBeGreaterThan(0);
        expect(forecast.demandMultiplier).toBeLessThan(2);
        expect(forecast.month).toBeGreaterThanOrEqual(1);
        expect(forecast.month).toBeLessThanOrEqual(12);
      });
    });

    it('should categorize ports by region correctly', async () => {
      const mockPurchaseOrders = [
        {
          id: 'po-1',
          totalAmount: 10000,
          deliveries: [
            {
              id: 'delivery-1',
              portCode: 'SGSIN',
              portName: 'Singapore',
              country: 'Singapore',
              scheduledDeliveryDate: new Date('2024-01-15T10:00:00Z'),
              deliveredAt: new Date('2024-01-15T11:00:00Z'),
            },
          ],
          vessel: { id: 'vessel-1', name: 'Test Vessel 1' },
        },
        {
          id: 'po-2',
          totalAmount: 15000,
          deliveries: [
            {
              id: 'delivery-2',
              portCode: 'NLRTM',
              portName: 'Rotterdam',
              country: 'Netherlands',
              scheduledDeliveryDate: new Date('2024-01-20T14:00:00Z'),
              deliveredAt: new Date('2024-01-20T16:30:00Z'),
            },
          ],
          vessel: { id: 'vessel-2', name: 'Test Vessel 2' },
        },
      ];

      mockPrisma.purchaseOrder.findMany.mockResolvedValue(mockPurchaseOrders);

      const result = await dashboardAnalyticsService.generatePortEfficiencyAnalytics(mockFilters);

      const singaporePort = result.portRankings.find(port => port.portId === 'SGSIN');
      const rotterdamPort = result.portRankings.find(port => port.portId === 'NLRTM');

      expect(singaporePort?.region).toBe('Asia Pacific');
      expect(rotterdamPort?.region).toBe('Europe');
    });

    it('should generate logistics optimization recommendations', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);

      const result = await dashboardAnalyticsService.generatePortEfficiencyAnalytics(mockFilters);

      expect(result.logisticsOptimizations.length).toBeGreaterThan(0);
      
      result.logisticsOptimizations.forEach((optimization) => {
        expect(optimization.currentCost).toBeGreaterThan(optimization.optimizedCost);
        expect(optimization.potentialSavings).toBe(optimization.currentCost - optimization.optimizedCost);
        expect(optimization.savingsPercentage).toBe(
          (optimization.potentialSavings / optimization.currentCost) * 100
        );
        expect(['route', 'timing', 'consolidation', 'alternative_port']).toContain(optimization.type);
        expect(['low', 'medium', 'high']).toContain(optimization.implementationComplexity);
        expect(['low', 'medium', 'high']).toContain(optimization.riskLevel);
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.purchaseOrder.findMany.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        dashboardAnalyticsService.generatePortEfficiencyAnalytics(mockFilters)
      ).rejects.toThrow('Database connection failed');
    });
  });
});