import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Server } from 'http';
import { io as Client, Socket } from 'socket.io-client';
import { dashboardWebSocketService } from '../services/dashboardWebSocketService.js';
import jwt from 'jsonwebtoken';

describe('Dashboard WebSocket Service', () => {
  let server: Server;
  let clientSocket: Socket;
  let serverPort: number;

  beforeAll(async () => {
    // Create a test HTTP server
    server = new Server();
    
    // Initialize the dashboard WebSocket service
    dashboardWebSocketService.initialize(server);
    
    // Start the server on a random port
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address();
        serverPort = typeof address === 'object' && address ? address.port : 3001;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (server) {
      server.close();
    }
  });

  it('should initialize without errors', () => {
    expect(dashboardWebSocketService).toBeDefined();
    expect(typeof dashboardWebSocketService.getActiveSubscriptionsCount).toBe('function');
    expect(typeof dashboardWebSocketService.getConnectedUsersCount).toBe('function');
  });

  it('should provide subscription statistics', () => {
    const stats = dashboardWebSocketService.getSubscriptionStatistics();
    
    expect(stats).toHaveProperty('totalSubscriptions');
    expect(stats).toHaveProperty('connectedUsers');
    expect(stats).toHaveProperty('subscriptionsByType');
    expect(stats).toHaveProperty('dataTypeUsage');
    
    expect(typeof stats.totalSubscriptions).toBe('number');
    expect(typeof stats.connectedUsers).toBe('number');
    expect(typeof stats.subscriptionsByType).toBe('object');
    expect(typeof stats.dataTypeUsage).toBe('object');
  });

  it('should handle dashboard notifications', async () => {
    const notification = {
      type: 'alert' as const,
      title: 'Test Alert',
      message: 'This is a test alert',
      data: { test: true },
      priority: 'medium' as const
    };

    // This should not throw an error even without connected clients
    await expect(
      dashboardWebSocketService.sendDashboardNotification(notification)
    ).resolves.not.toThrow();
  });

  it('should validate data type permissions correctly', () => {
    // This tests the private method indirectly through the service behavior
    const service = dashboardWebSocketService as any;
    
    // Test with admin permissions
    const adminPermissions = ['ADMIN'];
    const dataTypes = ['spend_analytics', 'budget_utilization'];
    
    const hasPermission = service.validateDataTypePermissions(adminPermissions, dataTypes);
    expect(hasPermission).toBe(true);
    
    // Test with insufficient permissions
    const limitedPermissions = ['VIEW_VESSELS'];
    const hasLimitedPermission = service.validateDataTypePermissions(limitedPermissions, dataTypes);
    expect(hasLimitedPermission).toBe(false);
  });

  it('should get affected data types correctly', () => {
    const service = dashboardWebSocketService as any;
    
    const purchaseOrderTypes = service.getAffectedDataTypes('purchase_orders');
    expect(purchaseOrderTypes).toContain('spend_analytics');
    expect(purchaseOrderTypes).toContain('budget_utilization');
    expect(purchaseOrderTypes).toContain('vendor_performance');
    expect(purchaseOrderTypes).toContain('operational_metrics');
    
    const budgetTypes = service.getAffectedDataTypes('budget');
    expect(budgetTypes).toContain('budget_utilization');
    expect(budgetTypes).toContain('financial_insights');
  });

  it('should handle connection counts correctly', () => {
    const initialCount = dashboardWebSocketService.getConnectedUsersCount();
    expect(initialCount).toBe(0);
    
    const subscriptionCount = dashboardWebSocketService.getActiveSubscriptionsCount();
    expect(subscriptionCount).toBe(0);
  });
});

// Mock the Prisma client for testing
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'test-user-id',
        isActive: true,
        role: 'CAPTAIN',
        vessels: [],
        permissions: []
      })
    }
  }))
}));

// Mock JWT for testing
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn().mockReturnValue({ userId: 'test-user-id' })
  }
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock dashboard analytics service
vi.mock('../services/dashboardAnalyticsService.js', () => ({
  dashboardAnalyticsService: {
    generateSpendAnalytics: vi.fn().mockResolvedValue({}),
    generateBudgetUtilization: vi.fn().mockResolvedValue({}),
    generateVendorPerformanceAnalytics: vi.fn().mockResolvedValue([]),
    generateOperationalMetrics: vi.fn().mockResolvedValue({}),
    generateFinancialInsights: vi.fn().mockResolvedValue({})
  },
  DashboardFilters: {}
}));

// Mock cache service
vi.mock('../services/cacheService.js', () => ({
  cacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true)
  }
}));