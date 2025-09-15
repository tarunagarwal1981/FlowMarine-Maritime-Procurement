import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { dashboardAnalyticsService, DashboardFilters } from './dashboardAnalyticsService.js';
import { cacheService } from './cacheService.js';
import { auditService } from './auditService.js';
import { promises as fs } from 'fs';
import { join } from 'path';
// Canvas import removed - using simplified chart generation

const prisma = new PrismaClient();

export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv';
  dashboardType: 'executive' | 'operational' | 'financial' | 'custom';
  dataTypes: string[];
  filters: DashboardFilters;
  includeCharts: boolean;
  templateId?: string;
  customTitle?: string;
  includeMetadata: boolean;
  compression?: boolean;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  dashboardType: string;
  layout: ExportLayout;
  styling: ExportStyling;
  permissions: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportLayout {
  sections: ExportSection[];
  pageSettings: {
    orientation: 'portrait' | 'landscape';
    margins: { top: number; bottom: number; left: number; right: number; };
    headerHeight: number;
    footerHeight: number;
  };
}

export interface ExportSection {
  id: string;
  type: 'header' | 'chart' | 'table' | 'kpi' | 'text' | 'spacer';
  title?: string;
  dataType?: string;
  position: { x: number; y: number; width: number; height: number; };
  styling?: Record<string, any>;
  configuration?: Record<string, any>;
}

export interface ExportStyling {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    background: string;
  };
  fonts: {
    title: { family: string; size: number; weight: string; };
    heading: { family: string; size: number; weight: string; };
    body: { family: string; size: number; weight: string; };
    caption: { family: string; size: number; weight: string; };
  };
  branding: {
    logo?: string;
    companyName: string;
    tagline?: string;
  };
}

export interface ExportJob {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  options: ExportOptions;
  filePath?: string;
  fileSize?: number;
  error?: string;
  progress: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface ScheduledReport {
  id: string;
  name: string;
  description: string;
  userId: string;
  exportOptions: ExportOptions;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    time: string; // HH:MM format
    timezone: string;
  };
  recipients: string[];
  isActive: boolean;
  lastRun?: Date;
  nextRun: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Dashboard Export and Reporting Service
 * Handles PDF/Excel export, automated report generation, and template management
 */
export class DashboardExportService {
  private readonly EXPORT_DIR = 'exports';
  private readonly TEMPLATE_DIR = 'templates';
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly EXPORT_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.ensureDirectories();
  }

  /**
   * Export dashboard data to PDF with chart rendering
   */
  async exportToPDF(options: ExportOptions, userId: string): Promise<Buffer> {
    try {
      logger.info(`Starting PDF export for user ${userId}`, { options });

      // Validate permissions
      await this.validateExportPermissions(userId, options);

      // Generate dashboard data
      const dashboardData = await this.generateExportData(options);

      // Get or create template
      const template = await this.getExportTemplate(options.templateId, options.dashboardType);

      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        layout: template.layout.pageSettings.orientation,
        margins: template.layout.pageSettings.margins
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));

      // Add header
      await this.addPDFHeader(doc, template, options);

      // Add content sections
      for (const section of template.layout.sections) {
        await this.addPDFSection(doc, section, dashboardData, template);
      }

      // Add footer
      await this.addPDFFooter(doc, template, options);

      // Finalize document
      doc.end();

      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          
          // Log export completion
          auditService.logExportEvent({
            userId,
            action: 'PDF_EXPORT',
            options,
            fileSize: pdfBuffer.length,
            success: true
          });

          resolve(pdfBuffer);
        });

        doc.on('error', reject);
      });

    } catch (error) {
      logger.error('PDF export failed:', error);
      
      // Log export failure
      auditService.logExportEvent({
        userId,
        action: 'PDF_EXPORT',
        options,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Export dashboard data to Excel with multiple worksheets
   */
  async exportToExcel(options: ExportOptions, userId: string): Promise<Buffer> {
    try {
      logger.info(`Starting Excel export for user ${userId}`, { options });

      // Validate permissions
      await this.validateExportPermissions(userId, options);

      // Generate dashboard data
      const dashboardData = await this.generateExportData(options);

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Add worksheets based on data types
      for (const dataType of options.dataTypes) {
        const worksheetData = this.prepareExcelData(dashboardData[dataType], dataType);
        const worksheet = XLSX.utils.json_to_sheet(worksheetData.data);

        // Apply formatting
        this.applyExcelFormatting(worksheet, worksheetData.headers);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, worksheetData.sheetName);
      }

      // Add summary worksheet
      const summaryData = this.prepareSummaryData(dashboardData, options);
      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

      // Generate Excel buffer
      const excelBuffer = XLSX.write(workbook, { 
        type: 'buffer', 
        bookType: 'xlsx',
        compression: options.compression 
      });

      // Log export completion
      auditService.logExportEvent({
        userId,
        action: 'EXCEL_EXPORT',
        options,
        fileSize: excelBuffer.length,
        success: true
      });

      return excelBuffer;

    } catch (error) {
      logger.error('Excel export failed:', error);
      
      // Log export failure
      auditService.logExportEvent({
        userId,
        action: 'EXCEL_EXPORT',
        options,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Create and manage export templates
   */
  async createExportTemplate(template: Omit<ExportTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExportTemplate> {
    try {
      const newTemplate: ExportTemplate = {
        ...template,
        id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save template to database (in a real implementation)
      // For now, save to file system
      const templatePath = join(this.TEMPLATE_DIR, `${newTemplate.id}.json`);
      await fs.writeFile(templatePath, JSON.stringify(newTemplate, null, 2));

      logger.info(`Export template created: ${newTemplate.id}`);
      return newTemplate;

    } catch (error) {
      logger.error('Failed to create export template:', error);
      throw error;
    }
  }

  /**
   * Schedule automated report generation
   */
  async scheduleReport(report: Omit<ScheduledReport, 'id' | 'createdAt' | 'updatedAt' | 'nextRun'>): Promise<ScheduledReport> {
    try {
      const scheduledReport: ScheduledReport = {
        ...report,
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        nextRun: this.calculateNextRun(report.schedule),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save scheduled report (in a real implementation, this would be in database)
      const reportPath = join(this.EXPORT_DIR, 'scheduled', `${scheduledReport.id}.json`);
      await fs.writeFile(reportPath, JSON.stringify(scheduledReport, null, 2));

      logger.info(`Scheduled report created: ${scheduledReport.id}`);
      return scheduledReport;

    } catch (error) {
      logger.error('Failed to schedule report:', error);
      throw error;
    }
  }

  /**
   * Execute scheduled reports
   */
  async executeScheduledReports(): Promise<void> {
    try {
      logger.info('Executing scheduled reports...');

      // Get all scheduled reports (in real implementation, query database)
      const scheduledDir = join(this.EXPORT_DIR, 'scheduled');
      const reportFiles = await fs.readdir(scheduledDir);

      for (const reportFile of reportFiles) {
        if (!reportFile.endsWith('.json')) continue;

        const reportPath = join(scheduledDir, reportFile);
        const reportData = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
        const report: ScheduledReport = reportData;

        // Check if report should run
        if (report.isActive && new Date() >= new Date(report.nextRun)) {
          await this.executeScheduledReport(report);
        }
      }

    } catch (error) {
      logger.error('Failed to execute scheduled reports:', error);
    }
  }

  /**
   * Get export job status
   */
  async getExportJobStatus(jobId: string): Promise<ExportJob | null> {
    try {
      const jobPath = join(this.EXPORT_DIR, 'jobs', `${jobId}.json`);
      const jobData = await fs.readFile(jobPath, 'utf-8');
      return JSON.parse(jobData);
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate export permissions
   */
  private async validateExportPermissions(userId: string, options: ExportOptions): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const userPermissions = user.permissions.map(up => up.permission.name);

    // Check if user has export permissions
    if (!userPermissions.includes('EXPORT_DASHBOARDS') && 
        !userPermissions.includes('ADMIN') && 
        !userPermissions.includes('SUPER_ADMIN')) {
      throw new Error('Insufficient permissions for dashboard export');
    }

    // Check data type specific permissions
    const requiredPermissions: Record<string, string[]> = {
      'spend_analytics': ['VIEW_ANALYTICS', 'VIEW_FINANCIAL_DATA'],
      'budget_utilization': ['VIEW_BUDGET', 'VIEW_FINANCIAL_DATA'],
      'vendor_performance': ['VIEW_VENDORS', 'VIEW_ANALYTICS'],
      'operational_metrics': ['VIEW_OPERATIONS', 'VIEW_ANALYTICS'],
      'financial_insights': ['VIEW_FINANCIAL_DATA', 'VIEW_ANALYTICS']
    };

    for (const dataType of options.dataTypes) {
      const required = requiredPermissions[dataType] || [];
      const hasPermission = required.some(permission => userPermissions.includes(permission)) ||
                           userPermissions.includes('ADMIN') ||
                           userPermissions.includes('SUPER_ADMIN');

      if (!hasPermission) {
        throw new Error(`Insufficient permissions for data type: ${dataType}`);
      }
    }
  }

  /**
   * Generate export data
   */
  private async generateExportData(options: ExportOptions): Promise<Record<string, any>> {
    const data: Record<string, any> = {};

    for (const dataType of options.dataTypes) {
      switch (dataType) {
        case 'spend_analytics':
          data[dataType] = await dashboardAnalyticsService.generateSpendAnalytics(options.filters);
          break;
        case 'budget_utilization':
          data[dataType] = await dashboardAnalyticsService.generateBudgetUtilization(options.filters);
          break;
        case 'vendor_performance':
          data[dataType] = await dashboardAnalyticsService.generateVendorPerformanceAnalytics(options.filters);
          break;
        case 'operational_metrics':
          data[dataType] = await dashboardAnalyticsService.generateOperationalMetrics(options.filters);
          break;
        case 'financial_insights':
          data[dataType] = await dashboardAnalyticsService.generateFinancialInsights(options.filters);
          break;
      }
    }

    return data;
  }

  /**
   * Get or create export template
   */
  private async getExportTemplate(templateId?: string, dashboardType?: string): Promise<ExportTemplate> {
    if (templateId) {
      try {
        const templatePath = join(this.TEMPLATE_DIR, `${templateId}.json`);
        const templateData = await fs.readFile(templatePath, 'utf-8');
        return JSON.parse(templateData);
      } catch (error) {
        logger.warn(`Template ${templateId} not found, using default`);
      }
    }

    // Return default template
    return this.getDefaultTemplate(dashboardType || 'executive');
  }

  /**
   * Get default export template
   */
  private getDefaultTemplate(dashboardType: string): ExportTemplate {
    return {
      id: `default_${dashboardType}`,
      name: `Default ${dashboardType} Template`,
      description: `Default template for ${dashboardType} dashboard exports`,
      dashboardType,
      layout: {
        sections: [
          {
            id: 'header',
            type: 'header',
            title: 'FlowMarine Dashboard Report',
            position: { x: 0, y: 0, width: 100, height: 10 }
          },
          {
            id: 'summary',
            type: 'kpi',
            title: 'Key Performance Indicators',
            position: { x: 0, y: 15, width: 100, height: 20 }
          },
          {
            id: 'charts',
            type: 'chart',
            title: 'Analytics Charts',
            position: { x: 0, y: 40, width: 100, height: 40 }
          },
          {
            id: 'tables',
            type: 'table',
            title: 'Detailed Data',
            position: { x: 0, y: 85, width: 100, height: 15 }
          }
        ],
        pageSettings: {
          orientation: 'portrait',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          headerHeight: 60,
          footerHeight: 40
        }
      },
      styling: {
        colors: {
          primary: '#1e40af',
          secondary: '#0891b2',
          accent: '#059669',
          text: '#374151',
          background: '#ffffff'
        },
        fonts: {
          title: { family: 'Helvetica-Bold', size: 18, weight: 'bold' },
          heading: { family: 'Helvetica-Bold', size: 14, weight: 'bold' },
          body: { family: 'Helvetica', size: 10, weight: 'normal' },
          caption: { family: 'Helvetica', size: 8, weight: 'normal' }
        },
        branding: {
          companyName: 'FlowMarine',
          tagline: 'Maritime Procurement Excellence'
        }
      },
      permissions: ['VIEW_ANALYTICS'],
      isActive: true,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Add PDF header
   */
  private async addPDFHeader(doc: PDFKit.PDFDocument, template: ExportTemplate, options: ExportOptions): Promise<void> {
    const { styling } = template;
    
    // Add company branding
    doc.fontSize(styling.fonts.title.size)
       .fillColor(styling.colors.primary)
       .text(styling.branding.companyName, 50, 50);

    if (styling.branding.tagline) {
      doc.fontSize(styling.fonts.caption.size)
         .fillColor(styling.colors.text)
         .text(styling.branding.tagline, 50, 75);
    }

    // Add report title
    const title = options.customTitle || `${options.dashboardType.toUpperCase()} Dashboard Report`;
    doc.fontSize(styling.fonts.heading.size)
       .fillColor(styling.colors.text)
       .text(title, 50, 100);

    // Add date range
    const dateRange = `${options.filters.startDate.toLocaleDateString()} - ${options.filters.endDate.toLocaleDateString()}`;
    doc.fontSize(styling.fonts.body.size)
       .text(`Report Period: ${dateRange}`, 50, 120);

    // Add generation timestamp
    doc.text(`Generated: ${new Date().toLocaleString()}`, 50, 135);
  }

  /**
   * Add PDF section
   */
  private async addPDFSection(
    doc: PDFKit.PDFDocument, 
    section: ExportSection, 
    data: Record<string, any>,
    template: ExportTemplate
  ): Promise<void> {
    const yPosition = 150 + (section.position.y * 5); // Convert percentage to points

    switch (section.type) {
      case 'kpi':
        await this.addPDFKPISection(doc, section, data, template, yPosition);
        break;
      case 'chart':
        await this.addPDFChartSection(doc, section, data, template, yPosition);
        break;
      case 'table':
        await this.addPDFTableSection(doc, section, data, template, yPosition);
        break;
      case 'text':
        await this.addPDFTextSection(doc, section, template, yPosition);
        break;
    }
  }

  /**
   * Add PDF KPI section
   */
  private async addPDFKPISection(
    doc: PDFKit.PDFDocument,
    section: ExportSection,
    data: Record<string, any>,
    template: ExportTemplate,
    yPosition: number
  ): Promise<void> {
    if (section.title) {
      doc.fontSize(template.styling.fonts.heading.size)
         .fillColor(template.styling.colors.primary)
         .text(section.title, 50, yPosition);
      yPosition += 25;
    }

    // Extract KPIs from data
    const kpis = this.extractKPIs(data);
    let xPosition = 50;

    for (const kpi of kpis) {
      doc.fontSize(template.styling.fonts.body.size)
         .fillColor(template.styling.colors.text)
         .text(kpi.label, xPosition, yPosition)
         .fontSize(template.styling.fonts.heading.size)
         .fillColor(template.styling.colors.primary)
         .text(kpi.value, xPosition, yPosition + 15);

      xPosition += 120;
      if (xPosition > 400) {
        xPosition = 50;
        yPosition += 50;
      }
    }
  }

  /**
   * Add PDF chart section
   */
  private async addPDFChartSection(
    doc: PDFKit.PDFDocument,
    section: ExportSection,
    data: Record<string, any>,
    template: ExportTemplate,
    yPosition: number
  ): Promise<void> {
    if (section.title) {
      doc.fontSize(template.styling.fonts.heading.size)
         .fillColor(template.styling.colors.primary)
         .text(section.title, 50, yPosition);
      yPosition += 25;
    }

    // Generate chart image (simplified - in real implementation, use chart library)
    const chartBuffer = await this.generateChartImage(data, section.dataType || 'spend_analytics');
    
    if (chartBuffer) {
      doc.image(chartBuffer, 50, yPosition, { width: 500, height: 300 });
    } else {
      doc.fontSize(template.styling.fonts.body.size)
         .fillColor(template.styling.colors.text)
         .text('Chart data not available', 50, yPosition);
    }
  }

  /**
   * Add PDF table section
   */
  private async addPDFTableSection(
    doc: PDFKit.PDFDocument,
    section: ExportSection,
    data: Record<string, any>,
    template: ExportTemplate,
    yPosition: number
  ): Promise<void> {
    if (section.title) {
      doc.fontSize(template.styling.fonts.heading.size)
         .fillColor(template.styling.colors.primary)
         .text(section.title, 50, yPosition);
      yPosition += 25;
    }

    // Extract table data
    const tableData = this.extractTableData(data);
    
    if (tableData.length > 0) {
      const headers = Object.keys(tableData[0]);
      const columnWidth = 500 / headers.length;

      // Draw headers
      let xPosition = 50;
      for (const header of headers) {
        doc.fontSize(template.styling.fonts.body.size)
           .fillColor(template.styling.colors.primary)
           .text(header, xPosition, yPosition, { width: columnWidth });
        xPosition += columnWidth;
      }
      yPosition += 20;

      // Draw rows (limit to first 10 rows for space)
      for (let i = 0; i < Math.min(tableData.length, 10); i++) {
        const row = tableData[i];
        xPosition = 50;
        
        for (const header of headers) {
          doc.fontSize(template.styling.fonts.caption.size)
             .fillColor(template.styling.colors.text)
             .text(String(row[header] || ''), xPosition, yPosition, { width: columnWidth });
          xPosition += columnWidth;
        }
        yPosition += 15;
      }
    }
  }

  /**
   * Add PDF text section
   */
  private async addPDFTextSection(
    doc: PDFKit.PDFDocument,
    section: ExportSection,
    template: ExportTemplate,
    yPosition: number
  ): Promise<void> {
    if (section.title) {
      doc.fontSize(template.styling.fonts.heading.size)
         .fillColor(template.styling.colors.primary)
         .text(section.title, 50, yPosition);
      yPosition += 25;
    }

    // Add configured text content
    const textContent = section.configuration?.content || 'No content configured';
    doc.fontSize(template.styling.fonts.body.size)
       .fillColor(template.styling.colors.text)
       .text(textContent, 50, yPosition, { width: 500 });
  }

  /**
   * Add PDF footer
   */
  private async addPDFFooter(doc: PDFKit.PDFDocument, template: ExportTemplate, options: ExportOptions): Promise<void> {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 50;

    doc.fontSize(template.styling.fonts.caption.size)
       .fillColor(template.styling.colors.text)
       .text(`FlowMarine Dashboard Export - ${new Date().toLocaleDateString()}`, 50, footerY)
       .text(`Page 1`, 500, footerY);
  }

  /**
   * Prepare Excel data for export
   */
  private prepareExcelData(data: any, dataType: string): { data: any[]; headers: string[]; sheetName: string } {
    switch (dataType) {
      case 'spend_analytics':
        return {
          data: this.flattenSpendAnalytics(data),
          headers: ['Period', 'Vessel', 'Category', 'Amount', 'Currency', 'Orders'],
          sheetName: 'Spend Analytics'
        };
      case 'vendor_performance':
        return {
          data: Array.isArray(data) ? data : [],
          headers: ['Vendor', 'Overall Score', 'Delivery Score', 'Quality Score', 'Price Score', 'Orders'],
          sheetName: 'Vendor Performance'
        };
      default:
        return {
          data: Array.isArray(data) ? data : [data],
          headers: Object.keys(data || {}),
          sheetName: dataType.replace('_', ' ').toUpperCase()
        };
    }
  }

  /**
   * Apply Excel formatting
   */
  private applyExcelFormatting(worksheet: XLSX.WorkSheet, headers: string[]): void {
    // Set column widths
    const columnWidths = headers.map(header => ({ wch: Math.max(header.length, 15) }));
    worksheet['!cols'] = columnWidths;

    // Apply header formatting (simplified - in real implementation, use more advanced formatting)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: '1e40af' } }
        };
      }
    }
  }

  /**
   * Prepare summary data for Excel
   */
  private prepareSummaryData(data: Record<string, any>, options: ExportOptions): any[] {
    return [
      { Metric: 'Report Type', Value: options.dashboardType },
      { Metric: 'Data Types', Value: options.dataTypes.join(', ') },
      { Metric: 'Date Range', Value: `${options.filters.startDate.toLocaleDateString()} - ${options.filters.endDate.toLocaleDateString()}` },
      { Metric: 'Generated', Value: new Date().toLocaleString() },
      { Metric: 'Total Records', Value: Object.values(data).reduce((sum, d) => sum + (Array.isArray(d) ? d.length : 1), 0) }
    ];
  }

  /**
   * Execute scheduled report
   */
  private async executeScheduledReport(report: ScheduledReport): Promise<void> {
    try {
      logger.info(`Executing scheduled report: ${report.id}`);

      // Generate export
      let exportBuffer: Buffer;
      if (report.exportOptions.format === 'pdf') {
        exportBuffer = await this.exportToPDF(report.exportOptions, report.userId);
      } else {
        exportBuffer = await this.exportToExcel(report.exportOptions, report.userId);
      }

      // Save export file
      const fileName = `${report.name}_${new Date().toISOString().split('T')[0]}.${report.exportOptions.format}`;
      const filePath = join(this.EXPORT_DIR, 'scheduled', fileName);
      await fs.writeFile(filePath, exportBuffer);

      // Send to recipients (simplified - in real implementation, use email service)
      logger.info(`Report generated and saved: ${filePath}`);
      logger.info(`Recipients: ${report.recipients.join(', ')}`);

      // Update next run time
      report.lastRun = new Date();
      report.nextRun = this.calculateNextRun(report.schedule);

      // Save updated report
      const reportPath = join(this.EXPORT_DIR, 'scheduled', `${report.id}.json`);
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    } catch (error) {
      logger.error(`Failed to execute scheduled report ${report.id}:`, error);
    }
  }

  /**
   * Calculate next run time for scheduled report
   */
  private calculateNextRun(schedule: ScheduledReport['schedule']): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    let nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);

    switch (schedule.frequency) {
      case 'daily':
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      case 'weekly':
        const targetDay = schedule.dayOfWeek || 0;
        const currentDay = nextRun.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0 || (daysToAdd === 0 && nextRun <= now)) {
          daysToAdd += 7;
        }
        nextRun.setDate(nextRun.getDate() + daysToAdd);
        break;
      case 'monthly':
        const targetDate = schedule.dayOfMonth || 1;
        nextRun.setDate(targetDate);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;
      case 'quarterly':
        const currentMonth = nextRun.getMonth();
        const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
        nextRun.setMonth(quarterStartMonth + 3);
        nextRun.setDate(1);
        break;
    }

    return nextRun;
  }

  /**
   * Extract KPIs from dashboard data
   */
  private extractKPIs(data: Record<string, any>): Array<{ label: string; value: string }> {
    const kpis: Array<{ label: string; value: string }> = [];

    if (data.spend_analytics) {
      kpis.push({
        label: 'Total Spend',
        value: `$${data.spend_analytics.totalSpend?.toLocaleString() || '0'}`
      });
    }

    if (data.budget_utilization) {
      kpis.push({
        label: 'Budget Utilization',
        value: `${data.budget_utilization.utilizationPercentage?.toFixed(1) || '0'}%`
      });
    }

    if (data.vendor_performance && Array.isArray(data.vendor_performance)) {
      const avgScore = data.vendor_performance.reduce((sum, v) => sum + (v.overallScore || 0), 0) / data.vendor_performance.length;
      kpis.push({
        label: 'Avg Vendor Score',
        value: `${avgScore.toFixed(1)}/10`
      });
    }

    return kpis;
  }

  /**
   * Extract table data from dashboard data
   */
  private extractTableData(data: Record<string, any>): any[] {
    // Combine data from different sources into a unified table
    const tableData: any[] = [];

    if (data.spend_analytics?.breakdown?.byVessel) {
      data.spend_analytics.breakdown.byVessel.forEach((vessel: any) => {
        tableData.push({
          Type: 'Vessel Spend',
          Name: vessel.vesselName,
          Amount: vessel.totalAmount,
          Currency: vessel.currency,
          Count: vessel.orderCount
        });
      });
    }

    if (data.vendor_performance && Array.isArray(data.vendor_performance)) {
      data.vendor_performance.slice(0, 5).forEach((vendor: any) => {
        tableData.push({
          Type: 'Vendor Performance',
          Name: vendor.vendorName,
          Amount: vendor.totalOrders,
          Currency: 'Score',
          Count: vendor.overallScore
        });
      });
    }

    return tableData;
  }

  /**
   * Flatten spend analytics data for Excel export
   */
  private flattenSpendAnalytics(data: any): any[] {
    const flattened: any[] = [];

    if (data?.breakdown?.byVessel) {
      data.breakdown.byVessel.forEach((vessel: any) => {
        if (vessel.categories) {
          vessel.categories.forEach((category: any) => {
            flattened.push({
              Period: data.period || 'Current',
              Vessel: vessel.vesselName,
              Category: category.name,
              Amount: category.amount,
              Currency: vessel.currency || 'USD',
              Orders: category.orderCount || 0
            });
          });
        } else {
          flattened.push({
            Period: data.period || 'Current',
            Vessel: vessel.vesselName,
            Category: 'All',
            Amount: vessel.totalAmount,
            Currency: vessel.currency || 'USD',
            Orders: vessel.orderCount || 0
          });
        }
      });
    }

    return flattened;
  }

  /**
   * Generate chart image for PDF export
   */
  private async generateChartImage(data: any, dataType: string): Promise<Buffer | null> {
    try {
      // In a real implementation, this would use a chart library like Chart.js with canvas
      // For now, return null to indicate chart generation is not available
      logger.info(`Chart generation requested for ${dataType} - feature not implemented`);
      return null;
    } catch (error) {
      logger.error('Chart generation failed:', error);
      return null;
    }
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.EXPORT_DIR,
      this.TEMPLATE_DIR,
      join(this.EXPORT_DIR, 'jobs'),
      join(this.EXPORT_DIR, 'scheduled')
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    }
  }

  /**
   * Clean up old export files
   */
  async cleanupOldExports(): Promise<void> {
    try {
      const exportDir = this.EXPORT_DIR;
      const files = await fs.readdir(exportDir);
      const now = Date.now();

      for (const file of files) {
        if (file.endsWith('.pdf') || file.endsWith('.xlsx')) {
          const filePath = join(exportDir, file);
          const stats = await fs.stat(filePath);
          
          if (now - stats.mtime.getTime() > this.EXPORT_TTL) {
            await fs.unlink(filePath);
            logger.info(`Cleaned up old export file: ${file}`);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old exports:', error);
    }
  }

  /**
   * Get export templates
   */
  async getExportTemplates(userId: string): Promise<ExportTemplate[]> {
    try {
      // Validate user permissions
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const userPermissions = user.permissions.map(up => up.permission.name);
      
      if (!userPermissions.includes('VIEW_EXPORT_TEMPLATES') && 
          !userPermissions.includes('ADMIN') && 
          !userPermissions.includes('SUPER_ADMIN')) {
        throw new Error('Insufficient permissions to view export templates');
      }

      // Read templates from directory
      const templateDir = this.TEMPLATE_DIR;
      const templateFiles = await fs.readdir(templateDir);
      const templates: ExportTemplate[] = [];

      for (const file of templateFiles) {
        if (file.endsWith('.json')) {
          try {
            const templatePath = join(templateDir, file);
            const templateData = await fs.readFile(templatePath, 'utf-8');
            const template: ExportTemplate = JSON.parse(templateData);
            
            // Check if user has permission to view this template
            const hasPermission = template.permissions.some(permission => 
              userPermissions.includes(permission)) ||
              userPermissions.includes('ADMIN') ||
              userPermissions.includes('SUPER_ADMIN');

            if (hasPermission && template.isActive) {
              templates.push(template);
            }
          } catch (error) {
            logger.warn(`Failed to load template ${file}:`, error);
          }
        }
      }

      return templates;
    } catch (error) {
      logger.error('Failed to get export templates:', error);
      throw error;
    }
  }

  /**
   * Update export template
   */
  async updateExportTemplate(templateId: string, updates: Partial<ExportTemplate>, userId: string): Promise<ExportTemplate> {
    try {
      // Validate permissions
      await this.validateTemplatePermissions(userId, 'UPDATE_EXPORT_TEMPLATES');

      const templatePath = join(this.TEMPLATE_DIR, `${templateId}.json`);
      const templateData = await fs.readFile(templatePath, 'utf-8');
      const template: ExportTemplate = JSON.parse(templateData);

      // Update template
      const updatedTemplate: ExportTemplate = {
        ...template,
        ...updates,
        id: templateId, // Ensure ID doesn't change
        updatedAt: new Date()
      };

      // Save updated template
      await fs.writeFile(templatePath, JSON.stringify(updatedTemplate, null, 2));

      logger.info(`Export template updated: ${templateId}`);
      return updatedTemplate;
    } catch (error) {
      logger.error('Failed to update export template:', error);
      throw error;
    }
  }

  /**
   * Delete export template
   */
  async deleteExportTemplate(templateId: string, userId: string): Promise<void> {
    try {
      // Validate permissions
      await this.validateTemplatePermissions(userId, 'DELETE_EXPORT_TEMPLATES');

      const templatePath = join(this.TEMPLATE_DIR, `${templateId}.json`);
      await fs.unlink(templatePath);

      logger.info(`Export template deleted: ${templateId}`);
    } catch (error) {
      logger.error('Failed to delete export template:', error);
      throw error;
    }
  }

  /**
   * Get scheduled reports
   */
  async getScheduledReports(userId: string): Promise<ScheduledReport[]> {
    try {
      // Validate permissions
      await this.validateTemplatePermissions(userId, 'VIEW_SCHEDULED_REPORTS');

      const scheduledDir = join(this.EXPORT_DIR, 'scheduled');
      const reportFiles = await fs.readdir(scheduledDir);
      const reports: ScheduledReport[] = [];

      for (const file of reportFiles) {
        if (file.endsWith('.json') && !file.includes('_')) { // Exclude generated report files
          try {
            const reportPath = join(scheduledDir, file);
            const reportData = await fs.readFile(reportPath, 'utf-8');
            const report: ScheduledReport = JSON.parse(reportData);
            
            // Only return reports for this user or if user is admin
            const user = await prisma.user.findUnique({
              where: { id: userId },
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            });

            const userPermissions = user?.permissions.map(up => up.permission.name) || [];
            const isAdmin = userPermissions.includes('ADMIN') || userPermissions.includes('SUPER_ADMIN');

            if (report.userId === userId || isAdmin) {
              reports.push(report);
            }
          } catch (error) {
            logger.warn(`Failed to load scheduled report ${file}:`, error);
          }
        }
      }

      return reports;
    } catch (error) {
      logger.error('Failed to get scheduled reports:', error);
      throw error;
    }
  }

  /**
   * Update scheduled report
   */
  async updateScheduledReport(reportId: string, updates: Partial<ScheduledReport>, userId: string): Promise<ScheduledReport> {
    try {
      // Validate permissions
      await this.validateTemplatePermissions(userId, 'UPDATE_SCHEDULED_REPORTS');

      const reportPath = join(this.EXPORT_DIR, 'scheduled', `${reportId}.json`);
      const reportData = await fs.readFile(reportPath, 'utf-8');
      const report: ScheduledReport = JSON.parse(reportData);

      // Check ownership or admin rights
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      });

      const userPermissions = user?.permissions.map(up => up.permission.name) || [];
      const isAdmin = userPermissions.includes('ADMIN') || userPermissions.includes('SUPER_ADMIN');

      if (report.userId !== userId && !isAdmin) {
        throw new Error('Insufficient permissions to update this scheduled report');
      }

      // Update report
      const updatedReport: ScheduledReport = {
        ...report,
        ...updates,
        id: reportId, // Ensure ID doesn't change
        nextRun: updates.schedule ? this.calculateNextRun(updates.schedule) : report.nextRun,
        updatedAt: new Date()
      };

      // Save updated report
      await fs.writeFile(reportPath, JSON.stringify(updatedReport, null, 2));

      logger.info(`Scheduled report updated: ${reportId}`);
      return updatedReport;
    } catch (error) {
      logger.error('Failed to update scheduled report:', error);
      throw error;
    }
  }

  /**
   * Delete scheduled report
   */
  async deleteScheduledReport(reportId: string, userId: string): Promise<void> {
    try {
      // Validate permissions
      await this.validateTemplatePermissions(userId, 'DELETE_SCHEDULED_REPORTS');

      const reportPath = join(this.EXPORT_DIR, 'scheduled', `${reportId}.json`);
      const reportData = await fs.readFile(reportPath, 'utf-8');
      const report: ScheduledReport = JSON.parse(reportData);

      // Check ownership or admin rights
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      });

      const userPermissions = user?.permissions.map(up => up.permission.name) || [];
      const isAdmin = userPermissions.includes('ADMIN') || userPermissions.includes('SUPER_ADMIN');

      if (report.userId !== userId && !isAdmin) {
        throw new Error('Insufficient permissions to delete this scheduled report');
      }

      await fs.unlink(reportPath);

      logger.info(`Scheduled report deleted: ${reportId}`);
    } catch (error) {
      logger.error('Failed to delete scheduled report:', error);
      throw error;
    }
  }

  /**
   * Validate template permissions
   */
  private async validateTemplatePermissions(userId: string, requiredPermission: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const userPermissions = user.permissions.map(up => up.permission.name);

    if (!userPermissions.includes(requiredPermission) && 
        !userPermissions.includes('ADMIN') && 
        !userPermissions.includes('SUPER_ADMIN')) {
      throw new Error(`Insufficient permissions: ${requiredPermission}`);
    }
  }

  /**
   * Create export job for async processing
   */
  async createExportJob(options: ExportOptions, userId: string): Promise<string> {
    try {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const job: ExportJob = {
        id: jobId,
        userId,
        status: 'pending',
        options,
        progress: 0,
        createdAt: new Date()
      };

      // Save job
      const jobPath = join(this.EXPORT_DIR, 'jobs', `${jobId}.json`);
      await fs.writeFile(jobPath, JSON.stringify(job, null, 2));

      // Process job asynchronously
      this.processExportJob(jobId).catch(error => {
        logger.error(`Export job ${jobId} failed:`, error);
      });

      return jobId;
    } catch (error) {
      logger.error('Failed to create export job:', error);
      throw error;
    }
  }

  /**
   * Process export job asynchronously
   */
  private async processExportJob(jobId: string): Promise<void> {
    try {
      // Update job status
      await this.updateExportJobStatus(jobId, 'processing', 10);

      // Load job
      const jobPath = join(this.EXPORT_DIR, 'jobs', `${jobId}.json`);
      const jobData = await fs.readFile(jobPath, 'utf-8');
      const job: ExportJob = JSON.parse(jobData);

      // Generate export
      await this.updateExportJobStatus(jobId, 'processing', 50);

      let exportBuffer: Buffer;
      if (job.options.format === 'pdf') {
        exportBuffer = await this.exportToPDF(job.options, job.userId);
      } else {
        exportBuffer = await this.exportToExcel(job.options, job.userId);
      }

      // Save export file
      await this.updateExportJobStatus(jobId, 'processing', 80);

      const fileName = `${jobId}.${job.options.format}`;
      const filePath = join(this.EXPORT_DIR, fileName);
      await fs.writeFile(filePath, exportBuffer);

      // Update job completion
      await this.updateExportJobStatus(jobId, 'completed', 100, filePath, exportBuffer.length);

      logger.info(`Export job completed: ${jobId}`);
    } catch (error) {
      await this.updateExportJobStatus(jobId, 'failed', 0, undefined, undefined, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`Export job failed: ${jobId}`, error);
    }
  }

  /**
   * Update export job status
   */
  private async updateExportJobStatus(
    jobId: string, 
    status: ExportJob['status'], 
    progress: number,
    filePath?: string,
    fileSize?: number,
    error?: string
  ): Promise<void> {
    try {
      const jobPath = join(this.EXPORT_DIR, 'jobs', `${jobId}.json`);
      const jobData = await fs.readFile(jobPath, 'utf-8');
      const job: ExportJob = JSON.parse(jobData);

      job.status = status;
      job.progress = progress;
      if (filePath) job.filePath = filePath;
      if (fileSize) job.fileSize = fileSize;
      if (error) job.error = error;
      if (status === 'completed' || status === 'failed') {
        job.completedAt = new Date();
      }

      await fs.writeFile(jobPath, JSON.stringify(job, null, 2));
    } catch (error) {
      logger.error(`Failed to update job status for ${jobId}:`, error);
    }
  }or.vendorName,
          Score: vendor.overallScore,
          Orders: vendor.totalOrders,
          'On-Time Rate': `${vendor.onTimeDeliveryRate || 0}%`
        });
      });
    }

    return tableData;
  }

  /**
   * Flatten spend analytics data for Excel export
   */
  private flattenSpendAnalytics(data: any): any[] {
    const flattened: any[] = [];

    if (data?.breakdown?.byVessel) {
      data.breakdown.byVessel.forEach((vessel: any) => {
        flattened.push({
          Period: 'Current',
          Vessel: vessel.vesselName,
          Category: 'All',
          Amount: vessel.totalAmount,
          Currency: vessel.currency,
          Orders: vessel.orderCount
        });
      });
    }

    if (data?.breakdown?.byCategory) {
      data.breakdown.byCategory.forEach((category: any) => {
        flattened.push({
          Period: 'Current',
          Vessel: 'All',
          Category: category.categoryName,
          Amount: category.totalAmount,
          Currency: category.currency,
          Orders: category.orderCount
        });
      });
    }

    return flattened;
  }

  /**
   * Generate chart image (simplified implementation)
   */
  private async generateChartImage(data: any, dataType: string): Promise<Buffer | null> {
    try {
      // In a real implementation, this would use a chart library like Chart.js with canvas
      // For now, return null to skip chart rendering
      logger.info(`Chart generation requested for ${dataType} - would render chart here`);
      return null;
    } catch (error) {
      logger.error('Failed to generate chart image:', error);
      return null;
    }
  }

}

export const dashboardExportService = new DashboardExportService();