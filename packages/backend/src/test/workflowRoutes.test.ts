import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import workflowRoutes from '../routes/workflowRoutes';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';
import { auditLogger } from '../middleware/auditLogger';

// Mock middleware
vi.mock('../middleware/authentication', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'SUPERINTENDENT',
      vessels: [{ id: 'vessel-1' }]
    };
    next();
  })
}));

vi.mock('../middleware/authorization', () => ({
  authorizeRole: vi.fn(() => (req, res, next) => next())
}));

vi.mock('../middleware/vesselAccess', () => ({
  validateVesselAccess: vi.fn((req, res, next) => next())
}));

vi.mock('../middleware/auditLogger', () => ({
  auditLogger: vi.fn((req, res, next) => next())
}));

// Mock Prisma
const mockPrisma = {
  requisition: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  approval: {
    create: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn()
  },
  vessel: {
    findUnique: vi.fn()
  },
  budget: {
    findFirst: vi.fn()
  },
  user: {
    findMany: vi.fn()
  }
} as unknown as PrismaClient;

// Mock WorkflowEngine
vi.mock('../services/workflowEngine', () => ({
  workflowEngine: {
    evaluateRequisition: vi.fn(),
    createApprovalWorkflow: vi.fn(),
    updateApprovalThresholds: vi.fn(),
    updateEmergencyBypasses: vi.fn()
  }
}));

// Mock AuditService
vi.mock('../services/auditService', () => ({
  AuditService: {
    logAction: vi.fn(),
    logWorkflowDecision: vi.fn()
  }
}));

describe('Workflow Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/workflow', workflowRoutes);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/workflow/requisitions/:requisitionId/evaluate', () => {
    it('should evaluate workflow for a requisition', async () => {
      const mockRequisition = {
        id: 'req-1',
        vesselId: 'vessel-1',
        requestedById: 'user-1',
        urgencyLevel: 'ROUTINE',
        totalAmount: 1000,
        currency: 'USD',
        vessel: { id: 'vessel-1', name: 'Test Vessel' },
        requestedBy: { id: 'user-1', role: 'VESSEL_CREW' },
        items: [
          {
            itemCatalog: {
              criticalityLevel: 'ROUTINE',
              category: 'ENGINE_PARTS'
            },
            quantity: 1,
            totalPrice: 1000
          }
        ]
      };

      const mockDecision = {
        requiresApproval: true,
        approverRole: 'SUPERINTENDENT',
        approverLevel: 1,
        reason: 'Amount-based routing',
        budgetHierarchy: 'VESSEL'
      };

      // Mock Prisma calls
      mockPrisma.requisition.findUnique = vi.fn().mockResolvedValue(mockRequisition);
      
      // Mock workflow engine
      const { workflowEngine } = await import('../services/workflowEngine');
      workflowEngine.evaluateRequisition = vi.fn().mockResolvedValue(mockDecision);

      const response = await request(app)
        .get('/api/workflow/requisitions/req-1/evaluate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requisitionId).toBe('req-1');
      expect(response.body.data.decision).toEqual(mockDecision);
      expect(workflowEngine.evaluateRequisition).toHaveBeenCalledWith(mockRequisition);
    });

    it('should return 404 for non-existent requisition', async () => {
      mockPrisma.requisition.findUnique = vi.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/workflow/requisitions/non-existent/evaluate')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Requisition not found');
    });
  });

  describe('POST /api/workflow/requisitions/:requisitionId/process', () => {
    it('should process workflow decision and create approvals', async () => {
      const mockRequisition = {
        id: 'req-1',
        vesselId: 'vessel-1',
        requestedById: 'user-1',
        urgencyLevel: 'ROUTINE',
        totalAmount: 1000,
        currency: 'USD',
        status: 'SUBMITTED',
        vessel: { id: 'vessel-1', name: 'Test Vessel' },
        requestedBy: { id: 'user-1', role: 'VESSEL_CREW' },
        items: [
          {
            itemCatalog: {
              criticalityLevel: 'ROUTINE',
              category: 'ENGINE_PARTS'
            },
            quantity: 1,
            totalPrice: 1000
          }
        ]
      };

      const mockDecision = {
        requiresApproval: true,
        approverRole: 'SUPERINTENDENT',
        approverLevel: 1,
        reason: 'Amount-based routing',
        budgetHierarchy: 'VESSEL',
        autoApprove: false
      };

      // Mock Prisma calls
      mockPrisma.requisition.findUnique = vi.fn().mockResolvedValue(mockRequisition);
      mockPrisma.requisition.update = vi.fn().mockResolvedValue({
        ...mockRequisition,
        status: 'UNDER_REVIEW'
      });

      // Mock workflow engine
      const { workflowEngine } = await import('../services/workflowEngine');
      workflowEngine.evaluateRequisition = vi.fn().mockResolvedValue(mockDecision);
      workflowEngine.createApprovalWorkflow = vi.fn().mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/workflow/requisitions/req-1/process')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.newStatus).toBe('UNDER_REVIEW');
      expect(workflowEngine.createApprovalWorkflow).toHaveBeenCalledWith('req-1', mockDecision);
      expect(mockPrisma.requisition.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: {
          status: 'UNDER_REVIEW',
          emergencyOverride: false
        }
      });
    });

    it('should auto-approve requisitions when decision allows', async () => {
      const mockRequisition = {
        id: 'req-1',
        vesselId: 'vessel-1',
        requestedById: 'user-1',
        urgencyLevel: 'ROUTINE',
        totalAmount: 400,
        currency: 'USD',
        status: 'SUBMITTED',
        vessel: { id: 'vessel-1', name: 'Test Vessel' },
        requestedBy: { id: 'user-1', role: 'VESSEL_CREW' },
        items: [
          {
            itemCatalog: {
              criticalityLevel: 'ROUTINE',
              category: 'ENGINE_PARTS'
            },
            quantity: 1,
            totalPrice: 400
          }
        ]
      };

      const mockDecision = {
        requiresApproval: false,
        autoApprove: true,
        reason: 'Auto-approved: Routine items under $500',
        budgetHierarchy: 'VESSEL'
      };

      // Mock Prisma calls
      mockPrisma.requisition.findUnique = vi.fn().mockResolvedValue(mockRequisition);
      mockPrisma.requisition.update = vi.fn().mockResolvedValue({
        ...mockRequisition,
        status: 'APPROVED'
      });

      // Mock workflow engine
      const { workflowEngine } = await import('../services/workflowEngine');
      workflowEngine.evaluateRequisition = vi.fn().mockResolvedValue(mockDecision);
      workflowEngine.createApprovalWorkflow = vi.fn().mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/workflow/requisitions/req-1/process')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.newStatus).toBe('APPROVED');
      expect(mockPrisma.requisition.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: {
          status: 'APPROVED',
          emergencyOverride: false
        }
      });
    });
  });

  describe('GET /api/workflow/config/approval-thresholds', () => {
    it('should return approval thresholds configuration', async () => {
      const response = await request(app)
        .get('/api/workflow/config/approval-thresholds')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('minAmount');
      expect(response.body.data[0]).toHaveProperty('maxAmount');
      expect(response.body.data[0]).toHaveProperty('requiredRole');
    });
  });

  describe('PUT /api/workflow/config/approval-thresholds', () => {
    it('should update approval thresholds configuration', async () => {
      const newThresholds = [
        {
          minAmount: 0,
          maxAmount: 1000,
          currency: 'USD',
          requiredRole: 'AUTO_APPROVE',
          approverLevel: 0,
          budgetHierarchy: 'VESSEL',
          costCenterRequired: false
        }
      ];

      const { workflowEngine } = await import('../services/workflowEngine');
      workflowEngine.updateApprovalThresholds = vi.fn().mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/workflow/config/approval-thresholds')
        .send({ thresholds: newThresholds })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Approval thresholds updated successfully');
      expect(workflowEngine.updateApprovalThresholds).toHaveBeenCalledWith(newThresholds);
    });

    it('should validate threshold structure', async () => {
      const invalidThresholds = [
        {
          minAmount: 0,
          // Missing required fields
        }
      ];

      const response = await request(app)
        .put('/api/workflow/config/approval-thresholds')
        .send({ thresholds: invalidThresholds })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid threshold structure');
    });

    it('should require thresholds to be an array', async () => {
      const response = await request(app)
        .put('/api/workflow/config/approval-thresholds')
        .send({ thresholds: 'not-an-array' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Thresholds must be an array');
    });
  });

  describe('GET /api/workflow/config/emergency-bypasses', () => {
    it('should return emergency bypass rules', async () => {
      const response = await request(app)
        .get('/api/workflow/config/emergency-bypasses')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('urgencyLevel');
      expect(response.body.data[0]).toHaveProperty('criticalityLevel');
      expect(response.body.data[0]).toHaveProperty('allowedRoles');
    });
  });

  describe('PUT /api/workflow/config/emergency-bypasses', () => {
    it('should update emergency bypass rules', async () => {
      const newBypasses = [
        {
          urgencyLevel: 'EMERGENCY',
          criticalityLevel: 'SAFETY_CRITICAL',
          allowedRoles: ['CAPTAIN'],
          requiresPostApproval: true,
          expirationHours: 24
        }
      ];

      const { workflowEngine } = await import('../services/workflowEngine');
      workflowEngine.updateEmergencyBypasses = vi.fn().mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/workflow/config/emergency-bypasses')
        .send({ bypasses: newBypasses })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Emergency bypasses updated successfully');
      expect(workflowEngine.updateEmergencyBypasses).toHaveBeenCalledWith(newBypasses);
    });
  });

  describe('GET /api/workflow/vessels/:vesselId/budget-hierarchy', () => {
    it('should return budget hierarchy for a vessel', async () => {
      const mockVessel = {
        id: 'vessel-1',
        name: 'Test Vessel',
        budgets: [
          {
            id: 'budget-1',
            amount: 10000,
            currency: 'USD',
            period: '2024-Q1'
          }
        ]
      };

      mockPrisma.vessel.findUnique = vi.fn().mockResolvedValue(mockVessel);

      const response = await request(app)
        .get('/api/workflow/vessels/vessel-1/budget-hierarchy')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('vessel');
      expect(response.body.data).toHaveProperty('fleet');
      expect(response.body.data).toHaveProperty('company');
      expect(response.body.data.vessel.budgets).toEqual(mockVessel.budgets);
    });

    it('should return 404 for non-existent vessel', async () => {
      mockPrisma.vessel.findUnique = vi.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/workflow/vessels/non-existent/budget-hierarchy')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Vessel not found');
    });
  });

  describe('GET /api/workflow/metrics', () => {
    it('should return workflow metrics', async () => {
      const mockApprovalStats = [
        { status: 'APPROVED', _count: { id: 10 } },
        { status: 'PENDING', _count: { id: 5 } },
        { status: 'REJECTED', _count: { id: 2 } }
      ];

      const mockEmergencyStats = [
        { emergencyOverride: true, _count: { id: 3 } },
        { emergencyOverride: false, _count: { id: 14 } }
      ];

      mockPrisma.approval.groupBy = vi.fn().mockResolvedValue(mockApprovalStats);
      mockPrisma.requisition.groupBy = vi.fn().mockResolvedValue(mockEmergencyStats);
      mockPrisma.approval.aggregate = vi.fn().mockResolvedValue({ _avg: {} });

      const response = await request(app)
        .get('/api/workflow/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('approvalStats');
      expect(response.body.data).toHaveProperty('emergencyStats');
      expect(response.body.data.approvalStats).toHaveLength(3);
      expect(response.body.data.emergencyStats).toHaveLength(2);
    });

    it('should filter metrics by date range and vessel', async () => {
      mockPrisma.approval.groupBy = vi.fn().mockResolvedValue([]);
      mockPrisma.requisition.groupBy = vi.fn().mockResolvedValue([]);
      mockPrisma.approval.aggregate = vi.fn().mockResolvedValue({ _avg: {} });

      await request(app)
        .get('/api/workflow/metrics')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          vesselId: 'vessel-1'
        })
        .expect(200);

      expect(mockPrisma.approval.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: {
          requisition: {
            createdAt: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-12-31')
            },
            vesselId: 'vessel-1'
          }
        },
        _count: { id: true }
      });
    });
  });
});