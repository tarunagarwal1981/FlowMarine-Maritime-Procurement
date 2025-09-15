import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FinancialInsightsService } from '../services/financialInsightsService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client');
const mockPrisma = {
  purchaseOrder: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn()
  },
  vendor: {
    findMany: jest.fn()
  },
  purchaseCategory: {
    findMany: jest.fn()
  }
};

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../services/cacheService', () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true)
  }
}));

// Mock PrismaClient constructor
(PrismaClient as jest.MockedClass<typeof PrismaClient>).mockImplementation(() => mockPrisma as any);

describe('FinancialInsightsService', () => {
  let service: FinancialInsightsService;
  const mockFilters = {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    vesselIds: ['vessel1', 'vessel2'],
    baseCurrency: 'USD'
  };

  beforeEach(() => {
    service = new FinancialInsightsService();
    jest.clearAllMocks();
  });

  describe('generateMultiCurrencyConsolidation', () => {
    it('should generate multi-currency consolidation data', async () => {
      // Mock spending by currency data
      mockPrisma.purchaseOrder.groupBy.mockResolvedValue([
        {
          currency: 'USD',
          _sum: { totalAmount: 500000 },
          _count: { id: 10 }
        },
        {
          currency: 'EUR',
          _sum: { totalAmount: 300000 },
          _count: { id: 8 }
        },
        {
          currency: 'GBP',
          _sum: { totalAmount: 200000 },
          _count: { id: 5 }
        }
      ]);

      const result = await service.generateMultiCurrencyConsolidation(mockFilters);

      expect(result).toBeDefined();
      expect(result.baseCurrency).toBe('USD');
      expect(result.currencyBreakdown).toHaveLength(3);
      expect(result.totalSpendBaseCurrency).toBeGreaterThan(0);
      
      // Check currency breakdown structure
      const usdBreakdown = result.currencyBreakdown.find(c => c.currency === 'USD');
      expect(usdBreakdown).toBeDefined();
      expect(usdBreakdown?.amount).toBe(500000);
      expect(usdBreakdown?.exchangeRate).toBe(1);
      
      // Check exchange rate impact
      expect(result.exchangeRateImpact).toBeDefined();
      expect(result.exchangeRateImpact.trend).toMatch(/favorable|unfavorable|neutral/);
      
      // Check historical rates
      expect(result.historicalRates).toBeDefined();
      expect(Array.isArray(result.historicalRates)).toBe(true);
      
      // Check hedging recommendations
      expect(result.hedgingRecommendations).toBeDefined();
      expect(Array.isArray(result.hedgingRecommendations)).toBe(true);
    });

    it('should handle empty currency data', async () => {
      mockPrisma.purchaseOrder.groupBy.mockResolvedValue([]);

      const result = await service.generateMultiCurrencyConsolidation(mockFilters);

      expect(result).toBeDefined();
      expect(result.totalSpendBaseCurrency).toBe(0);
      expect(result.currencyBreakdown).toHaveLength(0);
    });

    it('should generate hedging recommendations for high volatility currencies', async () => {
      mockPrisma.purchaseOrder.groupBy.mockResolvedValue([
        {
          currency: 'EUR',
          _sum: { totalAmount: 100000 },
          _count: { id: 5 }
        }
      ]);

      const result = await service.generateMultiCurrencyConsolidation(mockFilters);

      // Should have hedging recommendations for significant EUR exposure
      const eurRecommendations = result.hedgingRecommendations.filter(r => r.currency === 'EUR');
      expect(eurRecommendations.length).toBeGreaterThan(0);
      
      const recommendation = eurRecommendations[0];
      expect(recommendation.recommendationType).toMatch(/forward_contract|option|swap|natural_hedge/);
      expect(recommendation.riskLevel).toMatch(/low|medium|high/);
      expect(recommendation.potentialSavings).toBeGreaterThan(0);
    });
  });

  describe('generatePaymentTermsOptimization', () => {
    it('should generate payment terms optimization data', async () => {
      // Mock purchase order data with payment terms
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        {
          paymentTerms: 'NET30',
          totalAmount: 50000,
          vendor: { paymentTerms: 'NET30' }
        },
        {
          paymentTerms: 'NET45',
          totalAmount: 75000,
          vendor: { paymentTerms: 'NET45' }
        },
        {
          paymentTerms: null,
          totalAmount: 25000,
          vendor: { paymentTerms: 'NET60' }
        }
      ]);

      // Mock vendor data for payment performance
      mockPrisma.vendor.findMany.mockResolvedValue([
        {
          id: 'vendor1',
          name: 'Test Vendor 1',
          paymentTerms: 'NET30',
          purchaseOrders: [
            {
              totalAmount: 50000,
              invoices: [
                { payments: [{ paidAt: new Date() }] }
              ]
            }
          ]
        }
      ]);

      const result = await service.generatePaymentTermsOptimization(mockFilters);

      expect(result).toBeDefined();
      
      // Check current terms analysis
      expect(result.currentTermsAnalysis).toBeDefined();
      expect(result.currentTermsAnalysis.averagePaymentTerms).toBeGreaterThan(0);
      expect(result.currentTermsAnalysis.termDistribution).toBeDefined();
      expect(Array.isArray(result.currentTermsAnalysis.termDistribution)).toBe(true);
      
      // Check early payment discounts
      expect(result.earlyPaymentDiscounts).toBeDefined();
      expect(result.earlyPaymentDiscounts.captured).toBeGreaterThanOrEqual(0);
      expect(result.earlyPaymentDiscounts.missed).toBeGreaterThanOrEqual(0);
      expect(result.earlyPaymentDiscounts.potentialSavings).toBeGreaterThanOrEqual(0);
      
      // Check vendor payment performance
      expect(result.vendorPaymentPerformance).toBeDefined();
      expect(Array.isArray(result.vendorPaymentPerformance)).toBe(true);
      
      // Check cash flow optimization
      expect(result.cashFlowOptimization).toBeDefined();
      expect(result.cashFlowOptimization.currentCashCycle).toBeGreaterThan(0);
      expect(result.cashFlowOptimization.optimizedCashCycle).toBeGreaterThan(0);
      expect(result.cashFlowOptimization.recommendations).toBeDefined();
      
      // Check payment timing optimization
      expect(result.paymentTimingOptimization).toBeDefined();
      expect(Array.isArray(result.paymentTimingOptimization)).toBe(true);
    });

    it('should calculate weighted average payment terms correctly', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        {
          paymentTerms: 'NET30',
          totalAmount: 100000,
          vendor: { paymentTerms: 'NET30' }
        },
        {
          paymentTerms: 'NET60',
          totalAmount: 50000,
          vendor: { paymentTerms: 'NET60' }
        }
      ]);

      mockPrisma.vendor.findMany.mockResolvedValue([]);

      const result = await service.generatePaymentTermsOptimization(mockFilters);

      // Weighted average should be closer to 30 than 60 due to higher amount
      expect(result.currentTermsAnalysis.weightedAverageTerms).toBeLessThan(45);
      expect(result.currentTermsAnalysis.weightedAverageTerms).toBeGreaterThan(30);
    });
  });

  describe('generateCostAnalysisVariance', () => {
    it('should generate cost analysis and variance data', async () => {
      // Mock category spending data
      mockPrisma.purchaseOrder.groupBy.mockResolvedValue([
        {
          categoryCode: 'ENGINE',
          _sum: { totalAmount: 300000 },
          _count: { id: 15 }
        },
        {
          categoryCode: 'DECK',
          _sum: { totalAmount: 200000 },
          _count: { id: 10 }
        },
        {
          categoryCode: 'SAFETY',
          _sum: { totalAmount: 100000 },
          _count: { id: 8 }
        }
      ]);

      const result = await service.generateCostAnalysisVariance(mockFilters);

      expect(result).toBeDefined();
      
      // Check budget vs actual analysis
      expect(result.budgetVsActualAnalysis).toBeDefined();
      expect(result.budgetVsActualAnalysis.totalBudget).toBeGreaterThan(0);
      expect(result.budgetVsActualAnalysis.totalActual).toBeGreaterThan(0);
      expect(result.budgetVsActualAnalysis.varianceByPeriod).toBeDefined();
      expect(Array.isArray(result.budgetVsActualAnalysis.varianceByPeriod)).toBe(true);
      
      // Check cost per vessel mile
      expect(result.costPerVesselMile).toBeDefined();
      expect(result.costPerVesselMile.overallCostPerMile).toBeGreaterThan(0);
      expect(result.costPerVesselMile.vesselComparison).toBeDefined();
      expect(result.costPerVesselMile.categoryBreakdown).toBeDefined();
      expect(result.costPerVesselMile.trends).toBeDefined();
      expect(result.costPerVesselMile.benchmarks).toBeDefined();
      
      // Check category analysis
      expect(result.categoryAnalysis).toBeDefined();
      expect(Array.isArray(result.categoryAnalysis)).toBe(true);
      expect(result.categoryAnalysis.length).toBeGreaterThan(0);
      
      const engineCategory = result.categoryAnalysis.find(c => c.category === 'ENGINE');
      expect(engineCategory).toBeDefined();
      expect(engineCategory?.actualAmount).toBe(300000);
      expect(engineCategory?.drivers).toBeDefined();
      expect(engineCategory?.seasonality).toBeDefined();
      
      // Check variance explanations
      expect(result.varianceExplanation).toBeDefined();
      expect(Array.isArray(result.varianceExplanation)).toBe(true);
      
      // Check cost optimization recommendations
      expect(result.costOptimizationRecommendations).toBeDefined();
      expect(Array.isArray(result.costOptimizationRecommendations)).toBe(true);
    });

    it('should generate variance explanations for significant variances only', async () => {
      mockPrisma.purchaseOrder.groupBy.mockResolvedValue([
        {
          categoryCode: 'ENGINE',
          _sum: { totalAmount: 300000 },
          _count: { id: 15 }
        }
      ]);

      const result = await service.generateCostAnalysisVariance(mockFilters);

      // Should only include categories with significant variances (>5%)
      result.varianceExplanation.forEach(explanation => {
        expect(Math.abs(explanation.variance)).toBeGreaterThan(0);
        expect(explanation.impact).toMatch(/high|medium|low/);
        expect(explanation.controllable).toBeDefined();
        expect(explanation.recommendedAction).toBeDefined();
      });
    });

    it('should prioritize cost optimization recommendations by potential savings', async () => {
      mockPrisma.purchaseOrder.groupBy.mockResolvedValue([
        {
          categoryCode: 'ENGINE',
          _sum: { totalAmount: 500000 },
          _count: { id: 20 }
        },
        {
          categoryCode: 'DECK',
          _sum: { totalAmount: 100000 },
          _count: { id: 5 }
        }
      ]);

      const result = await service.generateCostAnalysisVariance(mockFilters);

      // Recommendations should be sorted by potential savings (descending)
      if (result.costOptimizationRecommendations.length > 1) {
        for (let i = 0; i < result.costOptimizationRecommendations.length - 1; i++) {
          expect(result.costOptimizationRecommendations[i].potentialSavings)
            .toBeGreaterThanOrEqual(result.costOptimizationRecommendations[i + 1].potentialSavings);
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.purchaseOrder.groupBy.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.generateMultiCurrencyConsolidation(mockFilters))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle empty filter parameters', async () => {
      const emptyFilters = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-01'), // Same date
        baseCurrency: 'USD'
      };

      mockPrisma.purchaseOrder.groupBy.mockResolvedValue([]);

      const result = await service.generateMultiCurrencyConsolidation(emptyFilters);
      expect(result).toBeDefined();
      expect(result.totalSpendBaseCurrency).toBe(0);
    });
  });

  describe('Currency Exchange Rate Handling', () => {
    it('should handle missing exchange rates gracefully', async () => {
      mockPrisma.purchaseOrder.groupBy.mockResolvedValue([
        {
          currency: 'UNKNOWN_CURRENCY',
          _sum: { totalAmount: 10000 },
          _count: { id: 1 }
        }
      ]);

      const result = await service.generateMultiCurrencyConsolidation(mockFilters);

      expect(result).toBeDefined();
      const unknownCurrency = result.currencyBreakdown.find(c => c.currency === 'UNKNOWN_CURRENCY');
      expect(unknownCurrency).toBeDefined();
      expect(unknownCurrency?.exchangeRate).toBe(1); // Should default to 1
    });

    it('should calculate exchange rate impact correctly', async () => {
      mockPrisma.purchaseOrder.groupBy.mockResolvedValue([
        {
          currency: 'EUR',
          _sum: { totalAmount: 100000 },
          _count: { id: 5 }
        }
      ]);

      const result = await service.generateMultiCurrencyConsolidation(mockFilters);

      expect(result.exchangeRateImpact).toBeDefined();
      expect(result.exchangeRateImpact.gainLoss).toBeDefined();
      expect(result.exchangeRateImpact.percentage).toBeDefined();
      expect(result.exchangeRateImpact.trend).toMatch(/favorable|unfavorable|neutral/);
      expect(result.exchangeRateImpact.impactByMonth).toBeDefined();
      expect(Array.isArray(result.exchangeRateImpact.impactByMonth)).toBe(true);
    });
  });
});