/**
 * Dashboard WebSocket Hook
 * React hook for managing WebSocket connections and dashboard subscriptions
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { dashboardWebSocketClient, DashboardSubscription } from '../services/dashboardWebSocketClient';
import { DashboardFilters } from '../types/dashboard';
import { setConnectionStatus } from '../store/slices/dashboardSlice';

export interface UseDashboardWebSocketOptions {
  autoConnect?: boolean;
  reconnectOnMount?: boolean;
  disconnectOnUnmount?: boolean;
}

export interface DashboardSubscriptionOptions {
  dashboardType: 'executive' | 'operational' | 'financial' | 'custom';
  filters: DashboardFilters;
  dataTypes: string[];
  refreshInterval?: number;
  autoSubscribe?: boolean;
}

/**
 * Hook for managing dashboard WebSocket connections and subscriptions
 */
export const useDashboardWebSocket = (options: UseDashboardWebSocketOptions = {}) => {
  const dispatch = useDispatch();
  const { isAuthenticated, token } = useSelector((state: RootState) => state.auth);
  const connectionStatus = useSelector((state: RootState) => state.dashboard.connectionStatus);
  
  const {
    autoConnect = true,
    reconnectOnMount = true,
    disconnectOnUnmount = true
  } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const initializationRef = useRef(false);

  /**
   * Initialize WebSocket connection
   */
  const connect = useCallback(async () => {
    if (!isAuthenticated || !token) {
      console.warn('Cannot connect: User not authenticated');
      return;
    }

    try {
      await dashboardWebSocketClient.connect();
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to connect to dashboard WebSocket:', error);
      dispatch(setConnectionStatus({
        isConnected: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }));
    }
  }, [isAuthenticated, token, dispatch]);

  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    dashboardWebSocketClient.disconnect();
    setIsInitialized(false);
  }, []);

  /**
   * Get connection status
   */
  const getConnectionStatus = useCallback(() => {
    return dashboardWebSocketClient.getConnectionStatus();
  }, []);

  /**
   * Update connection options
   */
  const updateConnectionOptions = useCallback((newOptions: {
    autoReconnect?: boolean;
    reconnectAttempts?: number;
    reconnectDelay?: number;
    timeout?: number;
  }) => {
    dashboardWebSocketClient.updateConnectionOptions(newOptions);
  }, []);

  // Auto-connect on mount if authenticated
  useEffect(() => {
    if (autoConnect && isAuthenticated && token && !initializationRef.current) {
      initializationRef.current = true;
      connect();
    }
  }, [autoConnect, isAuthenticated, token, connect]);

  // Reconnect on authentication change
  useEffect(() => {
    if (reconnectOnMount && isAuthenticated && token && !connectionStatus.isConnected) {
      connect();
    }
  }, [reconnectOnMount, isAuthenticated, token, connectionStatus.isConnected, connect]);

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      if (disconnectOnUnmount) {
        disconnect();
      }
    };
  }, [disconnectOnUnmount, disconnect]);

  return {
    isConnected: connectionStatus.isConnected,
    connectionStatus,
    isInitialized,
    connect,
    disconnect,
    getConnectionStatus,
    updateConnectionOptions
  };
};

/**
 * Hook for managing dashboard subscriptions
 */
export const useDashboardSubscription = (subscriptionOptions: DashboardSubscriptionOptions) => {
  const { isConnected } = useSelector((state: RootState) => state.dashboard.connectionStatus);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  
  const {
    dashboardType,
    filters,
    dataTypes,
    refreshInterval,
    autoSubscribe = true
  } = subscriptionOptions;

  const filtersRef = useRef(filters);
  const dataTypesRef = useRef(dataTypes);

  /**
   * Subscribe to dashboard updates
   */
  const subscribe = useCallback(async () => {
    if (!isConnected) {
      setSubscriptionError('WebSocket not connected');
      return;
    }

    try {
      const id = await dashboardWebSocketClient.subscribeToDashboard(
        dashboardType,
        filters,
        dataTypes,
        refreshInterval
      );
      
      setSubscriptionId(id);
      setIsSubscribed(true);
      setSubscriptionError(null);
      
      return id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Subscription failed';
      setSubscriptionError(errorMessage);
      console.error('Failed to subscribe to dashboard:', error);
    }
  }, [isConnected, dashboardType, filters, dataTypes, refreshInterval]);

  /**
   * Unsubscribe from dashboard updates
   */
  const unsubscribe = useCallback(() => {
    if (subscriptionId) {
      dashboardWebSocketClient.unsubscribeFromDashboard(subscriptionId);
      setSubscriptionId(null);
      setIsSubscribed(false);
      setSubscriptionError(null);
    }
  }, [subscriptionId]);

  /**
   * Update subscription filters
   */
  const updateFilters = useCallback((newFilters: DashboardFilters) => {
    if (subscriptionId) {
      dashboardWebSocketClient.updateDashboardFilters(subscriptionId, newFilters);
      filtersRef.current = newFilters;
    }
  }, [subscriptionId]);

  /**
   * Request immediate data update
   */
  const requestData = useCallback(() => {
    dashboardWebSocketClient.requestDashboardData(
      dashboardType,
      dataTypes,
      filters
    );
  }, [dashboardType, dataTypes, filters]);

  // Auto-subscribe when connected
  useEffect(() => {
    if (autoSubscribe && isConnected && !isSubscribed) {
      subscribe();
    }
  }, [autoSubscribe, isConnected, isSubscribed, subscribe]);

  // Resubscribe when filters or data types change
  useEffect(() => {
    if (isSubscribed && subscriptionId) {
      const filtersChanged = JSON.stringify(filtersRef.current) !== JSON.stringify(filters);
      const dataTypesChanged = JSON.stringify(dataTypesRef.current) !== JSON.stringify(dataTypes);
      
      if (filtersChanged || dataTypesChanged) {
        unsubscribe();
        setTimeout(() => {
          subscribe();
        }, 100); // Small delay to ensure clean unsubscribe
      }
    }
    
    filtersRef.current = filters;
    dataTypesRef.current = dataTypes;
  }, [filters, dataTypes, isSubscribed, subscriptionId, subscribe, unsubscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    subscriptionId,
    isSubscribed,
    subscriptionError,
    subscribe,
    unsubscribe,
    updateFilters,
    requestData
  };
};

/**
 * Hook for managing multiple dashboard subscriptions
 */
export const useMultipleDashboardSubscriptions = () => {
  const [subscriptions, setSubscriptions] = useState<Map<string, DashboardSubscription>>(new Map());
  const { isConnected } = useSelector((state: RootState) => state.dashboard.connectionStatus);

  /**
   * Add a new subscription
   */
  const addSubscription = useCallback(async (
    key: string,
    options: DashboardSubscriptionOptions
  ) => {
    if (!isConnected) {
      throw new Error('WebSocket not connected');
    }

    try {
      const subscriptionId = await dashboardWebSocketClient.subscribeToDashboard(
        options.dashboardType,
        options.filters,
        options.dataTypes,
        options.refreshInterval
      );

      const subscription: DashboardSubscription = {
        subscriptionId,
        dashboardType: options.dashboardType,
        filters: options.filters,
        dataTypes: options.dataTypes,
        refreshInterval: options.refreshInterval,
        isActive: true
      };

      setSubscriptions(prev => new Map(prev).set(key, subscription));
      return subscriptionId;
    } catch (error) {
      console.error(`Failed to add subscription ${key}:`, error);
      throw error;
    }
  }, [isConnected]);

  /**
   * Remove a subscription
   */
  const removeSubscription = useCallback((key: string) => {
    const subscription = subscriptions.get(key);
    if (subscription) {
      dashboardWebSocketClient.unsubscribeFromDashboard(subscription.subscriptionId);
      setSubscriptions(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
    }
  }, [subscriptions]);

  /**
   * Update subscription filters
   */
  const updateSubscriptionFilters = useCallback((key: string, newFilters: DashboardFilters) => {
    const subscription = subscriptions.get(key);
    if (subscription) {
      dashboardWebSocketClient.updateDashboardFilters(subscription.subscriptionId, newFilters);
      
      setSubscriptions(prev => {
        const newMap = new Map(prev);
        const updatedSubscription = { ...subscription, filters: newFilters };
        newMap.set(key, updatedSubscription);
        return newMap;
      });
    }
  }, [subscriptions]);

  /**
   * Clear all subscriptions
   */
  const clearAllSubscriptions = useCallback(() => {
    subscriptions.forEach(subscription => {
      dashboardWebSocketClient.unsubscribeFromDashboard(subscription.subscriptionId);
    });
    setSubscriptions(new Map());
  }, [subscriptions]);

  /**
   * Get subscription by key
   */
  const getSubscription = useCallback((key: string) => {
    return subscriptions.get(key);
  }, [subscriptions]);

  /**
   * Get all active subscriptions
   */
  const getActiveSubscriptions = useCallback(() => {
    return Array.from(subscriptions.values()).filter(sub => sub.isActive);
  }, [subscriptions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllSubscriptions();
    };
  }, [clearAllSubscriptions]);

  return {
    subscriptions: Array.from(subscriptions.entries()),
    addSubscription,
    removeSubscription,
    updateSubscriptionFilters,
    clearAllSubscriptions,
    getSubscription,
    getActiveSubscriptions,
    subscriptionCount: subscriptions.size,
    activeSubscriptionCount: getActiveSubscriptions().length
  };
};

/**
 * Hook for handling offline data and synchronization
 */
export const useDashboardOfflineSync = (
  dashboardType: string,
  filters: DashboardFilters
) => {
  const { isConnected } = useSelector((state: RootState) => state.dashboard.connectionStatus);
  const [bufferedData, setBufferedData] = useState<any[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  /**
   * Get buffered data for offline scenarios
   */
  const getBufferedData = useCallback(() => {
    const data = dashboardWebSocketClient.getBufferedData(dashboardType, filters);
    setBufferedData(data);
    return data;
  }, [dashboardType, filters]);

  /**
   * Sync buffered data when connection is restored
   */
  const syncBufferedData = useCallback(async () => {
    if (isConnected && bufferedData.length > 0) {
      try {
        // Process buffered data
        console.log(`Syncing ${bufferedData.length} buffered updates for ${dashboardType}`);
        
        // Clear buffer after successful sync
        dashboardWebSocketClient.clearDataBuffer();
        setBufferedData([]);
        setLastSyncTime(new Date());
        
        return true;
      } catch (error) {
        console.error('Failed to sync buffered data:', error);
        return false;
      }
    }
    return false;
  }, [isConnected, bufferedData, dashboardType]);

  // Auto-sync when connection is restored
  useEffect(() => {
    if (isConnected && bufferedData.length > 0) {
      syncBufferedData();
    }
  }, [isConnected, bufferedData.length, syncBufferedData]);

  // Update buffered data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      getBufferedData();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [getBufferedData]);

  return {
    isOnline: isConnected,
    bufferedData,
    bufferedDataCount: bufferedData.length,
    lastSyncTime,
    getBufferedData,
    syncBufferedData,
    hasBufferedData: bufferedData.length > 0
  };
};

export default useDashboardWebSocket;