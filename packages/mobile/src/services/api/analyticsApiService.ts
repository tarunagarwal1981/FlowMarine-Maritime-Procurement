import { apiService, ApiResponse } from './apiService';

// Analytics data interfaces matching backend service
export interface VesselAnalyticsData {
  vesselInfo: {
    id: string;
    name: string;
    type: string;
    currentLocation: string;
    status: string;
    imoNumber: string;
  };
  spendingMetrics: {
    totalSpend: number;
    monthlyAverage: number;
    budgetUtilization: number;
    costPerDay: number;
    currency: string;
  };
  categoryBreakdown: Array<{
    category: string;
    categoryCode: string;
    amount: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
    orderCount: number;
  }>;
  performanceMetrics: {
    avgCycleTime: number;
    onTimeDelivery: number;
    emergencyRequisitions: number;
    vendorRating: number;
    totalRequisitions: number;
  };
  spendTrend: Array<{
    period: string;
    amount: number;
    orderCount: number;
  }>;
  topCategories: Array<{
    name: string;
    code: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
  topVendors: Array<{
    id: string;
    name: string;
    amount: number;
    orderCount: number;
    performanceScore: number;
  }>;
  alerts: Array<{
    id: string;
    type: 'budget' | 'performance' | 'delivery' | 'emergency';
    severity: 'high' | 'medium' | 'low';
    message: string;
    timestamp: string;
  }>;
}

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  vesselIds?: string[];
  categories?: string[];
  vendorIds?: string[];
  currencies?: string[];
  baseCurrency?: string;
}

export interface SpendAnalyticsData {
  totalSpend: number;
  currency: string;
  timeRange: {
    start: string;
    end: string;
  };
  breakdown: {
    byVessel: Array<{
      vesselId: string;
      vesselName: string;
      totalAmount: number;
      percentage: number;
      trend: 'up' | 'down' | 'stable';
    }>;
    byCategory: Array<{
      categoryCode: string;
      categoryName: string;
      totalAmount: number;
      percentage: number;
      trend: 'up' | 'down' | 'stable';
    }>;
    byVendor: Array<{
      vendorId: string;
      vendorName: string;
      totalAmount: number;
      percentage: number;
      performanceScore: number;
    }>;
  };
  trends: {
    yearOverYear: number;
    monthOverMonth: number;
    quarterOverQuarter: number;
    growthRate: number;
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
  alerts: Array<{
    id: string;
    type: 'OVER_BUDGET' | 'APPROACHING_LIMIT' | 'UNDER_UTILIZED';
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    threshold: number;
    currentValue: number;
  }>;
}

class AnalyticsApiService {
  /**
   * Get vessel-specific analytics data
   */
  async getVesselAnalytics(
    vesselId: string,
    timeRange: '7d' | '30d' | '90d' | '1y' = '30d'
  ): Promise<ApiResponse<VesselAnalyticsData>> {
    const filters = this.buildTimeRangeFilters(timeRange);
    
    return apiService.get<VesselAnalyticsData>(
      `/analytics/vessels/${vesselId}?${new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
      }).toString()}`
    );
  }

  /**
   * Get spend analytics data
   */
  async getSpendAnalytics(filters: DashboardFilters): Promise<ApiResponse<SpendAnalyticsData>> {
    return apiService.post<SpendAnalyticsData>('/analytics/spend', filters);
  }

  /**
   * Get budget utilization data
   */
  async getBudgetUtilization(filters: DashboardFilters): Promise<ApiResponse<BudgetUtilizationData>> {
    return apiService.post<BudgetUtilizationData>('/analytics/budget', filters);
  }

  /**
   * Get vendor performance analytics
   */
  async getVendorPerformance(filters: DashboardFilters): Promise<ApiResponse<any[]>> {
    return apiService.post('/analytics/vendors/performance', filters);
  }

  /**
   * Get operational metrics
   */
  async getOperationalMetrics(filters: DashboardFilters): Promise<ApiResponse<any>> {
    return apiService.post('/analytics/operational', filters);
  }

  /**
   * Get financial insights
   */
  async getFinancialInsights(filters: DashboardFilters): Promise<ApiResponse<any>> {
    return apiService.post('/analytics/financial', filters);
  }

  /**
   * Get real-time dashboard data
   */
  async getDashboardData(
    vesselId?: string,
    timeRange: '7d' | '30d' | '90d' | '1y' = '30d'
  ): Promise<ApiResponse<any>> {
    const filters = this.buildTimeRangeFilters(timeRange);
    const params = new URLSearchParams({
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    if (vesselId) {
      params.append('vesselId', vesselId);
    }

    return apiService.get(`/dashboard/data?${params.toString()}`);
  }

  /**
   * Export analytics data
   */
  async exportAnalyticsData(
    type: 'vessel' | 'spend' | 'budget' | 'vendor',
    filters: DashboardFilters,
    format: 'pdf' | 'excel' = 'pdf'
  ): Promise<ApiResponse<{ downloadUrl: string }>> {
    return apiService.post(`/analytics/export/${type}`, {
      ...filters,
      format,
    });
  }

  /**
   * Build time range filters from preset ranges
   */
  private buildTimeRangeFilters(timeRange: '7d' | '30d' | '90d' | '1y'): DashboardFilters {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }
}

export const analyticsApiService = new AnalyticsApiService();