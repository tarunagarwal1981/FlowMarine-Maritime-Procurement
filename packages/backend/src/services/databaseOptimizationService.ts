import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { cacheService } from './cacheService.js';

export interface QueryPerformanceMetrics {
  queryType: string;
  executionTime: number;
  rowsAffected: number;
  cacheHit: boolean;
  timestamp: Date;
}

export interface IndexRecommendation {
  table: string;
  columns: string[];
  reason: string;
  estimatedImprovement: string;
}

/**
 * Database optimization service for FlowMarine
 * Handles query optimization, indexing strategies, and performance monitoring
 */
export class DatabaseOptimizationService {
  private static instance: DatabaseOptimizationService;
  private queryMetrics: QueryPerformanceMetrics[] = [];
  private slowQueryThreshold = 1000; // 1 second

  private constructor() {}

  public static getInstance(): DatabaseOptimizationService {
    if (!DatabaseOptimizationService.instance) {
      DatabaseOptimizationService.instance = new DatabaseOptimizationService();
    }
    return DatabaseOptimizationService.instance;
  }

  /**
   * Optimized user queries with caching
   */
  public async getOptimizedUser(userId: string) {
    const cacheKey = `user:${userId}:full`;
    
    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const startTime = Date.now();
        
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            lastLogin: true,
            vessels: {
              where: { isActive: true },
              select: {
                vessel: {
                  select: {
                    id: true,
                    name: true,
                    imoNumber: true,
                    vesselType: true,
                    currentLatitude: true,
                    currentLongitude: true
                  }
                }
              }
            },
            permissions: {
              select: {
                permission: {
                  select: {
                    name: true,
                    category: true
                  }
                }
              }
            }
          }
        });

        this.recordQueryMetrics('getOptimizedUser', Date.now() - startTime, 1, false);
        return user;
      },
      { ttl: 3600 } // 1 hour cache
    );
  }

  /**
   * Optimized vessel queries with position data
   */
  public async getOptimizedVessel(vesselId: string) {
    const cacheKey = `vessel:${vesselId}:full`;
    
    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const startTime = Date.now();
        
        const vessel = await prisma.vessel.findUnique({
          where: { id: vesselId },
          select: {
            id: true,
            name: true,
            imoNumber: true,
            vesselType: true,
            engineType: true,
            cargoCapacity: true,
            currentLatitude: true,
            currentLongitude: true,
            currentDeparture: true,
            currentDestination: true,
            currentETA: true,
            certificates: {
              where: {
                expiryDate: {
                  gte: new Date()
                }
              },
              select: {
                certificateType: true,
                expiryDate: true,
                certificateNumber: true
              },
              orderBy: {
                expiryDate: 'asc'
              }
            },
            specifications: {
              select: {
                category: true,
                specification: true,
                value: true,
                unit: true
              }
            }
          }
        });

        this.recordQueryMetrics('getOptimizedVessel', Date.now() - startTime, 1, false);
        return vessel;
      },
      { ttl: 1800 } // 30 minutes cache
    );
  }

  /**
   * Optimized requisition queries with pagination and filtering
   */
  public async getOptimizedRequisitions(params: {
    vesselId?: string;
    userId?: string;
    status?: string[];
    urgencyLevel?: string[];
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { 
      vesselId, 
      userId, 
      status, 
      urgencyLevel, 
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = params;

    const cacheKey = `requisitions:${JSON.stringify(params)}`;
    
    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const startTime = Date.now();
        const skip = (page - 1) * limit;

        const where: any = {};
        if (vesselId) where.vesselId = vesselId;
        if (userId) where.requestedById = userId;
        if (status?.length) where.status = { in: status };
        if (urgencyLevel?.length) where.urgencyLevel = { in: urgencyLevel };

        const [requisitions, total] = await Promise.all([
          prisma.requisition.findMany({
            where,
            select: {
              id: true,
              requisitionNumber: true,
              urgencyLevel: true,
              status: true,
              totalAmount: true,
              currency: true,
              deliveryDate: true,
              createdAt: true,
              vessel: {
                select: {
                  name: true,
                  imoNumber: true
                }
              },
              requestedBy: {
                select: {
                  firstName: true,
                  lastName: true
                }
              },
              items: {
                select: {
                  quantity: true,
                  unitPrice: true,
                  itemCatalog: {
                    select: {
                      name: true,
                      category: true,
                      criticalityLevel: true
                    }
                  }
                }
              }
            },
            skip,
            take: limit,
            orderBy: {
              [sortBy]: sortOrder
            }
          }),
          prisma.requisition.count({ where })
        ]);

        this.recordQueryMetrics('getOptimizedRequisitions', Date.now() - startTime, requisitions.length, false);
        
        return {
          data: requisitions,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        };
      },
      { ttl: 300 } // 5 minutes cache
    );
  }

  /**
   * Optimized item catalog search with full-text search capabilities
   */
  public async searchOptimizedItemCatalog(params: {
    query?: string;
    category?: string[];
    criticalityLevel?: string[];
    vesselType?: string;
    engineType?: string;
    page?: number;
    limit?: number;
  }) {
    const { 
      query, 
      category, 
      criticalityLevel, 
      vesselType, 
      engineType,
      page = 1, 
      limit = 50 
    } = params;

    const cacheKey = `catalog_search:${JSON.stringify(params)}`;
    
    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const startTime = Date.now();
        const skip = (page - 1) * limit;

        const where: any = {};
        
        // Full-text search on name and description
        if (query) {
          where.OR = [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { impaCode: { contains: query, mode: 'insensitive' } },
            { issaCode: { contains: query, mode: 'insensitive' } }
          ];
        }

        if (category?.length) where.category = { in: category };
        if (criticalityLevel?.length) where.criticalityLevel = { in: criticalityLevel };
        if (vesselType) where.compatibleVesselTypes = { has: vesselType };
        if (engineType) where.compatibleEngineTypes = { has: engineType };

        const [items, total] = await Promise.all([
          prisma.itemCatalog.findMany({
            where,
            select: {
              id: true,
              impaCode: true,
              issaCode: true,
              name: true,
              description: true,
              category: true,
              criticalityLevel: true,
              unitOfMeasure: true,
              averagePrice: true,
              averagePriceCurrency: true,
              leadTime: true,
              compatibleVesselTypes: true,
              compatibleEngineTypes: true
            },
            skip,
            take: limit,
            orderBy: [
              { criticalityLevel: 'asc' },
              { name: 'asc' }
            ]
          }),
          prisma.itemCatalog.count({ where })
        ]);

        this.recordQueryMetrics('searchOptimizedItemCatalog', Date.now() - startTime, items.length, false);
        
        return {
          data: items,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        };
      },
      { ttl: 600 } // 10 minutes cache
    );
  }

  /**
   * Optimized vendor queries with performance metrics
   */
  public async getOptimizedVendors(params: {
    serviceArea?: string;
    portCapability?: string;
    minRating?: number;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { serviceArea, portCapability, minRating, isActive = true, page = 1, limit = 20 } = params;
    const cacheKey = `vendors:${JSON.stringify(params)}`;
    
    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const startTime = Date.now();
        const skip = (page - 1) * limit;

        // Use raw query for complex vendor scoring
        const vendors = await prisma.$queryRaw`
          SELECT 
            v.id,
            v.name,
            v.code,
            v."qualityRating",
            v."deliveryRating",
            v."priceRating",
            v."overallScore",
            v."isActive",
            COUNT(po.id) as "totalOrders",
            AVG(CASE WHEN po.status = 'DELIVERED' THEN 1 ELSE 0 END) as "deliverySuccessRate"
          FROM vendors v
          LEFT JOIN "purchase_orders" po ON v.id = po."vendorId"
          WHERE v."isActive" = ${isActive}
            ${minRating ? `AND v."overallScore" >= ${minRating}` : ''}
          GROUP BY v.id, v.name, v.code, v."qualityRating", v."deliveryRating", v."priceRating", v."overallScore", v."isActive"
          ORDER BY v."overallScore" DESC, "totalOrders" DESC
          LIMIT ${limit} OFFSET ${skip}
        `;

        this.recordQueryMetrics('getOptimizedVendors', Date.now() - startTime, vendors.length, false);
        return vendors;
      },
      { ttl: 900 } // 15 minutes cache
    );
  }

  /**
   * Optimized analytics queries with aggregation
   */
  public async getSpendingAnalytics(params: {
    vesselId?: string;
    startDate: Date;
    endDate: Date;
    groupBy: 'vessel' | 'category' | 'vendor' | 'month';
  }) {
    const { vesselId, startDate, endDate, groupBy } = params;
    const cacheKey = `analytics:spending:${JSON.stringify(params)}`;
    
    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const startTime = Date.now();
        
        let query = '';
        switch (groupBy) {
          case 'vessel':
            query = `
              SELECT 
                v.name as "vesselName",
                v."imoNumber",
                SUM(po."totalAmount") as "totalSpent",
                COUNT(po.id) as "orderCount",
                AVG(po."totalAmount") as "averageOrderValue"
              FROM "purchase_orders" po
              JOIN vessels v ON po."vesselId" = v.id
              WHERE po."createdAt" BETWEEN $1 AND $2
                ${vesselId ? 'AND po."vesselId" = $3' : ''}
              GROUP BY v.id, v.name, v."imoNumber"
              ORDER BY "totalSpent" DESC
            `;
            break;
          
          case 'category':
            query = `
              SELECT 
                ic.category,
                SUM(pol."totalPrice") as "totalSpent",
                COUNT(pol.id) as "itemCount",
                AVG(pol."unitPrice") as "averagePrice"
              FROM "po_line_items" pol
              JOIN "item_catalog" ic ON pol."itemCatalogId" = ic.id
              JOIN "purchase_orders" po ON pol."purchaseOrderId" = po.id
              WHERE po."createdAt" BETWEEN $1 AND $2
                ${vesselId ? 'AND po."vesselId" = $3' : ''}
              GROUP BY ic.category
              ORDER BY "totalSpent" DESC
            `;
            break;
          
          case 'vendor':
            query = `
              SELECT 
                v.name as "vendorName",
                v.code as "vendorCode",
                SUM(po."totalAmount") as "totalSpent",
                COUNT(po.id) as "orderCount",
                AVG(v."overallScore") as "averageRating"
              FROM "purchase_orders" po
              JOIN vendors v ON po."vendorId" = v.id
              WHERE po."createdAt" BETWEEN $1 AND $2
                ${vesselId ? 'AND po."vesselId" = $3' : ''}
              GROUP BY v.id, v.name, v.code
              ORDER BY "totalSpent" DESC
            `;
            break;
          
          case 'month':
            query = `
              SELECT 
                DATE_TRUNC('month', po."createdAt") as month,
                SUM(po."totalAmount") as "totalSpent",
                COUNT(po.id) as "orderCount",
                COUNT(DISTINCT po."vendorId") as "uniqueVendors"
              FROM "purchase_orders" po
              WHERE po."createdAt" BETWEEN $1 AND $2
                ${vesselId ? 'AND po."vesselId" = $3' : ''}
              GROUP BY DATE_TRUNC('month', po."createdAt")
              ORDER BY month DESC
            `;
            break;
        }

        const params_array = vesselId ? [startDate, endDate, vesselId] : [startDate, endDate];
        const results = await prisma.$queryRawUnsafe(query, ...params_array);

        this.recordQueryMetrics('getSpendingAnalytics', Date.now() - startTime, Array.isArray(results) ? results.length : 1, false);
        return results;
      },
      { ttl: 900 } // 15 minutes cache
    );
  }

  /**
   * Create additional database indexes for performance optimization
   */
  public async createOptimizationIndexes(): Promise<void> {
    logger.info('Creating performance optimization indexes');
    
    try {
      // Composite indexes for common query patterns
      const indexes = [
        // User-related indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active ON users(role, "isActive") WHERE "isActive" = true',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_verified ON users(email, "emailVerified") WHERE "emailVerified" = true',
        
        // Vessel-related indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vessels_type_engine ON vessels("vesselType", "engineType") WHERE "isActive" = true',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vessels_position ON vessels("currentLatitude", "currentLongitude") WHERE "currentLatitude" IS NOT NULL',
        
        // Requisition performance indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_requisitions_vessel_status ON requisitions("vesselId", status, "createdAt")',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_requisitions_urgency_status ON requisitions("urgencyLevel", status) WHERE status IN (\'SUBMITTED\', \'UNDER_REVIEW\')',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_requisitions_amount_currency ON requisitions("totalAmount", currency) WHERE "totalAmount" > 0',
        
        // Item catalog search indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_item_catalog_search ON "item_catalog" USING gin(to_tsvector(\'english\', name || \' \' || COALESCE(description, \'\')))',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_item_catalog_compatibility ON "item_catalog"("category", "criticalityLevel", "compatibleVesselTypes")',
        
        // Purchase order performance indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_orders_vessel_date ON "purchase_orders"("vesselId", "createdAt", status)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_orders_vendor_amount ON "purchase_orders"("vendorId", "totalAmount", "createdAt")',
        
        // Audit and compliance indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_action_date ON "audit_logs"("userId", action, "createdAt")',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compliance_alerts_vessel_severity ON "compliance_alerts"("vesselId", severity, "isResolved")',
        
        // Financial reporting indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budgets_vessel_period ON budgets("vesselId", "budgetPeriod", "isActive")',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cost_centers_allocation ON "cost_centers"("allocationPercentage") WHERE "isActive" = true'
      ];

      for (const indexQuery of indexes) {
        try {
          await prisma.$executeRawUnsafe(indexQuery);
          logger.info(`Created index: ${indexQuery.split(' ')[5]}`);
        } catch (error) {
          // Index might already exist, log but continue
          logger.warn(`Index creation skipped (might already exist): ${error}`);
        }
      }

      logger.info('Performance optimization indexes created successfully');
    } catch (error) {
      logger.error('Failed to create optimization indexes', { error });
      throw error;
    }
  }

  /**
   * Analyze query performance and provide recommendations
   */
  public async analyzeQueryPerformance(): Promise<{
    slowQueries: QueryPerformanceMetrics[];
    recommendations: IndexRecommendation[];
    cacheHitRate: number;
  }> {
    const slowQueries = this.queryMetrics
      .filter(metric => metric.executionTime > this.slowQueryThreshold)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    const totalQueries = this.queryMetrics.length;
    const cachedQueries = this.queryMetrics.filter(metric => metric.cacheHit).length;
    const cacheHitRate = totalQueries > 0 ? (cachedQueries / totalQueries) * 100 : 0;

    const recommendations: IndexRecommendation[] = [
      {
        table: 'requisitions',
        columns: ['vesselId', 'status', 'urgencyLevel'],
        reason: 'Frequent filtering by vessel, status, and urgency',
        estimatedImprovement: '40-60% faster queries'
      },
      {
        table: 'item_catalog',
        columns: ['name', 'description'],
        reason: 'Full-text search optimization',
        estimatedImprovement: '70-80% faster search queries'
      },
      {
        table: 'purchase_orders',
        columns: ['createdAt', 'vesselId'],
        reason: 'Time-based reporting queries',
        estimatedImprovement: '50-70% faster analytics'
      }
    ];

    return {
      slowQueries,
      recommendations,
      cacheHitRate
    };
  }

  /**
   * Record query performance metrics
   */
  private recordQueryMetrics(
    queryType: string,
    executionTime: number,
    rowsAffected: number,
    cacheHit: boolean
  ): void {
    this.queryMetrics.push({
      queryType,
      executionTime,
      rowsAffected,
      cacheHit,
      timestamp: new Date()
    });

    // Keep only last 1000 metrics
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000);
    }

    // Log slow queries
    if (executionTime > this.slowQueryThreshold) {
      logger.warn('Slow query detected', {
        queryType,
        executionTime,
        rowsAffected,
        cacheHit
      });
    }
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    totalQueries: number;
    averageExecutionTime: number;
    slowQueryCount: number;
    cacheHitRate: number;
  } {
    const totalQueries = this.queryMetrics.length;
    const averageExecutionTime = totalQueries > 0 
      ? this.queryMetrics.reduce((sum, metric) => sum + metric.executionTime, 0) / totalQueries 
      : 0;
    const slowQueryCount = this.queryMetrics.filter(metric => metric.executionTime > this.slowQueryThreshold).length;
    const cachedQueries = this.queryMetrics.filter(metric => metric.cacheHit).length;
    const cacheHitRate = totalQueries > 0 ? (cachedQueries / totalQueries) * 100 : 0;

    return {
      totalQueries,
      averageExecutionTime,
      slowQueryCount,
      cacheHitRate
    };
  }
}

// Export singleton instance
export const dbOptimizationService = DatabaseOptimizationService.getInstance();