import { Request } from 'express';
import { logger } from '../utils/logger';
import { securityMonitoringService, SecurityEvent, SecurityEventType } from './securityMonitoringService';
import { AuditService } from './auditService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ThreatIndicator {
  id: string;
  type: 'IP_REPUTATION' | 'BEHAVIORAL_ANOMALY' | 'SIGNATURE_MATCH' | 'ML_DETECTION' | 'GEOLOCATION_ANOMALY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number; // 0-100
  source: string;
  description: string;
  indicators: Record<string, any>;
  timestamp: Date;
  expiresAt?: Date;
}

export interface ThreatDetectionRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  ruleType: 'BEHAVIORAL' | 'SIGNATURE' | 'ANOMALY' | 'ML_MODEL' | 'REPUTATION';
  conditions: ThreatCondition[];
  actions: ThreatAction[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
}

export interface ThreatCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'regex' | 'in_range' | 'anomaly_score';
  value: any;
  weight: number; // 0-1
}

export interface ThreatAction {
  type: 'BLOCK_IP' | 'QUARANTINE_USER' | 'ALERT_SECURITY' | 'LOG_INCIDENT' | 'RATE_LIMIT' | 'REQUIRE_MFA';
  parameters: Record<string, any>;
  immediate: boolean;
}

export interface BehavioralProfile {
  userId: string;
  normalPatterns: {
    loginTimes: number[]; // Hours of day
    ipAddresses: string[];
    userAgents: string[];
    accessPatterns: Record<string, number>;
    requestFrequency: number;
    dataAccessVolume: number;
  };
  anomalyThresholds: {
    timeDeviation: number;
    locationDeviation: number;
    accessVolumeDeviation: number;
    frequencyDeviation: number;
  };
  lastUpdated: Date;
}

class AdvancedThreatDetectionService {
  private threatIndicators: Map<string, ThreatIndicator> = new Map();
  private detectionRules: Map<string, ThreatDetectionRule> = new Map();
  private behavioralProfiles: Map<string, BehavioralProfile> = new Map();
  private ipReputationCache: Map<string, { reputation: number; lastChecked: Date }> = new Map();
  private mlModels: Map<string, any> = new Map();

  constructor() {
    this.initializeDefaultRules();
    this.startThreatIntelligenceSync();
    this.startBehavioralAnalysis();
  }

  /**
   * Initialize default threat detection rules
   */
  private initializeDefaultRules(): void {
    // Brute force detection
    this.addDetectionRule({
      id: 'brute-force-advanced',
      name: 'Advanced Brute Force Detection',
      description: 'Detects sophisticated brute force attacks with distributed sources',
      enabled: true,
      ruleType: 'BEHAVIORAL',
      conditions: [
        { field: 'failed_login_count', operator: 'greater_than', value: 3, weight: 0.4 },
        { field: 'unique_ips', operator: 'greater_than', value: 2, weight: 0.3 },
        { field: 'time_window_minutes', operator: 'less_than', value: 30, weight: 0.3 }
      ],
      actions: [
        { type: 'BLOCK_IP', parameters: { duration: 7200 }, immediate: true },
        { type: 'QUARANTINE_USER', parameters: { duration: 3600 }, immediate: true },
        { type: 'ALERT_SECURITY', parameters: { priority: 'HIGH' }, immediate: true }
      ],
      severity: 'HIGH',
      confidence: 85
    });

    // Insider threat detection
    this.addDetectionRule({
      id: 'insider-threat-detection',
      name: 'Insider Threat Behavioral Analysis',
      description: 'Detects potential insider threats based on behavioral anomalies',
      enabled: true,
      ruleType: 'ANOMALY',
      conditions: [
        { field: 'off_hours_access', operator: 'anomaly_score', value: 0.8, weight: 0.3 },
        { field: 'data_access_volume', operator: 'anomaly_score', value: 0.7, weight: 0.4 },
        { field: 'privilege_escalation_attempts', operator: 'greater_than', value: 1, weight: 0.3 }
      ],
      actions: [
        { type: 'ALERT_SECURITY', parameters: { priority: 'CRITICAL' }, immediate: true },
        { type: 'LOG_INCIDENT', parameters: { type: 'INSIDER_THREAT' }, immediate: true },
        { type: 'REQUIRE_MFA', parameters: { duration: 86400 }, immediate: false }
      ],
      severity: 'CRITICAL',
      confidence: 75
    });

    // Malware/suspicious file detection
    this.addDetectionRule({
      id: 'malware-detection',
      name: 'Malware and Suspicious File Detection',
      description: 'Detects potential malware uploads and suspicious file activities',
      enabled: true,
      ruleType: 'SIGNATURE',
      conditions: [
        { field: 'file_hash', operator: 'in_range', value: 'malware_signatures', weight: 0.6 },
        { field: 'file_behavior', operator: 'contains', value: 'suspicious', weight: 0.4 }
      ],
      actions: [
        { type: 'QUARANTINE_USER', parameters: { duration: 1800 }, immediate: true },
        { type: 'ALERT_SECURITY', parameters: { priority: 'CRITICAL' }, immediate: true },
        { type: 'LOG_INCIDENT', parameters: { type: 'MALWARE_DETECTED' }, immediate: true }
      ],
      severity: 'CRITICAL',
      confidence: 90
    });

    // Geolocation anomaly detection
    this.addDetectionRule({
      id: 'geolocation-anomaly',
      name: 'Geolocation Anomaly Detection',
      description: 'Detects logins from unusual geographic locations',
      enabled: true,
      ruleType: 'ANOMALY',
      conditions: [
        { field: 'location_distance_km', operator: 'greater_than', value: 1000, weight: 0.5 },
        { field: 'travel_time_feasible', operator: 'equals', value: false, weight: 0.5 }
      ],
      actions: [
        { type: 'REQUIRE_MFA', parameters: { duration: 3600 }, immediate: true },
        { type: 'ALERT_SECURITY', parameters: { priority: 'MEDIUM' }, immediate: false },
        { type: 'LOG_INCIDENT', parameters: { type: 'SUSPICIOUS_ACTIVITY' }, immediate: true }
      ],
      severity: 'MEDIUM',
      confidence: 70
    });

    logger.info('Advanced threat detection rules initialized', {
      rulesCount: this.detectionRules.size
    });
  }

  /**
   * Analyze request for threats
   */
  async analyzeRequest(req: Request, context: {
    userId?: string;
    action: string;
    resource: string;
    metadata?: Record<string, any>;
  }): Promise<ThreatIndicator[]> {
    const threats: ThreatIndicator[] = [];
    const requestData = this.extractRequestData(req, context);

    // Run all enabled detection rules
    for (const rule of this.detectionRules.values()) {
      if (!rule.enabled) continue;

      try {
        const threat = await this.evaluateRule(rule, requestData);
        if (threat) {
          threats.push(threat);
          await this.executeThreatActions(rule, threat, requestData);
        }
      } catch (error) {
        logger.error('Error evaluating threat detection rule', {
          ruleId: rule.id,
          error: error.message
        });
      }
    }

    // Store detected threats
    for (const threat of threats) {
      this.threatIndicators.set(threat.id, threat);
    }

    // Log threat analysis
    if (threats.length > 0) {
      await AuditService.logSecurityEvent({
        userId: context.userId,
        action: 'THREAT_DETECTED',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          threatsDetected: threats.length,
          threats: threats.map(t => ({ type: t.type, severity: t.severity, confidence: t.confidence })),
          action: context.action,
          resource: context.resource
        }
      });
    }

    return threats;
  }

  /**
   * Extract relevant data from request for analysis
   */
  private extractRequestData(req: Request, context: any): Record<string, any> {
    const now = new Date();
    const hour = now.getHours();
    
    return {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: context.userId,
      action: context.action,
      resource: context.resource,
      timestamp: now,
      hour,
      isOffHours: hour < 6 || hour > 22,
      headers: req.headers,
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      metadata: context.metadata || {}
    };
  }

  /**
   * Evaluate a threat detection rule against request data
   */
  private async evaluateRule(rule: ThreatDetectionRule, data: Record<string, any>): Promise<ThreatIndicator | null> {
    let totalScore = 0;
    let maxWeight = 0;
    const matchedConditions: any[] = [];

    for (const condition of rule.conditions) {
      const conditionMet = await this.evaluateCondition(condition, data);
      maxWeight += condition.weight;
      
      if (conditionMet) {
        totalScore += condition.weight;
        matchedConditions.push(condition);
      }
    }

    const confidence = maxWeight > 0 ? (totalScore / maxWeight) * rule.confidence : 0;

    // Require minimum confidence threshold
    if (confidence < 50) {
      return null;
    }

    return {
      id: this.generateThreatId(),
      type: this.mapRuleTypeToIndicatorType(rule.ruleType),
      severity: rule.severity,
      confidence: Math.round(confidence),
      source: `rule:${rule.id}`,
      description: `${rule.name}: ${rule.description}`,
      indicators: {
        ruleId: rule.id,
        ruleName: rule.name,
        matchedConditions,
        score: totalScore,
        maxScore: maxWeight,
        requestData: {
          ip: data.ip,
          userId: data.userId,
          action: data.action,
          resource: data.resource
        }
      },
      timestamp: new Date()
    };
  }

  /**
   * Evaluate individual condition
   */
  private async evaluateCondition(condition: ThreatCondition, data: Record<string, any>): Promise<boolean> {
    const fieldValue = this.getFieldValue(data, condition.field);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'regex':
        return new RegExp(condition.value).test(String(fieldValue));
      case 'in_range':
        return this.checkInRange(fieldValue, condition.value);
      case 'anomaly_score':
        return await this.calculateAnomalyScore(condition.field, fieldValue, data) > condition.value;
      default:
        return false;
    }
  }

  /**
   * Get field value from data with support for nested fields
   */
  private getFieldValue(data: Record<string, any>, field: string): any {
    if (field.includes('.')) {
      const parts = field.split('.');
      let value = data;
      for (const part of parts) {
        value = value?.[part];
      }
      return value;
    }

    // Handle special computed fields
    switch (field) {
      case 'failed_login_count':
        return this.getFailedLoginCount(data.userId, data.ip);
      case 'unique_ips':
        return this.getUniqueIPCount(data.userId);
      case 'time_window_minutes':
        return this.getTimeWindowMinutes(data.userId);
      case 'off_hours_access':
        return data.isOffHours;
      case 'data_access_volume':
        return this.getDataAccessVolume(data.userId);
      case 'privilege_escalation_attempts':
        return this.getPrivilegeEscalationAttempts(data.userId);
      case 'location_distance_km':
        return this.getLocationDistance(data.userId, data.ip);
      case 'travel_time_feasible':
        return this.isTravelTimeFeasible(data.userId, data.ip);
      default:
        return data[field];
    }
  }

  /**
   * Check if value is in specified range/list
   */
  private checkInRange(value: any, range: any): boolean {
    if (Array.isArray(range)) {
      return range.includes(value);
    }
    if (typeof range === 'object' && range.min !== undefined && range.max !== undefined) {
      return Number(value) >= range.min && Number(value) <= range.max;
    }
    return false;
  }

  /**
   * Calculate anomaly score for behavioral analysis
   */
  private async calculateAnomalyScore(field: string, value: any, data: Record<string, any>): Promise<number> {
    if (!data.userId) return 0;

    const profile = this.behavioralProfiles.get(data.userId);
    if (!profile) {
      // No baseline yet, consider it normal
      return 0;
    }

    switch (field) {
      case 'off_hours_access':
        return this.calculateTimeAnomalyScore(data.hour, profile.normalPatterns.loginTimes);
      case 'data_access_volume':
        return this.calculateVolumeAnomalyScore(value, profile.normalPatterns.dataAccessVolume);
      case 'request_frequency':
        return this.calculateFrequencyAnomalyScore(value, profile.normalPatterns.requestFrequency);
      default:
        return 0;
    }
  }

  /**
   * Calculate time-based anomaly score
   */
  private calculateTimeAnomalyScore(currentHour: number, normalHours: number[]): number {
    if (normalHours.length === 0) return 0;

    const hourCounts = new Array(24).fill(0);
    normalHours.forEach(hour => hourCounts[hour]++);
    
    const totalLogins = normalHours.length;
    const currentHourProbability = hourCounts[currentHour] / totalLogins;
    
    // Return anomaly score (1 - probability)
    return Math.max(0, 1 - currentHourProbability * 4); // Scale for sensitivity
  }

  /**
   * Calculate volume-based anomaly score
   */
  private calculateVolumeAnomalyScore(currentVolume: number, normalVolume: number): number {
    if (normalVolume === 0) return 0;
    
    const ratio = currentVolume / normalVolume;
    
    // Anomaly if volume is significantly higher than normal
    if (ratio > 3) return 1;
    if (ratio > 2) return 0.7;
    if (ratio > 1.5) return 0.4;
    
    return 0;
  }

  /**
   * Calculate frequency-based anomaly score
   */
  private calculateFrequencyAnomalyScore(currentFreq: number, normalFreq: number): number {
    if (normalFreq === 0) return 0;
    
    const ratio = currentFreq / normalFreq;
    
    // Anomaly if frequency is significantly higher than normal
    if (ratio > 5) return 1;
    if (ratio > 3) return 0.8;
    if (ratio > 2) return 0.5;
    
    return 0;
  }

  /**
   * Execute threat response actions
   */
  private async executeThreatActions(rule: ThreatDetectionRule, threat: ThreatIndicator, data: Record<string, any>): Promise<void> {
    for (const action of rule.actions) {
      try {
        if (action.immediate) {
          await this.executeAction(action, threat, data);
        } else {
          // Queue for delayed execution
          setTimeout(() => this.executeAction(action, threat, data), 5000);
        }
      } catch (error) {
        logger.error('Failed to execute threat action', {
          actionType: action.type,
          threatId: threat.id,
          error: error.message
        });
      }
    }
  }

  /**
   * Execute individual threat response action
   */
  private async executeAction(action: ThreatAction, threat: ThreatIndicator, data: Record<string, any>): Promise<void> {
    switch (action.type) {
      case 'BLOCK_IP':
        await this.blockIP(data.ip, action.parameters.duration || 3600);
        break;
      case 'QUARANTINE_USER':
        if (data.userId) {
          await this.quarantineUser(data.userId, action.parameters.duration || 1800);
        }
        break;
      case 'ALERT_SECURITY':
        await this.alertSecurity(threat, action.parameters);
        break;
      case 'LOG_INCIDENT':
        await this.logSecurityIncident(threat, action.parameters);
        break;
      case 'RATE_LIMIT':
        await this.applyRateLimit(data.ip, action.parameters);
        break;
      case 'REQUIRE_MFA':
        if (data.userId) {
          await this.requireMFA(data.userId, action.parameters.duration || 3600);
        }
        break;
    }
  }

  /**
   * Block IP address
   */
  private async blockIP(ip: string, duration: number): Promise<void> {
    // Add to security monitoring service
    await securityMonitoringService.recordSecurityEvent({
      type: SecurityEventType.MALICIOUS_REQUEST,
      severity: 'HIGH',
      source: 'threat_detection',
      ip,
      details: { action: 'IP_BLOCKED', duration }
    });

    logger.warn('IP blocked by threat detection', { ip, duration });
  }

  /**
   * Quarantine user account
   */
  private async quarantineUser(userId: string, duration: number): Promise<void> {
    // Implementation would integrate with user management service
    logger.warn('User quarantined by threat detection', { userId, duration });
  }

  /**
   * Alert security team
   */
  private async alertSecurity(threat: ThreatIndicator, parameters: any): Promise<void> {
    await securityMonitoringService.recordSecurityEvent({
      type: SecurityEventType.SUSPICIOUS_LOGIN,
      severity: threat.severity,
      source: 'threat_detection',
      details: {
        threatId: threat.id,
        threatType: threat.type,
        confidence: threat.confidence,
        priority: parameters.priority
      }
    });
  }

  /**
   * Log security incident
   */
  private async logSecurityIncident(threat: ThreatIndicator, parameters: any): Promise<void> {
    await AuditService.logSecurityEvent({
      action: 'SECURITY_INCIDENT_LOGGED',
      metadata: {
        threatId: threat.id,
        threatType: threat.type,
        severity: threat.severity,
        confidence: threat.confidence,
        incidentType: parameters.type
      }
    });
  }

  /**
   * Apply rate limiting
   */
  private async applyRateLimit(ip: string, parameters: any): Promise<void> {
    // Implementation would integrate with rate limiting service
    logger.info('Rate limit applied by threat detection', { ip, parameters });
  }

  /**
   * Require multi-factor authentication
   */
  private async requireMFA(userId: string, duration: number): Promise<void> {
    // Implementation would integrate with authentication service
    logger.info('MFA required by threat detection', { userId, duration });
  }

  /**
   * Add new detection rule
   */
  addDetectionRule(rule: ThreatDetectionRule): void {
    this.detectionRules.set(rule.id, rule);
    logger.info('Threat detection rule added', { ruleId: rule.id, name: rule.name });
  }

  /**
   * Update behavioral profile for user
   */
  async updateBehavioralProfile(userId: string, activity: {
    loginTime?: number;
    ipAddress?: string;
    userAgent?: string;
    accessPattern?: string;
    requestCount?: number;
    dataVolume?: number;
  }): Promise<void> {
    let profile = this.behavioralProfiles.get(userId);
    
    if (!profile) {
      profile = {
        userId,
        normalPatterns: {
          loginTimes: [],
          ipAddresses: [],
          userAgents: [],
          accessPatterns: {},
          requestFrequency: 0,
          dataAccessVolume: 0
        },
        anomalyThresholds: {
          timeDeviation: 0.3,
          locationDeviation: 0.5,
          accessVolumeDeviation: 0.4,
          frequencyDeviation: 0.6
        },
        lastUpdated: new Date()
      };
    }

    // Update patterns
    if (activity.loginTime !== undefined) {
      profile.normalPatterns.loginTimes.push(activity.loginTime);
      // Keep only last 100 login times
      if (profile.normalPatterns.loginTimes.length > 100) {
        profile.normalPatterns.loginTimes = profile.normalPatterns.loginTimes.slice(-100);
      }
    }

    if (activity.ipAddress && !profile.normalPatterns.ipAddresses.includes(activity.ipAddress)) {
      profile.normalPatterns.ipAddresses.push(activity.ipAddress);
      // Keep only last 20 IP addresses
      if (profile.normalPatterns.ipAddresses.length > 20) {
        profile.normalPatterns.ipAddresses = profile.normalPatterns.ipAddresses.slice(-20);
      }
    }

    if (activity.accessPattern) {
      profile.normalPatterns.accessPatterns[activity.accessPattern] = 
        (profile.normalPatterns.accessPatterns[activity.accessPattern] || 0) + 1;
    }

    if (activity.requestCount !== undefined) {
      profile.normalPatterns.requestFrequency = 
        (profile.normalPatterns.requestFrequency + activity.requestCount) / 2;
    }

    if (activity.dataVolume !== undefined) {
      profile.normalPatterns.dataAccessVolume = 
        (profile.normalPatterns.dataAccessVolume + activity.dataVolume) / 2;
    }

    profile.lastUpdated = new Date();
    this.behavioralProfiles.set(userId, profile);
  }

  /**
   * Get threat indicators for analysis
   */
  getThreatIndicators(filters?: {
    severity?: string;
    type?: string;
    timeRange?: { start: Date; end: Date };
  }): ThreatIndicator[] {
    let indicators = Array.from(this.threatIndicators.values());

    if (filters) {
      if (filters.severity) {
        indicators = indicators.filter(i => i.severity === filters.severity);
      }
      if (filters.type) {
        indicators = indicators.filter(i => i.type === filters.type);
      }
      if (filters.timeRange) {
        indicators = indicators.filter(i => 
          i.timestamp >= filters.timeRange!.start && 
          i.timestamp <= filters.timeRange!.end
        );
      }
    }

    return indicators.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Start threat intelligence synchronization
   */
  private startThreatIntelligenceSync(): void {
    // Sync threat intelligence feeds every hour
    setInterval(async () => {
      try {
        await this.syncThreatIntelligence();
      } catch (error) {
        logger.error('Threat intelligence sync failed', { error: error.message });
      }
    }, 60 * 60 * 1000);

    logger.info('Threat intelligence synchronization started');
  }

  /**
   * Sync with external threat intelligence feeds
   */
  private async syncThreatIntelligence(): Promise<void> {
    // Implementation would integrate with threat intelligence APIs
    logger.info('Syncing threat intelligence feeds');
  }

  /**
   * Start behavioral analysis background process
   */
  private startBehavioralAnalysis(): void {
    // Analyze behavioral patterns every 30 minutes
    setInterval(async () => {
      try {
        await this.analyzeBehavioralPatterns();
      } catch (error) {
        logger.error('Behavioral analysis failed', { error: error.message });
      }
    }, 30 * 60 * 1000);

    logger.info('Behavioral analysis started');
  }

  /**
   * Analyze behavioral patterns for all users
   */
  private async analyzeBehavioralPatterns(): Promise<void> {
    const recentLogs = await prisma.auditLog.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      include: { user: true }
    });

    // Group by user and analyze patterns
    const userActivities = new Map<string, any[]>();
    
    for (const log of recentLogs) {
      if (log.userId) {
        if (!userActivities.has(log.userId)) {
          userActivities.set(log.userId, []);
        }
        userActivities.get(log.userId)!.push(log);
      }
    }

    // Update behavioral profiles
    for (const [userId, activities] of userActivities) {
      await this.updateUserBehavioralProfile(userId, activities);
    }

    logger.info('Behavioral pattern analysis completed', {
      usersAnalyzed: userActivities.size
    });
  }

  /**
   * Update user behavioral profile based on recent activities
   */
  private async updateUserBehavioralProfile(userId: string, activities: any[]): Promise<void> {
    for (const activity of activities) {
      await this.updateBehavioralProfile(userId, {
        loginTime: new Date(activity.createdAt).getHours(),
        ipAddress: activity.ipAddress,
        userAgent: activity.userAgent,
        accessPattern: `${activity.action}:${activity.resource}`,
        requestCount: 1,
        dataVolume: activity.metadata?.dataSize || 0
      });
    }
  }

  // Helper methods for condition evaluation
  private async getFailedLoginCount(userId?: string, ip?: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const where: any = {
      action: 'LOGIN',
      metadata: { path: ['success'], equals: false },
      createdAt: { gte: oneHourAgo }
    };

    if (userId) where.userId = userId;
    if (ip) where.ipAddress = ip;

    return await prisma.auditLog.count({ where });
  }

  private async getUniqueIPCount(userId?: string): Promise<number> {
    if (!userId) return 0;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const logs = await prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: { gte: oneHourAgo }
      },
      select: { ipAddress: true },
      distinct: ['ipAddress']
    });

    return logs.length;
  }

  private async getTimeWindowMinutes(userId?: string): Promise<number> {
    if (!userId) return 0;

    const recentLogs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 2
    });

    if (recentLogs.length < 2) return 0;

    const timeDiff = recentLogs[0].createdAt.getTime() - recentLogs[1].createdAt.getTime();
    return Math.round(timeDiff / (1000 * 60));
  }

  private async getDataAccessVolume(userId?: string): Promise<number> {
    if (!userId) return 0;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const logs = await prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: { gte: oneDayAgo },
        metadata: { path: ['sensitiveData'], equals: true }
      }
    });

    return logs.length;
  }

  private async getPrivilegeEscalationAttempts(userId?: string): Promise<number> {
    if (!userId) return 0;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    return await prisma.auditLog.count({
      where: {
        userId,
        action: 'ACCESS_DENIED',
        createdAt: { gte: oneHourAgo }
      }
    });
  }

  private async getLocationDistance(userId?: string, ip?: string): Promise<number> {
    // Implementation would use IP geolocation service
    // For now, return mock distance
    return 0;
  }

  private async isTravelTimeFeasible(userId?: string, ip?: string): Promise<boolean> {
    // Implementation would calculate if travel time between locations is feasible
    // For now, return true
    return true;
  }

  private mapRuleTypeToIndicatorType(ruleType: ThreatDetectionRule['ruleType']): ThreatIndicator['type'] {
    const mapping = {
      'BEHAVIORAL': 'BEHAVIORAL_ANOMALY' as const,
      'SIGNATURE': 'SIGNATURE_MATCH' as const,
      'ANOMALY': 'BEHAVIORAL_ANOMALY' as const,
      'ML_MODEL': 'ML_DETECTION' as const,
      'REPUTATION': 'IP_REPUTATION' as const
    };
    return mapping[ruleType] || 'BEHAVIORAL_ANOMALY';
  }

  private generateThreatId(): string {
    return `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const advancedThreatDetectionService = new AdvancedThreatDetectionService(); } 