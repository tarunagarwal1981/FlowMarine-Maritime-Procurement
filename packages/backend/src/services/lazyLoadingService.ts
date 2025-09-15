import { logger } from '../utils/logger.js';
import { cacheService } from './cacheService.js';
import { queryOptimizationService } from './queryOptimizationService.js';

export interface LazyLoadConfig {
  componentId: string;
  priority: 'high' | 'medium' | 'low';
  dependencies: string[];
  loadStrategy: 'immediate' | 'viewport' | 'interaction' | 'idle';
  cacheStrategy: 'aggressive' | 'normal' | 'minimal';
  preloadData?: boolean;
}

export interface LoadingState {
  componentId: string;
  status: 'pending' | 'loading' | 'loaded' | 'error';
  progress: number;
  error?: string;
  loadedAt?: Date;
  dataSize?: number;
}

export interface LazyLoadRequest {
  componentId: string;
  filters: any;
  options?: {
    priority?: number;
    timeout?: number;
    retries?: number;
  };
}

/**
 * Lazy Loading Service for Dashboard Components
 * Implements intelligent lazy loading strategies to optimize dashboard performance
 */
export class LazyLoadingService {
  private static instance: LazyLoadingService;
  private loadingStates: Map<string, LoadingState> = new Map();
  private loadingQueue: LazyLoadRequest[] = [];
  private componentConfigs: Map<string, LazyLoadConfig> = new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();
  private intersectionObserver?: IntersectionObserver;
  private idleCallback?: number;

  private constructor() {
    this.initializeDefaultConfigs();
  }

  public static getInstance(): LazyLoadingService {
    if (!LazyLoadingService.instance) {
      LazyLoadingService.instance = new LazyLoadingService();
    }
    return LazyLoadingService.instance;
  }

  /**
   * Initialize default configurations for common dashboard components
   */
  private initializeDefaultConfigs(): void {
    const defaultConfigs: LazyLoadConfig[] = [
      {
        componentId: 'fleet_spend_visualization',
        priority: 'high',
        dependencies: ['purchase_orders', 'vessels'],
        loadStrategy: 'immediate',
        cacheStrategy: 'aggressive',
        preloadData: true
      },
      {
        componentId: 'budget_utilization_dashboard',
        priority: 'high',
        dependencies: ['budget_allocations', 'purchase_orders'],
        loadStrategy: 'immediate',
        cacheStrategy: 'aggressive',
        preloadData: true
      },
      {
        componentId: 'vendor_performance_scorecards',
        priority: 'medium',
        dependencies: ['vendors', 'purchase_orders', 'deliveries'],
        loadStrategy: 'viewport',
        cacheStrategy: 'normal',
        preloadData: false
      },
      {
        componentId: 'operational_metrics',
        priority: 'medium',
        dependencies: ['requisitions', 'approvals', 'deliveries'],
        loadStrategy: 'viewport',
        cacheStrategy: 'normal',
        preloadData: false
      },
      {
        componentId: 'port_efficiency_analytics',
        priority: 'low',
        dependencies: ['deliveries', 'ports', 'vessels'],
        loadStrategy: 'interaction',
        cacheStrategy: 'minimal',
        preloadData: false
      },
      {
        componentId: 'financial_insights',
        priority: 'medium',
        dependencies: ['purchase_orders', 'invoices', 'payments'],
        loadStrategy: 'idle',
        cacheStrategy: 'normal',
        preloadData: false
      }
    ];

    defaultConfigs.forEach(config => {
      this.componentConfigs.set(config.componentId, config);
    });
  }

  /**
   * Register a component for lazy loading
   */
  public registerComponent(config: LazyLoadConfig): void {
    this.componentConfigs.set(config.componentId, config);
    
    // Initialize loading state
    this.loadingStates.set(config.componentId, {
      componentId: config.componentId,
      status: 'pending',
      progress: 0
    });

    logger.debug(`Registered lazy loading component: ${config.componentId}`, { config });
  }

  /**
   * Load component data based on its configuration
   */
  public async loadComponent(
    componentId: string,
    filters: any,
    options: { priority?: number; timeout?: number; retries?: number } = {}
  ): Promise<any> {
    const config = this.componentConfigs.get(componentId);
    if (!config) {
      throw new Error(`Component ${componentId} not registered for lazy loading`);
    }

    // Check if already loading
    if (this.loadingPromises.has(componentId)) {
      return this.loadingPromises.get(componentId);
    }

    // Update loading state
    this.updateLoadingState(componentId, {
      status: 'loading',
      progress: 0
    });

    const loadingPromise = this.executeComponentLoad(componentId, config, filters, options);
    this.loadingPromises.set(componentId, loadingPromise);

    try {
      const result = await loadingPromise;
      
      this.updateLoadingState(componentId, {
        status: 'loaded',
        progress: 100,
        loadedAt: new Date(),
        dataSize: this.calculateDataSize(result)
      });

      return result;
    } catch (error) {
      this.updateLoadingState(componentId, {
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      this.loadingPromises.delete(componentId);
    }
  }

  /**
   * Execute the actual component loading based on strategy
   */
  private async executeComponentLoad(
    componentId: string,
    config: LazyLoadConfig,
    filters: any,
    options: any
  ): Promise<any> {
    logger.info(`Loading component: ${componentId}`, { strategy: config.loadStrategy, priority: config.priority });

    // Apply loading strategy
    switch (config.loadStrategy) {
      case 'immediate':
        return this.loadImmediately(componentId, config, filters, options);
      
      case 'viewport':
        return this.loadOnViewport(componentId, config, filters, options);
      
      case 'interaction':
        return this.loadOnInteraction(componentId, config, filters, options);
      
      case 'idle':
        return this.loadOnIdle(componentId, config, filters, options);
      
      default:
        return this.loadImmediately(componentId, config, filters, options);
    }
  }

  /**
   * Load component immediately
   */
  private async loadImmediately(
    componentId: string,
    config: LazyLoadConfig,
    filters: any,
    options: any
  ): Promise<any> {
    return this.fetchComponentData(componentId, config, filters, options);
  }

  /**
   * Load component when it enters viewport (simulated for backend)
   */
  private async loadOnViewport(
    componentId: string,
    config: LazyLoadConfig,
    filters: any,
    options: any
  ): Promise<any> {
    // In a real implementation, this would be triggered by frontend intersection observer
    // For backend simulation, we'll add a small delay to simulate viewport detection
    await this.delay(100);
    return this.fetchComponentData(componentId, config, filters, options);
  }

  /**
   * Load component on user interaction (simulated for backend)
   */
  private async loadOnInteraction(
    componentId: string,
    config: LazyLoadConfig,
    filters: any,
    options: any
  ): Promise<any> {
    // In a real implementation, this would be triggered by user interaction
    // For backend simulation, we'll add a delay to simulate interaction
    await this.delay(200);
    return this.fetchComponentData(componentId, config, filters, options);
  }

  /**
   * Load component during idle time
   */
  private async loadOnIdle(
    componentId: string,
    config: LazyLoadConfig,
    filters: any,
    options: any
  ): Promise<any> {
    // Simulate idle loading with a longer delay
    await this.delay(500);
    return this.fetchComponentData(componentId, config, filters, options);
  }

  /**
   * Fetch component data using optimized queries
   */
  private async fetchComponentData(
    componentId: string,
    config: LazyLoadConfig,
    filters: any,
    options: any
  ): Promise<any> {
    const cacheKey = `lazy_load:${componentId}:${this.hashFilters(filters)}`;
    
    // Check cache first based on cache strategy
    if (config.cacheStrategy !== 'minimal') {
      const cached = await cacheService.getCachedDashboardData(componentId, filters);
      if (cached) {
        logger.debug(`Cache hit for lazy loaded component: ${componentId}`);
        return cached;
      }
    }

    // Update progress
    this.updateLoadingState(componentId, { progress: 25 });

    let data: any;

    // Route to appropriate data fetching method based on component type
    switch (componentId) {
      case 'fleet_spend_visualization':
        const spendResult = await queryOptimizationService.getOptimizedSpendAnalytics(filters, {
          useCache: config.cacheStrategy !== 'minimal',
          usePreAggregation: config.preloadData
        });
        data = spendResult.data;
        break;

      case 'budget_utilization_dashboard':
        const budgetResult = await queryOptimizationService.getOptimizedBudgetUtilization(filters, {
          useCache: config.cacheStrategy !== 'minimal',
          usePreAggregation: config.preloadData
        });
        data = budgetResult.data;
        break;

      case 'vendor_performance_scorecards':
        const vendorResult = await queryOptimizationService.getOptimizedVendorPerformance(filters, {
          useCache: config.cacheStrategy !== 'minimal',
          batchSize: 50
        });
        data = vendorResult.data;
        break;

      case 'operational_metrics':
        const operationalResult = await queryOptimizationService.getOptimizedOperationalMetrics(filters, {
          useCache: config.cacheStrategy !== 'minimal',
          usePreAggregation: config.preloadData
        });
        data = operationalResult.data;
        break;

      case 'port_efficiency_analytics':
        data = await this.fetchPortEfficiencyData(filters);
        break;

      case 'financial_insights':
        data = await this.fetchFinancialInsightsData(filters);
        break;

      default:
        throw new Error(`Unknown component type: ${componentId}`);
    }

    // Update progress
    this.updateLoadingState(componentId, { progress: 75 });

    // Cache the result based on cache strategy
    if (config.cacheStrategy !== 'minimal') {
      const ttl = this.getCacheTTL(config.cacheStrategy);
      await cacheService.cacheDashboardData(componentId, filters, data, config.dependencies);
    }

    // Update progress
    this.updateLoadingState(componentId, { progress: 100 });

    return data;
  }

  /**
   * Preload components based on priority and strategy
   */
  public async preloadComponents(filters: any): Promise<void> {
    logger.info('Starting component preloading');

    const preloadConfigs = Array.from(this.componentConfigs.values())
      .filter(config => config.preloadData)
      .sort((a, b) => this.getPriorityValue(a.priority) - this.getPriorityValue(b.priority));

    const preloadPromises = preloadConfigs.map(async (config) => {
      try {
        await this.loadComponent(config.componentId, filters);
        logger.debug(`Preloaded component: ${config.componentId}`);
      } catch (error) {
        logger.error(`Failed to preload component: ${config.componentId}`, { error });
      }
    });

    await Promise.allSettled(preloadPromises);
    logger.info('Component preloading completed');
  }

  /**
   * Get loading state for a component
   */
  public getLoadingState(componentId: string): LoadingState | null {
    return this.loadingStates.get(componentId) || null;
  }

  /**
   * Get loading states for all components
   */
  public getAllLoadingStates(): LoadingState[] {
    return Array.from(this.loadingStates.values());
  }

  /**
   * Cancel loading for a component
   */
  public cancelLoading(componentId: string): void {
    const promise = this.loadingPromises.get(componentId);
    if (promise) {
      this.loadingPromises.delete(componentId);
      this.updateLoadingState(componentId, {
        status: 'pending',
        progress: 0
      });
      logger.debug(`Cancelled loading for component: ${componentId}`);
    }
  }

  /**
   * Batch load multiple components
   */
  public async batchLoadComponents(
    requests: LazyLoadRequest[]
  ): Promise<{ [componentId: string]: any }> {
    logger.info(`Batch loading ${requests.length} components`);

    // Sort by priority
    const sortedRequests = requests.sort((a, b) => {
      const priorityA = a.options?.priority || this.getComponentPriority(a.componentId);
      const priorityB = b.options?.priority || this.getComponentPriority(b.componentId);
      return priorityA - priorityB;
    });

    const results: { [componentId: string]: any } = {};
    const loadingPromises = sortedRequests.map(async (request) => {
      try {
        const data = await this.loadComponent(request.componentId, request.filters, request.options);
        results[request.componentId] = data;
      } catch (error) {
        logger.error(`Failed to load component in batch: ${request.componentId}`, { error });
        results[request.componentId] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    await Promise.allSettled(loadingPromises);
    return results;
  }

  /**
   * Invalidate component cache
   */
  public async invalidateComponent(componentId: string): Promise<void> {
    const config = this.componentConfigs.get(componentId);
    if (config) {
      // Invalidate based on dependencies
      for (const dependency of config.dependencies) {
        await cacheService.invalidateByDependency(dependency);
      }
    }

    // Reset loading state
    this.updateLoadingState(componentId, {
      status: 'pending',
      progress: 0
    });

    logger.debug(`Invalidated component: ${componentId}`);
  }

  /**
   * Get component loading statistics
   */
  public getLoadingStatistics(): any {
    const states = Array.from(this.loadingStates.values());
    
    return {
      totalComponents: states.length,
      loaded: states.filter(s => s.status === 'loaded').length,
      loading: states.filter(s => s.status === 'loading').length,
      pending: states.filter(s => s.status === 'pending').length,
      errors: states.filter(s => s.status === 'error').length,
      averageLoadTime: this.calculateAverageLoadTime(states),
      totalDataSize: states.reduce((sum, s) => sum + (s.dataSize || 0), 0)
    };
  }

  // Private helper methods

  private updateLoadingState(componentId: string, updates: Partial<LoadingState>): void {
    const current = this.loadingStates.get(componentId) || {
      componentId,
      status: 'pending',
      progress: 0
    };

    this.loadingStates.set(componentId, { ...current, ...updates });
  }

  private hashFilters(filters: any): string {
    const sortedFilters = JSON.stringify(filters, Object.keys(filters).sort());
    return Buffer.from(sortedFilters).toString('base64').substring(0, 16);
  }

  private calculateDataSize(data: any): number {
    return JSON.stringify(data).length;
  }

  private getPriorityValue(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 1;
      case 'medium': return 2;
      case 'low': return 3;
      default: return 2;
    }
  }

  private getComponentPriority(componentId: string): number {
    const config = this.componentConfigs.get(componentId);
    return config ? this.getPriorityValue(config.priority) : 2;
  }

  private getCacheTTL(strategy: 'aggressive' | 'normal' | 'minimal'): number {
    switch (strategy) {
      case 'aggressive': return 1800; // 30 minutes
      case 'normal': return 900; // 15 minutes
      case 'minimal': return 300; // 5 minutes
      default: return 900;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateAverageLoadTime(states: LoadingState[]): number {
    const loadedStates = states.filter(s => s.status === 'loaded' && s.loadedAt);
    if (loadedStates.length === 0) return 0;

    // This is a simplified calculation - in a real implementation,
    // you'd track actual load start and end times
    return 1000; // Placeholder average load time in ms
  }

  private async fetchPortEfficiencyData(filters: any): Promise<any> {
    // Placeholder for port efficiency data fetching
    // This would integrate with the actual port efficiency analytics service
    return {
      ports: [],
      efficiency: 0,
      recommendations: []
    };
  }

  private async fetchFinancialInsightsData(filters: any): Promise<any> {
    // Placeholder for financial insights data fetching
    // This would integrate with the actual financial insights service
    return {
      multiCurrency: {},
      paymentTerms: {},
      costAnalysis: {}
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    // Clear all loading promises
    this.loadingPromises.clear();
    
    // Clear loading states
    this.loadingStates.clear();
    
    // Clear any scheduled callbacks
    if (this.idleCallback) {
      clearTimeout(this.idleCallback);
    }

    logger.info('Lazy loading service cleaned up');
  }
}

// Export singleton instance
export const lazyLoadingService = LazyLoadingService.getInstance();