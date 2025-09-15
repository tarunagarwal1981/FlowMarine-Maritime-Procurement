import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { dashboardAnalyticsService, DashboardFilters } from './dashboardAnalyticsService.js';
import { cacheService } from './cacheService.js';

const prisma = new PrismaClient();

export interface DashboardSubscription {
  userId: string;
  socketId: string;
  dashboardType: 'executive' | 'operational' | 'financial' | 'custom';
  filters: DashboardFilters;
  dataTypes: string[];
  lastUpdate: Date;
}

export interface DashboardDataUpdate {
  type: 'spend_analytics' | 'budget_utilization' | 'vendor_performance' | 'operational_metrics' | 'financial_insights';
  data: any;
  timestamp: Date;
  filters: DashboardFilters;
}

export interface DashboardNotification {
  type: 'data_update' | 'alert' | 'threshold_breach' | 'anomaly_detected';
  title: string;
  message: string;
  data: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dashboardType?: string;
  userId?: string;
  vesselId?: string;
}

/**
 * Real-Time Dashboard WebSocket Service
 * Handles real-time dashboard updates, subscriptions, and data streaming
 */
class DashboardWebSocketService {
  private io: SocketIOServer | null = null;
  private subscriptions: Map<string, DashboardSubscription[]> = new Map(); // userId -> subscriptions[]
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map(); // subscriptionId -> interval
  private dataChangeListeners: Map<string, Function> = new Map(); // dataType -> listener function

  /**
   * Initialize Dashboard WebSocket server
   */
  initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      path: '/socket.io/dashboard'
    });

    this.io.use(this.authenticateSocket.bind(this));
    this.io.on('connection', this.handleConnection.bind(this));

    // Initialize data change detection
    this.initializeDataChangeDetection();

    logger.info('Dashboard WebSocket service initialized');
  }

  /**
   * Authenticate socket connection
   */
  private async authenticateSocket(socket: any, next: any): Promise<void> {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          vessels: {
            include: {
              vessel: true
            }
          },
          permissions: {
            include: {
              permission: true
            }
          }
        }
      });

      if (!user || !user.isActive) {
        return next(new Error('Invalid user'));
      }

      socket.userId = user.id;
      socket.userRole = user.role;
      socket.vessels = user.vessels.map((va: any) => va.vessel.id);
      socket.permissions = user.permissions.map((up: any) => up.permission.name);
      
      next();
    } catch (error) {
      logger.error('Dashboard socket authentication failed:', error);
      next(new Error('Authentication failed'));
    }
  }

  /**
   * Handle new socket connection
   */
  private handleConnection(socket: any): void {
    const userId = socket.userId;
    
    logger.info(`Dashboard WebSocket connection established for user ${userId} (${socket.id})`);

    // Join user-specific room
    socket.join(`dashboard:user:${userId}`);

    // Join role-based rooms for relevant updates
    socket.join(`dashboard:role:${socket.userRole}`);

    // Join vessel-specific rooms
    socket.vessels.forEach((vesselId: string) => {
      socket.join(`dashboard:vessel:${vesselId}`);
    });

    // Handle dashboard subscription
    socket.on('subscribe_dashboard', async (subscriptionData: {
      dashboardType: string;
      filters: DashboardFilters;
      dataTypes: string[];
      refreshInterval?: number;
    }) => {
      await this.handleDashboardSubscription(socket, subscriptionData);
    });

    // Handle dashboard unsubscription
    socket.on('unsubscribe_dashboard', (subscriptionId: string) => {
      this.handleDashboardUnsubscription(userId, subscriptionId);
    });

    // Handle filter updates
    socket.on('update_dashboard_filters', async (data: {
      subscriptionId: string;
      filters: DashboardFilters;
    }) => {
      await this.handleFilterUpdate(userId, data.subscriptionId, data.filters);
    });

    // Handle real-time data requests
    socket.on('request_dashboard_data', async (data: {
      dashboardType: string;
      dataTypes: string[];
      filters: DashboardFilters;
    }) => {
      await this.handleDataRequest(socket, data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(userId, socket.id);
      logger.info(`Dashboard WebSocket disconnected for user ${userId} (${socket.id})`);
    });
  }

  /**
   * Handle dashboard subscription
   */
  private async handleDashboardSubscription(
    socket: any, 
    subscriptionData: {
      dashboardType: string;
      filters: DashboardFilters;
      dataTypes: string[];
      refreshInterval?: number;
    }
  ): Promise<void> {
    const userId = socket.userId;
    const subscriptionId = `${userId}_${socket.id}_${Date.now()}`;

    try {
      // Validate user permissions for requested data types
      if (!this.validateDataTypePermissions(socket.permissions, subscriptionData.dataTypes)) {
        socket.emit('subscription_error', {
          error: 'Insufficient permissions for requested data types',
          subscriptionId
        });
        return;
      }

      // Create subscription
      const subscription: DashboardSubscription = {
        userId,
        socketId: socket.id,
        dashboardType: subscriptionData.dashboardType as any,
        filters: subscriptionData.filters,
        dataTypes: subscriptionData.dataTypes,
        lastUpdate: new Date()
      };

      // Store subscription
      if (!this.subscriptions.has(userId)) {
        this.subscriptions.set(userId, []);
      }
      this.subscriptions.get(userId)!.push(subscription);

      // Join subscription-specific room
      socket.join(`dashboard:subscription:${subscriptionId}`);

      // Send initial data
      await this.sendInitialDashboardData(socket, subscription);

      // Set up periodic updates if requested
      const refreshInterval = subscriptionData.refreshInterval || 30000; // Default 30 seconds
      if (refreshInterval > 0) {
        const interval = setInterval(async () => {
          await this.sendDashboardUpdate(subscriptionId, subscription);
        }, refreshInterval);

        this.updateIntervals.set(subscriptionId, interval);
      }

      socket.emit('subscription_confirmed', {
        subscriptionId,
        dashboardType: subscription.dashboardType,
        dataTypes: subscription.dataTypes,
        refreshInterval
      });

      logger.info(`Dashboard subscription created: ${subscriptionId} for user ${userId}`);
    } catch (error) {
      logger.error('Error handling dashboard subscription:', error);
      socket.emit('subscription_error', {
        error: 'Failed to create dashboard subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle dashboard unsubscription
   */
  private handleDashboardUnsubscription(userId: string, subscriptionId: string): void {
    try {
      const userSubscriptions = this.subscriptions.get(userId);
      if (userSubscriptions) {
        const index = userSubscriptions.findIndex(sub => 
          `${sub.userId}_${sub.socketId}_${sub.lastUpdate.getTime()}` === subscriptionId
        );
        
        if (index > -1) {
          userSubscriptions.splice(index, 1);
          
          // Clear update interval
          const interval = this.updateIntervals.get(subscriptionId);
          if (interval) {
            clearInterval(interval);
            this.updateIntervals.delete(subscriptionId);
          }

          logger.info(`Dashboard subscription removed: ${subscriptionId} for user ${userId}`);
        }
      }
    } catch (error) {
      logger.error('Error handling dashboard unsubscription:', error);
    }
  }

  /**
   * Handle filter updates
   */
  private async handleFilterUpdate(
    userId: string, 
    subscriptionId: string, 
    newFilters: DashboardFilters
  ): Promise<void> {
    try {
      const userSubscriptions = this.subscriptions.get(userId);
      if (userSubscriptions) {
        const subscription = userSubscriptions.find(sub => 
          `${sub.userId}_${sub.socketId}_${sub.lastUpdate.getTime()}` === subscriptionId
        );
        
        if (subscription) {
          subscription.filters = newFilters;
          subscription.lastUpdate = new Date();
          
          // Send updated data immediately
          await this.sendDashboardUpdate(subscriptionId, subscription);
          
          logger.info(`Dashboard filters updated for subscription: ${subscriptionId}`);
        }
      }
    } catch (error) {
      logger.error('Error handling filter update:', error);
    }
  }

  /**
   * Handle real-time data requests
   */
  private async handleDataRequest(
    socket: any, 
    data: {
      dashboardType: string;
      dataTypes: string[];
      filters: DashboardFilters;
    }
  ): Promise<void> {
    try {
      // Validate permissions
      if (!this.validateDataTypePermissions(socket.permissions, data.dataTypes)) {
        socket.emit('data_request_error', {
          error: 'Insufficient permissions for requested data types'
        });
        return;
      }

      // Generate dashboard data
      const dashboardData = await this.generateDashboardData(data.dataTypes, data.filters);
      
      socket.emit('dashboard_data', {
        dashboardType: data.dashboardType,
        data: dashboardData,
        timestamp: new Date(),
        filters: data.filters
      });

      logger.info(`Dashboard data sent to user ${socket.userId} for types: ${data.dataTypes.join(', ')}`);
    } catch (error) {
      logger.error('Error handling data request:', error);
      socket.emit('data_request_error', {
        error: 'Failed to generate dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(userId: string, socketId: string): void {
    try {
      const userSubscriptions = this.subscriptions.get(userId);
      if (userSubscriptions) {
        // Remove subscriptions for this socket
        const remainingSubscriptions = userSubscriptions.filter(sub => sub.socketId !== socketId);
        
        // Clear intervals for removed subscriptions
        userSubscriptions
          .filter(sub => sub.socketId === socketId)
          .forEach(sub => {
            const subscriptionId = `${sub.userId}_${sub.socketId}_${sub.lastUpdate.getTime()}`;
            const interval = this.updateIntervals.get(subscriptionId);
            if (interval) {
              clearInterval(interval);
              this.updateIntervals.delete(subscriptionId);
            }
          });

        if (remainingSubscriptions.length === 0) {
          this.subscriptions.delete(userId);
        } else {
          this.subscriptions.set(userId, remainingSubscriptions);
        }
      }
    } catch (error) {
      logger.error('Error handling disconnection:', error);
    }
  }

  /**
   * Send initial dashboard data
   */
  private async sendInitialDashboardData(
    socket: any, 
    subscription: DashboardSubscription
  ): Promise<void> {
    try {
      const dashboardData = await this.generateDashboardData(
        subscription.dataTypes, 
        subscription.filters
      );

      socket.emit('dashboard_data', {
        dashboardType: subscription.dashboardType,
        data: dashboardData,
        timestamp: new Date(),
        filters: subscription.filters,
        isInitial: true
      });
    } catch (error) {
      logger.error('Error sending initial dashboard data:', error);
      socket.emit('dashboard_error', {
        error: 'Failed to load initial dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send dashboard update
   */
  private async sendDashboardUpdate(
    subscriptionId: string, 
    subscription: DashboardSubscription
  ): Promise<void> {
    if (!this.io) return;

    try {
      const dashboardData = await this.generateDashboardData(
        subscription.dataTypes, 
        subscription.filters
      );

      this.io.to(`dashboard:subscription:${subscriptionId}`).emit('dashboard_update', {
        dashboardType: subscription.dashboardType,
        data: dashboardData,
        timestamp: new Date(),
        filters: subscription.filters
      });

      subscription.lastUpdate = new Date();
    } catch (error) {
      logger.error('Error sending dashboard update:', error);
    }
  }

  /**
   * Generate dashboard data based on requested types
   */
  private async generateDashboardData(
    dataTypes: string[], 
    filters: DashboardFilters
  ): Promise<Record<string, any>> {
    const data: Record<string, any> = {};

    // Use Promise.allSettled to handle partial failures gracefully
    const dataPromises = dataTypes.map(async (dataType) => {
      try {
        switch (dataType) {
          case 'spend_analytics':
            return { type: dataType, data: await dashboardAnalyticsService.generateSpendAnalytics(filters) };
          case 'budget_utilization':
            return { type: dataType, data: await dashboardAnalyticsService.generateBudgetUtilization(filters) };
          case 'vendor_performance':
            return { type: dataType, data: await dashboardAnalyticsService.generateVendorPerformanceAnalytics(filters) };
          case 'operational_metrics':
            return { type: dataType, data: await dashboardAnalyticsService.generateOperationalMetrics(filters) };
          case 'financial_insights':
            return { type: dataType, data: await dashboardAnalyticsService.generateFinancialInsights(filters) };
          default:
            logger.warn(`Unknown data type requested: ${dataType}`);
            return { type: dataType, data: null };
        }
      } catch (error) {
        logger.error(`Error generating data for type ${dataType}:`, error);
        return { type: dataType, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    const results = await Promise.allSettled(dataPromises);
    
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        data[result.value.type] = result.value.data || result.value.error;
      }
    });

    return data;
  }

  /**
   * Validate user permissions for data types
   */
  private validateDataTypePermissions(userPermissions: string[], dataTypes: string[]): boolean {
    const requiredPermissions: Record<string, string[]> = {
      'spend_analytics': ['VIEW_ANALYTICS', 'VIEW_FINANCIAL_DATA'],
      'budget_utilization': ['VIEW_BUDGET', 'VIEW_FINANCIAL_DATA'],
      'vendor_performance': ['VIEW_VENDORS', 'VIEW_ANALYTICS'],
      'operational_metrics': ['VIEW_OPERATIONS', 'VIEW_ANALYTICS'],
      'financial_insights': ['VIEW_FINANCIAL_DATA', 'VIEW_ANALYTICS']
    };

    return dataTypes.every(dataType => {
      const required = requiredPermissions[dataType] || [];
      return required.some(permission => userPermissions.includes(permission)) || 
             userPermissions.includes('ADMIN') || 
             userPermissions.includes('SUPER_ADMIN');
    });
  }

  /**
   * Initialize data change detection
   */
  private initializeDataChangeDetection(): void {
    // Set up database change listeners for real-time updates
    this.setupPurchaseOrderChangeListener();
    this.setupBudgetChangeListener();
    this.setupVendorPerformanceChangeListener();
    this.setupDeliveryChangeListener();
    this.setupRequisitionChangeListener();
    this.setupInvoiceChangeListener();

    logger.info('Data change detection initialized');
  }

  /**
   * Set up purchase order change listener
   */
  private setupPurchaseOrderChangeListener(): void {
    // This would typically use database triggers or change streams
    // For now, we'll use a polling mechanism with caching
    const listener = async () => {
      try {
        const cacheKey = 'dashboard:po_last_update';
        const lastUpdate = await cacheService.get<string>(cacheKey);
        const currentTime = new Date().toISOString();

        // Check for recent purchase order changes
        const recentChanges = await prisma.purchaseOrder.findMany({
          where: {
            updatedAt: {
              gt: lastUpdate ? new Date(lastUpdate) : new Date(Date.now() - 60000) // Last minute
            }
          },
          select: {
            id: true,
            vesselId: true,
            vendorId: true,
            totalAmount: true,
            status: true,
            updatedAt: true
          }
        });

        if (recentChanges.length > 0) {
          await this.broadcastDataChanges('purchase_orders', recentChanges);
          await cacheService.set(cacheKey, currentTime);
        }
      } catch (error) {
        logger.error('Error in purchase order change listener:', error);
      }
    };

    this.dataChangeListeners.set('purchase_orders', listener);
    
    // Run every 30 seconds
    setInterval(listener, 30000);
  }

  /**
   * Set up budget change listener
   */
  private setupBudgetChangeListener(): void {
    const listener = async () => {
      try {
        // Similar implementation for budget changes
        // This would monitor budget allocations and utilization changes
        logger.debug('Checking for budget changes...');
      } catch (error) {
        logger.error('Error in budget change listener:', error);
      }
    };

    this.dataChangeListeners.set('budget', listener);
    setInterval(listener, 60000); // Every minute
  }

  /**
   * Set up vendor performance change listener
   */
  private setupVendorPerformanceChangeListener(): void {
    const listener = async () => {
      try {
        // Monitor vendor rating changes, delivery performance updates
        logger.debug('Checking for vendor performance changes...');
      } catch (error) {
        logger.error('Error in vendor performance change listener:', error);
      }
    };

    this.dataChangeListeners.set('vendor_performance', listener);
    setInterval(listener, 120000); // Every 2 minutes
  }

  /**
   * Set up delivery change listener
   */
  private setupDeliveryChangeListener(): void {
    const listener = async () => {
      try {
        const cacheKey = 'dashboard:delivery_last_update';
        const lastUpdate = await cacheService.get<string>(cacheKey);
        const currentTime = new Date().toISOString();

        const recentDeliveryChanges = await prisma.delivery.findMany({
          where: {
            updatedAt: {
              gt: lastUpdate ? new Date(lastUpdate) : new Date(Date.now() - 60000)
            }
          },
          include: {
            purchaseOrder: {
              select: {
                vesselId: true,
                vendorId: true
              }
            }
          }
        });

        if (recentDeliveryChanges.length > 0) {
          await this.broadcastDataChanges('deliveries', recentDeliveryChanges);
          await cacheService.set(cacheKey, currentTime);
        }
      } catch (error) {
        logger.error('Error in delivery change listener:', error);
      }
    };

    this.dataChangeListeners.set('deliveries', listener);
    setInterval(listener, 30000); // Every 30 seconds
  }

  /**
   * Broadcast data changes to relevant subscribers
   */
  private async broadcastDataChanges(changeType: string, changes: any[]): Promise<void> {
    if (!this.io) return;

    try {
      // Determine which subscriptions need updates based on change type
      const affectedDataTypes = this.getAffectedDataTypes(changeType);
      
      // Notify all relevant subscribers
      for (const [userId, subscriptions] of this.subscriptions.entries()) {
        const relevantSubscriptions = subscriptions.filter(sub => 
          sub.dataTypes.some(dataType => affectedDataTypes.includes(dataType))
        );

        for (const subscription of relevantSubscriptions) {
          // Check if changes affect this subscription's filters
          if (this.changesAffectSubscription(changes, subscription)) {
            const subscriptionId = `${subscription.userId}_${subscription.socketId}_${subscription.lastUpdate.getTime()}`;
            await this.sendDashboardUpdate(subscriptionId, subscription);
          }
        }
      }

      // Send general notification about data changes
      this.io.emit('dashboard_data_changed', {
        changeType,
        affectedDataTypes,
        timestamp: new Date(),
        changeCount: changes.length
      });

      logger.info(`Broadcasted ${changeType} changes to dashboard subscribers: ${changes.length} changes`);
    } catch (error) {
      logger.error('Error broadcasting data changes:', error);
    }
  }

  /**
   * Get affected data types for a change type
   */
  private getAffectedDataTypes(changeType: string): string[] {
    const affectedTypes: Record<string, string[]> = {
      'purchase_orders': ['spend_analytics', 'budget_utilization', 'vendor_performance', 'operational_metrics'],
      'budget': ['budget_utilization', 'financial_insights'],
      'vendor_performance': ['vendor_performance'],
      'deliveries': ['operational_metrics', 'vendor_performance'],
      'requisitions': ['spend_analytics', 'operational_metrics', 'budget_utilization'],
      'invoices': ['financial_insights', 'spend_analytics', 'vendor_performance']
    };

    return affectedTypes[changeType] || [];
  }

  /**
   * Check if changes affect a specific subscription
   */
  private changesAffectSubscription(changes: any[], subscription: DashboardSubscription): boolean {
    // Check if any changes match the subscription's filters
    return changes.some(change => {
      // Check vessel filter
      if (subscription.filters.vesselIds?.length && change.vesselId) {
        return subscription.filters.vesselIds.includes(change.vesselId);
      }

      // Check vendor filter
      if (subscription.filters.vendorIds?.length && change.vendorId) {
        return subscription.filters.vendorIds.includes(change.vendorId);
      }

      // If no specific filters, all changes are relevant
      return true;
    });
  }

  /**
   * Send dashboard notification
   */
  async sendDashboardNotification(notification: DashboardNotification): Promise<void> {
    if (!this.io) return;

    try {
      // Send to specific user if specified
      if (notification.userId) {
        this.io.to(`dashboard:user:${notification.userId}`).emit('dashboard_notification', notification);
      }

      // Send to vessel-specific subscribers if specified
      if (notification.vesselId) {
        this.io.to(`dashboard:vessel:${notification.vesselId}`).emit('dashboard_notification', notification);
      }

      // Send to dashboard type specific subscribers if specified
      if (notification.dashboardType) {
        this.io.to(`dashboard:type:${notification.dashboardType}`).emit('dashboard_notification', notification);
      }

      // Send critical notifications to all dashboard users
      if (notification.priority === 'critical') {
        this.io.emit('dashboard_critical_notification', notification);
      }

      logger.info(`Dashboard notification sent: ${notification.title} (${notification.priority})`);
    } catch (error) {
      logger.error('Error sending dashboard notification:', error);
    }
  }

  /**
   * Get active subscriptions count
   */
  getActiveSubscriptionsCount(): number {
    let count = 0;
    for (const subscriptions of this.subscriptions.values()) {
      count += subscriptions.length;
    }
    return count;
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Set up requisition change listener
   */
  private setupRequisitionChangeListener(): void {
    const listener = async () => {
      try {
        const cacheKey = 'dashboard:requisition_last_update';
        const lastUpdate = await cacheService.get<string>(cacheKey);
        const currentTime = new Date().toISOString();

        const recentChanges = await prisma.requisition.findMany({
          where: {
            updatedAt: {
              gt: lastUpdate ? new Date(lastUpdate) : new Date(Date.now() - 60000)
            }
          },
          select: {
            id: true,
            vesselId: true,
            status: true,
            totalAmount: true,
            urgencyLevel: true,
            updatedAt: true
          }
        });

        if (recentChanges.length > 0) {
          await this.broadcastDataChanges('requisitions', recentChanges);
          await cacheService.set(cacheKey, currentTime);
        }
      } catch (error) {
        logger.error('Error in requisition change listener:', error);
      }
    };

    this.dataChangeListeners.set('requisitions', listener);
    setInterval(listener, 45000); // Every 45 seconds
  }

  /**
   * Set up invoice change listener
   */
  private setupInvoiceChangeListener(): void {
    const listener = async () => {
      try {
        const cacheKey = 'dashboard:invoice_last_update';
        const lastUpdate = await cacheService.get<string>(cacheKey);
        const currentTime = new Date().toISOString();

        const recentChanges = await prisma.invoice.findMany({
          where: {
            updatedAt: {
              gt: lastUpdate ? new Date(lastUpdate) : new Date(Date.now() - 60000)
            }
          },
          select: {
            id: true,
            purchaseOrderId: true,
            status: true,
            totalAmount: true,
            currency: true,
            updatedAt: true
          }
        });

        if (recentChanges.length > 0) {
          await this.broadcastDataChanges('invoices', recentChanges);
          await cacheService.set(cacheKey, currentTime);
        }
      } catch (error) {
        logger.error('Error in invoice change listener:', error);
      }
    };

    this.dataChangeListeners.set('invoices', listener);
    setInterval(listener, 90000); // Every 90 seconds
  }

  /**
   * Enhanced data change broadcasting with throttling
   */
  private async broadcastDataChangesThrottled(changeType: string, changes: any[]): Promise<void> {
    const throttleKey = `broadcast_throttle_${changeType}`;
    const lastBroadcast = await cacheService.get<string>(throttleKey);
    const now = Date.now();
    
    // Throttle broadcasts to prevent spam (minimum 10 seconds between broadcasts of same type)
    if (lastBroadcast && (now - parseInt(lastBroadcast)) < 10000) {
      logger.debug(`Throttling ${changeType} broadcast - too frequent`);
      return;
    }

    await this.broadcastDataChanges(changeType, changes);
    await cacheService.set(throttleKey, now.toString(), 60); // Cache for 1 minute
  }

  /**
   * Get subscription statistics
   */
  getSubscriptionStatistics(): Record<string, any> {
    const stats = {
      totalSubscriptions: this.getActiveSubscriptionsCount(),
      connectedUsers: this.getConnectedUsersCount(),
      subscriptionsByType: {} as Record<string, number>,
      dataTypeUsage: {} as Record<string, number>,
      averageSubscriptionsPerUser: 0,
      changeListenersActive: this.dataChangeListeners.size,
      updateIntervalsActive: this.updateIntervals.size
    };

    for (const subscriptions of this.subscriptions.values()) {
      for (const subscription of subscriptions) {
        // Count by dashboard type
        stats.subscriptionsByType[subscription.dashboardType] = 
          (stats.subscriptionsByType[subscription.dashboardType] || 0) + 1;

        // Count by data type
        for (const dataType of subscription.dataTypes) {
          stats.dataTypeUsage[dataType] = (stats.dataTypeUsage[dataType] || 0) + 1;
        }
      }
    }

    // Calculate average subscriptions per user
    if (stats.connectedUsers > 0) {
      stats.averageSubscriptionsPerUser = Math.round(
        (stats.totalSubscriptions / stats.connectedUsers) * 100
      ) / 100;
    }

    return stats;
  }

  /**
   * Cleanup inactive subscriptions and connections
   */
  async cleanupInactiveSubscriptions(): Promise<void> {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [userId, subscriptions] of this.subscriptions.entries()) {
      const activeSubscriptions = subscriptions.filter(sub => {
        const timeSinceUpdate = now.getTime() - sub.lastUpdate.getTime();
        return timeSinceUpdate < inactiveThreshold;
      });

      if (activeSubscriptions.length !== subscriptions.length) {
        const removedCount = subscriptions.length - activeSubscriptions.length;
        logger.info(`Cleaned up ${removedCount} inactive subscriptions for user ${userId}`);
        
        if (activeSubscriptions.length === 0) {
          this.subscriptions.delete(userId);
        } else {
          this.subscriptions.set(userId, activeSubscriptions);
        }
      }
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): Record<string, any> {
    return {
      subscriptions: {
        total: this.getActiveSubscriptionsCount(),
        byType: this.getSubscriptionStatistics().subscriptionsByType,
        byDataType: this.getSubscriptionStatistics().dataTypeUsage
      },
      connections: {
        active: this.getConnectedUsersCount(),
        rooms: this.io?.sockets.adapter.rooms.size || 0
      },
      changeListeners: {
        active: this.dataChangeListeners.size,
        types: Array.from(this.dataChangeListeners.keys())
      },
      intervals: {
        active: this.updateIntervals.size
      },
      memory: {
        subscriptionsMapSize: this.subscriptions.size,
        updateIntervalsMapSize: this.updateIntervals.size,
        changeListenersMapSize: this.dataChangeListeners.size
      }
    };
  }
}

export const dashboardWebSocketService = new DashboardWebSocketService();