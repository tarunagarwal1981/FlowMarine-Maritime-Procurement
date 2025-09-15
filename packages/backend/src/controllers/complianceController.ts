import { Request, Response } from 'express';
import { complianceReportingService } from '../services/complianceReportingService';
import { logger } from '../utils/logger';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

export class ComplianceController {
  /**
   * Generate SOLAS compliance report
   */
  async generateSOLASReport(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      const { startDate, endDate } = req.body;
      const userId = req.user.id;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required'
        });
      }

      const report = await complianceReportingService.generateSOLASReport(
        vesselId,
        new Date(startDate),
        new Date(endDate),
        userId
      );

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error generating SOLAS report', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to generate SOLAS report'
      });
    }
  }

  /**
   * Generate MARPOL compliance report
   */
  async generateMARPOLReport(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      const { startDate, endDate } = req.body;
      const userId = req.user.id;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required'
        });
      }

      const report = await complianceReportingService.generateMARPOLReport(
        vesselId,
        new Date(startDate),
        new Date(endDate),
        userId
      );

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error generating MARPOL report', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to generate MARPOL report'
      });
    }
  }

  /**
   * Generate ISM compliance report
   */
  async generateISMReport(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      const { startDate, endDate } = req.body;
      const userId = req.user.id;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required'
        });
      }

      const report = await complianceReportingService.generateISMReport(
        vesselId,
        new Date(startDate),
        new Date(endDate),
        userId
      );

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error generating ISM report', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to generate ISM report'
      });
    }
  }

  /**
   * Generate audit trail report
   */
  async generateAuditTrailReport(req: Request, res: Response) {
    try {
      const { startDate, endDate, vesselId, actionType, targetUserId } = req.body;
      const userId = req.user.id;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required'
        });
      }

      const filters = {
        vesselId,
        actionType,
        userId: targetUserId
      };

      const auditTrail = await complianceReportingService.generateAuditTrailReport(
        new Date(startDate),
        new Date(endDate),
        userId,
        filters
      );

      res.json({
        success: true,
        data: auditTrail
      });
    } catch (error) {
      logger.error('Error generating audit trail report', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to generate audit trail report'
      });
    }
  }

  /**
   * Get compliance alerts
   */
  async getComplianceAlerts(req: Request, res: Response) {
    try {
      const { vesselId } = req.query;

      const alerts = await complianceReportingService.getComplianceAlerts(
        vesselId as string
      );

      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      logger.error('Error getting compliance alerts', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get compliance alerts'
      });
    }
  }

  /**
   * Export compliance report to Excel
   */
  async exportReportToExcel(req: Request, res: Response) {
    try {
      const { reportType, vesselId, startDate, endDate } = req.body;
      const userId = req.user.id;

      let report;
      switch (reportType) {
        case 'SOLAS':
          report = await complianceReportingService.generateSOLASReport(
            vesselId,
            new Date(startDate),
            new Date(endDate),
            userId
          );
          break;
        case 'MARPOL':
          report = await complianceReportingService.generateMARPOLReport(
            vesselId,
            new Date(startDate),
            new Date(endDate),
            userId
          );
          break;
        case 'ISM':
          report = await complianceReportingService.generateISMReport(
            vesselId,
            new Date(startDate),
            new Date(endDate),
            userId
          );
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid report type'
          });
      }

      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      
      // Summary sheet
      const summaryData = [
        ['Report Type', report.type],
        ['Vessel ID', report.vesselId],
        ['Report Period', `${report.reportPeriod.startDate} to ${report.reportPeriod.endDate}`],
        ['Generated At', report.generatedAt],
        ['Generated By', report.generatedBy],
        ['Compliance Score', report.data.complianceScore],
        [],
        ['Recommendations'],
        ...report.data.recommendations.map((rec: string) => [rec])
      ];
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Certificates sheet
      if (report.data.certificates) {
        const certData = [
          ['Certificate Type', 'Issue Date', 'Expiry Date', 'Status'],
          ...report.data.certificates.details?.map((cert: any) => [
            cert.type,
            cert.issueDate,
            cert.expiryDate,
            cert.status
          ]) || []
        ];
        
        const certSheet = XLSX.utils.aoa_to_sheet(certData);
        XLSX.utils.book_append_sheet(workbook, certSheet, 'Certificates');
      }

      // Generate Excel buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${report.type}_Report_${vesselId}_${Date.now()}.xlsx"`);
      res.send(excelBuffer);

    } catch (error) {
      logger.error('Error exporting report to Excel', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to export report to Excel'
      });
    }
  }

  /**
   * Export compliance report to PDF
   */
  async exportReportToPDF(req: Request, res: Response) {
    try {
      const { reportType, vesselId, startDate, endDate } = req.body;
      const userId = req.user.id;

      let report;
      switch (reportType) {
        case 'SOLAS':
          report = await complianceReportingService.generateSOLASReport(
            vesselId,
            new Date(startDate),
            new Date(endDate),
            userId
          );
          break;
        case 'MARPOL':
          report = await complianceReportingService.generateMARPOLReport(
            vesselId,
            new Date(startDate),
            new Date(endDate),
            userId
          );
          break;
        case 'ISM':
          report = await complianceReportingService.generateISMReport(
            vesselId,
            new Date(startDate),
            new Date(endDate),
            userId
          );
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid report type'
          });
      }

      // Create PDF document
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${report.type}_Report_${vesselId}_${Date.now()}.pdf"`);
        res.send(pdfBuffer);
      });

      // PDF content
      doc.fontSize(20).text(`${report.type} Compliance Report`, 50, 50);
      doc.fontSize(12);
      doc.text(`Vessel ID: ${report.vesselId}`, 50, 100);
      doc.text(`Report Period: ${report.reportPeriod.startDate} to ${report.reportPeriod.endDate}`, 50, 120);
      doc.text(`Generated: ${report.generatedAt}`, 50, 140);
      doc.text(`Compliance Score: ${report.data.complianceScore}%`, 50, 160);

      let yPosition = 200;
      
      // Recommendations
      if (report.data.recommendations && report.data.recommendations.length > 0) {
        doc.fontSize(14).text('Recommendations:', 50, yPosition);
        yPosition += 20;
        
        report.data.recommendations.forEach((rec: string, index: number) => {
          doc.fontSize(10).text(`${index + 1}. ${rec}`, 70, yPosition);
          yPosition += 15;
        });
      }

      // Certificates
      if (report.data.certificates && report.data.certificates.details) {
        yPosition += 20;
        doc.fontSize(14).text('Certificates:', 50, yPosition);
        yPosition += 20;
        
        report.data.certificates.details.forEach((cert: any) => {
          doc.fontSize(10).text(`${cert.type}: ${cert.status} (Expires: ${cert.expiryDate})`, 70, yPosition);
          yPosition += 15;
        });
      }

      doc.end();

    } catch (error) {
      logger.error('Error exporting report to PDF', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to export report to PDF'
      });
    }
  }

  /**
   * Export audit trail to CSV
   */
  async exportAuditTrailToCSV(req: Request, res: Response) {
    try {
      const { startDate, endDate, vesselId, actionType, targetUserId } = req.body;
      const userId = req.user.id;

      const filters = {
        vesselId,
        actionType,
        userId: targetUserId
      };

      const auditTrail = await complianceReportingService.generateAuditTrailReport(
        new Date(startDate),
        new Date(endDate),
        userId,
        filters
      );

      // Convert to CSV
      const csvHeader = 'Transaction ID,User ID,User Name,Action,Resource,Timestamp,IP Address,User Agent\n';
      const csvRows = auditTrail.map(row => 
        `"${row.transactionId}","${row.userId}","${row.userName}","${row.action}","${row.resource}","${row.timestamp}","${row.ipAddress || ''}","${row.userAgent || ''}"`
      ).join('\n');
      
      const csvContent = csvHeader + csvRows;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_trail_${Date.now()}.csv"`);
      res.send(csvContent);

    } catch (error) {
      logger.error('Error exporting audit trail to CSV', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to export audit trail to CSV'
      });
    }
  }

  /**
   * Get compliance dashboard data
   */
  async getComplianceDashboard(req: Request, res: Response) {
    try {
      const { vesselId } = req.query;
      const userId = req.user.id;

      // Get alerts
      const alerts = await complianceReportingService.getComplianceAlerts(vesselId as string);

      // Get recent compliance activity (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const now = new Date();

      const recentActivity = await complianceReportingService.generateAuditTrailReport(
        thirtyDaysAgo,
        now,
        userId,
        { vesselId: vesselId as string }
      );

      // Calculate compliance metrics
      const criticalAlerts = alerts.filter(alert => alert.severity === 'CRITICAL').length;
      const highAlerts = alerts.filter(alert => alert.severity === 'HIGH').length;
      const totalAlerts = alerts.length;

      const dashboardData = {
        alerts: {
          total: totalAlerts,
          critical: criticalAlerts,
          high: highAlerts,
          medium: alerts.filter(alert => alert.severity === 'MEDIUM').length,
          low: alerts.filter(alert => alert.severity === 'LOW').length
        },
        recentActivity: {
          totalActions: recentActivity.length,
          uniqueUsers: new Set(recentActivity.map(activity => activity.userId)).size,
          topActions: this.getTopActions(recentActivity)
        },
        complianceStatus: {
          overallScore: this.calculateOverallComplianceScore(alerts),
          status: criticalAlerts > 0 ? 'CRITICAL' : highAlerts > 0 ? 'WARNING' : 'GOOD'
        }
      };

      res.json({
        success: true,
        data: dashboardData
      });

    } catch (error) {
      logger.error('Error getting compliance dashboard', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get compliance dashboard data'
      });
    }
  }

  private getTopActions(activities: any[]): any[] {
    const actionCounts = activities.reduce((acc, activity) => {
      acc[activity.action] = (acc[activity.action] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(actionCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));
  }

  private calculateOverallComplianceScore(alerts: any[]): number {
    let score = 100;
    
    alerts.forEach(alert => {
      switch (alert.severity) {
        case 'CRITICAL':
          score -= 20;
          break;
        case 'HIGH':
          score -= 10;
          break;
        case 'MEDIUM':
          score -= 5;
          break;
        case 'LOW':
          score -= 2;
          break;
      }
    });

    return Math.max(0, score);
  }
}

export const complianceController = new ComplianceController();