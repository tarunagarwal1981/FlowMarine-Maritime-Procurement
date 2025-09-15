import { useState, useEffect, useCallback } from 'react';
import { 
  PortEfficiencyDashboardData, 
  DashboardFilters,
  PortLogisticsData,
  LogisticsOptimization,
  SeasonalDemandForecast,
  RegionalPortAnalysis,
  PortAlert
} from '../types/analytics';

interface UsePortEfficiencyDataProps {
  filters: DashboardFilters;
  refreshInterval?: number;
  enabled?: boolean;
}

interface UsePortEfficiencyDataReturn {
  data: PortEfficiencyDashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateFilters: (newFilters: Partial<DashboardFilters>) => void;
  exportData: (format: 'pdf' | 'excel') => Promise<void>;
}

export const usePortEfficiencyData = ({
  filters,
  refreshInterval = 30000, // 30 seconds
  enabled = true
}: UsePortEfficiencyDataProps): UsePortEfficiencyDataReturn => {
  const [data, setData] = useState<PortEfficiencyDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<DashboardFilters>(filters);

  // Fetch port efficiency data
  const fetchPortEfficiencyData = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        timeRange: currentFilters.timeRange,
        dateFrom: currentFilters.dateFrom.toISOString(),
        dateTo: currentFilters.dateTo.toISOString(),
        vessels: currentFilters.vessels.join(','),
        categories: currentFilters.categories.join(','),
        vendors: currentFilters.vendors.join(','),
        currency: currentFilters.currency,
      });

      const response = await fetch(`/api/analytics/port-efficiency?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch port efficiency data: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch port efficiency data');
      }

      setData(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching port efficiency data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentFilters, enabled]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    setCurrentFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Export data
  const exportData = useCallback(async (format: 'pdf' | 'excel') => {
    try {
      const queryParams = new URLSearchParams({
        format,
        timeRange: currentFilters.timeRange,
        dateFrom: currentFilters.dateFrom.toISOString(),
        dateTo: currentFilters.dateTo.toISOString(),
        vessels: currentFilters.vessels.join(','),
        categories: currentFilters.categories.join(','),
        vendors: currentFilters.vendors.join(','),
        currency: currentFilters.currency,
      });

      const response = await fetch(`/api/analytics/port-efficiency/export?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to export data: ${response.statusText}`);
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `port-efficiency-${format}-${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting data:', err);
      throw err;
    }
  }, [currentFilters]);

  // Refetch data
  const refetch = useCallback(async () => {
    await fetchPortEfficiencyData();
  }, [fetchPortEfficiencyData]);

  // Initial data fetch
  useEffect(() => {
    fetchPortEfficiencyData();
  }, [fetchPortEfficiencyData]);

  // Set up refresh interval
  useEffect(() => {
    if (!enabled || !refreshInterval) return;

    const interval = setInterval(() => {
      fetchPortEfficiencyData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchPortEfficiencyData, refreshInterval, enabled]);

  // Update filters effect
  useEffect(() => {
    setCurrentFilters(filters);
  }, [filters]);

  return {
    data,
    loading,
    error,
    refetch,
    updateFilters,
    exportData,
  };
};