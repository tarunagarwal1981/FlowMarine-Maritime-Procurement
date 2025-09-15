import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController.js';
import { authenticateToken } from '../middleware/authentication.js';
import { authorizeRole } from '../middleware/authorization.js';
import { validateVesselAccess } from '../middleware/vesselAccess.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { auditLogger } from '../middleware/auditLogger.js';

const router = Router();

// Apply authentication to all dashboard routes
router.use(authenticateToken);

// Apply audit logging to all dashboard routes
router.use(auditLogger);

// Apply rate limiting to dashboard routes (higher limits for dashboard data)
const dashboardRateLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many dashboard requests, please try again later'
});

router.use(dashboardRateLimit);

/**
 * @route POST /api/dashboard/data
 * @desc Get comprehensive dashboard data
 * @access Private - requires VIEW_ANALYTICS permission
 */
router.post('/data',
  authorizeRole(['VIEW_ANALYTICS', 'VIEW_FINANCIAL_DATA']),
  dashboardController.getDashboardData.bind(dashboardController)
);

/**
 * @route GET /api/dashboard/spend-analytics
 * @desc Get spend analytics data
 * @access Private - requires VIEW_ANALYTICS permission
 */
router.get('/spend-analytics',
  authorizeRole(['VIEW_ANALYTICS', 'VIEW_FINANCIAL_DATA']),
  dashboardController.getSpendAnalytics.bind(dashboardController)
);

/**
 * @route GET /api/dashboard/budget-utilization
 * @desc Get budget utilization data
 * @access Private - requires VIEW_BUDGET permission
 */
router.get('/budget-utilization',
  authorizeRole(['VIEW_BUDGET', 'VIEW_FINANCIAL_DATA']),
  dashboardController.getBudgetUtilization.bind(dashboardController)
);

/**
 * @route GET /api/dashboard/vendor-performance
 * @desc Get vendor performance analytics
 * @access Private - requires VIEW_VENDORS permission
 */
router.get('/vendor-performance',
  authorizeRole(['VIEW_VENDORS', 'VIEW_ANALYTICS']),
  dashboardController.getVendorPerformance.bind(dashboardController)
);

/**
 * @route GET /api/dashboard/operational-metrics
 * @desc Get operational metrics
 * @access Private - requires VIEW_OPERATIONS permission
 */
router.get('/operational-metrics',
  authorizeRole(['VIEW_OPERATIONS', 'VIEW_ANALYTICS']),
  dashboardController.getOperationalMetrics.bind(dashboardController)
);

/**
 * @route GET /api/dashboard/financial-insights
 * @desc Get financial insights
 * @access Private - requires VIEW_FINANCIAL_DATA permission
 */
router.get('/financial-insights',
  authorizeRole(['VIEW_FINANCIAL_DATA', 'VIEW_ANALYTICS']),
  dashboardController.getFinancialInsights.bind(dashboardController)
);

/**
 * @route GET /api/dashboard/port-efficiency
 * @desc Get port efficiency analytics
 * @access Private - requires VIEW_ANALYTICS permission
 */
router.get('/port-efficiency',
  authorizeRole(['VIEW_ANALYTICS', 'VIEW_OPERATIONS']),
  dashboardController.getPortEfficiencyAnalytics.bind(dashboardController)
);

/**
 * @route GET /api/dashboard/port-efficiency/export
 * @desc Export port efficiency analytics
 * @access Private - requires EXPORT_DASHBOARDS permission
 */
router.get('/port-efficiency/export',
  authorizeRole(['EXPORT_DASHBOARDS', 'ADMIN', 'SUPER_ADMIN']),
  dashboardController.exportPortEfficiencyAnalytics.bind(dashboardController)
);

/**
 * @route GET /api/analytics/inventory/turnover
 * @desc Get inventory turnover analysis
 * @access Private - requires VIEW_INVENTORY permission
 */
router.get('/inventory/turnover',
  authorizeRole(['VIEW_INVENTORY', 'VIEW_ANALYTICS']),
  dashboardController.getInventoryTurnoverAnalysis.bind(dashboardController)
);

/**
 * @route GET /api/analytics/demand/forecast
 * @desc Get demand forecast data
 * @access Private - requires VIEW_ANALYTICS permission
 */
router.get('/demand/forecast',
  authorizeRole(['VIEW_ANALYTICS', 'VIEW_INVENTORY']),
  dashboardController.getDemandForecast.bind(dashboardController)
);

/**
 * @route GET /api/analytics/inventory/optimization
 * @desc Get inventory optimization recommendations
 * @access Private - requires VIEW_INVENTORY permission
 */
router.get('/inventory/optimization',
  authorizeRole(['VIEW_INVENTORY', 'VIEW_ANALYTICS']),
  dashboardController.getInventoryOptimization.bind(dashboardController)
);

/**
 * @route GET /api/analytics/inventory/alerts
 * @desc Get stock alerts and monitoring data
 * @access Private - requires VIEW_INVENTORY permission
 */
router.get('/inventory/alerts',
  authorizeRole(['VIEW_INVENTORY', 'VIEW_ANALYTICS']),
  dashboardController.getStockAlerts.bind(dashboardController)
);

/**
 * @route GET /api/analytics/maintenance/predictive
 * @desc Get predictive maintenance data
 * @access Private - requires VIEW_MAINTENANCE permission
 */
router.get('/maintenance/predictive',
  authorizeRole(['VIEW_MAINTENANCE', 'VIEW_ANALYTICS']),
  dashboardController.getPredictiveMaintenanceData.bind(dashboardController)
);

/**
 * @route GET /api/dashboard/subscription-stats
 * @desc Get WebSocket subscription statistics
 * @access Private - requires ADMIN permission
 */
router.get('/subscription-stats',
  authorizeRole(['ADMIN', 'SUPER_ADMIN']),
  dashboardController.getSubscriptionStats.bind(dashboardController)
);

/**
 * @route POST /api/dashboard/notification
 * @desc Send dashboard notification
 * @access Private - requires ADMIN permission
 */
router.post('/notification',
  authorizeRole(['ADMIN', 'SUPER_ADMIN']),
  dashboardController.sendNotification.bind(dashboardController)
);

/**
 * @route POST /api/dashboard/export/pdf
 * @desc Export dashboard data to PDF
 * @access Private - requires EXPORT_DASHBOARDS permission
 */
router.post('/export/pdf',
  authorizeRole(['EXPORT_DASHBOARDS', 'ADMIN', 'SUPER_ADMIN']),
  dashboardController.exportToPDF.bind(dashboardController)
);

/**
 * @route POST /api/dashboard/export/excel
 * @desc Export dashboard data to Excel
 * @access Private - requires EXPORT_DASHBOARDS permission
 */
router.post('/export/excel',
  authorizeRole(['EXPORT_DASHBOARDS', 'ADMIN', 'SUPER_ADMIN']),
  dashboardController.exportToExcel.bind(dashboardController)
);

/**
 * @route GET /api/dashboard/templates
 * @desc Get export templates
 * @access Private - requires VIEW_EXPORT_TEMPLATES permission
 */
router.get('/templates',
  authorizeRole(['VIEW_EXPORT_TEMPLATES', 'ADMIN', 'SUPER_ADMIN']),
  dashboardController.getExportTemplates.bind(dashboardController)
);

/**
 * @route POST /api/dashboard/templates
 * @desc Create export template
 * @access Private - requires ADMIN permission
 */
router.post('/templates',
  authorizeRole(['ADMIN', 'SUPER_ADMIN']),
  dashboardController.createExportTemplate.bind(dashboardController)
);

/**
 * @route PUT /api/dashboard/templates/:templateId
 * @desc Update export template
 * @access Private - requires UPDATE_EXPORT_TEMPLATES permission
 */
router.put('/templates/:templateId',
  authorizeRole(['UPDATE_EXPORT_TEMPLATES', 'ADMIN', 'SUPER_ADMIN']),
  dashboardController.updateExportTemplate.bind(dashboardController)
);

/**
 * @route DELETE /api/dashboard/templates/:templateId
 * @desc Delete export template
 * @access Private - requires DELETE_EXPORT_TEMPLATES permission
 */
router.delete('/templates/:templateId',
  authorizeRole(['DELETE_EXPORT_TEMPLATES', 'ADMIN', 'SUPER_ADMIN']),
  dashboardController.deleteExportTemplate.bind(dashboardController)
);

/**
 * @route GET /api/dashboard/scheduled-reports
 * @desc Get scheduled reports
 * @access Private - requires VIEW_SCHEDULED_REPORTS permission
 */
router.get('/scheduled-reports',
  authorizeRole(['VIEW_SCHEDULED_REPORTS', 'ADMIN', 'SUPER_ADMIN']),
  dashboardController.getScheduledReports.bind(dashboardController)
);

/**
 * @route POST /api/dashboard/scheduled-reports
 * @desc Schedule automated report
 * @access Private - requires ADMIN permission
 */
router.post('/scheduled-reports',
  authorizeRole(['ADMIN', 'SUPER_ADMIN']),
  dashboardController.scheduleReport.bind(dashboardController)
);

/**
 * @route PUT /api/dashboard/scheduled-reports/:reportId
 * @desc Update scheduled report
 * @access Private - requires UPDATE_SCHEDULED_REPORTS permission
 */
router.put('/scheduled-reports/:reportId',
  authorizeRole(['UPDATE_SCHEDULED_REPORTS', 'ADMIN', 'SUPER_ADMIN']),
  dashboardController.updateScheduledReport.bind(dashboardController)
);

/**
 * @route DELETE /api/dashboard/scheduled-reports/:reportId
 * @desc Delete scheduled report
 * @access Private - requires DELETE_SCHEDULED_REPORTS permission
 */
router.delete('/scheduled-reports/:reportId',
  authorizeRole(['DELETE_SCHEDULED_REPORTS', 'ADMIN', 'SUPER_ADMIN']),
  dashboardController.deleteScheduledReport.bind(dashboardController)
);

/**
 * @route POST /api/dashboard/export-job
 * @desc Create async export job
 * @access Private - requires EXPORT_DASHBOARDS permission
 */
router.post('/export-job',
  authorizeRole(['EXPORT_DASHBOARDS', 'ADMIN', 'SUPER_ADMIN']),
  dashboardController.createExportJob.bind(dashboardController)
);

/**
 * @route GET /api/dashboard/export-job/:jobId
 * @desc Get export job status
 * @access Private
 */
router.get('/export-job/:jobId',
  dashboardController.getExportJobStatus.bind(dashboardController)
);

/**
 * @route POST /api/dashboard/execute-scheduled-reports
 * @desc Execute scheduled reports manually
 * @access Private - requires ADMIN permission
 */
router.post('/execute-scheduled-reports',
  authorizeRole(['ADMIN', 'SUPER_ADMIN']),
  dashboardController.executeScheduledReports.bind(dashboardController)
);

/**
 * @route POST /api/dashboard/cleanup-exports
 * @desc Clean up old export files
 * @access Private - requires ADMIN permission
 */
router.post('/cleanup-exports',
  authorizeRole(['ADMIN', 'SUPER_ADMIN']),
  dashboardController.cleanupExports.bind(dashboardController)
);

/**
 * @route GET /api/dashboard/test-data
 * @desc Test dashboard data generation (development only)
 * @access Private - requires ADMIN permission
 */
router.get('/test-data',
  authorizeRole(['ADMIN', 'SUPER_ADMIN']),
  dashboardController.testDataGeneration.bind(dashboardController)
);

// Performance optimization routes
/**
 * @route GET /api/dashboard/performance/stats
 * @desc Get dashboard performance statistics
 * @access Private - requires ADMIN permission
 */
router.get('/performance/stats',
  authorizeRole(['ADMIN', 'SUPER_ADMIN']),
  dashboardController.getPerformanceStats.bind(dashboardController)
);

/**
 * @route POST /api/dashboard/performance/warm-cache
 * @desc Warm up dashboard cache
 * @access Private - requires ADMIN permission
 */
router.post('/performance/warm-cache',
  authorizeRole(['ADMIN', 'SUPER_ADMIN']),
  dashboardController.warmUpCache.bind(dashboardController)
);

/**
 * @route POST /api/dashboard/performance/invalidate-cache
 * @desc Invalidate dashboard cache
 * @access Private - requires ADMIN permission
 */
router.post('/performance/invalidate-cache',
  authorizeRole(['ADMIN', 'SUPER_ADMIN']),
  dashboardController.invalidateCache.bind(dashboardController)
);

/**
 * @route POST /api/dashboard/performance/initialize
 * @desc Initialize dashboard performance optimizations
 * @access Private - requires ADMIN permission
 */
router.post('/performance/initialize',
  authorizeRole(['ADMIN', 'SUPER_ADMIN']),
  dashboardController.initializeOptimizations.bind(dashboardController)
);

/**
 * @route GET /api/dashboard/component/:componentId
 * @desc Load specific dashboard component with lazy loading
 * @access Private - requires VIEW_ANALYTICS permission
 */
router.get('/component/:componentId',
  authorizeRole(['VIEW_ANALYTICS', 'VIEW_FINANCIAL_DATA']),
  dashboardController.loadComponent.bind(dashboardController)
);

// Vessel-specific dashboard routes
/**
 * @route GET /api/dashboard/vessel/:vesselId/spend-analytics
 * @desc Get vessel-specific spend analytics
 * @access Private - requires vessel access
 */
router.get('/vessel/:vesselId/spend-analytics',
  validateVesselAccess,
  authorizeRole(['VIEW_ANALYTICS', 'VIEW_FINANCIAL_DATA']),
  async (req, res) => {
    try {
      // Add vessel filter to the request
      req.query.vesselIds = [req.params.vesselId];
      await dashboardController.getSpendAnalytics(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get vessel spend analytics'
      });
    }
  }
);

/**
 * @route GET /api/dashboard/vessel/:vesselId/operational-metrics
 * @desc Get vessel-specific operational metrics
 * @access Private - requires vessel access
 */
router.get('/vessel/:vesselId/operational-metrics',
  validateVesselAccess,
  authorizeRole(['VIEW_OPERATIONS', 'VIEW_ANALYTICS']),
  async (req, res) => {
    try {
      // Add vessel filter to the request
      req.query.vesselIds = [req.params.vesselId];
      await dashboardController.getOperationalMetrics(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get vessel operational metrics'
      });
    }
  }
);

// Vendor-specific dashboard routes
/**
 * @route GET /api/dashboard/vendor/:vendorId/performance
 * @desc Get vendor-specific performance data
 * @access Private - requires VIEW_VENDORS permission
 */
router.get('/vendor/:vendorId/performance',
  authorizeRole(['VIEW_VENDORS', 'VIEW_ANALYTICS']),
  async (req, res) => {
    try {
      // Add vendor filter to the request
      req.query.vendorIds = [req.params.vendorId];
      await dashboardController.getVendorPerformance(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get vendor performance data'
      });
    }
  }
);

// Real-time dashboard health check
/**
 * @route GET /api/dashboard/health
 * @desc Dashboard service health check
 * @access Private
 */
router.get('/health', (req, res) => {
  try {
    const stats = {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        analytics: 'operational',
        websocket: 'operational',
        cache: 'operational'
      },
      performance: {
        activeSubscriptions: 0, // Would get from dashboardWebSocketService
        connectedUsers: 0,      // Would get from dashboardWebSocketService
        cacheHitRate: 0         // Would get from cacheService
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Dashboard health check failed'
    });
  }
});

export { router as dashboardRoutes };