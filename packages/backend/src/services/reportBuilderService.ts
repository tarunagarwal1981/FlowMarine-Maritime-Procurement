import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { auditService } from './auditService';
import { dashboardAnalyticsService } from './dashboardAnalyticsService';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  dataSource: string;
  query: string;
  parameters: ReportParameter[];
  visualizations: ReportVisualization[];
  layout: ReportLayout;
  permissions: string[];
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ReportParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  label: string;
  required: boolean;
  defaultValue?: any;
  options?: { value: any; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface ReportVisualization {
  id: string;
  type: 'table' | 'chart' | 'kpi' | 'gauge' | 'map';
  title: string;
  dataMapping: Record<string, string>;
  configuration: Record<string, any>;
  position: { x: number; y: number; width: number; height: number };
}

interface ReportLayout {
  type: 'grid' | 'flow' | 'dashboard';
  columns: number;
  spacing: number;
  responsive: boolean;
}

interface ReportExecution {
  id: string;
  templateId: string;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  executedBy: string;
  executedAt: Date;
  completedAt?: Date;
}

interface ScheduledReport {
  id: string;
  templateId: string;
  name: string;
  schedule: {
    type: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  parameters: Record<string, any>;
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv' | 'html';
  isActive: boolean;
  lastRun?: Date;
  nextRun: Date;
  createdBy: string;
}

class ReportBuilderService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Template Management
  async createTemplate(templateData: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<ReportTemplate> {
    try {
      const template = await this.prisma.reportTemplate.create({
        data: {
          ...templateData,
          createdBy: userId,
        },
      });

      await auditService.log({
        userId,
        action: 'REPORT_TEMPLATE_CREATED',
        resource: 'ReportTemplate',
        resourceId: template.id,
        details: { templateName: template.name },
      });

      logger.info('Report template created', { templateId: template.id, userId });
      return template as ReportTemplate;
    } catch (error) {
      logger.error('Failed to create report template', { error, userId });
      throw new Error('Failed to create report template');
    }
  }

  async updateTemplate(templateId: string, updates: Partial<ReportTemplate>, userId: string): Promise<ReportTemplate> {
    try {
      const template = await this.prisma.reportTemplate.update({
        where: { id: templateId },
        data: updates,
      });

      await auditService.log({
        userId,
        action: 'REPORT_TEMPLATE_UPDATED',
        resource: 'ReportTemplate',
        resourceId: templateId,
        details: { updates },
      });

      return template as ReportTemplate;
    } catch (error) {
      logger.error('Failed to update report template', { error, templateId, userId });
      throw new Error('Failed to update report template');
    }
  }

  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    try {
      await this.prisma.reportTemplate.delete({
        where: { id: templateId },
      });

      await auditService.log({
        userId,
        action: 'REPORT_TEMPLATE_DELETED',
        resource: 'ReportTemplate',
        resourceId: templateId,
      });

      logger.info('Report template deleted', { templateId, userId });
    } catch (error) {
      logger.error('Failed to delete report template', { error, templateId, userId });
      throw new Error('Failed to delete report template');
    }
  }

  async getTemplates(userId: string, filters?: { category?: string; isPublic?: boolean }): Promise<ReportTemplate[]> {
    try {
      const where: any = {
        OR: [
          { isPublic: true },
          { createdBy: userId },
        ],
      };

      if (filters?.category) {
        where.category = filters.category;
      }

      if (filters?.isPublic !== undefined) {
        where.isPublic = filters.isPublic;
      }

      const templates = await this.prisma.reportTemplate.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
      });

      return templates as ReportTemplate[];
    } catch (error) {
      logger.error('Failed to get report templates', { error, userId });
      throw new Error('Failed to get report templates');
    }
  }

  // Report Execution
  async executeReport(templateId: string, parameters: Record<string, any>, userId: string): Promise<ReportExecution> {
    try {
      const template = await this.prisma.reportTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        throw new Error('Report template not found');
      }

      const execution = await this.prisma.reportExecution.create({
        data: {
          templateId,
          parameters,
          status: 'pending',
          executedBy: userId,
          executedAt: new Date(),
        },
      });

      // Execute report asynchronously
      this.processReportExecution(execution.id);

      return execution as ReportExecution;
    } catch (error) {
      logger.error('Failed to execute report', { error, templateId, userId });
      throw new Error('Failed to execute report');
    }
  }

  private async processReportExecution(executionId: string): Promise<void> {
    try {
      await this.prisma.reportExecution.update({
        where: { id: executionId },
        data: { status: 'running' },
      });

      const execution = await this.prisma.reportExecution.findUnique({
        where: { id: executionId },
        include: { template: true },
      });

      if (!execution) {
        throw new Error('Execution not found');
      }

      // Generate report data based on template
      const result = await this.generateReportData(execution.template, execution.parameters);

      await this.prisma.reportExecution.update({
        where: { id: executionId },
        data: {
          status: 'completed',
          result,
          completedAt: new Date(),
        },
      });

      logger.info('Report execution completed', { executionId });
    } catch (error) {
      logger.error('Report execution failed', { error, executionId });
      
      await this.prisma.reportExecution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          error: error.message,
          completedAt: new Date(),
        },
      });
    }
  }

  private async generateReportData(template: any, parameters: Record<string, any>): Promise<any> {
    // Build dynamic query based on template and parameters
    const query = this.buildQuery(template.query, parameters);
    
    // Execute query and return results
    const rawData = await this.executeQuery(query, template.dataSource);
    
    // Apply visualizations and formatting
    return this.formatReportData(rawData, template.visualizations);
  }

  private buildQuery(queryTemplate: string, parameters: Record<string, any>): string {
    let query = queryTemplate;
    
    // Replace parameter placeholders
    Object.entries(parameters).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      query = query.replace(new RegExp(placeholder, 'g'), this.escapeValue(value));
    });
    
    return query;
  }

  private escapeValue(value: any): string {
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    return String(value);
  }

  private async executeQuery(query: string, dataSource: string): Promise<any[]> {
    // Execute query against specified data source
    return await this.prisma.$queryRawUnsafe(query);
  }

  private formatReportData(rawData: any[], visualizations: ReportVisualization[]): any {
    return {
      data: rawData,
      visualizations: visualizations.map(viz => ({
        ...viz,
        processedData: this.processVisualizationData(rawData, viz),
      })),
      metadata: {
        recordCount: rawData.length,
        generatedAt: new Date(),
      },
    };
  }

  private processVisualizationData(data: any[], visualization: ReportVisualization): any {
    switch (visualization.type) {
      case 'table':
        return data;
      case 'chart':
        return this.processChartData(data, visualization);
      case 'kpi':
        return this.processKPIData(data, visualization);
      default:
        return data;
    }
  }

  private processChartData(data: any[], visualization: ReportVisualization): any {
    const { dataMapping, configuration } = visualization;
    
    return {
      labels: data.map(row => row[dataMapping.x]),
      datasets: [{
        label: configuration.label || 'Data',
        data: data.map(row => row[dataMapping.y]),
        backgroundColor: configuration.backgroundColor,
        borderColor: configuration.borderColor,
      }],
    };
  }

  private processKPIData(data: any[], visualization: ReportVisualization): any {
    const { dataMapping } = visualization;
    const value = data.reduce((sum, row) => sum + (row[dataMapping.value] || 0), 0);
    
    return {
      value,
      label: visualization.title,
      format: dataMapping.format || 'number',
    };
  }

  // Scheduled Reports
  async createScheduledReport(reportData: Omit<ScheduledReport, 'id' | 'lastRun' | 'nextRun'>, userId: string): Promise<ScheduledReport> {
    try {
      const nextRun = this.calculateNextRun(reportData.schedule);
      
      const scheduledReport = await this.prisma.scheduledReport.create({
        data: {
          ...reportData,
          nextRun,
          createdBy: userId,
        },
      });

      await auditService.log({
        userId,
        action: 'SCHEDULED_REPORT_CREATED',
        resource: 'ScheduledReport',
        resourceId: scheduledReport.id,
      });

      return scheduledReport as ScheduledReport;
    } catch (error) {
      logger.error('Failed to create scheduled report', { error, userId });
      throw new Error('Failed to create scheduled report');
    }
  }

  private calculateNextRun(schedule: ScheduledReport['schedule']): Date {
    const now = new Date();
    const nextRun = new Date();
    
    switch (schedule.type) {
      case 'daily':
        nextRun.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        const daysUntilNext = (7 + (schedule.dayOfWeek || 0) - now.getDay()) % 7;
        nextRun.setDate(now.getDate() + (daysUntilNext || 7));
        break;
      case 'monthly':
        nextRun.setMonth(now.getMonth() + 1);
        nextRun.setDate(schedule.dayOfMonth || 1);
        break;
      case 'quarterly':
        nextRun.setMonth(now.getMonth() + 3);
        nextRun.setDate(1);
        break;
    }
    
    const [hours, minutes] = schedule.time.split(':').map(Number);
    nextRun.setHours(hours, minutes, 0, 0);
    
    return nextRun;
  }

  async getScheduledReports(userId: string): Promise<ScheduledReport[]> {
    try {
      const reports = await this.prisma.scheduledReport.findMany({
        where: { createdBy: userId },
        orderBy: { nextRun: 'asc' },
      });

      return reports as ScheduledReport[];
    } catch (error) {
      logger.error('Failed to get scheduled reports', { error, userId });
      throw new Error('Failed to get scheduled reports');
    }
  }

  // Report Sharing and Collaboration
  async shareReport(templateId: string, shareWith: string[], permissions: string[], userId: string): Promise<void> {
    try {
      await this.prisma.reportShare.createMany({
        data: shareWith.map(email => ({
          templateId,
          sharedWith: email,
          permissions: permissions.join(','),
          sharedBy: userId,
        })),
      });

      await auditService.log({
        userId,
        action: 'REPORT_SHARED',
        resource: 'ReportTemplate',
        resourceId: templateId,
        details: { shareWith, permissions },
      });

      logger.info('Report shared', { templateId, shareWith, userId });
    } catch (error) {
      logger.error('Failed to share report', { error, templateId, userId });
      throw new Error('Failed to share report');
    }
  }

  async getSharedReports(userEmail: string): Promise<ReportTemplate[]> {
    try {
      const shares = await this.prisma.reportShare.findMany({
        where: { sharedWith: userEmail },
        include: { template: true },
      });

      return shares.map(share => share.template) as ReportTemplate[];
    } catch (error) {
      logger.error('Failed to get shared reports', { error, userEmail });
      throw new Error('Failed to get shared reports');
    }
  }
}

export const reportBuilderService = new ReportBuilderService();