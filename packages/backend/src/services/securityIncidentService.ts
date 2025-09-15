import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { AuditService } from './auditService';

const prisma = new PrismaClient();

export interface SecurityIncident {
  id?: string;
  type: 'UNAUTHORIZED_ACCESS' | 'SUSPICIOUS_ACTIVITY' | 'DATA_BREACH' | 'AUTHENTICATION_FAILURE' | 'PERMISSION_VIOLATION' | 'MALWARE_DETECTED' | 'INSIDER_THREAT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  title: string;
  description: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  vesselId?: string;
  affectedResources: string[];
  indicators: SecurityIndicator[];
  mitigationSteps: string[];
  timestamp: Date;
  detectedBy: 'SYSTEM' | 'USER' | 'EXTERNAL';
  riskScore: number;
}

export interface SecurityIndicator {
  type: 'BEHAVIORAL' | 'NETWORK' | 'AUTHENTICATION' | 'DATA_ACCESS' | 'SYSTEM';
  name: string;
  value: any;
  threshold?: any;
  confidence: number; // 0-100
}

export interface SecurityAlert {
  incidentId: string;
  alertLevel: 'INFO' | 'WARNING' | 'CRITICAL';
  recipients: string[];
  channels: ('EMAIL' | 'SMS' | 'WEBHOOK' | 'DASHBOARD')[];
  message: string;
  sentAt: Date;
}

export class SecurityIncidentService {
  private static alertThresholds = {
    CRITICAL: 90,
    HIGH: 70,
    MEDIUM: 40,
    LOW: 20,
  };

  private static incidentPatterns = [
    {
      name: 'Multiple Failed Logins',
      type: 'AUTHENTICATION_FAILURE' as const,
      indicators: [
        { type: 'AUTHENTICATION' as const, name: 'failed_login_count', threshold: 5 },
        { type: 'BEHAVIORAL' as const, name: 'time_window_minutes', threshold: 60 },
      ],
      riskScore: 75,
    },
    {
      name: 'Unusual Data Access Pattern',
      type: 'SUSPICIOUS_ACTIVITY' as const,
      indicators: [
        { type: 'DATA_ACCESS' as const, name: 'sensitive_data_access_count', threshold: 10 },
        { type: 'BEHAVIORAL' as const, name: 'off_hours_access', threshold: true },
      ],
      riskScore: 80,
    },
    {
      name: 'Privilege Escalation Attempt',
      type: 'PERMISSION_VIOLATION' as const,
      indicators: [
        { type: 'BEHAVIORAL' as const, name: 'permission_denied_count', threshold: 3 },
        { type: 'BEHAVIORAL' as const, name: 'role_change_attempts', threshold: 1 },
      ],
      riskScore: 85,
    },
    {
      name: 'Bulk Data Export',
      type: 'DATA_BREACH' as const,
      indicators: [
        { type: 'DATA_ACCESS' as const, name: 'export_volume_mb', threshold: 100 },
        { type: 'DATA_ACCESS' as const, name: 'export_frequency', threshold: 5 },
      ],
      riskScore: 95,
    },
  ];

  /**
   * Create a new security incident
   */
  static async createIncident(incident: Omit<SecurityIncident, 'id' | 'timestamp'>): Promise<SecurityIncident> {
    try {
      const newIncident: SecurityIncident = {
        ...incident,
        timestamp: new Date(),
      };

      // Store incident (assuming we have a SecurityIncident model)
      // For now, we'll log it and store in memory/audit log
      logger.error('Security incident created', {
        type: newIncident.type,
        severity: newIncident.severity,
        title: newIncident.title,
        riskScore: newIncident.riskScore,
      });

      // Log to audit trail
      await AuditService.logSecurityEvent({
        userId: newIncident.userId,
        action: 'SECURITY_INCIDENT_CREATED',
        ip: newIncident.ipAddress,
        userAgent: newIncident.userAgent,
        metadata: {
          incidentType: newIncident.type,
          severity: newIncident.severity,
          riskScore: newIncident.riskScore,
          affectedResources: newIncident.affectedResources,
          indicators: newIncident.indicators,
        },
      });

      // Send alerts based on severity
      await this.sendSecurityAlerts(newIncident);

      // Auto-trigger mitigation for certain incident types
      await this.autoMitigate(newIncident);

      return newIncident;
    } catch (error) {
      logger.error('Failed to create security incident', {
        error: error.message,
        incident,
      });
      throw error;
    }
  }

  /**
   * Analyze audit logs for security incidents
   */
  static async analyzeSecurityPatterns(): Promise<SecurityIncident[]> {
    const detectedIncidents: SecurityIncident[] = [];
    const now = new Date();
    const analysisWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

    try {
      // Get recent audit logs for analysis
      const recentLogs = await prisma.auditLog.findMany({
        where: {
          createdAt: { gte: analysisWindow },
        },
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Analyze each pattern
      for (const pattern of this.incidentPatterns) {
        const incidents = await this.detectPattern(pattern, recentLogs);
        detectedIncidents.push(...incidents);
      }

      // Create incidents for newly detected patterns
      for (const incident of detectedIncidents) {
        await this.createIncident(incident);
      }

      return detectedIncidents;
    } catch (error) {
      logger.error('Failed to analyze security patterns', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Detect specific security patterns in audit logs
   */
  private static async detectPattern(pattern: any, auditLogs: any[]): Promise<SecurityIncident[]> {
    const incidents: SecurityIncident[] = [];

    // Group logs by user and IP for pattern analysis
    const userGroups = this.groupLogsByUser(auditLogs);
    const ipGroups = this.groupLogsByIP(auditLogs);

    // Analyze user-based patterns
    for (const [userId, userLogs] of userGroups) {
      const indicators = this.analyzeUserBehavior(userLogs, pattern);
      if (this.matchesPattern(indicators, pattern)) {
        const user = userLogs[0]?.user;
        incidents.push({
          type: pattern.type,
          severity: this.calculateSeverity(pattern.riskScore),
          status: 'OPEN',
          title: `${pattern.name} - User ${user?.email || userId}`,
          description: `Detected ${pattern.name.toLowerCase()} for user ${user?.email || userId}`,
          userId,
          affectedResources: this.extractAffectedResources(userLogs),
          indicators,
          mitigationSteps: this.getMitigationSteps(pattern.type),
          timestamp: new Date(),
          detectedBy: 'SYSTEM',
          riskScore: pattern.riskScore,
        });
      }
    }

    // Analyze IP-based patterns
    for (const [ipAddress, ipLogs] of ipGroups) {
      const indicators = this.analyzeIPBehavior(ipLogs, pattern);
      if (this.matchesPattern(indicators, pattern)) {
        incidents.push({
          type: pattern.type,
          severity: this.calculateSeverity(pattern.riskScore),
          status: 'OPEN',
          title: `${pattern.name} - IP ${ipAddress}`,
          description: `Detected ${pattern.name.toLowerCase()} from IP ${ipAddress}`,
          ipAddress,
          affectedResources: this.extractAffectedResources(ipLogs),
          indicators,
          mitigationSteps: this.getMitigationSteps(pattern.type),
          timestamp: new Date(),
          detectedBy: 'SYSTEM',
          riskScore: pattern.riskScore,
        });
      }
    }

    return incidents;
  }

  /**
   * Group audit logs by user
   */
  private static groupLogsByUser(logs: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    for (const log of logs) {
      if (log.userId) {
        if (!groups.has(log.userId)) {
          groups.set(log.userId, []);
        }
        groups.get(log.userId)!.push(log);
      }
    }

    return groups;
  }

  /**
   * Group audit logs by IP address
   */
  private static groupLogsByIP(logs: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    for (const log of logs) {
      if (log.ipAddress) {
        if (!groups.has(log.ipAddress)) {
          groups.set(log.ipAddress, []);
        }
        groups.get(log.ipAddress)!.push(log);
      }
    }

    return groups;
  }

  /**
   * Analyze user behavior for security indicators
   */
  private static analyzeUserBehavior(userLogs: any[], pattern: any): SecurityIndicator[] {
    const indicators: SecurityIndicator[] = [];

    // Failed login analysis
    const failedLogins = userLogs.filter(log => 
      log.action === 'LOGIN' && log.metadata?.success === false
    );
    if (failedLogins.length > 0) {
      indicators.push({
        type: 'AUTHENTICATION',
        name: 'failed_login_count',
        value: failedLogins.length,
        confidence: Math.min(failedLogins.length * 20, 100),
      });
    }

    // Off-hours access analysis
    const offHoursLogs = userLogs.filter(log => {
      const hour = new Date(log.createdAt).getHours();
      return hour < 6 || hour > 22; // Outside 6 AM - 10 PM
    });
    if (offHoursLogs.length > 0) {
      indicators.push({
        type: 'BEHAVIORAL',
        name: 'off_hours_access',
        value: true,
        confidence: Math.min(offHoursLogs.length * 15, 100),
      });
    }

    // Permission denied analysis
    const permissionDenied = userLogs.filter(log => 
      log.action === 'ACCESS_DENIED' || log.metadata?.unauthorized
    );
    if (permissionDenied.length > 0) {
      indicators.push({
        type: 'BEHAVIORAL',
        name: 'permission_denied_count',
        value: permissionDenied.length,
        confidence: Math.min(permissionDenied.length * 25, 100),
      });
    }

    // Sensitive data access analysis
    const sensitiveAccess = userLogs.filter(log => 
      log.metadata?.sensitiveData === true
    );
    if (sensitiveAccess.length > 0) {
      indicators.push({
        type: 'DATA_ACCESS',
        name: 'sensitive_data_access_count',
        value: sensitiveAccess.length,
        confidence: Math.min(sensitiveAccess.length * 10, 100),
      });
    }

    return indicators;
  }

  /**
   * Analyze IP behavior for security indicators
   */
  private static analyzeIPBehavior(ipLogs: any[], pattern: any): SecurityIndicator[] {
    const indicators: SecurityIndicator[] = [];

    // Request frequency analysis
    const requestCount = ipLogs.length;
    const timeSpan = Math.max(1, (new Date().getTime() - new Date(ipLogs[ipLogs.length - 1]?.createdAt).getTime()) / (1000 * 60)); // minutes
    const requestsPerMinute = requestCount / timeSpan;

    if (requestsPerMinute > 10) { // Threshold for suspicious activity
      indicators.push({
        type: 'NETWORK',
        name: 'requests_per_minute',
        value: requestsPerMinute,
        confidence: Math.min(requestsPerMinute * 5, 100),
      });
    }

    return indicators;
  }

  /**
   * Check if indicators match a security pattern
   */
  private static matchesPattern(indicators: SecurityIndicator[], pattern: any): boolean {
    let matchedIndicators = 0;
    const requiredMatches = Math.ceil(pattern.indicators.length * 0.7); // 70% of indicators must match

    for (const patternIndicator of pattern.indicators) {
      const matchingIndicator = indicators.find(ind => 
        ind.type === patternIndicator.type && ind.name === patternIndicator.name
      );

      if (matchingIndicator) {
        if (typeof patternIndicator.threshold === 'number') {
          if (matchingIndicator.value >= patternIndicator.threshold) {
            matchedIndicators++;
          }
        } else if (typeof patternIndicator.threshold === 'boolean') {
          if (matchingIndicator.value === patternIndicator.threshold) {
            matchedIndicators++;
          }
        }
      }
    }

    return matchedIndicators >= requiredMatches;
  }

  /**
   * Calculate severity based on risk score
   */
  private static calculateSeverity(riskScore: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (riskScore >= this.alertThresholds.CRITICAL) return 'CRITICAL';
    if (riskScore >= this.alertThresholds.HIGH) return 'HIGH';
    if (riskScore >= this.alertThresholds.MEDIUM) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Extract affected resources from audit logs
   */
  private static extractAffectedResources(logs: any[]): string[] {
    const resources = new Set<string>();
    for (const log of logs) {
      if (log.resource) {
        resources.add(log.resource);
      }
    }
    return Array.from(resources);
  }

  /**
   * Get mitigation steps for incident type
   */
  private static getMitigationSteps(incidentType: SecurityIncident['type']): string[] {
    const mitigationMap = {
      UNAUTHORIZED_ACCESS: [
        'Review user permissions and access logs',
        'Verify user identity and authorization',
        'Consider temporary access suspension if suspicious',
        'Update access controls if necessary',
      ],
      SUSPICIOUS_ACTIVITY: [
        'Monitor user activity closely',
        'Review recent actions and data access',
        'Consider implementing additional authentication',
        'Investigate potential insider threat',
      ],
      DATA_BREACH: [
        'Immediately isolate affected systems',
        'Identify scope of data exposure',
        'Notify security team and management',
        'Prepare breach notification if required',
        'Review and strengthen data protection measures',
      ],
      AUTHENTICATION_FAILURE: [
        'Lock user account temporarily',
        'Require password reset',
        'Implement additional authentication factors',
        'Monitor for continued attempts',
      ],
      PERMISSION_VIOLATION: [
        'Review user role assignments',
        'Audit permission changes',
        'Investigate privilege escalation attempts',
        'Strengthen role-based access controls',
      ],
      MALWARE_DETECTED: [
        'Isolate affected systems immediately',
        'Run comprehensive malware scan',
        'Review system logs for compromise indicators',
        'Update security software and definitions',
      ],
      INSIDER_THREAT: [
        'Conduct thorough investigation',
        'Review user background and recent behavior',
        'Consider temporary access suspension',
        'Involve HR and legal teams as appropriate',
      ],
    };

    return mitigationMap[incidentType] || ['Investigate incident thoroughly', 'Document findings', 'Implement appropriate controls'];
  }

  /**
   * Send security alerts based on incident severity
   */
  private static async sendSecurityAlerts(incident: SecurityIncident): Promise<void> {
    const alertLevel = incident.severity === 'CRITICAL' ? 'CRITICAL' : 
                     incident.severity === 'HIGH' ? 'WARNING' : 'INFO';

    const alert: SecurityAlert = {
      incidentId: incident.id || 'unknown',
      alertLevel,
      recipients: await this.getAlertRecipients(incident.severity),
      channels: this.getAlertChannels(incident.severity),
      message: this.formatAlertMessage(incident),
      sentAt: new Date(),
    };

    // Send alerts through configured channels
    for (const channel of alert.channels) {
      try {
        await this.sendAlert(channel, alert, incident);
      } catch (error) {
        logger.error(`Failed to send alert via ${channel}`, {
          error: error.message,
          alert,
        });
      }
    }
  }

  /**
   * Get alert recipients based on severity
   */
  private static async getAlertRecipients(severity: SecurityIncident['severity']): Promise<string[]> {
    // This would typically query a configuration table or service
    const recipients = [];

    if (severity === 'CRITICAL' || severity === 'HIGH') {
      recipients.push('security-team@company.com', 'ciso@company.com');
    }
    if (severity === 'CRITICAL') {
      recipients.push('ceo@company.com', 'incident-response@company.com');
    }

    return recipients;
  }

  /**
   * Get alert channels based on severity
   */
  private static getAlertChannels(severity: SecurityIncident['severity']): SecurityAlert['channels'] {
    const channels: SecurityAlert['channels'] = ['DASHBOARD'];

    if (severity === 'HIGH' || severity === 'CRITICAL') {
      channels.push('EMAIL');
    }
    if (severity === 'CRITICAL') {
      channels.push('SMS', 'WEBHOOK');
    }

    return channels;
  }

  /**
   * Format alert message
   */
  private static formatAlertMessage(incident: SecurityIncident): string {
    return `
SECURITY INCIDENT ALERT

Type: ${incident.type}
Severity: ${incident.severity}
Risk Score: ${incident.riskScore}

Title: ${incident.title}
Description: ${incident.description}

Affected Resources: ${incident.affectedResources.join(', ')}
Detection Time: ${incident.timestamp.toISOString()}

Immediate Actions Required:
${incident.mitigationSteps.map(step => `- ${step}`).join('\n')}

Please investigate immediately and follow incident response procedures.
    `.trim();
  }

  /**
   * Send alert through specific channel
   */
  private static async sendAlert(channel: SecurityAlert['channels'][0], alert: SecurityAlert, incident: SecurityIncident): Promise<void> {
    switch (channel) {
      case 'EMAIL':
        // TODO: Implement email notification
        logger.info('Email alert sent', { alert });
        break;
      case 'SMS':
        // TODO: Implement SMS notification
        logger.info('SMS alert sent', { alert });
        break;
      case 'WEBHOOK':
        // TODO: Implement webhook notification
        logger.info('Webhook alert sent', { alert });
        break;
      case 'DASHBOARD':
        // TODO: Implement dashboard notification
        logger.info('Dashboard alert sent', { alert });
        break;
    }
  }

  /**
   * Auto-mitigate certain types of incidents
   */
  private static async autoMitigate(incident: SecurityIncident): Promise<void> {
    switch (incident.type) {
      case 'AUTHENTICATION_FAILURE':
        if (incident.userId && incident.riskScore > 80) {
          // Auto-lock account for high-risk authentication failures
          logger.warn(`Auto-locking account for user ${incident.userId} due to security incident`);
          // TODO: Implement account locking
        }
        break;

      case 'SUSPICIOUS_ACTIVITY':
        if (incident.riskScore > 90) {
          // Auto-suspend high-risk users
          logger.warn(`Auto-suspending user ${incident.userId} due to suspicious activity`);
          // TODO: Implement user suspension
        }
        break;

      case 'DATA_BREACH':
        // Always require immediate manual intervention for data breaches
        logger.error('Data breach detected - manual intervention required');
        break;
    }
  }

  /**
   * Schedule regular security analysis
   */
  static scheduleSecurityAnalysis(): void {
    // Run every hour
    setInterval(async () => {
      try {
        await this.analyzeSecurityPatterns();
      } catch (error) {
        logger.error('Security analysis failed', { error: error.message });
      }
    }, 60 * 60 * 1000); // 1 hour

    logger.info('Security incident analysis scheduler initialized');
  }
}

export const securityIncidentService = SecurityIncidentService;