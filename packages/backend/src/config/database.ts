import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Prisma Client Configuration
const prismaClientOptions = {
  log: [
    { level: 'query', emit: 'event' as const },
    { level: 'error', emit: 'event' as const },
    { level: 'info', emit: 'event' as const },
    { level: 'warn', emit: 'event' as const },
  ],
  errorFormat: 'pretty' as const,
};

// Create Prisma Client instance
export const prisma = new PrismaClient(prismaClientOptions);

// Prisma event listeners for logging
prisma.$on('query', (e) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Query executed', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
      timestamp: e.timestamp
    });
  }
});

prisma.$on('error', (e) => {
  logger.error('Prisma error occurred', {
    message: e.message,
    target: e.target,
    timestamp: e.timestamp
  });
});

prisma.$on('info', (e) => {
  logger.info('Prisma info', {
    message: e.message,
    target: e.target,
    timestamp: e.timestamp
  });
});

prisma.$on('warn', (e) => {
  logger.warn('Prisma warning', {
    message: e.message,
    target: e.target,
    timestamp: e.timestamp
  });
});

// Redis Client Configuration
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = createClient({
  url: redisUrl,
  retry_delay_on_failover: 100,
  retry_delay_on_cluster_down: 300,
  max_attempts: 3,
});

// Redis event listeners
redis.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('end', () => {
  logger.info('Redis client disconnected');
});

// Database connection utilities
export class DatabaseManager {
  private static instance: DatabaseManager;
  private isConnected = false;
  private connectionRetries = 0;
  private maxRetries = 5;
  private retryDelay = 5000; // 5 seconds

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize database connections with retry logic
   */
  public async connect(): Promise<void> {
    try {
      // Test Prisma connection
      await this.connectPrisma();
      
      // Connect Redis
      await this.connectRedis();
      
      this.isConnected = true;
      this.connectionRetries = 0;
      logger.info('Database connections established successfully');
      
    } catch (error) {
      logger.error('Failed to establish database connections', { error });
      await this.handleConnectionError();
    }
  }

  /**
   * Connect to PostgreSQL via Prisma
   */
  private async connectPrisma(): Promise<void> {
    try {
      await prisma.$connect();
      
      // Test the connection with a simple query
      await prisma.$queryRaw`SELECT 1`;
      
      logger.info('PostgreSQL connection established via Prisma');
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL', { error });
      throw new Error(`PostgreSQL connection failed: ${error}`);
    }
  }

  /**
   * Connect to Redis
   */
  private async connectRedis(): Promise<void> {
    try {
      if (!redis.isOpen) {
        await redis.connect();
      }
      
      // Test the connection
      await redis.ping();
      
      logger.info('Redis connection established');
    } catch (error) {
      logger.error('Failed to connect to Redis', { error });
      throw new Error(`Redis connection failed: ${error}`);
    }
  }

  /**
   * Handle connection errors with retry logic
   */
  private async handleConnectionError(): Promise<void> {
    this.connectionRetries++;
    
    if (this.connectionRetries >= this.maxRetries) {
      const errorMessage = `Failed to connect to databases after ${this.maxRetries} attempts`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    logger.warn(`Connection attempt ${this.connectionRetries} failed. Retrying in ${this.retryDelay}ms...`);
    
    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
    await this.connect();
  }

  /**
   * Gracefully disconnect from databases
   */
  public async disconnect(): Promise<void> {
    try {
      await prisma.$disconnect();
      logger.info('Prisma client disconnected');
    } catch (error) {
      logger.error('Error disconnecting Prisma client', { error });
    }

    try {
      if (redis.isOpen) {
        await redis.quit();
      }
      logger.info('Redis client disconnected');
    } catch (error) {
      logger.error('Error disconnecting Redis client', { error });
    }

    this.isConnected = false;
    logger.info('All database connections closed');
  }

  /**
   * Check if databases are connected
   */
  public async healthCheck(): Promise<{ postgres: boolean; redis: boolean }> {
    const health = {
      postgres: false,
      redis: false
    };

    // Check PostgreSQL
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.postgres = true;
    } catch (error) {
      logger.error('PostgreSQL health check failed', { error });
    }

    // Check Redis
    try {
      await redis.ping();
      health.redis = true;
    } catch (error) {
      logger.error('Redis health check failed', { error });
    }

    return health;
  }

  /**
   * Get connection status
   */
  public isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Execute database transaction with retry logic
   */
  public async executeTransaction<T>(
    operation: (tx: any) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await prisma.$transaction(operation, {
          maxWait: 5000, // 5 seconds
          timeout: 10000, // 10 seconds
        });
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Transaction attempt ${attempt} failed`, { 
          error: error instanceof Error ? error.message : error,
          attempt,
          maxRetries 
        });
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    
    logger.error('Transaction failed after all retries', { error: lastError });
    throw lastError!;
  }

  /**
   * Cache operations with Redis
   */
  public async cacheGet(key: string): Promise<string | null> {
    try {
      return await redis.get(key);
    } catch (error) {
      logger.error('Cache get operation failed', { key, error });
      return null;
    }
  }

  public async cacheSet(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds) {
        await redis.setEx(key, ttlSeconds, value);
      } else {
        await redis.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Cache set operation failed', { key, error });
      return false;
    }
  }

  public async cacheDel(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete operation failed', { key, error });
      return false;
    }
  }
}

// Export singleton instance
export const dbManager = DatabaseManager.getInstance();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, closing database connections...');
  await dbManager.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, closing database connections...');
  await dbManager.disconnect();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception occurred', { error });
  await dbManager.disconnect();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled rejection occurred', { reason, promise });
  await dbManager.disconnect();
  process.exit(1);
});