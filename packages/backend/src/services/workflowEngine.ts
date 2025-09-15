import { PrismaClient, Requisition, User, Vessel, UrgencyLevel, CriticalityLevel, UserRole } from '@prisma/client';
import { 
  WorkflowRule, 
  WorkflowCondition, 
  WorkflowAction, 
  ApprovalThreshold, 
  BudgetHierarchy, 
  EmergencyBypass,
  DEFAULT_APPROVAL_THRESHOLDS,
  DEFAULT_EMERGENCY_BYPASSES
}
} from '../models/WorkflowRule';
import { AuditService } from './auditService';
import { logger } from '../utils/logger';

interface RequisitionWithDetails extends Requisition {
  vessel: Vessel;
  requestedBy: User;
  items: Array<{
    itemCatalog: {
      criticalityLevel: CriticalityLevel;
      category: string;
    };
    quantity: number;
    totalPrice: number;
  }>;
}

interface ApprovalDecision {
  requiresApproval: boolean;
  approverRole?: string;
  approverLevel?: number;
  budgetLimit?: number;
  costCenter?: string;
  autoApprove?: boolean;
  emergencyBypass?: boolean;
  escalationDelay?: number;
  reason: string;
  budgetHierarchy: 'VESSEL' | 'FLEET' | 'COMPANY';
}

export class WorkflowEngine {
  private prisma: PrismaClient;
  private approvalThresholds: ApprovalThreshold[];
  private emergencyBypasses: EmergencyBypass[];

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.approvalThresholds = DEFAULT_APPROVAL_THRESHOLDS;
    this.emergencyBypasses = DEFAULT_EMERGENCY_BYPASSES;
  }

  /**
   * Evaluate a requisition against workflow rules to determine approval requirements
   */
  async evaluateRequisition(requisition: RequisitionWithDetails): Promise<ApprovalDecision> {
    try {
      logger.info(`Evaluating workflow for requisition ${requisition.id}`);

      // Check for emergency bypass first
      const emergencyBypass = await this.checkEmergencyBypass(requisition);
      if (emergencyBypass.emergencyBypass) {
        return emergencyBypass;
      }

      // Check amount-based routing
      const amountBasedDecision = await this.evaluateAmountBasedRouting(requisition);
      
      // Check urgency-based workflow modifications
      const urgencyModifiedDecision = await this.applyUrgencyModifications(
        amountBasedDecision, 
        requisition
      );

      // Validate budget hierarchy
      const budgetValidatedDecision = await this.validateBudgetHierarchy(
        urgencyModifiedDecision,
        requisition
      );

      // Log the decision
      await AuditService.logWorkflowDecision(
        requisition.requestedById,
        requisition.id,
        budgetValidatedDecision
      );

      return budgetValidatedDecision;

    } catch (error) {
      logger.error('Error evaluating workflow:', error);
      throw new Error(`Workflow evaluation failed: ${error.message}`);
    }
  }

  /**
   * Check if requisition qualifies for emergency bypass
   */
  private async checkEmergencyBypass(requisition: RequisitionWithDetails): Promise<ApprovalDecision> {
    if (requisition.urgencyLevel !== 'EMERGENCY') {
      return { requiresApproval: true, reason: 'Not emergency', budgetHierarchy: 'VESSEL' };
    }

    // Get the highest criticality level from items
    const highestCriticality = this.getHighestCriticalityLevel(requisition.items);
    
    // Find matching emergency bypass rule
    const bypassRule = this.emergencyBypasses.find(rule => 
      rule.urgencyLevel === requisition.urgencyLevel &&
      rule.criticalityLevel === highestCriticality &&
      rule.allowedRoles.includes(requisition.requestedBy.role)
    );

    if (!bypassRule) {
      return { requiresApproval: true, reason: 'No emergency bypass rule matches', budgetHierarchy: 'VESSEL' };
    }

    // Check amount limit if specified
    if (bypassRule.maxAmount && requisition.totalAmount > bypassRule.maxAmount) {
      return { 
        requiresApproval: true, 
        reason: `Emergency bypass amount limit exceeded (${bypassRule.maxAmount})`,
        budgetHierarchy: 'VESSEL'
      };
    }

    logger.info(`Emergency bypass approved for requisition ${requisition.id}`);
    
    return {
      requiresApproval: false,
      autoApprove: true,
      emergencyBypass: true,
      reason: `Emergency bypass - ${requisition.urgencyLevel} ${highestCriticality}`,
      budgetHierarchy: 'VESSEL'
    };
  }

  /**
   * Evaluate amount-based routing thresholds
   */
  private async evaluateAmountBasedRouting(requisition: RequisitionWithDetails): Promise<ApprovalDecision> {
    const amount = requisition.totalAmount;
    const currency = requisition.currency;

    // Convert to USD if different currency (simplified - in production would use exchange rates)
    const usdAmount = currency === 'USD' ? amount : amount; // TODO: Implement currency conversion

    // Find matching threshold
    const threshold = this.approvalThresholds.find(t => 
      usdAmount >= t.minAmount && usdAmount < t.maxAmount
    );

    if (!threshold) {
      throw new Error(`No approval threshold found for amount ${usdAmount}`);
    }

    // Auto-approve for routine items under $500
    if (threshold.requiredRole === 'AUTO_APPROVE') {
      const isRoutineOnly = requisition.items.every(item => 
        item.itemCatalog.criticalityLevel === 'ROUTINE'
      );

      if (isRoutineOnly) {
        return {
          requiresApproval: false,
          autoApprove: true,
          reason: `Auto-approved: Routine items under $${threshold.maxAmount}`,
          budgetHierarchy: threshold.budgetHierarchy
        };
      }
    }

    return {
      requiresApproval: true,
      approverRole: threshold.requiredRole,
      approverLevel: threshold.approverLevel,
      budgetLimit: threshold.maxAmount,
      costCenter: threshold.costCenterRequired ? 'REQUIRED' : undefined,
      reason: `Amount-based routing: $${usdAmount} requires ${threshold.requiredRole}`,
      budgetHierarchy: threshold.budgetHierarchy
    };
  }

  /**
   * Apply urgency-based modifications to workflow
   */
  private async applyUrgencyModifications(
    decision: ApprovalDecision, 
    requisition: RequisitionWithDetails
  ): Promise<ApprovalDecision> {
    
    if (decision.autoApprove || decision.emergencyBypass) {
      return decision;
    }

    // Urgent items get expedited processing
    if (requisition.urgencyLevel === 'URGENT') {
      return {
        ...decision,
        escalationDelay: 2, // 2 hours instead of default 24
        reason: `${decision.reason} (Expedited for URGENT)`
      };
    }

    // Emergency items that didn't qualify for bypass still get priority
    if (requisition.urgencyLevel === 'EMERGENCY') {
      return {
        ...decision,
        escalationDelay: 1, // 1 hour escalation
        reason: `${decision.reason} (Priority for EMERGENCY)`
      };
    }

    // Routine items get standard processing
    return {
      ...decision,
      escalationDelay: 24 // 24 hours standard
    };
  }

  /**
   * Validate budget hierarchy and adjust approval requirements
   */
  private async validateBudgetHierarchy(
    decision: ApprovalDecision,
    requisition: RequisitionWithDetails
  ): Promise<ApprovalDecision> {
    
    if (decision.autoApprove || decision.emergencyBypass) {
      return decision;
    }

    // Get vessel budget information
    const vesselBudget = await this.getVesselBudget(requisition.vesselId, requisition.currency);
    
    // Check if amount exceeds vessel budget limits
    if (vesselBudget && requisition.totalAmount > vesselBudget.remainingAmount) {
      
      // Escalate to fleet level
      if (decision.budgetHierarchy === 'VESSEL') {
        return {
          ...decision,
          budgetHierarchy: 'FLEET',
          approverRole: 'PROCUREMENT_MANAGER',
          approverLevel: Math.max(decision.approverLevel || 1, 2),
          reason: `${decision.reason} (Escalated to FLEET - vessel budget exceeded)`
        };
      }

      // Escalate to company level
      if (decision.budgetHierarchy === 'FLEET') {
        return {
          ...decision,
          budgetHierarchy: 'COMPANY',
          approverRole: 'FINANCE_TEAM',
          approverLevel: Math.max(decision.approverLevel || 2, 3),
          reason: `${decision.reason} (Escalated to COMPANY - fleet budget exceeded)`
        };
      }
    }

    return decision;
  }

  /**
   * Get vessel budget information
   */
  private async getVesselBudget(vesselId: string, currency: string) {
    try {
      const currentPeriod = this.getCurrentBudgetPeriod();
      
      const budget = await this.prisma.budget.findFirst({
        where: {
          vesselId,
          currency,
          period: currentPeriod,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() }
        }
      });

      if (!budget) {
        return null;
      }

      // Calculate spent amount (simplified - would need to sum actual spending)
      const spentAmount = 0; // TODO: Calculate from actual requisitions/POs
      
      return {
        totalAmount: budget.amount,
        spentAmount,
        remainingAmount: budget.amount - spentAmount
      };
    } catch (error) {
      logger.error('Error getting vessel budget:', error);
      return null;
    }
  }

  /**
   * Get the highest criticality level from requisition items
   */
  private getHighestCriticalityLevel(items: Array<{ itemCatalog: { criticalityLevel: CriticalityLevel } }>): CriticalityLevel {
    const criticalityOrder = {
      'SAFETY_CRITICAL': 3,
      'OPERATIONAL_CRITICAL': 2,
      'ROUTINE': 1
    };

    let highest = 'ROUTINE' as CriticalityLevel;
    let highestValue = 1;

    for (const item of items) {
      const value = criticalityOrder[item.itemCatalog.criticalityLevel];
      if (value > highestValue) {
        highest = item.itemCatalog.criticalityLevel;
        highestValue = value;
      }
    }

    return highest;
  }

  /**
   * Get current budget period (simplified)
   */
  private getCurrentBudgetPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    return `${year}-Q${quarter}`;
  }

  /**
   * Create approval records based on workflow decision
   */
  async createApprovalWorkflow(requisitionId: string, decision: ApprovalDecision): Promise<void> {
    if (decision.autoApprove) {
      // Create auto-approval record
      await this.prisma.approval.create({
        data: {
          requisitionId,
          approverId: 'SYSTEM',
          level: 0,
          status: 'APPROVED',
          comments: decision.reason,
          approvedAt: new Date(),
          budgetLimit: decision.budgetLimit,
          costCenter: decision.costCenter
        }
      });
      return;
    }

    if (!decision.requiresApproval) {
      return;
    }

    // Find appropriate approver
    const approver = await this.findApprover(requisitionId, decision);
    
    if (!approver) {
      throw new Error(`No approver found for role ${decision.approverRole}`);
    }

    // Create approval record
    await this.prisma.approval.create({
      data: {
        requisitionId,
        approverId: approver.id,
        level: decision.approverLevel || 1,
        status: 'PENDING',
        comments: decision.reason,
        budgetLimit: decision.budgetLimit,
        costCenter: decision.costCenter
      }
    });

    logger.info(`Created approval workflow for requisition ${requisitionId}, approver: ${approver.email}`);
  }

  /**
   * Find appropriate approver based on role and vessel assignment
   */
  private async findApprover(requisitionId: string, decision: ApprovalDecision): Promise<User | null> {
    const requisition = await this.prisma.requisition.findUnique({
      where: { id: requisitionId },
      include: { vessel: true }
    });

    if (!requisition) {
      throw new Error('Requisition not found');
    }

    // Find users with the required role who have access to the vessel
    const approvers = await this.prisma.user.findMany({
      where: {
        role: decision.approverRole as UserRole,
        isActive: true,
        vessels: {
          some: {
            vesselId: requisition.vesselId,
            isActive: true
          }
        }
      },
      include: {
        vessels: true
      }
    });

    // Return the first available approver (in production, might implement load balancing)
    return approvers[0] || null;
  }

  /**
   * Update workflow configuration
   */
  async updateApprovalThresholds(thresholds: ApprovalThreshold[]): Promise<void> {
    this.approvalThresholds = thresholds;
    logger.info('Updated approval thresholds');
  }

  /**
   * Update emergency bypass rules
   */
  async updateEmergencyBypasses(bypasses: EmergencyBypass[]): Promise<void> {
    this.emergencyBypasses = bypasses;
    logger.info('Updated emergency bypass rules');
  }
}

// Export singleton instance
export const workflowEngine = new WorkflowEngine(new PrismaClient());