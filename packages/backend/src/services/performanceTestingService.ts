import { performance } from 'perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { PerformanceMonitoringService } from './performanceMonitoringService';

interface LoadTestConfig {
  targetUrl: string;
  concurrency: number;
  duration: number; // seconds
  rampUpTime: number; // seconds
  requestsPerSecond?: number;
  scenarios: TestScenario[];
}

interface TestScenario {
  name: string;
  weight: number; // percentage of total requests
  requests: TestRequest[];
}

interface TestRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  headers?: Record<string, string>;
  body?: any;
  expectedStatusCode?: number;
  timeout?: number;
}

interface LoadTestResult {
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    maxResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    duration: number;
  };
  errors: Array<{
    type: string;
    message: string;
    count: number;
  }>;
  responseTimeDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  statusCodeDistribution: Record<number, number>;
}

interface PerformanceOptimizationRule {
  name: string;
  condition: (metrics: any) => boolean;
  action: (metrics: any) => Promise<void>;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export class PerformanceTestingService extends EventEmitter {
  private performanceMonitor: PerformanceMonitoringService;
  private optimizationRules: PerformanceOptimizationRule[] = [];
  private activeTests: Map<string, any> = new Map();

  constructor(performanceMonitor: PerformanceMonitoringService) {
    super();
    this.performanceMonitor = performanceMonitor;
    this.setupDefaultOptimizationRules();
  }

  // Load testing functionality
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const testId = `test_${Date.now()}`;
    logger.info(`Starting load test: ${testId}`);
    
    try {
      this.activeTests.set(testId, { status: 'running', startTime: Date.now() });
      this.emit('testStarted', { testId, config });

      const result = await this.executeLoadTest(config);
      
      this.activeTests.set(testId, { status: 'completed', result });
      this.emit('testCompleted', { testId, result });
      
      logger.info(`Load test completed: ${testId}`);
      return result;
    } catch (error) {
      this.activeTests.set(testId, { status: 'failed', error: error.message });
      this.emit('testFailed', { testId, error });
      logger.error(`Load test failed: ${testId}`, error);
      throw error;
    }
  }

  private async executeLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const workers: Worker[] = [];
    const results: any[] = [];
    const workerCount = Math.min(config.concurrency, 10); // Limit worker count
    
    try {
      // Create worker threads for concurrent testing
      for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(__filename, {
          workerData: {
            config,
            workerId: i,
            isWorker: true,
          },
        });

        worker.on('message', (result) => {
          results.push(result);
        });

        workers.push(worker);
      }

      // Wait for all workers to complete
      await Promise.all(
        workers.map(worker => new Promise((resolve) => {
          worker.on('exit', resolve);
        }))
      );

      // Aggregate results
      return this.aggregateTestResults(results);
    } finally {
      // Clean up workers
      workers.forEach(worker => worker.terminate());
    }
  }

  private aggregateTestResults(results: any[]): LoadTestResult {
    const allResponses = results.flatMap(r => r.responses);
    const allErrors = results.flatMap(r => r.errors);
    
    if (allResponses.length === 0) {
      throw new Error('No responses recorded during load test');
    }

    const responseTimes = allResponses.map(r => r.responseTime);
    const sortedResponseTimes = responseTimes.sort((a, b) => a - b);
    
    const successfulRequests = allResponses.filter(r => r.success).length;
    const totalRequests = allResponses.length;
    
    const summary = {
      totalRequests,
      successfulRequests,
      failedRequests: totalRequests - successfulRequests,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p50ResponseTime: this.getPercentile(sortedResponseTimes, 0.5),
      p95ResponseTime: this.getPercentile(sortedResponseTimes, 0.95),
      p99ResponseTime: this.getPercentile(sortedResponseTimes, 0.99),
      maxResponseTime: Math.max(...responseTimes),
      requestsPerSecond: totalRequests / (Math.max(...allResponses.map(r => r.timestamp)) - Math.min(...allResponses.map(r => r.timestamp))) * 1000,
      errorRate: ((totalRequests - successfulRequests) / totalRequests) * 100,
      duration: Math.max(...allResponses.map(r => r.timestamp)) - Math.min(...allResponses.map(r => r.timestamp)),
    };

    const errorCounts = allErrors.reduce((acc, error) => {
      const key = `${error.type}: ${error.message}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errors = Object.entries(errorCounts).map(([key, count]) => {
      const [type, message] = key.split(': ');
      return { type, message, count };
    });

    const responseTimeDistribution = this.calculateResponseTimeDistribution(responseTimes);
    const statusCodeDistribution = allResponses.reduce((acc, response) => {
      acc[response.statusCode] = (acc[response.statusCode] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return {
      summary,
      errors,
      responseTimeDistribution,
      statusCodeDistribution,
    };
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[index] || 0;
  }

  private calculateResponseTimeDistribution(responseTimes: number[]): Array<{range: string; count: number; percentage: number}> {
    const ranges = [
      { min: 0, max: 100, label: '0-100ms' },
      { min: 100, max: 500, label: '100-500ms' },
      { min: 500, max: 1000, label: '500ms-1s' },
      { min: 1000, max: 2000, label: '1-2s' },
      { min: 2000, max: 5000, label: '2-5s' },
      { min: 5000, max: Infinity, label: '5s+' },
    ];

    const total = responseTimes.length;
    
    return ranges.map(range => {
      const count = responseTimes.filter(time => time >= range.min && time < range.max).length;
      return {
        range: range.label,
        count,
        percentage: (count / total) * 100,
      };
    });
  }

  // Automated performance optimization
  private setupDefaultOptimizationRules(): void {
    this.optimizationRules = [
      {
        name: 'High Response Time Optimization',
        condition: (metrics) => metrics.responseTime.p95 > 2000,
        action: async (metrics) => {
          logger.warn('High response time detected, triggering optimization');
          await this.optimizeResponseTime(metrics);
        },
        priority: 'high',
      },
      {
        name: 'High Error Rate Optimization',
        condition: (metrics) => metrics.errorRate.percentage > 5,
        action: async (metrics) => {
          logger.warn('High error rate detected, triggering optimization');
          await this.optimizeErrorRate(metrics);
        },
        priority: 'critical',
      },
      {
        name: 'Memory Usage Optimization',
        condition: (metrics) => metrics.resourceUsage.memoryUsage > 85,
        action: async (metrics) => {
          logger.warn('High memory usage detected, triggering optimization');
          await this.optimizeMemoryUsage(metrics);
        },
        priority: 'medium',
      },
      {
        name: 'Cache Hit Rate Optimization',
        condition: (metrics) => metrics.cache.hitRate < 70,
        action: async (metrics) => {
          logger.info('Low cache hit rate detected, optimizing cache strategy');
          await this.optimizeCacheStrategy(metrics);
        },
        priority: 'medium',
      },
    ];
  }

  async runAutomaticOptimization(): Promise<void> {
    const metrics = this.performanceMonitor.getMetrics();
    
    // Sort rules by priority
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const sortedRules = this.optimizationRules.sort(
      (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]
    );

    for (const rule of sortedRules) {
      if (rule.condition(metrics)) {
        try {
          logger.info(`Applying optimization rule: ${rule.name}`);
          await rule.action(metrics);
          this.emit('optimizationApplied', { rule: rule.name, metrics });
        } catch (error) {
          logger.error(`Failed to apply optimization rule ${rule.name}:`, error);
          this.emit('optimizationFailed', { rule: rule.name, error });
        }
      }
    }
  }

  private async optimizeResponseTime(metrics: any): Promise<void> {
    // Implement response time optimization strategies
    const optimizations = [
      'Enable response compression',
      'Optimize database queries',
      'Implement connection pooling',
      'Add caching layers',
      'Optimize static asset delivery',
    ];

    logger.info('Applying response time optimizations:', optimizations);
    
    // This would trigger actual optimization implementations
    // For now, we'll just log the actions
  }

  private async optimizeErrorRate(metrics: any): Promise<void> {
    // Implement error rate optimization strategies
    const optimizations = [
      'Increase timeout values',
      'Implement circuit breakers',
      'Add retry mechanisms',
      'Scale up resources',
      'Review error handling',
    ];

    logger.info('Applying error rate optimizations:', optimizations);
  }

  private async optimizeMemoryUsage(metrics: any): Promise<void> {
    // Implement memory optimization strategies
    const optimizations = [
      'Trigger garbage collection',
      'Clear unused caches',
      'Optimize object pooling',
      'Review memory leaks',
      'Scale horizontally',
    ];

    logger.info('Applying memory usage optimizations:', optimizations);
  }

  private async optimizeCacheStrategy(metrics: any): Promise<void> {
    // Implement cache optimization strategies
    const optimizations = [
      'Warm up cache with popular data',
      'Adjust cache TTL values',
      'Implement cache preloading',
      'Review cache invalidation strategy',
      'Optimize cache key patterns',
    ];

    logger.info('Applying cache strategy optimizations:', optimizations);
  }

  // Continuous performance testing
  async startContinuousPerformanceTesting(config: {
    interval: number; // minutes
    testConfig: LoadTestConfig;
    thresholds: {
      responseTime: number;
      errorRate: number;
      throughput: number;
    };
  }): Promise<void> {
    logger.info('Starting continuous performance testing');
    
    const runTest = async () => {
      try {
        const result = await this.runLoadTest(config.testConfig);
        
        // Check if performance has degraded
        if (this.hasPerformanceDegraded(result, config.thresholds)) {
          logger.warn('Performance degradation detected');
          this.emit('performanceDegradation', { result, thresholds: config.thresholds });
          
          // Trigger automatic optimization
          await this.runAutomaticOptimization();
        }
        
        // Store results for trend analysis
        this.storeTestResult(result);
        
      } catch (error) {
        logger.error('Continuous performance test failed:', error);
      }
    };

    // Run initial test
    await runTest();
    
    // Schedule recurring tests
    setInterval(runTest, config.interval * 60 * 1000);
  }

  private hasPerformanceDegraded(result: LoadTestResult, thresholds: any): boolean {
    return (
      result.summary.p95ResponseTime > thresholds.responseTime ||
      result.summary.errorRate > thresholds.errorRate ||
      result.summary.requestsPerSecond < thresholds.throughput
    );
  }

  private storeTestResult(result: LoadTestResult): void {
    // Store results for historical analysis
    // This would typically go to a time-series database
    logger.info('Storing performance test result', {
      timestamp: new Date(),
      summary: result.summary,
    });
  }

  // Performance benchmarking
  async runPerformanceBenchmark(scenarios: string[]): Promise<any> {
    const benchmarkResults: any = {};
    
    for (const scenario of scenarios) {
      logger.info(`Running benchmark scenario: ${scenario}`);
      
      const config = this.getBenchmarkConfig(scenario);
      const result = await this.runLoadTest(config);
      
      benchmarkResults[scenario] = {
        responseTime: result.summary.p95ResponseTime,
        throughput: result.summary.requestsPerSecond,
        errorRate: result.summary.errorRate,
        timestamp: new Date(),
      };
    }
    
    return benchmarkResults;
  }

  private getBenchmarkConfig(scenario: string): LoadTestConfig {
    const baseConfig = {
      targetUrl: 'http://localhost:3000',
      concurrency: 10,
      duration: 60,
      rampUpTime: 10,
    };

    const scenarios: Record<string, Partial<LoadTestConfig>> = {
      'light-load': {
        ...baseConfig,
        concurrency: 5,
        scenarios: [
          {
            name: 'Basic API calls',
            weight: 100,
            requests: [
              { method: 'GET', path: '/api/health' },
              { method: 'GET', path: '/api/vessels' },
            ],
          },
        ],
      },
      'normal-load': {
        ...baseConfig,
        concurrency: 20,
        scenarios: [
          {
            name: 'Mixed operations',
            weight: 100,
            requests: [
              { method: 'GET', path: '/api/requisitions' },
              { method: 'POST', path: '/api/requisitions', body: { test: true } },
              { method: 'GET', path: '/api/vendors' },
            ],
          },
        ],
      },
      'heavy-load': {
        ...baseConfig,
        concurrency: 50,
        duration: 120,
        scenarios: [
          {
            name: 'High-intensity operations',
            weight: 100,
            requests: [
              { method: 'GET', path: '/api/analytics/dashboard' },
              { method: 'POST', path: '/api/reports/generate' },
              { method: 'GET', path: '/api/search' },
            ],
          },
        ],
      },
    };

    return { ...baseConfig, ...scenarios[scenario] } as LoadTestConfig;
  }

  // Public API methods
  getActiveTests(): any[] {
    return Array.from(this.activeTests.entries()).map(([id, test]) => ({
      id,
      ...test,
    }));
  }

  addOptimizationRule(rule: PerformanceOptimizationRule): void {
    this.optimizationRules.push(rule);
    logger.info(`Added optimization rule: ${rule.name}`);
  }

  removeOptimizationRule(name: string): void {
    this.optimizationRules = this.optimizationRules.filter(rule => rule.name !== name);
    logger.info(`Removed optimization rule: ${name}`);
  }

  // Cleanup
  shutdown(): void {
    this.activeTests.clear();
    this.removeAllListeners();
    logger.info('Performance testing service shutdown completed');
  }
}

// Worker thread code for load testing
if (!isMainThread && workerData?.isWorker) {
  const { config, workerId } = workerData;
  
  const runWorkerTest = async () => {
    const responses: any[] = [];
    const errors: any[] = [];
    const startTime = Date.now();
    const endTime = startTime + (config.duration * 1000);
    
    while (Date.now() < endTime) {
      for (const scenario of config.scenarios) {
        for (const request of scenario.requests) {
          try {
            const requestStart = performance.now();
            
            const response = await fetch(`${config.targetUrl}${request.path}`, {
              method: request.method,
              headers: request.headers,
              body: request.body ? JSON.stringify(request.body) : undefined,
              timeout: request.timeout || 30000,
            });
            
            const responseTime = performance.now() - requestStart;
            
            responses.push({
              timestamp: Date.now(),
              responseTime,
              statusCode: response.status,
              success: response.ok,
            });
            
          } catch (error) {
            errors.push({
              type: 'RequestError',
              message: error.message,
              timestamp: Date.now(),
            });
          }
        }
      }
      
      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    parentPort?.postMessage({ responses, errors, workerId });
  };
  
  runWorkerTest().catch(error => {
    parentPort?.postMessage({ 
      responses: [], 
      errors: [{ type: 'WorkerError', message: error.message }], 
      workerId 
    });
  });
}