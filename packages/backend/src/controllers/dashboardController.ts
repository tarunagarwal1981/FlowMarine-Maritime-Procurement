import { Request, Response } from 'express';
import { dashboardAnalyticsService, DashboardFilters } from '../services/dashboardAnalyticsService.js';
import { dashboardWebSocketService } from '../services/dashboardWebSocketService.js';
import { dashboardExportService, ExportOptions } from '../services/dashboardExportService.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

// Validation schemas
const DashboardFiltersSchema = z.object({
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  vesselIds: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  vendorIds: z.array(z.string()).optional(),
  currencies: z.array(z.string()).optional(),
  baseCurrency: z.string().optional()
});

const DashboardDataRequestSchema = z.object({
  dashboardType: z.enum(['executive', 'operational', 'financial', 'custom']),
  dataTypes: z.array(z.string()),
  filters: DashboardFiltersSchema,
  refreshInterval: z.number().optional()
});

const ExportRequestSchema = z.object({
  format: z.enum(['pdf', 'excel', 'csv']),
  dashboardType: z.enum(['executive', 'operational', 'financial', 'custom']),
  dataTypes: z.array(z.string()),
  filters: DashboardFiltersSchema,
  includeCharts: z.boolean().default(true),
  templateId: z.string().optional(),
  customTitle: z.string().optional(),
  includeMetadata: z.boolean().default(true),
  compression: z.boolean().default(false)
});

/**
 * Dashboard Controller
 * Handles dashboard data requests and WebSocket subscription management
 */
export class DashboardController {
  /**
   * Get comprehensive dashboard data with performance optimization
   */
  async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      const validation = DashboardDataRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors
        });
        return;
      }

      const { dashboardType, dataTypes, filters, refreshInterval } = validation.data;

      logger.info(`Optimized dashboard data requested by user ${req.user?.id}`, {
        dashboardType,
        dataTypes,
        filters,
        refreshInterval
      });

      // Use batch loading for better performance
      const componentRequests = dataTypes.map(dataType => ({
        componentId: this.mapDataTypeToComponent(dataType),
        filters,
        options: {
          priority: this.getDataTypePriority(dataType),
          timeout: 30000 // 30 seconds timeout
        }
      }));

      const batchResults = await dashboardAnalyticsService.batchLoadDashboardComponents(componentRequests);

      // Transform results to expected format
      const dashboardData: Record<string, any> = {};
      for (const [componentId, data] of Object.entries(batchResults)) {
        const dataType = this.mapComponentToDataType(componentId);
        dashboardData[dataType] = data;
      }

      res.json({
        success: true,
        data: {
          dashboardType,
          data: dashboardData,
          timestamp: new Date(),
          filters,
          performance: {
            optimized: true,
            batchLoaded: true,
            componentCount: dataTypes.length
          }
        }
      });

    } catch (error) {
      logger.error('Error in optimized getDashboardData:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get spend analytics data
   */
  async getSpendAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const validation = DashboardFiltersSchema.safeParse(req.query);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid filter parameters',
          details: validation.error.errors
        });
        return;
      }

      const filters = validation.data;
      const spendAnalytics = await dashboardAnalyticsService.generateSpendAnalytics(filters);

      res.json({
        success: true,
        data: spendAnalytics
      });

    } catch (error) {
      logger.error('Error in getSpendAnalytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate spend analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get budget utilization data
   */
  async getBudgetUtilization(req: Request, res: Response): Promise<void> {
    try {
      const validation = DashboardFiltersSchema.safeParse(req.query);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid filter parameters',
          details: validation.error.errors
        });
        return;
      }

      const filters = validation.data;
      const budgetUtilization = await dashboardAnalyticsService.generateBudgetUtilization(filters);

      res.json({
        success: true,
        data: budgetUtilization
      });

    } catch (error) {
      logger.error('Error in getBudgetUtilization:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate budget utilization data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get vendor performance analytics
   */
  async getVendorPerformance(req: Request, res: Response): Promise<void> {
    try {
      const validation = DashboardFiltersSchema.safeParse(req.query);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid filter parameters',
          details: validation.error.errors
        });
        return;
      }

      const filters = validation.data;
      const vendorPerformance = await dashboardAnalyticsService.generateVendorPerformanceAnalytics(filters);

      res.json({
        success: true,
        data: vendorPerformance
      });

    } catch (error) {
      logger.error('Error in getVendorPerformance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate vendor performance analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get operational metrics
   */
  async getOperationalMetrics(req: Request, res: Response): Promise<void> {
    try {
      const validation = DashboardFiltersSchema.safeParse(req.query);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid filter parameters',
          details: validation.error.errors
        });
        return;
      }

      const filters = validation.data;
      const operationalMetrics = await dashboardAnalyticsService.generateOperationalMetrics(filters);

      res.json({
        success: true,
        data: operationalMetrics
      });

    } catch (error) {
      logger.error('Error in getOperationalMetrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate operational metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get financial insights
   */
  async getFinancialInsights(req: Request, res: Response): Promise<void> {
    try {
      const validation = DashboardFiltersSchema.safeParse(req.query);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid filter parameters',
          details: validation.error.errors
        });
        return;
      }

      const filters = validation.data;
      const financialInsights = await dashboardAnalyticsService.generateFinancialInsights(filters);

      res.json({
        success: true,
        data: financialInsights
      });

    } catch (error) {
      logger.error('Error in getFinancialInsights:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate financial insights',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get WebSocket subscription statistics
   */
  async getSubscriptionStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = dashboardWebSocketService.getSubscriptionStatistics();

      res.json({
        success: true,
        data: {
          ...stats,
          timestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Error in getSubscriptionStats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get subscription statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send dashboard notification (admin only)
   */
  async sendNotification(req: Request, res: Response): Promise<void> {
    try {
      const notificationSchema = z.object({
        type: z.enum(['data_update', 'alert', 'threshold_breach', 'anomaly_detected']),
        title: z.string(),
        message: z.string(),
        data: z.any(),
        priority: z.enum(['low', 'medium', 'high', 'critical']),
        dashboardType: z.string().optional(),
        userId: z.string().optional(),
        vesselId: z.string().optional()
      });

      const validation = notificationSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid notification data',
          details: validation.error.errors
        });
        return;
      }

      const notification = validation.data;
      await dashboardWebSocketService.sendDashboardNotification(notification);

      res.json({
        success: true,
        message: 'Notification sent successfully'
      });

    } catch (error) {
      logger.error('Error in sendNotification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Export dashboard data to PDF
   */
  async exportToPDF(req: Request, res: Response): Promise<void> {
    try {
      const validation = ExportRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid export request data',
          details: validation.error.errors
        });
        return;
      }

      const exportOptions: ExportOptions = {
        ...validation.data,
        format: 'pdf'
      };

      const pdfBuffer = await dashboardExportService.exportToPDF(exportOptions, req.user!.id);

      const fileName = `dashboard_${exportOptions.dashboardType}_${new Date().toISOString().split('T')[0]}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);

    } catch (error) {
      logger.error('Error in exportToPDF:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export dashboard to PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Export dashboard data to Excel
   */
  async exportToExcel(req: Request, res: Response): Promise<void> {
    try {
      const validation = ExportRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid export request data',
          details: validation.error.errors
        });
        return;
      }

      const exportOptions: ExportOptions = {
        ...validation.data,
        format: 'excel'
      };

      const excelBuffer = await dashboardExportService.exportToExcel(exportOptions, req.user!.id);

      const fileName = `dashboard_${exportOptions.dashboardType}_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', excelBuffer.length);

      res.send(excelBuffer);

    } catch (error) {
      logger.error('Error in exportToExcel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export dashboard to Excel',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create export template
   */
  async createExportTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateSchema = z.object({
        name: z.string(),
        description: z.string(),
        dashboardType: z.string(),
        layout: z.any(),
        styling: z.any(),
        permissions: z.array(z.string())
      });

      const validation = templateSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid template data',
          details: validation.error.errors
        });
        return;
      }

      const template = await dashboardExportService.createExportTemplate({
        ...validation.data,
        isActive: true,
        createdBy: req.user!.id
      });

      res.json({
        success: true,
        data: template
      });

    } catch (error) {
      logger.error('Error in createExportTemplate:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create export template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Schedule automated report
   */
  async scheduleReport(req: Request, res: Response): Promise<void> {
    try {
      const scheduleSchema = z.object({
        name: z.string(),
        description: z.string(),
        exportOptions: ExportRequestSchema,
        schedule: z.object({
          frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
          dayOfWeek: z.number().min(0).max(6).optional(),
          dayOfMonth: z.number().min(1).max(31).optional(),
          time: z.string().regex(/^\d{2}:\d{2}$/),
          timezone: z.string()
        }),
        recipients: z.array(z.string().email()),
        isActive: z.boolean().default(true)
      });

      const validation = scheduleSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid schedule data',
          details: validation.error.errors
        });
        return;
      }

      const scheduledReport = await dashboardExportService.scheduleReport({
        ...validation.data,
        userId: req.user!.id
      });

      res.json({
        success: true,
        data: scheduledReport
      });

    } catch (error) {
      logger.error('Error in scheduleReport:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule report',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get export job status
   */
  async getExportJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      
      if (!jobId) {
        res.status(400).json({
          success: false,
          error: 'Job ID is required'
        });
        return;
      }

      const job = await dashboardExportService.getExportJobStatus(jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          error: 'Export job not found'
        });
        return;
      }

      res.json({
        success: true,
        data: job
      });

    } catch (error) {
      logger.error('Error in getExportJobStatus:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get export job status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get export templates
   */
  async getExportTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await dashboardExportService.getExportTemplates(req.user!.id);

      res.json({
        success: true,
        data: templates
      });

    } catch (error) {
      logger.error('Error in getExportTemplates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get export templates',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update export template
   */
  async updateExportTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      
      if (!templateId) {
        res.status(400).json({
          success: false,
          error: 'Template ID is required'
        });
        return;
      }

      const updateSchema = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        layout: z.any().optional(),
        styling: z.any().optional(),
        permissions: z.array(z.string()).optional(),
        isActive: z.boolean().optional()
      });

      const validation = updateSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid update data',
          details: validation.error.errors
        });
        return;
      }

      const updatedTemplate = await dashboardExportService.updateExportTemplate(
        templateId, 
        validation.data, 
        req.user!.id
      );

      res.json({
        success: true,
        data: updatedTemplate
      });

    } catch (error) {
      logger.error('Error in updateExportTemplate:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update export template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete export template
   */
  async deleteExportTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      
      if (!templateId) {
        res.status(400).json({
          success: false,
          error: 'Template ID is required'
        });
        return;
      }

      await dashboardExportService.deleteExportTemplate(templateId, req.user!.id);

      res.json({
        success: true,
        message: 'Export template deleted successfully'
      });

    } catch (error) {
      logger.error('Error in deleteExportTemplate:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete export template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get scheduled reports
   */
  async getScheduledReports(req: Request, res: Response): Promise<void> {
    try {
      const reports = await dashboardExportService.getScheduledReports(req.user!.id);

      res.json({
        success: true,
        data: reports
      });

    } catch (error) {
      logger.error('Error in getScheduledReports:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get scheduled reports',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update scheduled report
   */
  async updateScheduledReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      
      if (!reportId) {
        res.status(400).json({
          success: false,
          error: 'Report ID is required'
        });
        return;
      }

      const updateSchema = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        exportOptions: ExportRequestSchema.optional(),
        schedule: z.object({
          frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
          dayOfWeek: z.number().min(0).max(6).optional(),
          dayOfMonth: z.number().min(1).max(31).optional(),
          time: z.string().regex(/^\d{2}:\d{2}$/),
          timezone: z.string()
        }).optional(),
        recipients: z.array(z.string().email()).optional(),
        isActive: z.boolean().optional()
      });

      const validation = updateSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid update data',
          details: validation.error.errors
        });
        return;
      }

      const updatedReport = await dashboardExportService.updateScheduledReport(
        reportId, 
        validation.data, 
        req.user!.id
      );

      res.json({
        success: true,
        data: updatedReport
      });

    } catch (error) {
      logger.error('Error in updateScheduledReport:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update scheduled report',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete scheduled report
   */
  async deleteScheduledReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      
      if (!reportId) {
        res.status(400).json({
          success: false,
          error: 'Report ID is required'
        });
        return;
      }

      await dashboardExportService.deleteScheduledReport(reportId, req.user!.id);

      res.json({
        success: true,
        message: 'Scheduled report deleted successfully'
      });

    } catch (error) {
      logger.error('Error in deleteScheduledReport:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete scheduled report',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create async export job
   */
  async createExportJob(req: Request, res: Response): Promise<void> {
    try {
      const validation = ExportRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid export request data',
          details: validation.error.errors
        });
        return;
      }

      const exportOptions: ExportOptions = validation.data;
      const jobId = await dashboardExportService.createExportJob(exportOptions, req.user!.id);

      res.json({
        success: true,
        data: {
          jobId,
          message: 'Export job created successfully'
        }
      });

    } catch (error) {
      logger.error('Error in createExportJob:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create export job',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Execute scheduled reports manually (admin only)
   */
  async executeScheduledReports(req: Request, res: Response): Promise<void> {
    try {
      await dashboardExportService.executeScheduledReports();

      res.json({
        success: true,
        message: 'Scheduled reports execution initiated'
      });

    } catch (error) {
      logger.error('Error in executeScheduledReports:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute scheduled reports',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clean up old export files (admin only)
   */
  async cleanupExports(req: Request, res: Response): Promise<void> {
    try {
      await dashboardExportService.cleanupOldExports();

      res.json({
        success: true,
        message: 'Export cleanup completed'
      });

    } catch (error) {
      logger.error('Error in cleanupExports:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup exports',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get port efficiency analytics data
   */
  async getPortEfficiencyAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const validation = DashboardFiltersSchema.safeParse(req.query);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid filter parameters',
          details: validation.error.errors
        });
        return;
      }

      const filters = validation.data;
      const portEfficiencyData = await dashboardAnalyticsService.generatePortEfficiencyAnalytics(filters);

      res.json({
        success: true,
        data: portEfficiencyData
      });

    } catch (error) {
      logger.error('Error in getPortEfficiencyAnalytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate port efficiency analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Export port efficiency analytics data
   */
  async exportPortEfficiencyAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const validation = ExportRequestSchema.safeParse(req.query);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid export parameters',
          details: validation.error.errors
        });
        return;
      }

      const { format, filters, includeCharts, customTitle } = validation.data;
      
      // Generate port efficiency data
      const portEfficiencyData = await dashboardAnalyticsService.generatePortEfficiencyAnalytics(filters);
      
      // Export options
      const exportOptions: ExportOptions = {
        format,
        data: portEfficiencyData,
        title: customTitle || 'Port Efficiency Analytics Report',
        includeCharts: includeCharts,
        metadata: {
          generatedAt: new Date(),
          generatedBy: req.user?.email || 'Unknown',
          filters,
          reportType: 'port_efficiency'
        }
      };

      const exportResult = await dashboardExportService.exportDashboardData(exportOptions);

      // Set appropriate headers for file download
      const filename = `port-efficiency-${format}-${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      
      res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      res.send(exportResult.buffer);

    } catch (error) {
      logger.error('Error in exportPortEfficiencyAnalytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export port efficiency analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test dashboard data generation (development only)
   */
  async testDataGeneration(req: Request, res: Response): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'production') {
        res.status(403).json({
          success: false,
          error: 'Test endpoints not available in production'
        });
        return;
      }

  /**
   * Get dashboard performance statistics
   */
  async getPerformanceStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await dashboardAnalyticsService.getDashboardPerformanceStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error in getPerformanceStats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Warm up dashboard cache
   */
  async warmUpCache(req: Request, res: Response): Promise<void> {
    try {
      await dashboardAnalyticsService.warmUpDashboardCache();

      res.json({
        success: true,
        message: 'Dashboard cache warm-up initiated'
      });

    } catch (error) {
      logger.error('Error in warmUpCache:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to warm up cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Invalidate dashboard cache
   */
  async invalidateCache(req: Request, res: Response): Promise<void> {
    try {
      const { dataType, componentIds } = req.body;

      if (!dataType) {
        res.status(400).json({
          success: false,
          error: 'Data type is required'
        });
        return;
      }

      await dashboardAnalyticsService.invalidateDashboardCache(dataType, componentIds);

      res.json({
        success: true,
        message: `Cache invalidated for data type: ${dataType}`
      });

    } catch (error) {
      logger.error('Error in invalidateCache:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to invalidate cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Load specific dashboard component with lazy loading
   */
  async loadComponent(req: Request, res: Response): Promise<void> {
    try {
      const { componentId } = req.params;
      const validation = DashboardFiltersSchema.safeParse(req.query);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid filter parameters',
          details: validation.error.errors
        });
        return;
      }

      const filters = validation.data;
      const { priority, timeout } = req.query;

      const data = await dashboardAnalyticsService.loadDashboardComponent(
        componentId,
        filters,
        {
          priority: priority ? Number(priority) : undefined,
          timeout: timeout ? Number(timeout) : undefined
        }
      );

      res.json({
        success: true,
        data: {
          componentId,
          data,
          loadedAt: new Date(),
          filters
        }
      });

    } catch (error) {
      logger.error('Error in loadComponent:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load component',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Initialize dashboard performance optimizations
   */
  async initializeOptimizations(req: Request, res: Response): Promise<void> {
    try {
      await dashboardAnalyticsService.initializePerformanceOptimizations();

      res.json({
        success: true,
        message: 'Dashboard performance optimizations initialized'
      });

    } catch (error) {
      logger.error('Error in initializeOptimizations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initialize optimizations',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Helper methods for data type and component mapping

  private mapDataTypeToComponent(dataType: string): string {
    const mapping: { [key: string]: string } = {
      'spend_analytics': 'fleet_spend_visualization',
      'budget_utilization': 'budget_utilization_dashboard',
      'vendor_performance': 'vendor_performance_scorecards',
      'operational_metrics': 'operational_metrics',
      'financial_insights': 'financial_insights',
      'port_efficiency': 'port_efficiency_analytics'
    };

    return mapping[dataType] || dataType;
  }

  private mapComponentToDataType(componentId: string): string {
    const mapping: { [key: string]: string } = {
      'fleet_spend_visualization': 'spend_analytics',
      'budget_utilization_dashboard': 'budget_utilization',
      'vendor_performance_scorecards': 'vendor_performance',
      'operational_metrics': 'operational_metrics',
      'financial_insights': 'financial_insights',
      'port_efficiency_analytics': 'port_efficiency'
    };

    return mapping[componentId] || componentId;
  }

  private getDataTypePriority(dataType: string): number {
    const priorities: { [key: string]: number } = {
      'spend_analytics': 1,
      'budget_utilization': 1,
      'vendor_performance': 2,
      'operational_metrics': 2,
      'financial_insights': 3,
      'port_efficiency': 3
    };

    return priorities[dataType] || 2;
  }

  /**
   * Test dashboard data generation (development only)
   */
  async testDataGeneration(req: Request, res: Response): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'production') {
        res.status(403).json({
          success: false,
          error: 'Test endpoints not available in production'
        });
        return;
      }

      const testFilters: DashboardFilters = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        endDate: new Date(),
        baseCurrency: 'USD'
      };

      const testResults = {
        spendAnalytics: await dashboardAnalyticsService.generateSpendAnalytics(testFilters),
        budgetUtilization: await dashboardAnalyticsService.generateBudgetUtilization(testFilters),
        vendorPerformance: await dashboardAnalyticsService.generateVendorPerformanceAnalytics(testFilters),
        operationalMetrics: await dashboardAnalyticsService.generateOperationalMetrics(testFilters),
        financialInsights: await dashboardAnalyticsService.generateFinancialInsights(testFilters)
      };

      res.json({
        success: true,
        data: testResults,
        message: 'Test data generation completed'
      });

    } catch (error) {
      logger.error('Error in testDataGeneration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate test data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  /**
   * Get inventory turnover analysis
   */
  async getInventoryTurnoverAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const filters = this.parseInventoryDemandFilters(req.query);
      
      const { InventoryDemandAnalyticsService } = await import('../services/inventoryDemandAnalyticsService.js');
      const service = new InventoryDemandAnalyticsService();
      
      const data = await service.getInventoryTurnoverAnalysis(filters);
      
      res.json({
        success: true,
        data,
        lastUpdated: new Date(),
        metadata: {
          filters,
          executionTime: Date.now() - req.startTime
        }
      });
    } catch (error) {
      logger.error('Error getting inventory turnover analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get inventory turnover analysis'
      });
    }
  }

  /**
   * Get demand forecast data
   */
  async getDemandForecast(req: Request, res: Response): Promise<void> {
    try {
      const filters = this.parseInventoryDemandFilters(req.query);
      
      const { InventoryDemandAnalyticsService } = await import('../services/inventoryDemandAnalyticsService.js');
      const service = new InventoryDemandAnalyticsService();
      
      const data = await service.getDemandForecast(filters);
      
      res.json({
        success: true,
        data,
        lastUpdated: new Date(),
        metadata: {
          filters,
          executionTime: Date.now() - req.startTime
        }
      });
    } catch (error) {
      logger.error('Error getting demand forecast:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get demand forecast'
      });
    }
  }

  /**
   * Get inventory optimization recommendations
   */
  async getInventoryOptimization(req: Request, res: Response): Promise<void> {
    try {
      const filters = this.parseInventoryDemandFilters(req.query);
      
      const { InventoryDemandAnalyticsService } = await import('../services/inventoryDemandAnalyticsService.js');
      const service = new InventoryDemandAnalyticsService();
      
      const data = await service.getOptimizationRecommendations(filters);
      
      res.json({
        success: true,
        data,
        lastUpdated: new Date(),
        metadata: {
          filters,
          executionTime: Date.now() - req.startTime
        }
      });
    } catch (error) {
      logger.error('Error getting inventory optimization:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get inventory optimization recommendations'
      });
    }
  }

  /**
   * Get stock alerts and monitoring data
   */
  async getStockAlerts(req: Request, res: Response): Promise<void> {
    try {
      const filters = this.parseInventoryDemandFilters(req.query);
      
      const { InventoryDemandAnalyticsService } = await import('../services/inventoryDemandAnalyticsService.js');
      const service = new InventoryDemandAnalyticsService();
      
      const data = await service.getStockAlerts(filters);
      
      res.json({
        success: true,
        data,
        lastUpdated: new Date(),
        metadata: {
          filters,
          executionTime: Date.now() - req.startTime
        }
      });
    } catch (error) {
      logger.error('Error getting stock alerts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stock alerts'
      });
    }
  }

  /**
   * Get predictive maintenance data
   */
  async getPredictiveMaintenanceData(req: Request, res: Response): Promise<void> {
    try {
      const filters = this.parseInventoryDemandFilters(req.query);
      
      const { InventoryDemandAnalyticsService } = await import('../services/inventoryDemandAnalyticsService.js');
      const service = new InventoryDemandAnalyticsService();
      
      const data = await service.getPredictiveMaintenanceData(filters);
      
      res.json({
        success: true,
        data,
        lastUpdated: new Date(),
        metadata: {
          filters,
          executionTime: Date.now() - req.startTime
        }
      });
    } catch (error) {
      logger.error('Error getting predictive maintenance data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get predictive maintenance data'
      });
    }
  }

  /**
   * Parse inventory demand filters from query parameters
   */
  private parseInventoryDemandFilters(query: any) {
    const filters: any = {
      timeRange: {
        start: query.startDate ? new Date(query.startDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        end: query.endDate ? new Date(query.endDate) : new Date()
      }
    };

    if (query.vesselIds) {
      filters.vesselIds = Array.isArray(query.vesselIds) ? query.vesselIds : query.vesselIds.split(',');
    }

    if (query.vesselId) {
      filters.selectedVessel = query.vesselId;
    }

    if (query.categories) {
      filters.categories = Array.isArray(query.categories) ? query.categories : query.categories.split(',');
    }

    return filters;
  }
}

export const dashboardController = new DashboardController();