import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { AdvancedCacheService } from './advancedCacheService';
import { PerformanceMonitoringService } from './performanceMonitoringService';
import { LoadBalancingService } from './loadBalancingService';
import { CDNIntegrationService } from './cdnIntegrationService';
import { PerformanceTestingService } from './performanceTestingService';

interface PerformanceConfig {
  cache: {
    redis: {
      host: string;
      port: number;
      password?: string;
      db: number;
    };
    memory: {
      maxSize: number;
      ttl: number;
    };
    strategies: {
      writeThrough: boolean;
      writeBack: boolean;
      readThrough: boolean;
    };
  };
  loadBalancing: {
    strategy: 'round-robin' | 'weighted-round-robin' | 'least-connections' | 'least-response-time' | 'ip-hash';
    autoScaling: {
      enabled: boolean;
      minInstances: number;
      maxInstances: number;
      scaleUpThreshold: {
        cpuUsage: number;
        memoryUsage: number;
        responseTime: number;
        connectionCount: number;
      };
      scaleDownThreshold: {
        cpuUsage: number;
        memoryUsage: number;
        responseTime: number;
        connectionCount: number;
      };
      cooldownPeriod: number;
    };
  };
  cdn: {
    provider: 'aws-cloudfront' | 'cloudflare' | 'azure-cdn' | 'google-cdn';
    config: any;
  };
  monitoring: {
    metricsInterval: number;
    alertThresholds: any[];
  };
  testing: {
    continuousTesting: {
      enabled: boolean;
      interval: number;
      thresholds: {
        responseTime: number;
        errorRate: number;
        throughput: number;
      };
    };
  };
}

export class PerformanceEnhancementService extends EventEmitter {
  private cacheService: AdvancedCacheService;
  private monitoringService: PerformanceMonitoringService;
  private loadBalancingService: LoadBalancingService;
  private cdnService: CDNIntegrationService;
  private testingService: PerformanceTestingService;
  private config: PerformanceConfig;
  private initialized = false;

  constructor(config: PerformanceConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Performance Enhancement Service');

      // Initialize cache service
      this.cacheService = new AdvancedCacheService(this.config.cache);
      
      // Initialize monitoring service
      this.monitoringService = new PerformanceMonitoringService(this.cacheService);
      
      // Initialize load balancing service
      this.loadBalancingService = new LoadBalancingService(
        { name: this.config.loadBalancing.strategy },
        this.config.loadBalancing.autoScaling,
        this.monitoringService
      );
      
      // Initialize CDN service
      this.cdnService = new CDNIntegrationService(this.config.cdn);
      
      // Initialize testing service
      this.testingService = new PerformanceTestingService(this.monitoringService);

      // Set up event listeners
      this.setupEventListeners();

      // Start continuous monitoring and optimization
      await this.startContinuousOptimization();

      this.initialized = true;
      logger.info('Performance Enhancement Service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Performance Enhancement Service:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Cache service events
    this.cacheService.on('cacheHit', (data) => {
      this.emit('cacheHit', data);
    });

    this.cacheService.on('cacheMiss', (data) => {
      this.emit('cacheMiss', data);
    });

    // Monitoring service events
    this.monitoringService.on('alert', (alert) => {
      logger.warn('Performance alert:', alert);
      this.emit('performanceAlert', alert);
      this.handlePerformanceAlert(alert);
    });

    this.monitoringService.on('alertResolved', (alert) => {
      logger.info('Performance alert resolved:', alert);
      this.emit('performanceAlertResolved', alert);
    });

    // Load balancing service events
    this.loadBalancingService.on('scaleUp', (data) => {
      logger.info('Auto-scaling up:', data);
      this.emit('autoScaleUp', data);
    });

    this.loadBalancingService.on('scaleDown', (data) => {
      logger.info('Auto-scaling down:', data);
      this.emit('autoScaleDown', data);
    });

    this.loadBalancingService.on('instanceUnhealthy', (instance) => {
      logger.warn('Instance unhealthy:', instance);
      this.emit('instanceUnhealthy', instance);
    });

    // Testing service events
    this.testingService.on('performanceDegradation', (data) => {
      logger.warn('Performance degradation detected:', data);
      this.emit('performanceDegradation', data);
    });

    this.testingService.on('optimizationApplied', (data) => {
      logger.info('Optimization applied:', data);
      this.emit('optimizationApplied', data);
    });
  }

  private async startContinuousOptimization(): Promise<void> {
    // Start cache preloading
    await this.startCacheOptimization();

    // Start continuous performance testing if enabled
    if (this.config.testing.continuousTesting.enabled) {
      await this.startContinuousPerformanceTesting();
    }

    // Start periodic optimization checks
    setInterval(async () => {
      await this.runPeriodicOptimization();
    }, 300000); // Every 5 minutes
  }

  private async startCacheOptimization(): Promise<void> {
    try {
      // Preload popular data into cache
      await this.cacheService.preloadPopularData();
      
      // Set up cache warming schedule
      setInterval(async () => {
        await this.cacheService.preloadPopularData();
      }, 3600000); // Every hour
      
      logger.info('Cache optimization started');
    } catch (error) {
      logger.error('Failed to start cache optimization:', error);
    }
  }

  private async startContinuousPerformanceTesting(): Promise<void> {
    try {
      const testConfig = {
        targetUrl: 'http://localhost:3000',
        concurrency: 10,
        duration: 60,
        rampUpTime: 10,
        scenarios: [
          {
            name: 'API Health Check',
            weight: 100,
            requests: [
              { method: 'GET' as const, path: '/api/health' },
              { method: 'GET' as const, path: '/api/vessels' },
              { method: 'GET' as const, path: '/api/requisitions' },
            ],
          },
        ],
      };

      await this.testingService.startContinuousPerformanceTesting({
        interval: this.config.testing.continuousTesting.interval,
        testConfig,
        thresholds: this.config.testing.continuousTesting.thresholds,
      });

      logger.info('Continuous performance testing started');
    } catch (error) {
      logger.error('Failed to start continuous performance testing:', error);
    }
  }

  private async runPeriodicOptimization(): Promise<void> {
    try {
      logger.debug('Running periodic optimization');
      
      // Run automatic optimization
      await this.testingService.runAutomaticOptimization();
      
      // Check and optimize cache performance
      const cacheMetrics = this.cacheService.getMetrics();
      if (cacheMetrics.hitRate < 70) {
        await this.optimizeCachePerformance();
      }
      
      // Check CDN performance
      const cdnHealth = await this.cdnService.healthCheck();
      if (!cdnHealth.healthy) {
        logger.warn('CDN health check failed:', cdnHealth.details);
      }
      
    } catch (error) {
      logger.error('Periodic optimization failed:', error);
    }
  }

  private async handlePerformanceAlert(alert: any): Promise<void> {
    try {
      switch (alert.metric) {
        case 'responseTime.p95':
          await this.optimizeResponseTime();
          break;
        case 'errorRate.percentage':
          await this.optimizeErrorRate();
          break;
        case 'resourceUsage.memoryUsage':
          await this.optimizeMemoryUsage();
          break;
        case 'cache.hitRate':
          await this.optimizeCachePerformance();
          break;
        default:
          logger.info(`No specific optimization for metric: ${alert.metric}`);
      }
    } catch (error) {
      logger.error(`Failed to handle performance alert for ${alert.metric}:`, error);
    }
  }

  private async optimizeResponseTime(): Promise<void> {
    logger.info('Optimizing response time');
    
    // Enable aggressive caching
    await this.cacheService.preloadPopularData();
    
    // Trigger CDN cache warming
    const popularAssets = [
      'static/js/main.js',
      'static/css/main.css',
      'static/images/logo.png',
    ];
    await this.cdnService.preloadAssets(popularAssets);
  }

  private async optimizeErrorRate(): Promise<void> {
    logger.info('Optimizing error rate');
    
    // Check instance health and potentially scale up
    const healthyInstances = this.loadBalancingService.getHealthyInstances();
    if (healthyInstances.length < 2) {
      logger.info('Scaling up due to high error rate');
      // This would trigger auto-scaling
    }
  }

  private async optimizeMemoryUsage(): Promise<void> {
    logger.info('Optimizing memory usage');
    
    // Clear old cache entries
    await this.cacheService.invalidate('*:old:*');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  private async optimizeCachePerformance(): Promise<void> {
    logger.info('Optimizing cache performance');
    
    // Warm up cache with popular data
    await this.cacheService.preloadPopularData();
    
    // Analyze cache patterns and adjust TTL
    const metrics = this.cacheService.getMetrics();
    logger.info('Current cache metrics:', metrics);
  }

  // Public API methods
  getMiddleware() {
    return this.monitoringService.getMiddleware();
  }

  async uploadAssetToCDN(key: string, content: Buffer, contentType: string, options?: any): Promise<any> {
    return await this.cdnService.uploadAsset(key, content, contentType, options);
  }

  async invalidateCDNCache(paths: string[]): Promise<any> {
    return await this.cdnService.invalidateCache(paths);
  }

  generateOptimizedAssetUrl(key: string, options?: any): string {
    return this.cdnService.generateOptimizedUrl(key, options);
  }

  async cacheData<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cacheService.set(key, value, ttl);
  }

  async getCachedData<T>(key: string): Promise<T | null> {
    return await this.cacheService.get<T>(key);
  }

  async invalidateCache(pattern: string): Promise<number> {
    return await this.cacheService.invalidate(pattern);
  }

  selectLoadBalancedInstance(clientIp?: string): any {
    return this.loadBalancingService.selectInstance(clientIp);
  }

  addServerInstance(instance: any): void {
    this.loadBalancingService.addInstance(instance);
  }

  removeServerInstance(instanceId: string): void {
    this.loadBalancingService.removeInstance(instanceId);
  }

  async runLoadTest(config: any): Promise<any> {
    return await this.testingService.runLoadTest(config);
  }

  async runPerformanceBenchmark(scenarios: string[]): Promise<any> {
    return await this.testingService.runPerformanceBenchmark(scenarios);
  }

  getPerformanceMetrics(): any {
    return {
      monitoring: this.monitoringService.getMetrics(),
      cache: this.cacheService.getMetrics(),
      loadBalancing: this.loadBalancingService.getInstanceStats(),
      cdn: this.cdnService.getAssetMetrics(),
      activeTests: this.testingService.getActiveTests(),
    };
  }

  getHealthStatus(): any {
    return {
      overall: 'healthy',
      timestamp: new Date(),
      services: {
        monitoring: this.monitoringService.getHealthStatus(),
        cache: this.cacheService.getMetrics(),
        loadBalancing: this.loadBalancingService.getInstanceStats(),
        cdn: this.cdnService.getAssetMetrics(),
      },
    };
  }

  // Configuration updates
  async updateCacheConfig(config: any): Promise<void> {
    // This would require reinitializing the cache service
    logger.info('Cache configuration update requested');
  }

  async updateLoadBalancingConfig(config: any): Promise<void> {
    this.loadBalancingService.updateAutoScalingConfig(config);
    logger.info('Load balancing configuration updated');
  }

  // Cleanup
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Performance Enhancement Service');
      
      await this.cacheService.shutdown();
      this.monitoringService.shutdown();
      this.loadBalancingService.shutdown();
      this.testingService.shutdown();
      
      this.removeAllListeners();
      
      logger.info('Performance Enhancement Service shutdown completed');
    } catch (error) {
      logger.error('Error during Performance Enhancement Service shutdown:', error);
    }
  }
}

// Export decorators for easy use
export { Cacheable, CacheInvalidate } from './advancedCacheService';
export { TrackPerformance } from './performanceMonitoringService';