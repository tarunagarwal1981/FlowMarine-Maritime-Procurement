import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface DashboardWidget {
  id: string;
  type: 'spend' | 'budget' | 'vendor' | 'requisitions' | 'alerts';
  title: string;
  size: 'small' | 'medium' | 'large';
  position: {x: number; y: number};
  data: any;
  lastUpdated: string;
  refreshInterval: number;
}

export interface DashboardData {
  totalSpend: number;
  budgetUtilization: number;
  pendingRequisitions: number;
  activeVendors: number;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
  }>;
  alerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: string;
  }>;
}

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
  // Environmental data interface for sensor integration
  environmentalData?: {
    // Sensor data fields: accelerometer, gyroscope, magnetometer
    accelerometer: {x: number; y: number; z: number; timestamp: number} | null;
    gyroscope: {x: number; y: number; z: number; timestamp: number} | null;
    magnetometer: {x: number; y: number; z: number; timestamp: number} | null;
    motionIntensity: number;
    orientation: 'portrait' | 'landscape' | 'unknown';
    // Sea conditions: calm, moderate, rough, very_rough
    seaConditions: 'calm' | 'moderate' | 'rough' | 'very_rough';
    // Stability: stable, moderate, unstable
    stability: 'stable' | 'moderate' | 'unstable';
    lastUpdated: string;
  };
}

interface DashboardState {
  widgets: DashboardWidget[];
  dashboardData: DashboardData | null;
  vesselAnalytics: VesselAnalyticsData | null;
  selectedTimeRange: '7d' | '30d' | '90d' | '1y';
  selectedVessel: string | null;
  isLoading: boolean;
  analyticsLoading: boolean;
  error: string | null;
  analyticsError: string | null;
  lastRefresh: string | null;
  lastAnalyticsRefresh: string | null;
  autoRefresh: boolean;
  refreshInterval: number;
  isWebSocketConnected: boolean;
  retryCount: number;
}

const initialState: DashboardState = {
  widgets: [],
  dashboardData: null,
  vesselAnalytics: null,
  selectedTimeRange: '30d',
  selectedVessel: null,
  isLoading: false,
  analyticsLoading: false,
  error: null,
  analyticsError: null,
  lastRefresh: null,
  lastAnalyticsRefresh: null,
  autoRefresh: true,
  refreshInterval: 300000, // 5 minutes
  isWebSocketConnected: false,
  retryCount: 0,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setDashboardData: (state, action: PayloadAction<DashboardData>) => {
      state.dashboardData = action.payload;
      state.lastRefresh = new Date().toISOString();
    },
    setWidgets: (state, action: PayloadAction<DashboardWidget[]>) => {
      state.widgets = action.payload;
    },
    addWidget: (state, action: PayloadAction<DashboardWidget>) => {
      state.widgets.push(action.payload);
    },
    updateWidget: (state, action: PayloadAction<DashboardWidget>) => {
      const index = state.widgets.findIndex(w => w.id === action.payload.id);
      if (index !== -1) {
        state.widgets[index] = action.payload;
      }
    },
    removeWidget: (state, action: PayloadAction<string>) => {
      state.widgets = state.widgets.filter(w => w.id !== action.payload);
    },
    setSelectedTimeRange: (state, action: PayloadAction<'7d' | '30d' | '90d' | '1y'>) => {
      state.selectedTimeRange = action.payload;
    },
    setSelectedVessel: (state, action: PayloadAction<string | null>) => {
      state.selectedVessel = action.payload;
    },
    setAutoRefresh: (state, action: PayloadAction<boolean>) => {
      state.autoRefresh = action.payload;
    },
    setRefreshInterval: (state, action: PayloadAction<number>) => {
      state.refreshInterval = action.payload;
    },
    refreshDashboard: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    setAnalyticsLoading: (state, action: PayloadAction<boolean>) => {
      state.analyticsLoading = action.payload;
    },
    setAnalyticsError: (state, action: PayloadAction<string | null>) => {
      state.analyticsError = action.payload;
    },
    setVesselAnalytics: (state, action: PayloadAction<VesselAnalyticsData>) => {
      state.vesselAnalytics = action.payload;
      state.lastAnalyticsRefresh = new Date().toISOString();
    },
    setWebSocketConnected: (state, action: PayloadAction<boolean>) => {
      state.isWebSocketConnected = action.payload;
    },
    incrementRetryCount: (state) => {
      state.retryCount += 1;
    },
    resetRetryCount: (state) => {
      state.retryCount = 0;
    },
    updateVesselAnalyticsRealTime: (state, action: PayloadAction<Partial<VesselAnalyticsData>>) => {
      if (state.vesselAnalytics) {
        state.vesselAnalytics = { ...state.vesselAnalytics, ...action.payload };
      }
    },
  },
});

export const {
  setLoading,
  setError,
  setDashboardData,
  setWidgets,
  addWidget,
  updateWidget,
  removeWidget,
  setSelectedTimeRange,
  setSelectedVessel,
  setAutoRefresh,
  setRefreshInterval,
  refreshDashboard,
  setAnalyticsLoading,
  setAnalyticsError,
  setVesselAnalytics,
  setWebSocketConnected,
  incrementRetryCount,
  resetRetryCount,
  updateVesselAnalyticsRealTime,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;