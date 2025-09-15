import Redis from 'ioredis';
import { LRUCache } from 'lru-cache';
import { performance } from 'perf_hooks';
import { logger } from '../utils/logger';

interface CacheConfig {
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
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
  memoryUsage: number;
  redisConnections: number;
}

export class AdvancedCacheService {
  private redis: Redis;
  private memoryCache: LRUCache<string, any>;
  private metrics: CacheMetrics;
  private config: CacheConfig;

  // Implements multi-level caching with Redis and in-memory layers

  constructor(config: CacheConfig) {
    this.config = config;
    this.initializeRedis();
    this.initializeMemoryCache();
    this.initializeMetrics();
  }

  private initializeRedis(): void {
    this.redis = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
    });

    this.redis.on('connect', () => {
      logger.info('Redis cache connected successfully');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis cache error:', error);
    });
  }

  private initializeMemoryCache(): void {
    this.memoryCache = new LRUCache({
      max: this.config.memory.maxSize,
      ttl: this.config.memory.ttl,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });
  }

  private initializeMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
      redisConnections: 0,
    };
  }

  // Multi-level caching strategy with intelligent cache warming
  async get<T>(key: string, options?: { skipMemory?: boolean; skipRedis?: boolean }): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      // Level 1: Memory cache
      if (!options?.skipMemory) {
        const memoryResult = this.memoryCache.get(key);
        if (memoryResult !== undefined) {
          this.recordHit(performance.now() - startTime);
          return memoryResult as T;
        }
      }

      // Level 2: Redis cache
      if (!options?.skipRedis) {
        const redisResult = await this.redis.get(key);
        if (redisResult) {
          const parsed = JSON.parse(redisResult) as T;
          // Populate memory cache for faster future access
          this.memoryCache.set(key, parsed);
          this.recordHit(performance.now() - startTime);
          return parsed;
        }
      }

      this.recordMiss(performance.now() - startTime);
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      this.recordMiss(performance.now() - startTime);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      // Write-through strategy: Write to both caches simultaneously
      if (this.config.strategies.writeThrough) {
        await Promise.all([
          this.setMemoryCache(key, value),
          this.setRedisCache(key, value, ttl),
        ]);
      } else {
        // Write-back strategy: Write to memory first, Redis later
        this.setMemoryCache(key, value);
        if (this.config.strategies.writeBack) {
          // Async write to Redis
          setImmediate(() => this.setRedisCache(key, value, ttl));
        }
      }
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  private setMemoryCache<T>(key: string, value: T): void {
    this.memoryCache.set(key, value);
  }

  private async setRedisCache<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  // Intelligent cache warming
  async warmCache(keys: string[], dataLoader: (key: string) => Promise<any>): Promise<void> {
    logger.info(`Warming cache for ${keys.length} keys`);
    
    const batchSize = 10;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (key) => {
          try {
            const data = await dataLoader(key);
            await this.set(key, data);
          } catch (error) {
            logger.error(`Failed to warm cache for key ${key}:`, error);
          }
        })
      );
    }
  }

  // Cache invalidation patterns
  async invalidate(pattern: string): Promise<number> {
    try {
      // Invalidate memory cache
      let memoryInvalidated = 0;
      for (const key of this.memoryCache.keys()) {
        if (this.matchesPattern(key, pattern)) {
          this.memoryCache.delete(key);
          memoryInvalidated++;
        }
      }

      // Invalidate Redis cache
      const redisKeys = await this.redis.keys(pattern);
      let redisInvalidated = 0;
      if (redisKeys.length > 0) {
        redisInvalidated = await this.redis.del(...redisKeys);
      }

      logger.info(`Invalidated ${memoryInvalidated} memory keys and ${redisInvalidated} Redis keys`);
      return memoryInvalidated + redisInvalidated;
    } catch (error) {
      logger.error('Cache invalidation error:', error);
      return 0;
    }
  }

  // Smart cache preloading based on usage patterns
  async preloadPopularData(): Promise<void> {
    try {
      // Get most accessed keys from Redis
      const popularKeys = await this.getPopularKeys();
      
      // Preload into memory cache
      for (const key of popularKeys) {
        const value = await this.redis.get(key);
        if (value) {
          this.memoryCache.set(key, JSON.parse(value));
        }
      }
      
      logger.info(`Preloaded ${popularKeys.length} popular keys into memory cache`);
    } catch (error) {
      logger.error('Cache preload error:', error);
    }
  }

  private async getPopularKeys(): Promise<string[]> {
    // This would typically use Redis analytics or custom tracking
    // For now, return commonly accessed patterns
    return [
      'vessels:*',
      'users:*',
      'requisitions:active:*',
      'vendors:top:*',
      'analytics:dashboard:*'
    ];
  }

  private matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(key);
  }

  private recordHit(responseTime: number): void {
    this.metrics.hits++;
    this.updateMetrics(responseTime);
  }

  private recordMiss(responseTime: number): void {
    this.metrics.misses++;
    this.updateMetrics(responseTime);
  }

  private updateMetrics(responseTime: number): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = (this.metrics.hits / total) * 100;
    this.metrics.avgResponseTime = (this.metrics.avgResponseTime + responseTime) / 2;
    this.metrics.memoryUsage = this.memoryCache.size;
  }

  // Cache analytics and monitoring
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  async getDetailedMetrics(): Promise<any> {
    try {
      const redisInfo = await this.redis.info('memory');
      const redisStats = await this.redis.info('stats');
      
      return {
        ...this.metrics,
        redis: {
          memoryUsage: this.parseRedisInfo(redisInfo, 'used_memory'),
          connections: this.parseRedisInfo(redisStats, 'connected_clients'),
          commandsProcessed: this.parseRedisInfo(redisStats, 'total_commands_processed'),
        },
        memory: {
          size: this.memoryCache.size,
          maxSize: this.memoryCache.max,
          utilization: (this.memoryCache.size / this.memoryCache.max!) * 100,
        },
      };
    } catch (error) {
      logger.error('Error getting detailed metrics:', error);
      return this.metrics;
    }
  }

  private parseRedisInfo(info: string, key: string): number {
    const match = info.match(new RegExp(`${key}:(\\d+)`));
    return match ? parseInt(match[1], 10) : 0;
  }

  // Cleanup and shutdown
  async shutdown(): Promise<void> {
    try {
      this.memoryCache.clear();
      await this.redis.quit();
      logger.info('Cache service shutdown completed');
    } catch (error) {
      logger.error('Cache shutdown error:', error);
    }
  }
}

// Cache decorators for automatic caching
export function Cacheable(ttl: number = 300, keyGenerator?: (args: any[]) => string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheKey = keyGenerator ? keyGenerator(args) : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      // Try to get from cache first
      const cached = await this.cacheService?.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
      
      // Execute method and cache result
      const result = await method.apply(this, args);
      await this.cacheService?.set(cacheKey, result, ttl);
      
      return result;
    };
  };
}

export function CacheInvalidate(pattern: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);
      
      // Invalidate cache after successful operation
      await this.cacheService?.invalidate(pattern);
      
      return result;
    };
  };
}