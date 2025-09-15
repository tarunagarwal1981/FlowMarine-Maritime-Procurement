import { PrismaClient, VesselAssignment, User, Delegation } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { auditService } from './auditService.js';
import { delegationService } from './delegationService.js';

const prisma = new PrismaClient();

export interface CrewAssignmentData {
  userId: string;
  vesselId: string;
  startDate: Date;
  endDate?: Date;
  isActive?: boolean;
}

export interface RotationScheduleData {
  vesselId: string;
  outgoingUserId: string;
  incomingUserId: string;
  rotationDate: Date;
  transferResponsibilities: boolean;
  notes?: string;
}

export interface CrewComplementData {
  vesselId: string;
  role: string;
  requiredCount: number;
  currentCount: number;
  assignments: VesselAssignment[];
}

export interface ResponsibilityTransferData {
  fromUserId: string;
  toUserId: string;
  vesselId: string;
  permissions: string[];
  reason: string;
  effectiveDate: Date;
  expiryDate?: Date;
}

class CrewRotationService {
  /**
   * Assign crew member to vessel
   */
  async assignCrewToVessel(data: CrewAssignmentData, assignedBy: string): Promise<VesselAssignment> {
    try {
      // Check if user already has an active assignment to this vessel
      const existingAssignment = await prisma.vesselAssignment.findFirst({
        where: {
          userId: data.userId,
          vesselId: data.vesselId,
          isActive: true,
        },
      });

      if (existingAssignment) {
        throw new Error('User already has an active assignment to this vessel');
      }

      const assignment = await prisma.vesselAssignment.create({
        data: {
          ...data,
          isActive: data.isActive ?? true,
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

      await auditService.log({
        userId: assignedBy,
        action: 'CREATE',
        resource: 'vessel_assignment',
        resourceId: assignment.id,
        newValues: data,
        vesselId: data.vesselId,
      });

      logger.info('Crew member assigned to vessel', {
        assignmentId: assignment.id,
        userId: data.userId,
        vesselId: data.vesselId,
        assignedBy,
      });

      return assignment;
    } catch (error) {
      logger.error('Failed to assign crew to vessel', { error, data, assignedBy });
      throw error;
    }
  }

  /**
   * End crew assignment (rotation off)
   */
  async endCrewAssignment(assignmentId: string, endDate: Date, endedBy: string): Promise<VesselAssignment> {
    try {
      const existingAssignment = await prisma.vesselAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          user: true,
          vessel: true,
        },
      });

      if (!existingAssignment) {
        throw new Error('Assignment not found');
      }

      if (!existingAssignment.isActive) {
        throw new Error('Assignment is already inactive');
      }

      const assignment = await prisma.vesselAssignment.update({
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

      await auditService.log({
        userId: endedBy,
        action: 'UPDATE',
        resource: 'vessel_assignment',
        resourceId: assignmentId,
        oldValues: { isActive: true, endDate: null },
        newValues: { isActive: false, endDate },
        vesselId: existingAssignment.vesselId,
      });

      logger.info('Crew assignment ended', {
        assignmentId,
        userId: existingAssignment.userId,
        vesselId: existingAssignment.vesselId,
        endDate,
        endedBy,
      });

      return assignment;
    } catch (error) {
      logger.error('Failed to end crew assignment', { error, assignmentId, endDate, endedBy });
      throw error;
    }
  }

  /**
   * Process crew rotation with responsibility transfer
   */
  async processCrewRotation(data: RotationScheduleData, processedBy: string): Promise<{
    outgoingAssignment: VesselAssignment;
    incomingAssignment: VesselAssignment;
    delegation?: Delegation;
  }> {
    try {
      return await prisma.$transaction(async (tx) => {
        // End outgoing crew member's assignment
        const outgoingAssignment = await tx.vesselAssignment.updateMany({
          where: {
            userId: data.outgoingUserId,
            vesselId: data.vesselId,
            isActive: true,
          },
          data: {
            endDate: data.rotationDate,
            isActive: false,
          },
        });

        if (outgoingAssignment.count === 0) {
          throw new Error('No active assignment found for outgoing crew member');
        }

        // Create new assignment for incoming crew member
        const incomingAssignment = await tx.vesselAssignment.create({
          data: {
            userId: data.incomingUserId,
            vesselId: data.vesselId,
            startDate: data.rotationDate,
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
            vessel: {
              select: {
                id: true,
                name: true,
                imoNumber: true,
              },
            },
          },
        });

        // Get the updated outgoing assignment for return
        const updatedOutgoingAssignment = await tx.vesselAssignment.findFirst({
          where: {
            userId: data.outgoingUserId,
            vesselId: data.vesselId,
            endDate: data.rotationDate,
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

        let delegation: Delegation | undefined;

        // Transfer responsibilities if requested
        if (data.transferResponsibilities) {
          // Get outgoing user's permissions for this vessel
          const outgoingUser = await tx.user.findUnique({
            where: { id: data.outgoingUserId },
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          });

          if (outgoingUser && outgoingUser.permissions.length > 0) {
            const permissions = outgoingUser.permissions.map(up => up.permission.name);
            
            delegation = await tx.delegation.create({
              data: {
                delegatorId: data.outgoingUserId,
                delegateId: data.incomingUserId,
                vesselId: data.vesselId,
                permissions,
                reason: `Crew rotation - ${data.notes || 'Standard rotation'}`,
                startDate: data.rotationDate,
                endDate: new Date(data.rotationDate.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days default
                isActive: true,
              },
            });
          }
        }

        await auditService.log({
          userId: processedBy,
          action: 'CREATE',
          resource: 'crew_rotation',
          resourceId: incomingAssignment.id,
          newValues: data,
          vesselId: data.vesselId,
        });

        logger.info('Crew rotation processed successfully', {
          vesselId: data.vesselId,
          outgoingUserId: data.outgoingUserId,
          incomingUserId: data.incomingUserId,
          rotationDate: data.rotationDate,
          processedBy,
        });

        return {
          outgoingAssignment: updatedOutgoingAssignment!,
          incomingAssignment,
          delegation,
        };
      });
    } catch (error) {
      logger.error('Failed to process crew rotation', { error, data, processedBy });
      throw error;
    }
  }

  /**
   * Get crew complement for a vessel
   */
  async getVesselCrewComplement(vesselId: string): Promise<CrewComplementData[]> {
    try {
      const assignments = await prisma.vesselAssignment.findMany({
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

      // Group by role
      const roleGroups = assignments.reduce((acc, assignment) => {
        const role = assignment.user.role;
        if (!acc[role]) {
          acc[role] = [];
        }
        acc[role].push(assignment);
        return acc;
      }, {} as Record<string, VesselAssignment[]>);

      // Convert to crew complement data
      const complement: CrewComplementData[] = Object.entries(roleGroups).map(([role, assignments]) => ({
        vesselId,
        role,
        currentCount: assignments.length,
        requiredCount: this.getRequiredCountForRole(role), // This could be configurable
        assignments,
      }));

      return complement;
    } catch (error) {
      logger.error('Failed to get vessel crew complement', { error, vesselId });
      throw error;
    }
  }

  /**
   * Get upcoming rotations for a vessel
   */
  async getUpcomingRotations(vesselId: string, days: number = 30): Promise<VesselAssignment[]> {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      return await prisma.vesselAssignment.findMany({
        where: {
          vesselId,
          isActive: true,
          endDate: {
            lte: futureDate,
            gte: new Date(),
          },
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
        orderBy: {
          endDate: 'asc',
        },
      });
    } catch (error) {
      logger.error('Failed to get upcoming rotations', { error, vesselId, days });
      throw error;
    }
  }

  /**
   * Transfer procurement responsibilities during rotation
   */
  async transferProcurementResponsibilities(data: ResponsibilityTransferData, transferredBy: string): Promise<Delegation> {
    try {
      // Check for pending approvals that need to be transferred
      const pendingApprovals = await prisma.approval.findMany({
        where: {
          approverId: data.fromUserId,
          status: 'PENDING',
          requisition: {
            vesselId: data.vesselId,
          },
        },
        include: {
          requisition: {
            select: {
              id: true,
              requisitionNumber: true,
              totalAmount: true,
              currency: true,
            },
          },
        },
      });

      const delegation = await prisma.$transaction(async (tx) => {
        // Create delegation
        const newDelegation = await tx.delegation.create({
          data: {
            delegatorId: data.fromUserId,
            delegateId: data.toUserId,
            vesselId: data.vesselId,
            permissions: data.permissions,
            reason: data.reason,
            startDate: data.effectiveDate,
            endDate: data.expiryDate,
            isActive: true,
          },
        });

        // Transfer pending approvals
        if (pendingApprovals.length > 0) {
          await tx.approval.updateMany({
            where: {
              approverId: data.fromUserId,
              status: 'PENDING',
              requisition: {
                vesselId: data.vesselId,
              },
            },
            data: {
              approverId: data.toUserId,
            },
          });
        }

        return newDelegation;
      });

      await auditService.log({
        userId: transferredBy,
        action: 'CREATE',
        resource: 'responsibility_transfer',
        resourceId: delegation.id,
        newValues: {
          ...data,
          pendingApprovalsTransferred: pendingApprovals.length,
        },
        vesselId: data.vesselId,
      });

      logger.info('Procurement responsibilities transferred', {
        delegationId: delegation.id,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        vesselId: data.vesselId,
        pendingApprovalsTransferred: pendingApprovals.length,
        transferredBy,
      });

      return delegation;
    } catch (error) {
      logger.error('Failed to transfer procurement responsibilities', { error, data, transferredBy });
      throw error;
    }
  }

  /**
   * Get crew rotation history for a vessel
   */
  async getCrewRotationHistory(vesselId: string, limit: number = 50): Promise<VesselAssignment[]> {
    try {
      return await prisma.vesselAssignment.findMany({
        where: {
          vesselId,
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
          createdAt: 'desc',
        },
        take: limit,
      });
    } catch (error) {
      logger.error('Failed to get crew rotation history', { error, vesselId, limit });
      throw error;
    }
  }

  /**
   * Get crew member's assignment history
   */
  async getCrewMemberHistory(userId: string, limit: number = 20): Promise<VesselAssignment[]> {
    try {
      return await prisma.vesselAssignment.findMany({
        where: {
          userId,
        },
        include: {
          vessel: {
            select: {
              id: true,
              name: true,
              imoNumber: true,
              vesselType: true,
            },
          },
        },
        orderBy: {
          startDate: 'desc',
        },
        take: limit,
      });
    } catch (error) {
      logger.error('Failed to get crew member history', { error, userId, limit });
      throw error;
    }
  }

  /**
   * Check for rotation conflicts
   */
  async checkRotationConflicts(data: RotationScheduleData): Promise<{
    hasConflicts: boolean;
    conflicts: string[];
  }> {
    try {
      const conflicts: string[] = [];

      // Check if incoming user already has an active assignment
      const existingAssignment = await prisma.vesselAssignment.findFirst({
        where: {
          userId: data.incomingUserId,
          isActive: true,
          OR: [
            { endDate: null },
            { endDate: { gt: data.rotationDate } },
          ],
        },
        include: {
          vessel: {
            select: {
              name: true,
              imoNumber: true,
            },
          },
        },
      });

      if (existingAssignment) {
        conflicts.push(
          `Incoming crew member is already assigned to vessel ${existingAssignment.vessel.name} (${existingAssignment.vessel.imoNumber})`
        );
      }

      // Check if outgoing user has pending approvals
      const pendingApprovals = await prisma.approval.count({
        where: {
          approverId: data.outgoingUserId,
          status: 'PENDING',
          requisition: {
            vesselId: data.vesselId,
          },
        },
      });

      if (pendingApprovals > 0 && !data.transferResponsibilities) {
        conflicts.push(
          `Outgoing crew member has ${pendingApprovals} pending approvals that need to be transferred`
        );
      }

      return {
        hasConflicts: conflicts.length > 0,
        conflicts,
      };
    } catch (error) {
      logger.error('Failed to check rotation conflicts', { error, data });
      throw error;
    }
  }

  /**
   * Get required count for role (this could be made configurable)
   */
  private getRequiredCountForRole(role: string): number {
    const roleRequirements: Record<string, number> = {
      CAPTAIN: 1,
      CHIEF_ENGINEER: 1,
      SUPERINTENDENT: 1,
      VESSEL_CREW: 8, // Default crew size
      PROCUREMENT_MANAGER: 1,
      FINANCE_TEAM: 1,
    };

    return roleRequirements[role] || 1;
  }
}

export const crewRotationService = new CrewRotationService();