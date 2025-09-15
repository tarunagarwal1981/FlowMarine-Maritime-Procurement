import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { auditService } from './auditService';
import { notificationService } from './notificationService';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: string;
  userId?: string;
  vesselId?: string;
  ip: string;
  userAgent?: string;
  timestamp: Date;
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export enum SecurityEventType {
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
  SUSPICIOUS_LOGIN = 'SUSPICIOUS_LOGIN',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  DATA_BREACH_ATTEMPT = 'DATA_BREACH_ATTEMPT',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  MALICIOUS_REQUEST = 'MALICIOUS_REQUEST',
  ACCOUNT_TAKEOVER = 'ACCOUNT_TAKEOVER',
  VESSEL_ACCESS_VIOLATION = 'VESSEL_ACCESS_VIOLATION',
  EMERGENCY_OVERRIDE_ABUSE = 'EMERGENCY_OVERRIDE_ABUSE',
  FINANCIAL_FRAUD_ATTEMPT = 'FINANCIAL_FRAUD_ATTEMPT'
}

export interface SecurityRule {
  id: string;
  name: string;
  eventType: SecurityEventType;
  conditions: SecurityCondition[];
  actions: SecurityAction[];
  enabled: boolean;
  threshold?: number;
  timeWindow?: number; // minutes
}

export interface SecurityCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'regex';
  value: any;
}

export interface SecurityAction {
  type: 'ALERT' | 'BLOCK_IP' | 'LOCK_ACCOUNT' | 'NOTIFY_ADMIN' | 'LOG_INCIDENT';
  parameters: Record<string, any>;
}

class SecurityMonitoringService extends EventEmitter {
  private events: Map<string, SecurityEvent> = new Map();
  private rules: Map<string, SecurityRule> = new Map();
  private ipBlacklist: Set<string> = new Set();
  private suspiciousIPs: Map<string, number> = new Map();

  constructor() {
    super();
    this.initializeDefaultRules();
    this.startCleanupJob();
  }

  private initializeDefaultRules(): void {
    // Brute force detection
    this.addRule({
      id: 'brute-force-detection',
      name: 'Brute Force Attack Detection',
      eventType: SecurityEventType.BRUTE_FORCE_ATTEMPT,
      conditions: [
        { field: 'failedAttempts', operator: 'greater_than', value: 5 }
      ],
      actions: [
        { type: 'BLOCK_IP', parameters: { duration: 3600 } },
        { type: 'ALERT', parameters: { severity: 'HIGH' } },
        { type: 'NOTIFY_ADMIN', parameters: {} }
      ],
      enabled: true,
      threshold: 5,
      timeWindow: 15
    });

    // Suspicious login detection
    this.addRule({
      id: 'suspicious-login',
      name: 'Suspicious Login Detection',
      eventType: SecurityEventType.SUSPICIOUS_LOGIN,
      conditions: [
        { field: 'location', operator: 'regex', value: '^(?!US|GB|NO|DK).*' }
      ],
      actions: [
        { type: 'ALERT', parameters: { severity: 'MEDIUM' } },
        { type: 'LOG_INCIDENT', parameters: {} }
      ],
      enabled: true
    });

    // Vessel access violation
    this.addRule({
      id: 'vessel-access-violation',
      name: 'Unauthorized Vessel Access',
      eventType: SecurityEventType.VESSEL_ACCESS_VIOLATION,
      conditions: [
        { field: 'accessDenied', operator: 'equals', value: true }
      ],
      actions: [
        { type: 'ALERT', parameters: { severity: 'HIGH' } },
        { type: 'NOTIFY_ADMIN', parameters: {} },
        { type: 'LOG_INCIDENT', parameters: {} }
      ],
      enabled: true
    });

    // Emergency override abuse
    this.addRule({
      id: 'emergency-override-abuse',
      name: 'Emergency Override Abuse Detection',
      eventType: SecurityEventType.EMERGENCY_OVERRIDE_ABUSE,
      conditions: [
        { field: 'overrideCount', operator: 'greater_than', value: 3 }
      ],
      actions: [
        { type: 'ALERT', parameters: { severity: 'CRITICAL' } },
        { type: 'NOTIFY_ADMIN', parameters: { immediate: true } },
        { type: 'LOG_INCIDENT', parameters: {} }
      ],
      enabled: true,
      threshold: 3,
      timeWindow: 60
    });
  }

  async recordSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
      resolved: false
    };

    this.events.set(securityEvent.id, securityEvent);

    // Log to audit trail
    await auditService.logSecurityEvent({
      eventId: securityEvent.id,
      type: securityEvent.type,
      severity: securityEvent.severity,
      userId: securityEvent.userId,
      vesselId: securityEvent.vesselId,
      ip: securityEvent.ip,
      details: securityEvent.details
    });

    // Process security rules
    await this.processSecurityRules(securityEvent);

    // Emit event for real-time monitoring
    this.emit('securityEvent', securityEvent);

    logger.warn('Security event recorded', {
      eventId: securityEvent.id,
      type: securityEvent.type,
      severity: securityEvent.severity,
      ip: securityEvent.ip
    });
  }

  private async processSecurityRules(event: SecurityEvent): Promise<void> {
    const applicableRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled && rule.eventType === event.type);

    for (const rule of applicableRules) {
      if (await this.evaluateRule(rule, event)) {
        await this.executeRuleActions(rule, event);
      }
    }
  }

  private async evaluateRule(rule: SecurityRule, event: SecurityEvent): Promise<boolean> {
    // Check threshold if specified
    if (rule.threshold && rule.timeWindow) {
      const recentEvents = this.getRecentEvents(event.type, rule.timeWindow);
      if (recentEvents.length < rule.threshold) {
        return false;
      }
    }

    // Evaluate conditions
    return rule.conditions.every(condition => this.evaluateCondition(condition, event));
  }

  private evaluateCondition(condition: SecurityCondition, event: SecurityEvent): boolean {
    const value = this.getEventFieldValue(event, condition.field);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'regex':
        return new RegExp(condition.value).test(String(value));
      default:
        return false;
    }
  }

  private getEventFieldValue(event: SecurityEvent, field: string): any {
    if (field.includes('.')) {
      const parts = field.split('.');
      let value: any = event;
      for (const part of parts) {
        value = value?.[part];
      }
      return value;
    }
    return (event as any)[field] || event.details[field];
  }

  private async executeRuleActions(rule: SecurityRule, event: SecurityEvent): Promise<void> {
    for (const action of rule.actions) {
      try {
        await this.executeAction(action, event);
      } catch (error) {
        logger.error('Failed to execute security action', {
          ruleId: rule.id,
          actionType: action.type,
          eventId: event.id,
          error: error.message
        });
      }
    }
  }

  private async executeAction(action: SecurityAction, event: SecurityEvent): Promise<void> {
    switch (action.type) {
      case 'ALERT':
        await this.sendSecurityAlert(event, action.parameters);
        break;
      case 'BLOCK_IP':
        this.blockIP(event.ip, action.parameters.duration || 3600);
        break;
      case 'LOCK_ACCOUNT':
        if (event.userId) {
          await this.lockUserAccount(event.userId, action.parameters.duration || 3600);
        }
        break;
      case 'NOTIFY_ADMIN':
        await this.notifyAdministrators(event, action.parameters);
        break;
      case 'LOG_INCIDENT':
        await this.logSecurityIncident(event);
        break;
    }
  }

  private async sendSecurityAlert(event: SecurityEvent, parameters: any): Promise<void> {
    const alert = {
      type: 'SECURITY_ALERT',
      severity: parameters.severity || event.severity,
      title: `Security Event: ${event.type}`,
      message: `Security event detected from IP ${event.ip}`,
      eventId: event.id,
      timestamp: event.timestamp
    };

    await notificationService.sendSecurityAlert(alert);
  }

  private blockIP(ip: string, duration: number): void {
    this.ipBlacklist.add(ip);
    
    // Remove from blacklist after duration
    setTimeout(() => {
      this.ipBlacklist.delete(ip);
      logger.info('IP unblocked', { ip });
    }, duration * 1000);

    logger.warn('IP blocked', { ip, duration });
  }

  private async lockUserAccount(userId: string, duration: number): Promise<void> {
    // Implementation would integrate with user service
    logger.warn('User account locked', { userId, duration });
  }

  private async notifyAdministrators(event: SecurityEvent, parameters: any): Promise<void> {
    const notification = {
      type: 'SECURITY_INCIDENT',
      priority: parameters.immediate ? 'IMMEDIATE' : 'HIGH',
      title: `Security Incident: ${event.type}`,
      message: `Critical security event requires immediate attention`,
      eventId: event.id,
      details: event.details
    };

    await notificationService.notifyAdministrators(notification);
  }

  private async logSecurityIncident(event: SecurityEvent): Promise<void> {
    await auditService.logSecurityIncident({
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      description: `Security incident: ${event.type}`,
      affectedResources: {
        userId: event.userId,
        vesselId: event.vesselId,
        ip: event.ip
      },
      mitigationActions: [],
      status: 'OPEN'
    });
  }

  isIPBlocked(ip: string): boolean {
    return this.ipBlacklist.has(ip);
  }

  addRule(rule: SecurityRule): void {
    this.rules.set(rule.id, rule);
    logger.info('Security rule added', { ruleId: rule.id, name: rule.name });
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    logger.info('Security rule removed', { ruleId });
  }

  getRecentEvents(type: SecurityEventType, timeWindowMinutes: number): SecurityEvent[] {
    const cutoff = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    return Array.from(this.events.values())
      .filter(event => event.type === type && event.timestamp > cutoff);
  }

  async resolveSecurityEvent(eventId: string, resolvedBy: string): Promise<void> {
    const event = this.events.get(eventId);
    if (event) {
      event.resolved = true;
      event.resolvedAt = new Date();
      event.resolvedBy = resolvedBy;

      await auditService.logSecurityEventResolution({
        eventId,
        resolvedBy,
        resolvedAt: event.resolvedAt
      });

      logger.info('Security event resolved', { eventId, resolvedBy });
    }
  }

  getSecurityMetrics(): any {
    const events = Array.from(this.events.values());
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return {
      totalEvents: events.length,
      eventsLast24Hours: events.filter(e => e.timestamp > last24Hours).length,
      eventsBySeverity: {
        critical: events.filter(e => e.severity === 'CRITICAL').length,
        high: events.filter(e => e.severity === 'HIGH').length,
        medium: events.filter(e => e.severity === 'MEDIUM').length,
        low: events.filter(e => e.severity === 'LOW').length
      },
      eventsByType: Object.values(SecurityEventType).reduce((acc, type) => {
        acc[type] = events.filter(e => e.type === type).length;
        return acc;
      }, {} as Record<string, number>),
      blockedIPs: this.ipBlacklist.size,
      unresolvedEvents: events.filter(e => !e.resolved).length
    };
  }

  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startCleanupJob(): void {
    // Clean up old events every hour
    setInterval(() => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
      for (const [id, event] of this.events.entries()) {
        if (event.timestamp < cutoff && event.resolved) {
          this.events.delete(id);
        }
      }
    }, 60 * 60 * 1000);
  }
}

export const securityMonitoringService = new SecurityMonitoringService();