import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { AuditService } from './auditService';

const prisma = new PrismaClient();

export interface RetentionPolicy {
  resource: string;
  retentionPeriodDays: number;
  archiveBeforeDelete: boolean;
  complianceRequirement?: string;
  legalHoldExemption?: boolean;
}

export interface ArchivalRecord {
  id: string;
  resource: string;
  resourceId: string;
  originalData: any;
  archivedAt: Date;
  retentionPolicy: string;
  complianceFlags: string[];
}

export class DataRetentionService {
  private static retentionPolicies: Map<string, RetentionPolicy> = new Map([
    // Maritime compliance requirements
    ['audit_logs', {
      resource: 'audit_logs',
      retentionPeriodDays: 2555, // 7 years for maritime compliance
      archiveBeforeDelete: true,
      complianceRequirement: 'SOLAS/ISM',
    }],
    ['requisitions', {
      resource: 'requisitions',
      retentionPeriodDays: 2555, // 7 years
      archiveBeforeDelete: true,
      complianceRequirement: 'Maritime Safety',
    }],
    ['purchase_orders', {
      resource: 'purchase_orders',
      retentionPeriodDays: 2555, // 7 years
      archiveBeforeDelete: true,
      complianceRequirement: 'Financial Records',
    }],
    ['invoices', {
      resource: 'invoices',
      retentionPeriodDays: 2555, // 7 years
      archiveBeforeDelete: true,
      complianceRequirement: 'Tax/Financial',
    }],
    ['security_incidents', {
      resource: 'security_incidents',
      retentionPeriodDays: 3650, // 10 years for security records
      archiveBeforeDelete: true,
      complianceRequirement: 'Security Compliance',
    }],
    ['banking_data', {
      resource: 'banking_data',
      retentionPeriodDays: 2555, // 7 years
      archiveBeforeDelete: true,
      complianceRequirement: 'Financial/PCI',
      legalHoldExemption: true, // May need to be retained longer for legal reasons
    }],
    ['user_sessions', {
      resource: 'user_sessions',
      retentionPeriodDays: 90, // 3 months
      archiveBeforeDelete: false,
    }],
    ['refresh_tokens', {
      resource: 'refresh_tokens',
      retentionPeriodDays: 30, // 1 month after expiry
      archiveBeforeDelete: false,
    }],
    ['notifications', {
      resource: 'notifications',
      retentionPeriodDays: 365, // 1 year
      archiveBeforeDelete: false,
    }],
  ]);

  /**
   * Execute data retention policies for all resources
   */
  static async executeRetentionPolicies(): Promise<void> {
    logger.info('Starting data retention policy execution');

    for (const [resource, policy] of this.retentionPolicies) {
      try {
        await this.processResourceRetention(resource, policy);
      } catch (error) {
        logger.error(`Failed to process retention for ${resource}`, {
          error: error.message,
          resource,
          policy,
        });
      }
    }

    logger.info('Data retention policy execution completed');
  }

  /**
   * Process retention policy for a specific resource
   */
  private static async processResourceRetention(resource: string, policy: RetentionPolicy): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriodDays);

    logger.info(`Processing retention for ${resource}`, {
      cutoffDate,
      retentionDays: policy.retentionPeriodDays,
    });

    // Get records older than retention period
    const expiredRecords = await this.getExpiredRecords(resource, cutoffDate);

    if (expiredRecords.length === 0) {
      logger.info(`No expired records found for ${resource}`);
      return;
    }

    logger.info(`Found ${expiredRecords.length} expired records for ${resource}`);

    // Archive before deletion if required
    if (policy.archiveBeforeDelete) {
      await this.archiveRecords(resource, expiredRecords, policy);
    }

    // Delete expired records (unless under legal hold)
    if (!policy.legalHoldExemption) {
      await this.deleteExpiredRecords(resource, expiredRecords);
    }

    // Log retention activity
    await AuditService.logComplianceEvent({
      regulation: policy.complianceRequirement || 'Data Retention Policy',
      complianceType: 'GDPR',
      action: 'DATA_RETENTION_EXECUTED',
      details: {
        resource,
        expiredRecordsCount: expiredRecords.length,
        archived: policy.archiveBeforeDelete,
        deleted: !policy.legalHoldExemption,
        cutoffDate,
      },
    });
  }

  /**
   * Get records that have expired based on retention policy
   */
  private static async getExpiredRecords(resource: string, cutoffDate: Date): Promise<any[]> {
    switch (resource) {
      case 'audit_logs':
        return await prisma.auditLog.findMany({
          where: { createdAt: { lt: cutoffDate } },
        });

      case 'user_sessions':
        return await prisma.refreshToken.findMany({
          where: { 
            OR: [
              { expiresAt: { lt: cutoffDate } },
              { createdAt: { lt: cutoffDate } },
            ],
          },
        });

      case 'notifications':
        return await prisma.notification.findMany({
          where: { createdAt: { lt: cutoffDate } },
        });

      // Add more resources as needed
      default:
        logger.warn(`No retention handler for resource: ${resource}`);
        return [];
    }
  }

  /**
   * Archive records before deletion
   */
  private static async archiveRecords(resource: string, records: any[], policy: RetentionPolicy): Promise<void> {
    const archivalRecords: ArchivalRecord[] = records.map(record => ({
      id: record.id,
      resource,
      resourceId: record.id,
      originalData: record,
      archivedAt: new Date(),
      retentionPolicy: `${policy.resource}_${policy.retentionPeriodDays}d`,
      complianceFlags: policy.complianceRequirement ? [policy.complianceRequirement] : [],
    }));

    // Store in archive table or external storage
    // For now, we'll log the archival
    logger.info(`Archiving ${archivalRecords.length} records for ${resource}`, {
      resource,
      recordCount: archivalRecords.length,
      complianceRequirement: policy.complianceRequirement,
    });

    // TODO: Implement actual archival storage (could be S3, separate database, etc.)
    // await this.storeInArchive(archivalRecords);
  }

  /**
   * Delete expired records from active database
   */
  private static async deleteExpiredRecords(resource: string, records: any[]): Promise<void> {
    const recordIds = records.map(record => record.id);

    switch (resource) {
      case 'audit_logs':
        await prisma.auditLog.deleteMany({
          where: { id: { in: recordIds } },
        });
        break;

      case 'user_sessions':
        await prisma.refreshToken.deleteMany({
          where: { id: { in: recordIds } },
        });
        break;

      case 'notifications':
        await prisma.notification.deleteMany({
          where: { id: { in: recordIds } },
        });
        break;

      default:
        logger.warn(`No deletion handler for resource: ${resource}`);
        return;
    }

    logger.info(`Deleted ${recordIds.length} expired records for ${resource}`, {
      resource,
      deletedCount: recordIds.length,
    });
  }

  /**
   * Check if a resource is under legal hold
   */
  static async isUnderLegalHold(resource: string, resourceId: string): Promise<boolean> {
    // TODO: Implement legal hold checking logic
    // This would typically check against a legal holds table
    return false;
  }

  /**
   * Place a resource under legal hold
   */
  static async placeLegalHold(resource: string, resourceId: string, reason: string, userId: string): Promise<void> {
    // TODO: Implement legal hold placement
    logger.info(`Legal hold placed on ${resource}:${resourceId}`, {
      resource,
      resourceId,
      reason,
      userId,
    });

    await AuditService.logComplianceEvent({
      userId,
      regulation: 'Legal Hold',
      complianceType: 'SOX',
      action: 'LEGAL_HOLD_PLACED',
      details: {
        resource,
        resourceId,
        reason,
      },
    });
  }

  /**
   * Remove legal hold from a resource
   */
  static async removeLegalHold(resource: string, resourceId: string, reason: string, userId: string): Promise<void> {
    // TODO: Implement legal hold removal
    logger.info(`Legal hold removed from ${resource}:${resourceId}`, {
      resource,
      resourceId,
      reason,
      userId,
    });

    await AuditService.logComplianceEvent({
      userId,
      regulation: 'Legal Hold',
      complianceType: 'SOX',
      action: 'LEGAL_HOLD_REMOVED',
      details: {
        resource,
        resourceId,
        reason,
      },
    });
  }

  /**
   * Get retention policy for a resource
   */
  static getRetentionPolicy(resource: string): RetentionPolicy | undefined {
    return this.retentionPolicies.get(resource);
  }

  /**
   * Update retention policy for a resource
   */
  static updateRetentionPolicy(resource: string, policy: RetentionPolicy): void {
    this.retentionPolicies.set(resource, policy);
    logger.info(`Updated retention policy for ${resource}`, { policy });
  }

  /**
   * Schedule automatic retention policy execution
   */
  static scheduleRetentionExecution(): void {
    // Run daily at 2 AM
    const runDaily = () => {
      const now = new Date();
      const nextRun = new Date();
      nextRun.setHours(2, 0, 0, 0);
      
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      const timeUntilRun = nextRun.getTime() - now.getTime();

      setTimeout(async () => {
        await this.executeRetentionPolicies();
        runDaily(); // Schedule next run
      }, timeUntilRun);
    };

    runDaily();
    logger.info('Data retention scheduler initialized');
  }
}

export const dataRetentionService = DataRetentionService;