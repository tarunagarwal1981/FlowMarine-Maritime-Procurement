/**
 * Dashboard WebSocket Client
 * Handles real-time dashboard updates, subscriptions, and data synchronization
 */

import { io, Socket } from 'socket.io-client';
import { store } from '../store/store';
import { updateDashboardData, addNotification, setConnectionStatus } from '../store/slices/dashboardSlice';
import { DashboardFilters } from '../types/dashboard';

export interface DashboardSubscription {
  subscriptionId: string;
  dashboardType: 'executive' | 'operational' | 'financial' | 'custom';
  filters: DashboardFilters;
  dataTypes: string[];
  refreshInterval?: number;
  isActive: boolean;
}

export interface DashboardDataUpdate {
  dashboardType: string;
  data: Record<string, any>;
  timestamp: Date;
  filters: DashboardFilters;
  isInitial?: boolean;
}

export interface DashboardNotification {
  type: 'data_update' | 'alert' | 'threshold_breach' | 'anomaly_detected';
  title: string;
  message: string;
  data: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dashboardType?: string;
  timestamp: Date;
}

export interface ConnectionOptions {
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  timeout?: number;
}

/**
 * Dashboard WebSocket Client Service
 * Manages real-time connections and data synchronization for dashboards
 */
class DashboardWebSocketClient {
  private socket: Socket | null = null;
  private subscriptions: Map<string, DashboardSubscription> = new Map();
  private connectionOptions: ConnectionOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private dataBuffer: Map<string, any[]> = new Map(); // Buffer for offline data
  private conflictResolver: ConflictResolver;

  constructor(options: ConnectionOptions = {}) {
    this.connectionOptions = {
      autoReconnect: true,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      timeout: 10000,
      ...options
    };
    
    this.maxReconnectAttempts = this.connectionOptions.reconnectAttempts || 5;
    this.reconnectDelay = this.connectionOptions.reconnectDelay || 1000;
    this.conflictResolver = new ConflictResolver();
  }

  /**
   * Initialize WebSocket connection
   */
  async connect(): Promise<void> {
    if (this.socket?.connected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const token = store.getState().auth.token;
      if (!token) {
        throw new Error('Authentication token required');
      }

      const serverUrl = process.env.REACT_APP_WS_URL || 'http://localhost:3001';
      
      this.socket = io(serverUrl, {
        path: '/socket.io/dashboard',
        auth: {
          token
        },
        transports: ['websocket', 'polling'],
        timeout: this.connectionOptions.timeout,
        forceNew: true
      });

      await this.setupEventHandlers();
      await this.waitForConnection();
      
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      // Restore subscriptions after reconnection
      await this.restoreSubscriptions();
      
      // Start heartbeat
      this.startHeartbeat();
      
      store.dispatch(setConnectionStatus({
        isConnected: true,
        lastConnected: new Date(),
        reconnectAttempts: this.reconnectAttempts
      }));

      console.log('Dashboard WebSocket connected successfully');
    } catch (error) {
      this.isConnecting = false;
      console.error('Failed to connect to dashboard WebSocket:', error);
      
      store.dispatch(setConnectionStatus({
        isConnected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        reconnectAttempts: this.reconnectAttempts
      }));

      if (this.connectionOptions.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.scheduleReconnect();
      }
    }
  }

  /**
   * Wait for connection to be established
   */
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.connectionOptions.timeout);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Setup event handlers for WebSocket
   */
  private async setupEventHandlers(): Promise<void> {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Dashboard WebSocket connected');
      store.dispatch(setConnectionStatus({
        isConnected: true,
        lastConnected: new Date(),
        reconnectAttempts: this.reconnectAttempts
      }));
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Dashboard WebSocket disconnected:', reason);
      this.stopHeartbeat();
      
      store.dispatch(setConnectionStatus({
        isConnected: false,
        error: `Disconnected: ${reason}`,
        reconnectAttempts: this.reconnectAttempts
      }));

      if (this.connectionOptions.autoReconnect && reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Dashboard WebSocket connection error:', error);
      store.dispatch(setConnectionStatus({
        isConnected: false,
        error: error.message,
        reconnectAttempts: this.reconnectAttempts
      }));
    });

    // Subscription events
    this.socket.on('subscription_confirmed', (data: {
      subscriptionId: string;
      dashboardType: string;
      dataTypes: string[];
      refreshInterval: number;
    }) => {
      console.log('Dashboard subscription confirmed:', data.subscriptionId);
      const subscription = this.subscriptions.get(data.subscriptionId);
      if (subscription) {
        subscription.isActive = true;
      }
    });

    this.socket.on('subscription_error', (data: {
      error: string;
      subscriptionId?: string;
      details?: string;
    }) => {
      console.error('Dashboard subscription error:', data);
      store.dispatch(addNotification({
        type: 'alert',
        title: 'Subscription Error',
        message: data.error,
        priority: 'high',
        timestamp: new Date()
      }));
    });

    // Data events
    this.socket.on('dashboard_data', (update: DashboardDataUpdate) => {
      this.handleDashboardDataUpdate(update);
    });

    this.socket.on('dashboard_update', (update: DashboardDataUpdate) => {
      this.handleDashboardDataUpdate(update);
    });

    this.socket.on('dashboard_data_changed', (data: {
      changeType: string;
      affectedDataTypes: string[];
      timestamp: Date;
      changeCount: number;
    }) => {
      console.log('Dashboard data changed:', data);
      // Trigger selective updates for affected subscriptions
      this.handleDataChangeNotification(data);
    });

    // Notification events
    this.socket.on('dashboard_notification', (notification: DashboardNotification) => {
      store.dispatch(addNotification(notification));
    });

    this.socket.on('dashboard_critical_notification', (notification: DashboardNotification) => {
      store.dispatch(addNotification({
        ...notification,
        priority: 'critical'
      }));
    });

    // Error events
    this.socket.on('dashboard_error', (data: {
      error: string;
      details?: string;
    }) => {
      console.error('Dashboard error:', data);
      store.dispatch(addNotification({
        type: 'alert',
        title: 'Dashboard Error',
        message: data.error,
        priority: 'high',
        timestamp: new Date(),
        data: data.details
      }));
    });

    this.socket.on('data_request_error', (data: {
      error: string;
      details?: string;
    }) => {
      console.error('Data request error:', data);
      store.dispatch(addNotification({
        type: 'alert',
        title: 'Data Request Failed',
        message: data.error,
        priority: 'medium',
        timestamp: new Date(),
        data: data.details
      }));
    });
  }

  /**
   * Handle dashboard data updates
   */
  private handleDashboardDataUpdate(update: DashboardDataUpdate): void {
    try {
      // Check for conflicts if this is not initial data
      if (!update.isInitial) {
        const conflicts = this.conflictResolver.detectConflicts(update);
        if (conflicts.length > 0) {
          const resolvedUpdate = this.conflictResolver.resolveConflicts(update, conflicts);
          update = resolvedUpdate;
        }
      }

      // Update Redux store
      store.dispatch(updateDashboardData({
        dashboardType: update.dashboardType,
        data: update.data,
        timestamp: update.timestamp,
        filters: update.filters,
        isInitial: update.isInitial
      }));

      // Buffer data for offline scenarios
      this.bufferDataUpdate(update);

      console.log(`Dashboard data updated for ${update.dashboardType}:`, Object.keys(update.data));
    } catch (error) {
      console.error('Error handling dashboard data update:', error);
    }
  }

  /**
   * Handle data change notifications
   */
  private handleDataChangeNotification(data: {
    changeType: string;
    affectedDataTypes: string[];
    timestamp: Date;
    changeCount: number;
  }): void {
    // Find subscriptions that need updates based on affected data types
    const affectedSubscriptions = Array.from(this.subscriptions.values()).filter(sub =>
      sub.dataTypes.some(dataType => data.affectedDataTypes.includes(dataType))
    );

    // Request selective updates for affected subscriptions
    affectedSubscriptions.forEach(subscription => {
      this.requestSelectiveUpdate(subscription, data.affectedDataTypes);
    });
  }

  /**
   * Request selective update for specific data types
   */
  private requestSelectiveUpdate(subscription: DashboardSubscription, dataTypes: string[]): void {
    if (!this.socket?.connected) return;

    this.socket.emit('request_dashboard_data', {
      dashboardType: subscription.dashboardType,
      dataTypes: dataTypes.filter(dt => subscription.dataTypes.includes(dt)),
      filters: subscription.filters
    });
  }

  /**
   * Buffer data updates for offline scenarios
   */
  private bufferDataUpdate(update: DashboardDataUpdate): void {
    const bufferKey = `${update.dashboardType}_${JSON.stringify(update.filters)}`;
    
    if (!this.dataBuffer.has(bufferKey)) {
      this.dataBuffer.set(bufferKey, []);
    }

    const buffer = this.dataBuffer.get(bufferKey)!;
    buffer.push({
      data: update.data,
      timestamp: update.timestamp
    });

    // Keep only last 10 updates in buffer
    if (buffer.length > 10) {
      buffer.shift();
    }
  }

  /**
   * Subscribe to dashboard updates
   */
  async subscribeToDashboard(
    dashboardType: 'executive' | 'operational' | 'financial' | 'custom',
    filters: DashboardFilters,
    dataTypes: string[],
    refreshInterval?: number
  ): Promise<string> {
    if (!this.socket?.connected) {
      await this.connect();
    }

    const subscriptionId = `${dashboardType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: DashboardSubscription = {
      subscriptionId,
      dashboardType,
      filters,
      dataTypes,
      refreshInterval,
      isActive: false
    };

    this.subscriptions.set(subscriptionId, subscription);

    this.socket!.emit('subscribe_dashboard', {
      dashboardType,
      filters,
      dataTypes,
      refreshInterval
    });

    console.log(`Subscribed to dashboard: ${subscriptionId}`);
    return subscriptionId;
  }

  /**
   * Unsubscribe from dashboard updates
   */
  unsubscribeFromDashboard(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    if (this.socket?.connected) {
      this.socket.emit('unsubscribe_dashboard', subscriptionId);
    }

    this.subscriptions.delete(subscriptionId);
    console.log(`Unsubscribed from dashboard: ${subscriptionId}`);
  }

  /**
   * Update dashboard filters
   */
  updateDashboardFilters(subscriptionId: string, newFilters: DashboardFilters): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    subscription.filters = newFilters;

    if (this.socket?.connected) {
      this.socket.emit('update_dashboard_filters', {
        subscriptionId,
        filters: newFilters
      });
    }

    console.log(`Updated filters for subscription: ${subscriptionId}`);
  }

  /**
   * Request immediate dashboard data
   */
  requestDashboardData(
    dashboardType: string,
    dataTypes: string[],
    filters: DashboardFilters
  ): void {
    if (!this.socket?.connected) {
      console.warn('Cannot request data: WebSocket not connected');
      return;
    }

    this.socket.emit('request_dashboard_data', {
      dashboardType,
      dataTypes,
      filters
    });
  }

  /**
   * Schedule reconnection attempt
   */
  private async scheduleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.connectionTimeout = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection attempt failed:', error);
      }
    }, delay);
  }

  /**
   * Restore subscriptions after reconnection
   */
  private async restoreSubscriptions(): Promise<void> {
    if (!this.socket?.connected) return;

    console.log(`Restoring ${this.subscriptions.size} dashboard subscriptions`);

    for (const subscription of this.subscriptions.values()) {
      try {
        this.socket.emit('subscribe_dashboard', {
          dashboardType: subscription.dashboardType,
          filters: subscription.filters,
          dataTypes: subscription.dataTypes,
          refreshInterval: subscription.refreshInterval
        });
        
        subscription.isActive = false; // Will be set to true when confirmed
      } catch (error) {
        console.error('Failed to restore subscription:', subscription.subscriptionId, error);
      }
    }
  }

  /**
   * Start heartbeat to maintain connection
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    this.stopHeartbeat();
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.subscriptions.clear();
    this.dataBuffer.clear();
    this.reconnectAttempts = 0;
    this.isConnecting = false;

    store.dispatch(setConnectionStatus({
      isConnected: false,
      reconnectAttempts: 0
    }));

    console.log('Dashboard WebSocket disconnected');
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    reconnectAttempts: number;
    subscriptionsCount: number;
    activeSubscriptionsCount: number;
  } {
    return {
      isConnected: this.socket?.connected || false,
      reconnectAttempts: this.reconnectAttempts,
      subscriptionsCount: this.subscriptions.size,
      activeSubscriptionsCount: Array.from(this.subscriptions.values()).filter(s => s.isActive).length
    };
  }

  /**
   * Get buffered data for offline scenarios
   */
  getBufferedData(dashboardType: string, filters: DashboardFilters): any[] {
    const bufferKey = `${dashboardType}_${JSON.stringify(filters)}`;
    return this.dataBuffer.get(bufferKey) || [];
  }

  /**
   * Clear data buffer
   */
  clearDataBuffer(): void {
    this.dataBuffer.clear();
  }

  /**
   * Get active subscriptions
   */
  getActiveSubscriptions(): DashboardSubscription[] {
    return Array.from(this.subscriptions.values()).filter(s => s.isActive);
  }

  /**
   * Update connection options
   */
  updateConnectionOptions(options: Partial<ConnectionOptions>): void {
    this.connectionOptions = { ...this.connectionOptions, ...options };
    this.maxReconnectAttempts = this.connectionOptions.reconnectAttempts || 5;
    this.reconnectDelay = this.connectionOptions.reconnectDelay || 1000;
  }
}

/**
 * Conflict Resolution for Data Synchronization
 */
class ConflictResolver {
  /**
   * Detect conflicts in dashboard data updates
   */
  detectConflicts(update: DashboardDataUpdate): Array<{
    dataType: string;
    conflictType: 'timestamp' | 'version' | 'data_integrity';
    details: any;
  }> {
    const conflicts: Array<{
      dataType: string;
      conflictType: 'timestamp' | 'version' | 'data_integrity';
      details: any;
    }> = [];

    // Get current state from Redux store
    const currentState = store.getState().dashboard;
    
    Object.keys(update.data).forEach(dataType => {
      const currentData = currentState.data[dataType];
      const newData = update.data[dataType];

      if (currentData) {
        // Check timestamp conflicts
        if (currentData.timestamp && new Date(currentData.timestamp) > new Date(update.timestamp)) {
          conflicts.push({
            dataType,
            conflictType: 'timestamp',
            details: {
              currentTimestamp: currentData.timestamp,
              newTimestamp: update.timestamp
            }
          });
        }

        // Check data integrity conflicts
        if (this.hasDataIntegrityConflict(currentData, newData)) {
          conflicts.push({
            dataType,
            conflictType: 'data_integrity',
            details: {
              currentData: currentData,
              newData: newData
            }
          });
        }
      }
    });

    return conflicts;
  }

  /**
   * Resolve conflicts using various strategies
   */
  resolveConflicts(
    update: DashboardDataUpdate, 
    conflicts: Array<{
      dataType: string;
      conflictType: 'timestamp' | 'version' | 'data_integrity';
      details: any;
    }>
  ): DashboardDataUpdate {
    const resolvedUpdate = { ...update };

    conflicts.forEach(conflict => {
      switch (conflict.conflictType) {
        case 'timestamp':
          // Use latest timestamp strategy
          if (new Date(conflict.details.currentTimestamp) > new Date(conflict.details.newTimestamp)) {
            // Keep current data, don't update
            delete resolvedUpdate.data[conflict.dataType];
          }
          break;

        case 'data_integrity':
          // Merge strategy for data integrity conflicts
          resolvedUpdate.data[conflict.dataType] = this.mergeData(
            conflict.details.currentData,
            conflict.details.newData
          );
          break;

        default:
          console.warn(`Unknown conflict type: ${conflict.conflictType}`);
      }
    });

    return resolvedUpdate;
  }

  /**
   * Check for data integrity conflicts
   */
  private hasDataIntegrityConflict(currentData: any, newData: any): boolean {
    // Simple integrity check - can be enhanced based on specific requirements
    if (typeof currentData !== typeof newData) {
      return true;
    }

    if (Array.isArray(currentData) && Array.isArray(newData)) {
      // Check if arrays have significantly different lengths
      return Math.abs(currentData.length - newData.length) > currentData.length * 0.5;
    }

    return false;
  }

  /**
   * Merge conflicting data
   */
  private mergeData(currentData: any, newData: any): any {
    if (Array.isArray(currentData) && Array.isArray(newData)) {
      // Merge arrays by combining unique items
      const merged = [...currentData];
      newData.forEach((item: any) => {
        if (!merged.some(existing => JSON.stringify(existing) === JSON.stringify(item))) {
          merged.push(item);
        }
      });
      return merged;
    }

    if (typeof currentData === 'object' && typeof newData === 'object') {
      // Merge objects
      return { ...currentData, ...newData };
    }

    // Default: use new data
    return newData;
  }
}

// Create singleton instance
export const dashboardWebSocketClient = new DashboardWebSocketClient();

export default dashboardWebSocketClient;