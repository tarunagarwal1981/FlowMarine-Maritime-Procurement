import { Request, Response } from 'express';
import { documentVersionService } from '../services/documentVersionService';
import { transactionHistoryService } from '../services/transactionHistoryService';
import { automatedComplianceReportingService } from '../services/automatedComplianceReportingService';
import { AuditService } from '../services/auditService';
import { logger } from '../utils/logger';

export class ComplianceDocumentController {
  /**
   * Create new document version
   */
  static async createDocumentVersion(req: Request, res: Response): Promise<void> {
    try {
      const {
        documentId,
        title,
        content,
        fileUrl,
        fileSize,
        mimeType,
        checksum,
        changeDescription,
        tags,
        metadata,
      } = req.body;

      if (!documentId || !title || !checksum) {
        res.status(400).json({
          success: false,
          error: 'Document ID, title, and checksum are required',
        });
        return;
      }

      const version = await documentVersionService.createDocumentVersion({
        documentId,
        title,
        content,
        fileUrl,
        fileSize,
        mimeType,
        checksum,
        createdBy: req.user.id,
        changeDescription,
        tags,
        metadata,
      });

      await AuditService.logDataAccess({
        userId: req.user.id,
        resource: 'document_versions',
        resourceId: version.id,
        action: 'write',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.status(201).json({
        success: true,
        data: version,
      });
    } catch (error) {
      logger.error('Failed to create document version', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create document version',
      });
    }
  }

  /**
   * Get document version history
   */
  static async getDocumentVersionHistory(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      const versions = await documentVersionService.getDocumentVersionHistory(documentId);

      await AuditService.logDataAccess({
        userId: req.user.id,
        resource: 'document_versions',
        resourceId: documentId,
        action: 'read',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        data: versions,
      });
    } catch (error) {
      logger.error('Failed to get document version history', {
        error: error.message,
        documentId: req.params.documentId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve document version history',
      });
    }
  }

  /**
   * Get specific document version
   */
  static async getDocumentVersion(req: Request, res: Response): Promise<void> {
    try {
      const { documentId, version } = req.params;
      const versionNumber = parseInt(version);

      if (isNaN(versionNumber)) {
        res.status(400).json({
          success: false,
          error: 'Invalid version number',
        });
        return;
      }

      const documentVersion = await documentVersionService.getDocumentVersion(documentId, versionNumber);

      if (!documentVersion) {
        res.status(404).json({
          success: false,
          error: 'Document version not found',
        });
        return;
      }

      await AuditService.logDataAccess({
        userId: req.user.id,
        resource: 'document_versions',
        resourceId: documentVersion.id,
        action: 'read',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        data: documentVersion,
      });
    } catch (error) {
      logger.error('Failed to get document version', {
        error: error.message,
        documentId: req.params.documentId,
        version: req.params.version,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve document version',
      });
    }
  }

  /**
   * Restore document to previous version
   */
  static async restoreDocumentVersion(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const { targetVersion, reason } = req.body;

      if (!targetVersion || !reason) {
        res.status(400).json({
          success: false,
          error: 'Target version and reason are required',
        });
        return;
      }

      const restoredVersion = await documentVersionService.restoreDocumentVersion(
        documentId,
        targetVersion,
        req.user.id,
        reason
      );

      res.json({
        success: true,
        data: restoredVersion,
        message: `Document restored to version ${targetVersion}`,
      });
    } catch (error) {
      logger.error('Failed to restore document version', {
        error: error.message,
        documentId: req.params.documentId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to restore document version',
      });
    }
  }

  /**
   * Get document change history
   */
  static async getDocumentChangeHistory(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      const changeHistory = await documentVersionService.getDocumentChangeHistory(documentId);

      await AuditService.logDataAccess({
        userId: req.user.id,
        resource: 'document_change_logs',
        resourceId: documentId,
        action: 'read',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        data: changeHistory,
      });
    } catch (error) {
      logger.error('Failed to get document change history', {
        error: error.message,
        documentId: req.params.documentId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve document change history',
      });
    }
  }

  /**
   * Add compliance flag to document
   */
  static async addComplianceFlag(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const {
        regulation,
        regulationType,
        flagType,
        description,
        dueDate,
        vesselId,
        metadata,
      } = req.body;

      if (!regulation || !regulationType || !flagType || !description) {
        res.status(400).json({
          success: false,
          error: 'Regulation, regulation type, flag type, and description are required',
        });
        return;
      }

      const flag = await documentVersionService.addComplianceFlag({
        documentId,
        regulation,
        regulationType,
        flagType,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        vesselId,
        metadata,
        flaggedBy: req.user.id,
      });

      res.status(201).json({
        success: true,
        data: flag,
      });
    } catch (error) {
      logger.error('Failed to add compliance flag', {
        error: error.message,
        documentId: req.params.documentId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to add compliance flag',
      });
    }
  }

  /**
   * Resolve compliance flag
   */
  static async resolveComplianceFlag(req: Request, res: Response): Promise<void> {
    try {
      const { flagId } = req.params;
      const { resolution } = req.body;

      if (!resolution) {
        res.status(400).json({
          success: false,
          error: 'Resolution description is required',
        });
        return;
      }

      const resolvedFlag = await documentVersionService.resolveComplianceFlag(
        flagId,
        req.user.id,
        resolution
      );

      res.json({
        success: true,
        data: resolvedFlag,
        message: 'Compliance flag resolved successfully',
      });
    } catch (error) {
      logger.error('Failed to resolve compliance flag', {
        error: error.message,
        flagId: req.params.flagId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to resolve compliance flag',
      });
    }
  }

  /**
   * Get compliance flags for document
   */
  static async getDocumentComplianceFlags(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      const flags = await documentVersionService.getDocumentComplianceFlags(documentId);

      await AuditService.logDataAccess({
        userId: req.user.id,
        resource: 'compliance_flags',
        resourceId: documentId,
        action: 'read',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        data: flags,
      });
    } catch (error) {
      logger.error('Failed to get document compliance flags', {
        error: error.message,
        documentId: req.params.documentId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve compliance flags',
      });
    }
  }

  /**
   * Get compliance flags by regulation
   */
  static async getComplianceFlagsByRegulation(req: Request, res: Response): Promise<void> {
    try {
      const { regulationType } = req.params;
      const { vesselId } = req.query;

      const flags = await documentVersionService.getComplianceFlagsByRegulation(
        regulationType as any,
        vesselId as string
      );

      await AuditService.logDataAccess({
        userId: req.user.id,
        resource: 'compliance_flags',
        resourceId: `regulation:${regulationType}`,
        action: 'read',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        data: flags,
      });
    } catch (error) {
      logger.error('Failed to get compliance flags by regulation', {
        error: error.message,
        regulationType: req.params.regulationType,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve compliance flags',
      });
    }
  }

  /**
   * Get transaction history for entity
   */
  static async getEntityTransactionHistory(req: Request, res: Response): Promise<void> {
    try {
      const { entityType, entityId } = req.params;

      const transactions = await transactionHistoryService.getEntityTransactionHistory(
        entityType,
        entityId
      );

      await AuditService.logDataAccess({
        userId: req.user.id,
        resource: 'transaction_history',
        resourceId: `${entityType}:${entityId}`,
        action: 'read',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      logger.error('Failed to get entity transaction history', {
        error: error.message,
        entityType: req.params.entityType,
        entityId: req.params.entityId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve transaction history',
      });
    }
  }

  /**
   * Get user accountability records
   */
  static async getUserAccountabilityRecords(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      // Only allow users to view their own records unless admin
      if (userId !== req.user.id && req.user.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          error: 'Access denied to user accountability records',
        });
        return;
      }

      const records = await transactionHistoryService.getUserAccountabilityRecords(
        userId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      await AuditService.logDataAccess({
        userId: req.user.id,
        resource: 'user_accountability',
        resourceId: userId,
        action: 'read',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        data: records,
      });
    } catch (error) {
      logger.error('Failed to get user accountability records', {
        error: error.message,
        userId: req.params.userId,
        requesterId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve accountability records',
      });
    }
  }

  /**
   * Generate transaction report
   */
  static async generateTransactionReport(req: Request, res: Response): Promise<void> {
    try {
      const {
        startDate,
        endDate,
        vesselId,
        userId,
        transactionTypes,
        includeCompliance,
      } = req.body;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Start date and end date are required',
        });
        return;
      }

      const report = await transactionHistoryService.generateTransactionReport({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        vesselId,
        userId,
        transactionTypes,
        includeCompliance: includeCompliance === true,
      });

      await AuditService.logAction(
        req.user.id,
        'CREATE',
        'transaction_report',
        undefined,
        undefined,
        {
          reportGenerated: true,
          totalTransactions: report.summary.totalTransactions,
        },
        {
          startDate,
          endDate,
          vesselId,
          includeCompliance,
        }
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Failed to generate transaction report', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate transaction report',
      });
    }
  }

  /**
   * Generate compliance report
   */
  static async generateComplianceReport(req: Request, res: Response): Promise<void> {
    try {
      const {
        reportType,
        vesselId,
        startDate,
        endDate,
      } = req.body;

      if (!reportType || !startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Report type, start date, and end date are required',
        });
        return;
      }

      const reportPeriod = {
        start: new Date(startDate),
        end: new Date(endDate),
      };

      let report;

      switch (reportType) {
        case 'SOLAS':
          if (!vesselId) {
            res.status(400).json({
              success: false,
              error: 'Vessel ID is required for SOLAS reports',
            });
            return;
          }
          report = await automatedComplianceReportingService.generateSOLASReport(
            vesselId,
            reportPeriod,
            req.user.id
          );
          break;

        case 'ISM':
          if (!vesselId) {
            res.status(400).json({
              success: false,
              error: 'Vessel ID is required for ISM reports',
            });
            return;
          }
          report = await automatedComplianceReportingService.generateISMReport(
            vesselId,
            reportPeriod,
            req.user.id
          );
          break;

        case 'FINANCIAL_AUDIT':
          report = await automatedComplianceReportingService.generateFinancialAuditReport(
            vesselId || null,
            reportPeriod,
            req.user.id
          );
          break;

        default:
          res.status(400).json({
            success: false,
            error: 'Invalid report type. Supported types: SOLAS, ISM, FINANCIAL_AUDIT',
          });
          return;
      }

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Failed to generate compliance report', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate compliance report',
      });
    }
  }

  /**
   * Get compliance reports
   */
  static async getComplianceReports(req: Request, res: Response): Promise<void> {
    try {
      const {
        reportType,
        vesselId,
        startDate,
        endDate,
        status,
        limit,
        offset,
      } = req.query;

      const reports = await automatedComplianceReportingService.getComplianceReports({
        reportType: reportType as string,
        vesselId: vesselId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      await AuditService.logDataAccess({
        userId: req.user.id,
        resource: 'compliance_reports',
        resourceId: 'list',
        action: 'read',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        data: reports,
      });
    } catch (error) {
      logger.error('Failed to get compliance reports', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve compliance reports',
      });
    }
  }

  /**
   * Update compliance report status
   */
  static async updateComplianceReportStatus(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const { status } = req.body;

      if (!status) {
        res.status(400).json({
          success: false,
          error: 'Status is required',
        });
        return;
      }

      const validStatuses = ['DRAFT', 'COMPLETED', 'REVIEWED', 'APPROVED', 'SUBMITTED'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          error: `Invalid status. Valid statuses: ${validStatuses.join(', ')}`,
        });
        return;
      }

      const updatedReport = await automatedComplianceReportingService.updateComplianceReportStatus(
        reportId,
        status,
        req.user.id
      );

      res.json({
        success: true,
        data: updatedReport,
        message: 'Compliance report status updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update compliance report status', {
        error: error.message,
        reportId: req.params.reportId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update compliance report status',
      });
    }
  }

  /**
   * Get compliance audit trail
   */
  static async getComplianceAuditTrail(req: Request, res: Response): Promise<void> {
    try {
      const { regulationType } = req.params;
      const { vesselId, startDate, endDate } = req.query;

      const auditTrail = await transactionHistoryService.getComplianceAuditTrail(
        regulationType as any,
        vesselId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      await AuditService.logDataAccess({
        userId: req.user.id,
        resource: 'compliance_audit_trail',
        resourceId: regulationType,
        action: 'read',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        data: auditTrail,
      });
    } catch (error) {
      logger.error('Failed to get compliance audit trail', {
        error: error.message,
        regulationType: req.params.regulationType,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve compliance audit trail',
      });
    }
  }
}

export default ComplianceDocumentController;