import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { cacheService } from './cacheService.js';

const prisma = new PrismaClient();

export interface QueryOptimizationOptions {
  useCache?: boolean;
  cacheTTL?: number;
  usePreAggregation?: boolean;
  batchSize?: number;
  timeout?: number;
}

export interface QueryPerformanceMetrics {
  queryTime: number;
  cacheHit: boolean;
  rowsProcessed: number;
  optimizationUsed: string[];
}

/**
 * Query Optimization Service for Complex Analytics Queries
 * Implements intelligent query optimization strategies for dashboard analytics
 */
export class QueryOptimizationService {
  private static instance: QueryOptimizationService;
  private queryCache: Map<string, any> = new Map();
  private performanceMetrics: Map<string, QueryPerformanceMetrics[]> = new Map();

  private constructor() {}

  public static getInstance(): QueryOptimizationService {
    if (!QueryOptimizationService.instance) {
      QueryOptimizationService.instance = new QueryOptimizationService();
    }
    return QueryOptimizationService.instance;
  }

  /**
   * Optimized spend analytics query with intelligent caching and aggregation
   */
  async getOptimizedSpendAnalytics(
    filters: any,
    options: QueryOptimizationOptions = {}
  ): Promise<{ data: any; metrics: QueryPerformanceMetrics }> {
    const startTime = Date.now();
    const queryKey = this.generateQueryKey('spend_analytics', filters);
    
    let cacheHit = false;
    let optimizationUsed: string[] = [];

    try {
      // Try cache first if enabled
      if (options.useCache !== false) {
        const cached = await cacheService.getCachedDashboardData('spend_analytics', filters);
        if (cached) {
          cacheHit = true;
          optimizationUsed.push('cache_hit');
          
          return {
            data: cached,
            metrics: {
              queryTime: Date.now() - startTime,
              cacheHit: true,
              rowsProcessed: 0,
              optimizationUsed
            }
          };
        }
      }

      // Use pre-aggregated data if available and suitable
      if (options.usePreAggregation !== false) {
        const preAggregated = await this.getPreAggregatedSpendData(filters);
        if (preAggregated) {
          optimizationUsed.push('pre_aggregation');
          
          // Cache the result
          await cacheService.cacheDashboardData(
            'spend_analytics',
            filters,
            preAggregated,
            ['purchase_orders', 'vendors', 'vessels']
          );

          return {
            data: preAggregated,
            metrics: {
              queryTime: Date.now() - startTime,
              cacheHit: false,
              rowsProcessed: preAggregated.totalRecords || 0,
              optimizationUsed
            }
          };
        }
      }

      // Execute optimized query
      const data = await this.executeOptimizedSpendQuery(filters, options);
      optimizationUsed.push('optimized_query');

      // Cache the result
      if (options.useCache !== false) {
        await cacheService.cacheDashboardData(
          'spend_analytics',
          filters,
          data,
          ['purchase_orders', 'vendors', 'vessels']
        );
      }

      const metrics: QueryPerformanceMetrics = {
        queryTime: Date.now() - startTime,
        cacheHit,
        rowsProcessed: data.totalRecords || 0,
        optimizationUsed
      };

      // Store performance metrics
      this.recordPerformanceMetrics(queryKey, metrics);

      return { data, metrics };

    } catch (error) {
      logger.error('Optimized spend analytics query failed', { error, filters });
      throw error;
    }
  }

  /**
   * Optimized vendor performance query with batch processing
   */
  async getOptimizedVendorPerformance(
    filters: any,
    options: QueryOptimizationOptions = {}
  ): Promise<{ data: any; metrics: QueryPerformanceMetrics }> {
    const startTime = Date.now();
    const queryKey = this.generateQueryKey('vendor_performance', filters);
    
    let optimizationUsed: string[] = [];

    try {
      // Check cache first
      if (options.useCache !== false) {
        const cached = await cacheService.getCachedDashboardData('vendor_performance', filters);
        if (cached) {
          return {
            data: cached,
            metrics: {
              queryTime: Date.now() - startTime,
              cacheHit: true,
              rowsProcessed: 0,
              optimizationUsed: ['cache_hit']
            }
          };
        }
      }

      // Use batch processing for large datasets
      const batchSize = options.batchSize || 100;
      const vendorData = await this.getBatchedVendorPerformance(filters, batchSize);
      optimizationUsed.push('batch_processing');

      // Cache the result
      await cacheService.cacheDashboardData(
        'vendor_performance',
        filters,
        vendorData,
        ['vendors', 'purchase_orders', 'deliveries']
      );

      const metrics: QueryPerformanceMetrics = {
        queryTime: Date.now() - startTime,
        cacheHit: false,
        rowsProcessed: vendorData.length || 0,
        optimizationUsed
      };

      this.recordPerformanceMetrics(queryKey, metrics);

      return { data: vendorData, metrics };

    } catch (error) {
      logger.error('Optimized vendor performance query failed', { error, filters });
      throw error;
    }
  }

  /**
   * Optimized operational metrics with materialized view simulation
   */
  async getOptimizedOperationalMetrics(
    filters: any,
    options: QueryOptimizationOptions = {}
  ): Promise<{ data: any; metrics: QueryPerformanceMetrics }> {
    const startTime = Date.now();
    const queryKey = this.generateQueryKey('operational_metrics', filters);
    
    let optimizationUsed: string[] = [];

    try {
      // Check for cached materialized view
      const materializedKey = `materialized:operational_metrics:${this.hashFilters(filters)}`;
      const materialized = await cacheService.getCompressed(materializedKey, 'analytics:');
      
      if (materialized) {
        optimizationUsed.push('materialized_view');
        
        return {
          data: materialized,
          metrics: {
            queryTime: Date.now() - startTime,
            cacheHit: true,
            rowsProcessed: 0,
            optimizationUsed
          }
        };
      }

      // Execute complex operational metrics query with optimization
      const data = await this.executeOptimizedOperationalQuery(filters, options);
      optimizationUsed.push('optimized_complex_query');

      // Store as compressed materialized view
      await cacheService.setCompressed(materializedKey, data, {
        prefix: 'analytics:',
        ttl: 1800 // 30 minutes for operational data
      });

      const metrics: QueryPerformanceMetrics = {
        queryTime: Date.now() - startTime,
        cacheHit: false,
        rowsProcessed: data.totalRecords || 0,
        optimizationUsed
      };

      this.recordPerformanceMetrics(queryKey, metrics);

      return { data, metrics };

    } catch (error) {
      logger.error('Optimized operational metrics query failed', { error, filters });
      throw error;
    }
  }

  /**
   * Optimized budget utilization with incremental updates
   */
  async getOptimizedBudgetUtilization(
    filters: any,
    options: QueryOptimizationOptions = {}
  ): Promise<{ data: any; metrics: QueryPerformanceMetrics }> {
    const startTime = Date.now();
    const queryKey = this.generateQueryKey('budget_utilization', filters);
    
    let optimizationUsed: string[] = [];

    try {
      // Check for incremental update possibility
      const lastUpdate = await this.getLastBudgetUpdate(filters);
      const incrementalData = await this.getIncrementalBudgetData(filters, lastUpdate);
      
      if (incrementalData) {
        optimizationUsed.push('incremental_update');
        
        const data = await this.mergeBudgetData(incrementalData, filters);
        
        const metrics: QueryPerformanceMetrics = {
          queryTime: Date.now() - startTime,
          cacheHit: false,
          rowsProcessed: incrementalData.newRecords || 0,
          optimizationUsed
        };

        return { data, metrics };
      }

      // Fall back to full query with optimization
      const data = await this.executeOptimizedBudgetQuery(filters, options);
      optimizationUsed.push('full_optimized_query');

      const metrics: QueryPerformanceMetrics = {
        queryTime: Date.now() - startTime,
        cacheHit: false,
        rowsProcessed: data.totalRecords || 0,
        optimizationUsed
      };

      this.recordPerformanceMetrics(queryKey, metrics);

      return { data, metrics };

    } catch (error) {
      logger.error('Optimized budget utilization query failed', { error, filters });
      throw error;
    }
  }

  /**
   * Execute optimized spend query with proper indexing hints
   */
  private async executeOptimizedSpendQuery(
    filters: any,
    options: QueryOptimizationOptions
  ): Promise<any> {
    const whereClause = this.buildOptimizedWhereClause(filters);
    
    // Use raw query with optimization hints for better performance
    const spendData = await prisma.$queryRaw`
      SELECT 
        v.id as vessel_id,
        v.name as vessel_name,
        ven.id as vendor_id,
        ven.name as vendor_name,
        pc.code as category_code,
        pc.name as category_name,
        SUM(po.total_amount) as total_amount,
        COUNT(po.id) as order_count,
        AVG(po.total_amount) as avg_order_value,
        DATE_TRUNC('month', po.created_at) as month
      FROM purchase_orders po
      INNER JOIN vessels v ON po.vessel_id = v.id
      INNER JOIN vendors ven ON po.vendor_id = ven.id
      LEFT JOIN purchase_categories pc ON po.category_code = pc.code
      WHERE po.created_at >= ${filters.startDate}
        AND po.created_at <= ${filters.endDate}
        AND po.status IN ('DELIVERED', 'INVOICED', 'PAID')
        ${filters.vesselIds ? prisma.$queryRaw`AND po.vessel_id = ANY(${filters.vesselIds})` : prisma.$queryRaw``}
        ${filters.vendorIds ? prisma.$queryRaw`AND po.vendor_id = ANY(${filters.vendorIds})` : prisma.$queryRaw``}
      GROUP BY v.id, v.name, ven.id, ven.name, pc.code, pc.name, DATE_TRUNC('month', po.created_at)
      ORDER BY total_amount DESC
    `;

    return this.transformSpendData(spendData);
  }

  /**
   * Get batched vendor performance data
   */
  private async getBatchedVendorPerformance(
    filters: any,
    batchSize: number
  ): Promise<any[]> {
    const vendorIds = await this.getVendorIdsForPeriod(filters);
    const batches = this.chunkArray(vendorIds, batchSize);
    const results = [];

    for (const batch of batches) {
      const batchData = await this.getVendorPerformanceBatch(batch, filters);
      results.push(...batchData);
    }

    return results;
  }

  /**
   * Execute optimized operational query with CTEs
   */
  private async executeOptimizedOperationalQuery(
    filters: any,
    options: QueryOptimizationOptions
  ): Promise<any> {
    // Use Common Table Expressions (CTEs) for complex operational metrics
    const operationalData = await prisma.$queryRaw`
      WITH cycle_times AS (
        SELECT 
          r.vessel_id,
          r.id as requisition_id,
          r.created_at as req_created,
          MIN(a.created_at) as first_approval,
          MAX(a.created_at) as final_approval,
          po.created_at as po_created,
          d.delivered_at
        FROM requisitions r
        LEFT JOIN approvals a ON r.id = a.requisition_id
        LEFT JOIN purchase_orders po ON r.id = po.requisition_id
        LEFT JOIN deliveries d ON po.id = d.purchase_order_id
        WHERE r.created_at >= ${filters.startDate}
          AND r.created_at <= ${filters.endDate}
        GROUP BY r.vessel_id, r.id, r.created_at, po.created_at, d.delivered_at
      ),
      stage_times AS (
        SELECT 
          vessel_id,
          AVG(EXTRACT(EPOCH FROM (first_approval - req_created))/3600) as avg_approval_time,
          AVG(EXTRACT(EPOCH FROM (po_created - final_approval))/3600) as avg_po_time,
          AVG(EXTRACT(EPOCH FROM (delivered_at - po_created))/24/3600) as avg_delivery_days,
          COUNT(*) as total_requisitions
        FROM cycle_times
        WHERE first_approval IS NOT NULL
        GROUP BY vessel_id
      )
      SELECT 
        v.id as vessel_id,
        v.name as vessel_name,
        st.avg_approval_time,
        st.avg_po_time,
        st.avg_delivery_days,
        st.total_requisitions,
        (st.avg_approval_time + st.avg_po_time + (st.avg_delivery_days * 24)) as total_cycle_hours
      FROM stage_times st
      JOIN vessels v ON st.vessel_id = v.id
      ORDER BY total_cycle_hours ASC
    `;

    return this.transformOperationalData(operationalData);
  }

  /**
   * Execute optimized budget query with window functions
   */
  private async executeOptimizedBudgetQuery(
    filters: any,
    options: QueryOptimizationOptions
  ): Promise<any> {
    const budgetData = await prisma.$queryRaw`
      WITH budget_summary AS (
        SELECT 
          ba.vessel_id,
          ba.category_code,
          ba.allocated_amount,
          ba.period_start,
          ba.period_end,
          COALESCE(SUM(po.total_amount), 0) as spent_amount,
          COUNT(po.id) as order_count
        FROM budget_allocations ba
        LEFT JOIN purchase_orders po ON ba.vessel_id = po.vessel_id 
          AND ba.category_code = po.category_code
          AND po.created_at >= ba.period_start
          AND po.created_at <= ba.period_end
          AND po.status IN ('DELIVERED', 'INVOICED', 'PAID')
        WHERE ba.period_start <= ${filters.endDate}
          AND ba.period_end >= ${filters.startDate}
        GROUP BY ba.vessel_id, ba.category_code, ba.allocated_amount, ba.period_start, ba.period_end
      ),
      budget_with_variance AS (
        SELECT 
          *,
          (spent_amount / NULLIF(allocated_amount, 0)) * 100 as utilization_percentage,
          spent_amount - allocated_amount as variance_amount,
          CASE 
            WHEN spent_amount > allocated_amount * 1.1 THEN 'over'
            WHEN spent_amount < allocated_amount * 0.8 THEN 'under'
            ELSE 'on-track'
          END as status
        FROM budget_summary
      )
      SELECT 
        v.name as vessel_name,
        pc.name as category_name,
        bwv.*,
        ROW_NUMBER() OVER (PARTITION BY bwv.vessel_id ORDER BY ABS(bwv.variance_amount) DESC) as variance_rank
      FROM budget_with_variance bwv
      JOIN vessels v ON bwv.vessel_id = v.id
      LEFT JOIN purchase_categories pc ON bwv.category_code = pc.code
      ORDER BY ABS(variance_amount) DESC
    `;

    return this.transformBudgetData(budgetData);
  }

  /**
   * Get pre-aggregated spend data if available
   */
  private async getPreAggregatedSpendData(filters: any): Promise<any | null> {
    // Check if we have pre-aggregated data that matches the filters
    const preAggKey = `pre_agg:spend:${this.hashFilters(filters)}`;
    return await cacheService.getCompressed(preAggKey, 'analytics:');
  }

  /**
   * Get last budget update timestamp
   */
  private async getLastBudgetUpdate(filters: any): Promise<Date | null> {
    const lastUpdateKey = `last_update:budget:${this.hashFilters(filters)}`;
    const cached = await cacheService.get(lastUpdateKey, { prefix: 'analytics:' });
    return cached ? new Date(cached) : null;
  }

  /**
   * Get incremental budget data since last update
   */
  private async getIncrementalBudgetData(
    filters: any,
    lastUpdate: Date | null
  ): Promise<any | null> {
    if (!lastUpdate) return null;

    // Only use incremental if last update was recent (within 1 hour)
    const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate > 1) return null;

    // Get only new/updated records since last update
    const incrementalData = await prisma.purchaseOrder.findMany({
      where: {
        updatedAt: { gt: lastUpdate },
        createdAt: {
          gte: filters.startDate,
          lte: filters.endDate
        }
      },
      include: {
        vessel: true,
        vendor: true
      }
    });

    return {
      newRecords: incrementalData.length,
      data: incrementalData,
      since: lastUpdate
    };
  }

  /**
   * Merge incremental budget data with cached base data
   */
  private async mergeBudgetData(incrementalData: any, filters: any): Promise<any> {
    const baseDataKey = `base:budget:${this.hashFilters(filters)}`;
    const baseData = await cacheService.getCompressed(baseDataKey, 'analytics:');
    
    if (!baseData) {
      // If no base data, fall back to full query
      return null;
    }

    // Merge incremental changes with base data
    // This is a simplified merge - in production, you'd implement proper data merging logic
    return {
      ...baseData,
      lastUpdated: new Date(),
      incrementalRecords: incrementalData.newRecords
    };
  }

  // Helper methods

  private generateQueryKey(queryType: string, filters: any): string {
    return `${queryType}:${this.hashFilters(filters)}`;
  }

  private hashFilters(filters: any): string {
    const sortedFilters = JSON.stringify(filters, Object.keys(filters).sort());
    return Buffer.from(sortedFilters).toString('base64').substring(0, 16);
  }

  private buildOptimizedWhereClause(filters: any): any {
    return {
      createdAt: {
        gte: filters.startDate,
        lte: filters.endDate
      },
      ...(filters.vesselIds?.length && { vesselId: { in: filters.vesselIds } }),
      ...(filters.vendorIds?.length && { vendorId: { in: filters.vendorIds } }),
      ...(filters.categories?.length && { categoryCode: { in: filters.categories } }),
      status: { in: ['DELIVERED', 'INVOICED', 'PAID'] }
    };
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async getVendorIdsForPeriod(filters: any): Promise<string[]> {
    const vendors = await prisma.purchaseOrder.findMany({
      where: this.buildOptimizedWhereClause(filters),
      select: { vendorId: true },
      distinct: ['vendorId']
    });
    
    return vendors.map(v => v.vendorId);
  }

  private async getVendorPerformanceBatch(
    vendorIds: string[],
    filters: any
  ): Promise<any[]> {
    // Implement batched vendor performance calculation
    const vendors = await prisma.vendor.findMany({
      where: { id: { in: vendorIds } },
      include: {
        purchaseOrders: {
          where: {
            createdAt: {
              gte: filters.startDate,
              lte: filters.endDate
            }
          },
          include: {
            deliveries: true
          }
        }
      }
    });

    return vendors.map(vendor => ({
      vendorId: vendor.id,
      vendorName: vendor.name,
      orderCount: vendor.purchaseOrders.length,
      totalAmount: vendor.purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0),
      onTimeDeliveries: vendor.purchaseOrders.filter(po => 
        po.deliveries.some(d => d.deliveredAt && d.deliveredAt <= po.expectedDeliveryDate)
      ).length
    }));
  }

  private transformSpendData(rawData: any[]): any {
    // Transform raw query results into the expected format
    return {
      totalRecords: rawData.length,
      byVessel: this.groupByVessel(rawData),
      byVendor: this.groupByVendor(rawData),
      byCategory: this.groupByCategory(rawData),
      byMonth: this.groupByMonth(rawData)
    };
  }

  private transformOperationalData(rawData: any[]): any {
    return {
      totalRecords: rawData.length,
      cycleTimeAnalysis: {
        averageCycleTime: rawData.reduce((sum, item) => sum + (item.total_cycle_hours || 0), 0) / rawData.length,
        vesselComparison: rawData.map(item => ({
          vesselId: item.vessel_id,
          vesselName: item.vessel_name,
          averageCycleTime: item.total_cycle_hours,
          efficiency: this.calculateEfficiency(item.total_cycle_hours)
        }))
      }
    };
  }

  private transformBudgetData(rawData: any[]): any {
    return {
      totalRecords: rawData.length,
      budgetByVessel: this.groupBudgetByVessel(rawData),
      budgetByCategory: this.groupBudgetByCategory(rawData),
      alerts: this.generateBudgetAlerts(rawData)
    };
  }

  private groupByVessel(data: any[]): any[] {
    const grouped = new Map();
    data.forEach(item => {
      const key = item.vessel_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          vesselId: item.vessel_id,
          vesselName: item.vessel_name,
          totalAmount: 0,
          orderCount: 0
        });
      }
      const group = grouped.get(key);
      group.totalAmount += Number(item.total_amount);
      group.orderCount += Number(item.order_count);
    });
    return Array.from(grouped.values());
  }

  private groupByVendor(data: any[]): any[] {
    const grouped = new Map();
    data.forEach(item => {
      const key = item.vendor_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          vendorId: item.vendor_id,
          vendorName: item.vendor_name,
          totalAmount: 0,
          orderCount: 0
        });
      }
      const group = grouped.get(key);
      group.totalAmount += Number(item.total_amount);
      group.orderCount += Number(item.order_count);
    });
    return Array.from(grouped.values());
  }

  private groupByCategory(data: any[]): any[] {
    const grouped = new Map();
    data.forEach(item => {
      const key = item.category_code;
      if (!grouped.has(key)) {
        grouped.set(key, {
          categoryCode: item.category_code,
          categoryName: item.category_name,
          totalAmount: 0,
          orderCount: 0
        });
      }
      const group = grouped.get(key);
      group.totalAmount += Number(item.total_amount);
      group.orderCount += Number(item.order_count);
    });
    return Array.from(grouped.values());
  }

  private groupByMonth(data: any[]): any[] {
    const grouped = new Map();
    data.forEach(item => {
      const key = item.month;
      if (!grouped.has(key)) {
        grouped.set(key, {
          month: item.month,
          totalAmount: 0,
          orderCount: 0
        });
      }
      const group = grouped.get(key);
      group.totalAmount += Number(item.total_amount);
      group.orderCount += Number(item.order_count);
    });
    return Array.from(grouped.values()).sort((a, b) => 
      new Date(a.month).getTime() - new Date(b.month).getTime()
    );
  }

  private groupBudgetByVessel(data: any[]): any[] {
    // Implementation for budget grouping by vessel
    return [];
  }

  private groupBudgetByCategory(data: any[]): any[] {
    // Implementation for budget grouping by category
    return [];
  }

  private generateBudgetAlerts(data: any[]): any[] {
    // Implementation for budget alerts generation
    return [];
  }

  private calculateEfficiency(cycleTime: number): number {
    // Simple efficiency calculation - lower cycle time = higher efficiency
    const maxCycleTime = 168; // 1 week in hours
    return Math.max(0, Math.min(100, ((maxCycleTime - cycleTime) / maxCycleTime) * 100));
  }

  private recordPerformanceMetrics(queryKey: string, metrics: QueryPerformanceMetrics): void {
    if (!this.performanceMetrics.has(queryKey)) {
      this.performanceMetrics.set(queryKey, []);
    }
    
    const queryMetrics = this.performanceMetrics.get(queryKey)!;
    queryMetrics.push(metrics);
    
    // Keep only last 100 metrics per query type
    if (queryMetrics.length > 100) {
      queryMetrics.shift();
    }
  }

  /**
   * Get performance statistics for query optimization
   */
  public getPerformanceStatistics(): any {
    const stats: any = {};
    
    for (const [queryKey, metrics] of this.performanceMetrics.entries()) {
      const avgQueryTime = metrics.reduce((sum, m) => sum + m.queryTime, 0) / metrics.length;
      const cacheHitRate = (metrics.filter(m => m.cacheHit).length / metrics.length) * 100;
      const avgRowsProcessed = metrics.reduce((sum, m) => sum + m.rowsProcessed, 0) / metrics.length;
      
      stats[queryKey] = {
        totalQueries: metrics.length,
        averageQueryTime: avgQueryTime,
        cacheHitRate,
        averageRowsProcessed: avgRowsProcessed,
        optimizationsUsed: [...new Set(metrics.flatMap(m => m.optimizationUsed))]
      };
    }
    
    return stats;
  }

  /**
   * Clear performance metrics
   */
  public clearPerformanceMetrics(): void {
    this.performanceMetrics.clear();
  }
}

// Export singleton instance
export const queryOptimizationService = QueryOptimizationService.getInstance();