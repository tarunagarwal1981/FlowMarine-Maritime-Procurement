import { useState, useEffect, useCallback } from 'react';
import { CycleTimeData, DashboardFilters, AnalyticsApiResponse } from '../types/analytics';

interface UseCycleTimeDataResult {
  data: CycleTimeData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useCycleTimeData = (filters: DashboardFilters): UseCycleTimeDataResult => {
  const [data, setData] = useState<CycleTimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCycleTimeData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        timeRange: filters.timeRange,
        dateFrom: filters.dateFrom.toISOString(),
        dateTo: filters.dateTo.toISOString(),
        currency: filters.currency,
        ...(filters.vessels.length > 0 && { vessels: filters.vessels.join(',') }),
        ...(filters.categories.length > 0 && { categories: filters.categories.join(',') }),
        ...(filters.vendors.length > 0 && { vendors: filters.vendors.join(',') })
      });

      const response = await fetch(`/api/analytics/cycle-time?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: AnalyticsApiResponse<CycleTimeData> = await response.json();
      
      if (!result.success) {
        throw new Error('Failed to fetch cycle time data');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching cycle time data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const refetch = useCallback(() => {
    fetchCycleTimeData();
  }, [fetchCycleTimeData]);

  useEffect(() => {
    fetchCycleTimeData();
  }, [fetchCycleTimeData]);

  return {
    data,
    loading,
    error,
    refetch
  };
};