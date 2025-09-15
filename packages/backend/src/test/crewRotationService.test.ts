import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { crewRotationService } from '../services/crewRotationService.js';
import { auditService } from '../services/auditService.js';

// Mock Prisma
vi.mock('@prisma/client');
vi.mock('../services/auditService.js');

const mockPrisma = {
  vesselAssignment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  delegation: {
    create: vi.fn(),
  },
  approval: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
} as any;

vi.mocked(PrismaClient).mockImplementation(() => mockPrisma);

const mockAuditService = vi.mocked(auditService);

describe('CrewRotationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('assignCrewToVessel', () => {
    it('should assign crew member to vessel successfully', async () => {
      const assignmentData = {
        userId: 'user-1',
        vesselId: 'vessel-1',
        startDate: new Date('2024-01-01'),
        isActive: true,
      };

      const mockAssignment = {
        id: 'assignment-1',
        ...assignmentData,
        user: {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          role: 'CAPTAIN',
          email: 'john@example.com',
        },
        vessel: {
          id: 'vessel-1',
          name: 'Test Vessel',
          imoNumber: '1234567',
        },
      };

      mockPrisma.vesselAssignment.findFirst.mockResolvedValue(null); // No existing assignment
      mockPrisma.vesselAssignment.create.mockResolvedValue(mockAssignment);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await crewRotationService.assignCrewToVessel(assignmentData, 'admin-1');

      expect(mockPrisma.vesselAssignment.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          vesselId: 'vessel-1',
          isActive: true,
        },
      });

      expect(mockPrisma.vesselAssignment.create).toHaveBeenCalledWith({
        data: assignmentData,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
              email: true,
            },
          },
          vessel: {
            select: {
              id: true,
              name: true,
              imoNumber: true,
            },
          },
        },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId: 'admin-1',
        action: 'CREATE',
        resource: 'vessel_assignment',
        resourceId: 'assignment-1',
        newValues: assignmentData,
        vesselId: 'vessel-1',
      });

      expect(result).toEqual(mockAssignment);
    });

    it('should throw error if user already has active assignment', async () => {
      const assignmentData = {
        userId: 'user-1',
        vesselId: 'vessel-1',
        startDate: new Date('2024-01-01'),
        isActive: true,
      };

      const existingAssignment = {
        id: 'existing-assignment',
        userId: 'user-1',
        vesselId: 'vessel-1',
        isActive: true,
      };

      mockPrisma.vesselAssignment.findFirst.mockResolvedValue(existingAssignment);

      await expect(
        crewRotationService.assignCrewToVessel(assignmentData, 'admin-1')
      ).rejects.toThrow('User already has an active assignment to this vessel');
    });
  });

  describe('endCrewAssignment', () => {
    it('should end crew assignment successfully', async () => {
      const assignmentId = 'assignment-1';
      const endDate = new Date('2024-06-30');

      const existingAssignment = {
        id: assignmentId,
        userId: 'user-1',
        vesselId: 'vessel-1',
        isActive: true,
        user: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
        vessel: { id: 'vessel-1', name: 'Test Vessel' },
      };

      const updatedAssignment = {
        ...existingAssignment,
        endDate,
        isActive: false,
        user: {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          role: 'CAPTAIN',
          email: 'john@example.com',
        },
        vessel: {
          id: 'vessel-1',
          name: 'Test Vessel',
          imoNumber: '1234567',
        },
      };

      mockPrisma.vesselAssignment.findUnique.mockResolvedValue(existingAssignment);
      mockPrisma.vesselAssignment.update.mockResolvedValue(updatedAssignment);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await crewRotationService.endCrewAssignment(assignmentId, endDate, 'admin-1');

      expect(mockPrisma.vesselAssignment.update).toHaveBeenCalledWith({
        where: { id: assignmentId },
        data: {
          endDate,
          isActive: false,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
              email: true,
            },
          },
          vessel: {
            select: {
              id: true,
              name: true,
              imoNumber: true,
            },
          },
        },
      });

      expect(result).toEqual(updatedAssignment);
    });

    it('should throw error for non-existent assignment', async () => {
      mockPrisma.vesselAssignment.findUnique.mockResolvedValue(null);

      await expect(
        crewRotationService.endCrewAssignment('non-existent', new Date(), 'admin-1')
      ).rejects.toThrow('Assignment not found');
    });

    it('should throw error for already inactive assignment', async () => {
      const existingAssignment = {
        id: 'assignment-1',
        isActive: false,
      };

      mockPrisma.vesselAssignment.findUnique.mockResolvedValue(existingAssignment);

      await expect(
        crewRotationService.endCrewAssignment('assignment-1', new Date(), 'admin-1')
      ).rejects.toThrow('Assignment is already inactive');
    });
  });

  describe('processCrewRotation', () => {
    it('should process crew rotation successfully', async () => {
      const rotationData = {
        vesselId: 'vessel-1',
        outgoingUserId: 'user-1',
        incomingUserId: 'user-2',
        rotationDate: new Date('2024-07-01'),
        transferResponsibilities: true,
        notes: 'Standard rotation',
      };

      const outgoingAssignment = {
        id: 'assignment-1',
        userId: 'user-1',
        vesselId: 'vessel-1',
        endDate: rotationData.rotationDate,
        isActive: false,
        user: {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          role: 'CAPTAIN',
          email: 'john@example.com',
        },
        vessel: {
          id: 'vessel-1',
          name: 'Test Vessel',
          imoNumber: '1234567',
        },
      };

      const incomingAssignment = {
        id: 'assignment-2',
        userId: 'user-2',
        vesselId: 'vessel-1',
        startDate: rotationData.rotationDate,
        isActive: true,
        user: {
          id: 'user-2',
          firstName: 'Jane',
          lastName: 'Smith',
          role: 'CAPTAIN',
          email: 'jane@example.com',
        },
        vessel: {
          id: 'vessel-1',
          name: 'Test Vessel',
          imoNumber: '1234567',
        },
      };

      const outgoingUser = {
        id: 'user-1',
        permissions: [
          {
            permission: { name: 'requisition:approve' },
          },
          {
            permission: { name: 'vessel:manage' },
          },
        ],
      };

      const delegation = {
        id: 'delegation-1',
        delegatorId: 'user-1',
        delegateId: 'user-2',
        vesselId: 'vessel-1',
        permissions: ['requisition:approve', 'vessel:manage'],
        reason: 'Crew rotation - Standard rotation',
        startDate: rotationData.rotationDate,
        endDate: new Date(rotationData.rotationDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      };

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          vesselAssignment: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn().mockResolvedValue(incomingAssignment),
            findFirst: vi.fn().mockResolvedValue(outgoingAssignment),
          },
          user: {
            findUnique: vi.fn().mockResolvedValue(outgoingUser),
          },
          delegation: {
            create: vi.fn().mockResolvedValue(delegation),
          },
        };
        return callback(mockTx);
      });

      mockAuditService.log.mockResolvedValue(undefined);

      const result = await crewRotationService.processCrewRotation(rotationData, 'admin-1');

      expect(result).toEqual({
        outgoingAssignment,
        incomingAssignment,
        delegation,
      });
    });

    it('should throw error if no active assignment found for outgoing crew', async () => {
      const rotationData = {
        vesselId: 'vessel-1',
        outgoingUserId: 'user-1',
        incomingUserId: 'user-2',
        rotationDate: new Date('2024-07-01'),
        transferResponsibilities: false,
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          vesselAssignment: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        };
        return callback(mockTx);
      });

      await expect(
        crewRotationService.processCrewRotation(rotationData, 'admin-1')
      ).rejects.toThrow('No active assignment found for outgoing crew member');
    });
  });

  describe('getVesselCrewComplement', () => {
    it('should return crew complement for vessel', async () => {
      const vesselId = 'vessel-1';
      const assignments = [
        {
          id: 'assignment-1',
          vesselId,
          user: {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            role: 'CAPTAIN',
            email: 'john@example.com',
          },
        },
        {
          id: 'assignment-2',
          vesselId,
          user: {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            role: 'CHIEF_ENGINEER',
            email: 'jane@example.com',
          },
        },
        {
          id: 'assignment-3',
          vesselId,
          user: {
            id: 'user-3',
            firstName: 'Bob',
            lastName: 'Wilson',
            role: 'VESSEL_CREW',
            email: 'bob@example.com',
          },
        },
      ];

      mockPrisma.vesselAssignment.findMany.mockResolvedValue(assignments);

      const result = await crewRotationService.getVesselCrewComplement(vesselId);

      expect(mockPrisma.vesselAssignment.findMany).toHaveBeenCalledWith({
        where: {
          vesselId,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
              email: true,
            },
          },
        },
        orderBy: {
          user: {
            role: 'asc',
          },
        },
      });

      expect(result).toHaveLength(3); // CAPTAIN, CHIEF_ENGINEER, VESSEL_CREW
      expect(result.find(c => c.role === 'CAPTAIN')).toEqual({
        vesselId,
        role: 'CAPTAIN',
        currentCount: 1,
        requiredCount: 1,
        assignments: [assignments[0]],
      });
    });
  });

  describe('checkRotationConflicts', () => {
    it('should detect conflicts when incoming user has active assignment', async () => {
      const rotationData = {
        vesselId: 'vessel-1',
        outgoingUserId: 'user-1',
        incomingUserId: 'user-2',
        rotationDate: new Date('2024-07-01'),
        transferResponsibilities: true,
      };

      const existingAssignment = {
        id: 'assignment-1',
        userId: 'user-2',
        isActive: true,
        vessel: {
          name: 'Another Vessel',
          imoNumber: '7654321',
        },
      };

      mockPrisma.vesselAssignment.findFirst.mockResolvedValue(existingAssignment);
      mockPrisma.approval.count.mockResolvedValue(0);

      const result = await crewRotationService.checkRotationConflicts(rotationData);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toContain(
        'Incoming crew member is already assigned to vessel Another Vessel (7654321)'
      );
    });

    it('should detect conflicts when outgoing user has pending approvals', async () => {
      const rotationData = {
        vesselId: 'vessel-1',
        outgoingUserId: 'user-1',
        incomingUserId: 'user-2',
        rotationDate: new Date('2024-07-01'),
        transferResponsibilities: false,
      };

      mockPrisma.vesselAssignment.findFirst.mockResolvedValue(null);
      mockPrisma.approval.count.mockResolvedValue(3);

      const result = await crewRotationService.checkRotationConflicts(rotationData);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toContain(
        'Outgoing crew member has 3 pending approvals that need to be transferred'
      );
    });

    it('should return no conflicts when rotation is valid', async () => {
      const rotationData = {
        vesselId: 'vessel-1',
        outgoingUserId: 'user-1',
        incomingUserId: 'user-2',
        rotationDate: new Date('2024-07-01'),
        transferResponsibilities: true,
      };

      mockPrisma.vesselAssignment.findFirst.mockResolvedValue(null);
      mockPrisma.approval.count.mockResolvedValue(0);

      const result = await crewRotationService.checkRotationConflicts(rotationData);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('transferProcurementResponsibilities', () => {
    it('should transfer responsibilities and pending approvals', async () => {
      const transferData = {
        fromUserId: 'user-1',
        toUserId: 'user-2',
        vesselId: 'vessel-1',
        permissions: ['requisition:approve', 'purchase:approve'],
        reason: 'Crew rotation',
        effectiveDate: new Date('2024-07-01'),
      };

      const pendingApprovals = [
        {
          id: 'approval-1',
          approverId: 'user-1',
          status: 'PENDING',
          requisition: {
            id: 'req-1',
            requisitionNumber: 'REQ-001',
            totalAmount: 1000,
            currency: 'USD',
          },
        },
      ];

      const delegation = {
        id: 'delegation-1',
        delegatorId: 'user-1',
        delegateId: 'user-2',
        vesselId: 'vessel-1',
        permissions: ['requisition:approve', 'purchase:approve'],
        reason: 'Crew rotation',
        startDate: transferData.effectiveDate,
        endDate: undefined,
        isActive: true,
      };

      mockPrisma.approval.findMany.mockResolvedValue(pendingApprovals);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          delegation: {
            create: vi.fn().mockResolvedValue(delegation),
          },
          approval: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return callback(mockTx);
      });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await crewRotationService.transferProcurementResponsibilities(
        transferData,
        'admin-1'
      );

      expect(result).toEqual(delegation);
      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId: 'admin-1',
        action: 'CREATE',
        resource: 'responsibility_transfer',
        resourceId: 'delegation-1',
        newValues: {
          ...transferData,
          pendingApprovalsTransferred: 1,
        },
        vesselId: 'vessel-1',
      });
    });
  });
});