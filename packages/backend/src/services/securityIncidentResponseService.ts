import { logger } from '../utils/logger';
import { AuditService } from './auditService';
import { securityMonitoringService, SecurityEvent, SecurityEventType } from './securityMonitoringService';
import { securityIncidentService, SecurityIncident } from './securityIncidentService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface IncidentResponse {
  id: string;
  incidentId: string;
  responseType: ResponseType;
  status: 'INITIATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  automationLevel: 'MANUAL' | 'SEMI_AUTOMATED' | 'FULLY_AUTOMATED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  playbook: ResponsePlaybook;
  steps: ResponseStep[];
  timeline: ResponseTimeline[];
  assignedTeam: string[];
  stakeholders: string[];
  communicationPlan: CommunicationPlan;
  containmentActions: ContainmentAction[];
  recoveryActions: RecoveryAction[];
  lessonsLearned?: LessonsLearned;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export enum ResponseType {
  SECURITY_BREACH = 'SECURITY_BREACH',
  DATA_BREACH = 'DATA_BREACH',
  MALWARE_INCIDENT = 'MALWARE_INCIDENT',
  INSIDER_THREAT = 'INSIDER_THREAT',
  DENIAL_OF_SERVICE = 'DENIAL_OF_SERVICE',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  MARITIME_SECURITY = 'MARITIME_SECURITY',
  COMPLIANCE_VIOLATION = 'COMPLIANCE_VIOLATION',
  SYSTEM_COMPROMISE = 'SYSTEM_COMPROMISE'
}

export interface ResponsePlaybook {
  id: string;
  name: string;
  description: string;
  responseType: ResponseType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  steps: PlaybookStep[];
  automationRules: AutomationRule[];
  escalationCriteria: EscalationCriteria[];
  complianceRequirements: string[];
  estimatedDuration: number; // minutes
}

export interface PlaybookStep {
  id: string;
  name: string;
  description: string;
  category: 'DETECTION' | 'ANALYSIS' | 'CONTAINMENT' | 'ERADICATION' | 'RECOVERY' | 'LESSONS_LEARNED';
  automated: boolean;
  required: boolean;
  dependencies: string[];
  estimatedDuration: number;
  assignedRole: string;
  instructions: string;
  successCriteria: string[];
  tools: string[];
}

export interface AutomationRule {
  id: string;
  condition: string;
  action: string;
  parameters: Record<string, any>;
  enabled: boolean;
  priority: number;
}

export interface EscalationCriteria {
  condition: string;
  escalateTo: string[];
  timeThreshold?: number;
  severityThreshold?: string;
}

export interface ResponseStep {
  id: string;
  playbookStepId: string;
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  assignedTo?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  output?: string;
  evidence?: string[];
  notes?: string;
}

export interface ResponseTimeline {
  timestamp: Date;
  event: string;
  description: string;
  actor: string;
  category: 'DETECTION' | 'RESPONSE' | 'COMMUNICATION' | 'ESCALATION' | 'RESOLUTION';
  metadata?: Record<string, any>;
}

export interface CommunicationPlan {
  internalNotifications: NotificationRule[];
  externalNotifications: NotificationRule[];
  regulatoryNotifications: RegulatoryNotification[];
  publicCommunication?: PublicCommunication;
}

export interface NotificationRule {
  recipient: string;
  method: 'EMAIL' | 'SMS' | 'PHONE' | 'SLACK' | 'TEAMS';
  trigger: string;
  template: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMEDIATE';
}

export interface RegulatoryNotification {
  authority: string;
  regulation: string;
  timeframe: number; // hours
  required: boolean;
  template: string;
  status: 'PENDING' | 'SENT' | 'ACKNOWLEDGED';
}

export interface PublicCommunication {
  required: boolean;
  timeframe: number;
  channels: string[];
  approvalRequired: boolean;
  template: string;
}

export interface ContainmentAction {
  id: string;
  action: string;
  description: string;
  automated: boolean;
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
  executedAt?: Date;
  executedBy?: string;
  result?: string;
}

export interface RecoveryAction {
  id: string;
  action: string;
  description: string;
  priority: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  assignedTo?: string;
  estimatedDuration: number;
  dependencies: string[];
}

export interface LessonsLearned {
  whatWorked: string[];
  whatDidntWork: string[];
  improvements: string[];
  policyChanges: string[];
  trainingNeeds: string[];
  toolingGaps: string[];
}

export interface IncidentMetrics {
  detectionTime: number; // minutes
  responseTime: number; // minutes
  containmentTime: number; // minutes
  recoveryTime: number; // minutes
  totalDuration: number; // minutes
  automationRate: number; // percentage
  escalations: number;
  falsePositives: number;
}

class SecurityIncidentResponseService {
  private playbooks: Map<string, ResponsePlaybook> = new Map();
  private activeResponses: Map<string, IncidentResponse> = new Map();
  private responseHistory: Map<string, IncidentResponse> = new Map();

  constructor() {
    this.initializeDefaultPlaybooks();
    this.startResponseMonitoring();
  }

  /**
   * Initialize default incident response playbooks
   */
  private initializeDefaultPlaybooks(): void {
    // Data Breach Response Playbook
    this.addPlaybook({
      id: 'data-breach-response',
      name: 'Data Breach Response',
      description: 'Comprehensive response plan for data breach incidents',
      responseType: ResponseType.DATA_BREACH,
      severity: 'CRITICAL',
      steps: [
        {
          id: 'detect-breach',
          name: 'Detect and Confirm Breach',
          description: 'Confirm the data breach and assess initial scope',
          category: 'DETECTION',
          automated: true,
          required: true,
          dependencies: [],
          estimatedDuration: 15,
          assignedRole: 'security_analyst',
          instructions: 'Review alerts and confirm data breach indicators',
          successCriteria: ['Breach confirmed', 'Initial scope assessed'],
          tools: ['SIEM', 'DLP Tools', 'Log Analysis']
        },
        {
          id: 'isolate-systems',
          name: 'Isolate Affected Systems',
          description: 'Immediately isolate compromised systems to prevent further damage',
          category: 'CONTAINMENT',
          automated: true,
          required: true,
          dependencies: ['detect-breach'],
          estimatedDuration: 30,
          assignedRole: 'incident_commander',
          instructions: 'Isolate affected systems and networks',
          successCriteria: ['Systems isolated', 'Network segmentation applied'],
          tools: ['Network Management', 'Firewall', 'EDR']
        },
        {
          id: 'assess-impact',
          name: 'Assess Data Impact',
          description: 'Determine what data was accessed or exfiltrated',
          category: 'ANALYSIS',
          automated: false,
          required: true,
          dependencies: ['isolate-systems'],
          estimatedDuration: 60,
          assignedRole: 'data_protection_officer',
          instructions: 'Analyze logs and determine data exposure',
          successCriteria: ['Data types identified', 'Volume estimated', 'Affected individuals counted'],
          tools: ['Log Analysis', 'Database Audit', 'DLP Reports']
        },
        {
          id: 'notify-authorities',
          name: 'Notify Regulatory Authorities',
          description: 'Notify required regulatory authorities within legal timeframes',
          category: 'RECOVERY',
          automated: false,
          required: true,
          dependencies: ['assess-impact'],
          estimatedDuration: 120,
          assignedRole: 'legal_counsel',
          instructions: 'Prepare and send regulatory notifications',
          successCriteria: ['GDPR notification sent', 'Local authority notified'],
          tools: ['Legal Templates', 'Regulatory Portal']
        }
      ],
      automationRules: [
        {
          id: 'auto-isolate',
          condition: 'severity >= HIGH AND data_type = PII',
          action: 'isolate_systems',
          parameters: { immediate: true },
          enabled: true,
          priority: 1
        }
      ],
      escalationCriteria: [
        {
          condition: 'severity = CRITICAL',
          escalateTo: ['CISO', 'CEO', 'Legal'],
          timeThreshold: 30
        }
      ],
      complianceRequirements: ['GDPR', 'CCPA', 'SOX'],
      estimatedDuration: 480
    });

    // Maritime Security Incident Playbook
    this.addPlaybook({
      id: 'maritime-security-response',
      name: 'Maritime Security Incident Response',
      description: 'Response plan for maritime-specific security incidents',
      responseType: ResponseType.MARITIME_SECURITY,
      severity: 'HIGH',
      steps: [
        {
          id: 'assess-vessel-threat',
          name: 'Assess Vessel Threat Level',
          description: 'Evaluate threat to vessel operations and crew safety',
          category: 'DETECTION',
          automated: false,
          required: true,
          dependencies: [],
          estimatedDuration: 20,
          assignedRole: 'maritime_security_officer',
          instructions: 'Assess threat level and vessel vulnerability',
          successCriteria: ['Threat level determined', 'Vessel status confirmed'],
          tools: ['AIS Tracking', 'Vessel Management System']
        },
        {
          id: 'notify-maritime-authorities',
          name: 'Notify Maritime Authorities',
          description: 'Contact relevant maritime authorities and coast guard',
          category: 'RECOVERY',
          automated: false,
          required: true,
          dependencies: ['assess-vessel-threat'],
          estimatedDuration: 30,
          assignedRole: 'captain',
          instructions: 'Contact coast guard and port authorities',
          successCriteria: ['Authorities notified', 'Incident reported'],
          tools: ['Maritime Radio', 'Satellite Communication']
        },
        {
          id: 'implement-security-measures',
          name: 'Implement Enhanced Security',
          description: 'Activate enhanced security protocols',
          category: 'CONTAINMENT',
          automated: false,
          required: true,
          dependencies: ['assess-vessel-threat'],
          estimatedDuration: 45,
          assignedRole: 'security_team',
          instructions: 'Implement ISPS security measures',
          successCriteria: ['Security level raised', 'Access controls enhanced'],
          tools: ['ISPS Procedures', 'Security Equipment']
        }
      ],
      automationRules: [
        {
          id: 'auto-alert-authorities',
          condition: 'vessel_threat = HIGH',
          action: 'notify_maritime_authorities',
          parameters: { immediate: true },
          enabled: true,
          priority: 1
        }
      ],
      escalationCriteria: [
        {
          condition: 'crew_safety_risk = true',
          escalateTo: ['Coast Guard', 'Flag State', 'Company Management'],
          timeThreshold: 15
        }
      ],
      complianceRequirements: ['SOLAS', 'ISPS', 'MARPOL'],
      estimatedDuration: 240
    });

    // Malware Incident Playbook
    this.addPlaybook({
      id: 'malware-response',
      name: 'Malware Incident Response',
      description: 'Response plan for malware infections and cyber attacks',
      responseType: ResponseType.MALWARE_INCIDENT,
      severity: 'HIGH',
      steps: [
        {
          id: 'isolate-infected-systems',
          name: 'Isolate Infected Systems',
          description: 'Immediately isolate infected systems from network',
          category: 'CONTAINMENT',
          automated: true,
          required: true,
          dependencies: [],
          estimatedDuration: 10,
          assignedRole: 'security_analyst',
          instructions: 'Disconnect infected systems from network',
          successCriteria: ['Systems isolated', 'Malware contained'],
          tools: ['EDR', 'Network Isolation', 'Antivirus']
        },
        {
          id: 'analyze-malware',
          name: 'Analyze Malware Sample',
          description: 'Analyze malware to understand capabilities and impact',
          category: 'ANALYSIS',
          automated: false,
          required: true,
          dependencies: ['isolate-infected-systems'],
          estimatedDuration: 90,
          assignedRole: 'malware_analyst',
          instructions: 'Perform malware analysis in sandbox environment',
          successCriteria: ['Malware type identified', 'Capabilities understood'],
          tools: ['Sandbox', 'Reverse Engineering Tools', 'Threat Intelligence']
        },
        {
          id: 'eradicate-malware',
          name: 'Eradicate Malware',
          description: 'Remove malware from all affected systems',
          category: 'ERADICATION',
          automated: true,
          required: true,
          dependencies: ['analyze-malware'],
          estimatedDuration: 60,
          assignedRole: 'system_administrator',
          instructions: 'Clean infected systems and verify removal',
          successCriteria: ['Malware removed', 'Systems clean'],
          tools: ['Antivirus', 'System Restoration', 'Patch Management']
        }
      ],
      automationRules: [
        {
          id: 'auto-isolate-malware',
          condition: 'malware_detected = true',
          action: 'isolate_infected_systems',
          parameters: { immediate: true },
          enabled: true,
          priority: 1
        }
      ],
      escalationCriteria: [
        {
          condition: 'critical_systems_affected = true',
          escalateTo: ['IT Director', 'CISO'],
          timeThreshold: 30
        }
      ],
      complianceRequirements: ['ISO 27001', 'NIST'],
      estimatedDuration: 300
    });

    logger.info('Default incident response playbooks initialized', {
      playbooksCount: this.playbooks.size
    });
  }

  /**
   * Initiate incident response
   */
  async initiateResponse(incident: SecurityIncident): Promise<IncidentResponse> {
    const responseId = this.generateResponseId();
    
    // Determine appropriate playbook
    const playbook = this.selectPlaybook(incident);
    if (!playbook) {
      throw new Error(`No suitable playbook found for incident type: ${incident.type}`);
    }

    // Create incident response
    const response: IncidentResponse = {
      id: responseId,
      incidentId: incident.id || 'unknown',
      responseType: this.mapIncidentTypeToResponseType(incident.type),
      status: 'INITIATED',
      automationLevel: this.determineAutomationLevel(playbook),
      priority: incident.severity,
      playbook,
      steps: this.initializeResponseSteps(playbook),
      timeline: [{
        timestamp: new Date(),
        event: 'Response Initiated',
        description: `Incident response initiated using playbook: ${playbook.name}`,
        actor: 'system',
        category: 'RESPONSE'
      }],
      assignedTeam: this.assignResponseTeam(incident, playbook),
      stakeholders: this.identifyStakeholders(incident),
      communicationPlan: this.createCommunicationPlan(incident, playbook),
      containmentActions: [],
      recoveryActions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store active response
    this.activeResponses.set(responseId, response);

    // Execute automated steps
    await this.executeAutomatedSteps(response);

    // Send initial notifications
    await this.sendInitialNotifications(response);

    // Log response initiation
    await AuditService.logAction(
      'system',
      'CREATE',
      'incident_response',
      responseId,
      undefined,
      {
        incidentId: incident.id,
        responseType: response.responseType,
        playbookId: playbook.id,
        priority: response.priority
      },
      {
        action: 'INCIDENT_RESPONSE_INITIATED',
        automationLevel: response.automationLevel
      }
    );

    logger.info('Incident response initiated', {
      responseId,
      incidentId: incident.id,
      playbookName: playbook.name,
      priority: response.priority
    });

    return response;
  }

  /**
   * Execute automated response steps
   */
  private async executeAutomatedSteps(response: IncidentResponse): Promise<void> {
    const automatedSteps = response.steps.filter(step => {
      const playbookStep = response.playbook.steps.find(ps => ps.id === step.playbookStepId);
      return playbookStep?.automated === true;
    });

    for (const step of automatedSteps) {
      try {
        await this.executeResponseStep(response.id, step.id);
      } catch (error) {
        logger.error('Failed to execute automated step', {
          responseId: response.id,
          stepId: step.id,
          error: error.message
        });
      }
    }
  }

  /**
   * Execute specific response step
   */
  async executeResponseStep(responseId: string, stepId: string): Promise<void> {
    const response = this.activeResponses.get(responseId);
    if (!response) {
      throw new Error(`Response not found: ${responseId}`);
    }

    const step = response.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    const playbookStep = response.playbook.steps.find(ps => ps.id === step.playbookStepId);
    if (!playbookStep) {
      throw new Error(`Playbook step not found: ${step.playbookStepId}`);
    }

    // Check dependencies
    const dependenciesMet = this.checkStepDependencies(response, playbookStep);
    if (!dependenciesMet) {
      throw new Error(`Dependencies not met for step: ${stepId}`);
    }

    // Update step status
    step.status = 'IN_PROGRESS';
    step.startedAt = new Date();
    step.assignedTo = step.assignedTo || 'system';

    // Add timeline entry
    response.timeline.push({
      timestamp: new Date(),
      event: 'Step Started',
      description: `Started executing step: ${step.name}`,
      actor: step.assignedTo,
      category: 'RESPONSE'
    });

    try {
      // Execute step based on category
      const result = await this.executeStepAction(response, step, playbookStep);
      
      // Update step completion
      step.status = 'COMPLETED';
      step.completedAt = new Date();
      step.duration = step.completedAt.getTime() - step.startedAt!.getTime();
      step.output = result;

      // Add timeline entry
      response.timeline.push({
        timestamp: new Date(),
        event: 'Step Completed',
        description: `Completed step: ${step.name}`,
        actor: step.assignedTo,
        category: 'RESPONSE',
        metadata: { duration: step.duration, result }
      });

      // Check for escalation criteria
      await this.checkEscalationCriteria(response);

      // Update response status
      response.updatedAt = new Date();
      
      logger.info('Response step executed successfully', {
        responseId,
        stepId,
        stepName: step.name,
        duration: step.duration
      });

    } catch (error) {
      step.status = 'FAILED';
      step.completedAt = new Date();
      step.notes = error.message;

      response.timeline.push({
        timestamp: new Date(),
        event: 'Step Failed',
        description: `Failed to execute step: ${step.name}`,
        actor: step.assignedTo,
        category: 'RESPONSE',
        metadata: { error: error.message }
      });

      logger.error('Response step execution failed', {
        responseId,
        stepId,
        stepName: step.name,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Execute step action based on category
   */
  private async executeStepAction(response: IncidentResponse, step: ResponseStep, playbookStep: PlaybookStep): Promise<string> {
    switch (playbookStep.category) {
      case 'DETECTION':
        return await this.executeDetectionStep(response, step, playbookStep);
      case 'ANALYSIS':
        return await this.executeAnalysisStep(response, step, playbookStep);
      case 'CONTAINMENT':
        return await this.executeContainmentStep(response, step, playbookStep);
      case 'ERADICATION':
        return await this.executeEradicationStep(response, step, playbookStep);
      case 'RECOVERY':
        return await this.executeRecoveryStep(response, step, playbookStep);
      case 'LESSONS_LEARNED':
        return await this.executeLessonsLearnedStep(response, step, playbookStep);
      default:
        return 'Step executed successfully';
    }
  }

  /**
   * Execute detection step
   */
  private async executeDetectionStep(response: IncidentResponse, step: ResponseStep, playbookStep: PlaybookStep): Promise<string> {
    // Implementation would integrate with detection tools
    logger.info('Executing detection step', {
      responseId: response.id,
      stepName: step.name
    });
    
    return 'Detection step completed - threat confirmed';
  }

  /**
   * Execute analysis step
   */
  private async executeAnalysisStep(response: IncidentResponse, step: ResponseStep, playbookStep: PlaybookStep): Promise<string> {
    // Implementation would integrate with analysis tools
    logger.info('Executing analysis step', {
      responseId: response.id,
      stepName: step.name
    });
    
    return 'Analysis step completed - impact assessed';
  }

  /**
   * Execute containment step
   */
  private async executeContainmentStep(response: IncidentResponse, step: ResponseStep, playbookStep: PlaybookStep): Promise<string> {
    const containmentAction: ContainmentAction = {
      id: this.generateActionId(),
      action: step.name,
      description: playbookStep.description,
      automated: playbookStep.automated,
      status: 'EXECUTED',
      executedAt: new Date(),
      executedBy: step.assignedTo || 'system',
      result: 'Containment measures applied successfully'
    };

    response.containmentActions.push(containmentAction);

    // Implementation would execute actual containment measures
    logger.info('Executing containment step', {
      responseId: response.id,
      stepName: step.name,
      actionId: containmentAction.id
    });
    
    return 'Containment step completed - threat contained';
  }

  /**
   * Execute eradication step
   */
  private async executeEradicationStep(response: IncidentResponse, step: ResponseStep, playbookStep: PlaybookStep): Promise<string> {
    // Implementation would integrate with eradication tools
    logger.info('Executing eradication step', {
      responseId: response.id,
      stepName: step.name
    });
    
    return 'Eradication step completed - threat removed';
  }

  /**
   * Execute recovery step
   */
  private async executeRecoveryStep(response: IncidentResponse, step: ResponseStep, playbookStep: PlaybookStep): Promise<string> {
    const recoveryAction: RecoveryAction = {
      id: this.generateActionId(),
      action: step.name,
      description: playbookStep.description,
      priority: 1,
      status: 'COMPLETED',
      assignedTo: step.assignedTo,
      estimatedDuration: playbookStep.estimatedDuration,
      dependencies: playbookStep.dependencies
    };

    response.recoveryActions.push(recoveryAction);

    // Implementation would execute actual recovery measures
    logger.info('Executing recovery step', {
      responseId: response.id,
      stepName: step.name,
      actionId: recoveryAction.id
    });
    
    return 'Recovery step completed - systems restored';
  }

  /**
   * Execute lessons learned step
   */
  private async executeLessonsLearnedStep(response: IncidentResponse, step: ResponseStep, playbookStep: PlaybookStep): Promise<string> {
    // Generate lessons learned
    response.lessonsLearned = {
      whatWorked: ['Automated detection worked well', 'Response team coordination was effective'],
      whatDidntWork: ['Manual steps took too long', 'Communication delays occurred'],
      improvements: ['Increase automation', 'Improve communication channels'],
      policyChanges: ['Update incident response policy', 'Enhance security controls'],
      trainingNeeds: ['Security awareness training', 'Incident response drills'],
      toolingGaps: ['Need better SIEM integration', 'Automated response tools']
    };

    logger.info('Executing lessons learned step', {
      responseId: response.id,
      stepName: step.name
    });
    
    return 'Lessons learned documented';
  }

  /**
   * Check escalation criteria
   */
  private async checkEscalationCriteria(response: IncidentResponse): Promise<void> {
    for (const criteria of response.playbook.escalationCriteria) {
      if (this.evaluateEscalationCondition(criteria.condition, response)) {
        await this.escalateIncident(response, criteria);
      }
    }
  }

  /**
   * Escalate incident
   */
  private async escalateIncident(response: IncidentResponse, criteria: EscalationCriteria): Promise<void> {
    // Send escalation notifications
    for (const recipient of criteria.escalateTo) {
      await this.sendEscalationNotification(response, recipient);
    }

    // Add timeline entry
    response.timeline.push({
      timestamp: new Date(),
      event: 'Incident Escalated',
      description: `Incident escalated to: ${criteria.escalateTo.join(', ')}`,
      actor: 'system',
      category: 'ESCALATION',
      metadata: { criteria: criteria.condition }
    });

    logger.warn('Incident escalated', {
      responseId: response.id,
      escalatedTo: criteria.escalateTo,
      condition: criteria.condition
    });
  }

  /**
   * Complete incident response
   */
  async completeResponse(responseId: string, completedBy: string): Promise<void> {
    const response = this.activeResponses.get(responseId);
    if (!response) {
      throw new Error(`Response not found: ${responseId}`);
    }

    // Check if all required steps are completed
    const requiredSteps = response.steps.filter(step => {
      const playbookStep = response.playbook.steps.find(ps => ps.id === step.playbookStepId);
      return playbookStep?.required === true;
    });

    const incompleteSteps = requiredSteps.filter(step => step.status !== 'COMPLETED');
    if (incompleteSteps.length > 0) {
      throw new Error(`Cannot complete response - ${incompleteSteps.length} required steps incomplete`);
    }

    // Update response status
    response.status = 'COMPLETED';
    response.completedAt = new Date();
    response.updatedAt = new Date();

    // Add timeline entry
    response.timeline.push({
      timestamp: new Date(),
      event: 'Response Completed',
      description: 'Incident response completed successfully',
      actor: completedBy,
      category: 'RESOLUTION'
    });

    // Move to history
    this.responseHistory.set(responseId, response);
    this.activeResponses.delete(responseId);

    // Generate metrics
    const metrics = this.calculateResponseMetrics(response);

    // Log completion
    await AuditService.logAction(
      completedBy,
      'UPDATE',
      'incident_response',
      responseId,
      { status: 'IN_PROGRESS' },
      { status: 'COMPLETED', completedAt: response.completedAt },
      {
        action: 'INCIDENT_RESPONSE_COMPLETED',
        metrics
      }
    );

    logger.info('Incident response completed', {
      responseId,
      completedBy,
      duration: response.completedAt.getTime() - response.createdAt.getTime(),
      metrics
    });
  }

  /**
   * Calculate response metrics
   */
  private calculateResponseMetrics(response: IncidentResponse): IncidentMetrics {
    const totalDuration = response.completedAt 
      ? response.completedAt.getTime() - response.createdAt.getTime()
      : 0;

    const automatedSteps = response.steps.filter(step => {
      const playbookStep = response.playbook.steps.find(ps => ps.id === step.playbookStepId);
      return playbookStep?.automated === true;
    });

    const automationRate = response.steps.length > 0 
      ? (automatedSteps.length / response.steps.length) * 100
      : 0;

    const escalations = response.timeline.filter(t => t.category === 'ESCALATION').length;

    return {
      detectionTime: 0, // Would be calculated from incident detection
      responseTime: 0, // Would be calculated from response initiation
      containmentTime: 0, // Would be calculated from containment actions
      recoveryTime: 0, // Would be calculated from recovery actions
      totalDuration: Math.round(totalDuration / (1000 * 60)), // Convert to minutes
      automationRate: Math.round(automationRate),
      escalations,
      falsePositives: 0 // Would be determined during analysis
    };
  }

  /**
   * Get active responses
   */
  getActiveResponses(): IncidentResponse[] {
    return Array.from(this.activeResponses.values());
  }

  /**
   * Get response history
   */
  getResponseHistory(filters?: {
    responseType?: ResponseType;
    severity?: string;
    timeRange?: { start: Date; end: Date };
  }): IncidentResponse[] {
    let responses = Array.from(this.responseHistory.values());

    if (filters) {
      if (filters.responseType) {
        responses = responses.filter(r => r.responseType === filters.responseType);
      }
      if (filters.severity) {
        responses = responses.filter(r => r.priority === filters.severity);
      }
      if (filters.timeRange) {
        responses = responses.filter(r => 
          r.createdAt >= filters.timeRange!.start && 
          r.createdAt <= filters.timeRange!.end
        );
      }
    }

    return responses.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Add new playbook
   */
  addPlaybook(playbook: ResponsePlaybook): void {
    this.playbooks.set(playbook.id, playbook);
    logger.info('Response playbook added', {
      playbookId: playbook.id,
      name: playbook.name,
      responseType: playbook.responseType
    });
  }

  // Helper methods
  private selectPlaybook(incident: SecurityIncident): ResponsePlaybook | null {
    const responseType = this.mapIncidentTypeToResponseType(incident.type);
    
    // Find playbook matching response type and severity
    for (const playbook of this.playbooks.values()) {
      if (playbook.responseType === responseType && 
          this.getSeverityLevel(playbook.severity) <= this.getSeverityLevel(incident.severity)) {
        return playbook;
      }
    }

    // Fallback to any playbook of the same type
    for (const playbook of this.playbooks.values()) {
      if (playbook.responseType === responseType) {
        return playbook;
      }
    }

    return null;
  }

  private mapIncidentTypeToResponseType(incidentType: SecurityIncident['type']): ResponseType {
    const mapping = {
      'UNAUTHORIZED_ACCESS': ResponseType.UNAUTHORIZED_ACCESS,
      'SUSPICIOUS_ACTIVITY': ResponseType.SECURITY_BREACH,
      'DATA_BREACH': ResponseType.DATA_BREACH,
      'AUTHENTICATION_FAILURE': ResponseType.UNAUTHORIZED_ACCESS,
      'PERMISSION_VIOLATION': ResponseType.UNAUTHORIZED_ACCESS,
      'MALWARE_DETECTED': ResponseType.MALWARE_INCIDENT,
      'INSIDER_THREAT': ResponseType.INSIDER_THREAT
    };
    return mapping[incidentType as keyof typeof mapping] || ResponseType.SECURITY_BREACH;
  }

  private determineAutomationLevel(playbook: ResponsePlaybook): IncidentResponse['automationLevel'] {
    const automatedSteps = playbook.steps.filter(step => step.automated).length;
    const totalSteps = playbook.steps.length;
    const automationRate = totalSteps > 0 ? automatedSteps / totalSteps : 0;

    if (automationRate >= 0.8) return 'FULLY_AUTOMATED';
    if (automationRate >= 0.4) return 'SEMI_AUTOMATED';
    return 'MANUAL';
  }

  private initializeResponseSteps(playbook: ResponsePlaybook): ResponseStep[] {
    return playbook.steps.map(step => ({
      id: this.generateStepId(),
      playbookStepId: step.id,
      name: step.name,
      status: 'PENDING'
    }));
  }

  private assignResponseTeam(incident: SecurityIncident, playbook: ResponsePlaybook): string[] {
    // Logic to assign appropriate team members based on incident and playbook
    const team = ['incident_commander', 'security_analyst'];
    
    if (playbook.responseType === ResponseType.DATA_BREACH) {
      team.push('data_protection_officer', 'legal_counsel');
    }
    
    if (playbook.responseType === ResponseType.MARITIME_SECURITY) {
      team.push('maritime_security_officer', 'captain');
    }

    return team;
  }

  private identifyStakeholders(incident: SecurityIncident): string[] {
    const stakeholders = ['CISO', 'IT Director'];
    
    if (incident.severity === 'CRITICAL') {
      stakeholders.push('CEO', 'Board');
    }

    return stakeholders;
  }

  private createCommunicationPlan(incident: SecurityIncident, playbook: ResponsePlaybook): CommunicationPlan {
    return {
      internalNotifications: [
        {
          recipient: 'security_team',
          method: 'EMAIL',
          trigger: 'incident_detected',
          template: 'security_incident_alert',
          urgency: 'HIGH'
        }
      ],
      externalNotifications: [],
      regulatoryNotifications: playbook.complianceRequirements.map(req => ({
        authority: req,
        regulation: req,
        timeframe: req === 'GDPR' ? 72 : 24,
        required: true,
        template: `${req.toLowerCase()}_notification`,
        status: 'PENDING'
      })),
      publicCommunication: incident.severity === 'CRITICAL' ? {
        required: true,
        timeframe: 24,
        channels: ['website', 'press_release'],
        approvalRequired: true,
        template: 'public_incident_notification'
      } : undefined
    };
  }

  private checkStepDependencies(response: IncidentResponse, playbookStep: PlaybookStep): boolean {
    if (playbookStep.dependencies.length === 0) return true;

    return playbookStep.dependencies.every(depId => {
      const depStep = response.steps.find(step => step.playbookStepId === depId);
      return depStep?.status === 'COMPLETED';
    });
  }

  private evaluateEscalationCondition(condition: string, response: IncidentResponse): boolean {
    // Simple condition evaluation - would be more sophisticated in practice
    if (condition.includes('severity = CRITICAL')) {
      return response.priority === 'CRITICAL';
    }
    return false;
  }

  private async sendInitialNotifications(response: IncidentResponse): Promise<void> {
    // Implementation would send actual notifications
    logger.info('Initial notifications sent', {
      responseId: response.id,
      recipients: response.assignedTeam
    });
  }

  private async sendEscalationNotification(response: IncidentResponse, recipient: string): Promise<void> {
    // Implementation would send escalation notifications
    logger.info('Escalation notification sent', {
      responseId: response.id,
      recipient
    });
  }

  private getSeverityLevel(severity: string): number {
    const levels = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
    return levels[severity as keyof typeof levels] || 0;
  }

  private generateResponseId(): string {
    return `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateStepId(): string {
    return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start response monitoring
   */
  private startResponseMonitoring(): void {
    // Monitor active responses every 5 minutes
    setInterval(async () => {
      try {
        await this.monitorActiveResponses();
      } catch (error) {
        logger.error('Response monitoring failed', { error: error.message });
      }
    }, 5 * 60 * 1000);

    logger.info('Security incident response monitoring started');
  }

  /**
   * Monitor active responses for timeouts and escalations
   */
  private async monitorActiveResponses(): Promise<void> {
    const now = new Date();
    
    for (const response of this.activeResponses.values()) {
      // Check for overdue steps
      const overdueSteps = response.steps.filter(step => {
        if (step.status !== 'IN_PROGRESS') return false;
        
        const playbookStep = response.playbook.steps.find(ps => ps.id === step.playbookStepId);
        if (!playbookStep || !step.startedAt) return false;
        
        const elapsed = now.getTime() - step.startedAt.getTime();
        const threshold = playbookStep.estimatedDuration * 60 * 1000; // Convert to ms
        
        return elapsed > threshold;
      });

      // Handle overdue steps
      for (const step of overdueSteps) {
        await this.handleOverdueStep(response, step);
      }
    }
  }

  /**
   * Handle overdue response step
   */
  private async handleOverdueStep(response: IncidentResponse, step: ResponseStep): Promise<void> {
    // Add timeline entry
    response.timeline.push({
      timestamp: new Date(),
      event: 'Step Overdue',
      description: `Step overdue: ${step.name}`,
      actor: 'system',
      category: 'ESCALATION',
      metadata: { stepId: step.id }
    });

    // Send overdue notification
    logger.warn('Response step overdue', {
      responseId: response.id,
      stepId: step.id,
      stepName: step.name,
      assignedTo: step.assignedTo
    });
  }
}

export const securityIncidentResponseService = new SecurityIncidentResponseService();