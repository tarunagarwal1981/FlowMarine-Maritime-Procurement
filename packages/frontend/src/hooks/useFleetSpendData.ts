import { useState, useEffect, useCallback } from 'react';
import { SpendData, DashboardFilters, DrillDownLevel } from '../types/analytics';

interface UseFleetSpendDataProps {
  initialTimeRange?: 'monthly' | 'quarterly' | 'yearly';
  vessels: Array<{ id: string; name: string }>;
  categories: string[];
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

interface UseFleetSpendDataReturn {
  data: SpendData[];
  loading: boolean;
  error: string | null;
  timeRange: 'monthly' | 'quarterly' | 'yearly';
  drillDownLevel: DrillDownLevel;
  filters: DashboardFilters;
  setTimeRange: (range: 'monthly' | 'quarterly' | 'yearly') => void;
  setDrillDown: (level: 'fleet' | 'vessel' | 'category', id?: string) => void;
  setFilters: (filters: Partial<DashboardFilters>) => void;
  refreshData: () => Promise<void>;
}

export const useFleetSpendData = ({
  initialTimeRange = 'monthly',
  vessels,
  categories,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
}: UseFleetSpendDataProps): UseFleetSpendDataReturn => {
  const [data, setData] = useState<SpendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'monthly' | 'quarterly' | 'yearly'>(initialTimeRange);
  const [drillDownLevel, setDrillDownLevel] = useState<DrillDownLevel>({ level: 'fleet' });
  const [filters, setFiltersState] = useState<DashboardFilters>({
    timeRange: initialTimeRange,
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth() - 12, 1),
    dateTo: new Date(),
    vessels: vessels.map(v => v.id),
    categories,
    vendors: [],
    currency: 'USD',
  });

  // Mock data generator for development
  const generateMockData = useCallback((): SpendData[] => {
    const periods = [];
    const now = new Date();
    
    // Generate periods based on time range
    for (let i = 11; i >= 0; i--) {
      let period: string;
      let date: Date;
      
      if (timeRange === 'monthly') {
        date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        period = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      } else if (timeRange === 'quarterly') {
        const quarter = Math.floor((now.getMonth() - i * 3) / 3) + 1;
        const year = now.getFullYear() - Math.floor(i / 4);
        period = `Q${quarter} ${year}`;
        date = new Date(year, (quarter - 1) * 3, 1);
      } else {
        date = new Date(now.getFullYear() - i, 0, 1);
        period = date.getFullYear().toString();
      }

      const baseSpend = 50000 + Math.random() * 100000;
      const categoryBreakdown = categories.map((category, index) => ({
        category,
        amount: baseSpend * (0.1 + Math.random() * 0.3),
        percentage: 0, // Will be calculated
        trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable' as const,
      }));

      // Calculate percentages
      const total = categoryBreakdown.reduce((sum, cat) => sum + cat.amount, 0);
      categoryBreakdown.forEach(cat => {
        cat.percentage = (cat.amount / total) * 100;
      });

      const vesselBreakdown = vessels.map(vessel => ({
        vesselId: vessel.id,
        vesselName: vessel.name,
        amount: baseSpend * (0.1 + Math.random() * 0.2),
        percentage: 0, // Will be calculated
      }));

      // Calculate vessel percentages
      const vesselTotal = vesselBreakdown.reduce((sum, vessel) => sum + vessel.amount, 0);
      vesselBreakdown.forEach(vessel => {
        vessel.percentage = (vessel.amount / vesselTotal) * 100;
      });

      periods.push({
        period,
        totalSpend: total,
        currency: filters.currency,
        breakdown: categoryBreakdown,
        vesselBreakdown,
        yearOverYear: i === 0 ? {
          currentPeriod: total,
          previousPeriod: total * (0.8 + Math.random() * 0.4),
          change: total * (Math.random() * 0.4 - 0.2),
          changePercentage: (Math.random() * 40 - 20),
        } : undefined,
      });
    }

    return periods;
  }, [timeRange, vessels, categories, filters.currency]);

  // Fetch data function (currently using mock data)
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // In a real implementation, this would be an API call
      // const response = await fetch('/api/analytics/fleet-spend', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ filters, drillDownLevel }),
      // });
      // const result = await response.json();
      // setData(result.data);

      // For now, use mock data
      const mockData = generateMockData();
      setData(mockData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch spend data');
    } finally {
      setLoading(false);
    }
  }, [generateMockData, drillDownLevel]);

  // Update filters
  const setFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    setFiltersState(prev => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  // Handle time range changes
  const handleTimeRangeChange = useCallback((range: 'monthly' | 'quarterly' | 'yearly') => {
    setTimeRange(range);
    setFilters({ timeRange: range });
  }, [setFilters]);

  // Handle drill down
  const setDrillDown = useCallback((level: 'fleet' | 'vessel' | 'category', id?: string) => {
    setDrillDownLevel({ level, id });
  }, []);

  // Refresh data manually
  const refreshData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  // Refetch when filters change
  useEffect(() => {
    fetchData();
  }, [filters, drillDownLevel]);

  return {
    data,
    loading,
    error,
    timeRange,
    drillDownLevel,
    filters,
    setTimeRange: handleTimeRangeChange,
    setDrillDown,
    setFilters,
    refreshData,
  };
};