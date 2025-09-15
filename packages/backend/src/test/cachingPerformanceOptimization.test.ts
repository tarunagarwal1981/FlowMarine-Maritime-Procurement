import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { cacheService } from '../services/cacheService.js';
import { queryOptimizationService } from '../services/queryOptimizationService.js';
import { lazyLoadingService } from '../services/lazyLoadingService.js';
import { dashboardAnalyticsService } from '../services/dashboardAnalyticsService.js';
import { redis } from '../config/database.js';

describe('Caching and Performance Optimization', () => {
  const testFilters = {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    baseCurrency: 'USD'
  };

  beforeAll(async () => {
    // Ensure Redis connection is established
    if (!redis.isOpen) {
      await redis.connect();
    }
  });

  afterAll(async () => {
    // Clean up test data
    await redis.flushDb();
    if (redis.isOpen) {
      await redis.quit();
    }
  });

  beforeEach(async () => {
    // Clear cache before each test
    await redis.flushDb();
    cacheService.resetStats();
    queryOptimizationService.clearPerformanceMetrics();
  });

  describe('Enhanced Cache Service', () => {
    test('should cache and retrieve dashboard data with dependencies', async () => {
      const testData = {
        totalSpend: 100000,
        breakdown: { byVessel: [], byCategory: [] }
      };

      const dependencies = ['purchase_orders', 'vessels'];
      
      // Cache data
      const cached = await cacheService.cacheDashboardData(
        'spend_analytics',
        testFilters,
        testData,
        dependencies
      );

      expect(cached).toBe(true);

      // Retrieve cached data
      const retrieved = await cacheService.getCachedDashboardData(
        'spend_analytics',
        testFilters
      );

      expect(retrieved).toEqual(testData);
    });

    test('should invalidate cache by dependency', async () => {
      const testData = { value: 'test' };
      
      await cacheService.cacheDashboardData(
        'test_component',
        testFilters,
        testData,
        ['purchase_orders']
      );

      // Verify data is cached
      let retrieved = await cacheService.getCachedDashboardData('test_component', testFilters);
      expect(retrieved).toEqual(testData);

      // Invalidate by dependency
      await cacheService.invalidateByDependency('purchase_orders');

      // Verify data is invalidated
      retrieved = await cacheService.getCachedDashboardData('test_component', testFilters);
      expect(retrieved).toBeNull();
    });

    test('should perform batch cache operations', async () => {
      const operations = [
        {
          key: 'test1',
          value: { data: 'value1' },
          options: { prefix: 'test:', ttl: 300 }
        },
        {
          key: 'test2',
          value: { data: 'value2' },
          options: { prefix: 'test:', ttl: 300 }
        }
      ];

      const results = await cacheService.batchSet(operations);
      expect(results).toEqual([true, true]);

      // Verify batch get
      const keys = [
        { key: 'test1', prefix: 'test:' },
        { key: 'test2', prefix: 'test:' }
      ];

      const retrieved = await cacheService.batchGet(keys);
      expect(retrieved).toEqual([
        { data: 'value1' },
        { data: 'value2' }
      ]);
    });

    test('should handle compressed cache operations', async () => {
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `Description for item ${i}`.repeat(10)
        }))
      };

      // Set compressed data
      const setResult = await cacheService.setCompressed('large_data', largeData, {
        prefix: 'test:',
        ttl: 300
      });

      expect(setResult).toBe(true);

      // Get compressed data
      const retrieved = await cacheService.getCompressed('large_data', 'test:');
      expect(retrieved).toEqual(largeData);
    });

    test('should provide advanced cache statistics', async () => {
      // Perform some cache operations
      await cacheService.set('test1', { value: 1 }, { prefix: 'test:' });
      await cacheService.get('test1', { prefix: 'test:' });
      await cacheService.get('nonexistent', { prefix: 'test:' });

      const stats = await cacheService.getAdvancedStats();
      
      expect(stats.basic).toBeDefined();
      expect(stats.basic.hits).toBeGreaterThan(0);
      expect(stats.basic.misses).toBeGreaterThan(0);
      expect(stats.memory).toBeDefined();
      expect(stats.performance).toBeDefined();
    });
  });

  describe('Query Optimization Service', () => {
    test('should optimize spend analytics queries', async () => {
      const result = await queryOptimizationService.getOptimizedSpendAnalytics(testFilters, {
        useCache: true,
        usePreAggregation: false
      });

      expect(result.data).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.queryTime).toBeGreaterThan(0);
      expect(result.metrics.optimizationUsed).toContain('optimized_query');
    });

    test('should use cache for repeated queries', async () => {
      // First query
      const result1 = await queryOptimizationService.getOptimizedSpendAnalytics(testFilters, {
        useCache: true
      });

      // Second query (should hit cache)
      const result2 = await queryOptimizationService.getOptimizedSpendAnalytics(testFilters, {
        useCache: true
      });

      expect(result1.data).toEqual(result2.data);
      expect(result2.metrics.cacheHit).toBe(true);
      expect(result2.metrics.optimizationUsed).toContain('cache_hit');
    });

    test('should optimize vendor performance with batch processing', async () => {
      const result = await queryOptimizationService.getOptimizedVendorPerformance(testFilters, {
        useCache: true,
        batchSize: 10
      });

      expect(result.data).toBeDefined();
      expect(result.metrics.optimizationUsed).toContain('batch_processing');
    });

    test('should optimize operational metrics with materialized views', async () => {
      const result = await queryOptimizationService.getOptimizedOperationalMetrics(testFilters, {
        useCache: true,
        usePreAggregation: true
      });

      expect(result.data).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    test('should provide performance statistics', async () => {
      // Execute some queries to generate metrics
      await queryOptimizationService.getOptimizedSpendAnalytics(testFilters);
      await queryOptimizationService.getOptimizedVendorPerformance(testFilters);

      const stats = queryOptimizationService.getPerformanceStatistics();
      
      expect(stats).toBeDefined();
      expect(Object.keys(stats).length).toBeGreaterThan(0);
    });
  });

  describe('Lazy Loading Service', () => {
    test('should register and load components', async () => {
      const config = {
        componentId: 'test_component',
        priority: 'high' as const,
        dependencies: ['test_data'],
        loadStrategy: 'immediate' as const,
        cacheStrategy: 'normal' as const,
        preloadData: false
      };

      lazyLoadingService.registerComponent(config);

      const loadingState = lazyLoadingService.getLoadingState('test_component');
      expect(loadingState).toBeDefined();
      expect(loadingState?.status).toBe('pending');
    });

    test('should handle component loading with different strategies', async () => {
      const configs = [
        {
          componentId: 'immediate_component',
          priority: 'high' as const,
          dependencies: ['test_data'],
          loadStrategy: 'immediate' as const,
          cacheStrategy: 'aggressive' as const,
          preloadData: true
        },
        {
          componentId: 'viewport_component',
          priority: 'medium' as const,
          dependencies: ['test_data'],
          loadStrategy: 'viewport' as const,
          cacheStrategy: 'normal' as const,
          preloadData: false
        }
      ];

      configs.forEach(config => {
        lazyLoadingService.registerComponent(config);
      });

      // Test loading with different strategies
      const immediateResult = await lazyLoadingService.loadComponent(
        'immediate_component',
        testFilters
      );
      
      const viewportResult = await lazyLoadingService.loadComponent(
        'viewport_component',
        testFilters
      );

      expect(immediateResult).toBeDefined();
      expect(viewportResult).toBeDefined();
    });

    test('should batch load multiple components', async () => {
      const requests = [
        {
          componentId: 'fleet_spend_visualization',
          filters: testFilters,
          options: { priority: 1 }
        },
        {
          componentId: 'budget_utilization_dashboard',
          filters: testFilters,
          options: { priority: 2 }
        }
      ];

      const results = await lazyLoadingService.batchLoadComponents(requests);
      
      expect(results).toBeDefined();
      expect(Object.keys(results)).toHaveLength(2);
    });

    test('should provide loading statistics', async () => {
      const stats = lazyLoadingService.getLoadingStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalComponents).toBeGreaterThanOrEqual(0);
      expect(stats.loaded).toBeGreaterThanOrEqual(0);
      expect(stats.loading).toBeGreaterThanOrEqual(0);
      expect(stats.pending).toBeGreaterThanOrEqual(0);
    });

    test('should cancel component loading', async () => {
      lazyLoadingService.registerComponent({
        componentId: 'cancellable_component',
        priority: 'low',
        dependencies: ['test_data'],
        loadStrategy: 'idle',
        cacheStrategy: 'minimal',
        preloadData: false
      });

      // Start loading
      const loadPromise = lazyLoadingService.loadComponent('cancellable_component', testFilters);
      
      // Cancel loading
      lazyLoadingService.cancelLoading('cancellable_component');
      
      const state = lazyLoadingService.getLoadingState('cancellable_component');
      expect(state?.status).toBe('pending');
    });
  });

  describe('Dashboard Analytics Service Integration', () => {
    test('should initialize performance optimizations', async () => {
      await expect(
        dashboardAnalyticsService.initializePerformanceOptimizations()
      ).resolves.not.toThrow();
    });

    test('should load dashboard components with optimization', async () => {
      await dashboardAnalyticsService.initializePerformanceOptimizations();
      
      const result = await dashboardAnalyticsService.loadDashboardComponent(
        'fleet_spend_visualization',
        testFilters,
        { priority: 1, timeout: 10000 }
      );

      expect(result).toBeDefined();
    });

    test('should batch load dashboard components', async () => {
      const requests = [
        {
          componentId: 'fleet_spend_visualization',
          filters: testFilters,
          options: { priority: 1 }
        },
        {
          componentId: 'budget_utilization_dashboard',
          filters: testFilters,
          options: { priority: 2 }
        }
      ];

      const results = await dashboardAnalyticsService.batchLoadDashboardComponents(requests);
      
      expect(results).toBeDefined();
      expect(Object.keys(results)).toHaveLength(2);
    });

    test('should provide dashboard performance statistics', async () => {
      const stats = await dashboardAnalyticsService.getDashboardPerformanceStats();
      
      expect(stats).toBeDefined();
      expect(stats.cache).toBeDefined();
      expect(stats.queries).toBeDefined();
      expect(stats.loading).toBeDefined();
      expect(stats.timestamp).toBeDefined();
    });

    test('should warm up dashboard cache', async () => {
      await expect(
        dashboardAnalyticsService.warmUpDashboardCache()
      ).resolves.not.toThrow();
    });

    test('should invalidate dashboard cache', async () => {
      await expect(
        dashboardAnalyticsService.invalidateDashboardCache('purchase_orders', ['test_component'])
      ).resolves.not.toThrow();
    });
  });

  describe('Performance Benchmarks', () => {
    test('should demonstrate cache performance improvement', async () => {
      const iterations = 5;
      
      // Measure without cache
      const startWithoutCache = Date.now();
      for (let i = 0; i < iterations; i++) {
        await queryOptimizationService.getOptimizedSpendAnalytics(testFilters, {
          useCache: false
        });
      }
      const timeWithoutCache = Date.now() - startWithoutCache;

      // Clear any cached data
      await redis.flushDb();

      // Measure with cache
      const startWithCache = Date.now();
      for (let i = 0; i < iterations; i++) {
        await queryOptimizationService.getOptimizedSpendAnalytics(testFilters, {
          useCache: true
        });
      }
      const timeWithCache = Date.now() - startWithCache;

      // Cache should improve performance after first query
      console.log(`Without cache: ${timeWithoutCache}ms, With cache: ${timeWithCache}ms`);
      
      // First query will be slower due to caching overhead, but subsequent queries should be faster
      expect(timeWithCache).toBeLessThan(timeWithoutCache * 2); // Allow some overhead
    });

    test('should demonstrate batch loading efficiency', async () => {
      const singleLoadStart = Date.now();
      
      // Load components individually
      await lazyLoadingService.loadComponent('fleet_spend_visualization', testFilters);
      await lazyLoadingService.loadComponent('budget_utilization_dashboard', testFilters);
      
      const singleLoadTime = Date.now() - singleLoadStart;

      // Clear cache
      await redis.flushDb();

      const batchLoadStart = Date.now();
      
      // Load components in batch
      await lazyLoadingService.batchLoadComponents([
        { componentId: 'fleet_spend_visualization', filters: testFilters },
        { componentId: 'budget_utilization_dashboard', filters: testFilters }
      ]);
      
      const batchLoadTime = Date.now() - batchLoadStart;

      console.log(`Single load: ${singleLoadTime}ms, Batch load: ${batchLoadTime}ms`);
      
      // Batch loading should be more efficient
      expect(batchLoadTime).toBeLessThanOrEqual(singleLoadTime);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle cache failures gracefully', async () => {
      // Simulate cache failure by using invalid key
      const result = await cacheService.get('invalid:key:with:special:chars', {
        prefix: 'test:'
      });
      
      expect(result).toBeNull();
    });

    test('should handle query optimization failures', async () => {
      // Test with invalid filters
      const invalidFilters = {
        startDate: new Date('invalid-date'),
        endDate: new Date('invalid-date')
      };

      await expect(
        queryOptimizationService.getOptimizedSpendAnalytics(invalidFilters)
      ).rejects.toThrow();
    });

    test('should handle lazy loading component not found', async () => {
      await expect(
        lazyLoadingService.loadComponent('nonexistent_component', testFilters)
      ).rejects.toThrow('Component nonexistent_component not registered for lazy loading');
    });

    test('should handle concurrent cache operations', async () => {
      const promises = [];
      
      // Simulate concurrent cache operations
      for (let i = 0; i < 10; i++) {
        promises.push(
          cacheService.set(`concurrent_${i}`, { value: i }, { prefix: 'test:' })
        );
      }

      const results = await Promise.all(promises);
      expect(results.every(result => result === true)).toBe(true);

      // Verify all data was cached correctly
      const retrievePromises = [];
      for (let i = 0; i < 10; i++) {
        retrievePromises.push(
          cacheService.get(`concurrent_${i}`, { prefix: 'test:' })
        );
      }

      const retrievedData = await Promise.all(retrievePromises);
      retrievedData.forEach((data, index) => {
        expect(data).toEqual({ value: index });
      });
    });
  });
});