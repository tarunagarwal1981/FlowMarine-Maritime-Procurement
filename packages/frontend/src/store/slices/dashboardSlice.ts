/**
 * Dashboard State Management
 * Handles dashboard configurations, widgets, and customization
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  DashboardConfiguration,
  DashboardLayout,
  DashboardWidget,
  DashboardTemplate,
  FilterPreset,
  DashboardState,
  DashboardFilters,
  GridLayout,
  UserRole,
  DEFAULT_DASHBOARD_TEMPLATES,
  DrillDownState,
  DrillDownLevel,
  FilterState,
  BreadcrumbItem
} from '../../types/dashboard';

// WebSocket-related interfaces
interface ConnectionStatus {
  isConnected: boolean;
  lastConnected?: Date;
  error?: string;
  reconnectAttempts?: number;
}

interface DashboardNotification {
  id: string;
  type: 'data_update' | 'alert' | 'threshold_breach' | 'anomaly_detected';
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dashboardType?: string;
  timestamp: Date;
  isRead: boolean;
}

interface DashboardDataUpdate {
  dashboardType: string;
  data: Record<string, any>;
  timestamp: Date;
  filters: DashboardFilters;
  isInitial?: boolean;
}

const initialState: DashboardState = {
  configurations: [],
  currentConfiguration: null,
  templates: [],
  filterPresets: [],
  isLoading: false,
  error: null,
  draggedWidget: null,
  selectedWidget: null,
  isCustomizing: false,
  unsavedChanges: false,
  drillDownState: {
    currentPath: [{ level: 'fleet' }],
    history: [],
    canGoBack: false,
    canGoForward: false,
    breadcrumbs: [{ id: 'fleet', label: 'Fleet', level: 'fleet', path: [{ level: 'fleet' }], isActive: true }],
  },
  filterHistory: [],
  quickAccessPresets: [],
  
  // Real-time WebSocket state
  connectionStatus: {
    isConnected: false,
    reconnectAttempts: 0
  },
  data: {},
  notifications: [],
  unreadNotificationCount: 0,
  lastDataUpdate: null,
  subscriptions: []
};

export const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    // Configuration management
    setConfigurations: (state, action: PayloadAction<DashboardConfiguration[]>) => {
      state.configurations = action.payload;
    },
    
    setCurrentConfiguration: (state, action: PayloadAction<DashboardConfiguration>) => {
      state.currentConfiguration = action.payload;
      state.unsavedChanges = false;
    },
    
    createConfiguration: (state, action: PayloadAction<{
      name: string;
      role: UserRole;
      basedOn?: string;
    }>) => {
      const { name, role, basedOn } = action.payload;
      const template = DEFAULT_DASHBOARD_TEMPLATES[role];
      
      const newConfig: DashboardConfiguration = {
        id: `config-${Date.now()}`,
        userId: '', // Will be set by the API
        role,
        name,
        isDefault: state.configurations.length === 0,
        customLayouts: template.customLayouts!,
        preferences: {
          defaultTimeRange: 'monthly',
          defaultCurrency: 'USD',
          refreshInterval: 300,
          notifications: true,
          theme: 'light',
          compactMode: false,
          showTooltips: true,
          autoRefresh: true,
          soundNotifications: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      state.configurations.push(newConfig);
      state.currentConfiguration = newConfig;
      state.unsavedChanges = true;
    },
    
    updateConfiguration: (state, action: PayloadAction<Partial<DashboardConfiguration>>) => {
      if (state.currentConfiguration) {
        state.currentConfiguration = {
          ...state.currentConfiguration,
          ...action.payload,
          updatedAt: new Date(),
        };
        state.unsavedChanges = true;
      }
    },
    
    deleteConfiguration: (state, action: PayloadAction<string>) => {
      const configId = action.payload;
      state.configurations = state.configurations.filter(config => config.id !== configId);
      
      if (state.currentConfiguration?.id === configId) {
        state.currentConfiguration = state.configurations[0] || null;
      }
    },
    
    // Layout management
    updateLayout: (state, action: PayloadAction<{
      layoutType: 'executive' | 'operational' | 'financial';
      layout: GridLayout[];
    }>) => {
      if (state.currentConfiguration) {
        const { layoutType, layout } = action.payload;
        state.currentConfiguration.customLayouts[layoutType].layout = layout;
        state.currentConfiguration.updatedAt = new Date();
        state.unsavedChanges = true;
      }
    },
    
    // Widget management
    addWidget: (state, action: PayloadAction<{
      layoutType: 'executive' | 'operational' | 'financial';
      widget: DashboardWidget;
      gridItem: GridLayout;
    }>) => {
      if (state.currentConfiguration) {
        const { layoutType, widget, gridItem } = action.payload;
        const layout = state.currentConfiguration.customLayouts[layoutType];
        
        layout.widgets.push(widget);
        layout.layout.push(gridItem);
        state.currentConfiguration.updatedAt = new Date();
        state.unsavedChanges = true;
      }
    },
    
    updateWidget: (state, action: PayloadAction<{
      layoutType: 'executive' | 'operational' | 'financial';
      widgetId: string;
      updates: Partial<DashboardWidget>;
    }>) => {
      if (state.currentConfiguration) {
        const { layoutType, widgetId, updates } = action.payload;
        const layout = state.currentConfiguration.customLayouts[layoutType];
        
        const widgetIndex = layout.widgets.findIndex(w => w.id === widgetId);
        if (widgetIndex !== -1) {
          layout.widgets[widgetIndex] = {
            ...layout.widgets[widgetIndex],
            ...updates,
          };
          state.currentConfiguration.updatedAt = new Date();
          state.unsavedChanges = true;
        }
      }
    },
    
    removeWidget: (state, action: PayloadAction<{
      layoutType: 'executive' | 'operational' | 'financial';
      widgetId: string;
    }>) => {
      if (state.currentConfiguration) {
        const { layoutType, widgetId } = action.payload;
        const layout = state.currentConfiguration.customLayouts[layoutType];
        
        layout.widgets = layout.widgets.filter(w => w.id !== widgetId);
        layout.layout = layout.layout.filter(l => l.i !== widgetId);
        state.currentConfiguration.updatedAt = new Date();
        state.unsavedChanges = true;
      }
    },
    
    toggleWidgetVisibility: (state, action: PayloadAction<{
      layoutType: 'executive' | 'operational' | 'financial';
      widgetId: string;
    }>) => {
      if (state.currentConfiguration) {
        const { layoutType, widgetId } = action.payload;
        const layout = state.currentConfiguration.customLayouts[layoutType];
        
        const widget = layout.widgets.find(w => w.id === widgetId);
        if (widget) {
          widget.isVisible = !widget.isVisible;
          state.currentConfiguration.updatedAt = new Date();
          state.unsavedChanges = true;
        }
      }
    },
    
    // Drag and drop
    setDraggedWidget: (state, action: PayloadAction<DashboardWidget | null>) => {
      state.draggedWidget = action.payload;
    },
    
    setSelectedWidget: (state, action: PayloadAction<DashboardWidget | null>) => {
      state.selectedWidget = action.payload;
    },
    
    // Customization mode
    setCustomizationMode: (state, action: PayloadAction<boolean>) => {
      state.isCustomizing = action.payload;
      if (!action.payload) {
        state.selectedWidget = null;
        state.draggedWidget = null;
      }
    },
    
    // Templates
    setTemplates: (state, action: PayloadAction<DashboardTemplate[]>) => {
      state.templates = action.payload;
    },
    
    applyTemplate: (state, action: PayloadAction<{
      templateId: string;
      layoutType: 'executive' | 'operational' | 'financial';
    }>) => {
      if (state.currentConfiguration) {
        const { templateId, layoutType } = action.payload;
        const template = state.templates.find(t => t.id === templateId);
        
        if (template) {
          state.currentConfiguration.customLayouts[layoutType] = {
            ...template.layout,
            id: `${layoutType}-${Date.now()}`,
          };
          state.currentConfiguration.updatedAt = new Date();
          state.unsavedChanges = true;
        }
      }
    },
    
    // Filter presets
    setFilterPresets: (state, action: PayloadAction<FilterPreset[]>) => {
      state.filterPresets = action.payload;
    },
    
    addFilterPreset: (state, action: PayloadAction<FilterPreset>) => {
      state.filterPresets.push(action.payload);
    },
    
    updateFilterPreset: (state, action: PayloadAction<{
      presetId: string;
      updates: Partial<FilterPreset>;
    }>) => {
      const { presetId, updates } = action.payload;
      const presetIndex = state.filterPresets.findIndex(p => p.id === presetId);
      
      if (presetIndex !== -1) {
        state.filterPresets[presetIndex] = {
          ...state.filterPresets[presetIndex],
          ...updates,
        };
      }
    },
    
    deleteFilterPreset: (state, action: PayloadAction<string>) => {
      const presetId = action.payload;
      state.filterPresets = state.filterPresets.filter(p => p.id !== presetId);
    },
    
    applyFilterPreset: (state, action: PayloadAction<{
      presetId: string;
      layoutType: 'executive' | 'operational' | 'financial';
    }>) => {
      if (state.currentConfiguration) {
        const { presetId, layoutType } = action.payload;
        const preset = state.filterPresets.find(p => p.id === presetId);
        
        if (preset) {
          state.currentConfiguration.customLayouts[layoutType].filters = preset.filters;
          state.currentConfiguration.updatedAt = new Date();
          state.unsavedChanges = true;
          
          // Increment usage count
          preset.usageCount += 1;
        }
      }
    },
    
    // Preferences
    updatePreferences: (state, action: PayloadAction<Partial<DashboardConfiguration['preferences']>>) => {
      if (state.currentConfiguration) {
        state.currentConfiguration.preferences = {
          ...state.currentConfiguration.preferences,
          ...action.payload,
        };
        state.currentConfiguration.updatedAt = new Date();
        state.unsavedChanges = true;
      }
    },
    
    // Filters
    updateFilters: (state, action: PayloadAction<{
      layoutType: 'executive' | 'operational' | 'financial';
      filters: Partial<DashboardFilters>;
    }>) => {
      if (state.currentConfiguration) {
        const { layoutType, filters } = action.payload;
        state.currentConfiguration.customLayouts[layoutType].filters = {
          ...state.currentConfiguration.customLayouts[layoutType].filters,
          ...filters,
        };
        state.currentConfiguration.updatedAt = new Date();
        state.unsavedChanges = true;
      }
    },
    
    // Loading and error states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    // Save changes
    markSaved: (state) => {
      state.unsavedChanges = false;
    },
    
    // Reset to defaults
    resetToDefaults: (state, action: PayloadAction<UserRole>) => {
      const role = action.payload;
      const template = DEFAULT_DASHBOARD_TEMPLATES[role];
      
      if (state.currentConfiguration && template) {
        state.currentConfiguration.customLayouts = template.customLayouts!;
        state.currentConfiguration.updatedAt = new Date();
        state.unsavedChanges = true;
      }
    },

    // Drill-down navigation
    navigateToDrillDown: (state, action: PayloadAction<DrillDownLevel[]>) => {
      const newPath = action.payload;
      
      // Add current path to history if it's different
      if (JSON.stringify(state.drillDownState.currentPath) !== JSON.stringify(newPath)) {
        state.drillDownState.history.push([...state.drillDownState.currentPath]);
      }
      
      state.drillDownState.currentPath = newPath;
      state.drillDownState.canGoBack = state.drillDownState.history.length > 0;
      state.drillDownState.canGoForward = false;
      
      // Update breadcrumbs
      state.drillDownState.breadcrumbs = newPath.map((level, index) => ({
        id: level.id || level.level,
        label: level.name || level.level,
        level: level.level,
        path: newPath.slice(0, index + 1),
        isActive: index === newPath.length - 1,
      }));
    },

    drillDownBack: (state) => {
      if (state.drillDownState.history.length > 0) {
        const previousPath = state.drillDownState.history.pop()!;
        state.drillDownState.currentPath = previousPath;
        state.drillDownState.canGoBack = state.drillDownState.history.length > 0;
        state.drillDownState.canGoForward = true;
        
        // Update breadcrumbs
        state.drillDownState.breadcrumbs = previousPath.map((level, index) => ({
          id: level.id || level.level,
          label: level.name || level.level,
          level: level.level,
          path: previousPath.slice(0, index + 1),
          isActive: index === previousPath.length - 1,
        }));
      }
    },

    drillDownToLevel: (state, action: PayloadAction<number>) => {
      const levelIndex = action.payload;
      if (levelIndex >= 0 && levelIndex < state.drillDownState.currentPath.length) {
        const newPath = state.drillDownState.currentPath.slice(0, levelIndex + 1);
        
        // Add current path to history
        state.drillDownState.history.push([...state.drillDownState.currentPath]);
        
        state.drillDownState.currentPath = newPath;
        state.drillDownState.canGoBack = true;
        state.drillDownState.canGoForward = false;
        
        // Update breadcrumbs
        state.drillDownState.breadcrumbs = newPath.map((level, index) => ({
          id: level.id || level.level,
          label: level.name || level.level,
          level: level.level,
          path: newPath.slice(0, index + 1),
          isActive: index === newPath.length - 1,
        }));
      }
    },

    resetDrillDown: (state) => {
      state.drillDownState = {
        currentPath: [{ level: 'fleet' }],
        history: [],
        canGoBack: false,
        canGoForward: false,
        breadcrumbs: [{ id: 'fleet', label: 'Fleet', level: 'fleet', path: [{ level: 'fleet' }], isActive: true }],
      };
    },

    // Advanced filter management
    saveFilterState: (state, action: PayloadAction<{
      name: string;
      layoutType: 'executive' | 'operational' | 'financial';
      isTemporary?: boolean;
    }>) => {
      if (state.currentConfiguration) {
        const { name, layoutType, isTemporary = false } = action.payload;
        const currentFilters = state.currentConfiguration.customLayouts[layoutType].filters;
        
        const filterState: FilterState = {
          id: `filter-${Date.now()}`,
          name,
          filters: { ...currentFilters },
          timestamp: new Date(),
          isTemporary,
        };
        
        state.filterHistory.push(filterState);
        
        // Keep only last 50 filter states
        if (state.filterHistory.length > 50) {
          state.filterHistory = state.filterHistory.slice(-50);
        }
      }
    },

    restoreFilterState: (state, action: PayloadAction<{
      filterStateId: string;
      layoutType: 'executive' | 'operational' | 'financial';
    }>) => {
      if (state.currentConfiguration) {
        const { filterStateId, layoutType } = action.payload;
        const filterState = state.filterHistory.find(fs => fs.id === filterStateId);
        
        if (filterState) {
          state.currentConfiguration.customLayouts[layoutType].filters = { ...filterState.filters };
          state.currentConfiguration.updatedAt = new Date();
          state.unsavedChanges = true;
        }
      }
    },

    clearFilterHistory: (state) => {
      state.filterHistory = [];
    },

    // Quick access presets
    addToQuickAccess: (state, action: PayloadAction<string>) => {
      const presetId = action.payload;
      const preset = state.filterPresets.find(p => p.id === presetId);
      
      if (preset && !state.quickAccessPresets.find(p => p.id === presetId)) {
        state.quickAccessPresets.push({ ...preset, quickAccess: true });
      }
    },

    removeFromQuickAccess: (state, action: PayloadAction<string>) => {
      const presetId = action.payload;
      state.quickAccessPresets = state.quickAccessPresets.filter(p => p.id !== presetId);
    },

    reorderQuickAccess: (state, action: PayloadAction<string[]>) => {
      const newOrder = action.payload;
      const reorderedPresets = newOrder
        .map(id => state.quickAccessPresets.find(p => p.id === id))
        .filter(Boolean) as FilterPreset[];
      
      state.quickAccessPresets = reorderedPresets;
    },

    // Advanced filter combinations
    updateFilterCombination: (state, action: PayloadAction<{
      layoutType: 'executive' | 'operational' | 'financial';
      filters: DashboardFilters;
      logic: 'AND' | 'OR';
    }>) => {
      if (state.currentConfiguration) {
        const { layoutType, filters, logic } = action.payload;
        
        state.currentConfiguration.customLayouts[layoutType].filters = {
          ...state.currentConfiguration.customLayouts[layoutType].filters,
          ...filters,
          combinationLogic: logic,
        };
        
        state.currentConfiguration.updatedAt = new Date();
        state.unsavedChanges = true;
      }
    },

    // Filter sharing
    shareFilterPreset: (state, action: PayloadAction<{
      presetId: string;
      shareUrl: string;
    }>) => {
      const { presetId, shareUrl } = action.payload;
      const preset = state.filterPresets.find(p => p.id === presetId);
      
      if (preset) {
        preset.shareUrl = shareUrl;
        preset.updatedAt = new Date();
      }
    },

    // WebSocket connection management
    setConnectionStatus: (state, action: PayloadAction<Partial<ConnectionStatus>>) => {
      state.connectionStatus = {
        ...state.connectionStatus,
        ...action.payload
      };
    },

    // Real-time data updates
    updateDashboardData: (state, action: PayloadAction<DashboardDataUpdate>) => {
      const { dashboardType, data, timestamp, filters, isInitial } = action.payload;
      
      // Update data for the specific dashboard type
      state.data[dashboardType] = {
        ...data,
        timestamp,
        filters,
        isInitial
      };
      
      state.lastDataUpdate = new Date(timestamp);
    },

    // Notification management
    addNotification: (state, action: PayloadAction<Omit<DashboardNotification, 'id' | 'isRead'>>) => {
      const notification: DashboardNotification = {
        ...action.payload,
        id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        isRead: false
      };
      
      state.notifications.unshift(notification);
      state.unreadNotificationCount += 1;
      
      // Keep only last 100 notifications
      if (state.notifications.length > 100) {
        state.notifications = state.notifications.slice(0, 100);
      }
    },

    markNotificationAsRead: (state, action: PayloadAction<string>) => {
      const notificationId = action.payload;
      const notification = state.notifications.find(n => n.id === notificationId);
      
      if (notification && !notification.isRead) {
        notification.isRead = true;
        state.unreadNotificationCount = Math.max(0, state.unreadNotificationCount - 1);
      }
    },

    markAllNotificationsAsRead: (state) => {
      state.notifications.forEach(notification => {
        notification.isRead = true;
      });
      state.unreadNotificationCount = 0;
    },

    removeNotification: (state, action: PayloadAction<string>) => {
      const notificationId = action.payload;
      const notificationIndex = state.notifications.findIndex(n => n.id === notificationId);
      
      if (notificationIndex !== -1) {
        const notification = state.notifications[notificationIndex];
        if (!notification.isRead) {
          state.unreadNotificationCount = Math.max(0, state.unreadNotificationCount - 1);
        }
        state.notifications.splice(notificationIndex, 1);
      }
    },

    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadNotificationCount = 0;
    },

    // Subscription management
    addSubscription: (state, action: PayloadAction<string>) => {
      const subscriptionId = action.payload;
      if (!state.subscriptions.includes(subscriptionId)) {
        state.subscriptions.push(subscriptionId);
      }
    },

    removeSubscription: (state, action: PayloadAction<string>) => {
      const subscriptionId = action.payload;
      state.subscriptions = state.subscriptions.filter(id => id !== subscriptionId);
    },

    clearSubscriptions: (state) => {
      state.subscriptions = [];
    },

    // Data synchronization
    syncOfflineData: (state, action: PayloadAction<{
      dashboardType: string;
      bufferedUpdates: any[];
    }>) => {
      const { dashboardType, bufferedUpdates } = action.payload;
      
      // Process buffered updates
      bufferedUpdates.forEach(update => {
        if (update.timestamp > (state.data[dashboardType]?.timestamp || 0)) {
          state.data[dashboardType] = {
            ...state.data[dashboardType],
            ...update.data,
            timestamp: update.timestamp
          };
        }
      });
      
      state.lastDataUpdate = new Date();
    },
  },
});

export const {
  setConfigurations,
  setCurrentConfiguration,
  createConfiguration,
  updateConfiguration,
  deleteConfiguration,
  updateLayout,
  addWidget,
  updateWidget,
  removeWidget,
  toggleWidgetVisibility,
  setDraggedWidget,
  setSelectedWidget,
  setCustomizationMode,
  setTemplates,
  applyTemplate,
  setFilterPresets,
  addFilterPreset,
  updateFilterPreset,
  deleteFilterPreset,
  applyFilterPreset,
  updatePreferences,
  updateFilters,
  setLoading,
  setError,
  clearError,
  markSaved,
  resetToDefaults,
  navigateToDrillDown,
  drillDownBack,
  drillDownToLevel,
  resetDrillDown,
  saveFilterState,
  restoreFilterState,
  clearFilterHistory,
  addToQuickAccess,
  removeFromQuickAccess,
  reorderQuickAccess,
  updateFilterCombination,
  shareFilterPreset,
  // WebSocket actions
  setConnectionStatus,
  updateDashboardData,
  addNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  removeNotification,
  clearNotifications,
  addSubscription,
  removeSubscription,
  clearSubscriptions,
  syncOfflineData,
} = dashboardSlice.actions;

// Selectors
export const selectDashboard = (state: { dashboard: DashboardState }) => state.dashboard;
export const selectConfigurations = (state: { dashboard: DashboardState }) => state.dashboard.configurations;
export const selectCurrentConfiguration = (state: { dashboard: DashboardState }) => state.dashboard.currentConfiguration;
export const selectTemplates = (state: { dashboard: DashboardState }) => state.dashboard.templates;
export const selectFilterPresets = (state: { dashboard: DashboardState }) => state.dashboard.filterPresets;
export const selectIsCustomizing = (state: { dashboard: DashboardState }) => state.dashboard.isCustomizing;
export const selectSelectedWidget = (state: { dashboard: DashboardState }) => state.dashboard.selectedWidget;
export const selectUnsavedChanges = (state: { dashboard: DashboardState }) => state.dashboard.unsavedChanges;
export const selectDashboardLoading = (state: { dashboard: DashboardState }) => state.dashboard.isLoading;
export const selectDashboardError = (state: { dashboard: DashboardState }) => state.dashboard.error;

// Complex selectors
export const selectCurrentLayout = (layoutType: 'executive' | 'operational' | 'financial') => 
  (state: { dashboard: DashboardState }) => {
    return state.dashboard.currentConfiguration?.customLayouts[layoutType] || null;
  };

export const selectWidgetsByLayout = (layoutType: 'executive' | 'operational' | 'financial') =>
  (state: { dashboard: DashboardState }) => {
    return state.dashboard.currentConfiguration?.customLayouts[layoutType]?.widgets || [];
  };

export const selectVisibleWidgets = (layoutType: 'executive' | 'operational' | 'financial') =>
  (state: { dashboard: DashboardState }) => {
    const widgets = state.dashboard.currentConfiguration?.customLayouts[layoutType]?.widgets || [];
    return widgets.filter(widget => widget.isVisible);
  };

export const selectLayoutGrid = (layoutType: 'executive' | 'operational' | 'financial') =>
  (state: { dashboard: DashboardState }) => {
    return state.dashboard.currentConfiguration?.customLayouts[layoutType]?.layout || [];
  };

export const selectConfigurationByRole = (role: UserRole) =>
  (state: { dashboard: DashboardState }) => {
    return state.dashboard.configurations.filter(config => config.role === role);
  };

export const selectPublicTemplates = (state: { dashboard: DashboardState }) => {
  return state.dashboard.templates.filter(template => template.isPublic);
};

export const selectPublicFilterPresets = (state: { dashboard: DashboardState }) => {
  return state.dashboard.filterPresets.filter(preset => preset.isPublic);
};

// New selectors for drill-down and advanced filtering
export const selectDrillDownState = (state: { dashboard: DashboardState }) => state.dashboard.drillDownState;
export const selectCurrentDrillDownPath = (state: { dashboard: DashboardState }) => state.dashboard.drillDownState.currentPath;
export const selectDrillDownBreadcrumbs = (state: { dashboard: DashboardState }) => state.dashboard.drillDownState.breadcrumbs;
export const selectCanGoBack = (state: { dashboard: DashboardState }) => state.dashboard.drillDownState.canGoBack;
export const selectCanGoForward = (state: { dashboard: DashboardState }) => state.dashboard.drillDownState.canGoForward;

export const selectFilterHistory = (state: { dashboard: DashboardState }) => state.dashboard.filterHistory;
export const selectQuickAccessPresets = (state: { dashboard: DashboardState }) => state.dashboard.quickAccessPresets;

export const selectRecentFilterStates = (limit: number = 10) => 
  (state: { dashboard: DashboardState }) => {
    return state.dashboard.filterHistory
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  };

export const selectFilterPresetsByCategory = (category: 'personal' | 'team' | 'global') =>
  (state: { dashboard: DashboardState }) => {
    return state.dashboard.filterPresets.filter(preset => preset.category === category);
  };

// WebSocket selectors
export const selectConnectionStatus = (state: { dashboard: DashboardState }) => state.dashboard.connectionStatus;
export const selectIsConnected = (state: { dashboard: DashboardState }) => state.dashboard.connectionStatus.isConnected;
export const selectDashboardData = (state: { dashboard: DashboardState }) => state.dashboard.data;
export const selectDashboardDataByType = (dashboardType: string) => 
  (state: { dashboard: DashboardState }) => state.dashboard.data[dashboardType];
export const selectNotifications = (state: { dashboard: DashboardState }) => state.dashboard.notifications;
export const selectUnreadNotifications = (state: { dashboard: DashboardState }) => 
  state.dashboard.notifications.filter(n => !n.isRead);
export const selectUnreadNotificationCount = (state: { dashboard: DashboardState }) => state.dashboard.unreadNotificationCount;
export const selectNotificationsByPriority = (priority: 'low' | 'medium' | 'high' | 'critical') =>
  (state: { dashboard: DashboardState }) => state.dashboard.notifications.filter(n => n.priority === priority);
export const selectSubscriptions = (state: { dashboard: DashboardState }) => state.dashboard.subscriptions;
export const selectLastDataUpdate = (state: { dashboard: DashboardState }) => state.dashboard.lastDataUpdate;

export default dashboardSlice.reducer;