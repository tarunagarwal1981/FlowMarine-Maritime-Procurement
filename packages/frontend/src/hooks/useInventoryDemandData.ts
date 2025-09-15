import { useState, useEffect, useMemo } from 'react';
import { useAppSelector } from '../store/hooks';
import { 
  InventoryDemandFilters, 
  InventoryTurnoverData, 
  DemandForecastData, 
  OptimizationRecommendations,
  StockAlertsData,
  PredictiveMaintenanceData
} from '../types/analytics';

interface UseInventoryDemandDataReturn {
  inventoryTurnover: InventoryTurnoverData | null;
  demandForecast: DemandForecastData | null;
  optimizationRecommendations: OptimizationRecommendations | null;
  stockAlerts: StockAlertsData | null;
  predictiveMaintenanceNeeds: PredictiveMaintenanceData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useInventoryDemandData = (
  filters: InventoryDemandFilters
): UseInventoryDemandDataReturn => {
  const [inventoryTurnover, setInventoryTurnover] = useState<InventoryTurnoverData | null>(null);
  const [demandForecast, setDemandForecast] = useState<DemandForecastData | null>(null);
  const [optimizationRecommendations, setOptimizationRecommendations] = useState<OptimizationRecommendations | null>(null);
  const [stockAlerts, setStockAlerts] = useState<StockAlertsData | null>(null);
  const [predictiveMaintenanceNeeds, setPredictiveMaintenanceNeeds] = useState<PredictiveMaintenanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { token } = useAppSelector((state) => state.auth);

  const fetchInventoryDemandData = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      
      if (filters.vesselIds?.length) {
        queryParams.append('vesselIds', filters.vesselIds.join(','));
      }
      if (filters.selectedVessel) {
        queryParams.append('vesselId', filters.selectedVessel);
      }
      if (filters.categories?.length) {
        queryParams.append('categories', filters.categories.join(','));
      }
      if (filters.timeRange) {
        queryParams.append('startDate', filters.timeRange.start.toISOString());
        queryParams.append('endDate', filters.timeRange.end.toISOString());
      }

      // Fetch all inventory and demand analytics data
      const [
        turnoverResponse,
        forecastResponse,
        optimizationResponse,
        alertsResponse,
        maintenanceResponse
      ] = await Promise.all([
        fetch(`/api/analytics/inventory/turnover?${queryParams}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/analytics/demand/forecast?${queryParams}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/analytics/inventory/optimization?${queryParams}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/analytics/inventory/alerts?${queryParams}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/analytics/maintenance/predictive?${queryParams}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!turnoverResponse.ok || !forecastResponse.ok || !optimizationResponse.ok || 
          !alertsResponse.ok || !maintenanceResponse.ok) {
        throw new Error('Failed to fetch inventory and demand analytics data');
      }

      const [
        turnoverData,
        forecastData,
        optimizationData,
        alertsData,
        maintenanceData
      ] = await Promise.all([
        turnoverResponse.json(),
        forecastResponse.json(),
        optimizationResponse.json(),
        alertsResponse.json(),
        maintenanceResponse.json()
      ]);

      setInventoryTurnover(turnoverData);
      setDemandForecast(forecastData);
      setOptimizationRecommendations(optimizationData);
      setStockAlerts(alertsData);
      setPredictiveMaintenanceNeeds(maintenanceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching inventory and demand analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryDemandData();
  }, [
    token,
    filters.vesselIds?.join(','),
    filters.selectedVessel,
    filters.categories?.join(','),
    filters.timeRange?.start.toISOString(),
    filters.timeRange?.end.toISOString()
  ]);

  const refetch = () => {
    fetchInventoryDemandData();
  };

  return {
    inventoryTurnover,
    demandForecast,
    optimizationRecommendations,
    stockAlerts,
    predictiveMaintenanceNeeds,
    loading,
    error,
    refetch
  };
};

export default useInventoryDemandData;