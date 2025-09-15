import { useState, useEffect, useCallback } from 'react';
import { CostAnalysisVarianceData } from '../types/analytics';

export interface CostAnalysisFilters {
  startDate: Date;
  endDate: Date;
  vesselIds?: string[];
  categories?: string[];
  vendorIds?: string[];
}

interface UseCostAnalysisDataResult {
  data: CostAnalysisVarianceData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useCostAnalysisData = (
  filters: CostAnalysisFilters
): UseCostAnalysisDataResult => {
  const [data, setData] = useState<CostAnalysisVarianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        startDate: filters.startDate.toISOString(),
        endDate: filters.endDate.toISOString(),
        ...(filters.vesselIds?.length && { vesselIds: filters.vesselIds.join(',') }),
        ...(filters.categories?.length && { categories: filters.categories.join(',') }),
        ...(filters.vendorIds?.length && { vendorIds: filters.vendorIds.join(',') })
      });

      const response = await fetch(`/api/analytics/financial/cost-analysis?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch cost analysis data');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching cost analysis data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      
      // Set mock data for development/demo purposes
      setData(generateMockCostAnalysisData(filters));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch
  };
};

// Mock data generator for development/demo purposes
const generateMockCostAnalysisData = (filters: CostAnalysisFilters): CostAnalysisVarianceData => {
  // Generate mock budget vs actual analysis
  const totalBudget = 1200000;
  const totalActual = 1150000;
  const totalVariance = totalActual - totalBudget;
  const variancePercentage = (totalVariance / totalBudget) * 100;
  const favorableVariance = Math.abs(Math.min(totalVariance, 0));
  const unfavorableVariance = Math.max(totalVariance, 0);

  // Generate monthly variance data
  const varianceByPeriod = [];
  const startDate = new Date(filters.startDate);
  const endDate = new Date(filters.endDate);
  
  for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
    const monthlyBudget = totalBudget / 12;
    const monthlyActual = monthlyBudget * (0.85 + Math.random() * 0.3); // 85-115% of budget
    const monthlyVariance = monthlyActual - monthlyBudget;
    const monthlyVariancePercentage = (monthlyVariance / monthlyBudget) * 100;

    varianceByPeriod.push({
      period: d.toISOString().substring(0, 7),
      budget: monthlyBudget,
      actual: monthlyActual,
      variance: monthlyVariance,
      variancePercentage: monthlyVariancePercentage,
      status: monthlyVariance < -monthlyBudget * 0.05 ? 'favorable' as const :
              monthlyVariance > monthlyBudget * 0.05 ? 'unfavorable' as const : 'on_target' as const
    });
  }

  const budgetVsActualAnalysis = {
    totalBudget,
    totalActual,
    totalVariance,
    variancePercentage,
    favorableVariance,
    unfavorableVariance,
    varianceByPeriod
  };

  // Generate mock cost per vessel mile data
  const overallCostPerMile = 15.75;

  const vesselComparison = [
    {
      vesselId: 'vessel1',
      vesselName: 'MV Ocean Pioneer',
      costPerMile: 14.20,
      totalMiles: 52000,
      totalCost: 738400,
      efficiency: 92,
      rank: 1,
      improvement: 5.2
    },
    {
      vesselId: 'vessel2',
      vesselName: 'MV Sea Explorer',
      costPerMile: 16.80,
      totalMiles: 48000,
      totalCost: 806400,
      efficiency: 78,
      rank: 2,
      improvement: -2.1
    },
    {
      vesselId: 'vessel3',
      vesselName: 'MV Maritime Star',
      costPerMile: 15.50,
      totalMiles: 45000,
      totalCost: 697500,
      efficiency: 85,
      rank: 3,
      improvement: 1.8
    },
    {
      vesselId: 'vessel4',
      vesselName: 'MV Blue Horizon',
      costPerMile: 17.20,
      totalMiles: 41000,
      totalCost: 705200,
      efficiency: 72,
      rank: 4,
      improvement: -4.3
    }
  ];

  const categoryBreakdown = [
    {
      category: 'Engine Parts',
      costPerMile: 6.30,
      percentage: 40,
      trend: 'increasing' as const,
      benchmark: 5.80
    },
    {
      category: 'Deck Equipment',
      costPerMile: 3.15,
      percentage: 20,
      trend: 'stable' as const,
      benchmark: 3.20
    },
    {
      category: 'Safety Equipment',
      costPerMile: 2.36,
      percentage: 15,
      trend: 'decreasing' as const,
      benchmark: 2.50
    },
    {
      category: 'Navigation',
      costPerMile: 1.58,
      percentage: 10,
      trend: 'stable' as const,
      benchmark: 1.60
    },
    {
      category: 'Maintenance',
      costPerMile: 2.36,
      percentage: 15,
      trend: 'increasing' as const,
      benchmark: 2.20
    }
  ];

  const trends = [];
  for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
    trends.push({
      period: d.toISOString().substring(0, 7),
      costPerMile: 15 + Math.random() * 3,
      totalMiles: 8000 + Math.random() * 2000,
      efficiency: 75 + Math.random() * 20
    });
  }

  const benchmarks = [
    {
      vesselType: 'Container Ship',
      industryAverage: 16.50,
      topQuartile: 13.20,
      bottomQuartile: 20.80,
      ourPerformance: 15.75,
      ranking: 'above_average' as const
    },
    {
      vesselType: 'Bulk Carrier',
      industryAverage: 14.20,
      topQuartile: 11.50,
      bottomQuartile: 17.90,
      ourPerformance: 15.75,
      ranking: 'below_average' as const
    }
  ];

  const costPerVesselMile = {
    overallCostPerMile,
    vesselComparison,
    categoryBreakdown,
    trends,
    benchmarks
  };

  // Generate mock category analysis
  const categories = ['Engine Parts', 'Deck Equipment', 'Safety Equipment', 'Navigation', 'Maintenance', 'Catering'];
  const categoryAnalysis = categories.map(category => {
    const actualAmount = Math.random() * 200000 + 100000;
    const budgetedAmount = actualAmount * (0.9 + Math.random() * 0.2);
    const variance = actualAmount - budgetedAmount;
    const variancePercentage = budgetedAmount > 0 ? (variance / budgetedAmount) * 100 : 0;

    const drivers = [
      {
        driver: 'Market Price Changes',
        impact: 'high' as const,
        description: `${category} prices fluctuated due to market conditions`,
        correlation: 0.7 + Math.random() * 0.3,
        actionable: false
      },
      {
        driver: 'Operational Demand',
        impact: 'medium' as const,
        description: `Higher operational requirements for ${category}`,
        correlation: 0.5 + Math.random() * 0.4,
        actionable: true
      }
    ];

    const seasonality = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(2024, i, 1).toLocaleString('default', { month: 'long' }),
      seasonalIndex: 0.7 + Math.random() * 0.6,
      historicalAverage: actualAmount / 12,
      explanation: i < 6 ? 'Lower demand in first half' : 'Higher demand in second half'
    }));

    return {
      category,
      budgetedAmount,
      actualAmount,
      variance,
      variancePercentage,
      trend: variance > budgetedAmount * 0.1 ? 'increasing' as const :
             variance < -budgetedAmount * 0.1 ? 'decreasing' as const : 'stable' as const,
      drivers,
      seasonality
    };
  });

  // Generate variance explanations
  const varianceExplanation = categoryAnalysis
    .filter(category => Math.abs(category.variancePercentage) > 5)
    .map(category => ({
      category: category.category,
      variance: category.variance,
      rootCause: category.variance > 0 ? 'Market price increases and higher operational demand' : 'Successful cost reduction initiatives',
      explanation: category.variance > 0 
        ? `${category.category} spending exceeded budget by ${category.variancePercentage.toFixed(1)}% primarily due to market price increases and unexpected operational requirements`
        : `${category.category} spending was ${Math.abs(category.variancePercentage).toFixed(1)}% under budget due to successful cost optimization and efficient procurement practices`,
      impact: Math.abs(category.variancePercentage) > 15 ? 'high' as const :
              Math.abs(category.variancePercentage) > 10 ? 'medium' as const : 'low' as const,
      controllable: category.drivers.some(d => d.actionable),
      recommendedAction: category.variance > 0 
        ? 'Review procurement processes, negotiate better terms, and consider bulk purchasing agreements'
        : 'Continue current cost optimization strategies and share best practices across categories',
      timeline: '30-90 days'
    }));

  // Generate cost optimization recommendations
  const costOptimizationRecommendations = [
    {
      id: 'opt-engine-1',
      category: 'Engine Parts',
      type: 'vendor_negotiation' as const,
      title: 'Negotiate Volume Discounts for Engine Parts',
      description: 'Leverage consolidated purchasing power to negotiate better pricing with engine parts suppliers',
      currentCost: 400000,
      optimizedCost: 360000,
      potentialSavings: 40000,
      savingsPercentage: 10,
      implementationEffort: 'medium' as const,
      riskLevel: 'low' as const,
      timeToImplement: '60-90 days',
      roi: 5.2,
      priority: 'high' as const
    },
    {
      id: 'opt-maintenance-1',
      category: 'Maintenance',
      type: 'process_improvement' as const,
      title: 'Implement Predictive Maintenance Program',
      description: 'Reduce unplanned maintenance costs through predictive analytics and condition monitoring',
      currentCost: 250000,
      optimizedCost: 200000,
      potentialSavings: 50000,
      savingsPercentage: 20,
      implementationEffort: 'high' as const,
      riskLevel: 'medium' as const,
      timeToImplement: '120-180 days',
      roi: 3.8,
      priority: 'high' as const
    },
    {
      id: 'opt-deck-1',
      category: 'Deck Equipment',
      type: 'consolidation' as const,
      title: 'Consolidate Deck Equipment Suppliers',
      description: 'Reduce supplier base and achieve economies of scale for deck equipment procurement',
      currentCost: 180000,
      optimizedCost: 162000,
      potentialSavings: 18000,
      savingsPercentage: 10,
      implementationEffort: 'medium' as const,
      riskLevel: 'low' as const,
      timeToImplement: '45-60 days',
      roi: 4.5,
      priority: 'medium' as const
    },
    {
      id: 'opt-safety-1',
      category: 'Safety Equipment',
      type: 'timing_optimization' as const,
      title: 'Optimize Safety Equipment Procurement Timing',
      description: 'Time purchases to take advantage of seasonal pricing and bulk order discounts',
      currentCost: 120000,
      optimizedCost: 108000,
      potentialSavings: 12000,
      savingsPercentage: 10,
      implementationEffort: 'low' as const,
      riskLevel: 'low' as const,
      timeToImplement: '30-45 days',
      roi: 6.0,
      priority: 'medium' as const
    },
    {
      id: 'opt-nav-1',
      category: 'Navigation',
      type: 'vendor_negotiation' as const,
      title: 'Renegotiate Navigation Equipment Contracts',
      description: 'Review and renegotiate existing contracts for navigation equipment and software licenses',
      currentCost: 80000,
      optimizedCost: 72000,
      potentialSavings: 8000,
      savingsPercentage: 10,
      implementationEffort: 'medium' as const,
      riskLevel: 'low' as const,
      timeToImplement: '60-90 days',
      roi: 4.0,
      priority: 'low' as const
    }
  ].sort((a, b) => b.potentialSavings - a.potentialSavings);

  return {
    budgetVsActualAnalysis,
    costPerVesselMile,
    categoryAnalysis,
    varianceExplanation,
    costOptimizationRecommendations
  };
};