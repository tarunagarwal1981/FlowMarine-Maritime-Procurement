import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { AuditService } from './auditService';

const prisma = new PrismaClient();

export interface TransactionRecord {
  id: string;
  transactionType: 'REQUISITION' | 'APPROVAL' | 'RFQ' | 'QUOTE' | 'PURCHASE_ORDER' | 'DELIVERY' | 'INVOICE' | 'PAYMENT';
  entityId: string;
  entityType: string;
  userId: string;
  vesselId?: string;
  action: string;
  status: string;
  previousStatus?: string;
  amount?: number;
  currency?: string;
  description: string;
  metadata: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface UserAccountabilityRecord {
  userId: string;
  userEmail: string;
  userName: string;
  role: string;
  transactionId: string;
  action: string;
  responsibility: string;
  timestamp: Date;
  vesselId?: string;
  vesselName?: string;
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  complianceFlags: string[];
}

export interface ComplianceAuditTrail {
  id: string;
  regulation: string;
  regulationType: 'SOLAS' | 'MARPOL' | 'ISM' | 'GDPR' | 'SOX';
  entityType: string;
  entityId: string;
  action: string;
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'UNDER_REVIEW' | 'EXEMPT';
  userId: string;
  vesselId?: string;
  timestamp: Date;
  evidence: Record<string, any>;
  reviewedBy?: string;
  reviewedAt?: Date;
  notes?: string;
}

export class TransactionHistoryService {
  /**
   * Record a transaction in the complete history
   */
  static async recordTransaction(data: {
    transactionType: TransactionRecord['transactionType'];
    entityId: string;
    entityType: string;
    userId: string;
    vesselId?: string;
    action: string;
    status: string;
    previousStatus?: string;
    amount?: number;
    currency?: string;
    description: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }): Promise<TransactionRecord> {
    try {
      const transaction = await prisma.transactionHistory.create({
        data: {
          transactionType: data.transactionType,
          entityId: data.entityId,
          entityType: data.entityType,
          userId: data.userId,
          vesselId: data.vesselId,
          action: data.action,
          status: data.status,
          previousStatus: data.previousStatus,
          amount: data.amount,
          currency: data.currency,
          description: data.description,
          metadata: data.metadata || {},
          timestamp: new Date(),
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          sessionId: data.sessionId,
        },
      });

      // Create user accountability record
      await this.createUserAccountabilityRecord({
        userId: data.userId,
        transactionId: transaction.id,
        action: data.action,
        responsibility: this.determineResponsibility(data.action, data.transactionType),
        vesselId: data.vesselId,
        impactLevel: this.calculateImpactLevel(data.transactionType, data.amount),
        complianceFlags: this.extractComplianceFlags(data.transactionType, data.metadata),
      });

      // Log to audit service
      await AuditService.logAction(
        data.userId,
        'CREATE',
        'transaction_history',
        transaction.id,
        undefined,
        {
          transactionType: data.transactionType,
          entityId: data.entityId,
          action: data.action,
          status: data.status,
        },
        {
          transactionRecorded: true,
          entityType: data.entityType,
          amount: data.amount,
          currency: data.currency,
        }
      );

      logger.info('Transaction recorded in history', {
        transactionId: transaction.id,
        transactionType: data.transactionType,
        entityId: data.entityId,
        userId: data.userId,
        action: data.action,
      });

      return transaction as TransactionRecord;
    } catch (error) {
      logger.error('Failed to record transaction', {
        error: error.message,
        transactionType: data.transactionType,
        entityId: data.entityId,
      });
      throw error;
    }
  }

  /**
   * Create user accountability record
   */
  private static async createUserAccountabilityRecord(data: {
    userId: string;
    transactionId: string;
    action: string;
    responsibility: string;
    vesselId?: string;
    impactLevel: UserAccountabilityRecord['impactLevel'];
    complianceFlags: string[];
  }): Promise<UserAccountabilityRecord> {
    try {
      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        select: {
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      if (!user) {
        throw new Error(`User not found: ${data.userId}`);
      }

      // Get vessel details if applicable
      let vessel = null;
      if (data.vesselId) {
        vessel = await prisma.vessel.findUnique({
          where: { id: data.vesselId },
          select: { name: true },
        });
      }

      const accountabilityRecord = await prisma.userAccountability.create({
        data: {
          userId: data.userId,
          userEmail: user.email,
          userName: `${user.firstName} ${user.lastName}`,
          role: user.role,
          transactionId: data.transactionId,
          action: data.action,
          responsibility: data.responsibility,
          timestamp: new Date(),
          vesselId: data.vesselId,
          vesselName: vessel?.name,
          impactLevel: data.impactLevel,
          complianceFlags: data.complianceFlags,
        },
      });

      return accountabilityRecord as UserAccountabilityRecord;
    } catch (error) {
      logger.error('Failed to create user accountability record', {
        error: error.message,
        userId: data.userId,
        transactionId: data.transactionId,
      });
      throw error;
    }
  }

  /**
   * Get complete transaction history for an entity
   */
  static async getEntityTransactionHistory(
    entityType: string,
    entityId: string
  ): Promise<TransactionRecord[]> {
    try {
      const transactions = await prisma.transactionHistory.findMany({
        where: {
          entityType,
          entityId,
        },
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          vessel: {
            select: {
              id: true,
              name: true,
              imoNumber: true,
            },
          },
        },
      });

      return transactions as TransactionRecord[];
    } catch (error) {
      logger.error('Failed to get entity transaction history', {
        error: error.message,
        entityType,
        entityId,
      });
      throw error;
    }
  }

  /**
   * Get user accountability records
   */
  static async getUserAccountabilityRecords(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<UserAccountabilityRecord[]> {
    try {
      const where: any = { userId };
      
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = startDate;
        if (endDate) where.timestamp.lte = endDate;
      }

      const records = await prisma.userAccountability.findMany({
        where,
        orderBy: { timestamp: 'desc' },
      });

      return records as UserAccountabilityRecord[];
    } catch (error) {
      logger.error('Failed to get user accountability records', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Create compliance audit trail entry
   */
  static async createComplianceAuditTrail(data: {
    regulation: string;
    regulationType: ComplianceAuditTrail['regulationType'];
    entityType: string;
    entityId: string;
    action: string;
    complianceStatus: ComplianceAuditTrail['complianceStatus'];
    userId: string;
    vesselId?: string;
    evidence: Record<string, any>;
    notes?: string;
  }): Promise<ComplianceAuditTrail> {
    try {
      const auditTrail = await prisma.complianceAuditTrail.create({
        data: {
          regulation: data.regulation,
          regulationType: data.regulationType,
          entityType: data.entityType,
          entityId: data.entityId,
          action: data.action,
          complianceStatus: data.complianceStatus,
          userId: data.userId,
          vesselId: data.vesselId,
          timestamp: new Date(),
          evidence: data.evidence,
          notes: data.notes,
        },
      });

      // Log compliance event
      await AuditService.logComplianceEvent({
        userId: data.userId,
        regulation: data.regulation,
        complianceType: data.regulationType,
        action: 'COMPLIANCE_AUDIT_TRAIL_CREATED',
        vesselId: data.vesselId,
        details: {
          entityType: data.entityType,
          entityId: data.entityId,
          complianceStatus: data.complianceStatus,
          evidence: Object.keys(data.evidence),
        },
      });

      logger.info('Compliance audit trail created', {
        regulation: data.regulation,
        entityType: data.entityType,
        entityId: data.entityId,
        complianceStatus: data.complianceStatus,
      });

      return auditTrail as ComplianceAuditTrail;
    } catch (error) {
      logger.error('Failed to create compliance audit trail', {
        error: error.message,
        regulation: data.regulation,
        entityId: data.entityId,
      });
      throw error;
    }
  }

  /**
   * Get compliance audit trail for regulation
   */
  static async getComplianceAuditTrail(
    regulationType: ComplianceAuditTrail['regulationType'],
    vesselId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ComplianceAuditTrail[]> {
    try {
      const where: any = { regulationType };
      
      if (vesselId) {
        where.vesselId = vesselId;
      }

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = startDate;
        if (endDate) where.timestamp.lte = endDate;
      }

      const auditTrails = await prisma.complianceAuditTrail.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          vessel: {
            select: {
              id: true,
              name: true,
              imoNumber: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return auditTrails as ComplianceAuditTrail[];
    } catch (error) {
      logger.error('Failed to get compliance audit trail', {
        error: error.message,
        regulationType,
      });
      throw error;
    }
  }

  /**
   * Review compliance audit trail entry
   */
  static async reviewComplianceAuditTrail(
    auditTrailId: string,
    reviewedBy: string,
    notes: string
  ): Promise<ComplianceAuditTrail> {
    try {
      const auditTrail = await prisma.complianceAuditTrail.update({
        where: { id: auditTrailId },
        data: {
          reviewedBy,
          reviewedAt: new Date(),
          notes,
        },
      });

      // Log the review
      await AuditService.logComplianceEvent({
        userId: reviewedBy,
        regulation: auditTrail.regulation,
        complianceType: auditTrail.regulationType,
        action: 'COMPLIANCE_AUDIT_TRAIL_REVIEWED',
        vesselId: auditTrail.vesselId,
        details: {
          auditTrailId,
          originalStatus: auditTrail.complianceStatus,
          reviewNotes: notes,
        },
      });

      logger.info('Compliance audit trail reviewed', {
        auditTrailId,
        reviewedBy,
        regulation: auditTrail.regulation,
      });

      return auditTrail as ComplianceAuditTrail;
    } catch (error) {
      logger.error('Failed to review compliance audit trail', {
        error: error.message,
        auditTrailId,
      });
      throw error;
    }
  }

  /**
   * Generate comprehensive transaction report
   */
  static async generateTransactionReport(filters: {
    startDate: Date;
    endDate: Date;
    vesselId?: string;
    userId?: string;
    transactionTypes?: TransactionRecord['transactionType'][];
    includeCompliance?: boolean;
  }): Promise<{
    transactions: TransactionRecord[];
    accountability: UserAccountabilityRecord[];
    complianceTrails: ComplianceAuditTrail[];
    summary: {
      totalTransactions: number;
      transactionsByType: Record<string, number>;
      userActions: Record<string, number>;
      complianceEvents: number;
      criticalActions: number;
    };
  }> {
    try {
      const where: any = {
        timestamp: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      };

      if (filters.vesselId) {
        where.vesselId = filters.vesselId;
      }

      if (filters.userId) {
        where.userId = filters.userId;
      }

      if (filters.transactionTypes && filters.transactionTypes.length > 0) {
        where.transactionType = { in: filters.transactionTypes };
      }

      // Get transactions
      const transactions = await prisma.transactionHistory.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          vessel: {
            select: {
              id: true,
              name: true,
              imoNumber: true,
            },
          },
        },
      });

      // Get accountability records
      const accountabilityWhere: any = {
        timestamp: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      };

      if (filters.vesselId) {
        accountabilityWhere.vesselId = filters.vesselId;
      }

      if (filters.userId) {
        accountabilityWhere.userId = filters.userId;
      }

      const accountability = await prisma.userAccountability.findMany({
        where: accountabilityWhere,
        orderBy: { timestamp: 'desc' },
      });

      // Get compliance trails if requested
      let complianceTrails: ComplianceAuditTrail[] = [];
      if (filters.includeCompliance) {
        const complianceWhere: any = {
          timestamp: {
            gte: filters.startDate,
            lte: filters.endDate,
          },
        };

        if (filters.vesselId) {
          complianceWhere.vesselId = filters.vesselId;
        }

        if (filters.userId) {
          complianceWhere.userId = filters.userId;
        }

        complianceTrails = await prisma.complianceAuditTrail.findMany({
          where: complianceWhere,
          orderBy: { timestamp: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
            vessel: {
              select: {
                id: true,
                name: true,
                imoNumber: true,
              },
            },
          },
        });
      }

      // Generate summary
      const transactionsByType: Record<string, number> = {};
      const userActions: Record<string, number> = {};
      let criticalActions = 0;

      for (const transaction of transactions) {
        // Count by type
        transactionsByType[transaction.transactionType] = 
          (transactionsByType[transaction.transactionType] || 0) + 1;

        // Count by user
        const userKey = `${transaction.user?.firstName} ${transaction.user?.lastName} (${transaction.user?.email})`;
        userActions[userKey] = (userActions[userKey] || 0) + 1;

        // Count critical actions
        if (transaction.amount && transaction.amount > 25000) {
          criticalActions++;
        }
      }

      const summary = {
        totalTransactions: transactions.length,
        transactionsByType,
        userActions,
        complianceEvents: complianceTrails.length,
        criticalActions,
      };

      logger.info('Transaction report generated', {
        startDate: filters.startDate,
        endDate: filters.endDate,
        totalTransactions: transactions.length,
        complianceEvents: complianceTrails.length,
      });

      return {
        transactions: transactions as TransactionRecord[],
        accountability: accountability as UserAccountabilityRecord[],
        complianceTrails: complianceTrails as ComplianceAuditTrail[],
        summary,
      };
    } catch (error) {
      logger.error('Failed to generate transaction report', {
        error: error.message,
        filters,
      });
      throw error;
    }
  }

  /**
   * Determine responsibility level based on action and transaction type
   */
  private static determineResponsibility(
    action: string,
    transactionType: TransactionRecord['transactionType']
  ): string {
    const responsibilityMap: Record<string, Record<string, string>> = {
      REQUISITION: {
        CREATE: 'Requisition Creation',
        SUBMIT: 'Requisition Submission',
        APPROVE: 'Requisition Approval',
        REJECT: 'Requisition Rejection',
      },
      PURCHASE_ORDER: {
        CREATE: 'Purchase Order Creation',
        APPROVE: 'Purchase Order Approval',
        SEND: 'Purchase Order Transmission',
      },
      INVOICE: {
        PROCESS: 'Invoice Processing',
        APPROVE: 'Invoice Approval',
        PAY: 'Payment Authorization',
      },
      PAYMENT: {
        AUTHORIZE: 'Payment Authorization',
        EXECUTE: 'Payment Execution',
        VERIFY: 'Payment Verification',
      },
    };

    return responsibilityMap[transactionType]?.[action] || `${transactionType} ${action}`;
  }

  /**
   * Calculate impact level based on transaction type and amount
   */
  private static calculateImpactLevel(
    transactionType: TransactionRecord['transactionType'],
    amount?: number
  ): UserAccountabilityRecord['impactLevel'] {
    // High-impact transaction types
    const highImpactTypes = ['PAYMENT', 'INVOICE'];
    if (highImpactTypes.includes(transactionType)) {
      return 'HIGH';
    }

    // Amount-based impact
    if (amount) {
      if (amount >= 25000) return 'CRITICAL';
      if (amount >= 5000) return 'HIGH';
      if (amount >= 500) return 'MEDIUM';
    }

    // Default based on transaction type
    const mediumImpactTypes = ['PURCHASE_ORDER', 'APPROVAL'];
    if (mediumImpactTypes.includes(transactionType)) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Extract compliance flags from transaction metadata
   */
  private static extractComplianceFlags(
    transactionType: TransactionRecord['transactionType'],
    metadata?: Record<string, any>
  ): string[] {
    const flags: string[] = [];

    // Add transaction type specific flags
    if (transactionType === 'PAYMENT') {
      flags.push('FINANCIAL_COMPLIANCE');
    }

    if (transactionType === 'PURCHASE_ORDER') {
      flags.push('PROCUREMENT_COMPLIANCE');
    }

    // Extract from metadata
    if (metadata) {
      if (metadata.emergencyOverride) {
        flags.push('EMERGENCY_OVERRIDE');
      }

      if (metadata.complianceFlags) {
        flags.push(...metadata.complianceFlags);
      }

      if (metadata.vesselSafety) {
        flags.push('VESSEL_SAFETY');
      }
    }

    return flags;
  }
}

export const transactionHistoryService = TransactionHistoryService;