import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WorkflowEngine } from '@/services/workflowEngine';
import { UrgencyLevel, RequisitionStatus } from '@prisma/client';

// Mock dependencies
vi.mock('@/services/auditService');
vi.mock('@/services/emailService');
vi.mock('@/utils/logger');

describe('WorkflowEngine Comprehensive Tests', () => {
  let workflowEngine: WorkflowEngine;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      requisition: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      approval: {
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      vessel: {
        findUnique: vi.fn(),
      },
      workflowRule: {
        findMany: vi.fn(),
      },
    };

    workflowEngine = new WorkflowEngine(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Approval Workflow Routing', () => {
    it('should auto-approve routine items under $500', async () => {
      const requisition = {
        id: 'req123',
        totalAmount: 450,
        currency: 'USD',
        urgencyLevel: UrgencyLevel.ROUTINE,
        vesselId: 'vessel1',
        requestedById: 'crew1',
        status: RequisitionStatus.PENDING_APPROVAL,
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(requisition);
      mockPrisma.workflowRule.findMany.mockResolvedValue([
        {
          id: 'rule1',
          condition: 'amount < 500 AND urgency = ROUTINE',
          action: 'AUTO_APPROVE',
          priority: 1,
        },
      ]);

      const result = await workflowEngine.processRequisition('req123');

      expect(result.approved).toBe(true);
      expect(result.autoApproved).toBe(true);
      expect(result.approvalLevel).toBe('AUTO');
      expect(mockPrisma.requisition.update).toHaveBeenCalledWith({
        where: { id: 'req123' },
        data: { status: RequisitionStatus.APPROVED },
      });
    });

    it('should route to superintendent for $500-$5000 items', async () => {
      const requisition = {
        id: 'req124',
        totalAmount: 2500,
        currency: 'USD',
        urgencyLevel: UrgencyLevel.ROUTINE,
        vesselId: 'vessel1',
        requestedById: 'crew1',
        status: RequisitionStatus.PENDING_APPROVAL,
      };

      const mockSuperintendent = {
        id: 'super1',
        role: 'SUPERINTENDENT',
        vessels: [{ id: 'vessel1' }],
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(requisition);
      mockPrisma.user.findMany.mockResolvedValue([mockSuperintendent]);
      mockPrisma.approval.create.mockResolvedValue({
        id: 'approval1',
        requisitionId: 'req124',
        approverId: 'super1',
        level: 'SUPERINTENDENT',
      });

      const result = await workflowEngine.processRequisition('req124');

      expect(result.approved).toBe(false);
      expect(result.pendingApproval).toBe(true);
      expect(result.approvalLevel).toBe('SUPERINTENDENT');
      expect(result.assignedTo).toBe('super1');
    });

    it('should route to procurement manager for $5000-$25000 items', async () => {
      const requisition = {
        id: 'req125',
        totalAmount: 15000,
        currency: 'USD',
        urgencyLevel: UrgencyLevel.ROUTINE,
        vesselId: 'vessel1',
        requestedById: 'crew1',
        status: RequisitionStatus.PENDING_APPROVAL,
      };

      const mockProcurementManager = {
        id: 'pm1',
        role: 'PROCUREMENT_MANAGER',
        vessels: [],
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(requisition);
      mockPrisma.user.findMany.mockResolvedValue([mockProcurementManager]);
      mockPrisma.approval.create.mockResolvedValue({
        id: 'approval2',
        requisitionId: 'req125',
        approverId: 'pm1',
        level: 'PROCUREMENT_MANAGER',
      });

      const result = await workflowEngine.processRequisition('req125');

      expect(result.approved).toBe(false);
      expect(result.pendingApproval).toBe(true);
      expect(result.approvalLevel).toBe('PROCUREMENT_MANAGER');
      expect(result.assignedTo).toBe('pm1');
    });

    it('should require senior management approval for items over $25000', async () => {
      const requisition = {
        id: 'req126',
        totalAmount: 50000,
        currency: 'USD',
        urgencyLevel: UrgencyLevel.ROUTINE,
        vesselId: 'vessel1',
        requestedById: 'crew1',
        status: RequisitionStatus.PENDING_APPROVAL,
      };

      const mockSeniorManager = {
        id: 'sm1',
        role: 'SENIOR_MANAGEMENT',
        vessels: [],
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(requisition);
      mockPrisma.user.findMany.mockResolvedValue([mockSeniorManager]);
      mockPrisma.approval.create.mockResolvedValue({
        id: 'approval3',
        requisitionId: 'req126',
        approverId: 'sm1',
        level: 'SENIOR_MANAGEMENT',
      });

      const result = await workflowEngine.processRequisition('req126');

      expect(result.approved).toBe(false);
      expect(result.pendingApproval).toBe(true);
      expect(result.approvalLevel).toBe('SENIOR_MANAGEMENT');
      expect(result.assignedTo).toBe('sm1');
    });
  });

  describe('Emergency Workflow Handling', () => {
    it('should handle emergency requisitions with captain override', async () => {
      const requisition = {
        id: 'req127',
        totalAmount: 10000,
        currency: 'USD',
        urgencyLevel: UrgencyLevel.EMERGENCY,
        vesselId: 'vessel1',
        requestedById: 'crew1',
        status: RequisitionStatus.PENDING_APPROVAL,
        justification: 'Engine failure - safety critical',
      };

      const emergencyOverride = {
        captainId: 'captain1',
        reason: 'Safety critical equipment failure',
        vesselId: 'vessel1',
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(requisition);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'captain1',
        role: 'CAPTAIN',
        vessels: [{ id: 'vessel1' }],
      });

      const result = await workflowEngine.processEmergencyOverride('req127', emergencyOverride);

      expect(result.approved).toBe(true);
      expect(result.emergencyOverride).toBe(true);
      expect(result.requiresPostApproval).toBe(true);
      expect(result.overriddenBy).toBe('captain1');
    });

    it('should reject emergency override from unauthorized personnel', async () => {
      const requisition = {
        id: 'req128',
        totalAmount: 10000,
        currency: 'USD',
        urgencyLevel: UrgencyLevel.EMERGENCY,
        vesselId: 'vessel1',
        requestedById: 'crew1',
        status: RequisitionStatus.PENDING_APPROVAL,
      };

      const invalidOverride = {
        captainId: 'crew2',
        reason: 'Trying to override',
        vesselId: 'vessel1',
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(requisition);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'crew2',
        role: 'CREW',
        vessels: [{ id: 'vessel1' }],
      });

      await expect(
        workflowEngine.processEmergencyOverride('req128', invalidOverride)
      ).rejects.toThrow('Only captains can perform emergency overrides');
    });

    it('should handle urgent requisitions with expedited approval', async () => {
      const requisition = {
        id: 'req129',
        totalAmount: 3000,
        currency: 'USD',
        urgencyLevel: UrgencyLevel.URGENT,
        vesselId: 'vessel1',
        requestedById: 'crew1',
        status: RequisitionStatus.PENDING_APPROVAL,
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(requisition);
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'super1',
          role: 'SUPERINTENDENT',
          vessels: [{ id: 'vessel1' }],
        },
      ]);

      const result = await workflowEngine.processRequisition('req129');

      expect(result.expedited).toBe(true);
      expect(result.approvalLevel).toBe('SUPERINTENDENT');
      expect(result.escalationTime).toBeLessThan(24); // Hours
    });
  });

  describe('Delegation Handling', () => {
    it('should handle approval delegation during crew rotation', async () => {
      const requisition = {
        id: 'req130',
        totalAmount: 2000,
        currency: 'USD',
        urgencyLevel: UrgencyLevel.ROUTINE,
        vesselId: 'vessel1',
        requestedById: 'crew1',
        status: RequisitionStatus.PENDING_APPROVAL,
      };

      const delegation = {
        fromUserId: 'super1',
        toUserId: 'super2',
        vesselId: 'vessel1',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        reason: 'Crew rotation',
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(requisition);
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'super2',
          role: 'SUPERINTENDENT',
          vessels: [{ id: 'vessel1' }],
        },
      ]);

      const result = await workflowEngine.processRequisitionWithDelegation('req130', delegation);

      expect(result.delegated).toBe(true);
      expect(result.assignedTo).toBe('super2');
      expect(result.delegationReason).toBe('Crew rotation');
    });

    it('should maintain approval continuity during delegation', async () => {
      const requisition = {
        id: 'req131',
        totalAmount: 1500,
        currency: 'USD',
        urgencyLevel: UrgencyLevel.ROUTINE,
        vesselId: 'vessel1',
        requestedById: 'crew1',
        status: RequisitionStatus.PENDING_APPROVAL,
      };

      const existingApproval = {
        id: 'approval4',
        requisitionId: 'req131',
        approverId: 'super1',
        level: 'SUPERINTENDENT',
        status: 'PENDING',
        delegatedTo: 'super2',
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(requisition);
      mockPrisma.approval.findMany.mockResolvedValue([existingApproval]);

      const result = await workflowEngine.checkApprovalContinuity('req131');

      expect(result.continuityMaintained).toBe(true);
      expect(result.currentApprover).toBe('super2');
      expect(result.originalApprover).toBe('super1');
    });
  });

  describe('Budget Hierarchy Validation', () => {
    it('should validate vessel budget limits', async () => {
      const requisition = {
        id: 'req132',
        totalAmount: 8000,
        currency: 'USD',
        urgencyLevel: UrgencyLevel.ROUTINE,
        vesselId: 'vessel1',
        requestedById: 'crew1',
        status: RequisitionStatus.PENDING_APPROVAL,
      };

      const vesselBudget = {
        id: 'budget1',
        vesselId: 'vessel1',
        monthlyLimit: 10000,
        currentSpent: 3000,
        currency: 'USD',
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(requisition);
      mockPrisma.vessel.findUnique.mockResolvedValue({
        id: 'vessel1',
        budget: vesselBudget,
      });

      const result = await workflowEngine.validateBudgetHierarchy('req132');

      expect(result.withinBudget).toBe(true);
      expect(result.remainingBudget).toBe(7000);
      expect(result.budgetLevel).toBe('VESSEL');
    });

    it('should escalate to fleet budget when vessel budget exceeded', async () => {
      const requisition = {
        id: 'req133',
        totalAmount: 12000,
        currency: 'USD',
        urgencyLevel: UrgencyLevel.ROUTINE,
        vesselId: 'vessel1',
        requestedById: 'crew1',
        status: RequisitionStatus.PENDING_APPROVAL,
      };

      const vesselBudget = {
        id: 'budget1',
        vesselId: 'vessel1',
        monthlyLimit: 10000,
        currentSpent: 3000,
        currency: 'USD',
      };

      const fleetBudget = {
        id: 'budget2',
        fleetId: 'fleet1',
        monthlyLimit: 100000,
        currentSpent: 25000,
        currency: 'USD',
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(requisition);
      mockPrisma.vessel.findUnique.mockResolvedValue({
        id: 'vessel1',
        budget: vesselBudget,
        fleet: { budget: fleetBudget },
      });

      const result = await workflowEngine.validateBudgetHierarchy('req133');

      expect(result.withinBudget).toBe(true);
      expect(result.budgetLevel).toBe('FLEET');
      expect(result.escalated).toBe(true);
      expect(result.escalationReason).toBe('Vessel budget exceeded');
    });

    it('should apply seasonal budget adjustments', async () => {
      const requisition = {
        id: 'req134',
        totalAmount: 15000,
        currency: 'USD',
        urgencyLevel: UrgencyLevel.ROUTINE,
        vesselId: 'vessel1',
        requestedById: 'crew1',
        status: RequisitionStatus.PENDING_APPROVAL,
      };

      // Mock winter season (higher maintenance budget)
      const currentDate = new Date('2024-01-15'); // January
      vi.setSystemTime(currentDate);

      const vesselBudget = {
        id: 'budget1',
        vesselId: 'vessel1',
        monthlyLimit: 10000,
        currentSpent: 2000,
        currency: 'USD',
        seasonalAdjustments: {
          winter: 1.5, // 50% increase for winter
          summer: 1.0,
          spring: 1.2,
          autumn: 1.1,
        },
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(requisition);
      mockPrisma.vessel.findUnique.mockResolvedValue({
        id: 'vessel1',
        budget: vesselBudget,
      });

      const result = await workflowEngine.validateBudgetHierarchy('req134');

      expect(result.withinBudget).toBe(true);
      expect(result.adjustedLimit).toBe(15000); // 10000 * 1.5
      expect(result.seasonalAdjustment).toBe(1.5);
      expect(result.season).toBe('winter');
    });
  });

  describe('Escalation Procedures', () => {
    it('should escalate overdue approvals', async () => {
      const overdueApproval = {
        id: 'approval5',
        requisitionId: 'req135',
        approverId: 'super1',
        level: 'SUPERINTENDENT',
        status: 'PENDING',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
        escalationDeadline: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      };

      mockPrisma.approval.findMany.mockResolvedValue([overdueApproval]);
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'pm1',
          role: 'PROCUREMENT_MANAGER',
          vessels: [],
        },
      ]);

      const result = await workflowEngine.processEscalation();

      expect(result.escalatedApprovals).toHaveLength(1);
      expect(result.escalatedApprovals[0].newApprover).toBe('pm1');
      expect(result.escalatedApprovals[0].escalationReason).toBe('Approval overdue');
    });

    it('should send escalation notifications', async () => {
      const escalationData = {
        approvalId: 'approval6',
        originalApprover: 'super1',
        newApprover: 'pm1',
        requisitionId: 'req136',
        reason: 'Approval overdue',
      };

      const mockEmailService = vi.mocked(require('@/services/emailService'));
      mockEmailService.sendEscalationNotification = vi.fn().mockResolvedValue(true);

      const result = await workflowEngine.sendEscalationNotification(escalationData);

      expect(result.notificationSent).toBe(true);
      expect(mockEmailService.sendEscalationNotification).toHaveBeenCalledWith({
        to: 'pm1',
        originalApprover: 'super1',
        requisitionId: 'req136',
        reason: 'Approval overdue',
      });
    });
  });

  describe('Maritime-Specific Workflow Rules', () => {
    it('should handle safety-critical item workflows', async () => {
      const requisition = {
        id: 'req137',
        totalAmount: 5000,
        currency: 'USD',
        urgencyLevel: UrgencyLevel.URGENT,
        vesselId: 'vessel1',
        requestedById: 'crew1',
        status: RequisitionStatus.PENDING_APPROVAL,
        items: [
          {
            id: 'item1',
            criticalityLevel: 'SAFETY_CRITICAL',
            impaCode: '593.21.01',
            name: 'Life Jacket',
          },
        ],
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(requisition);

      const result = await workflowEngine.processSafetyCriticalRequisition('req137');

      expect(result.expedited).toBe(true);
      expect(result.safetyCritical).toBe(true);
      expect(result.approvalLevel).toBe('CAPTAIN');
      expect(result.complianceFlags).toContain('SOLAS');
    });

    it('should validate port delivery requirements', async () => {
      const requisition = {
        id: 'req138',
        totalAmount: 3000,
        currency: 'USD',
        urgencyLevel: UrgencyLevel.ROUTINE,
        vesselId: 'vessel1',
        requestedById: 'crew1',
        status: RequisitionStatus.PENDING_APPROVAL,
        deliveryLocation: 'Port of Singapore',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      const vesselPosition = {
        latitude: 1.2966,
        longitude: 103.7764,
        lastUpdate: new Date(),
        currentPort: 'Port of Singapore',
        eta: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
      };

      mockPrisma.requisition.findUnique.mockResolvedValue(requisition);
      mockPrisma.vessel.findUnique.mockResolvedValue({
        id: 'vessel1',
        currentPosition: vesselPosition,
      });

      const result = await workflowEngine.validatePortDelivery('req138');

      expect(result.deliveryFeasible).toBe(true);
      expect(result.portMatch).toBe(true);
      expect(result.timeWindow).toBe(2); // Days between ETA and delivery
    });
  });
});