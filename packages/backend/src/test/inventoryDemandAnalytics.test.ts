import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import InventoryDemandAnalyticsService from '../services/inventoryDemandAnalyticsService';
import { InventoryDemandFilters } from '../types/analytics';

// Mock Prisma Client
jest.mock('@prisma/client');
const mockPrisma = {
  $queryRaw: jest.fn(),
  inventoryItems: {
    findMany: jest.fn(),
    count: jest.fn()
  },
  requisitions: {
    findMany: jest.fn()
  },
  vesselMaintenance: {
    findMany: jest.fn()
  }
};

// Mock the PrismaClient constructor
(PrismaClient as jest.MockedClass<typeof PrismaClient>).mockImplementation(() => mockPrisma as any);

describe('InventoryDemandAnalyticsService', () => {
  let service: InventoryDemandAnalyticsService;
  let mockFilters: InventoryDemandFilters;

  beforeEach(() => {
    service = new InventoryDemandAnalyticsService();
    mockFilters = {
      vesselIds: ['vessel1', 'vessel2'],
      timeRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      },
      categories: ['Engine Parts', 'Safety Equipment']
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getInventoryTurnoverAnalysis', () => {
    it('should return inventory turnover data with category breakdown', async () => {
      const mockInventoryData = [
        {
          category: 'Engine Parts',
          item_count: '25',
          total_value: '150000.00',
          avg_turnover_rate: '4.2',
          target_rate: '6.0',
          slow_moving_value: '25000.00'
        },
        {
          category: 'Safety Equipment',
          item_count: '15',
          total_value: '75000.00',
          avg_turnover_rate: '8.1',
          target_rate: '6.0',
          slow_moving_value: '5000.00'
        }
      ];

      const mockSlowMovingItems = [
        {
          item_id: 'item1',
          item_name: 'Spare Propeller',
          category: 'Engine Parts',
          days_in_stock: '365',
          value: '25000.00',
          last_movement: new Date('2023-01-01'),
          recommended_action: 'liquidate'
        }
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockInventoryData)
        .mockResolvedValueOnce(mockSlowMovingItems);

      const result = await service.getInventoryTurnoverAnalysis(mockFilters);

      expect(result).toHaveProperty('categoryTurnover');
      expect(result).toHaveProperty('valueDistribution');
      expect(result).toHaveProperty('slowMovingItems');
      expect(result).toHaveProperty('overallMetrics');

      expect(result.categoryTurnover).toHaveLength(2);
      expect(result.categoryTurnover[0]).toMatchObject({
        category: 'Engine Parts',
        turnoverRate: 4.2,
        targetRate: 6.0,
        variance: -1.8,
        totalValue: 150000
      });

      expect(result.slowMovingItems).toHaveLength(1);
      expect(result.slowMovingItems[0]).toMatchObject({
        itemId: 'item1',
        itemName: 'Spare Propeller',
        category: 'Engine Parts',
        daysInStock: 365,
        value: 25000,
        recommendedAction: 'liquidate'
      });

      expect(result.overallMetrics.totalInventoryValue).toBe(225000);
      expect(result.overallMetrics.averageTurnoverRate).toBeCloseTo(6.15);
    });

    it('should handle empty inventory data', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getInventoryTurnoverAnalysis(mockFilters);

      expect(result.categoryTurnover).toHaveLength(0);
      expect(result.slowMovingItems).toHaveLength(0);
      expect(result.overallMetrics.totalInventoryValue).toBe(0);
      expect(result.overallMetrics.averageTurnoverRate).toBe(0);
    });

    it('should apply vessel filters correctly', async () => {
      const filtersWithVessel = {
        ...mockFilters,
        selectedVessel: 'vessel1'
      };

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getInventoryTurnoverAnalysis(filtersWithVessel);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
      // Verify that the query includes vessel filtering
      const firstCall = mockPrisma.$queryRaw.mock.calls[0];
      expect(firstCall[0]).toContain('vessel_id');
    });
  });

  describe('getDemandForecast', () => {
    it('should return demand forecast with seasonal patterns', async () => {
      const mockHistoricalDemand = [
        {
          month: 1,
          month_name: 'Jan',
          category: 'Engine Parts',
          total_demand: '100',
          avg_demand: '10'
        },
        {
          month: 2,
          month_name: 'Feb',
          category: 'Engine Parts',
          total_demand: '90',
          avg_demand: '9'
        }
      ];

      mockPrisma.$queryRaw.mockResolvedValueOnce(mockHistoricalDemand);

      const result = await service.getDemandForecast(mockFilters);

      expect(result).toHaveProperty('seasonalPatterns');
      expect(result).toHaveProperty('categoryForecast');
      expect(result).toHaveProperty('accuracy');
      expect(result).toHaveProperty('meanAbsoluteError');
      expect(result).toHaveProperty('trendDirection');
      expect(result).toHaveProperty('forecastHorizon');

      expect(result.seasonalPatterns).toBeInstanceOf(Array);
      expect(result.categoryForecast).toBeInstanceOf(Array);
      expect(result.accuracy).toBe(0.87);
      expect(result.meanAbsoluteError).toBe(12.5);
      expect(result.forecastHorizon).toBe(12);
      expect(['increasing', 'decreasing', 'stable']).toContain(result.trendDirection);
    });

    it('should calculate seasonal patterns correctly', async () => {
      const mockHistoricalDemand = [
        {
          month: 1,
          month_name: 'Jan',
          category: 'Engine Parts',
          total_demand: '100',
          avg_demand: '10'
        }
      ];

      mockPrisma.$queryRaw.mockResolvedValueOnce(mockHistoricalDemand);

      const result = await service.getDemandForecast(mockFilters);

      expect(result.seasonalPatterns).toHaveLength(1);
      const janPattern = result.seasonalPatterns[0];
      expect(janPattern.month).toBe('Jan');
      expect(janPattern.historicalDemand).toBe(100);
      expect(janPattern.forecastedDemand).toBe(110); // 10% growth
      expect(janPattern.confidence).toBe(85);
      expect(janPattern.seasonalIndex).toBe(0.9); // January seasonal factor
    });
  });

  describe('getOptimizationRecommendations', () => {
    it('should return optimization recommendations', async () => {
      const mockStockAnalysis = [
        {
          item_id: 'item1',
          item_name: 'Engine Oil Filter',
          category: 'Engine Parts',
          current_stock: '50',
          reorder_point: '20',
          safety_stock: '10',
          economic_order_quantity: '25',
          unit_cost: '100.00',
          stock_status: 'overstocked'
        },
        {
          item_id: 'item2',
          item_name: 'Life Jacket',
          category: 'Safety Equipment',
          current_stock: '15',
          reorder_point: '20',
          safety_stock: '10',
          economic_order_quantity: '30',
          unit_cost: '50.00',
          stock_status: 'understocked'
        }
      ];

      mockPrisma.$queryRaw.mockResolvedValueOnce(mockStockAnalysis);

      const result = await service.getOptimizationRecommendations(mockFilters);

      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('optimalStockLevels');
      expect(result).toHaveProperty('potentialSavings');
      expect(result).toHaveProperty('implementationPriority');

      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.optimalStockLevels).toHaveLength(2);
      expect(result.potentialSavings).toBeGreaterThan(0);

      // Check overstocked item generates recommendation
      const overstockedRec = result.recommendations.find(r => r.title.includes('Engine Oil Filter'));
      expect(overstockedRec).toBeDefined();
      expect(overstockedRec?.category).toBe('stock_reduction');
      expect(overstockedRec?.potentialSavings).toBeGreaterThan(0);

      // Check optimal stock levels
      const engineFilterStock = result.optimalStockLevels.find(s => s.itemName === 'Engine Oil Filter');
      expect(engineFilterStock).toMatchObject({
        itemName: 'Engine Oil Filter',
        currentStock: 50,
        optimalStock: 30, // 1.5 * reorder_point
        reorderPoint: 20,
        variance: 20
      });
    });

    it('should prioritize recommendations correctly', async () => {
      const mockStockAnalysis = [
        {
          item_id: 'item1',
          item_name: 'High Value Item',
          category: 'Engine Parts',
          current_stock: '100',
          reorder_point: '20',
          safety_stock: '10',
          economic_order_quantity: '25',
          unit_cost: '1000.00',
          stock_status: 'overstocked'
        }
      ];

      mockPrisma.$queryRaw.mockResolvedValueOnce(mockStockAnalysis);

      const result = await service.getOptimizationRecommendations(mockFilters);

      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].impact).toBe('high'); // High value item should have high impact
      expect(result.implementationPriority[0].score).toBe(90); // High impact should get high score
    });
  });

  describe('getStockAlerts', () => {
    it('should return stock alerts with proper severity classification', async () => {
      const mockAlerts = [
        {
          id: 'alert1',
          item_id: 'item1',
          item_name: 'Life Jacket',
          vessel_id: 'vessel1',
          vessel_name: 'MV Ocean Explorer',
          category: 'Safety Equipment',
          current_stock: '5',
          reorder_point: '20',
          safety_stock: '10',
          severity: 'critical',
          alert_type: 'low_stock',
          created_at: new Date('2024-02-01')
        },
        {
          id: 'alert2',
          item_id: 'item2',
          item_name: 'Engine Oil',
          vessel_id: 'vessel1',
          vessel_name: 'MV Ocean Explorer',
          category: 'Engine Parts',
          current_stock: '15',
          reorder_point: '20',
          safety_stock: '10',
          severity: 'warning',
          alert_type: 'reorder_needed',
          created_at: new Date('2024-02-01')
        }
      ];

      mockPrisma.$queryRaw.mockResolvedValueOnce(mockAlerts);

      const result = await service.getStockAlerts(mockFilters);

      expect(result).toHaveProperty('criticalAlerts');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('trends');

      expect(result.criticalAlerts).toHaveLength(2);
      expect(result.summary.totalAlerts).toBe(2);
      expect(result.summary.criticalCount).toBe(1);
      expect(result.summary.warningCount).toBe(1);

      const criticalAlert = result.criticalAlerts.find(a => a.severity === 'critical');
      expect(criticalAlert).toMatchObject({
        itemName: 'Life Jacket',
        vesselName: 'MV Ocean Explorer',
        severity: 'critical',
        type: 'low_stock',
        currentStock: 5,
        reorderPoint: 20
      });

      expect(criticalAlert?.message).toContain('Critical');
      expect(criticalAlert?.recommendedAction).toContain('immediately');
      expect(criticalAlert?.estimatedStockoutDate).toBeInstanceOf(Date);
    });

    it('should generate alert trends', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.getStockAlerts(mockFilters);

      expect(result.trends).toBeInstanceOf(Array);
      expect(result.trends.length).toBeGreaterThan(0);
      result.trends.forEach(trend => {
        expect(trend).toHaveProperty('date');
        expect(trend).toHaveProperty('criticalAlerts');
        expect(trend).toHaveProperty('warningAlerts');
        expect(trend).toHaveProperty('totalAlerts');
      });
    });
  });

  describe('getPredictiveMaintenanceData', () => {
    it('should return predictive maintenance data', async () => {
      const mockMaintenanceNeeds = [
        {
          id: 'maint1',
          vessel_id: 'vessel1',
          vessel_name: 'MV Ocean Explorer',
          equipment_id: 'engine1',
          equipment_name: 'Main Engine',
          predicted_date: new Date('2024-03-15'),
          maintenance_type: 'preventive',
          estimated_cost: '25000.00',
          confidence_score: '85',
          urgency: 'high',
          risk_if_delayed: 'high'
        }
      ];

      mockPrisma.$queryRaw.mockResolvedValueOnce(mockMaintenanceNeeds);

      const result = await service.getPredictiveMaintenanceData(mockFilters);

      expect(result).toHaveProperty('upcomingNeeds');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('costProjections');
      expect(result).toHaveProperty('riskAssessment');

      expect(result.upcomingNeeds).toHaveLength(1);
      expect(result.upcomingNeeds[0]).toMatchObject({
        id: 'maint1',
        vesselId: 'vessel1',
        vesselName: 'MV Ocean Explorer',
        equipmentName: 'Main Engine',
        urgency: 'high',
        estimatedCost: 25000,
        maintenanceType: 'preventive',
        riskIfDelayed: 'high'
      });

      expect(result.summary.totalUpcomingMaintenance).toBe(1);
      expect(result.summary.totalEstimatedCost).toBe(25000);
      expect(result.summary.highRiskItems).toBe(1);

      expect(result.costProjections).toBeInstanceOf(Array);
      expect(result.riskAssessment).toBeInstanceOf(Array);
    });

    it('should categorize maintenance urgency correctly', async () => {
      const now = new Date();
      const mockMaintenanceNeeds = [
        {
          id: 'maint1',
          vessel_id: 'vessel1',
          vessel_name: 'MV Ocean Explorer',
          equipment_id: 'engine1',
          equipment_name: 'Main Engine',
          predicted_date: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
          maintenance_type: 'preventive',
          estimated_cost: '25000.00',
          confidence_score: '85',
          urgency: 'high', // Should be high (within 30 days)
          risk_if_delayed: 'high'
        },
        {
          id: 'maint2',
          vessel_id: 'vessel1',
          vessel_name: 'MV Ocean Explorer',
          equipment_id: 'engine2',
          equipment_name: 'Auxiliary Engine',
          predicted_date: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
          maintenance_type: 'preventive',
          estimated_cost: '15000.00',
          confidence_score: '80',
          urgency: 'medium', // Should be medium (within 90 days)
          risk_if_delayed: 'medium'
        }
      ];

      mockPrisma.$queryRaw.mockResolvedValueOnce(mockMaintenanceNeeds);

      const result = await service.getPredictiveMaintenanceData(mockFilters);

      expect(result.summary.next30Days).toBe(1);
      expect(result.summary.next90Days).toBe(2);

      const highUrgencyItem = result.upcomingNeeds.find(n => n.urgency === 'high');
      const mediumUrgencyItem = result.upcomingNeeds.find(n => n.urgency === 'medium');

      expect(highUrgencyItem).toBeDefined();
      expect(mediumUrgencyItem).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(service.getInventoryTurnoverAnalysis(mockFilters))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle null/undefined filter values', async () => {
      const emptyFilters: InventoryDemandFilters = {
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31')
        }
      };

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getInventoryTurnoverAnalysis(emptyFilters);

      expect(result).toBeDefined();
      expect(result.categoryTurnover).toHaveLength(0);
    });
  });

  describe('Data Validation', () => {
    it('should validate and sanitize numeric values', async () => {
      const mockInventoryData = [
        {
          category: 'Engine Parts',
          item_count: 'invalid',
          total_value: null,
          avg_turnover_rate: 'NaN',
          target_rate: '6.0',
          slow_moving_value: undefined
        }
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockInventoryData)
        .mockResolvedValueOnce([]);

      const result = await service.getInventoryTurnoverAnalysis(mockFilters);

      expect(result.categoryTurnover[0].turnoverRate).toBe(0); // Should default to 0 for invalid values
      expect(result.categoryTurnover[0].totalValue).toBe(0); // Should default to 0 for null values
    });
  });
});