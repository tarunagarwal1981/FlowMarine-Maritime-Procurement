import { useState, useEffect, useCallback } from 'react';
import { VesselSpendingPattern, DashboardFilters, AnalyticsApiResponse } from '../types/analytics';

interface UseVesselAnalyticsDataResult {
  data: VesselSpendingPattern[] | VesselSpendingPattern | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useVesselAnalyticsData = (
  filters: DashboardFilters, 
  selectedVessel?: string
): UseVesselAnalyticsDataResult => {
  const [data, setData] = useState<VesselSpendingPattern[] | VesselSpendingPattern | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVesselAnalyticsData = useCallback(async () => {
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
        ...(filters.vendors.length > 0 && { vendors: filters.vendors.join(',') }),
        ...(selectedVessel && { selectedVessel })
      });

      const endpoint = selectedVessel 
        ? `/api/analytics/vessel/${selectedVessel}?${queryParams}`
        : `/api/analytics/vessels?${queryParams}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: AnalyticsApiResponse<VesselSpendingPattern[] | VesselSpendingPattern> = await response.json();
      
      if (!result.success) {
        throw new Error('Failed to fetch vessel analytics data');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching vessel analytics data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters, selectedVessel]);

  const refetch = useCallback(() => {
    fetchVesselAnalyticsData();
  }, [fetchVesselAnalyticsData]);

  useEffect(() => {
    fetchVesselAnalyticsData();
  }, [fetchVesselAnalyticsData]);

  return {
    data,
    loading,
    error,
    refetch
  };
};