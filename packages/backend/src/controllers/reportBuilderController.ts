import { Request, Response } from 'express';
import { reportBuilderService } from '../services/reportBuilderService';
import { reportSchedulerService } from '../services/reportSchedulerService';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';

class ReportBuilderController {
  // Template Management
  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const template = await reportBuilderService.createTemplate(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        data: template,
      });
    } catch (error) {
      logger.error('Failed to create report template', { error, userId: req.user.id });
      res.status(500).json({
        success: false,
        error: 'Failed to create report template',
      });
    }
  }

  async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const template = await reportBuilderService.updateTemplate(templateId, req.body, req.user.id);
      
      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      logger.error('Failed to update report template', { error, userId: req.user.id });
      res.status(500).json({
        success: false,
        error: 'Failed to update report template',
      });
    }
  }

  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      await reportBuilderService.deleteTemplate(templateId, req.user.id);
      
      res.json({
        success: true,
        message: 'Template deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete report template', { error, userId: req.user.id });
      res.status(500).json({
        success: false,
        error: 'Failed to delete report template',
      });
    }
  }

  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const { category, isPublic } = req.query;
      const filters: any = {};
      
      if (category) filters.category = category as string;
      if (isPublic !== undefined) filters.isPublic = isPublic === 'true';

      const templates = await reportBuilderService.getTemplates(req.user.id, filters);
      
      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      logger.error('Failed to get report templates', { error, userId: req.user.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get report templates',
      });
    }
  }

  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const templates = await reportBuilderService.getTemplates(req.user.id);
      const template = templates.find(t => t.id === templateId);
      
      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Template not found',
        });
        return;
      }

      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      logger.error('Failed to get report template', { error, userId: req.user.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get report template',
      });
    }
  }

  // Report Execution
  async executeReport(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const { parameters = {} } = req.body;

      const execution = await reportBuilderService.executeReport(templateId, parameters, req.user.id);
      
      res.json({
        success: true,
        data: execution,
      });
    } catch (error) {
      logger.error('Failed to execute report', { error, userId: req.user.id });
      res.status(500).json({
        success: false,
        error: 'Failed to execute report',
      });
    }
  }

  async getExecutionStatus(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params;
      
      // Get execution from database
      const execution = await reportBuilderService.getExecution(executionId);
      
      if (!execution) {
        res.status(404).json({
          success: false,
          error: 'Execution not found',
        });
        return;
      }

      res.json({
        success: true,
        data: execution,
      });
    } catch (error) {
      logger.error('Failed to get execution status', { error, userId: req.user.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get execution status',
      });
    }
  }

  // Scheduled Reports
  async createScheduledReport(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const scheduledReport = await reportBuilderService.createScheduledReport(req.body, req.user.id);
      
      // Schedule the report
      await reportSchedulerService.scheduleReport(scheduledReport);
      
      res.status(201).json({
        success: true,
        data: scheduledReport,
      });
    } catch (error) {
      logger.error('Failed to create scheduled report', { error, userId: req.user.id });
      res.status(500).json({
        success: false,
        error: 'Failed to create scheduled report',
      });
    }
  }

  async getScheduledReports(req: Request, res: Response): Promise<void> {
    try {
      const reports = await reportBuilderService.getScheduledReports(req.user.id);
      
      res.json({
        success: true,
        data: reports,
      });
    } catch (error) {
      logger.error('Failed to get scheduled reports', { error, userId: req.user.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get scheduled reports',
      });
    }
  }

  async updateScheduledReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      
      // Update schedule if provided
      if (req.body.schedule) {
        await reportSchedulerService.updateSchedule(reportId, req.body.schedule);
      }
      
      res.json({
        success: true,
        message: 'Scheduled report updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update scheduled report', { error, userId: req.user.id });
      res.status(500).json({
        success: false,
        error: 'Failed to update scheduled report',
      });
    }
  }

  async deleteScheduledReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      await reportSchedulerService.deleteSchedule(reportId);
      
      res.json({
        success: true,
        message: 'Scheduled report deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete scheduled report', { error, userId: req.user.id });
      res.status(500).json({
        success: false,
        error: 'Failed to delete scheduled report',
      });
    }
  }

  // Report Sharing
  async shareReport(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const { shareWith, permissions } = req.body;

      await reportBuilderService.shareReport(templateId, shareWith, permissions, req.user.id);
      
      res.json({
        success: true,
        message: 'Report shared successfully',
      });
    } catch (error) {
      logger.error('Failed to share report', { error, userId: req.user.id });
      res.status(500).json({
        success: false,
        error: 'Failed to share report',
      });
    }
  }

  async getSharedReports(req: Request, res: Response): Promise<void> {
    try {
      const reports = await reportBuilderService.getSharedReports(req.user.email);
      
      res.json({
        success: true,
        data: reports,
      });
    } catch (error) {
      logger.error('Failed to get shared reports', { error, userId: req.user.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get shared reports',
      });
    }
  }

  // Data Sources and Visualization Options
  async getDataSources(req: Request, res: Response): Promise<void> {
    try {
      const dataSources = [
        { id: 'requisitions', name: 'Requisitions', tables: ['requisitions', 'requisition_items'] },
        { id: 'vendors', name: 'Vendors', tables: ['vendors', 'vendor_performance'] },
        { id: 'purchase_orders', name: 'Purchase Orders', tables: ['purchase_orders', 'po_line_items'] },
        { id: 'financial', name: 'Financial', tables: ['invoices', 'payments', 'budget_allocations'] },
        { id: 'vessels', name: 'Vessels', tables: ['vessels', 'vessel_assignments'] },
        { id: 'analytics', name: 'Analytics', tables: ['dashboard_analytics', 'performance_metrics'] },
      ];

      res.json({
        success: true,
        data: dataSources,
      });
    } catch (error) {
      logger.error('Failed to get data sources', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get data sources',
      });
    }
  }

  async getVisualizationTypes(req: Request, res: Response): Promise<void> {
    try {
      const visualizationTypes = [
        {
          type: 'table',
          name: 'Data Table',
          description: 'Display data in tabular format',
          requiredFields: ['columns'],
          optionalFields: ['sorting', 'filtering', 'pagination'],
        },
        {
          type: 'chart',
          name: 'Chart',
          description: 'Various chart types for data visualization',
          subtypes: ['line', 'bar', 'pie', 'area', 'scatter'],
          requiredFields: ['x', 'y'],
          optionalFields: ['color', 'size', 'label'],
        },
        {
          type: 'kpi',
          name: 'KPI Card',
          description: 'Key Performance Indicator display',
          requiredFields: ['value'],
          optionalFields: ['target', 'trend', 'format'],
        },
        {
          type: 'gauge',
          name: 'Gauge',
          description: 'Circular gauge for metrics',
          requiredFields: ['value', 'min', 'max'],
          optionalFields: ['thresholds', 'color'],
        },
        {
          type: 'map',
          name: 'Geographic Map',
          description: 'Display data on a map',
          requiredFields: ['latitude', 'longitude'],
          optionalFields: ['marker', 'popup', 'cluster'],
        },
      ];

      res.json({
        success: true,
        data: visualizationTypes,
      });
    } catch (error) {
      logger.error('Failed to get visualization types', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get visualization types',
      });
    }
  }
}

export const reportBuilderController = new ReportBuilderController();