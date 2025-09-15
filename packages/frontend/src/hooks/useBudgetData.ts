import { useState, useEffect, useCallback } from 'react';
import { BudgetData, BudgetAlert, BudgetHierarchy } from '../types/analytics';

interface UseBudgetDataProps {
  budgetPeriod: string;
  vessels: Array<{ id: string; name: string }>;
  realTimeUpdates?: boolean;
  refreshInterval?: number; // in milliseconds
}

interface UseBudgetDataReturn {
  data: BudgetData | null;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  handleAlertClick: (alert: BudgetAlert) => void;
  handleHierarchyDrillDown: (level: BudgetHierarchy) => void;
}

export const useBudgetData = ({
  budgetPeriod,
  vessels,
  realTimeUpdates = true,
  refreshInterval = 30000, // 30 seconds
}: UseBudgetDataProps): UseBudgetDataReturn => {
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate mock budget data
  const generateMockBudgetData = useCallback((): BudgetData => {
    const totalBudget = 500000;
    const utilized = 350000 + Math.random() * 100000;
    const remaining = totalBudget - utilized;
    const utilizationPercentage = (utilized / totalBudget) * 100;
    
    // Generate variance
    const targetUtilization = 75; // 75% target utilization
    const variancePercentage = utilizationPercentage - targetUtilization;
    const varianceAmount = (variancePercentage / 100) * totalBudget;
    
    // Generate alerts
    const alerts: BudgetAlert[] = [];
    
    if (utilizationPercentage > 90) {
      alerts.push({
        id: 'alert-1',
        type: 'critical',
        message: 'Budget utilization exceeds 90% threshold',
        threshold: 90,
        currentValue: utilizationPercentage,
        createdAt: new Date(),
      });
    } else if (utilizationPercentage > 75) {
      alerts.push({
        id: 'alert-2',
        type: 'warning',
        message: 'Budget utilization approaching 75% threshold',
        threshold: 75,
        currentValue: utilizationPercentage,
        createdAt: new Date(),
      });
    }

    // Add vessel-specific alerts
    vessels.forEach((vessel, index) => {
      const vesselUtilization = 60 + Math.random() * 40;
      if (vesselUtilization > 85) {
        alerts.push({
          id: `vessel-alert-${vessel.id}`,
          type: vesselUtilization > 95 ? 'critical' : 'warning',
          message: `${vessel.name} budget utilization is ${vesselUtilization.toFixed(1)}%`,
          threshold: 85,
          currentValue: vesselUtilization,
          vesselId: vessel.id,
          createdAt: new Date(),
        });
      }
    });

    // Generate budget hierarchy
    const hierarchy: BudgetHierarchy[] = [
      // Company level
      {
        level: 'company',
        id: 'company-1',
        name: 'FlowMarine Corporation',
        budget: totalBudget,
        utilized: utilized,
        remaining: remaining,
        utilizationPercentage: utilizationPercentage,
        children: [
          // Fleet level
          {
            level: 'fleet',
            id: 'fleet-1',
            name: 'Atlantic Fleet',
            budget: totalBudget * 0.6,
            utilized: utilized * 0.6,
            remaining: (totalBudget - utilized) * 0.6,
            utilizationPercentage: utilizationPercentage * 0.9,
            children: vessels.slice(0, 2).map((vessel, index) => ({
              level: 'vessel' as const,
              id: vessel.id,
              name: vessel.name,
              budget: (totalBudget * 0.6) / 2,
              utilized: (utilized * 0.6) / 2,
              remaining: ((totalBudget - utilized) * 0.6) / 2,
              utilizationPercentage: (utilizationPercentage * 0.9) + (index * 5),
            })),
          },
          {
            level: 'fleet',
            id: 'fleet-2',
            name: 'Pacific Fleet',
            budget: totalBudget * 0.4,
            utilized: utilized * 0.4,
            remaining: (totalBudget - utilized) * 0.4,
            utilizationPercentage: utilizationPercentage * 1.1,
            children: vessels.slice(2).map((vessel, index) => ({
              level: 'vessel' as const,
              id: vessel.id,
              name: vessel.name,
              budget: (totalBudget * 0.4) / Math.max(vessels.slice(2).length, 1),
              utilized: (utilized * 0.4) / Math.max(vessels.slice(2).length, 1),
              remaining: ((totalBudget - utilized) * 0.4) / Math.max(vessels.slice(2).length, 1),
              utilizationPercentage: (utilizationPercentage * 1.1) + (index * 3),
            })),
          },
        ],
      },
    ];

    // Flatten hierarchy for main display
    const flatHierarchy: BudgetHierarchy[] = [
      ...hierarchy[0].children || [],
      ...(hierarchy[0].children?.flatMap(fleet => fleet.children || []) || []),
    ];

    return {
      totalBudget,
      utilized,
      remaining,
      utilizationPercentage,
      variance: {
        amount: varianceAmount,
        percentage: variancePercentage,
        status: variancePercentage > 10 ? 'over' : variancePercentage < -10 ? 'under' : 'on-track',
      },
      projectedSpend: utilized + (remaining * 0.8) + Math.random() * 50000,
      alerts,
      hierarchy: flatHierarchy,
    };
  }, [vessels]);

  // Fetch budget data
  const fetchBudgetData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // In a real implementation, this would be an API call
      // const response = await fetch('/api/analytics/budget-utilization', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ budgetPeriod, vessels: vessels.map(v => v.id) }),
      // });
      // const result = await response.json();
      // setData(result.data);

      // For now, use mock data
      const mockData = generateMockBudgetData();
      setData(mockData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch budget data');
    } finally {
      setLoading(false);
    }
  }, [budgetPeriod, vessels, generateMockBudgetData]);

  // Handle alert clicks
  const handleAlertClick = useCallback((alert: BudgetAlert) => {
    console.log('Alert clicked:', alert);
    
    // In a real implementation, this might:
    // - Navigate to detailed view
    // - Show alert details modal
    // - Mark alert as read
    // - Trigger corrective actions
    
    // For now, just log the alert
    if (alert.vesselId) {
      console.log(`Navigating to vessel ${alert.vesselId} budget details`);
    } else if (alert.category) {
      console.log(`Navigating to category ${alert.category} budget details`);
    }
  }, []);

  // Handle hierarchy drill-down
  const handleHierarchyDrillDown = useCallback((level: BudgetHierarchy) => {
    console.log('Hierarchy drill-down:', level);
    
    // In a real implementation, this might:
    // - Update filters to show only selected level
    // - Navigate to detailed budget view
    // - Update other dashboard components
    
    // For now, just log the selection
    console.log(`Drilling down to ${level.level}: ${level.name}`);
  }, []);

  // Refresh data manually
  const refreshData = useCallback(async () => {
    await fetchBudgetData();
  }, [fetchBudgetData]);

  // Initial data fetch
  useEffect(() => {
    fetchBudgetData();
  }, [fetchBudgetData]);

  // Auto-refresh setup
  useEffect(() => {
    if (!realTimeUpdates) return;

    const interval = setInterval(() => {
      fetchBudgetData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [realTimeUpdates, refreshInterval, fetchBudgetData]);

  return {
    data,
    loading,
    error,
    refreshData,
    handleAlertClick,
    handleHierarchyDrillDown,
  };
};