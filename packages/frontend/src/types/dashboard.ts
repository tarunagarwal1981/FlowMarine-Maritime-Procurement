/**
 * Dashboard Customization Types
 * Types for dashboard configuration, widgets, and layouts
 */

export interface DashboardConfiguration {
  id: string;
  userId: string;
  role: UserRole;
  name: string;
  isDefault: boolean;
  customLayouts: {
    executive: DashboardLayout;
    operational: DashboardLayout;
    financial: DashboardLayout;
  };
  preferences: DashboardPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  layout: GridLayout[];
  filters: DashboardFilters;
  refreshInterval: number; // in seconds
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  dataSource: string;
  configuration: WidgetConfiguration;
  permissions: string[];
  size: WidgetSize;
  position: WidgetPosition;
  isVisible: boolean;
  refreshInterval?: number;
}

export interface GridLayout {
  i: string; // widget id
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
}

export interface DashboardPreferences {
  defaultTimeRange: string;
  defaultCurrency: string;
  refreshInterval: number;
  notifications: boolean;
  theme: 'light' | 'dark' | 'auto';
  compactMode: boolean;
  showTooltips: boolean;
  autoRefresh: boolean;
  soundNotifications: boolean;
}

export interface WidgetConfiguration {
  chartType?: 'line' | 'bar' | 'doughnut' | 'pie' | 'area' | 'gauge' | 'table';
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  animations?: boolean;
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  dataLimit?: number;
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  displayFormat?: 'currency' | 'percentage' | 'number' | 'date';
  precision?: number;
  showTrends?: boolean;
  showComparison?: boolean;
  comparisonPeriod?: string;
  thresholds?: WidgetThreshold[];
}

export interface WidgetThreshold {
  id: string;
  name: string;
  value: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  color: string;
  action?: 'alert' | 'highlight' | 'hide';
}

export interface WidgetSize {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface WidgetPosition {
  x: number;
  y: number;
  z?: number;
}

export type WidgetType = 
  | 'fleet_spend_visualization'
  | 'budget_utilization'
  | 'vendor_performance'
  | 'cost_savings_roi'
  | 'cycle_time_analysis'
  | 'vessel_analytics'
  | 'port_efficiency'
  | 'inventory_analytics'
  | 'multi_currency'
  | 'payment_terms'
  | 'cost_analysis'
  | 'kpi_card'
  | 'data_table'
  | 'gauge_chart'
  | 'trend_chart'
  | 'comparison_chart'
  | 'heatmap'
  | 'geographic_map'
  | 'alert_panel'
  | 'notification_feed';

export type UserRole = 
  | 'VESSEL_CREW'
  | 'CHIEF_ENGINEER'
  | 'CAPTAIN'
  | 'SUPERINTENDENT'
  | 'PROCUREMENT_MANAGER'
  | 'FINANCE_TEAM'
  | 'ADMIN';

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  role: UserRole;
  category: 'executive' | 'operational' | 'financial' | 'custom';
  layout: DashboardLayout;
  preview?: string;
  isPublic: boolean;
  createdBy: string;
  tags: string[];
}

export interface DashboardFilters {
  timeRange: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  dateFrom?: Date;
  dateTo?: Date;
  vessels?: string[];
  categories?: string[];
  vendors?: string[];
  currency?: string;
  urgencyLevel?: string[];
  status?: string[];
  ports?: string[];
  routes?: string[];
  amountRange?: {
    min?: number;
    max?: number;
  };
  customFilters?: Record<string, any>;
  combinationLogic?: 'AND' | 'OR';
  savedState?: FilterState;
}

export interface FilterState {
  id: string;
  name: string;
  filters: DashboardFilters;
  timestamp: Date;
  isTemporary?: boolean;
}

export interface FilterCombination {
  id: string;
  field: keyof DashboardFilters;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'between' | 'greaterThan' | 'lessThan';
  value: any;
  logic?: 'AND' | 'OR';
}

export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filters: DashboardFilters;
  isPublic: boolean;
  createdBy: string;
  usageCount: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  category?: 'personal' | 'team' | 'global';
  shareUrl?: string;
  quickAccess?: boolean;
}

export interface DrillDownState {
  currentPath: DrillDownLevel[];
  history: DrillDownLevel[][];
  canGoBack: boolean;
  canGoForward: boolean;
  breadcrumbs: BreadcrumbItem[];
}

export interface DrillDownLevel {
  level: 'fleet' | 'vessel' | 'category' | 'vendor' | 'transaction' | 'port' | 'route';
  id?: string;
  name?: string;
  value?: number;
  metadata?: Record<string, any>;
  filters?: DashboardFilters;
}

export interface BreadcrumbItem {
  id: string;
  label: string;
  level: DrillDownLevel['level'];
  path: DrillDownLevel[];
  isActive: boolean;
}

export interface DashboardState {
  configurations: DashboardConfiguration[];
  currentConfiguration: DashboardConfiguration | null;
  templates: DashboardTemplate[];
  filterPresets: FilterPreset[];
  isLoading: boolean;
  error: string | null;
  draggedWidget: DashboardWidget | null;
  selectedWidget: DashboardWidget | null;
  isCustomizing: boolean;
  unsavedChanges: boolean;
  drillDownState: DrillDownState;
  filterHistory: FilterState[];
  quickAccessPresets: FilterPreset[];
  
  // Real-time WebSocket state
  connectionStatus: {
    isConnected: boolean;
    lastConnected?: Date;
    error?: string;
    reconnectAttempts?: number;
  };
  data: Record<string, any>;
  notifications: Array<{
    id: string;
    type: 'data_update' | 'alert' | 'threshold_breach' | 'anomaly_detected';
    title: string;
    message: string;
    data?: any;
    priority: 'low' | 'medium' | 'high' | 'critical';
    dashboardType?: string;
    timestamp: Date;
    isRead: boolean;
  }>;
  unreadNotificationCount: number;
  lastDataUpdate: Date | null;
  subscriptions: string[];
}

export interface WidgetDataSource {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  parameters: DataSourceParameter[];
  permissions: string[];
  refreshInterval: number;
  cacheTimeout: number;
}

export interface DataSourceParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  required: boolean;
  defaultValue?: any;
  options?: any[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface DashboardExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'png' | 'json';
  includeCharts: boolean;
  includeData: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
  filters?: DashboardFilters;
  template?: string;
  orientation?: 'portrait' | 'landscape';
  paperSize?: 'a4' | 'letter' | 'legal';
}

export interface DashboardShareOptions {
  type: 'link' | 'email' | 'embed';
  permissions: 'view' | 'edit';
  expiry?: Date;
  password?: string;
  recipients?: string[];
  message?: string;
}

// Role-based widget permissions
export const ROLE_WIDGET_PERMISSIONS: Record<UserRole, WidgetType[]> = {
  VESSEL_CREW: [
    'inventory_analytics',
    'alert_panel',
    'notification_feed',
    'kpi_card',
    'trend_chart'
  ],
  CHIEF_ENGINEER: [
    'inventory_analytics',
    'vessel_analytics',
    'cycle_time_analysis',
    'alert_panel',
    'notification_feed',
    'kpi_card',
    'trend_chart',
    'data_table'
  ],
  CAPTAIN: [
    'fleet_spend_visualization',
    'budget_utilization',
    'vessel_analytics',
    'inventory_analytics',
    'cycle_time_analysis',
    'port_efficiency',
    'alert_panel',
    'notification_feed',
    'kpi_card',
    'trend_chart',
    'data_table',
    'gauge_chart'
  ],
  SUPERINTENDENT: [
    'fleet_spend_visualization',
    'budget_utilization',
    'vendor_performance',
    'vessel_analytics',
    'cycle_time_analysis',
    'port_efficiency',
    'inventory_analytics',
    'cost_savings_roi',
    'alert_panel',
    'notification_feed',
    'kpi_card',
    'trend_chart',
    'data_table',
    'gauge_chart',
    'comparison_chart',
    'heatmap'
  ],
  PROCUREMENT_MANAGER: [
    'fleet_spend_visualization',
    'budget_utilization',
    'vendor_performance',
    'cost_savings_roi',
    'cycle_time_analysis',
    'port_efficiency',
    'inventory_analytics',
    'multi_currency',
    'payment_terms',
    'alert_panel',
    'notification_feed',
    'kpi_card',
    'trend_chart',
    'data_table',
    'gauge_chart',
    'comparison_chart',
    'heatmap',
    'geographic_map'
  ],
  FINANCE_TEAM: [
    'fleet_spend_visualization',
    'budget_utilization',
    'vendor_performance',
    'cost_savings_roi',
    'cost_analysis',
    'multi_currency',
    'payment_terms',
    'alert_panel',
    'notification_feed',
    'kpi_card',
    'trend_chart',
    'data_table',
    'gauge_chart',
    'comparison_chart'
  ],
  ADMIN: [
    'fleet_spend_visualization',
    'budget_utilization',
    'vendor_performance',
    'cost_savings_roi',
    'cycle_time_analysis',
    'vessel_analytics',
    'port_efficiency',
    'inventory_analytics',
    'multi_currency',
    'payment_terms',
    'cost_analysis',
    'alert_panel',
    'notification_feed',
    'kpi_card',
    'trend_chart',
    'data_table',
    'gauge_chart',
    'comparison_chart',
    'heatmap',
    'geographic_map'
  ]
};

// Default dashboard templates for each role
export const DEFAULT_DASHBOARD_TEMPLATES: Record<UserRole, Partial<DashboardConfiguration>> = {
  VESSEL_CREW: {
    name: 'Vessel Operations Dashboard',
    customLayouts: {
      executive: {
        id: 'vessel-crew-exec',
        name: 'Vessel Overview',
        widgets: [],
        layout: [],
        filters: { timeRange: 'weekly' },
        refreshInterval: 300
      },
      operational: {
        id: 'vessel-crew-ops',
        name: 'Daily Operations',
        widgets: [],
        layout: [],
        filters: { timeRange: 'daily' },
        refreshInterval: 60
      },
      financial: {
        id: 'vessel-crew-fin',
        name: 'Budget Status',
        widgets: [],
        layout: [],
        filters: { timeRange: 'monthly' },
        refreshInterval: 600
      }
    }
  },
  CHIEF_ENGINEER: {
    name: 'Engineering Dashboard',
    customLayouts: {
      executive: {
        id: 'chief-eng-exec',
        name: 'Engineering Overview',
        widgets: [],
        layout: [],
        filters: { timeRange: 'weekly' },
        refreshInterval: 300
      },
      operational: {
        id: 'chief-eng-ops',
        name: 'Maintenance & Inventory',
        widgets: [],
        layout: [],
        filters: { timeRange: 'daily' },
        refreshInterval: 120
      },
      financial: {
        id: 'chief-eng-fin',
        name: 'Engineering Costs',
        widgets: [],
        layout: [],
        filters: { timeRange: 'monthly' },
        refreshInterval: 600
      }
    }
  },
  CAPTAIN: {
    name: 'Captain Dashboard',
    customLayouts: {
      executive: {
        id: 'captain-exec',
        name: 'Vessel Performance',
        widgets: [],
        layout: [],
        filters: { timeRange: 'weekly' },
        refreshInterval: 300
      },
      operational: {
        id: 'captain-ops',
        name: 'Operations Control',
        widgets: [],
        layout: [],
        filters: { timeRange: 'daily' },
        refreshInterval: 120
      },
      financial: {
        id: 'captain-fin',
        name: 'Vessel Budget',
        widgets: [],
        layout: [],
        filters: { timeRange: 'monthly' },
        refreshInterval: 600
      }
    }
  },
  SUPERINTENDENT: {
    name: 'Fleet Management Dashboard',
    customLayouts: {
      executive: {
        id: 'super-exec',
        name: 'Fleet Overview',
        widgets: [],
        layout: [],
        filters: { timeRange: 'monthly' },
        refreshInterval: 300
      },
      operational: {
        id: 'super-ops',
        name: 'Fleet Operations',
        widgets: [],
        layout: [],
        filters: { timeRange: 'weekly' },
        refreshInterval: 180
      },
      financial: {
        id: 'super-fin',
        name: 'Fleet Financials',
        widgets: [],
        layout: [],
        filters: { timeRange: 'monthly' },
        refreshInterval: 600
      }
    }
  },
  PROCUREMENT_MANAGER: {
    name: 'Procurement Dashboard',
    customLayouts: {
      executive: {
        id: 'proc-exec',
        name: 'Procurement Overview',
        widgets: [],
        layout: [],
        filters: { timeRange: 'monthly' },
        refreshInterval: 300
      },
      operational: {
        id: 'proc-ops',
        name: 'Procurement Operations',
        widgets: [],
        layout: [],
        filters: { timeRange: 'weekly' },
        refreshInterval: 180
      },
      financial: {
        id: 'proc-fin',
        name: 'Procurement Analytics',
        widgets: [],
        layout: [],
        filters: { timeRange: 'monthly' },
        refreshInterval: 600
      }
    }
  },
  FINANCE_TEAM: {
    name: 'Financial Dashboard',
    customLayouts: {
      executive: {
        id: 'finance-exec',
        name: 'Financial Overview',
        widgets: [],
        layout: [],
        filters: { timeRange: 'monthly' },
        refreshInterval: 300
      },
      operational: {
        id: 'finance-ops',
        name: 'Financial Operations',
        widgets: [],
        layout: [],
        filters: { timeRange: 'weekly' },
        refreshInterval: 300
      },
      financial: {
        id: 'finance-fin',
        name: 'Financial Analytics',
        widgets: [],
        layout: [],
        filters: { timeRange: 'monthly' },
        refreshInterval: 600
      }
    }
  },
  ADMIN: {
    name: 'Administrator Dashboard',
    customLayouts: {
      executive: {
        id: 'admin-exec',
        name: 'System Overview',
        widgets: [],
        layout: [],
        filters: { timeRange: 'monthly' },
        refreshInterval: 300
      },
      operational: {
        id: 'admin-ops',
        name: 'System Operations',
        widgets: [],
        layout: [],
        filters: { timeRange: 'daily' },
        refreshInterval: 120
      },
      financial: {
        id: 'admin-fin',
        name: 'System Analytics',
        widgets: [],
        layout: [],
        filters: { timeRange: 'monthly' },
        refreshInterval: 600
      }
    }
  }
};