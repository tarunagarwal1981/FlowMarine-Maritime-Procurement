import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { AdvancedCacheService } from './advancedCacheService';

interface PerformanceMetrics {
  responseTime: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };
  errorRate: {
    percentage: number;
    count: number;
  };
  resourceUsage: {
    cpuUsage: number;
    memoryUsage: number;
    heapUsed: number;
    heapTotal: number;
  };
  database: {
    connectionPool: number;
    queryTime: number;
    slowQueries: number;
  };
  cache: {
    hitRate: number;
    memoryUsage: number;
    redisConnections: number;
  };
}

interface AlertThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'eq';
  value: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration: number; // seconds
}

interface Alert {
  id: string;
  metric: string;
  value: number;
  threshold: AlertThreshold;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export class PerformanceMonitoringService extends EventEmitter {
  private metrics: PerformanceMetrics;
  private responseTimes: number[] = [];
  private requestCount = 0;
  private errorCount = 0;
  private startTime = Date.now();
  private alerts: Map<string, Alert> = new Map();
  private thresholds: AlertThreshold[] = [];
  private observer: PerformanceObserver;
  private cacheService?: AdvancedCacheService;

  constructor(cacheService?: AdvancedCacheService) {
    super();
    this.cacheService = cacheService;
    this.initializeMetrics();
    this.setupPerformanceObserver();
    this.setupDefaultThresholds();
    this.startMetricsCollection();
  }

  private initializeMetrics(): void {
    this.metrics = {
      responseTime: {
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        max: 0,
      },
      throughput: {
        requestsPerSecond: 0,
        requestsPerMinute: 0,
      },
      errorRate: {
        percentage: 0,
        count: 0,
      },
      resourceUsage: {
        cpuUsage: 0,
        memoryUsage: 0,
        heapUsed: 0,
        heapTotal: 0,
      },
      database: {
        connectionPool: 0,
        queryTime: 0,
        slowQueries: 0,
      },
      cache: {
        hitRate: 0,
        memoryUsage: 0,
        redisConnections: 0,
      },
    };
  }

  private setupPerformanceObserver(): void {
    this.observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'measure') {
          this.recordResponseTime(entry.duration);
        }
      });
    });

    this.observer.observe({ entryTypes: ['measure'] });
  }

  private setupDefaultThresholds(): void {
    this.thresholds = [
      {
        metric: 'responseTime.p95',
        operator: 'gt',
        value: 2000, // 2 seconds
        severity: 'high',
        duration: 60,
      },
      {
        metric: 'errorRate.percentage',
        operator: 'gt',
        value: 5, // 5%
        severity: 'critical',
        duration: 30,
      },
      {
        metric: 'resourceUsage.memoryUsage',
        operator: 'gt',
        value: 85, // 85%
        severity: 'medium',
        duration: 120,
      },
      {
        metric: 'cache.hitRate',
        operator: 'lt',
        value: 70, // 70%
        severity: 'medium',
        duration: 300,
      },
      {
        metric: 'database.queryTime',
        operator: 'gt',
        value: 1000, // 1 second
        severity: 'high',
        duration: 60,
      },
    ];
  }

  // Middleware for automatic request tracking
  getMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = performance.now();
      const requestId = `req_${Date.now()}_${Math.random()}`;
      
      performance.mark(`${requestId}_start`);
      
      res.on('finish', () => {
        performance.mark(`${requestId}_end`);
        performance.measure(`${requestId}`, `${requestId}_start`, `${requestId}_end`);
        
        this.requestCount++;
        
        if (res.statusCode >= 400) {
          this.errorCount++;
        }
        
        // Clean up marks
        performance.clearMarks(`${requestId}_start`);
        performance.clearMarks(`${requestId}_end`);
        performance.clearMeasures(`${requestId}`);
      });
      
      next();
    };
  }

  private recordResponseTime(duration: number): void {
    this.responseTimes.push(duration);
    
    // Keep only last 1000 response times for memory efficiency
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
    
    this.updateResponseTimeMetrics();
  }

  private updateResponseTimeMetrics(): void {
    if (this.responseTimes.length === 0) return;
    
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const len = sorted.length;
    
    this.metrics.responseTime.avg = sorted.reduce((a, b) => a + b, 0) / len;
    this.metrics.responseTime.p50 = sorted[Math.floor(len * 0.5)];
    this.metrics.responseTime.p95 = sorted[Math.floor(len * 0.95)];
    this.metrics.responseTime.p99 = sorted[Math.floor(len * 0.99)];
    this.metrics.responseTime.max = sorted[len - 1];
  }

  private startMetricsCollection(): void {
    // Update metrics every 10 seconds
    setInterval(() => {
      this.updateMetrics();
      this.checkThresholds();
    }, 10000);
    
    // Update throughput metrics every minute
    setInterval(() => {
      this.updateThroughputMetrics();
    }, 60000);
  }

  private updateMetrics(): void {
    // Update resource usage
    const memUsage = process.memoryUsage();
    this.metrics.resourceUsage.heapUsed = memUsage.heapUsed;
    this.metrics.resourceUsage.heapTotal = memUsage.heapTotal;
    this.metrics.resourceUsage.memoryUsage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    // Update error rate
    const totalRequests = this.requestCount;
    this.metrics.errorRate.count = this.errorCount;
    this.metrics.errorRate.percentage = totalRequests > 0 ? (this.errorCount / totalRequests) * 100 : 0;
    
    // Update cache metrics if available
    if (this.cacheService) {
      const cacheMetrics = this.cacheService.getMetrics();
      this.metrics.cache.hitRate = cacheMetrics.hitRate;
      this.metrics.cache.memoryUsage = cacheMetrics.memoryUsage;
      this.metrics.cache.redisConnections = cacheMetrics.redisConnections;
    }
  }

  private updateThroughputMetrics(): void {
    const now = Date.now();
    const elapsedMinutes = (now - this.startTime) / (1000 * 60);
    
    this.metrics.throughput.requestsPerMinute = this.requestCount / elapsedMinutes;
    this.metrics.throughput.requestsPerSecond = this.metrics.throughput.requestsPerMinute / 60;
  }

  private checkThresholds(): void {
    this.thresholds.forEach((threshold) => {
      const value = this.getMetricValue(threshold.metric);
      const alertId = `${threshold.metric}_${threshold.value}`;
      
      if (this.shouldTriggerAlert(threshold, value)) {
        if (!this.alerts.has(alertId)) {
          const alert: Alert = {
            id: alertId,
            metric: threshold.metric,
            value,
            threshold,
            timestamp: new Date(),
            resolved: false,
          };
          
          this.alerts.set(alertId, alert);
          this.emit('alert', alert);
          logger.warn(`Performance alert triggered: ${threshold.metric} = ${value} (threshold: ${threshold.value})`);
        }
      } else {
        // Check if alert should be resolved
        const existingAlert = this.alerts.get(alertId);
        if (existingAlert && !existingAlert.resolved) {
          existingAlert.resolved = true;
          existingAlert.resolvedAt = new Date();
          this.emit('alertResolved', existingAlert);
          logger.info(`Performance alert resolved: ${threshold.metric} = ${value}`);
        }
      }
    });
  }

  private shouldTriggerAlert(threshold: AlertThreshold, value: number): boolean {
    switch (threshold.operator) {
      case 'gt':
        return value > threshold.value;
      case 'lt':
        return value < threshold.value;
      case 'eq':
        return value === threshold.value;
      default:
        return false;
    }
  }

  private getMetricValue(metricPath: string): number {
    const parts = metricPath.split('.');
    let value: any = this.metrics;
    
    for (const part of parts) {
      value = value[part];
      if (value === undefined) return 0;
    }
    
    return typeof value === 'number' ? value : 0;
  }

  // Public API methods
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  addThreshold(threshold: AlertThreshold): void {
    this.thresholds.push(threshold);
  }

  removeThreshold(metric: string, value: number): void {
    this.thresholds = this.thresholds.filter(
      t => !(t.metric === metric && t.value === value)
    );
  }

  // Database performance tracking
  recordDatabaseQuery(duration: number, query: string): void {
    this.metrics.database.queryTime = (this.metrics.database.queryTime + duration) / 2;
    
    if (duration > 1000) { // Slow query threshold: 1 second
      this.metrics.database.slowQueries++;
      logger.warn(`Slow query detected: ${duration}ms - ${query.substring(0, 100)}...`);
    }
  }

  // Custom metric recording
  recordCustomMetric(name: string, value: number, tags?: Record<string, string>): void {
    logger.info(`Custom metric: ${name} = ${value}`, { tags });
    this.emit('customMetric', { name, value, tags, timestamp: new Date() });
  }

  // Health check endpoint data
  getHealthStatus(): any {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.threshold.severity === 'critical');
    
    return {
      status: criticalAlerts.length > 0 ? 'unhealthy' : 'healthy',
      timestamp: new Date(),
      metrics: this.getMetrics(),
      alerts: {
        total: activeAlerts.length,
        critical: criticalAlerts.length,
        high: activeAlerts.filter(a => a.threshold.severity === 'high').length,
        medium: activeAlerts.filter(a => a.threshold.severity === 'medium').length,
        low: activeAlerts.filter(a => a.threshold.severity === 'low').length,
      },
      uptime: Date.now() - this.startTime,
    };
  }

  // Cleanup
  shutdown(): void {
    this.observer.disconnect();
    this.removeAllListeners();
    logger.info('Performance monitoring service shutdown completed');
  }
}

// Performance tracking decorators
export function TrackPerformance(metricName?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const name = metricName || `${target.constructor.name}.${propertyName}`;
    
    descriptor.value = async function (...args: any[]) {
      const startTime = performance.now();
      
      try {
        const result = await method.apply(this, args);
        const duration = performance.now() - startTime;
        
        if (this.performanceMonitor) {
          this.performanceMonitor.recordCustomMetric(`${name}.duration`, duration);
          this.performanceMonitor.recordCustomMetric(`${name}.success`, 1);
        }
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        if (this.performanceMonitor) {
          this.performanceMonitor.recordCustomMetric(`${name}.duration`, duration);
          this.performanceMonitor.recordCustomMetric(`${name}.error`, 1);
        }
        
        throw error;
      }
    };
  };
}