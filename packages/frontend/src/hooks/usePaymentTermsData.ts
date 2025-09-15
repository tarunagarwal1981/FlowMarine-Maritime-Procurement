import { useState, useEffect, useCallback } from 'react';
import { PaymentTermsOptimizationData } from '../types/analytics';

export interface PaymentTermsFilters {
  startDate: Date;
  endDate: Date;
  vesselIds?: string[];
  categories?: string[];
  vendorIds?: string[];
}

interface UsePaymentTermsDataResult {
  data: PaymentTermsOptimizationData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const usePaymentTermsData = (
  filters: PaymentTermsFilters
): UsePaymentTermsDataResult => {
  const [data, setData] = useState<PaymentTermsOptimizationData | null>(null);
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

      const response = await fetch(`/api/analytics/financial/payment-terms?${queryParams}`, {
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
        throw new Error(result.error || 'Failed to fetch payment terms data');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching payment terms data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      
      // Set mock data for development/demo purposes
      setData(generateMockPaymentTermsData(filters));
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
const generateMockPaymentTermsData = (filters: PaymentTermsFilters): PaymentTermsOptimizationData => {
  // Generate mock payment terms analysis
  const termDistribution = [
    { terms: 'NET30', vendorCount: 15, totalValue: 500000, percentage: 45.5 },
    { terms: 'NET45', vendorCount: 8, totalValue: 300000, percentage: 27.3 },
    { terms: 'NET60', vendorCount: 5, totalValue: 200000, percentage: 18.2 },
    { terms: '2/10 NET30', vendorCount: 4, totalValue: 80000, percentage: 7.3 },
    { terms: 'NET15', vendorCount: 2, totalValue: 20000, percentage: 1.8 }
  ];

  const averagePaymentTerms = 38;
  const weightedAverageTerms = 35;

  const currentTermsAnalysis = {
    averagePaymentTerms,
    weightedAverageTerms,
    termDistribution,
    benchmarkComparison: {
      industryAverage: 35,
      variance: averagePaymentTerms - 35,
      ranking: averagePaymentTerms < 30 ? 'above_average' as const : 
               averagePaymentTerms > 40 ? 'below_average' as const : 'average' as const
    }
  };

  // Generate mock early payment discount data
  const captured = 25000;
  const missed = 15000;
  const potentialSavings = missed * 0.8;

  const discountOpportunities = [
    {
      vendorId: 'vendor1',
      vendorName: 'Maritime Supplies Co.',
      discountRate: 2.0,
      discountDays: 10,
      standardTerms: 30,
      potentialSavings: 8000,
      riskAssessment: 'low' as const
    },
    {
      vendorId: 'vendor2',
      vendorName: 'Engine Parts Ltd.',
      discountRate: 1.5,
      discountDays: 15,
      standardTerms: 45,
      potentialSavings: 5500,
      riskAssessment: 'medium' as const
    },
    {
      vendorId: 'vendor3',
      vendorName: 'Safety Equipment Inc.',
      discountRate: 2.5,
      discountDays: 7,
      standardTerms: 30,
      potentialSavings: 3200,
      riskAssessment: 'low' as const
    }
  ];

  // Generate monthly trends
  const monthlyTrends = [];
  const startDate = new Date(filters.startDate);
  const endDate = new Date(filters.endDate);
  
  for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
    monthlyTrends.push({
      month: d.toISOString().substring(0, 7),
      captured: Math.random() * 8000 + 2000,
      missed: Math.random() * 5000 + 1000,
      captureRate: Math.random() * 30 + 60 // 60-90%
    });
  }

  const earlyPaymentDiscounts = {
    captured,
    missed,
    potentialSavings,
    discountOpportunities,
    monthlyTrends
  };

  // Generate mock vendor payment performance
  const vendorPaymentPerformance = [
    {
      vendorId: 'vendor1',
      vendorName: 'Maritime Supplies Co.',
      averagePaymentTime: 28,
      onTimePaymentRate: 92,
      earlyPaymentRate: 15,
      latePaymentRate: 8,
      paymentTerms: 'NET30',
      creditRating: 'A+',
      relationshipScore: 88
    },
    {
      vendorId: 'vendor2',
      vendorName: 'Engine Parts Ltd.',
      averagePaymentTime: 42,
      onTimePaymentRate: 78,
      earlyPaymentRate: 8,
      latePaymentRate: 22,
      paymentTerms: 'NET45',
      creditRating: 'A',
      relationshipScore: 72
    },
    {
      vendorId: 'vendor3',
      vendorName: 'Safety Equipment Inc.',
      averagePaymentTime: 25,
      onTimePaymentRate: 95,
      earlyPaymentRate: 22,
      latePaymentRate: 5,
      paymentTerms: '2/10 NET30',
      creditRating: 'A+',
      relationshipScore: 94
    },
    {
      vendorId: 'vendor4',
      vendorName: 'Navigation Systems Corp.',
      averagePaymentTime: 55,
      onTimePaymentRate: 68,
      earlyPaymentRate: 5,
      latePaymentRate: 32,
      paymentTerms: 'NET60',
      creditRating: 'B+',
      relationshipScore: 65
    },
    {
      vendorId: 'vendor5',
      vendorName: 'Global Marine Services',
      averagePaymentTime: 18,
      onTimePaymentRate: 98,
      earlyPaymentRate: 35,
      latePaymentRate: 2,
      paymentTerms: 'NET15',
      creditRating: 'A+',
      relationshipScore: 96
    }
  ];

  // Generate mock cash flow optimization
  const currentCashCycle = 45;
  const optimizedCashCycle = 35;
  const potentialImprovement = currentCashCycle - optimizedCashCycle;

  const recommendations = [
    {
      id: 'cf1',
      type: 'extend_terms' as const,
      title: 'Negotiate Extended Payment Terms',
      description: 'Extend payment terms with key suppliers from NET30 to NET45 for improved cash flow',
      impact: 25000,
      implementationEffort: 'medium' as const,
      riskLevel: 'low' as const
    },
    {
      id: 'cf2',
      type: 'early_discount' as const,
      title: 'Optimize Early Payment Discounts',
      description: 'Selectively take early payment discounts with positive NPV impact',
      impact: 12000,
      implementationEffort: 'low' as const,
      riskLevel: 'low' as const
    },
    {
      id: 'cf3',
      type: 'payment_timing' as const,
      title: 'Optimize Payment Timing',
      description: 'Adjust payment timing to maximize cash flow while maintaining vendor relationships',
      impact: 8000,
      implementationEffort: 'medium' as const,
      riskLevel: 'medium' as const
    }
  ];

  // Generate monthly cash flow projections
  const monthlyProjections = [];
  let cumulativeFlow = 0;
  
  for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
    const inflows = 800000 + Math.random() * 200000;
    const outflows = 750000 + Math.random() * 150000;
    const netFlow = inflows - outflows;
    cumulativeFlow += netFlow;
    
    monthlyProjections.push({
      month: d.toISOString().substring(0, 7),
      inflows,
      outflows,
      netFlow,
      cumulativeFlow
    });
  }

  const cashFlowOptimization = {
    currentCashCycle,
    optimizedCashCycle,
    potentialImprovement,
    recommendations,
    monthlyProjections
  };

  // Generate payment timing optimization
  const paymentTimingOptimization = [
    {
      vendorId: 'vendor1',
      vendorName: 'Maritime Supplies Co.',
      currentTiming: 'Pay on due date',
      recommendedTiming: 'Pay 5 days early for 2% discount',
      potentialSavings: 8000,
      riskImpact: 'positive' as const,
      implementationComplexity: 'low' as const
    },
    {
      vendorId: 'vendor2',
      vendorName: 'Engine Parts Ltd.',
      currentTiming: 'Pay 10 days early',
      recommendedTiming: 'Pay on due date',
      potentialSavings: 3500,
      riskImpact: 'neutral' as const,
      implementationComplexity: 'low' as const
    },
    {
      vendorId: 'vendor4',
      vendorName: 'Navigation Systems Corp.',
      currentTiming: 'Pay 5 days late',
      recommendedTiming: 'Pay on due date',
      potentialSavings: 2000,
      riskImpact: 'positive' as const,
      implementationComplexity: 'medium' as const
    }
  ];

  return {
    currentTermsAnalysis,
    earlyPaymentDiscounts,
    vendorPaymentPerformance,
    cashFlowOptimization,
    paymentTimingOptimization
  };
};