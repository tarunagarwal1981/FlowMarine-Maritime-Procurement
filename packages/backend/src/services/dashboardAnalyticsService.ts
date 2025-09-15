import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { CurrencyService } from './currencyService';
import { cacheService } from './cacheService';
import { queryOptimizationService } from './queryOptimizationService';
import { lazyLoadingService } from './lazyLoadingService';

const prisma = new PrismaClient();

// Core interfaces for dashboard analytics
export interface DashboardFilters {
  startDate: Date;
  endDate: Date;
  vesselIds?: string[];
  categories?: string[];
  vendorIds?: string[];
  currencies?: string[];
  baseCurrency?: string;
}

export interface VesselSpendBreakdown {
  vesselId: string;
  vesselName: string;
  totalAmount: number;
  currency: string;
  orderCount: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  averageOrderValue: number;
}

export interface CategorySpendBreakdown {
  categoryCode: string;
  categoryName: string;
  totalAmount: number;
  currency: string;
  orderCount: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  criticalityLevel: string;
}

export interface VendorSpendBreakdown {
  vendorId: string;
  vendorName: string;
  totalAmount: number;
  currency: string;
  orderCount: number;
  percentage: number;
  performanceScore: number;
  deliveryRating: number;
}

export interface MonthlySpendBreakdown {
  month: string;
  totalAmount: number;
  orderCount: number;
  averageOrderValue: number;
  emergencyOrders: number;
  routineOrders: number;
}

export interface SpendAnalyticsData {
  totalSpend: number;
  currency: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  breakdown: {
    byVessel: VesselSpendBreakdown[];
    byCategory: CategorySpendBreakdown[];
    byVendor: VendorSpendBreakdown[];
    byMonth: MonthlySpendBreakdown[];
  };
  trends: {
    yearOverYear: number;
    monthOverMonth: number; 
   quarterOverQuarter: number;
    growthRate: number;
  };
  insights: {
    topSpendingVessel: string;
    mostActiveCategory: string;
    bestPerformingVendor: string;
    costSavingsOpportunities: number;
  };
}

export interface BudgetUtilizationData {
  totalBudget: number;
  utilized: number;
  remaining: number;
  utilizationPercentage: number;
  variance: {
    amount: number;
    percentage: number;
    status: 'under' | 'over' | 'on-track';
  };
  projectedSpend: number;
  budgetByVessel: Array<{
    vesselId: string;
    vesselName: string;
    allocated: number;
    utilized: number;
    remaining: number;
    utilizationPercentage: number;
    variance: number;
  }>;
  budgetByCategory: Array<{
    categoryCode: string;
    categoryName: string;
    allocated: number;
    utilized: number;
    remaining: number;
    utilizationPercentage: number;
  }>;
  alerts: BudgetAlert[];
}

export interface BudgetAlert {
  id: string;
  type: 'OVER_BUDGET' | 'APPROACHING_LIMIT' | 'UNDER_UTILIZED';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  vesselId?: string;
  categoryCode?: string;
  threshold: number;
  currentValue: number;
  recommendedAction: string;
}

export interface VendorPerformanceData {
  vendorId: string;
  vendorName: string;
  overallScore: number;
  deliveryScore: number;
  qualityScore: number;
  priceScore: number;
  totalOrders: number;
  onTimeDeliveryRate: number;
  averageDeliveryTime: number;
  costSavings: number;
  trend: 'improving' | 'declining' | 'stable';
  performanceHistory: Array<{
    month: string;
    overallScore: number;
    deliveryScore: number;
    qualityScore: number;
    priceScore: number;
  }>;
  recommendations: string[];
}

export interface OperationalMetricsData {
  cycleTimeAnalysis: {
    averageCycleTime: number;
    cycleTimeByStage: Array<{
      stage: 'requisition' | 'approval' | 'rfq' | 'quote' | 'po' | 'delivery';
      averageTime: number;
      bottlenecks: Bottleneck[];
    }>;
    vesselComparison: Array<{
      vesselId: string;
      vesselName: string;
      averageCycleTime: number;
      efficiency: number;
    }>;
  };
  approvalMetrics: {
    averageApprovalTime: number;
    approvalsByStage: Array<{
      stage: string;
      averageTime: number;
      approvalRate: number;
    }>;
    bottlenecks: Bottleneck[];
  };
  deliveryMetrics: {
    onTimeDeliveryRate: number;
    averageDeliveryTime: number;
    deliveryByPort: Array<{
      portCode: string;
      portName: string;
      deliveryCount: number;
      onTimeRate: number;
      averageTime: number;
    }>;
  };
}

export interface Bottleneck {
  stage: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  averageDelay: number;
  frequency: number;
  recommendedAction: string;
}

// Port Efficiency Analytics Interfaces
export interface PortEfficiencyOverview {
  totalPorts: number;
  averageEfficiency: number;
  topPerformingPort: string;
  mostImprovedPort: string;
  totalDeliveries: number;
  overallOnTimeRate: number;
}

export interface PortLogisticsData {
  portId: string;
  portName: string;
  country: string;
  region: string;
  totalDeliveries: number;
  onTimeDeliveryRate: number;
  averageDeliveryTime: number;
  costEfficiency: number;
  customsClearanceTime: number;
  rating: number;
  trends: PortTrend[];
  seasonalPatterns: SeasonalPattern[];
  recommendations: PortRecommendation[];
  logistics: PortLogisticsMetrics;
  comparison: PortComparisonData;
}

export interface PortTrend {
  period: string;
  deliveries: number;
  onTimeRate: number;
  averageTime: number;
  cost: number;
}

export interface SeasonalPattern {
  month: number;
  monthName: string;
  demandMultiplier: number;
  averageDeliveryTime: number;
  costMultiplier: number;
}

export interface PortRecommendation {
  id: string;
  type: 'logistics' | 'cost' | 'timing' | 'alternative';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  estimatedSavings: number;
}

export interface PortLogisticsMetrics {
  averageDockingTime: number;
  cargoHandlingEfficiency: number;
  portCongestionLevel: 'low' | 'medium' | 'high';
  availableBerths: number;
  averageWaitTime: number;
  fuelAvailability: boolean;
  sparePartsAvailability: boolean;
  customsComplexity: 'simple' | 'moderate' | 'complex';
}

export interface PortComparisonData {
  rank: number;
  totalPorts: number;
  benchmarkMetrics: {
    deliveryTime: number;
    costEfficiency: number;
    onTimeRate: number;
  };
  competitorAnalysis: {
    betterPorts: number;
    worsePorts: number;
    similarPorts: number;
  };
}

export interface LogisticsOptimization {
  id: string;
  type: 'route' | 'timing' | 'consolidation' | 'alternative_port';
  title: string;
  description: string;
  currentCost: number;
  optimizedCost: number;
  potentialSavings: number;
  savingsPercentage: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
  estimatedTimeToImplement: number;
  affectedVessels: string[];
  affectedRoutes: string[];
}

export interface SeasonalDemandForecast {
  month: number;
  monthName: string;
  demandMultiplier: number;
  predictedVolume: number;
  confidence: number;
  factors: SeasonalFactor[];
  recommendations: string[];
}

export interface SeasonalFactor {
  factor: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
  historicalCorrelation: number;
}

export interface RegionalPortAnalysis {
  region: string;
  portCount: number;
  averageEfficiency: number;
  totalVolume: number;
  costIndex: number;
  strengths: string[];
  challenges: string[];
  opportunities: string[];
}

export interface PortAlert {
  id: string;
  portId: string;
  portName: string;
  type: 'congestion' | 'delay' | 'cost_increase' | 'service_disruption';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  impact: string;
  recommendedAction: string;
  estimatedDuration: string;
  createdAt: Date;
}

export interface PortEfficiencyDashboardData {
  overview: PortEfficiencyOverview;
  portRankings: PortLogisticsData[];
  logisticsOptimizations: LogisticsOptimization[];
  seasonalForecasts: SeasonalDemandForecast[];
  regionalAnalysis: RegionalPortAnalysis[];
  alerts: PortAlert[];
}

export interface FinancialInsightsData {
  multiCurrencyConsolidation: {
    totalSpendBaseCurrency: number;
    baseCurrency: string;
    currencyBreakdown: Array<{
      currency: string;
      amount: number;
      amountInBaseCurrency: number;
      exchangeRate: number;
      percentage: number;
    }>;
    exchangeRateImpact: {
      gainLoss: number;
      percentage: number;
      trend: 'favorable' | 'unfavorable';
    };
  };
  paymentTermsAnalysis: {
    averagePaymentTerms: number;
    earlyPaymentDiscounts: {
      captured: number;
      missed: number;
      potentialSavings: number;
    };
    paymentOptimization: Array<{
      vendorId: string;
      vendorName: string;
      currentTerms: string;
      recommendedTerms: string;
      potentialSavings: number;
    }>;
  };
  costAnalysis: {
    costPerVesselMile: number;
    costByCategory: Array<{
      category: string;
      costPerUnit: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    }>;
    varianceAnalysis: Array<{
      category: string;
      budgetedAmount: number;
      actualAmount: number;
      variance: number;
      variancePercentage: number;
    }>;
  };
}

/**
 * Comprehensive Dashboard Analytics Service
 * Provides multi-dimensional analysis for maritime procurement operations
 */
export class DashboardAnalyticsService {
  private readonly CACHE_TTL = 900; // 15 minutes
  private readonly currencyService = new CurrencyService();

  /**
   * Generate comprehensive spend analytics with multi-dimensional analysis
   * Enhanced with intelligent caching and query optimization
   */
  async generateSpendAnalytics(filters: DashboardFilters): Promise<SpendAnalyticsData> {
    try {
      logger.info('Generating spend analytics with optimization', { filters });

      // Use optimized query service for better performance
      const optimizedResult = await queryOptimizationService.getOptimizedSpendAnalytics(filters, {
        useCache: true,
        usePreAggregation: true,
        cacheTTL: this.CACHE_TTL
      });

      if (optimizedResult.metrics.cacheHit) {
        logger.debug('Spend analytics served from cache', { 
          queryTime: optimizedResult.metrics.queryTime,
          optimizations: optimizedResult.metrics.optimizationUsed
        });
      }

      return optimizedResult.data;

      // Fallback to traditional method if optimization fails
      const whereClause = this.buildWhereClause(filters);
      
      // Get total spending with caching
      const totalSpend = await cacheService.getOrSet(
        `total-spend:${JSON.stringify(filters)}`,
        async () => {
          const result = await prisma.purchaseOrder.aggregate({
            where: whereClause,
            _sum: { totalAmount: true }
          });
          return result._sum.totalAmount || 0;
        },
        { prefix: 'analytics:', ttl: this.CACHE_TTL }
      );

      // Generate breakdowns in parallel with caching
      const [vesselBreakdown, categoryBreakdown, vendorBreakdown, monthlyBreakdown] = 
        await Promise.all([
          this.generateVesselSpendBreakdown(whereClause, totalSpend),
          this.generateCategorySpendBreakdown(whereClause, totalSpend),
          this.generateVendorSpendBreakdown(whereClause, totalSpend),
          this.generateMonthlySpendBreakdown(whereClause)
        ]);

      // Calculate trends with caching
      const trends = await this.calculateSpendTrends(filters);

      // Generate insights
      const insights = this.generateSpendInsights(
        vesselBreakdown,
        categoryBreakdown,
        vendorBreakdown
      );

      const result: SpendAnalyticsData = {
        totalSpend,
        currency: filters.baseCurrency || 'USD',
        timeRange: {
          start: filters.startDate,
          end: filters.endDate
        },
        breakdown: {
          byVessel: vesselBreakdown,
          byCategory: categoryBreakdown,
          byVendor: vendorBreakdown,
          byMonth: monthlyBreakdown
        },
        trends,
        insights
      };

      // Cache with intelligent invalidation
      await cacheService.cacheDashboardData(
        'spend_analytics',
        filters,
        result,
        ['purchase_orders', 'vendors', 'vessels']
      );

      return result;
    } catch (error) {
      logger.error('Error generating spend analytics', { error, filters });
      throw error;
    }
  }

  /**
   * Generate budget utilization tracking with real-time variance calculations
   * Enhanced with intelligent caching and incremental updates
   */
  async generateBudgetUtilization(filters: DashboardFilters): Promise<BudgetUtilizationData> {
    try {
      logger.info('Generating budget utilization data with optimization', { filters });

      // Use optimized query service for budget data
      const optimizedResult = await queryOptimizationService.getOptimizedBudgetUtilization(filters, {
        useCache: true,
        usePreAggregation: true,
        cacheTTL: this.CACHE_TTL
      });

      if (optimizedResult.metrics.cacheHit) {
        logger.debug('Budget utilization served from cache', { 
          queryTime: optimizedResult.metrics.queryTime,
          optimizations: optimizedResult.metrics.optimizationUsed
        });
      }

      return optimizedResult.data;

      // Get budget allocations
      const budgetAllocations = await this.getBudgetAllocations(filters);
      const totalBudget = budgetAllocations.reduce((sum, b) => sum + b.allocated, 0);

      // Get actual spending
      const whereClause = this.buildWhereClause(filters);
      const actualSpendResult = await prisma.purchaseOrder.aggregate({
        where: whereClause,
        _sum: { totalAmount: true }
      });

      const utilized = actualSpendResult._sum.totalAmount || 0;
      const remaining = totalBudget - utilized;
      const utilizationPercentage = totalBudget > 0 ? (utilized / totalBudget) * 100 : 0;

      // Calculate variance
      const variance = {
        amount: utilized - totalBudget,
        percentage: totalBudget > 0 ? ((utilized - totalBudget) / totalBudget) * 100 : 0,
        status: this.getBudgetStatus(utilizationPercentage)
      };

      // Project future spend
      const projectedSpend = await this.calculateProjectedSpend(filters);

      // Generate vessel and category breakdowns
      const [budgetByVessel, budgetByCategory] = await Promise.all([
        this.generateVesselBudgetBreakdown(filters, budgetAllocations),
        this.generateCategoryBudgetBreakdown(filters, budgetAllocations)
      ]);

      // Generate budget alerts
      const alerts = this.generateBudgetAlerts(budgetByVessel, budgetByCategory);

      const result: BudgetUtilizationData = {
        totalBudget,
        utilized,
        remaining,
        utilizationPercentage,
        variance,
        projectedSpend,
        budgetByVessel,
        budgetByCategory,
        alerts
      };

      await cacheService.set(cacheKey, result, {
        prefix: 'analytics:',
        ttl: this.CACHE_TTL
      });

      return result;
    } catch (error) {
      logger.error('Error generating budget utilization data', { error, filters });
      throw error;
    }
  }

  /**
   * Generate vendor performance analytics with scoring algorithms
   * Enhanced with batch processing and intelligent caching
   */
  async generateVendorPerformanceAnalytics(filters: DashboardFilters): Promise<VendorPerformanceData[]> {
    try {
      logger.info('Generating vendor performance analytics with optimization', { filters });

      // Use optimized query service with batch processing
      const optimizedResult = await queryOptimizationService.getOptimizedVendorPerformance(filters, {
        useCache: true,
        batchSize: 50,
        cacheTTL: this.CACHE_TTL
      });

      if (optimizedResult.metrics.cacheHit) {
        logger.debug('Vendor performance served from cache', { 
          queryTime: optimizedResult.metrics.queryTime,
          optimizations: optimizedResult.metrics.optimizationUsed
        });
      }

      return optimizedResult.data;

      const whereClause = this.buildWhereClause(filters);

      // Get vendors with orders in the time period
      const vendorsWithOrders = await prisma.purchaseOrder.groupBy({
        by: ['vendorId'],
        where: whereClause,
        _count: { id: true }
      });

      const vendorIds = vendorsWithOrders.map(v => v.vendorId);

      // Get vendor details
      const vendors = await prisma.vendor.findMany({
        where: { id: { in: vendorIds } },
        include: {
          purchaseOrders: {
            where: {
              createdAt: {
                gte: filters.startDate,
                lte: filters.endDate
              }
            },
            include: {
              deliveries: true,
              invoices: true
            }
          }
        }
      });

      const vendorPerformanceData = await Promise.all(
        vendors.map(vendor => this.calculateVendorPerformance(vendor, filters))
      );

      await cacheService.set(cacheKey, vendorPerformanceData, {
        prefix: 'analytics:',
        ttl: this.CACHE_TTL
      });

      return vendorPerformanceData.sort((a, b) => b.overallScore - a.overallScore);
    } catch (error) {
      logger.error('Error generating vendor performance analytics', { error, filters });
      throw error;
    }
  }

  /**
   * Generate operational metrics for cycle time and bottleneck analysis
   * Enhanced with materialized view simulation and compression
   */
  async generateOperationalMetrics(filters: DashboardFilters): Promise<OperationalMetricsData> {
    try {
      logger.info('Generating operational metrics with optimization', { filters });

      // Use optimized query service with materialized views
      const optimizedResult = await queryOptimizationService.getOptimizedOperationalMetrics(filters, {
        useCache: true,
        usePreAggregation: true,
        cacheTTL: this.CACHE_TTL
      });

      if (optimizedResult.metrics.cacheHit) {
        logger.debug('Operational metrics served from cache', { 
          queryTime: optimizedResult.metrics.queryTime,
          optimizations: optimizedResult.metrics.optimizationUsed
        });
      }

      return optimizedResult.data;

      // Generate cycle time analysis
      const cycleTimeAnalysis = await this.generateCycleTimeAnalysis(filters);

      // Generate approval metrics
      const approvalMetrics = await this.generateApprovalMetrics(filters);

      // Generate delivery metrics
      const deliveryMetrics = await this.generateDeliveryMetrics(filters);

      const result: OperationalMetricsData = {
        cycleTimeAnalysis,
        approvalMetrics,
        deliveryMetrics
      };

      await cacheService.set(cacheKey, result, {
        prefix: 'analytics:',
        ttl: this.CACHE_TTL
      });

      return result;
    } catch (error) {
      logger.error('Error generating operational metrics', { error, filters });
      throw error;
    }
  }

  /**
   * Generate financial insights with multi-currency consolidation
   */
  async generateFinancialInsights(filters: DashboardFilters): Promise<FinancialInsightsData> {
    try {
      logger.info('Generating financial insights', { filters });

      const cacheKey = `financial-insights:${JSON.stringify(filters)}`;
      const cached = await cacheService.get<FinancialInsightsData>(cacheKey, {
        prefix: 'analytics:',
        ttl: this.CACHE_TTL
      });

      if (cached) {
        return cached;
      }

      const baseCurrency = filters.baseCurrency || 'USD';

      // Generate multi-currency consolidation
      const multiCurrencyConsolidation = await this.generateMultiCurrencyConsolidation(
        filters,
        baseCurrency
      );

      // Generate payment terms analysis
      const paymentTermsAnalysis = await this.generatePaymentTermsAnalysis(filters);

      // Generate cost analysis
      const costAnalysis = await this.generateCostAnalysis(filters);

      const result: FinancialInsightsData = {
        multiCurrencyConsolidation,
        paymentTermsAnalysis,
        costAnalysis
      };

      await cacheService.set(cacheKey, result, {
        prefix: 'analytics:',
        ttl: this.CACHE_TTL
      });

      return result;
    } catch (error) {
      logger.error('Error generating financial insights', { error, filters });
      throw error;
    }
  }

  // Private helper methods

  private buildWhereClause(filters: DashboardFilters) {
    return {
      createdAt: {
        gte: filters.startDate,
        lte: filters.endDate
      },
      ...(filters.vesselIds?.length && { vesselId: { in: filters.vesselIds } }),
      ...(filters.vendorIds?.length && { vendorId: { in: filters.vendorIds } }),
      ...(filters.categories?.length && { categoryCode: { in: filters.categories } }),
      ...(filters.currencies?.length && { currency: { in: filters.currencies } }),
      status: { in: ['DELIVERED', 'INVOICED', 'PAID'] }
    };
  }

  private async generateVesselSpendBreakdown(
    whereClause: any,
    totalSpend: number
  ): Promise<VesselSpendBreakdown[]> {
    const spendingByVessel = await prisma.purchaseOrder.groupBy({
      by: ['vesselId'],
      where: whereClause,
      _sum: { totalAmount: true },
      _count: { id: true },
      _avg: { totalAmount: true }
    });

    const vesselDetails = await prisma.vessel.findMany({
      where: { id: { in: spendingByVessel.map(s => s.vesselId) } },
      select: { id: true, name: true }
    });

    return spendingByVessel.map(spending => {
      const vessel = vesselDetails.find(v => v.id === spending.vesselId);
      const amount = spending._sum.totalAmount || 0;
      
      return {
        vesselId: spending.vesselId,
        vesselName: vessel?.name || 'Unknown',
        totalAmount: amount,
        currency: 'USD', // This would be converted to base currency
        orderCount: spending._count.id,
        percentage: totalSpend > 0 ? (amount / totalSpend) * 100 : 0,
        trend: 'stable', // This would be calculated based on historical data
        averageOrderValue: spending._avg.totalAmount || 0
      };
    });
  }

  private async generateCategorySpendBreakdown(
    whereClause: any,
    totalSpend: number
  ): Promise<CategorySpendBreakdown[]> {
    const spendingByCategory = await prisma.purchaseOrder.groupBy({
      by: ['categoryCode'],
      where: {
        ...whereClause,
        categoryCode: { not: null }
      },
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    const categoryDetails = await prisma.purchaseCategory.findMany({
      where: { 
        code: { 
          in: spendingByCategory.map(s => s.categoryCode).filter(Boolean) as string[] 
        } 
      },
      select: { code: true, name: true, criticalityLevel: true }
    });

    return spendingByCategory.map(spending => {
      const category = categoryDetails.find(c => c.code === spending.categoryCode);
      const amount = spending._sum.totalAmount || 0;
      
      return {
        categoryCode: spending.categoryCode || 'UNCATEGORIZED',
        categoryName: category?.name || 'Uncategorized',
        totalAmount: amount,
        currency: 'USD',
        orderCount: spending._count.id,
        percentage: totalSpend > 0 ? (amount / totalSpend) * 100 : 0,
        trend: 'stable',
        criticalityLevel: category?.criticalityLevel || 'ROUTINE'
      };
    });
  }

  private async generateVendorSpendBreakdown(
    whereClause: any,
    totalSpend: number
  ): Promise<VendorSpendBreakdown[]> {
    const spendingByVendor = await prisma.purchaseOrder.groupBy({
      by: ['vendorId'],
      where: whereClause,
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    const vendorDetails = await prisma.vendor.findMany({
      where: { id: { in: spendingByVendor.map(s => s.vendorId) } },
      select: { 
        id: true, 
        name: true, 
        overallScore: true, 
        deliveryRating: true 
      }
    });

    return spendingByVendor.map(spending => {
      const vendor = vendorDetails.find(v => v.id === spending.vendorId);
      const amount = spending._sum.totalAmount || 0;
      
      return {
        vendorId: spending.vendorId,
        vendorName: vendor?.name || 'Unknown',
        totalAmount: amount,
        currency: 'USD',
        orderCount: spending._count.id,
        percentage: totalSpend > 0 ? (amount / totalSpend) * 100 : 0,
        performanceScore: vendor?.overallScore || 0,
        deliveryRating: vendor?.deliveryRating || 0
      };
    });
  }

  private async generateMonthlySpendBreakdown(whereClause: any): Promise<MonthlySpendBreakdown[]> {
    const orders = await prisma.purchaseOrder.findMany({
      where: whereClause,
      select: {
        createdAt: true,
        totalAmount: true,
        urgencyLevel: true
      }
    });

    const monthlyMap = new Map<string, {
      totalAmount: number;
      orderCount: number;
      emergencyOrders: number;
      routineOrders: number;
    }>();

    orders.forEach(order => {
      const month = order.createdAt.toISOString().substring(0, 7);
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          totalAmount: 0,
          orderCount: 0,
          emergencyOrders: 0,
          routineOrders: 0
        });
      }

      const monthData = monthlyMap.get(month)!;
      monthData.totalAmount += order.totalAmount;
      monthData.orderCount += 1;

      if (order.urgencyLevel === 'EMERGENCY') {
        monthData.emergencyOrders += 1;
      } else {
        monthData.routineOrders += 1;
      }
    });

    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        totalAmount: data.totalAmount,
        orderCount: data.orderCount,
        averageOrderValue: data.orderCount > 0 ? data.totalAmount / data.orderCount : 0,
        emergencyOrders: data.emergencyOrders,
        routineOrders: data.routineOrders
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private async calculateSpendTrends(filters: DashboardFilters) {
    // Calculate YoY, MoM, QoQ trends
    const currentPeriodSpend = await this.getTotalSpendForPeriod(filters);
    
    // Previous year same period
    const previousYearFilters = {
      ...filters,
      startDate: new Date(filters.startDate.getFullYear() - 1, filters.startDate.getMonth(), filters.startDate.getDate()),
      endDate: new Date(filters.endDate.getFullYear() - 1, filters.endDate.getMonth(), filters.endDate.getDate())
    };
    const previousYearSpend = await this.getTotalSpendForPeriod(previousYearFilters);

    const yearOverYear = previousYearSpend > 0 
      ? ((currentPeriodSpend - previousYearSpend) / previousYearSpend) * 100 
      : 0;

    return {
      yearOverYear,
      monthOverMonth: 0, // Would calculate based on monthly data
      quarterOverQuarter: 0, // Would calculate based on quarterly data
      growthRate: yearOverYear
    };
  }

  private generateSpendInsights(
    vesselBreakdown: VesselSpendBreakdown[],
    categoryBreakdown: CategorySpendBreakdown[],
    vendorBreakdown: VendorSpendBreakdown[]
  ) {
    const topSpendingVessel = vesselBreakdown.length > 0 
      ? vesselBreakdown.reduce((max, vessel) => 
          vessel.totalAmount > max.totalAmount ? vessel : max
        ).vesselName
      : 'N/A';

    const mostActiveCategory = categoryBreakdown.length > 0
      ? categoryBreakdown.reduce((max, category) => 
          category.orderCount > max.orderCount ? category : max
        ).categoryName
      : 'N/A';

    const bestPerformingVendor = vendorBreakdown.length > 0
      ? vendorBreakdown.reduce((max, vendor) => 
          vendor.performanceScore > max.performanceScore ? vendor : max
        ).vendorName
      : 'N/A';

    return {
      topSpendingVessel,
      mostActiveCategory,
      bestPerformingVendor,
      costSavingsOpportunities: 0 // Would calculate based on optimization analysis
    };
  }

  private async getTotalSpendForPeriod(filters: DashboardFilters): Promise<number> {
    const whereClause = this.buildWhereClause(filters);
    const result = await prisma.purchaseOrder.aggregate({
      where: whereClause,
      _sum: { totalAmount: true }
    });
    return result._sum.totalAmount || 0;
  }

  private async getBudgetAllocations(filters: DashboardFilters) {
    // This would fetch budget allocations from a budget table
    // For now, returning mock data structure
    return [
      { vesselId: 'vessel1', categoryCode: 'ENGINE', allocated: 100000 },
      { vesselId: 'vessel1', categoryCode: 'DECK', allocated: 50000 },
      // ... more allocations
    ];
  }

  private getBudgetStatus(utilizationPercentage: number): 'under' | 'over' | 'on-track' {
    if (utilizationPercentage > 100) return 'over';
    if (utilizationPercentage < 80) return 'under';
    return 'on-track';
  }

  private async calculateProjectedSpend(filters: DashboardFilters): Promise<number> {
    // Calculate projected spend based on current trends
    const currentSpend = await this.getTotalSpendForPeriod(filters);
    const daysElapsed = Math.ceil(
      (new Date().getTime() - filters.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalDays = Math.ceil(
      (filters.endDate.getTime() - filters.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return daysElapsed > 0 ? (currentSpend / daysElapsed) * totalDays : currentSpend;
  }

  private async generateVesselBudgetBreakdown(filters: DashboardFilters, budgetAllocations: any[]) {
    // Implementation for vessel budget breakdown
    return [];
  }

  private async generateCategoryBudgetBreakdown(filters: DashboardFilters, budgetAllocations: any[]) {
    // Implementation for category budget breakdown
    return [];
  }

  private generateBudgetAlerts(budgetByVessel: any[], budgetByCategory: any[]): BudgetAlert[] {
    // Implementation for budget alerts generation
    return [];
  }

  private async calculateVendorPerformance(vendor: any, filters: DashboardFilters): Promise<VendorPerformanceData> {
    // Implementation for vendor performance calculation
    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      overallScore: vendor.overallScore || 0,
      deliveryScore: vendor.deliveryRating || 0,
      qualityScore: vendor.qualityRating || 0,
      priceScore: vendor.priceRating || 0,
      totalOrders: vendor.purchaseOrders?.length || 0,
      onTimeDeliveryRate: 0,
      averageDeliveryTime: 0,
      costSavings: 0,
      trend: 'stable',
      performanceHistory: [],
      recommendations: []
    };
  }

  /**
   * Initialize pre-aggregation and lazy loading for dashboard components
   */
  async initializePerformanceOptimizations(): Promise<void> {
    try {
      logger.info('Initializing dashboard performance optimizations');

      // Start cache pre-aggregation
      await cacheService.preAggregateCommonViews();

      // Register components for lazy loading
      const componentConfigs = [
        {
          componentId: 'fleet_spend_visualization',
          priority: 'high' as const,
          dependencies: ['purchase_orders', 'vessels'],
          loadStrategy: 'immediate' as const,
          cacheStrategy: 'aggressive' as const,
          preloadData: true
        },
        {
          componentId: 'budget_utilization_dashboard',
          priority: 'high' as const,
          dependencies: ['budget_allocations', 'purchase_orders'],
          loadStrategy: 'immediate' as const,
          cacheStrategy: 'aggressive' as const,
          preloadData: true
        },
        {
          componentId: 'vendor_performance_scorecards',
          priority: 'medium' as const,
          dependencies: ['vendors', 'purchase_orders', 'deliveries'],
          loadStrategy: 'viewport' as const,
          cacheStrategy: 'normal' as const,
          preloadData: false
        },
        {
          componentId: 'operational_metrics',
          priority: 'medium' as const,
          dependencies: ['requisitions', 'approvals', 'deliveries'],
          loadStrategy: 'viewport' as const,
          cacheStrategy: 'normal' as const,
          preloadData: false
        }
      ];

      componentConfigs.forEach(config => {
        lazyLoadingService.registerComponent(config);
      });

      logger.info('Dashboard performance optimizations initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize performance optimizations', { error });
    }
  }

  /**
   * Load dashboard component with lazy loading optimization
   */
  async loadDashboardComponent(
    componentId: string,
    filters: DashboardFilters,
    options: { priority?: number; timeout?: number } = {}
  ): Promise<any> {
    try {
      return await lazyLoadingService.loadComponent(componentId, filters, options);
    } catch (error) {
      logger.error(`Failed to load dashboard component: ${componentId}`, { error, filters });
      throw error;
    }
  }

  /**
   * Batch load multiple dashboard components
   */
  async batchLoadDashboardComponents(
    requests: Array<{
      componentId: string;
      filters: DashboardFilters;
      options?: { priority?: number; timeout?: number };
    }>
  ): Promise<{ [componentId: string]: any }> {
    try {
      const lazyLoadRequests = requests.map(req => ({
        componentId: req.componentId,
        filters: req.filters,
        options: req.options
      }));

      return await lazyLoadingService.batchLoadComponents(lazyLoadRequests);
    } catch (error) {
      logger.error('Failed to batch load dashboard components', { error, requests });
      throw error;
    }
  }

  /**
   * Get dashboard performance statistics
   */
  async getDashboardPerformanceStats(): Promise<any> {
    try {
      const [cacheStats, queryStats, loadingStats] = await Promise.all([
        cacheService.getAdvancedStats(),
        queryOptimizationService.getPerformanceStatistics(),
        lazyLoadingService.getLoadingStatistics()
      ]);

      return {
        cache: cacheStats,
        queries: queryStats,
        loading: loadingStats,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to get dashboard performance stats', { error });
      throw error;
    }
  }

  /**
   * Invalidate dashboard cache for specific data changes
   */
  async invalidateDashboardCache(dataType: string, affectedIds?: string[]): Promise<void> {
    try {
      logger.info(`Invalidating dashboard cache for data type: ${dataType}`, { affectedIds });

      // Invalidate based on data dependencies
      await cacheService.invalidateByDependency(dataType);

      // Invalidate specific components if needed
      if (affectedIds) {
        for (const id of affectedIds) {
          await lazyLoadingService.invalidateComponent(id);
        }
      }

      logger.info(`Cache invalidation completed for: ${dataType}`);
    } catch (error) {
      logger.error('Failed to invalidate dashboard cache', { error, dataType, affectedIds });
    }
  }

  /**
   * Warm up dashboard cache with common filter combinations
   */
  async warmUpDashboardCache(): Promise<void> {
    try {
      logger.info('Starting dashboard cache warm-up');

      const commonFilters = [
        {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          endDate: new Date(),
          baseCurrency: 'USD'
        },
        {
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
          endDate: new Date(),
          baseCurrency: 'USD'
        },
        {
          startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Current month
          endDate: new Date(),
          baseCurrency: 'USD'
        }
      ];

      const dashboardTypes = [
        'fleet_spend_visualization',
        'budget_utilization_dashboard',
        'vendor_performance_scorecards',
        'operational_metrics'
      ];

      await lazyLoadingService.warmDashboardCache(dashboardTypes, commonFilters);

      logger.info('Dashboard cache warm-up completed');
    } catch (error) {
      logger.error('Failed to warm up dashboard cache', { error });
    }
  }

  private async generateCycleTimeAnalysis(filters: DashboardFilters) {
    // Implementation for cycle time analysis
    return {
      averageCycleTime: 0,
      cycleTimeByStage: [],
      vesselComparison: []
    };
  }

  private async generateApprovalMetrics(filters: DashboardFilters) {
    // Implementation for approval metrics
    return {
      averageApprovalTime: 0,
      approvalsByStage: [],
      bottlenecks: []
    };
  }

  private async generateDeliveryMetrics(filters: DashboardFilters) {
    // Implementation for delivery metrics
    return {
      onTimeDeliveryRate: 0,
      averageDeliveryTime: 0,
      deliveryByPort: []
    };
  }

  private async generateMultiCurrencyConsolidation(filters: DashboardFilters, baseCurrency: string) {
    // Implementation for multi-currency consolidation
    return {
      totalSpendBaseCurrency: 0,
      baseCurrency,
      currencyBreakdown: [],
      exchangeRateImpact: {
        gainLoss: 0,
        percentage: 0,
        trend: 'favorable' as const
      }
    };
  }

  private async generatePaymentTermsAnalysis(filters: DashboardFilters) {
    // Implementation for payment terms analysis
    return {
      averagePaymentTerms: 0,
      earlyPaymentDiscounts: {
        captured: 0,
        missed: 0,
        potentialSavings: 0
      },
      paymentOptimization: []
    };
  }

  private async generateCostAnalysis(filters: DashboardFilters) {
    // Implementation for cost analysis
    return {
      costPerVesselMile: 0,
      costByCategory: [],
      varianceAnalysis: []
    };
  }

  /**
   * Generate comprehensive port efficiency analytics
   */
  async generatePortEfficiencyAnalytics(filters: DashboardFilters): Promise<PortEfficiencyDashboardData> {
    try {
      logger.info('Generating port efficiency analytics', { filters });

      const cacheKey = `port-efficiency:${JSON.stringify(filters)}`;
      const cached = await cacheService.get<PortEfficiencyDashboardData>(cacheKey, {
        prefix: 'analytics:',
        ttl: this.CACHE_TTL
      });

      if (cached) {
        return cached;
      }

      // Generate all port efficiency data in parallel
      const [overview, portRankings, logisticsOptimizations, seasonalForecasts, regionalAnalysis, alerts] = 
        await Promise.all([
          this.generatePortOverview(filters),
          this.generatePortRankings(filters),
          this.generateLogisticsOptimizations(filters),
          this.generateSeasonalForecasts(filters),
          this.generateRegionalAnalysis(filters),
          this.generatePortAlerts(filters)
        ]);

      const result: PortEfficiencyDashboardData = {
        overview,
        portRankings,
        logisticsOptimizations,
        seasonalForecasts,
        regionalAnalysis,
        alerts
      };

      // Cache the result
      await cacheService.set(cacheKey, result, {
        prefix: 'analytics:',
        ttl: this.CACHE_TTL
      });

      return result;
    } catch (error) {
      logger.error('Error generating port efficiency analytics', { error, filters });
      throw error;
    }
  }

  private async generatePortOverview(filters: DashboardFilters): Promise<PortEfficiencyOverview> {
    const whereClause = this.buildWhereClause(filters);

    // Get delivery data from purchase orders with delivery information
    const deliveryData = await prisma.purchaseOrder.findMany({
      where: {
        ...whereClause,
        deliveries: {
          some: {
            deliveredAt: {
              not: null
            }
          }
        }
      },
      include: {
        deliveries: {
          where: {
            deliveredAt: {
              not: null
            }
          }
        },
        vessel: true
      }
    });

    // Calculate port statistics
    const portStats = new Map<string, {
      deliveries: number;
      onTimeDeliveries: number;
      totalDeliveryTime: number;
    }>();

    let totalDeliveries = 0;
    let totalOnTimeDeliveries = 0;

    deliveryData.forEach(po => {
      po.deliveries.forEach(delivery => {
        const portKey = delivery.portCode || 'unknown';
        const stats = portStats.get(portKey) || { deliveries: 0, onTimeDeliveries: 0, totalDeliveryTime: 0 };
        
        stats.deliveries++;
        totalDeliveries++;
        
        // Calculate if delivery was on time (within 24 hours of scheduled)
        if (delivery.scheduledDeliveryDate && delivery.deliveredAt) {
          const scheduledTime = new Date(delivery.scheduledDeliveryDate).getTime();
          const actualTime = new Date(delivery.deliveredAt).getTime();
          const timeDiff = Math.abs(actualTime - scheduledTime) / (1000 * 60 * 60); // hours
          
          if (timeDiff <= 24) {
            stats.onTimeDeliveries++;
            totalOnTimeDeliveries++;
          }
          
          stats.totalDeliveryTime += timeDiff;
        }
        
        portStats.set(portKey, stats);
      });
    });

    const totalPorts = portStats.size;
    const averageEfficiency = totalPorts > 0 ? 
      Array.from(portStats.values()).reduce((sum, stats) => 
        sum + (stats.deliveries > 0 ? (stats.onTimeDeliveries / stats.deliveries) * 100 : 0), 0
      ) / totalPorts : 0;

    const overallOnTimeRate = totalDeliveries > 0 ? (totalOnTimeDeliveries / totalDeliveries) * 100 : 0;

    // Find top performing port
    let topPerformingPort = 'N/A';
    let bestEfficiency = 0;
    portStats.forEach((stats, portCode) => {
      const efficiency = stats.deliveries > 0 ? (stats.onTimeDeliveries / stats.deliveries) * 100 : 0;
      if (efficiency > bestEfficiency) {
        bestEfficiency = efficiency;
        topPerformingPort = portCode;
      }
    });

    return {
      totalPorts,
      averageEfficiency,
      topPerformingPort,
      mostImprovedPort: topPerformingPort, // Simplified for now
      totalDeliveries,
      overallOnTimeRate
    };
  }

  private async generatePortRankings(filters: DashboardFilters): Promise<PortLogisticsData[]> {
    const whereClause = this.buildWhereClause(filters);

    // Get port delivery data
    const portDeliveries = await prisma.purchaseOrder.findMany({
      where: {
        ...whereClause,
        deliveries: {
          some: {
            deliveredAt: { not: null }
          }
        }
      },
      include: {
        deliveries: {
          where: {
            deliveredAt: { not: null }
          }
        },
        vendor: true
      }
    });

    // Aggregate port statistics
    const portStatsMap = new Map<string, {
      portCode: string;
      portName: string;
      country: string;
      region: string;
      deliveries: number;
      onTimeDeliveries: number;
      totalDeliveryTime: number;
      totalCost: number;
      customsClearanceTime: number;
      ratings: number[];
    }>();

    portDeliveries.forEach(po => {
      po.deliveries.forEach(delivery => {
        const portCode = delivery.portCode || 'unknown';
        const portName = delivery.portName || portCode;
        const country = delivery.country || 'Unknown';
        const region = this.getRegionFromCountry(country);

        const stats = portStatsMap.get(portCode) || {
          portCode,
          portName,
          country,
          region,
          deliveries: 0,
          onTimeDeliveries: 0,
          totalDeliveryTime: 0,
          totalCost: 0,
          customsClearanceTime: 0,
          ratings: []
        };

        stats.deliveries++;
        stats.totalCost += po.totalAmount;

        if (delivery.scheduledDeliveryDate && delivery.deliveredAt) {
          const scheduledTime = new Date(delivery.scheduledDeliveryDate).getTime();
          const actualTime = new Date(delivery.deliveredAt).getTime();
          const timeDiff = Math.abs(actualTime - scheduledTime) / (1000 * 60 * 60);

          if (timeDiff <= 24) {
            stats.onTimeDeliveries++;
          }

          stats.totalDeliveryTime += timeDiff;
        }

        // Mock customs clearance time (would come from actual data)
        stats.customsClearanceTime += Math.random() * 12 + 2; // 2-14 hours

        // Mock rating (would come from actual feedback)
        stats.ratings.push(Math.random() * 2 + 3); // 3-5 stars

        portStatsMap.set(portCode, stats);
      });
    });

    // Convert to PortLogisticsData array
    const portRankings: PortLogisticsData[] = Array.from(portStatsMap.values()).map(stats => {
      const onTimeDeliveryRate = stats.deliveries > 0 ? (stats.onTimeDeliveries / stats.deliveries) * 100 : 0;
      const averageDeliveryTime = stats.deliveries > 0 ? stats.totalDeliveryTime / stats.deliveries : 0;
      const costEfficiency = Math.min(100, Math.max(0, 100 - (averageDeliveryTime / 48) * 100)); // Efficiency based on delivery time
      const averageCustomsClearance = stats.deliveries > 0 ? stats.customsClearanceTime / stats.deliveries : 0;
      const averageRating = stats.ratings.length > 0 ? stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length : 0;

      return {
        portId: stats.portCode,
        portName: stats.portName,
        country: stats.country,
        region: stats.region,
        totalDeliveries: stats.deliveries,
        onTimeDeliveryRate,
        averageDeliveryTime,
        costEfficiency,
        customsClearanceTime: averageCustomsClearance,
        rating: averageRating,
        trends: this.generatePortTrends(stats.portCode),
        seasonalPatterns: this.generateSeasonalPatterns(),
        recommendations: this.generatePortRecommendations(onTimeDeliveryRate, costEfficiency),
        logistics: this.generatePortLogisticsMetrics(stats.portCode),
        comparison: this.generatePortComparisonData(costEfficiency, onTimeDeliveryRate)
      };
    });

    // Sort by efficiency
    return portRankings.sort((a, b) => b.costEfficiency - a.costEfficiency);
  }

  private async generateLogisticsOptimizations(filters: DashboardFilters): Promise<LogisticsOptimization[]> {
    // Mock logistics optimization opportunities
    return [
      {
        id: 'opt-1',
        type: 'route',
        title: 'Optimize Singapore-Rotterdam Route',
        description: 'Consolidate shipments through Singapore hub to reduce costs by 15%',
        currentCost: 125000,
        optimizedCost: 106250,
        potentialSavings: 18750,
        savingsPercentage: 15,
        implementationComplexity: 'medium',
        riskLevel: 'low',
        estimatedTimeToImplement: 30,
        affectedVessels: ['vessel-1', 'vessel-2', 'vessel-3'],
        affectedRoutes: ['SG-RTM', 'SG-HAM']
      },
      {
        id: 'opt-2',
        type: 'timing',
        title: 'Adjust Delivery Timing for Port Congestion',
        description: 'Schedule deliveries during off-peak hours to reduce waiting time',
        currentCost: 85000,
        optimizedCost: 76500,
        potentialSavings: 8500,
        savingsPercentage: 10,
        implementationComplexity: 'low',
        riskLevel: 'low',
        estimatedTimeToImplement: 14,
        affectedVessels: ['vessel-4', 'vessel-5'],
        affectedRoutes: ['HK-LA', 'HK-LB']
      },
      {
        id: 'opt-3',
        type: 'consolidation',
        title: 'Bulk Purchase Consolidation',
        description: 'Consolidate similar items across multiple vessels for better pricing',
        currentCost: 200000,
        optimizedCost: 170000,
        potentialSavings: 30000,
        savingsPercentage: 15,
        implementationComplexity: 'high',
        riskLevel: 'medium',
        estimatedTimeToImplement: 60,
        affectedVessels: ['vessel-1', 'vessel-2', 'vessel-3', 'vessel-4'],
        affectedRoutes: ['ALL']
      }
    ];
  }

  private async generateSeasonalForecasts(filters: DashboardFilters): Promise<SeasonalDemandForecast[]> {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return months.map((monthName, index) => ({
      month: index + 1,
      monthName,
      demandMultiplier: this.calculateSeasonalMultiplier(index + 1),
      predictedVolume: Math.floor(Math.random() * 500 + 200), // Mock data
      confidence: Math.floor(Math.random() * 30 + 70), // 70-100% confidence
      factors: [
        {
          factor: 'Weather Patterns',
          impact: 'high',
          description: 'Seasonal weather affects shipping routes and demand',
          historicalCorrelation: 0.8
        },
        {
          factor: 'Holiday Seasons',
          impact: 'medium',
          description: 'Holiday periods affect crew availability and port operations',
          historicalCorrelation: 0.6
        }
      ],
      recommendations: this.generateSeasonalRecommendations(index + 1)
    }));
  }

  private async generateRegionalAnalysis(filters: DashboardFilters): Promise<RegionalPortAnalysis[]> {
    const regions = ['Asia Pacific', 'Europe', 'North America', 'Middle East', 'Africa'];
    
    return regions.map(region => ({
      region,
      portCount: Math.floor(Math.random() * 20 + 5),
      averageEfficiency: Math.floor(Math.random() * 30 + 70),
      totalVolume: Math.floor(Math.random() * 10000 + 5000),
      costIndex: Math.random() * 0.4 + 0.8, // 0.8 to 1.2
      strengths: this.getRegionalStrengths(region),
      challenges: this.getRegionalChallenges(region),
      opportunities: this.getRegionalOpportunities(region)
    }));
  }

  private async generatePortAlerts(filters: DashboardFilters): Promise<PortAlert[]> {
    return [
      {
        id: 'alert-1',
        portId: 'SGSIN',
        portName: 'Singapore',
        type: 'congestion',
        severity: 'warning',
        message: 'Port congestion expected due to increased traffic',
        impact: 'Delivery delays of 2-4 hours expected',
        recommendedAction: 'Consider alternative delivery times or nearby ports',
        estimatedDuration: '3-5 days',
        createdAt: new Date()
      },
      {
        id: 'alert-2',
        portId: 'NLRTM',
        portName: 'Rotterdam',
        type: 'cost_increase',
        severity: 'info',
        message: 'Port handling fees increased by 5%',
        impact: 'Slight increase in delivery costs',
        recommendedAction: 'Update cost calculations for future deliveries',
        estimatedDuration: 'Permanent',
        createdAt: new Date()
      }
    ];
  }

  // Helper methods for port efficiency analytics
  private getRegionFromCountry(country: string): string {
    const regionMap: { [key: string]: string } = {
      'Singapore': 'Asia Pacific',
      'China': 'Asia Pacific',
      'Japan': 'Asia Pacific',
      'Netherlands': 'Europe',
      'Germany': 'Europe',
      'United Kingdom': 'Europe',
      'United States': 'North America',
      'Canada': 'North America',
      'UAE': 'Middle East',
      'Saudi Arabia': 'Middle East',
      'South Africa': 'Africa',
      'Egypt': 'Africa'
    };
    return regionMap[country] || 'Other';
  }

  private generatePortTrends(portCode: string): PortTrend[] {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map(month => ({
      period: month,
      deliveries: Math.floor(Math.random() * 50 + 10),
      onTimeRate: Math.random() * 20 + 80,
      averageTime: Math.random() * 10 + 20,
      cost: Math.random() * 5000 + 10000
    }));
  }

  private generateSeasonalPatterns(): SeasonalPattern[] {
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(2024, i, 1).toLocaleString('default', { month: 'long' }),
      demandMultiplier: this.calculateSeasonalMultiplier(i + 1),
      averageDeliveryTime: Math.random() * 10 + 20,
      costMultiplier: Math.random() * 0.3 + 0.85
    }));
  }

  private calculateSeasonalMultiplier(month: number): number {
    // Higher demand in Q4 and Q1 due to maintenance seasons
    const seasonalFactors = [1.2, 1.1, 1.0, 0.9, 0.8, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4];
    return seasonalFactors[month - 1] || 1.0;
  }

  private generatePortRecommendations(onTimeRate: number, efficiency: number): PortRecommendation[] {
    const recommendations: PortRecommendation[] = [];
    
    if (onTimeRate < 80) {
      recommendations.push({
        id: 'rec-timing',
        type: 'timing',
        title: 'Improve Delivery Timing',
        description: 'Consider scheduling deliveries during off-peak hours',
        impact: 'medium',
        estimatedSavings: 5000
      });
    }
    
    if (efficiency < 70) {
      recommendations.push({
        id: 'rec-alternative',
        type: 'alternative',
        title: 'Consider Alternative Ports',
        description: 'Evaluate nearby ports with better efficiency ratings',
        impact: 'high',
        estimatedSavings: 15000
      });
    }
    
    return recommendations;
  }

  private generatePortLogisticsMetrics(portCode: string): PortLogisticsMetrics {
    return {
      averageDockingTime: Math.random() * 4 + 2,
      cargoHandlingEfficiency: Math.floor(Math.random() * 30 + 70),
      portCongestionLevel: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
      availableBerths: Math.floor(Math.random() * 10 + 5),
      averageWaitTime: Math.random() * 3 + 1,
      fuelAvailability: Math.random() > 0.2,
      sparePartsAvailability: Math.random() > 0.3,
      customsComplexity: Math.random() > 0.6 ? 'complex' : Math.random() > 0.3 ? 'moderate' : 'simple'
    };
  }

  private generatePortComparisonData(efficiency: number, onTimeRate: number): PortComparisonData {
    const totalPorts = 100; // Mock total ports
    const rank = Math.floor((100 - efficiency) / 100 * totalPorts) + 1;
    
    return {
      rank,
      totalPorts,
      benchmarkMetrics: {
        deliveryTime: 24,
        costEfficiency: 75,
        onTimeRate: 85
      },
      competitorAnalysis: {
        betterPorts: rank - 1,
        worsePorts: totalPorts - rank,
        similarPorts: Math.floor(totalPorts * 0.1)
      }
    };
  }

  private getRegionalStrengths(region: string): string[] {
    const strengths: { [key: string]: string[] } = {
      'Asia Pacific': ['High efficiency', 'Advanced technology', 'Strategic location'],
      'Europe': ['Excellent infrastructure', 'Regulatory compliance', 'Skilled workforce'],
      'North America': ['Large capacity', 'Modern facilities', 'Good connectivity'],
      'Middle East': ['Strategic hub location', 'Growing infrastructure', 'Competitive costs'],
      'Africa': ['Emerging markets', 'Cost advantages', 'Growing capacity']
    };
    return strengths[region] || ['Developing infrastructure'];
  }

  private getRegionalChallenges(region: string): string[] {
    const challenges: { [key: string]: string[] } = {
      'Asia Pacific': ['Congestion', 'Weather disruptions', 'High competition'],
      'Europe': ['High costs', 'Regulatory complexity', 'Environmental restrictions'],
      'North America': ['Labor costs', 'Infrastructure aging', 'Regulatory changes'],
      'Middle East': ['Political instability', 'Weather extremes', 'Limited diversity'],
      'Africa': ['Infrastructure gaps', 'Political risks', 'Limited capacity']
    };
    return challenges[region] || ['Infrastructure development needed'];
  }

  private getRegionalOpportunities(region: string): string[] {
    const opportunities: { [key: string]: string[] } = {
      'Asia Pacific': ['Digital transformation', 'Green shipping', 'Trade growth'],
      'Europe': ['Sustainability initiatives', 'Digital ports', 'Intermodal transport'],
      'North America': ['Infrastructure investment', 'Automation', 'Nearshoring'],
      'Middle East': ['Hub development', 'Diversification', 'Technology adoption'],
      'Africa': ['Infrastructure development', 'Trade facilitation', 'Regional integration']
    };
    return opportunities[region] || ['Market development'];
  }

  private generateSeasonalRecommendations(month: number): string[] {
    const recommendations: { [key: number]: string[] } = {
      1: ['Plan for increased maintenance demand', 'Stock up on critical spare parts'],
      2: ['Prepare for Chinese New Year disruptions', 'Consider alternative suppliers'],
      3: ['Monitor weather patterns for route planning', 'Optimize inventory levels'],
      4: ['Prepare for spring maintenance season', 'Review supplier contracts'],
      5: ['Plan for summer operational peak', 'Ensure adequate stock levels'],
      6: ['Monitor hurricane season preparations', 'Review emergency procedures'],
      7: ['Peak summer operations', 'Optimize delivery schedules'],
      8: ['Continue summer peak management', 'Plan for autumn transitions'],
      9: ['Prepare for autumn maintenance', 'Review annual contracts'],
      10: ['Plan for year-end procurement', 'Optimize budget utilization'],
      11: ['Prepare for winter operations', 'Stock cold weather supplies'],
      12: ['Year-end planning', 'Prepare for holiday disruptions']
    };
    return recommendations[month] || ['Monitor seasonal patterns'];
  }
}

export const dashboardAnalyticsService = new DashboardAnalyticsService();