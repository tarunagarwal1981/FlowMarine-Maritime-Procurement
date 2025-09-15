import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { cacheService } from './cacheService.js';

export interface MaterializedViewConfig {
  name: string;
  query: string;
  refreshInterval: number; // in minutes
  dependencies: string[]; // tables that affect this view
}

/**
 * Materialized Views Service for FlowMarine
 * Manages complex reporting queries through materialized views for optimal performance
 */
export class MaterializedViewsService {
  private static instance: MaterializedViewsService;
  private refreshSchedule: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {}

  public static getInstance(): MaterializedViewsService {
    if (!MaterializedViewsService.instance) {
      MaterializedViewsService.instance = new MaterializedViewsService();
    }
    return MaterializedViewsService.instance;
  }

  /**
   * Initialize all materialized views
   */
  public async initializeMaterializedViews(): Promise<void> {
    logger.info('Initializing materialized views for FlowMarine');

    try {
      await this.createVesselPerformanceView();
      await this.createVendorPerformanceView();
      await this.createSpendingAnalyticsView();
      await this.createComplianceOverviewView();
      await this.createRequisitionSummaryView();
      await this.createInventoryAnalyticsView();
      await this.createFinancialSummaryView();

      // Set up refresh schedules
      this.scheduleViewRefresh();

      logger.info('All materialized views initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize materialized views', { error });
      throw error;
    }
  }

  /**
   * Create vessel performance materialized view
   */
  private async createVesselPerformanceView(): Promise<void> {
    const viewQuery = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vessel_performance AS
      SELECT 
        v.id as vessel_id,
        v.name as vessel_name,
        v."imoNumber" as imo_number,
        v."vesselType" as vessel_type,
        COUNT(DISTINCT r.id) as total_requisitions,
        COUNT(DISTINCT CASE WHEN r.status = 'APPROVED' THEN r.id END) as approved_requisitions,
        COUNT(DISTINCT po.id) as total_purchase_orders,
        COALESCE(SUM(po."totalAmount"), 0) as total_spent,
        COALESCE(AVG(po."totalAmount"), 0) as average_order_value,
        COUNT(DISTINCT CASE WHEN po.status = 'DELIVERED' THEN po.id END) as delivered_orders,
        COUNT(DISTINCT CASE WHEN r."urgencyLevel" = 'EMERGENCY' THEN r.id END) as emergency_requisitions,
        COUNT(DISTINCT v_cert.id) as active_certificates,
        COUNT(DISTINCT CASE WHEN v_cert."expiryDate" < NOW() + INTERVAL '30 days' THEN v_cert.id END) as expiring_certificates,
        MAX(r."createdAt") as last_requisition_date,
        MAX(po."createdAt") as last_order_date,
        EXTRACT(EPOCH FROM (NOW() - MAX(r."createdAt"))) / 86400 as days_since_last_requisition
      FROM vessels v
      LEFT JOIN requisitions r ON v.id = r."vesselId"
      LEFT JOIN "purchase_orders" po ON v.id = po."vesselId"
      LEFT JOIN "vessel_certificates" v_cert ON v.id = v_cert."vesselId" AND v_cert."expiryDate" > NOW()
      WHERE v."isActive" = true
      GROUP BY v.id, v.name, v."imoNumber", v."vesselType"
    `;

    await this.executeViewCreation('mv_vessel_performance', viewQuery);
    await this.createViewIndex('mv_vessel_performance', ['vessel_id'], true);
    await this.createViewIndex('mv_vessel_performance', ['total_spent', 'vessel_type']);
  }

  /**
   * Create vendor performance materialized view
   */
  private async createVendorPerformanceView(): Promise<void> {
    const viewQuery = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vendor_performance AS
      SELECT 
        v.id as vendor_id,
        v.name as vendor_name,
        v.code as vendor_code,
        v."qualityRating" as quality_rating,
        v."deliveryRating" as delivery_rating,
        v."priceRating" as price_rating,
        v."overallScore" as overall_score,
        COUNT(DISTINCT po.id) as total_orders,
        COALESCE(SUM(po."totalAmount"), 0) as total_revenue,
        COALESCE(AVG(po."totalAmount"), 0) as average_order_value,
        COUNT(DISTINCT CASE WHEN po.status = 'DELIVERED' THEN po.id END) as delivered_orders,
        COUNT(DISTINCT CASE WHEN po.status = 'CANCELLED' THEN po.id END) as cancelled_orders,
        CASE 
          WHEN COUNT(po.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN po.status = 'DELIVERED' THEN 1 END)::numeric / COUNT(po.id)::numeric) * 100, 2)
          ELSE 0 
        END as delivery_success_rate,
        COUNT(DISTINCT po."vesselId") as vessels_served,
        COUNT(DISTINCT rfq.id) as rfqs_received,
        COUNT(DISTINCT q.id) as quotes_submitted,
        CASE 
          WHEN COUNT(rfq.id) > 0 THEN 
            ROUND((COUNT(q.id)::numeric / COUNT(rfq.id)::numeric) * 100, 2)
          ELSE 0 
        END as quote_response_rate,
        MAX(po."createdAt") as last_order_date,
        EXTRACT(EPOCH FROM (NOW() - MAX(po."createdAt"))) / 86400 as days_since_last_order
      FROM vendors v
      LEFT JOIN "purchase_orders" po ON v.id = po."vendorId"
      LEFT JOIN "rfq_vendors" rfq_v ON v.id = rfq_v."vendorId"
      LEFT JOIN rfqs rfq ON rfq_v."rfqId" = rfq.id
      LEFT JOIN quotes q ON v.id = q."vendorId"
      WHERE v."isActive" = true
      GROUP BY v.id, v.name, v.code, v."qualityRating", v."deliveryRating", v."priceRating", v."overallScore"
    `;

    await this.executeViewCreation('mv_vendor_performance', viewQuery);
    await this.createViewIndex('mv_vendor_performance', ['vendor_id'], true);
    await this.createViewIndex('mv_vendor_performance', ['overall_score', 'delivery_success_rate']);
  }

  /**
   * Create spending analytics materialized view
   */
  private async createSpendingAnalyticsView(): Promise<void> {
    const viewQuery = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_spending_analytics AS
      SELECT 
        DATE_TRUNC('month', po."createdAt") as month,
        po."vesselId" as vessel_id,
        v.name as vessel_name,
        v."vesselType" as vessel_type,
        ic.category as item_category,
        po.currency,
        COUNT(po.id) as order_count,
        SUM(po."totalAmount") as total_amount,
        AVG(po."totalAmount") as average_order_value,
        MIN(po."totalAmount") as min_order_value,
        MAX(po."totalAmount") as max_order_value,
        COUNT(DISTINCT po."vendorId") as unique_vendors,
        COUNT(DISTINCT pol."itemCatalogId") as unique_items,
        SUM(pol.quantity) as total_quantity,
        COUNT(CASE WHEN r."urgencyLevel" = 'EMERGENCY' THEN 1 END) as emergency_orders,
        COUNT(CASE WHEN po.status = 'DELIVERED' THEN 1 END) as delivered_orders,
        AVG(EXTRACT(EPOCH FROM (po."updatedAt" - po."createdAt")) / 86400) as avg_delivery_days
      FROM "purchase_orders" po
      JOIN vessels v ON po."vesselId" = v.id
      JOIN requisitions r ON po."requisitionId" = r.id
      LEFT JOIN "po_line_items" pol ON po.id = pol."purchaseOrderId"
      LEFT JOIN "item_catalog" ic ON pol."itemCatalogId" = ic.id
      WHERE po."createdAt" >= NOW() - INTERVAL '24 months'
      GROUP BY 
        DATE_TRUNC('month', po."createdAt"),
        po."vesselId",
        v.name,
        v."vesselType",
        ic.category,
        po.currency
    `;

    await this.executeViewCreation('mv_spending_analytics', viewQuery);
    await this.createViewIndex('mv_spending_analytics', ['month', 'vessel_id']);
    await this.createViewIndex('mv_spending_analytics', ['vessel_type', 'item_category']);
  }

  /**
   * Create compliance overview materialized view
   */
  private async createComplianceOverviewView(): Promise<void> {
    const viewQuery = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_compliance_overview AS
      SELECT 
        v.id as vessel_id,
        v.name as vessel_name,
        v."imoNumber" as imo_number,
        COUNT(DISTINCT vc.id) as total_certificates,
        COUNT(DISTINCT CASE WHEN vc."expiryDate" > NOW() THEN vc.id END) as valid_certificates,
        COUNT(DISTINCT CASE WHEN vc."expiryDate" <= NOW() THEN vc.id END) as expired_certificates,
        COUNT(DISTINCT CASE WHEN vc."expiryDate" BETWEEN NOW() AND NOW() + INTERVAL '30 days' THEN vc.id END) as expiring_30_days,
        COUNT(DISTINCT CASE WHEN vc."expiryDate" BETWEEN NOW() AND NOW() + INTERVAL '90 days' THEN vc.id END) as expiring_90_days,
        COUNT(DISTINCT ca.id) as total_compliance_alerts,
        COUNT(DISTINCT CASE WHEN ca."isResolved" = false THEN ca.id END) as open_alerts,
        COUNT(DISTINCT CASE WHEN ca.severity = 'CRITICAL' AND ca."isResolved" = false THEN ca.id END) as critical_alerts,
        COUNT(DISTINCT CASE WHEN ca.severity = 'HIGH' AND ca."isResolved" = false THEN ca.id END) as high_alerts,
        COUNT(DISTINCT cr.id) as compliance_reports_generated,
        MAX(cr."generatedAt") as last_report_date,
        COUNT(DISTINCT cf.id) as compliance_flags,
        COUNT(DISTINCT CASE WHEN cf."isResolved" = false THEN cf.id END) as open_flags,
        CASE 
          WHEN COUNT(vc.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN vc."expiryDate" > NOW() THEN 1 END)::numeric / COUNT(vc.id)::numeric) * 100, 2)
          ELSE 0 
        END as certificate_compliance_rate,
        CASE 
          WHEN COUNT(ca.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN ca."isResolved" = true THEN 1 END)::numeric / COUNT(ca.id)::numeric) * 100, 2)
          ELSE 100 
        END as alert_resolution_rate
      FROM vessels v
      LEFT JOIN "vessel_certificates" vc ON v.id = vc."vesselId"
      LEFT JOIN "compliance_alerts" ca ON v.id = ca."vesselId"
      LEFT JOIN "compliance_reports" cr ON v.id = cr."vesselId"
      LEFT JOIN "compliance_flags" cf ON v.id = cf."vesselId"
      WHERE v."isActive" = true
      GROUP BY v.id, v.name, v."imoNumber"
    `;

    await this.executeViewCreation('mv_compliance_overview', viewQuery);
    await this.createViewIndex('mv_compliance_overview', ['vessel_id'], true);
    await this.createViewIndex('mv_compliance_overview', ['certificate_compliance_rate', 'critical_alerts']);
  }

  /**
   * Create requisition summary materialized view
   */
  private async createRequisitionSummaryView(): Promise<void> {
    const viewQuery = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_requisition_summary AS
      SELECT 
        DATE_TRUNC('week', r."createdAt") as week,
        r."vesselId" as vessel_id,
        v.name as vessel_name,
        r."urgencyLevel" as urgency_level,
        r.status,
        ic.category as item_category,
        ic."criticalityLevel" as criticality_level,
        COUNT(r.id) as requisition_count,
        COUNT(DISTINCT r."requestedById") as unique_requesters,
        SUM(r."totalAmount") as total_value,
        AVG(r."totalAmount") as average_value,
        COUNT(DISTINCT ri."itemCatalogId") as unique_items,
        SUM(ri.quantity) as total_quantity,
        AVG(EXTRACT(EPOCH FROM (r."updatedAt" - r."createdAt")) / 3600) as avg_processing_hours,
        COUNT(CASE WHEN r."emergencyOverride" = true THEN 1 END) as emergency_overrides,
        COUNT(CASE WHEN r.status = 'APPROVED' THEN 1 END) as approved_count,
        COUNT(CASE WHEN r.status = 'REJECTED' THEN 1 END) as rejected_count
      FROM requisitions r
      JOIN vessels v ON r."vesselId" = v.id
      LEFT JOIN "requisition_items" ri ON r.id = ri."requisitionId"
      LEFT JOIN "item_catalog" ic ON ri."itemCatalogId" = ic.id
      WHERE r."createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY 
        DATE_TRUNC('week', r."createdAt"),
        r."vesselId",
        v.name,
        r."urgencyLevel",
        r.status,
        ic.category,
        ic."criticalityLevel"
    `;

    await this.executeViewCreation('mv_requisition_summary', viewQuery);
    await this.createViewIndex('mv_requisition_summary', ['week', 'vessel_id']);
    await this.createViewIndex('mv_requisition_summary', ['urgency_level', 'status']);
  }

  /**
   * Create inventory analytics materialized view
   */
  private async createInventoryAnalyticsView(): Promise<void> {
    const viewQuery = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_inventory_analytics AS
      SELECT 
        ic.id as item_id,
        ic."impaCode" as impa_code,
        ic."issaCode" as issa_code,
        ic.name as item_name,
        ic.category,
        ic."criticalityLevel" as criticality_level,
        COUNT(DISTINCT ri."requisitionId") as times_requested,
        SUM(ri.quantity) as total_quantity_requested,
        AVG(ri.quantity) as average_quantity_per_request,
        COUNT(DISTINCT r."vesselId") as vessels_requesting,
        AVG(ri."unitPrice") as average_unit_price,
        MIN(ri."unitPrice") as min_unit_price,
        MAX(ri."unitPrice") as max_unit_price,
        COUNT(DISTINCT pol."purchaseOrderId") as times_purchased,
        SUM(pol.quantity) as total_quantity_purchased,
        AVG(pol."unitPrice") as average_purchase_price,
        COUNT(DISTINCT po."vendorId") as suppliers_count,
        AVG(ic."leadTime") as average_lead_time,
        MAX(r."createdAt") as last_requested_date,
        EXTRACT(EPOCH FROM (NOW() - MAX(r."createdAt"))) / 86400 as days_since_last_request,
        CASE 
          WHEN COUNT(ri.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN r.status = 'APPROVED' THEN 1 END)::numeric / COUNT(ri.id)::numeric) * 100, 2)
          ELSE 0 
        END as approval_rate
      FROM "item_catalog" ic
      LEFT JOIN "requisition_items" ri ON ic.id = ri."itemCatalogId"
      LEFT JOIN requisitions r ON ri."requisitionId" = r.id
      LEFT JOIN "po_line_items" pol ON ic.id = pol."itemCatalogId"
      LEFT JOIN "purchase_orders" po ON pol."purchaseOrderId" = po.id
      GROUP BY ic.id, ic."impaCode", ic."issaCode", ic.name, ic.category, ic."criticalityLevel"
    `;

    await this.executeViewCreation('mv_inventory_analytics', viewQuery);
    await this.createViewIndex('mv_inventory_analytics', ['item_id'], true);
    await this.createViewIndex('mv_inventory_analytics', ['category', 'times_requested']);
  }

  /**
   * Create financial summary materialized view
   */
  private async createFinancialSummaryView(): Promise<void> {
    const viewQuery = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_financial_summary AS
      SELECT 
        DATE_TRUNC('month', po."createdAt") as month,
        po.currency,
        cc.name as cost_center,
        b."budgetPeriod" as budget_period,
        COUNT(po.id) as transaction_count,
        SUM(po."totalAmount") as total_spent,
        AVG(po."totalAmount") as average_transaction,
        SUM(CASE WHEN po.status = 'PAID' THEN po."totalAmount" ELSE 0 END) as paid_amount,
        SUM(CASE WHEN po.status IN ('SENT', 'ACKNOWLEDGED', 'IN_PROGRESS') THEN po."totalAmount" ELSE 0 END) as pending_amount,
        COUNT(DISTINCT po."vendorId") as unique_vendors,
        COUNT(DISTINCT po."vesselId") as unique_vessels,
        SUM(b."allocatedAmount") as budget_allocated,
        SUM(b."spentAmount") as budget_spent,
        CASE 
          WHEN SUM(b."allocatedAmount") > 0 THEN 
            ROUND((SUM(b."spentAmount") / SUM(b."allocatedAmount")) * 100, 2)
          ELSE 0 
        END as budget_utilization_rate,
        AVG(EXTRACT(EPOCH FROM (i."paidAt" - i."receivedAt")) / 86400) as avg_payment_days
      FROM "purchase_orders" po
      LEFT JOIN "cost_center_allocations" cca ON po.id = cca."purchaseOrderId"
      LEFT JOIN "cost_centers" cc ON cca."costCenterId" = cc.id
      LEFT JOIN budgets b ON po."vesselId" = b."vesselId" 
        AND DATE_TRUNC('month', po."createdAt") = DATE_TRUNC('month', b."budgetPeriod")
      LEFT JOIN invoices i ON po.id = i."purchaseOrderId"
      WHERE po."createdAt" >= NOW() - INTERVAL '24 months'
      GROUP BY 
        DATE_TRUNC('month', po."createdAt"),
        po.currency,
        cc.name,
        b."budgetPeriod"
    `;

    await this.executeViewCreation('mv_financial_summary', viewQuery);
    await this.createViewIndex('mv_financial_summary', ['month', 'currency']);
    await this.createViewIndex('mv_financial_summary', ['cost_center', 'budget_utilization_rate']);
  }

  /**
   * Execute view creation with error handling
   */
  private async executeViewCreation(viewName: string, query: string): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS ${viewName}`);
      await prisma.$executeRawUnsafe(query);
      logger.info(`Created materialized view: ${viewName}`);
    } catch (error) {
      logger.error(`Failed to create materialized view ${viewName}`, { error });
      throw error;
    }
  }

  /**
   * Create index on materialized view
   */
  private async createViewIndex(
    viewName: string, 
    columns: string[], 
    unique: boolean = false
  ): Promise<void> {
    try {
      const indexName = `idx_${viewName}_${columns.join('_')}`;
      const uniqueClause = unique ? 'UNIQUE' : '';
      const columnList = columns.map(col => `"${col}"`).join(', ');
      
      await prisma.$executeRawUnsafe(
        `CREATE ${uniqueClause} INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON ${viewName}(${columnList})`
      );
      
      logger.info(`Created index ${indexName} on ${viewName}`);
    } catch (error) {
      logger.warn(`Failed to create index on ${viewName}`, { error });
    }
  }

  /**
   * Refresh a specific materialized view
   */
  public async refreshView(viewName: string): Promise<void> {
    try {
      const startTime = Date.now();
      await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`);
      const duration = Date.now() - startTime;
      
      logger.info(`Refreshed materialized view: ${viewName}`, { duration });
      
      // Invalidate related cache
      await cacheService.invalidatePattern(`analytics:*`);
      await cacheService.invalidatePattern(`reports:*`);
    } catch (error) {
      logger.error(`Failed to refresh materialized view ${viewName}`, { error });
      throw error;
    }
  }

  /**
   * Refresh all materialized views
   */
  public async refreshAllViews(): Promise<void> {
    const views = [
      'mv_vessel_performance',
      'mv_vendor_performance',
      'mv_spending_analytics',
      'mv_compliance_overview',
      'mv_requisition_summary',
      'mv_inventory_analytics',
      'mv_financial_summary'
    ];

    logger.info('Starting refresh of all materialized views');
    
    for (const view of views) {
      try {
        await this.refreshView(view);
      } catch (error) {
        logger.error(`Failed to refresh view ${view}, continuing with others`, { error });
      }
    }
    
    logger.info('Completed refresh of all materialized views');
  }

  /**
   * Schedule automatic view refresh
   */
  private scheduleViewRefresh(): void {
    const refreshConfigs = [
      { view: 'mv_vessel_performance', interval: 60 }, // 1 hour
      { view: 'mv_vendor_performance', interval: 120 }, // 2 hours
      { view: 'mv_spending_analytics', interval: 30 }, // 30 minutes
      { view: 'mv_compliance_overview', interval: 15 }, // 15 minutes
      { view: 'mv_requisition_summary', interval: 10 }, // 10 minutes
      { view: 'mv_inventory_analytics', interval: 180 }, // 3 hours
      { view: 'mv_financial_summary', interval: 60 } // 1 hour
    ];

    for (const config of refreshConfigs) {
      const intervalMs = config.interval * 60 * 1000;
      
      const timeout = setInterval(async () => {
        try {
          await this.refreshView(config.view);
        } catch (error) {
          logger.error(`Scheduled refresh failed for ${config.view}`, { error });
        }
      }, intervalMs);

      this.refreshSchedule.set(config.view, timeout);
      logger.info(`Scheduled refresh for ${config.view} every ${config.interval} minutes`);
    }
  }

  /**
   * Query materialized view with caching
   */
  public async queryView<T>(
    viewName: string, 
    query: string, 
    params: any[] = [],
    cacheKey?: string,
    cacheTTL: number = 300
  ): Promise<T> {
    if (cacheKey) {
      return cacheService.getOrSet(
        cacheKey,
        async () => {
          const result = await prisma.$queryRawUnsafe(query, ...params);
          return result as T;
        },
        { ttl: cacheTTL }
      );
    }

    return prisma.$queryRawUnsafe(query, ...params) as Promise<T>;
  }

  /**
   * Get view statistics
   */
  public async getViewStatistics(): Promise<{
    viewName: string;
    size: string;
    lastRefresh: Date | null;
    rowCount: number;
  }[]> {
    const views = [
      'mv_vessel_performance',
      'mv_vendor_performance', 
      'mv_spending_analytics',
      'mv_compliance_overview',
      'mv_requisition_summary',
      'mv_inventory_analytics',
      'mv_financial_summary'
    ];

    const stats = [];
    
    for (const viewName of views) {
      try {
        const sizeResult = await prisma.$queryRawUnsafe(`
          SELECT pg_size_pretty(pg_total_relation_size('${viewName}')) as size
        `) as any[];
        
        const countResult = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*) as count FROM ${viewName}
        `) as any[];

        stats.push({
          viewName,
          size: sizeResult[0]?.size || '0 bytes',
          lastRefresh: null, // PostgreSQL doesn't track this directly
          rowCount: parseInt(countResult[0]?.count || '0')
        });
      } catch (error) {
        logger.error(`Failed to get statistics for view ${viewName}`, { error });
        stats.push({
          viewName,
          size: 'Error',
          lastRefresh: null,
          rowCount: 0
        });
      }
    }

    return stats;
  }

  /**
   * Cleanup - stop all scheduled refreshes
   */
  public cleanup(): void {
    for (const [viewName, timeout] of this.refreshSchedule) {
      clearInterval(timeout);
      logger.info(`Stopped scheduled refresh for ${viewName}`);
    }
    this.refreshSchedule.clear();
  }
}

// Export singleton instance
export const materializedViewsService = MaterializedViewsService.getInstance();