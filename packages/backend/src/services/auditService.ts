import { PrismaClient, AuditAction, AuditLog } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface AuditLogRequest {
  userId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  vesselId?: string;
  metadata?: any;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category?: 'AUTHENTICATION' | 'AUTHORIZATION' | 'DATA_ACCESS' | 'DATA_MODIFICATION' | 'SECURITY' | 'COMPLIANCE' | 'SYSTEM';
}

export interface SecurityIncident {
  type: 'UNAUTHORIZED_ACCESS' | 'SUSPICIOUS_ACTIVITY' | 'DATA_BREACH' | 'AUTHENTICATION_FAILURE' | 'PERMISSION_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  timestamp: Date;
}

export class AuditService {
  private static securityIncidents: SecurityIncident[] = [];
  private static suspiciousActivityThresholds = {
    failedLogins: 5,
    rapidRequests: 100, // requests per minute
    unauthorizedAccess: 3,
  };

  /**
   * Create an audit log entry with enhanced security monitoring
   */
  static async log(request: AuditLogRequest): Promise<AuditLog> {
    try {
      // Enhance request with additional metadata
      const enhancedRequest = {
        ...request,
        severity: request.severity || this.determineSeverity(request.action),
        category: request.category || this.categorizeAction(request.action),
      };

      const auditLog = await prisma.auditLog.create({
        data: {
          userId: enhancedRequest.userId,
          action: enhancedRequest.action,
          resource: enhancedRequest.resource,
          resourceId: enhancedRequest.resourceId,
          oldValues: enhancedRequest.oldValues,
          newValues: enhancedRequest.newValues,
          ipAddress: enhancedRequest.ipAddress,
          userAgent: enhancedRequest.userAgent,
          sessionId: enhancedRequest.sessionId,
          vesselId: enhancedRequest.vesselId,
          metadata: {
            ...enhancedRequest.metadata,
            severity: enhancedRequest.severity,
            category: enhancedRequest.category,
          },
        },
      });

      // Check for security incidents
      await this.detectSecurityIncidents(enhancedRequest);

      return auditLog;
    } catch (error) {
      logger.error('Error creating audit log:', error);
      throw error;
    }
  }

  /**
   * Detect and handle security incidents based on audit patterns
   */
  private static async detectSecurityIncidents(request: AuditLogRequest): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check for failed login attempts
    if (request.action === 'LOGIN' && request.metadata?.success === false && request.userId) {
      const recentFailures = await prisma.auditLog.count({
        where: {
          userId: request.userId,
          action: 'LOGIN',
          metadata: { path: ['success'], equals: false },
          createdAt: { gte: oneHourAgo },
        },
      });

      if (recentFailures >= this.suspiciousActivityThresholds.failedLogins) {
        await this.createSecurityIncident({
          type: 'AUTHENTICATION_FAILURE',
          severity: 'HIGH',
          description: `Multiple failed login attempts detected for user ${request.userId}`,
          userId: request.userId,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          details: { failedAttempts: recentFailures },
          timestamp: now,
        });
      }
    }

    // Check for unauthorized access attempts
    if (request.action === 'ACCESS_DENIED' || (request.metadata && request.metadata.unauthorized)) {
      const recentUnauthorized = await prisma.auditLog.count({
        where: {
          userId: request.userId,
          OR: [
            { action: 'ACCESS_DENIED' },
            { metadata: { path: ['unauthorized'], equals: true } },
          ],
          createdAt: { gte: oneHourAgo },
        },
      });

      if (recentUnauthorized >= this.suspiciousActivityThresholds.unauthorizedAccess) {
        await this.createSecurityIncident({
          type: 'UNAUTHORIZED_ACCESS',
          severity: 'HIGH',
          description: `Multiple unauthorized access attempts detected`,
          userId: request.userId,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          details: { unauthorizedAttempts: recentUnauthorized },
          timestamp: now,
        });
      }
    }

    // Check for rapid requests (potential DoS)
    if (request.ipAddress) {
      const recentRequests = await prisma.auditLog.count({
        where: {
          ipAddress: request.ipAddress,
          createdAt: { gte: new Date(now.getTime() - 60 * 1000) }, // Last minute
        },
      });

      if (recentRequests >= this.suspiciousActivityThresholds.rapidRequests) {
        await this.createSecurityIncident({
          type: 'SUSPICIOUS_ACTIVITY',
          severity: 'MEDIUM',
          description: `Rapid requests detected from IP ${request.ipAddress}`,
          ipAddress: request.ipAddress,
          details: { requestCount: recentRequests },
          timestamp: now,
        });
      }
    }
  }

  /**
   * Create a security incident record
   */
  private static async createSecurityIncident(incident: SecurityIncident): Promise<void> {
    try {
      // Store in database if SecurityIncident model exists
      // For now, log and store in memory
      this.securityIncidents.push(incident);

      // Send alert for critical incidents
      if (incident.severity === 'CRITICAL' || incident.severity === 'HIGH') {
        await this.sendSecurityAlert(incident);
      }

      logger.warn('Security incident created', {
        type: incident.type,
        severity: incident.severity,
        userId: incident.userId,
        ipAddress: incident.ipAddress,
      });

      // Log the incident creation as an audit event
      await this.log({
        action: 'CREATE',
        resource: 'security_incident',
        metadata: {
          incidentType: incident.type,
          severity: incident.severity,
          description: incident.description,
        },
        severity: 'HIGH',
        category: 'SECURITY',
      });
    } catch (error) {
      logger.error('Failed to create security incident', {
        error: error.message,
        incident,
      });
    }
  }

  /**
   * Send security alert notifications
   */
  private static async sendSecurityAlert(incident: SecurityIncident): Promise<void> {
    // Implementation would integrate with notification service
    logger.error('SECURITY ALERT', {
      type: incident.type,
      severity: incident.severity,
      description: incident.description,
      timestamp: incident.timestamp,
    });

    // TODO: Integrate with email/SMS notification service for security team
    // This would typically send alerts to security administrators
  }

  /**
   * Determine severity based on action type
   */
  private static determineSeverity(action: AuditAction): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const actionStr = action.toString();
    const criticalActions = ['DELETE', 'EMERGENCY_OVERRIDE'];
    const highActions = ['LOGIN', 'ACCESS_DENIED', 'EXPORT'];
    const mediumActions = ['UPDATE', 'CREATE', 'APPROVE'];

    if (criticalActions.some(a => actionStr.includes(a))) return 'CRITICAL';
    if (highActions.some(a => actionStr.includes(a))) return 'HIGH';
    if (mediumActions.some(a => actionStr.includes(a))) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Categorize action for better organization
   */
  private static categorizeAction(action: AuditAction): 'AUTHENTICATION' | 'AUTHORIZATION' | 'DATA_ACCESS' | 'DATA_MODIFICATION' | 'SECURITY' | 'COMPLIANCE' | 'SYSTEM' {
    const actionStr = action.toString();
    if (actionStr.includes('LOGIN') || actionStr.includes('LOGOUT')) return 'AUTHENTICATION';
    if (actionStr.includes('ACCESS') || actionStr.includes('PERMISSION')) return 'AUTHORIZATION';
    if (actionStr.includes('VIEW') || actionStr.includes('READ') || actionStr.includes('EXPORT')) return 'DATA_ACCESS';
    if (actionStr.includes('CREATE') || actionStr.includes('UPDATE') || actionStr.includes('DELETE')) return 'DATA_MODIFICATION';
    if (actionStr.includes('SECURITY')) return 'SECURITY';
    if (actionStr.includes('COMPLIANCE') || actionStr.includes('AUDIT')) return 'COMPLIANCE';
    return 'SYSTEM';
  }

  /**
   * Log security event with enhanced monitoring
   */
  static async logSecurityEvent(data: {
    userId?: string;
    action: string;
    error?: string;
    ip?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<AuditLog> {
    return this.log({
      userId: data.userId,
      action: 'SECURITY_EVENT',
      resource: 'security',
      ipAddress: data.ip,
      userAgent: data.userAgent,
      severity: 'HIGH',
      category: 'SECURITY',
      metadata: {
        securityAction: data.action,
        error: data.error,
        ...data.metadata,
      },
    });
  }

  /**
   * Log data access for sensitive information
   */
  static async logDataAccess(data: {
    userId: string;
    resource: string;
    resourceId: string;
    action: 'read' | 'write' | 'delete' | 'export';
    sensitiveData?: boolean;
    ipAddress?: string;
    userAgent?: string;
    dataFields?: string[];
  }): Promise<AuditLog> {
    return this.log({
      userId: data.userId,
      action: data.action.toUpperCase() as AuditAction,
      resource: data.resource,
      resourceId: data.resourceId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      severity: data.sensitiveData ? 'HIGH' : 'MEDIUM',
      category: 'DATA_ACCESS',
      metadata: {
        sensitiveData: data.sensitiveData || false,
        dataType: data.resource,
        accessedFields: data.dataFields,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log compliance-related events
   */
  static async logComplianceEvent(data: {
    userId?: string;
    regulation: string;
    complianceType: 'SOLAS' | 'MARPOL' | 'ISM' | 'GDPR' | 'SOX';
    action: string;
    vesselId?: string;
    details: Record<string, any>;
    ipAddress?: string;
  }): Promise<AuditLog> {
    return this.log({
      userId: data.userId,
      action: 'COMPLIANCE_EVENT',
      resource: 'compliance',
      resourceId: data.vesselId,
      vesselId: data.vesselId,
      ipAddress: data.ipAddress,
      severity: 'HIGH',
      category: 'COMPLIANCE',
      metadata: {
        regulation: data.regulation,
        complianceType: data.complianceType,
        complianceAction: data.action,
        ...data.details,
      },
    });
  }

  /**
   * Log banking data access with field-level tracking
   */
  static async logBankingDataAccess(data: {
    userId: string;
    vendorId: string;
    action: 'encrypt' | 'decrypt' | 'view' | 'update';
    fields: string[];
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    return this.log({
      userId: data.userId,
      action: data.action.toUpperCase() as AuditAction,
      resource: 'banking_data',
      resourceId: data.vendorId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      severity: 'CRITICAL',
      category: 'DATA_ACCESS',
      metadata: {
        sensitiveData: true,
        encryptedFields: data.fields,
        bankingDataAccess: true,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log workflow decision for audit trail
   */
  static async logWorkflowDecision(
    userId: string,
    requisitionId: string,
    decision: any
  ): Promise<AuditLog> {
    return this.log({
      userId,
      action: 'APPROVE',
      resource: 'workflow',
      resourceId: requisitionId,
      metadata: {
        workflowDecision: decision,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log general action for audit trail
   */
  static async logAction(
    userId: string,
    action: AuditAction,
    resource: string,
    resourceId?: string,
    oldValues?: any,
    newValues?: any,
    metadata?: any
  ): Promise<AuditLog> {
    return this.log({
      userId,
      action,
      resource,
      resourceId,
      oldValues,
      newValues,
      metadata
    });
  }

  /**
   * Get audit logs for a resource
   */
  static async getResourceAuditLogs(
    resource: string,
    resourceId?: string,
    limit: number = 100
  ): Promise<AuditLog[]> {
    try {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          resource,
          ...(resourceId && { resourceId }),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return auditLogs;
    } catch (error) {
      logger.error('Error getting resource audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a user
   */
  static async getUserAuditLogs(
    userId: string,
    limit: number = 100
  ): Promise<AuditLog[]> {
    try {
      const auditLogs = await prisma.auditLog.findMany({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return auditLogs;
    } catch (error) {
      logger.error('Error getting user audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit logs with advanced filtering
   */
  static async getAuditLogs(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    severity?: string;
    category?: string;
    startDate?: Date;
    endDate?: Date;
    limit: number;
    offset: number;
  }): Promise<AuditLog[]> {
    try {
      const where: any = {};

      if (filters.userId) where.userId = filters.userId;
      if (filters.action) where.action = filters.action;
      if (filters.resource) where.resource = filters.resource;
      if (filters.severity) where.metadata = { path: ['severity'], equals: filters.severity };
      if (filters.category) where.metadata = { path: ['category'], equals: filters.category };
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }

      const auditLogs = await prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit,
        skip: filters.offset,
      });

      return auditLogs;
    } catch (error) {
      logger.error('Error getting audit logs with filters:', error);
      throw error;
    }
  }
}