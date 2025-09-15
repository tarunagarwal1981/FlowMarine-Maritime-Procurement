import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { emailService } from './emailService';
import { reportBuilderService } from './reportBuilderService';
import { dashboardExportService } from './dashboardExportService';
import cron from 'node-cron';

interface ScheduleJob {
  id: string;
  scheduledReportId: string;
  cronExpression: string;
  task: cron.ScheduledTask;
}

class ReportSchedulerService {
  private prisma: PrismaClient;
  private jobs: Map<string, ScheduleJob> = new Map();

  constructor() {
    this.prisma = new PrismaClient();
    this.initializeScheduler();
  }

  private async initializeScheduler(): Promise<void> {
    try {
      // Load all active scheduled reports
      const scheduledReports = await this.prisma.scheduledReport.findMany({
        where: { isActive: true },
      });

      // Schedule each report
      for (const report of scheduledReports) {
        await this.scheduleReport(report);
      }

      logger.info('Report scheduler initialized', { reportCount: scheduledReports.length });
    } catch (error) {
      logger.error('Failed to initialize report scheduler', { error });
    }
  }

  async scheduleReport(scheduledReport: any): Promise<void> {
    try {
      const cronExpression = this.buildCronExpression(scheduledReport.schedule);
      
      const task = cron.schedule(cronExpression, async () => {
        await this.executeScheduledReport(scheduledReport.id);
      }, {
        scheduled: false,
        timezone: 'UTC',
      });

      const job: ScheduleJob = {
        id: `job_${scheduledReport.id}`,
        scheduledReportId: scheduledReport.id,
        cronExpression,
        task,
      };

      this.jobs.set(scheduledReport.id, job);
      task.start();

      logger.info('Report scheduled', { 
        reportId: scheduledReport.id, 
        cronExpression,
        nextRun: scheduledReport.nextRun 
      });
    } catch (error) {
      logger.error('Failed to schedule report', { error, reportId: scheduledReport.id });
    }
  }

  private buildCronExpression(schedule: any): string {
    const [hours, minutes] = schedule.time.split(':').map(Number);

    switch (schedule.type) {
      case 'daily':
        return `${minutes} ${hours} * * *`;
      case 'weekly':
        return `${minutes} ${hours} * * ${schedule.dayOfWeek}`;
      case 'monthly':
        return `${minutes} ${hours} ${schedule.dayOfMonth} * *`;
      case 'quarterly':
        // Run on the first day of every 3rd month
        return `${minutes} ${hours} 1 */3 *`;
      default:
        throw new Error(`Unsupported schedule type: ${schedule.type}`);
    }
  }

  private async executeScheduledReport(scheduledReportId: string): Promise<void> {
    try {
      logger.info('Executing scheduled report', { scheduledReportId });

      const scheduledReport = await this.prisma.scheduledReport.findUnique({
        where: { id: scheduledReportId },
        include: { template: true },
      });

      if (!scheduledReport || !scheduledReport.isActive) {
        logger.warn('Scheduled report not found or inactive', { scheduledReportId });
        return;
      }

      // Execute the report
      const execution = await reportBuilderService.executeReport(
        scheduledReport.templateId,
        scheduledReport.parameters,
        scheduledReport.createdBy
      );

      // Wait for execution to complete
      await this.waitForExecution(execution.id);

      // Generate report in requested format
      const reportData = await this.getExecutionResult(execution.id);
      const reportFile = await this.generateReportFile(reportData, scheduledReport.format);

      // Send to recipients
      await this.distributeReport(scheduledReport, reportFile);

      // Update last run time and calculate next run
      const nextRun = this.calculateNextRun(scheduledReport.schedule);
      await this.prisma.scheduledReport.update({
        where: { id: scheduledReportId },
        data: {
          lastRun: new Date(),
          nextRun,
        },
      });

      logger.info('Scheduled report executed successfully', { scheduledReportId });
    } catch (error) {
      logger.error('Failed to execute scheduled report', { error, scheduledReportId });
      
      // Notify administrators of failure
      await this.notifyExecutionFailure(scheduledReportId, error.message);
    }
  }

  private async waitForExecution(executionId: string, maxWaitTime: number = 300000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const execution = await this.prisma.reportExecution.findUnique({
        where: { id: executionId },
      });

      if (execution?.status === 'completed') {
        return;
      }

      if (execution?.status === 'failed') {
        throw new Error(`Report execution failed: ${execution.error}`);
      }

      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error('Report execution timeout');
  }

  private async getExecutionResult(executionId: string): Promise<any> {
    const execution = await this.prisma.reportExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution?.result) {
      throw new Error('No execution result found');
    }

    return execution.result;
  }

  private async generateReportFile(reportData: any, format: string): Promise<Buffer> {
    switch (format) {
      case 'pdf':
        return await dashboardExportService.exportToPDF(reportData);
      case 'excel':
        return await dashboardExportService.exportToExcel(reportData);
      case 'csv':
        return await dashboardExportService.exportToCSV(reportData);
      case 'html':
        return Buffer.from(this.generateHTMLReport(reportData), 'utf-8');
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private generateHTMLReport(reportData: any): string {
    const { data, visualizations, metadata } = reportData;
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>FlowMarine Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { border-bottom: 2px solid #0066cc; padding-bottom: 10px; margin-bottom: 20px; }
          .metadata { background: #f5f5f5; padding: 10px; margin-bottom: 20px; }
          .visualization { margin-bottom: 30px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FlowMarine Report</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="metadata">
          <p><strong>Records:</strong> ${metadata.recordCount}</p>
          <p><strong>Generated At:</strong> ${metadata.generatedAt}</p>
        </div>
    `;

    // Add visualizations
    visualizations.forEach((viz: any) => {
      html += `<div class="visualization">`;
      html += `<h2>${viz.title}</h2>`;
      
      if (viz.type === 'table') {
        html += this.generateHTMLTable(viz.processedData);
      } else if (viz.type === 'kpi') {
        html += `<div class="kpi"><h3>${viz.processedData.value}</h3><p>${viz.processedData.label}</p></div>`;
      }
      
      html += `</div>`;
    });

    html += `
      </body>
      </html>
    `;

    return html;
  }

  private generateHTMLTable(data: any[]): string {
    if (!data || data.length === 0) {
      return '<p>No data available</p>';
    }

    const headers = Object.keys(data[0]);
    let table = '<table><thead><tr>';
    
    headers.forEach(header => {
      table += `<th>${header}</th>`;
    });
    
    table += '</tr></thead><tbody>';
    
    data.forEach(row => {
      table += '<tr>';
      headers.forEach(header => {
        table += `<td>${row[header] || ''}</td>`;
      });
      table += '</tr>';
    });
    
    table += '</tbody></table>';
    return table;
  }

  private async distributeReport(scheduledReport: any, reportFile: Buffer): Promise<void> {
    const fileName = `${scheduledReport.name}_${new Date().toISOString().split('T')[0]}.${scheduledReport.format}`;
    
    for (const recipient of scheduledReport.recipients) {
      try {
        await emailService.sendEmail({
          to: recipient,
          subject: `Scheduled Report: ${scheduledReport.name}`,
          html: `
            <h2>FlowMarine Scheduled Report</h2>
            <p>Please find your scheduled report "${scheduledReport.name}" attached.</p>
            <p>Report generated on: ${new Date().toLocaleString()}</p>
            <p>This is an automated message from FlowMarine.</p>
          `,
          attachments: [{
            filename: fileName,
            content: reportFile,
          }],
        });

        logger.info('Report distributed', { recipient, reportName: scheduledReport.name });
      } catch (error) {
        logger.error('Failed to distribute report', { error, recipient, reportName: scheduledReport.name });
      }
    }
  }

  private calculateNextRun(schedule: any): Date {
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

  private async notifyExecutionFailure(scheduledReportId: string, error: string): Promise<void> {
    try {
      const scheduledReport = await this.prisma.scheduledReport.findUnique({
        where: { id: scheduledReportId },
      });

      if (scheduledReport) {
        await emailService.sendEmail({
          to: scheduledReport.createdBy,
          subject: `Report Execution Failed: ${scheduledReport.name}`,
          html: `
            <h2>Report Execution Failed</h2>
            <p>The scheduled report "${scheduledReport.name}" failed to execute.</p>
            <p><strong>Error:</strong> ${error}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p>Please check your report configuration and try again.</p>
          `,
        });
      }
    } catch (emailError) {
      logger.error('Failed to send failure notification', { emailError, scheduledReportId });
    }
  }

  async updateSchedule(scheduledReportId: string, newSchedule: any): Promise<void> {
    try {
      // Remove existing job
      const existingJob = this.jobs.get(scheduledReportId);
      if (existingJob) {
        existingJob.task.stop();
        this.jobs.delete(scheduledReportId);
      }

      // Update database
      const nextRun = this.calculateNextRun(newSchedule);
      const updatedReport = await this.prisma.scheduledReport.update({
        where: { id: scheduledReportId },
        data: {
          schedule: newSchedule,
          nextRun,
        },
      });

      // Create new job
      await this.scheduleReport(updatedReport);

      logger.info('Schedule updated', { scheduledReportId });
    } catch (error) {
      logger.error('Failed to update schedule', { error, scheduledReportId });
      throw new Error('Failed to update schedule');
    }
  }

  async deleteSchedule(scheduledReportId: string): Promise<void> {
    try {
      // Remove job
      const job = this.jobs.get(scheduledReportId);
      if (job) {
        job.task.stop();
        this.jobs.delete(scheduledReportId);
      }

      // Delete from database
      await this.prisma.scheduledReport.delete({
        where: { id: scheduledReportId },
      });

      logger.info('Schedule deleted', { scheduledReportId });
    } catch (error) {
      logger.error('Failed to delete schedule', { error, scheduledReportId });
      throw new Error('Failed to delete schedule');
    }
  }

  getActiveJobs(): ScheduleJob[] {
    return Array.from(this.jobs.values());
  }
}

export const reportSchedulerService = new ReportSchedulerService();