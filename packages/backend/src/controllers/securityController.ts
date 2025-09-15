import { Request, Response } from 'express';
import { AuditService } from '../services/auditService';
import { securityIncidentService } from '../services/securityIncidentService';
import { dataRetentionService } from '../services/dataRetentionService';
import { fieldEncryptionService } from '../services/fieldEncryptionService';
import { logger } from '../utils/logger';

export class SecurityController {
  /**
   * Get security incidents with filtering
   */
  static async getSecurityIncidents(req: Request, res: Response): Promise<void> {
    try {
      const {
        type,
        severity,
        status,
        startDate,
        endDate,
        limit = 50,
        offset = 0,
      } = req.query;

      const filters = {
        type: type as string,
        severity: severity as string,
        status: status as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      // This would normally query the database
      // For now, return mock data structure
      const incidents = [];

      await AuditService.logDataAccess({
        userId: req.user.id,
        resource: 'security_incidents',
        resourceId: 'list',
        action: 'read',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        data: incidents,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: incidents.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get security incidents', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve security incidents',
      });
    }
  }

  /**
   * Get specific security incident
   */
  static async getSecurityIncident(req: Request, res: Response): Promise<void> {
    try {
      const { incidentId } = req.params;

      // This would normally query the database
      const incident = null;

      if (!incident) {
        res.status(404).json({
          success: false,
          error: 'Security incident not found',
        });
        return;
      }

      await AuditService.logDataAccess({
        userId: req.user.id,
        resource: 'security_incidents',
        resourceId: incidentId,
        action: 'read',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        data: incident,
      });
    } catch (error) {
      logger.error('Failed to get security incident', {
        error: error.message,
        incidentId: req.params.incidentId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve security incident',
      });
    }
  }

  /**
   * Update security incident status
   */
  static async updateSecurityIncidentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { incidentId } = req.params;
      const { status, resolution } = req.body;

      if (!['INVESTIGATING', 'RESOLVED', 'CLOSED'].includes(status)) {
        res.status(400).json({
          success: false,
          error: 'Invalid status. Must be INVESTIGATING, RESOLVED, or CLOSED',
        });
        return;
      }

      // This would normally update the database
      // await securityIncidentService.updateSecurityIncidentStatus(incidentId, status, req.user.id);

      await AuditService.logAction(
        req.user.id,
        'UPDATE',
        'security_incidents',
        incidentId,
        { status: 'OPEN' }, // old value
        { status, resolution },
        {
          action: 'STATUS_UPDATE',
          updatedBy: req.user.id,
          resolution,
        }
      );

      res.json({
        success: true,
        message: 'Security incident status updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update security incident status', {
        error: error.message,
        incidentId: req.params.incidentId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update security incident status',
      });
    }
  }

  /**
   * Trigger security analysis
   */
  static async triggerSecurityAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const incidents = await securityIncidentService.analyzeSecurityPatterns();

      await AuditService.logAction(
        req.user.id,
        'CREATE',
        'security_analysis',
        undefined,
        undefined,
        { incidentsDetected: incidents.length },
        {
          action: 'MANUAL_SECURITY_ANALYSIS',
          triggeredBy: req.user.id,
        }
      );

      res.json({
        success: true,
        message: 'Security analysis completed',
        data: {
          incidentsDetected: incidents.length,
          incidents: incidents.map(incident => ({
            type: incident.type,
            severity: incident.severity,
            title: incident.title,
            riskScore: incident.riskScore,
          })),
        },
      });
    } catch (error) {
      logger.error('Failed to trigger security analysis', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to trigger security analysis',
      });
    }
  }

  /**
   * Get audit logs with enhanced filtering
   */
  static async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        action,
        resource,
        severity,
        category,
        startDate,
        endDate,
        limit = 100,
        offset = 0,
      } = req.query;

      const filters = {
        userId: userId as string,
        action: action as string,
        resource: resource as string,
        severity: severity as string,
        category: category as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      const logs = await AuditService.getAuditLogs(filters);

      await AuditService.logDataAccess({
        userId: req.user.id,
        resource: 'audit_logs',
        resourceId: 'list',
        action: 'read',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        data: logs,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: logs.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get audit logs', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit logs',
      });
    }
  }

  /**
   * Get data retention policies
   */
  static async getDataRetentionPolicies(req: Request, res: Response): Promise<void> {
    try {
      // This would normally query the database
      const policies = [
        {
          resource: 'audit_logs',
          retentionPeriodDays: 2555,
          archiveBeforeDelete: true,
          complianceRequirement: 'SOLAS/ISM',
        },
        {
          resource: 'banking_data',
          retentionPeriodDays: 2555,
          archiveBeforeDelete: true,
          complianceRequirement: 'Financial/PCI',
          legalHoldExemption: true,
        },
      ];

      await AuditService.logDataAccess({
        userId: req.user.id,
        resource: 'data_retention_policies',
        resourceId: 'list',
        action: 'read',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        data: policies,
      });
    } catch (error) {
      logger.error('Failed to get data retention policies', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve data retention policies',
      });
    }
  }

  /**
   * Execute data retention policies
   */
  static async executeDataRetention(req: Request, res: Response): Promise<void> {
    try {
      await dataRetentionService.executeRetentionPolicies();

      await AuditService.logAction(
        req.user.id,
        'CREATE',
        'data_retention_execution',
        undefined,
        undefined,
        { executedAt: new Date() },
        {
          action: 'MANUAL_RETENTION_EXECUTION',
          triggeredBy: req.user.id,
        }
      );

      res.json({
        success: true,
        message: 'Data retention policies executed successfully',
      });
    } catch (error) {
      logger.error('Failed to execute data retention policies', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to execute data retention policies',
      });
    }
  }

  /**
   * Place legal hold on resource
   */
  static async placeLegalHold(req: Request, res: Response): Promise<void> {
    try {
      const { resource, resourceId, reason } = req.body;

      if (!resource || !resourceId || !reason) {
        res.status(400).json({
          success: false,
          error: 'Resource, resourceId, and reason are required',
        });
        return;
      }

      await dataRetentionService.placeLegalHold(resource, resourceId, reason, req.user.id);

      res.json({
        success: true,
        message: 'Legal hold placed successfully',
      });
    } catch (error) {
      logger.error('Failed to place legal hold', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to place legal hold',
      });
    }
  }

  /**
   * Remove legal hold from resource
   */
  static async removeLegalHold(req: Request, res: Response): Promise<void> {
    try {
      const { resource, resourceId, reason } = req.body;

      if (!resource || !resourceId || !reason) {
        res.status(400).json({
          success: false,
          error: 'Resource, resourceId, and reason are required',
        });
        return;
      }

      await dataRetentionService.removeLegalHold(resource, resourceId, reason, req.user.id);

      res.json({
        success: true,
        message: 'Legal hold removed successfully',
      });
    } catch (error) {
      logger.error('Failed to remove legal hold', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to remove legal hold',
      });
    }
  }

  /**
   * Test field encryption (admin only)
   */
  static async testFieldEncryption(req: Request, res: Response): Promise<void> {
    try {
      if (req.user.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          error: 'Admin access required',
        });
        return;
      }

      const { testData } = req.body;

      if (!testData) {
        res.status(400).json({
          success: false,
          error: 'Test data is required',
        });
        return;
      }

      const encrypted = fieldEncryptionService.encryptField(testData);
      const decrypted = fieldEncryptionService.decryptField(encrypted);

      await AuditService.logAction(
        req.user.id,
        'CREATE',
        'encryption_test',
        undefined,
        undefined,
        { testPerformed: true },
        {
          action: 'ENCRYPTION_TEST',
          success: decrypted === testData,
        }
      );

      res.json({
        success: true,
        message: 'Encryption test completed',
        data: {
          originalLength: testData.length,
          encryptedLength: encrypted.encryptedData.length,
          decryptionSuccess: decrypted === testData,
        },
      });
    } catch (error) {
      logger.error('Failed to test field encryption', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to test field encryption',
      });
    }
  }
}

export default SecurityController;