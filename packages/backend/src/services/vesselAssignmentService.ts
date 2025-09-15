import { PrismaClient, VesselAssignment, User, Vessel, UserRole } from '@prisma/client';
import { logger } from '../utils/logger';
import { AuditService } from './auditService';
import { PermissionService } from './permissionService';
import { DelegationService } from './delegationService';

const prisma = new PrismaClient();

export interface CreateVesselAssignmentRequest {
  userId: string;
  vesselId: string;
  startDate: Date;
  endDate?: Date;
  isActive?: boolean;
}

export interface VesselAssignmentWithDetails extends VesselAssignment {
  user: User;
  vessel: Vessel;
}

export interface CrewRotationRequest {
  vesselId: string;
  outgoingUserId: string;
  incomingUserId: string;
  rotationDate: Date;
  transferResponsibilities: boolean;
  reason: string;
}

export interface TemporaryAccessRequest {
  userId: string;
  vesselId: string;
  grantedBy: string;
  reason: string;
  startDate: Date;
  endDate: Date;
  permissions: string[];
}

export class VesselAssignmentService {
  /**
   * Create a new vessel assignment
   */
  static async createAssignment(
    request: CreateVesselAssignmentRequest,
    createdBy: string
  ): Promise<VesselAssignmentWithDetails> {
    try {
      // Validate user exists and is active
      const user = await prisma.user.findUnique({
        where: { id: request.userId },
      });

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Validate vessel exists and is active
      const vessel = await prisma.vessel.findUnique({
        where: { id: request.vesselId },
      });

      if (!vessel || !vessel.isActive) {
        throw new Error('Vessel not found or inactive');
      }

      // Check if creator has permission to assign users to vessels
      const canAssign = await PermissionService.hasPermission(
        createdBy,
        PermissionService.PERMISSIONS.VESSEL_ASSIGN_USERS
      );

      if (!canAssign) {
        throw new Error('Insufficient permissions to assign users to vessels');
      }

      // Validate date range
      if (request.endDate && request.startDate >= request.endDate) {
        throw new Error('Start date must be before end date');
      }

      // Check for overlapping active assignments
      const overlappingAssignment = await prisma.vesselAssignment.findFirst({
        where: {
          userId: request.userId,
          vesselId: request.vesselId,
          isActive: true,
          OR: [
            {
              startDate: { lte: request.endDate || new Date('2099-12-31') },
              endDate: { gte: request.startDate },
            },
            {
              startDate: { lte: request.endDate || new Date('2099-12-31') },
              endDate: null,
            },
          ],
        },
      });

      if (overlappingAssignment) {
        throw new Error('User already has an active assignment to this vessel for the specified period');
      }

      // Create vessel assignment
      const assignment = await prisma.vesselAssignment.create({
        data: {
          userId: request.userId,
          vesselId: request.vesselId,
          startDate: request.startDate,
          endDate: request.endDate,
          isActive: request.isActive ?? true,
        },
        include: {
          user: true,
          vessel: true,
        },
      });

      // Create audit log
      await AuditService.log({
        userId: createdBy,
        action: 'CREATE',
        resource: 'vessel_assignment',
        resourceId: assignment.id,
        newValues: {
          userId: request.userId,
          vesselId: request.vesselId,
          startDate: request.startDate,
          endDate: request.endDate,
          isActive: assignment.isActive,
        },
        metadata: {
          userEmail: user.email,
          vesselName: vessel.name,
          vesselImoNumber: vessel.imoNumber,
        },
      });

      logger.info(`Vessel assignment created: ${user.email} assigned to ${vessel.name}`);

      return assignment;
    } catch (error) {
      logger.error('Error creating vessel assignment:', error);
      throw error;
    }
  }

  /**
   * Get all assignments for a user
   */
  static async getUserAssignments(
    userId: string,
    includeInactive: boolean = false
  ): Promise<VesselAssignmentWithDetails[]> {
    try {
      const assignments = await prisma.vesselAssignment.findMany({
        where: {
          userId,
          ...(includeInactive ? {} : { isActive: true }),
        },
        include: {
          user: true,
          vessel: true,
        },
        orderBy: { startDate: 'desc' },
      });

      return assignments;
    } catch (error) {
      logger.error('Error getting user assignments:', error);
      throw error;
    }
  }

  /**
   * Get all assignments for a vessel
   */
  static async getVesselAssignments(
    vesselId: string,
    includeInactive: boolean = false
  ): Promise<VesselAssignmentWithDetails[]> {
    try {
      const assignments = await prisma.vesselAssignment.findMany({
        where: {
          vesselId,
          ...(includeInactive ? {} : { isActive: true }),
        },
        include: {
          user: true,
          vessel: true,
        },
        orderBy: { startDate: 'desc' },
      });

      return assignments;
    } catch (error) {
      logger.error('Error getting vessel assignments:', error);
      throw error;
    }
  }

  /**
   * Get current crew for a vessel
   */
  static async getCurrentCrew(vesselId: string): Promise<VesselAssignmentWithDetails[]> {
    try {
      const now = new Date();

      const currentCrew = await prisma.vesselAssignment.findMany({
        where: {
          vesselId,
          isActive: true,
          startDate: { lte: now },
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
        include: {
          user: true,
          vessel: true,
        },
        orderBy: [
          { user: { role: 'asc' } },
          { startDate: 'asc' },
        ],
      });

      return currentCrew;
    } catch (error) {
      logger.error('Error getting current crew:', error);
      throw error;
    }
  }

  /**
   * Check if user has access to vessel
   */
  static async hasVesselAccess(
    userId: string,
    vesselId: string,
    checkDate?: Date
  ): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        return false;
      }

      // Privileged roles have access to all vessels
      const privilegedRoles: UserRole[] = ['ADMIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER'];
      if (privilegedRoles.includes(user.role)) {
        return true;
      }

      const checkDateTime = checkDate || new Date();

      // Check for active vessel assignment
      const assignment = await prisma.vesselAssignment.findFirst({
        where: {
          userId,
          vesselId,
          isActive: true,
          startDate: { lte: checkDateTime },
          OR: [
            { endDate: null },
            { endDate: { gte: checkDateTime } },
          ],
        },
      });

      if (assignment) {
        return true;
      }

      // Check for delegated access
      const hasDelegatedAccess = await DelegationService.hasDelegatedPermission(
        userId,
        'vessel:access',
        vesselId
      );

      return hasDelegatedAccess;
    } catch (error) {
      logger.error('Error checking vessel access:', error);
      return false;
    }
  }

  /**
   * Get user's accessible vessels
   */
  static async getUserVessels(userId: string): Promise<string[]> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        return [];
      }

      // Privileged roles have access to all vessels
      const privilegedRoles: UserRole[] = ['ADMIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER'];
      if (privilegedRoles.includes(user.role)) {
        const allVessels = await prisma.vessel.findMany({
          where: { isActive: true },
          select: { id: true },
        });
        return allVessels.map(v => v.id);
      }

      const now = new Date();

      // Get vessels from direct assignments
      const assignments = await prisma.vesselAssignment.findMany({
        where: {
          userId,
          isActive: true,
          startDate: { lte: now },
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
        select: { vesselId: true },
      });

      const directVessels = assignments.map(a => a.vesselId);

      // Get vessels from delegations
      const delegations = await prisma.delegation.findMany({
        where: {
          delegateId: userId,
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
          vesselId: { not: null },
        },
        select: { vesselId: true },
      });

      const delegatedVessels = delegations
        .filter(d => d.vesselId)
        .map(d => d.vesselId!);

      // Combine and deduplicate
      return [...new Set([...directVessels, ...delegatedVessels])];
    } catch (error) {
      logger.error('Error getting user vessels:', error);
      return [];
    }
  }

  /**
   * Update vessel assignment
   */
  static async updateAssignment(
    assignmentId: string,
    updates: Partial<CreateVesselAssignmentRequest>,
    updatedBy: string
  ): Promise<VesselAssignmentWithDetails> {
    try {
      const existingAssignment = await prisma.vesselAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          user: true,
          vessel: true,
        },
      });

      if (!existingAssignment) {
        throw new Error('Vessel assignment not found');
      }

      // Check permissions
      const canUpdate = await PermissionService.hasPermission(
        updatedBy,
        PermissionService.PERMISSIONS.VESSEL_ASSIGN_USERS
      );

      if (!canUpdate) {
        throw new Error('Insufficient permissions to update vessel assignments');
      }

      // Validate date range if dates are being updated
      if (updates.startDate && updates.endDate && updates.startDate >= updates.endDate) {
        throw new Error('Start date must be before end date');
      }

      // Update assignment
      const updatedAssignment = await prisma.vesselAssignment.update({
        where: { id: assignmentId },
        data: {
          ...(updates.startDate && { startDate: updates.startDate }),
          ...(updates.endDate !== undefined && { endDate: updates.endDate }),
          ...(updates.isActive !== undefined && { isActive: updates.isActive }),
          updatedAt: new Date(),
        },
        include: {
          user: true,
          vessel: true,
        },
      });

      // Create audit log
      await AuditService.log({
        userId: updatedBy,
        action: 'UPDATE',
        resource: 'vessel_assignment',
        resourceId: assignmentId,
        oldValues: {
          startDate: existingAssignment.startDate,
          endDate: existingAssignment.endDate,
          isActive: existingAssignment.isActive,
        },
        newValues: {
          startDate: updatedAssignment.startDate,
          endDate: updatedAssignment.endDate,
          isActive: updatedAssignment.isActive,
        },
        metadata: {
          userEmail: existingAssignment.user.email,
          vesselName: existingAssignment.vessel.name,
        },
      });

      logger.info(`Vessel assignment updated: ${assignmentId}`);

      return updatedAssignment;
    } catch (error) {
      logger.error('Error updating vessel assignment:', error);
      throw error;
    }
  }

  /**
   * Deactivate vessel assignment
   */
  static async deactivateAssignment(
    assignmentId: string,
    deactivatedBy: string,
    reason?: string
  ): Promise<void> {
    try {
      const assignment = await prisma.vesselAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          user: true,
          vessel: true,
        },
      });

      if (!assignment) {
        throw new Error('Vessel assignment not found');
      }

      if (!assignment.isActive) {
        throw new Error('Assignment is already inactive');
      }

      // Check permissions
      const canDeactivate = await PermissionService.hasPermission(
        deactivatedBy,
        PermissionService.PERMISSIONS.VESSEL_ASSIGN_USERS
      );

      if (!canDeactivate) {
        throw new Error('Insufficient permissions to deactivate vessel assignments');
      }

      // Deactivate assignment
      await prisma.vesselAssignment.update({
        where: { id: assignmentId },
        data: {
          isActive: false,
          endDate: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create audit log
      await AuditService.log({
        userId: deactivatedBy,
        action: 'UPDATE',
        resource: 'vessel_assignment',
        resourceId: assignmentId,
        oldValues: { isActive: true },
        newValues: { isActive: false },
        metadata: {
          reason: reason || 'Manual deactivation',
          userEmail: assignment.user.email,
          vesselName: assignment.vessel.name,
        },
      });

      logger.info(`Vessel assignment deactivated: ${assignmentId} by ${deactivatedBy}`);
    } catch (error) {
      logger.error('Error deactivating vessel assignment:', error);
      throw error;
    }
  }

  /**
   * Process crew rotation with responsibility transfer
   */
  static async processCrewRotation(
    request: CrewRotationRequest,
    processedBy: string
  ): Promise<{
    outgoingAssignment: VesselAssignmentWithDetails;
    incomingAssignment: VesselAssignmentWithDetails;
    delegationsTransferred: number;
  }> {
    try {
      // Validate users and vessel
      const [outgoingUser, incomingUser, vessel] = await Promise.all([
        prisma.user.findUnique({ where: { id: request.outgoingUserId } }),
        prisma.user.findUnique({ where: { id: request.incomingUserId } }),
        prisma.vessel.findUnique({ where: { id: request.vesselId } }),
      ]);

      if (!outgoingUser || !outgoingUser.isActive) {
        throw new Error('Outgoing user not found or inactive');
      }

      if (!incomingUser || !incomingUser.isActive) {
        throw new Error('Incoming user not found or inactive');
      }

      if (!vessel || !vessel.isActive) {
        throw new Error('Vessel not found or inactive');
      }

      // Check permissions
      const canProcessRotation = await PermissionService.hasPermission(
        processedBy,
        PermissionService.PERMISSIONS.VESSEL_ASSIGN_USERS
      );

      if (!canProcessRotation) {
        throw new Error('Insufficient permissions to process crew rotation');
      }

      // Get current assignment for outgoing user
      const outgoingAssignment = await prisma.vesselAssignment.findFirst({
        where: {
          userId: request.outgoingUserId,
          vesselId: request.vesselId,
          isActive: true,
        },
        include: {
          user: true,
          vessel: true,
        },
      });

      if (!outgoingAssignment) {
        throw new Error('Outgoing user does not have an active assignment to this vessel');
      }

      // Use transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
        // End the outgoing assignment
        const updatedOutgoingAssignment = await tx.vesselAssignment.update({
          where: { id: outgoingAssignment.id },
          data: {
            endDate: request.rotationDate,
            isActive: false,
            updatedAt: new Date(),
          },
          include: {
            user: true,
            vessel: true,
          },
        });

        // Create new assignment for incoming user
        const newIncomingAssignment = await tx.vesselAssignment.create({
          data: {
            userId: request.incomingUserId,
            vesselId: request.vesselId,
            startDate: request.rotationDate,
            isActive: true,
          },
          include: {
            user: true,
            vessel: true,
          },
        });

        let delegationsTransferred = 0;

        // Transfer responsibilities if requested
        if (request.transferResponsibilities) {
          // Get active delegations where outgoing user is the delegator
          const activeDelegations = await tx.delegation.findMany({
            where: {
              delegatorId: request.outgoingUserId,
              vesselId: request.vesselId,
              isActive: true,
              endDate: { gte: request.rotationDate },
            },
          });

          // Transfer delegations to incoming user
          for (const delegation of activeDelegations) {
            await tx.delegation.update({
              where: { id: delegation.id },
              data: {
                delegatorId: request.incomingUserId,
                updatedAt: new Date(),
              },
            });
            delegationsTransferred++;
          }
        }

        return {
          outgoingAssignment: updatedOutgoingAssignment,
          incomingAssignment: newIncomingAssignment,
          delegationsTransferred,
        };
      });

      // Create audit logs
      await Promise.all([
        AuditService.log({
          userId: processedBy,
          action: 'UPDATE',
          resource: 'vessel_assignment',
          resourceId: outgoingAssignment.id,
          oldValues: { isActive: true, endDate: null },
          newValues: { isActive: false, endDate: request.rotationDate },
          metadata: {
            rotationType: 'crew_rotation_outgoing',
            reason: request.reason,
            userEmail: outgoingUser.email,
            vesselName: vessel.name,
            rotationDate: request.rotationDate,
          },
        }),
        AuditService.log({
          userId: processedBy,
          action: 'CREATE',
          resource: 'vessel_assignment',
          resourceId: result.incomingAssignment.id,
          newValues: {
            userId: request.incomingUserId,
            vesselId: request.vesselId,
            startDate: request.rotationDate,
            isActive: true,
          },
          metadata: {
            rotationType: 'crew_rotation_incoming',
            reason: request.reason,
            userEmail: incomingUser.email,
            vesselName: vessel.name,
            rotationDate: request.rotationDate,
            delegationsTransferred: result.delegationsTransferred,
          },
        }),
      ]);

      logger.info(
        `Crew rotation processed: ${outgoingUser.email} -> ${incomingUser.email} on ${vessel.name}`
      );

      return result;
    } catch (error) {
      logger.error('Error processing crew rotation:', error);
      throw error;
    }
  }

  /**
   * Grant temporary vessel access
   */
  static async grantTemporaryAccess(
    request: TemporaryAccessRequest
  ): Promise<any> {
    try {
      // Validate users and vessel
      const [user, grantor, vessel] = await Promise.all([
        prisma.user.findUnique({ where: { id: request.userId } }),
        prisma.user.findUnique({ where: { id: request.grantedBy } }),
        prisma.vessel.findUnique({ where: { id: request.vesselId } }),
      ]);

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      if (!grantor || !grantor.isActive) {
        throw new Error('Grantor not found or inactive');
      }

      if (!vessel || !vessel.isActive) {
        throw new Error('Vessel not found or inactive');
      }

      // Check if grantor has permission to grant access
      const canGrant = await PermissionService.hasPermission(
        request.grantedBy,
        PermissionService.PERMISSIONS.DELEGATION_CREATE
      );

      if (!canGrant) {
        throw new Error('Insufficient permissions to grant temporary access');
      }

      // Check if grantor has access to the vessel
      const grantorHasAccess = await this.hasVesselAccess(request.grantedBy, request.vesselId);
      if (!grantorHasAccess) {
        throw new Error('Grantor does not have access to the specified vessel');
      }

      // Create delegation for temporary access
      const delegation = await DelegationService.createDelegation(
        {
          delegatorId: request.grantedBy,
          delegateId: request.userId,
          vesselId: request.vesselId,
          permissions: request.permissions,
          reason: `Temporary access: ${request.reason}`,
          startDate: request.startDate,
          endDate: request.endDate,
        },
        request.grantedBy
      );

      logger.info(
        `Temporary vessel access granted: ${user.email} to ${vessel.name} by ${grantor.email}`
      );

      return delegation;
    } catch (error) {
      logger.error('Error granting temporary access:', error);
      throw error;
    }
  }

  /**
   * Get crew rotation schedule for a vessel
   */
  static async getCrewRotationSchedule(
    vesselId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    current: VesselAssignmentWithDetails[];
    upcoming: VesselAssignmentWithDetails[];
    ending: VesselAssignmentWithDetails[];
  }> {
    try {
      const [current, upcoming, ending] = await Promise.all([
        // Current crew
        this.getCurrentCrew(vesselId),
        
        // Upcoming assignments
        prisma.vesselAssignment.findMany({
          where: {
            vesselId,
            isActive: true,
            startDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            user: true,
            vessel: true,
          },
          orderBy: { startDate: 'asc' },
        }),
        
        // Assignments ending in the period
        prisma.vesselAssignment.findMany({
          where: {
            vesselId,
            isActive: true,
            endDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            user: true,
            vessel: true,
          },
          orderBy: { endDate: 'asc' },
        }),
      ]);

      return { current, upcoming, ending };
    } catch (error) {
      logger.error('Error getting crew rotation schedule:', error);
      throw error;
    }
  }

  /**
   * Validate vessel assignment constraints
   */
  static async validateAssignmentConstraints(
    vesselId: string,
    userId: string,
    startDate: Date,
    endDate?: Date
  ): Promise<{
    isValid: boolean;
    violations: string[];
  }> {
    try {
      const violations: string[] = [];

      // Get vessel and user details
      const [vessel, user] = await Promise.all([
        prisma.vessel.findUnique({ where: { id: vesselId } }),
        prisma.user.findUnique({ where: { id: userId } }),
      ]);

      if (!vessel) {
        violations.push('Vessel not found');
      }

      if (!user) {
        violations.push('User not found');
      }

      if (violations.length > 0) {
        return { isValid: false, violations };
      }

      // Check crew complement limits
      const currentCrewCount = await prisma.vesselAssignment.count({
        where: {
          vesselId,
          isActive: true,
          startDate: { lte: endDate || new Date('2099-12-31') },
          OR: [
            { endDate: null },
            { endDate: { gte: startDate } },
          ],
        },
      });

      if (currentCrewCount >= vessel!.crewComplement) {
        violations.push('Vessel crew complement limit exceeded');
      }

      // Check for role conflicts (e.g., only one captain per vessel)
      if (user!.role === 'CAPTAIN') {
        const existingCaptain = await prisma.vesselAssignment.findFirst({
          where: {
            vesselId,
            isActive: true,
            startDate: { lte: endDate || new Date('2099-12-31') },
            OR: [
              { endDate: null },
              { endDate: { gte: startDate } },
            ],
            user: {
              role: 'CAPTAIN',
            },
            userId: { not: userId },
          },
        });

        if (existingCaptain) {
          violations.push('Vessel already has a captain assigned for this period');
        }
      }

      return {
        isValid: violations.length === 0,
        violations,
      };
    } catch (error) {
      logger.error('Error validating assignment constraints:', error);
      return {
        isValid: false,
        violations: ['Error validating assignment constraints'],
      };
    }
  }

  /**
   * Get assignment history for audit purposes
   */
  static async getAssignmentHistory(
    assignmentId: string
  ): Promise<any[]> {
    try {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          resource: 'vessel_assignment',
          resourceId: assignmentId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return auditLogs;
    } catch (error) {
      logger.error('Error getting assignment history:', error);
      throw error;
    }
  }

  /**
   * Clean up expired assignments
   */
  static async cleanupExpiredAssignments(): Promise<number> {
    try {
      const now = new Date();

      const expiredAssignments = await prisma.vesselAssignment.updateMany({
        where: {
          isActive: true,
          endDate: { lt: now },
        },
        data: {
          isActive: false,
          updatedAt: now,
        },
      });

      if (expiredAssignments.count > 0) {
        logger.info(`Cleaned up ${expiredAssignments.count} expired vessel assignments`);
      }

      return expiredAssignments.count;
    } catch (error) {
      logger.error('Error cleaning up expired assignments:', error);
      throw error;
    }
  }
}