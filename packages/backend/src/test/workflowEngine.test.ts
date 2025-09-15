import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { WorkflowEngine } from '../services/workflowEngine';
import { AuditService } from '../services/auditService';

// Mock Prisma
const mockPrisma = {
  requisition: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  approval: {
    create: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn()
  },
  budget: {
    findFirst: vi.fn()
  },
  user: {
    findMany: vi.fn()
  }
} as unknown as PrismaClient;

// Mock AuditService
vi.mock('../services/auditService', () => ({
  AuditService: {
    logWorkflowDecision: vi.fn()
  }
}));

describe('WorkflowEngine', () => {
  let workflowEngine: WorkflowEngine;

  beforeEach(() => {
    workflowEngine = new WorkflowEngine(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('evaluateRequisition', () => {
    const mockRequisition = {
      id: 'req-1',
      vesselId: 'vessel-1',
      requestedById: 'user-1',
      urgencyLevel: 'ROUTINE' as const,
      totalAmount: 1000,
      currency: 'USD',
      vessel: {
        id: 'vessel-1',
        name: 'Test Vessel'
      },
      requestedBy: {
        id: 'user-1',
        role: 'VESSEL_CREW' as const
      },
      items: [
        {
          itemCatalog: {
            criticalityLevel: 'ROUTINE' as const,
            category: 'ENGINE_PARTS'
          },
          quantity: 2,
          totalPrice: 1000
        }
      ]
    };

    it('should auto-approve routine items under $500', async () => {
      const requisition = {
        ...mockRequisition,
        totalAmount: 400
      };

      const decision = await workflowEngine.evaluateRequisition(requisition);

      expect(decision.autoApprove).toBe(true);
      expect(decision.requiresApproval).toBe(false);
      expect(decision.reason).toContain('Auto-approved: Routine items under $500');
      expect(AuditService.logWorkflowDecision).toHaveBeenCalledWith(
        'user-1',
        'req-1',
        decision
      );
    });

    it('should require superintendent approval for $500-$5000', async () => {
      const requisition = {
        ...mockRequisition,
        totalAmount: 2000
      };

      const decision = await workflowEngine.evaluateRequisition(requisition);

      expect(decision.requiresApproval).toBe(true);
      expect(decision.approverRole).toBe('SUPERINTENDENT');
      expect(decision.approverLevel).toBe(1);
      expect(decision.budgetHierarchy).toBe('VESSEL');
    });

    it('should require procurement manager approval for $5000-$25000', async () => {
      const requisition = {
        ...mockRequisition,
        totalAmount: 10000
      };

      const decision = await workflowEngine.evaluateRequisition(requisition);

      expect(decision.requiresApproval).toBe(true);
      expect(decision.approverRole).toBe('PROCUREMENT_MANAGER');
      expect(decision.approverLevel).toBe(2);
      expect(decision.budgetHierarchy).toBe('FLEET');
    });

    it('should require finance team approval for amounts over $25000', async () => {
      const requisition = {
        ...mockRequisition,
        totalAmount: 50000
      };

      const decision = await workflowEngine.evaluateRequisition(requisition);

      expect(decision.requiresApproval).toBe(true);
      expect(decision.approverRole).toBe('FINANCE_TEAM');
      expect(decision.approverLevel).toBe(3);
      expect(decision.budgetHierarchy).toBe('COMPANY');
    });

    it('should allow emergency bypass for safety critical items', async () => {
      const requisition = {
        ...mockRequisition,
        urgencyLevel: 'EMERGENCY' as const,
        requestedBy: {
          id: 'user-1',
          role: 'CAPTAIN' as const
        },
        items: [
          {
            itemCatalog: {
              criticalityLevel: 'SAFETY_CRITICAL' as const,
              category: 'SAFETY_GEAR'
            },
            quantity: 1,
            totalPrice: 1000
          }
        ]
      };

      const decision = await workflowEngine.evaluateRequisition(requisition);

      expect(decision.emergencyBypass).toBe(true);
      expect(decision.autoApprove).toBe(true);
      expect(decision.requiresApproval).toBe(false);
      expect(decision.reason).toContain('Emergency bypass');
    });

    it('should deny emergency bypass for unauthorized roles', async () => {
      const requisition = {
        ...mockRequisition,
        urgencyLevel: 'EMERGENCY' as const,
        requestedBy: {
          id: 'user-1',
          role: 'VESSEL_CREW' as const
        },
        items: [
          {
            itemCatalog: {
              criticalityLevel: 'SAFETY_CRITICAL' as const,
              category: 'SAFETY_GEAR'
            },
            quantity: 1,
            totalPrice: 1000
          }
        ]
      };

      const decision = await workflowEngine.evaluateRequisition(requisition);

      expect(decision.emergencyBypass).toBeFalsy();
      expect(decision.requiresApproval).toBe(true);
    });

    it('should apply urgency-based escalation for urgent items', async () => {
      const requisition = {
        ...mockRequisition,
        urgencyLevel: 'URGENT' as const,
        totalAmount: 2000
      };

      const decision = await workflowEngine.evaluateRequisition(requisition);

      expect(decision.escalationDelay).toBe(2); // 2 hours for urgent
      expect(decision.reason).toContain('Expedited for URGENT');
    });

    it('should escalate to fleet level when vessel budget exceeded', async () => {
      // Mock vessel budget that would be exceeded
      mockPrisma.budget.findFirst = vi.fn().mockResolvedValue({
        amount: 5000,
        currency: 'USD'
      });

      const requisition = {
        ...mockRequisition,
        totalAmount: 6000 // Exceeds vessel budget
      };

      const decision = await workflowEngine.evaluateRequisition(requisition);

      expect(decision.budgetHierarchy).toBe('FLEET');
      expect(decision.approverRole).toBe('PROCUREMENT_MANAGER');
      expect(decision.reason).toContain('Escalated to FLEET');
    });
  });

  describe('createApprovalWorkflow', () => {
    it('should create auto-approval record for auto-approved requisitions', async () => {
      const decision = {
        requiresApproval: false,
        autoApprove: true,
        reason: 'Auto-approved',
        budgetHierarchy: 'VESSEL' as const
      };

      mockPrisma.approval.create = vi.fn().mockResolvedValue({
        id: 'approval-1'
      });

      await workflowEngine.createApprovalWorkflow('req-1', decision);

      expect(mockPrisma.approval.create).toHaveBeenCalledWith({
        data: {
          requisitionId: 'req-1',
          approverId: 'SYSTEM',
          level: 0,
          status: 'APPROVED',
          comments: 'Auto-approved',
          approvedAt: expect.any(Date),
          budgetLimit: undefined,
          costCenter: undefined
        }
      });
    });

    it('should create pending approval record for manual approval', async () => {
      const decision = {
        requiresApproval: true,
        approverRole: 'SUPERINTENDENT',
        approverLevel: 1,
        budgetLimit: 5000,
        costCenter: 'REQUIRED',
        reason: 'Manual approval required',
        budgetHierarchy: 'VESSEL' as const
      };

      // Mock finding requisition
      mockPrisma.requisition.findUnique = vi.fn().mockResolvedValue({
        id: 'req-1',
        vesselId: 'vessel-1',
        vessel: { id: 'vessel-1' }
      });

      // Mock finding approver
      mockPrisma.user.findMany = vi.fn().mockResolvedValue([
        {
          id: 'approver-1',
          email: 'superintendent@example.com',
          role: 'SUPERINTENDENT'
        }
      ]);

      mockPrisma.approval.create = vi.fn().mockResolvedValue({
        id: 'approval-1'
      });

      await workflowEngine.createApprovalWorkflow('req-1', decision);

      expect(mockPrisma.approval.create).toHaveBeenCalledWith({
        data: {
          requisitionId: 'req-1',
          approverId: 'approver-1',
          level: 1,
          status: 'PENDING',
          comments: 'Manual approval required',
          budgetLimit: 5000,
          costCenter: 'REQUIRED'
        }
      });
    });

    it('should throw error when no approver found', async () => {
      const decision = {
        requiresApproval: true,
        approverRole: 'SUPERINTENDENT',
        approverLevel: 1,
        reason: 'Manual approval required',
        budgetHierarchy: 'VESSEL' as const
      };

      // Mock finding requisition
      mockPrisma.requisition.findUnique = vi.fn().mockResolvedValue({
        id: 'req-1',
        vesselId: 'vessel-1',
        vessel: { id: 'vessel-1' }
      });

      // Mock no approvers found
      mockPrisma.user.findMany = vi.fn().mockResolvedValue([]);

      await expect(
        workflowEngine.createApprovalWorkflow('req-1', decision)
      ).rejects.toThrow('No approver found for role SUPERINTENDENT');
    });
  });

  describe('updateApprovalThresholds', () => {
    it('should update approval thresholds configuration', async () => {
      const newThresholds = [
        {
          minAmount: 0,
          maxAmount: 1000,
          currency: 'USD',
          requiredRole: 'AUTO_APPROVE',
          approverLevel: 0,
          budgetHierarchy: 'VESSEL' as const,
          costCenterRequired: false
        }
      ];

      await workflowEngine.updateApprovalThresholds(newThresholds);

      // Verify the thresholds were updated by testing evaluation
      const requisition = {
        id: 'req-1',
        vesselId: 'vessel-1',
        requestedById: 'user-1',
        urgencyLevel: 'ROUTINE' as const,
        totalAmount: 800, // Should now be auto-approved with new threshold
        currency: 'USD',
        vessel: { id: 'vessel-1', name: 'Test Vessel' },
        requestedBy: { id: 'user-1', role: 'VESSEL_CREW' as const },
        items: [
          {
            itemCatalog: {
              criticalityLevel: 'ROUTINE' as const,
              category: 'ENGINE_PARTS'
            },
            quantity: 1,
            totalPrice: 800
          }
        ]
      };

      const decision = await workflowEngine.evaluateRequisition(requisition);
      expect(decision.autoApprove).toBe(true);
    });
  });

  describe('updateEmergencyBypasses', () => {
    it('should update emergency bypass rules', async () => {
      const newBypasses = [
        {
          urgencyLevel: 'EMERGENCY' as const,
          criticalityLevel: 'ROUTINE' as const,
          allowedRoles: ['VESSEL_CREW'],
          requiresPostApproval: true,
          expirationHours: 1
        }
      ];

      await workflowEngine.updateEmergencyBypasses(newBypasses);

      // Test that the new bypass rule works
      const requisition = {
        id: 'req-1',
        vesselId: 'vessel-1',
        requestedById: 'user-1',
        urgencyLevel: 'EMERGENCY' as const,
        totalAmount: 1000,
        currency: 'USD',
        vessel: { id: 'vessel-1', name: 'Test Vessel' },
        requestedBy: { id: 'user-1', role: 'VESSEL_CREW' as const },
        items: [
          {
            itemCatalog: {
              criticalityLevel: 'ROUTINE' as const,
              category: 'ENGINE_PARTS'
            },
            quantity: 1,
            totalPrice: 1000
          }
        ]
      };

      const decision = await workflowEngine.evaluateRequisition(requisition);
      expect(decision.emergencyBypass).toBe(true);
    });
  });
});