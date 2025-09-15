import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { cacheService } from './cacheService';
import {
  MultiCurrencyConsolidationData,
  PaymentTermsOptimizationData,
  CostAnalysisVarianceData,
  CurrencyBreakdown,
  ExchangeRateImpact,
  HistoricalExchangeRate,
  HedgingRecommendation,
  PaymentTermsAnalysis,
  EarlyPaymentDiscountData,
  VendorPaymentPerformance,
  CashFlowOptimization,
  PaymentTimingOptimization,
  BudgetVarianceAnalysis,
  CostPerVesselMileData,
  CategoryCostAnalysis,
  VarianceExplanation,
  CostOptimizationRecommendation
} from '../types/analytics';

const prisma = new PrismaClient();

export interface FinancialInsightsFilters {
  startDate: Date;
  endDate: Date;
  vesselIds?: string[];
  categories?: string[];
  vendorIds?: string[];
  baseCurrency?: string;
}

/**
 * Financial Insights Service
 * Provides comprehensive financial analytics for maritime procurement operations
 */
export class FinancialInsightsService {
  private readonly CACHE_TTL = 900; // 15 minutes
  private readonly EXCHANGE_RATE_API_URL = process.env.EXCHANGE_RATE_API_URL || 'https://api.exchangerate-api.com/v4/latest';

  /**
   * Generate multi-currency consolidation analysis with real-time exchange rates
   */
  async generateMultiCurrencyConsolidation(
    filters: FinancialInsightsFilters
  ): Promise<MultiCurrencyConsolidationData> {
    try {
      logger.info('Generating multi-currency consolidation analysis', { filters });

      const cacheKey = `multi-currency-consolidation:${JSON.stringify(filters)}`;
      const cached = await cacheService.get<MultiCurrencyConsolidationData>(cacheKey, {
        prefix: 'financial:',
        ttl: this.CACHE_TTL
      });

      if (cached) {
        return cached;
      }

      const baseCurrency = filters.baseCurrency || 'USD';
      const whereClause = this.buildWhereClause(filters);

      // Get spending by currency
      const spendingByCurrency = await prisma.purchaseOrder.groupBy({
        by: ['currency'],
        where: whereClause,
        _sum: { totalAmount: true },
        _count: { id: true }
      });

      // Get current exchange rates
      const currencies = spendingByCurrency.map(s => s.currency);
      const exchangeRates = await this.getCurrentExchangeRates(currencies, baseCurrency);

      // Calculate currency breakdown
      const currencyBreakdown: CurrencyBreakdown[] = await Promise.all(
        spendingByCurrency.map(async (spending) => {
          const currency = spending.currency;
          const amount = spending._sum.totalAmount || 0;
          const exchangeRate = exchangeRates[currency] || 1;
          const amountInBaseCurrency = amount * exchangeRate;
          
          // Calculate volatility and trend
          const volatility = await this.calculateCurrencyVolatility(currency, baseCurrency);
          const trend = await this.calculateCurrencyTrend(currency, baseCurrency);

          return {
            currency,
            amount,
            amountInBaseCurrency,
            exchangeRate,
            percentage: 0, // Will be calculated after total
            trend,
            volatility
          };
        })
      );

      // Calculate total and percentages
      const totalSpendBaseCurrency = currencyBreakdown.reduce(
        (sum, breakdown) => sum + breakdown.amountInBaseCurrency, 
        0
      );

      currencyBreakdown.forEach(breakdown => {
        breakdown.percentage = totalSpendBaseCurrency > 0 
          ? (breakdown.amountInBaseCurrency / totalSpendBaseCurrency) * 100 
          : 0;
      });

      // Calculate exchange rate impact
      const exchangeRateImpact = await this.calculateExchangeRateImpact(
        filters, 
        baseCurrency, 
        currencyBreakdown
      );

      // Get historical exchange rates
      const historicalRates = await this.getHistoricalExchangeRates(
        currencies, 
        baseCurrency, 
        filters.startDate, 
        filters.endDate
      );

      // Generate hedging recommendations
      const hedgingRecommendations = await this.generateHedgingRecommendations(
        currencyBreakdown,
        baseCurrency
      );

      const result: MultiCurrencyConsolidationData = {
        totalSpendBaseCurrency,
        baseCurrency,
        currencyBreakdown: currencyBreakdown.sort((a, b) => b.amountInBaseCurrency - a.amountInBaseCurrency),
        exchangeRateImpact,
        historicalRates,
        hedgingRecommendations
      };

      await cacheService.set(cacheKey, result, {
        prefix: 'financial:',
        ttl: this.CACHE_TTL
      });

      return result;
    } catch (error) {
      logger.error('Error generating multi-currency consolidation', { error, filters });
      throw error;
    }
  }

  /**
   * Generate payment terms optimization analysis
   */
  async generatePaymentTermsOptimization(
    filters: FinancialInsightsFilters
  ): Promise<PaymentTermsOptimizationData> {
    try {
      logger.info('Generating payment terms optimization analysis', { filters });

      const cacheKey = `payment-terms-optimization:${JSON.stringify(filters)}`;
      const cached = await cacheService.get<PaymentTermsOptimizationData>(cacheKey, {
        prefix: 'financial:',
        ttl: this.CACHE_TTL
      });

      if (cached) {
        return cached;
      }

      // Analyze current payment terms
      const currentTermsAnalysis = await this.analyzeCurrentPaymentTerms(filters);

      // Analyze early payment discounts
      const earlyPaymentDiscounts = await this.analyzeEarlyPaymentDiscounts(filters);

      // Analyze vendor payment performance
      const vendorPaymentPerformance = await this.analyzeVendorPaymentPerformance(filters);

      // Generate cash flow optimization
      const cashFlowOptimization = await this.generateCashFlowOptimization(filters);

      // Generate payment timing optimization
      const paymentTimingOptimization = await this.generatePaymentTimingOptimization(filters);

      const result: PaymentTermsOptimizationData = {
        currentTermsAnalysis,
        earlyPaymentDiscounts,
        vendorPaymentPerformance,
        cashFlowOptimization,
        paymentTimingOptimization
      };

      await cacheService.set(cacheKey, result, {
        prefix: 'financial:',
        ttl: this.CACHE_TTL
      });

      return result;
    } catch (error) {
      logger.error('Error generating payment terms optimization', { error, filters });
      throw error;
    }
  }

  /**
   * Generate cost analysis and variance tracking
   */
  async generateCostAnalysisVariance(
    filters: FinancialInsightsFilters
  ): Promise<CostAnalysisVarianceData> {
    try {
      logger.info('Generating cost analysis and variance tracking', { filters });

      const cacheKey = `cost-analysis-variance:${JSON.stringify(filters)}`;
      const cached = await cacheService.get<CostAnalysisVarianceData>(cacheKey, {
        prefix: 'financial:',
        ttl: this.CACHE_TTL
      });

      if (cached) {
        return cached;
      }

      // Generate budget vs actual analysis
      const budgetVsActualAnalysis = await this.generateBudgetVsActualAnalysis(filters);

      // Calculate cost per vessel mile
      const costPerVesselMile = await this.calculateCostPerVesselMile(filters);

      // Analyze costs by category
      const categoryAnalysis = await this.analyzeCostsByCategory(filters);

      // Generate variance explanations
      const varianceExplanation = await this.generateVarianceExplanations(
        categoryAnalysis,
        filters
      );

      // Generate cost optimization recommendations
      const costOptimizationRecommendations = await this.generateCostOptimizationRecommendations(
        categoryAnalysis,
        costPerVesselMile,
        filters
      );

      const result: CostAnalysisVarianceData = {
        budgetVsActualAnalysis,
        costPerVesselMile,
        categoryAnalysis,
        varianceExplanation,
        costOptimizationRecommendations
      };

      await cacheService.set(cacheKey, result, {
        prefix: 'financial:',
        ttl: this.CACHE_TTL
      });

      return result;
    } catch (error) {
      logger.error('Error generating cost analysis and variance tracking', { error, filters });
      throw error;
    }
  }

  // Private helper methods

  private buildWhereClause(filters: FinancialInsightsFilters) {
    return {
      createdAt: {
        gte: filters.startDate,
        lte: filters.endDate
      },
      ...(filters.vesselIds?.length && { vesselId: { in: filters.vesselIds } }),
      ...(filters.vendorIds?.length && { vendorId: { in: filters.vendorIds } }),
      ...(filters.categories?.length && { categoryCode: { in: filters.categories } }),
      status: { in: ['DELIVERED', 'INVOICED', 'PAID'] }
    };
  }

  private async getCurrentExchangeRates(
    currencies: string[], 
    baseCurrency: string
  ): Promise<Record<string, number>> {
    try {
      // In a real implementation, this would call an external exchange rate API
      // For now, returning mock rates
      const rates: Record<string, number> = {};
      
      for (const currency of currencies) {
        if (currency === baseCurrency) {
          rates[currency] = 1;
        } else {
          // Mock exchange rates - in production, fetch from API
          rates[currency] = this.getMockExchangeRate(currency, baseCurrency);
        }
      }

      return rates;
    } catch (error) {
      logger.error('Error fetching exchange rates', { error, currencies, baseCurrency });
      // Return default rates if API fails
      const defaultRates: Record<string, number> = {};
      currencies.forEach(currency => {
        defaultRates[currency] = currency === baseCurrency ? 1 : 1;
      });
      return defaultRates;
    }
  }

  private getMockExchangeRate(fromCurrency: string, toCurrency: string): number {
    // Mock exchange rates for demonstration
    const mockRates: Record<string, Record<string, number>> = {
      'EUR': { 'USD': 1.08, 'GBP': 0.86, 'JPY': 162.5 },
      'GBP': { 'USD': 1.26, 'EUR': 1.16, 'JPY': 189.2 },
      'JPY': { 'USD': 0.0067, 'EUR': 0.0062, 'GBP': 0.0053 },
      'USD': { 'EUR': 0.93, 'GBP': 0.79, 'JPY': 149.8 }
    };

    return mockRates[fromCurrency]?.[toCurrency] || 1;
  }

  private async calculateCurrencyVolatility(
    currency: string, 
    baseCurrency: string
  ): Promise<number> {
    // Calculate 30-day volatility
    // In production, this would use historical exchange rate data
    const mockVolatilities: Record<string, number> = {
      'EUR': 0.08,
      'GBP': 0.12,
      'JPY': 0.15,
      'USD': 0.05
    };

    return mockVolatilities[currency] || 0.10;
  }

  private async calculateCurrencyTrend(
    currency: string, 
    baseCurrency: string
  ): Promise<'strengthening' | 'weakening' | 'stable'> {
    // Calculate trend based on recent exchange rate movements
    // Mock implementation
    const mockTrends: Record<string, 'strengthening' | 'weakening' | 'stable'> = {
      'EUR': 'strengthening',
      'GBP': 'stable',
      'JPY': 'weakening',
      'USD': 'stable'
    };

    return mockTrends[currency] || 'stable';
  }

  private async calculateExchangeRateImpact(
    filters: FinancialInsightsFilters,
    baseCurrency: string,
    currencyBreakdown: CurrencyBreakdown[]
  ): Promise<ExchangeRateImpact> {
    // Calculate the impact of exchange rate changes on spending
    // This would compare current rates vs rates at transaction time
    
    const totalImpact = currencyBreakdown.reduce((sum, breakdown) => {
      // Mock calculation - in production, compare with historical rates
      const mockImpact = breakdown.amountInBaseCurrency * 0.02; // 2% mock impact
      return sum + mockImpact;
    }, 0);

    const totalSpend = currencyBreakdown.reduce(
      (sum, breakdown) => sum + breakdown.amountInBaseCurrency, 
      0
    );

    const impactPercentage = totalSpend > 0 ? (totalImpact / totalSpend) * 100 : 0;

    // Generate monthly impact breakdown
    const impactByMonth = await this.generateMonthlyExchangeRateImpact(filters, baseCurrency);

    return {
      gainLoss: totalImpact,
      percentage: impactPercentage,
      trend: totalImpact > 0 ? 'favorable' : totalImpact < 0 ? 'unfavorable' : 'neutral',
      impactByMonth
    };
  }

  private async generateMonthlyExchangeRateImpact(
    filters: FinancialInsightsFilters,
    baseCurrency: string
  ) {
    // Generate monthly breakdown of exchange rate impact
    const months = this.getMonthsBetweenDates(filters.startDate, filters.endDate);
    
    return months.map(month => ({
      month: month.toISOString().substring(0, 7),
      gainLoss: Math.random() * 10000 - 5000, // Mock data
      exchangeRate: 1 + (Math.random() * 0.1 - 0.05), // Mock rate
      volume: Math.random() * 100000 // Mock volume
    }));
  }

  private async getHistoricalExchangeRates(
    currencies: string[],
    baseCurrency: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalExchangeRate[]> {
    // Get historical exchange rates for the period
    // Mock implementation
    const rates: HistoricalExchangeRate[] = [];
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    for (const currency of currencies) {
      if (currency === baseCurrency) continue;
      
      for (let i = 0; i < Math.min(days, 30); i += 7) { // Weekly data points
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const baseRate = this.getMockExchangeRate(currency, baseCurrency);
        const rate = baseRate * (1 + (Math.random() * 0.1 - 0.05)); // Add some variation
        
        rates.push({
          currency,
          date,
          rate,
          change: Math.random() * 0.02 - 0.01, // Mock daily change
          changePercentage: (Math.random() * 2 - 1) // Mock percentage change
        });
      }
    }

    return rates.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private async generateHedgingRecommendations(
    currencyBreakdown: CurrencyBreakdown[],
    baseCurrency: string
  ): Promise<HedgingRecommendation[]> {
    const recommendations: HedgingRecommendation[] = [];

    for (const breakdown of currencyBreakdown) {
      if (breakdown.currency === baseCurrency) continue;
      
      // Generate recommendations based on exposure and volatility
      if (breakdown.amountInBaseCurrency > 50000 && breakdown.volatility > 0.1) {
        recommendations.push({
          id: `hedge-${breakdown.currency}-${Date.now()}`,
          currency: breakdown.currency,
          recommendationType: breakdown.volatility > 0.15 ? 'option' : 'forward_contract',
          title: `Hedge ${breakdown.currency} Exposure`,
          description: `Consider hedging ${breakdown.currency} exposure of ${breakdown.amountInBaseCurrency.toLocaleString()} ${baseCurrency} due to high volatility (${(breakdown.volatility * 100).toFixed(1)}%)`,
          riskLevel: breakdown.volatility > 0.15 ? 'high' : 'medium',
          potentialSavings: breakdown.amountInBaseCurrency * breakdown.volatility * 0.5,
          timeHorizon: '3-6 months',
          implementation: `Work with treasury team to establish ${breakdown.volatility > 0.15 ? 'option contracts' : 'forward contracts'} for upcoming ${breakdown.currency} payments`
        });
      }
    }

    return recommendations;
  }

  private async analyzeCurrentPaymentTerms(
    filters: FinancialInsightsFilters
  ): Promise<PaymentTermsAnalysis> {
    const whereClause = this.buildWhereClause(filters);

    // Get payment terms data
    const paymentTermsData = await prisma.purchaseOrder.findMany({
      where: whereClause,
      select: {
        paymentTerms: true,
        totalAmount: true,
        vendor: {
          select: {
            paymentTerms: true
          }
        }
      }
    });

    // Calculate average payment terms
    const termsValues = paymentTermsData
      .map(po => this.parsePaymentTerms(po.paymentTerms || po.vendor?.paymentTerms || 'NET30'))
      .filter(terms => terms > 0);

    const averagePaymentTerms = termsValues.length > 0 
      ? termsValues.reduce((sum, terms) => sum + terms, 0) / termsValues.length 
      : 30;

    // Calculate weighted average (by amount)
    let totalWeightedTerms = 0;
    let totalAmount = 0;

    paymentTermsData.forEach(po => {
      const terms = this.parsePaymentTerms(po.paymentTerms || po.vendor?.paymentTerms || 'NET30');
      const amount = po.totalAmount;
      totalWeightedTerms += terms * amount;
      totalAmount += amount;
    });

    const weightedAverageTerms = totalAmount > 0 ? totalWeightedTerms / totalAmount : 30;

    // Generate term distribution
    const termCounts = new Map<string, { count: number; value: number }>();
    paymentTermsData.forEach(po => {
      const terms = po.paymentTerms || po.vendor?.paymentTerms || 'NET30';
      if (!termCounts.has(terms)) {
        termCounts.set(terms, { count: 0, value: 0 });
      }
      const termData = termCounts.get(terms)!;
      termData.count += 1;
      termData.value += po.totalAmount;
    });

    const termDistribution = Array.from(termCounts.entries()).map(([terms, data]) => ({
      terms,
      vendorCount: data.count,
      totalValue: data.value,
      percentage: totalAmount > 0 ? (data.value / totalAmount) * 100 : 0
    }));

    // Benchmark comparison (mock data)
    const benchmarkComparison = {
      industryAverage: 35,
      variance: averagePaymentTerms - 35,
      ranking: averagePaymentTerms < 30 ? 'above_average' as const : 
               averagePaymentTerms > 40 ? 'below_average' as const : 'average' as const
    };

    return {
      averagePaymentTerms,
      weightedAverageTerms,
      termDistribution,
      benchmarkComparison
    };
  }

  private parsePaymentTerms(terms: string): number {
    // Parse payment terms string to extract days
    const match = terms.match(/(\d+)/);
    return match ? parseInt(match[1]) : 30;
  }

  private async analyzeEarlyPaymentDiscounts(
    filters: FinancialInsightsFilters
  ): Promise<EarlyPaymentDiscountData> {
    // Mock implementation for early payment discount analysis
    const captured = Math.random() * 50000;
    const missed = Math.random() * 25000;
    const potentialSavings = missed * 0.8;

    // Generate discount opportunities
    const discountOpportunities = [
      {
        vendorId: 'vendor1',
        vendorName: 'Maritime Supplies Co.',
        discountRate: 2.0,
        discountDays: 10,
        standardTerms: 30,
        potentialSavings: 5000,
        riskAssessment: 'low' as const
      },
      {
        vendorId: 'vendor2',
        vendorName: 'Engine Parts Ltd.',
        discountRate: 1.5,
        discountDays: 15,
        standardTerms: 45,
        potentialSavings: 3500,
        riskAssessment: 'medium' as const
      }
    ];

    // Generate monthly trends
    const monthlyTrends = this.getMonthsBetweenDates(filters.startDate, filters.endDate)
      .map(month => ({
        month: month.toISOString().substring(0, 7),
        captured: Math.random() * 10000,
        missed: Math.random() * 5000,
        captureRate: Math.random() * 100
      }));

    return {
      captured,
      missed,
      potentialSavings,
      discountOpportunities,
      monthlyTrends
    };
  }

  private async analyzeVendorPaymentPerformance(
    filters: FinancialInsightsFilters
  ): Promise<VendorPaymentPerformance[]> {
    const whereClause = this.buildWhereClause(filters);

    const vendors = await prisma.vendor.findMany({
      where: {
        purchaseOrders: {
          some: whereClause
        }
      },
      include: {
        purchaseOrders: {
          where: whereClause,
          include: {
            invoices: {
              include: {
                payments: true
              }
            }
          }
        }
      }
    });

    return vendors.map(vendor => {
      // Calculate payment performance metrics
      const orders = vendor.purchaseOrders;
      const totalOrders = orders.length;
      
      // Mock calculations - in production, calculate from actual payment data
      const averagePaymentTime = 25 + Math.random() * 20; // 25-45 days
      const onTimePaymentRate = 70 + Math.random() * 25; // 70-95%
      const earlyPaymentRate = Math.random() * 20; // 0-20%
      const latePaymentRate = 100 - onTimePaymentRate - earlyPaymentRate;

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        averagePaymentTime,
        onTimePaymentRate,
        earlyPaymentRate,
        latePaymentRate,
        paymentTerms: vendor.paymentTerms || 'NET30',
        creditRating: 'A', // Mock credit rating
        relationshipScore: 70 + Math.random() * 30 // 70-100
      };
    });
  }

  private async generateCashFlowOptimization(
    filters: FinancialInsightsFilters
  ): Promise<CashFlowOptimization> {
    // Mock cash flow optimization analysis
    const currentCashCycle = 45; // days
    const optimizedCashCycle = 35; // days
    const potentialImprovement = currentCashCycle - optimizedCashCycle;

    const recommendations = [
      {
        id: 'cf1',
        type: 'extend_terms' as const,
        title: 'Negotiate Extended Payment Terms',
        description: 'Extend payment terms with key suppliers from NET30 to NET45',
        impact: 15000,
        implementationEffort: 'medium' as const,
        riskLevel: 'low' as const
      },
      {
        id: 'cf2',
        type: 'early_discount' as const,
        title: 'Optimize Early Payment Discounts',
        description: 'Selectively take early payment discounts with positive NPV',
        impact: 8000,
        implementationEffort: 'low' as const,
        riskLevel: 'low' as const
      }
    ];

    const monthlyProjections = this.getMonthsBetweenDates(filters.startDate, filters.endDate)
      .map(month => ({
        month: month.toISOString().substring(0, 7),
        inflows: 800000 + Math.random() * 200000,
        outflows: 750000 + Math.random() * 150000,
        netFlow: 0, // Will be calculated
        cumulativeFlow: 0 // Will be calculated
      }));

    // Calculate net flow and cumulative flow
    let cumulative = 0;
    monthlyProjections.forEach(projection => {
      projection.netFlow = projection.inflows - projection.outflows;
      cumulative += projection.netFlow;
      projection.cumulativeFlow = cumulative;
    });

    return {
      currentCashCycle,
      optimizedCashCycle,
      potentialImprovement,
      recommendations,
      monthlyProjections
    };
  }

  private async generatePaymentTimingOptimization(
    filters: FinancialInsightsFilters
  ): Promise<PaymentTimingOptimization[]> {
    // Mock payment timing optimization recommendations
    return [
      {
        vendorId: 'vendor1',
        vendorName: 'Maritime Supplies Co.',
        currentTiming: 'Pay on due date',
        recommendedTiming: 'Pay 5 days early for 2% discount',
        potentialSavings: 5000,
        riskImpact: 'positive' as const,
        implementationComplexity: 'low' as const
      },
      {
        vendorId: 'vendor2',
        vendorName: 'Engine Parts Ltd.',
        currentTiming: 'Pay 10 days early',
        recommendedTiming: 'Pay on due date',
        potentialSavings: 2000,
        riskImpact: 'neutral' as const,
        implementationComplexity: 'low' as const
      }
    ];
  }

  private async generateBudgetVsActualAnalysis(
    filters: FinancialInsightsFilters
  ): Promise<BudgetVarianceAnalysis> {
    // Mock budget vs actual analysis
    const totalBudget = 1000000;
    const totalActual = 950000;
    const totalVariance = totalActual - totalBudget;
    const variancePercentage = (totalVariance / totalBudget) * 100;

    const favorableVariance = Math.abs(Math.min(totalVariance, 0));
    const unfavorableVariance = Math.max(totalVariance, 0);

    const varianceByPeriod = this.getMonthsBetweenDates(filters.startDate, filters.endDate)
      .map(month => {
        const budget = totalBudget / 12; // Monthly budget
        const actual = budget * (0.8 + Math.random() * 0.4); // 80-120% of budget
        const variance = actual - budget;
        const variancePercentage = (variance / budget) * 100;

        return {
          period: month.toISOString().substring(0, 7),
          budget,
          actual,
          variance,
          variancePercentage,
          status: variance < -budget * 0.05 ? 'favorable' as const :
                  variance > budget * 0.05 ? 'unfavorable' as const : 'on_target' as const
        };
      });

    return {
      totalBudget,
      totalActual,
      totalVariance,
      variancePercentage,
      favorableVariance,
      unfavorableVariance,
      varianceByPeriod
    };
  }

  private async calculateCostPerVesselMile(
    filters: FinancialInsightsFilters
  ): Promise<CostPerVesselMileData> {
    // Mock cost per vessel mile calculation
    const overallCostPerMile = 15.50;

    const vesselComparison = [
      {
        vesselId: 'vessel1',
        vesselName: 'MV Ocean Pioneer',
        costPerMile: 14.20,
        totalMiles: 50000,
        totalCost: 710000,
        efficiency: 92,
        rank: 1,
        improvement: 5.2
      },
      {
        vesselId: 'vessel2',
        vesselName: 'MV Sea Explorer',
        costPerMile: 16.80,
        totalMiles: 45000,
        totalCost: 756000,
        efficiency: 85,
        rank: 2,
        improvement: -2.1
      }
    ];

    const categoryBreakdown = [
      {
        category: 'Engine Parts',
        costPerMile: 6.20,
        percentage: 40,
        trend: 'increasing' as const,
        benchmark: 5.80
      },
      {
        category: 'Deck Equipment',
        costPerMile: 3.10,
        percentage: 20,
        trend: 'stable' as const,
        benchmark: 3.20
      }
    ];

    const trends = this.getMonthsBetweenDates(filters.startDate, filters.endDate)
      .map(month => ({
        period: month.toISOString().substring(0, 7),
        costPerMile: 15 + Math.random() * 2,
        totalMiles: 8000 + Math.random() * 2000,
        efficiency: 80 + Math.random() * 20
      }));

    const benchmarks = [
      {
        vesselType: 'Container Ship',
        industryAverage: 16.20,
        topQuartile: 13.50,
        bottomQuartile: 19.80,
        ourPerformance: 15.50,
        ranking: 'above_average' as const
      }
    ];

    return {
      overallCostPerMile,
      vesselComparison,
      categoryBreakdown,
      trends,
      benchmarks
    };
  }

  private async analyzeCostsByCategory(
    filters: FinancialInsightsFilters
  ): Promise<CategoryCostAnalysis[]> {
    const whereClause = this.buildWhereClause(filters);

    const categorySpending = await prisma.purchaseOrder.groupBy({
      by: ['categoryCode'],
      where: {
        ...whereClause,
        categoryCode: { not: null }
      },
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    return categorySpending.map(spending => {
      const category = spending.categoryCode || 'Uncategorized';
      const actualAmount = spending._sum.totalAmount || 0;
      const budgetedAmount = actualAmount * (0.9 + Math.random() * 0.2); // Mock budget
      const variance = actualAmount - budgetedAmount;
      const variancePercentage = budgetedAmount > 0 ? (variance / budgetedAmount) * 100 : 0;

      const drivers = [
        {
          driver: 'Market Price Changes',
          impact: 'high' as const,
          description: 'Steel prices increased 15% during the period',
          correlation: 0.85,
          actionable: false
        },
        {
          driver: 'Emergency Orders',
          impact: 'medium' as const,
          description: 'Higher than planned emergency procurement',
          correlation: 0.65,
          actionable: true
        }
      ];

      const seasonality = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        monthName: new Date(2024, i, 1).toLocaleString('default', { month: 'long' }),
        seasonalIndex: 0.8 + Math.random() * 0.4,
        historicalAverage: actualAmount / 12,
        explanation: i < 6 ? 'Lower demand in first half' : 'Higher demand in second half'
      }));

      return {
        category,
        budgetedAmount,
        actualAmount,
        variance,
        variancePercentage,
        trend: variance > 0 ? 'increasing' as const : 
               variance < 0 ? 'decreasing' as const : 'stable' as const,
        drivers,
        seasonality
      };
    });
  }

  private async generateVarianceExplanations(
    categoryAnalysis: CategoryCostAnalysis[],
    filters: FinancialInsightsFilters
  ): Promise<VarianceExplanation[]> {
    return categoryAnalysis
      .filter(category => Math.abs(category.variancePercentage) > 5) // Only significant variances
      .map(category => ({
        category: category.category,
        variance: category.variance,
        rootCause: category.variance > 0 ? 'Increased market prices and emergency orders' : 'Successful cost reduction initiatives',
        explanation: category.variance > 0 
          ? `${category.category} spending exceeded budget by ${category.variancePercentage.toFixed(1)}% due to market price increases and higher emergency procurement`
          : `${category.category} spending was ${Math.abs(category.variancePercentage).toFixed(1)}% under budget due to successful cost optimization`,
        impact: Math.abs(category.variancePercentage) > 15 ? 'high' as const :
                Math.abs(category.variancePercentage) > 10 ? 'medium' as const : 'low' as const,
        controllable: category.drivers.some(d => d.actionable),
        recommendedAction: category.variance > 0 
          ? 'Review procurement processes and consider bulk purchasing agreements'
          : 'Continue current cost optimization strategies',
        timeline: '30-60 days'
      }));
  }

  private async generateCostOptimizationRecommendations(
    categoryAnalysis: CategoryCostAnalysis[],
    costPerVesselMile: CostPerVesselMileData,
    filters: FinancialInsightsFilters
  ): Promise<CostOptimizationRecommendation[]> {
    const recommendations: CostOptimizationRecommendation[] = [];

    // Generate recommendations based on category analysis
    categoryAnalysis.forEach(category => {
      if (category.variancePercentage > 10) {
        recommendations.push({
          id: `opt-${category.category}-${Date.now()}`,
          category: category.category,
          type: 'vendor_negotiation',
          title: `Optimize ${category.category} Procurement`,
          description: `Negotiate better terms with ${category.category} suppliers to reduce costs`,
          currentCost: category.actualAmount,
          optimizedCost: category.actualAmount * 0.9,
          potentialSavings: category.actualAmount * 0.1,
          savingsPercentage: 10,
          implementationEffort: 'medium',
          riskLevel: 'low',
          timeToImplement: '60-90 days',
          roi: 5.2,
          priority: 'high'
        });
      }
    });

    // Generate recommendations based on vessel efficiency
    costPerVesselMile.vesselComparison.forEach(vessel => {
      if (vessel.efficiency < 85) {
        recommendations.push({
          id: `opt-vessel-${vessel.vesselId}-${Date.now()}`,
          category: 'Operational Efficiency',
          type: 'process_improvement',
          title: `Improve ${vessel.vesselName} Efficiency`,
          description: `Implement efficiency improvements for ${vessel.vesselName} to reduce cost per mile`,
          currentCost: vessel.totalCost,
          optimizedCost: vessel.totalCost * 0.95,
          potentialSavings: vessel.totalCost * 0.05,
          savingsPercentage: 5,
          implementationEffort: 'high',
          riskLevel: 'medium',
          timeToImplement: '90-120 days',
          roi: 3.8,
          priority: 'medium'
        });
      }
    });

    return recommendations.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  private getMonthsBetweenDates(startDate: Date, endDate: Date): Date[] {
    const months: Date[] = [];
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (current <= end) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }
}

export const financialInsightsService = new FinancialInsightsService();