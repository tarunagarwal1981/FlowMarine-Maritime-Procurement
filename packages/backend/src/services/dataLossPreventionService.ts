import { logger } from '../utils/logger';
import { AuditService } from './auditService';
import { securityMonitoringService, SecurityEventType } from './securityMonitoringService';
import { fieldEncryptionService } from './fieldEncryptionService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DLPPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dataTypes: DataType[];
  conditions: DLPCondition[];
  actions: DLPAction[];
  scope: {
    users?: string[];
    roles?: string[];
    resources?: string[];
    vessels?: string[];
  };
  exceptions: DLPException[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DataType {
  type: 'PII' | 'FINANCIAL' | 'MARITIME' | 'TECHNICAL' | 'CONFIDENTIAL';
  patterns: DataPattern[];
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  regulations: string[]; // GDPR, SOX, SOLAS, etc.
}

export interface DataPattern {
  name: string;
  regex: string;
  confidence: number; // 0-100
  context?: string[]; // Additional context keywords
}

export interface DLPCondition {
  field: string;
  operator: 'contains' | 'matches' | 'count_greater_than' | 'size_greater_than' | 'frequency_exceeds';
  value: any;
  weight: number;
}

export interface DLPAction {
  type: 'BLOCK' | 'QUARANTINE' | 'ENCRYPT' | 'REDACT' | 'ALERT' | 'LOG' | 'REQUIRE_APPROVAL';
  parameters: Record<string, any>;
  immediate: boolean;
}

export interface DLPException {
  id: string;
  reason: string;
  approvedBy: string;
  expiresAt?: Date;
  conditions: Record<string, any>;
}

export interface DLPViolation {
  id: string;
  policyId: string;
  policyName: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dataType: string;
  violationType: 'UNAUTHORIZED_ACCESS' | 'DATA_EXFILTRATION' | 'POLICY_VIOLATION' | 'SUSPICIOUS_ACTIVITY';
  userId?: string;
  resourceId?: string;
  resourceType: string;
  detectedData: DetectedSensitiveData[];
  context: {
    action: string;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  };
  status: 'DETECTED' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  mitigationActions: string[];
  assignedTo?: string;
}

export interface DetectedSensitiveData {
  type: string;
  pattern: string;
  matches: DataMatch[];
  confidence: number;
  context: string;
}

export interface DataMatch {
  value: string;
  position: number;
  length: number;
  redacted: string;
}

export interface DataClassificationResult {
  dataTypes: string[];
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  patterns: DetectedSensitiveData[];
  recommendations: string[];
}

class DataLossPreventionService {
  private policies: Map<string, DLPPolicy> = new Map();
  private violations: Map<string, DLPViolation> = new Map();
  private dataPatterns: Map<string, DataPattern[]> = new Map();

  constructor() {
    this.initializeDefaultPolicies();
    this.initializeDataPatterns();
    this.startViolationMonitoring();
  }

  /**
   * Initialize default DLP policies
   */
  private initializeDefaultPolicies(): void {
    // PII Protection Policy
    this.addPolicy({
      id: 'pii-protection',
      name: 'Personal Information Protection',
      description: 'Prevents unauthorized access and transmission of personal information',
      enabled: true,
      priority: 'HIGH',
      dataTypes: [{
        type: 'PII',
        patterns: [
          { name: 'SSN', regex: '\\b\\d{3}-\\d{2}-\\d{4}\\b', confidence: 95 },
          { name: 'Email', regex: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b', confidence: 90 },
          { name: 'Phone', regex: '\\b\\d{3}-\\d{3}-\\d{4}\\b', confidence: 85 }
        ],
        sensitivity: 'HIGH',
        regulations: ['GDPR', 'CCPA']
      }],
      conditions: [
        { field: 'data_content', operator: 'contains', value: 'PII', weight: 0.8 },
        { field: 'export_action', operator: 'matches', value: true, weight: 0.2 }
      ],
      actions: [
        { type: 'BLOCK', parameters: { message: 'PII export blocked' }, immediate: true },
        { type: 'ALERT', parameters: { severity: 'HIGH' }, immediate: true },
        { type: 'LOG', parameters: { category: 'DLP_VIOLATION' }, immediate: true }
      ],
      scope: {},
      exceptions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Financial Data Protection Policy
    this.addPolicy({
      id: 'financial-protection',
      name: 'Financial Data Protection',
      description: 'Protects financial information and banking details',
      enabled: true,
      priority: 'CRITICAL',
      dataTypes: [{
        type: 'FINANCIAL',
        patterns: [
          { name: 'Credit Card', regex: '\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b', confidence: 90 },
          { name: 'Bank Account', regex: '\\b\\d{8,17}\\b', confidence: 75, context: ['account', 'bank', 'routing'] },
          { name: 'IBAN', regex: '\\b[A-Z]{2}\\d{2}[A-Z0-9]{4}\\d{7}([A-Z0-9]?){0,16}\\b', confidence: 95 }
        ],
        sensitivity: 'CRITICAL',
        regulations: ['SOX', 'PCI-DSS']
      }],
      conditions: [
        { field: 'data_content', operator: 'contains', value: 'FINANCIAL', weight: 0.9 },
        { field: 'user_role', operator: 'matches', value: 'unauthorized', weight: 0.1 }
      ],
      actions: [
        { type: 'BLOCK', parameters: { message: 'Financial data access blocked' }, immediate: true },
        { type: 'QUARANTINE', parameters: { duration: 3600 }, immediate: true },
        { type: 'ALERT', parameters: { severity: 'CRITICAL' }, immediate: true }
      ],
      scope: {},
      exceptions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Maritime Technical Data Policy
    this.addPolicy({
      id: 'maritime-technical-protection',
      name: 'Maritime Technical Data Protection',
      description: 'Protects sensitive maritime and vessel technical information',
      enabled: true,
      priority: 'HIGH',
      dataTypes: [{
        type: 'MARITIME',
        patterns: [
          { name: 'IMO Number', regex: '\\bIMO\\s?\\d{7}\\b', confidence: 95 },
          { name: 'Vessel Coordinates', regex: '\\b\\d{1,3}\\.\\d+[NS]\\s+\\d{1,3}\\.\\d+[EW]\\b', confidence: 90 },
          { name: 'Port Code', regex: '\\b[A-Z]{5}\\b', confidence: 70, context: ['port', 'harbor', 'terminal'] }
        ],
        sensitivity: 'HIGH',
        regulations: ['SOLAS', 'ISPS', 'MARPOL']
      }],
      conditions: [
        { field: 'data_content', operator: 'contains', value: 'MARITIME', weight: 0.7 },
        { field: 'export_volume', operator: 'size_greater_than', value: 1000000, weight: 0.3 }
      ],
      actions: [
        { type: 'REQUIRE_APPROVAL', parameters: { approvers: ['maritime_security'] }, immediate: false },
        { type: 'ENCRYPT', parameters: { algorithm: 'AES-256' }, immediate: true },
        { type: 'LOG', parameters: { category: 'MARITIME_DATA_ACCESS' }, immediate: true }
      ],
      scope: {},
      exceptions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Bulk Data Export Policy
    this.addPolicy({
      id: 'bulk-export-protection',
      name: 'Bulk Data Export Protection',
      description: 'Monitors and controls bulk data exports',
      enabled: true,
      priority: 'MEDIUM',
      dataTypes: [{
        type: 'CONFIDENTIAL',
        patterns: [
          { name: 'Large Dataset', regex: '.*', confidence: 50 }
        ],
        sensitivity: 'MEDIUM',
        regulations: ['Internal Policy']
      }],
      conditions: [
        { field: 'export_count', operator: 'count_greater_than', value: 1000, weight: 0.6 },
        { field: 'export_frequency', operator: 'frequency_exceeds', value: 5, weight: 0.4 }
      ],
      actions: [
        { type: 'ALERT', parameters: { severity: 'MEDIUM' }, immediate: true },
        { type: 'LOG', parameters: { category: 'BULK_EXPORT' }, immediate: true },
        { type: 'REQUIRE_APPROVAL', parameters: { approvers: ['data_steward'] }, immediate: false }
      ],
      scope: {},
      exceptions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    logger.info('Default DLP policies initialized', {
      policiesCount: this.policies.size
    });
  }

  /**
   * Initialize data patterns for classification
   */
  private initializeDataPatterns(): void {
    // PII Patterns
    this.dataPatterns.set('PII', [
      { name: 'SSN', regex: '\\b\\d{3}-?\\d{2}-?\\d{4}\\b', confidence: 95 },
      { name: 'Email', regex: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b', confidence: 90 },
      { name: 'Phone US', regex: '\\b(?:\\+?1[-.]?)?\\(?([0-9]{3})\\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\\b', confidence: 85 },
      { name: 'Passport', regex: '\\b[A-Z]{1,2}\\d{6,9}\\b', confidence: 80 },
      { name: 'Driver License', regex: '\\b[A-Z]{1,2}\\d{6,8}\\b', confidence: 75 }
    ]);

    // Financial Patterns
    this.dataPatterns.set('FINANCIAL', [
      { name: 'Credit Card Visa', regex: '\\b4\\d{3}[-\\s]?\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}\\b', confidence: 95 },
      { name: 'Credit Card MC', regex: '\\b5[1-5]\\d{2}[-\\s]?\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}\\b', confidence: 95 },
      { name: 'Credit Card Amex', regex: '\\b3[47]\\d{2}[-\\s]?\\d{6}[-\\s]?\\d{5}\\b', confidence: 95 },
      { name: 'Bank Account', regex: '\\b\\d{8,17}\\b', confidence: 70 },
      { name: 'IBAN', regex: '\\b[A-Z]{2}\\d{2}[A-Z0-9]{4}\\d{7}([A-Z0-9]?){0,16}\\b', confidence: 90 },
      { name: 'SWIFT Code', regex: '\\b[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?\\b', confidence: 85 }
    ]);

    // Maritime Patterns
    this.dataPatterns.set('MARITIME', [
      { name: 'IMO Number', regex: '\\bIMO\\s?\\d{7}\\b', confidence: 95 },
      { name: 'MMSI', regex: '\\b\\d{9}\\b', confidence: 80 },
      { name: 'Call Sign', regex: '\\b[A-Z0-9]{3,7}\\b', confidence: 70 },
      { name: 'Port Code UNLOCODE', regex: '\\b[A-Z]{2}[A-Z0-9]{3}\\b', confidence: 85 },
      { name: 'Coordinates', regex: '\\b\\d{1,3}°\\d{1,2}\'\\d{1,2}"[NS]\\s+\\d{1,3}°\\d{1,2}\'\\d{1,2}"[EW]\\b', confidence: 90 },
      { name: 'Coordinates Decimal', regex: '\\b-?\\d{1,3}\\.\\d+,\\s*-?\\d{1,3}\\.\\d+\\b', confidence: 85 }
    ]);

    // Technical Patterns
    this.dataPatterns.set('TECHNICAL', [
      { name: 'API Key', regex: '\\b[A-Za-z0-9]{32,}\\b', confidence: 70 },
      { name: 'Database Connection', regex: 'mongodb://|mysql://|postgresql://|jdbc:', confidence: 90 },
      { name: 'IP Address', regex: '\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b', confidence: 85 },
      { name: 'MAC Address', regex: '\\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\\b', confidence: 90 }
    ]);

    logger.info('Data patterns initialized', {
      patternTypes: Array.from(this.dataPatterns.keys()),
      totalPatterns: Array.from(this.dataPatterns.values()).reduce((sum, patterns) => sum + patterns.length, 0)
    });
  }

  /**
   * Scan data for sensitive information
   */
  async scanData(data: {
    content: string;
    context: {
      userId?: string;
      action: string;
      resource: string;
      resourceId?: string;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
    };
  }): Promise<DataClassificationResult> {
    const detectedPatterns: DetectedSensitiveData[] = [];
    const dataTypes = new Set<string>();
    let maxSensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let totalConfidence = 0;
    let patternCount = 0;

    // Scan against all data patterns
    for (const [type, patterns] of this.dataPatterns) {
      for (const pattern of patterns) {
        const matches = this.findPatternMatches(data.content, pattern);
        
        if (matches.length > 0) {
          dataTypes.add(type);
          patternCount++;
          totalConfidence += pattern.confidence;

          detectedPatterns.push({
            type,
            pattern: pattern.name,
            matches,
            confidence: pattern.confidence,
            context: this.extractContext(data.content, matches)
          });

          // Update sensitivity level
          const patternSensitivity = this.getPatternSensitivity(type);
          if (this.getSensitivityLevel(patternSensitivity) > this.getSensitivityLevel(maxSensitivity)) {
            maxSensitivity = patternSensitivity;
          }
        }
      }
    }

    const averageConfidence = patternCount > 0 ? totalConfidence / patternCount : 0;

    // Check against DLP policies
    await this.checkDLPPolicies(data, detectedPatterns);

    // Generate recommendations
    const recommendations = this.generateDataProtectionRecommendations(detectedPatterns, maxSensitivity);

    return {
      dataTypes: Array.from(dataTypes),
      sensitivity: maxSensitivity,
      confidence: Math.round(averageConfidence),
      patterns: detectedPatterns,
      recommendations
    };
  }

  /**
   * Find pattern matches in content
   */
  private findPatternMatches(content: string, pattern: DataPattern): DataMatch[] {
    const matches: DataMatch[] = [];
    const regex = new RegExp(pattern.regex, 'gi');
    let match;

    while ((match = regex.exec(content)) !== null) {
      const value = match[0];
      const redacted = this.redactValue(value, pattern.name);
      
      matches.push({
        value,
        position: match.index,
        length: value.length,
        redacted
      });
    }

    return matches;
  }

  /**
   * Redact sensitive value
   */
  private redactValue(value: string, patternType: string): string {
    switch (patternType) {
      case 'SSN':
        return value.replace(/\d/g, '*').replace(/\*{3}-\*{2}-(\*{4})/, 'XXX-XX-$1');
      case 'Credit Card Visa':
      case 'Credit Card MC':
      case 'Credit Card Amex':
        return value.replace(/\d(?=\d{4})/g, '*');
      case 'Email':
        const [local, domain] = value.split('@');
        return `${local.charAt(0)}***@${domain}`;
      case 'Phone US':
        return value.replace(/\d(?=\d{4})/g, '*');
      default:
        return '*'.repeat(Math.min(value.length, 8));
    }
  }

  /**
   * Extract context around matches
   */
  private extractContext(content: string, matches: DataMatch[]): string {
    if (matches.length === 0) return '';
    
    const match = matches[0];
    const start = Math.max(0, match.position - 50);
    const end = Math.min(content.length, match.position + match.length + 50);
    
    return content.substring(start, end);
  }

  /**
   * Check data against DLP policies
   */
  private async checkDLPPolicies(data: any, detectedPatterns: DetectedSensitiveData[]): Promise<void> {
    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      const violation = await this.evaluatePolicy(policy, data, detectedPatterns);
      if (violation) {
        await this.handleDLPViolation(violation);
      }
    }
  }

  /**
   * Evaluate policy against data
   */
  private async evaluatePolicy(policy: DLPPolicy, data: any, detectedPatterns: DetectedSensitiveData[]): Promise<DLPViolation | null> {
    // Check if policy applies to this data
    const relevantPatterns = detectedPatterns.filter(pattern => 
      policy.dataTypes.some(dt => dt.type === pattern.type)
    );

    if (relevantPatterns.length === 0) return null;

    // Check scope restrictions
    if (!this.isInPolicyScope(policy, data.context)) return null;

    // Check exceptions
    if (this.hasValidException(policy, data.context)) return null;

    // Evaluate conditions
    let score = 0;
    let maxScore = 0;

    for (const condition of policy.conditions) {
      maxScore += condition.weight;
      
      if (await this.evaluateDLPCondition(condition, data, relevantPatterns)) {
        score += condition.weight;
      }
    }

    const confidence = maxScore > 0 ? (score / maxScore) * 100 : 0;

    // Require minimum confidence threshold
    if (confidence < 70) return null;

    return {
      id: this.generateViolationId(),
      policyId: policy.id,
      policyName: policy.name,
      severity: policy.priority,
      dataType: relevantPatterns.map(p => p.type).join(', '),
      violationType: this.determineViolationType(policy, data.context),
      userId: data.context.userId,
      resourceId: data.context.resourceId,
      resourceType: data.context.resource,
      detectedData: relevantPatterns,
      context: {
        action: data.context.action,
        ipAddress: data.context.ipAddress,
        userAgent: data.context.userAgent,
        timestamp: new Date(),
        metadata: data.context.metadata
      },
      status: 'DETECTED',
      mitigationActions: []
    };
  }

  /**
   * Handle DLP violation
   */
  private async handleDLPViolation(violation: DLPViolation): Promise<void> {
    // Store violation
    this.violations.set(violation.id, violation);

    // Get policy actions
    const policy = this.policies.get(violation.policyId);
    if (!policy) return;

    // Execute policy actions
    for (const action of policy.actions) {
      try {
        await this.executeDLPAction(action, violation);
      } catch (error) {
        logger.error('Failed to execute DLP action', {
          actionType: action.type,
          violationId: violation.id,
          error: error.message
        });
      }
    }

    // Log violation
    await AuditService.logSecurityEvent({
      userId: violation.userId,
      action: 'DLP_VIOLATION_DETECTED',
      ip: violation.context.ipAddress,
      userAgent: violation.context.userAgent,
      metadata: {
        violationId: violation.id,
        policyId: violation.policyId,
        policyName: violation.policyName,
        severity: violation.severity,
        dataType: violation.dataType,
        violationType: violation.violationType,
        detectedPatterns: violation.detectedData.length
      }
    });

    // Send security alert
    await securityMonitoringService.recordSecurityEvent({
      type: SecurityEventType.DATA_BREACH_ATTEMPT,
      severity: violation.severity,
      source: 'dlp_service',
      userId: violation.userId,
      ip: violation.context.ipAddress,
      userAgent: violation.context.userAgent,
      details: {
        violationId: violation.id,
        policyName: violation.policyName,
        dataType: violation.dataType,
        violationType: violation.violationType
      }
    });

    logger.warn('DLP violation detected and handled', {
      violationId: violation.id,
      policyName: violation.policyName,
      severity: violation.severity,
      userId: violation.userId
    });
  }

  /**
   * Execute DLP action
   */
  private async executeDLPAction(action: DLPAction, violation: DLPViolation): Promise<void> {
    switch (action.type) {
      case 'BLOCK':
        await this.blockAction(violation, action.parameters);
        break;
      case 'QUARANTINE':
        await this.quarantineUser(violation, action.parameters);
        break;
      case 'ENCRYPT':
        await this.encryptData(violation, action.parameters);
        break;
      case 'REDACT':
        await this.redactData(violation, action.parameters);
        break;
      case 'ALERT':
        await this.sendDLPAlert(violation, action.parameters);
        break;
      case 'LOG':
        await this.logDLPEvent(violation, action.parameters);
        break;
      case 'REQUIRE_APPROVAL':
        await this.requireApproval(violation, action.parameters);
        break;
    }

    violation.mitigationActions.push(`${action.type}: ${JSON.stringify(action.parameters)}`);
  }

  /**
   * Block action
   */
  private async blockAction(violation: DLPViolation, parameters: any): Promise<void> {
    // Implementation would integrate with request blocking mechanism
    logger.warn('Action blocked by DLP', {
      violationId: violation.id,
      userId: violation.userId,
      message: parameters.message
    });
  }

  /**
   * Quarantine user
   */
  private async quarantineUser(violation: DLPViolation, parameters: any): Promise<void> {
    // Implementation would integrate with user management service
    logger.warn('User quarantined by DLP', {
      violationId: violation.id,
      userId: violation.userId,
      duration: parameters.duration
    });
  }

  /**
   * Encrypt data
   */
  private async encryptData(violation: DLPViolation, parameters: any): Promise<void> {
    // Use field encryption service to encrypt sensitive data
    for (const detectedData of violation.detectedData) {
      for (const match of detectedData.matches) {
        try {
          const encrypted = fieldEncryptionService.encryptField(match.value);
          logger.info('Sensitive data encrypted by DLP', {
            violationId: violation.id,
            pattern: detectedData.pattern,
            algorithm: parameters.algorithm
          });
        } catch (error) {
          logger.error('Failed to encrypt sensitive data', {
            violationId: violation.id,
            error: error.message
          });
        }
      }
    }
  }

  /**
   * Redact data
   */
  private async redactData(violation: DLPViolation, parameters: any): Promise<void> {
    // Implementation would redact sensitive data in place
    logger.info('Sensitive data redacted by DLP', {
      violationId: violation.id,
      patternsRedacted: violation.detectedData.length
    });
  }

  /**
   * Send DLP alert
   */
  private async sendDLPAlert(violation: DLPViolation, parameters: any): Promise<void> {
    // Implementation would send alerts to security team
    logger.warn('DLP alert sent', {
      violationId: violation.id,
      severity: parameters.severity || violation.severity,
      policyName: violation.policyName
    });
  }

  /**
   * Log DLP event
   */
  private async logDLPEvent(violation: DLPViolation, parameters: any): Promise<void> {
    await AuditService.logAction(
      violation.userId || 'system',
      'DLP_EVENT',
      'data_protection',
      violation.id,
      undefined,
      {
        violationId: violation.id,
        policyId: violation.policyId,
        category: parameters.category
      }
    );
  }

  /**
   * Require approval
   */
  private async requireApproval(violation: DLPViolation, parameters: any): Promise<void> {
    // Implementation would integrate with approval workflow
    logger.info('DLP approval required', {
      violationId: violation.id,
      approvers: parameters.approvers,
      userId: violation.userId
    });
  }

  /**
   * Add new DLP policy
   */
  addPolicy(policy: DLPPolicy): void {
    this.policies.set(policy.id, policy);
    logger.info('DLP policy added', {
      policyId: policy.id,
      name: policy.name,
      priority: policy.priority
    });
  }

  /**
   * Update DLP policy
   */
  updatePolicy(policyId: string, updates: Partial<DLPPolicy>): void {
    const policy = this.policies.get(policyId);
    if (policy) {
      Object.assign(policy, updates, { updatedAt: new Date() });
      this.policies.set(policyId, policy);
      
      logger.info('DLP policy updated', {
        policyId,
        updates: Object.keys(updates)
      });
    }
  }

  /**
   * Get DLP violations
   */
  getDLPViolations(filters?: {
    severity?: string;
    status?: string;
    userId?: string;
    timeRange?: { start: Date; end: Date };
  }): DLPViolation[] {
    let violations = Array.from(this.violations.values());

    if (filters) {
      if (filters.severity) {
        violations = violations.filter(v => v.severity === filters.severity);
      }
      if (filters.status) {
        violations = violations.filter(v => v.status === filters.status);
      }
      if (filters.userId) {
        violations = violations.filter(v => v.userId === filters.userId);
      }
      if (filters.timeRange) {
        violations = violations.filter(v => 
          v.context.timestamp >= filters.timeRange!.start && 
          v.context.timestamp <= filters.timeRange!.end
        );
      }
    }

    return violations.sort((a, b) => b.context.timestamp.getTime() - a.context.timestamp.getTime());
  }

  /**
   * Get DLP policies
   */
  getDLPPolicies(): DLPPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get DLP metrics
   */
  getDLPMetrics(): any {
    const violations = Array.from(this.violations.values());
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return {
      totalPolicies: this.policies.size,
      activePolicies: Array.from(this.policies.values()).filter(p => p.enabled).length,
      totalViolations: violations.length,
      violationsLast24Hours: violations.filter(v => v.context.timestamp > last24Hours).length,
      violationsBySeverity: {
        critical: violations.filter(v => v.severity === 'CRITICAL').length,
        high: violations.filter(v => v.severity === 'HIGH').length,
        medium: violations.filter(v => v.severity === 'MEDIUM').length,
        low: violations.filter(v => v.severity === 'LOW').length
      },
      violationsByType: {
        unauthorized_access: violations.filter(v => v.violationType === 'UNAUTHORIZED_ACCESS').length,
        data_exfiltration: violations.filter(v => v.violationType === 'DATA_EXFILTRATION').length,
        policy_violation: violations.filter(v => v.violationType === 'POLICY_VIOLATION').length,
        suspicious_activity: violations.filter(v => v.violationType === 'SUSPICIOUS_ACTIVITY').length
      },
      topDataTypes: this.getTopDataTypes(violations),
      topUsers: this.getTopViolatingUsers(violations)
    };
  }

  // Helper methods
  private evaluateDLPCondition(condition: DLPCondition, data: any, patterns: DetectedSensitiveData[]): boolean {
    switch (condition.operator) {
      case 'contains':
        return patterns.some(p => p.type === condition.value);
      case 'matches':
        return condition.value === true; // Simple boolean check
      case 'count_greater_than':
        return patterns.length > condition.value;
      case 'size_greater_than':
        return data.content.length > condition.value;
      case 'frequency_exceeds':
        // Would check frequency against historical data
        return false; // Simplified for now
      default:
        return false;
    }
  }

  private isInPolicyScope(policy: DLPPolicy, context: any): boolean {
    if (policy.scope.users && !policy.scope.users.includes(context.userId)) return false;
    if (policy.scope.resources && !policy.scope.resources.includes(context.resource)) return false;
    // Add more scope checks as needed
    return true;
  }

  private hasValidException(policy: DLPPolicy, context: any): boolean {
    return policy.exceptions.some(exception => {
      if (exception.expiresAt && exception.expiresAt < new Date()) return false;
      // Check exception conditions
      return true; // Simplified for now
    });
  }

  private determineViolationType(policy: DLPPolicy, context: any): DLPViolation['violationType'] {
    if (context.action === 'EXPORT') return 'DATA_EXFILTRATION';
    if (context.action === 'ACCESS_DENIED') return 'UNAUTHORIZED_ACCESS';
    if (policy.priority === 'CRITICAL') return 'SUSPICIOUS_ACTIVITY';
    return 'POLICY_VIOLATION';
  }

  private getPatternSensitivity(type: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const sensitivityMap = {
      'PII': 'HIGH' as const,
      'FINANCIAL': 'CRITICAL' as const,
      'MARITIME': 'HIGH' as const,
      'TECHNICAL': 'MEDIUM' as const,
      'CONFIDENTIAL': 'MEDIUM' as const
    };
    return sensitivityMap[type as keyof typeof sensitivityMap] || 'LOW';
  }

  private getSensitivityLevel(sensitivity: string): number {
    const levels = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
    return levels[sensitivity as keyof typeof levels] || 0;
  }

  private generateDataProtectionRecommendations(patterns: DetectedSensitiveData[], sensitivity: string): string[] {
    const recommendations = [];

    if (patterns.length > 0) {
      recommendations.push('Implement data classification and labeling');
      recommendations.push('Review data access controls');
    }

    if (sensitivity === 'CRITICAL' || sensitivity === 'HIGH') {
      recommendations.push('Enable field-level encryption for sensitive data');
      recommendations.push('Implement data loss prevention controls');
      recommendations.push('Monitor data access patterns');
    }

    if (patterns.some(p => p.type === 'PII')) {
      recommendations.push('Ensure GDPR/CCPA compliance measures');
      recommendations.push('Implement data retention policies');
    }

    if (patterns.some(p => p.type === 'FINANCIAL')) {
      recommendations.push('Implement PCI-DSS compliance controls');
      recommendations.push('Enable transaction monitoring');
    }

    if (patterns.some(p => p.type === 'MARITIME')) {
      recommendations.push('Ensure SOLAS/ISPS compliance');
      recommendations.push('Implement maritime security protocols');
    }

    return recommendations;
  }

  private getTopDataTypes(violations: DLPViolation[]): Array<{ type: string; count: number }> {
    const typeCounts = new Map<string, number>();
    
    for (const violation of violations) {
      const count = typeCounts.get(violation.dataType) || 0;
      typeCounts.set(violation.dataType, count + 1);
    }

    return Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private getTopViolatingUsers(violations: DLPViolation[]): Array<{ userId: string; count: number }> {
    const userCounts = new Map<string, number>();
    
    for (const violation of violations) {
      if (violation.userId) {
        const count = userCounts.get(violation.userId) || 0;
        userCounts.set(violation.userId, count + 1);
      }
    }

    return Array.from(userCounts.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private generateViolationId(): string {
    return `dlp_violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start violation monitoring background process
   */
  private startViolationMonitoring(): void {
    // Monitor for violations every 5 minutes
    setInterval(async () => {
      try {
        await this.performViolationAnalysis();
      } catch (error) {
        logger.error('DLP violation monitoring failed', { error: error.message });
      }
    }, 5 * 60 * 1000);

    logger.info('DLP violation monitoring started');
  }

  /**
   * Perform violation analysis
   */
  private async performViolationAnalysis(): Promise<void> {
    // Analyze recent audit logs for potential DLP violations
    const recentLogs = await prisma.auditLog.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
      }
    });

    for (const log of recentLogs) {
      // Check if log contains sensitive data patterns
      if (log.newValues || log.oldValues) {
        const content = JSON.stringify({ ...log.newValues, ...log.oldValues });
        
        await this.scanData({
          content,
          context: {
            userId: log.userId,
            action: log.action,
            resource: log.resource,
            resourceId: log.resourceId,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            metadata: log.metadata
          }
        });
      }
    }
  }
}

export const dataLossPreventionService = new DataLossPreventionService();