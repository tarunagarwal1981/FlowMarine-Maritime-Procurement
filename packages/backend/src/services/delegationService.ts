import { PrismaClient, Delegation, User, Vessel } from '@prisma/client';
import { logger } from '../utils/logger';
import { AuditService } from './auditService';
import { PermissionService } from './permissionService';

const prisma = new PrismaClient();

export interface CreateDelegationRequest {
  delegatorId: string;
  delegateId: string;
  vesselId?: string;
  permissions: string[];
  reason: string;
  startDate: Date;
  endDate: Date;
}

export interface DelegationWithDetails extends Delegation {
  delegator: User;
  delegate: User;
  vessel?: Vessel;
}

export class DelegationService {
  /**
   * Create a new delegation with audit trail
   */
  static async createDelegation(
    request: CreateDelegationRequest,
    createdBy: string
  ): Promise<DelegationWithDetails> {
    try {
      // Validate delegator exists and has permissions to delegate
      const delegator = await prisma.user.findUnique({
        where: { id: request.delegatorId },
        include: { permissions: { include: { permission: true } } },
      });

      if (!delegator) {
        throw new Error('Delegator not found');
      }

      // Validate delegate exists and is active
      const delegate = await prisma.user.findUnique({
        where: { id: request.delegateId },
      });

      if (!delegate || !delegate.isActive) {
        throw new Error('Delegate not found or inactive');
      }

      // Validate delegator has delegation permission
      const canDelegate = await PermissionService.hasPermission(
        request.delegatorId,
        PermissionService.PERMISSIONS.DELEGATION_CREATE
      );

      if (!canDelegate) {
        throw new Error('Delegator does not have permission to create delegations');
      }

      // Validate delegator has the permissions they want to delegate
      const delegatorPermissions = await PermissionService.getUserPermissions(request.delegatorId);
      const invalidPermissions = request.permissions.filter(
        permission => !delegatorPermissions.includes(permission)
      );

      if (invalidPermissions.length > 0) {
        throw new Error(`Delegator does not have permissions: ${invalidPermissions.join(', ')}`);
      }

      // Validate vessel access if vessel-specific delegation
      if (request.vesselId) {
        const vesselAssignment = await prisma.vesselAssignment.findFirst({
          where: {
            userId: request.delegatorId,
            vesselId: request.vesselId,
            isActive: true,
          },
        });

        if (!vesselAssignment) {
          throw new Error('Delegator does not have access to specified vessel');
        }
      }

      // Validate date range
      if (request.startDate >= request.endDate) {
        throw new Error('Start date must be before end date');
      }

      if (request.startDate < new Date()) {
        throw new Error('Start date cannot be in the past');
      }

      // Check for overlapping delegations
      const overlappingDelegation = await prisma.delegation.findFirst({
        where: {
          delegatorId: request.delegatorId,
          vesselId: request.vesselId || null,
          isActive: true,
          OR: [
            {
              startDate: { lte: request.endDate },
              endDate: { gte: request.startDate },
            },
          ],
        },
      });

      if (overlappingDelegation) {
        throw new Error('Overlapping delegation already exists for this period');
      }

      // Create delegation
      const delegation = await prisma.delegation.create({
        data: {
          delegatorId: request.delegatorId,
          delegateId: request.delegateId,
          vesselId: request.vesselId,
          permissions: request.permissions,
          reason: request.reason,
          startDate: request.startDate,
          endDate: request.endDate,
        },
        include: {
          delegator: true,
          delegate: true,
          vessel: true,
        },
      });

      // Create audit log
      await AuditService.log({
        userId: createdBy,
        action: 'CREATE',
        resource: 'delegation',
        resourceId: delegation.id,
        newValues: {
          delegatorId: request.delegatorId,
          delegateId: request.delegateId,
          vesselId: request.vesselId,
          permissions: request.permissions,
          reason: request.reason,
          startDate: request.startDate,
          endDate: request.endDate,
        },
        metadata: {
          delegatorEmail: delegator.email,
          delegateEmail: delegate.email,
          vesselName: delegation.vessel?.name,
        },
      });

      logger.info(`Delegation created: ${delegation.id} from ${delegator.email} to ${delegate.email}`);

      return delegation;
    } catch (error) {
      logger.error('Error creating delegation:', error);
      throw error;
    }
  }

  /**
   * Get active delegations for a user (as delegator or delegate)
   */
  static async getUserDelegations(userId: string): Promise<{
    asDelegator: DelegationWithDetails[];
    asDelegate: DelegationWithDetails[];
  }> {
    try {
      const now = new Date();

      const [asDelegator, asDelegate] = await Promise.all([
        prisma.delegation.findMany({
          where: {
            delegatorId: userId,
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now },
          },
          include: {
            delegator: true,
            delegate: true,
            vessel: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.delegation.findMany({
          where: {
            delegateId: userId,
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now },
          },
          include: {
            delegator: true,
            delegate: true,
            vessel: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return { asDelegator, asDelegate };
    } catch (error) {
      logger.error('Error getting user delegations:', error);
      throw error;
    }
  }

  /**
   * Get delegated permissions for a user
   */
  static async getDelegatedPermissions(
    userId: string,
    vesselId?: string
  ): Promise<string[]> {
    try {
      const now = new Date();

      const delegations = await prisma.delegation.findMany({
        where: {
          delegateId: userId,
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
          ...(vesselId ? { vesselId } : {}),
        },
      });

      const allPermissions = delegations.flatMap(delegation => delegation.permissions);
      return [...new Set(allPermissions)];
    } catch (error) {
      logger.error('Error getting delegated permissions:', error);
      return [];
    }
  }

  /**
   * Check if user has permission through delegation
   */
  static async hasDelegatedPermission(
    userId: string,
    permission: string,
    vesselId?: string
  ): Promise<boolean> {
    try {
      const delegatedPermissions = await this.getDelegatedPermissions(userId, vesselId);
      return delegatedPermissions.includes(permission);
    } catch (error) {
      logger.error('Error checking delegated permission:', error);
      return false;
    }
  }

  /**
   * Revoke delegation
   */
  static async revokeDelegation(
    delegationId: string,
    revokedBy: string,
    reason?: string
  ): Promise<void> {
    try {
      const delegation = await prisma.delegation.findUnique({
        where: { id: delegationId },
        include: {
          delegator: true,
          delegate: true,
          vessel: true,
        },
      });

      if (!delegation) {
        throw new Error('Delegation not found');
      }

      if (!delegation.isActive) {
        throw new Error('Delegation is already inactive');
      }

      // Check if user has permission to revoke
      const canRevoke = revokedBy === delegation.delegatorId || 
        await PermissionService.hasPermission(revokedBy, PermissionService.PERMISSIONS.DELEGATION_MANAGE);

      if (!canRevoke) {
        throw new Error('Insufficient permissions to revoke delegation');
      }

      // Deactivate delegation
      await prisma.delegation.update({
        where: { id: delegationId },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      // Create audit log
      await AuditService.log({
        userId: revokedBy,
        action: 'UPDATE',
        resource: 'delegation',
        resourceId: delegationId,
        oldValues: { isActive: true },
        newValues: { isActive: false },
        metadata: {
          reason: reason || 'Manual revocation',
          delegatorEmail: delegation.delegator.email,
          delegateEmail: delegation.delegate.email,
          vesselName: delegation.vessel?.name,
        },
      });

      logger.info(`Delegation revoked: ${delegationId} by ${revokedBy}`);
    } catch (error) {
      logger.error('Error revoking delegation:', error);
      throw error;
    }
  }

  /**
   * Extend delegation end date
   */
  static async extendDelegation(
    delegationId: string,
    newEndDate: Date,
    extendedBy: string,
    reason?: string
  ): Promise<DelegationWithDetails> {
    try {
      const delegation = await prisma.delegation.findUnique({
        where: { id: delegationId },
        include: {
          delegator: true,
          delegate: true,
          vessel: true,
        },
      });

      if (!delegation) {
        throw new Error('Delegation not found');
      }

      if (!delegation.isActive) {
        throw new Error('Cannot extend inactive delegation');
      }

      if (newEndDate <= delegation.endDate) {
        throw new Error('New end date must be after current end date');
      }

      // Check if user has permission to extend
      const canExtend = extendedBy === delegation.delegatorId || 
        await PermissionService.hasPermission(extendedBy, PermissionService.PERMISSIONS.DELEGATION_MANAGE);

      if (!canExtend) {
        throw new Error('Insufficient permissions to extend delegation');
      }

      // Update delegation
      const updatedDelegation = await prisma.delegation.update({
        where: { id: delegationId },
        data: {
          endDate: newEndDate,
          updatedAt: new Date(),
        },
        include: {
          delegator: true,
          delegate: true,
          vessel: true,
        },
      });

      // Create audit log
      await AuditService.log({
        userId: extendedBy,
        action: 'UPDATE',
        resource: 'delegation',
        resourceId: delegationId,
        oldValues: { endDate: delegation.endDate },
        newValues: { endDate: newEndDate },
        metadata: {
          reason: reason || 'Delegation extended',
          delegatorEmail: delegation.delegator.email,
          delegateEmail: delegation.delegate.email,
          vesselName: delegation.vessel?.name,
        },
      });

      logger.info(`Delegation extended: ${delegationId} until ${newEndDate}`);

      return updatedDelegation;
    } catch (error) {
      logger.error('Error extending delegation:', error);
      throw error;
    }
  }

  /**
   * Get delegation history for audit purposes
   */
  static async getDelegationHistory(
    delegationId: string
  ): Promise<any[]> {
    try {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          resource: 'delegation',
          resourceId: delegationId,
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
      logger.error('Error getting delegation history:', error);
      throw error;
    }
  }

  /**
   * Clean up expired delegations
   */
  static async cleanupExpiredDelegations(): Promise<number> {
    try {
      const now = new Date();

      const expiredDelegations = await prisma.delegation.updateMany({
        where: {
          isActive: true,
          endDate: { lt: now },
        },
        data: {
          isActive: false,
          updatedAt: now,
        },
      });

      if (expiredDelegations.count > 0) {
        logger.info(`Cleaned up ${expiredDelegations.count} expired delegations`);
      }

      return expiredDelegations.count;
    } catch (error) {
      logger.error('Error cleaning up expired delegations:', error);
      throw error;
    }
  }

  /**
   * Get all delegations for a vessel
   */
  static async getVesselDelegations(vesselId: string): Promise<DelegationWithDetails[]> {
    try {
      const now = new Date();

      const delegations = await prisma.delegation.findMany({
        where: {
          vesselId,
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          delegator: true,
          delegate: true,
          vessel: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return delegations;
    } catch (error) {
      logger.error('Error getting vessel delegations:', error);
      throw error;
    }
  }

  /**
   * Transfer delegation to another user
   */
  static async transferDelegation(
    delegationId: string,
    newDelegateId: string,
    transferredBy: string,
    reason: string
  ): Promise<DelegationWithDetails> {
    try {
      const delegation = await prisma.delegation.findUnique({
        where: { id: delegationId },
        include: {
          delegator: true,
          delegate: true,
          vessel: true,
        },
      });

      if (!delegation) {
        throw new Error('Delegation not found');
      }

      if (!delegation.isActive) {
        throw new Error('Cannot transfer inactive delegation');
      }

      // Validate new delegate
      const newDelegate = await prisma.user.findUnique({
        where: { id: newDelegateId },
      });

      if (!newDelegate || !newDelegate.isActive) {
        throw new Error('New delegate not found or inactive');
      }

      // Check if user has permission to transfer
      const canTransfer = transferredBy === delegation.delegatorId || 
        await PermissionService.hasPermission(transferredBy, PermissionService.PERMISSIONS.DELEGATION_MANAGE);

      if (!canTransfer) {
        throw new Error('Insufficient permissions to transfer delegation');
      }

      // Update delegation
      const updatedDelegation = await prisma.delegation.update({
        where: { id: delegationId },
        data: {
          delegateId: newDelegateId,
          updatedAt: new Date(),
        },
        include: {
          delegator: true,
          delegate: true,
          vessel: true,
        },
      });

      // Create audit log
      await AuditService.log({
        userId: transferredBy,
        action: 'UPDATE',
        resource: 'delegation',
        resourceId: delegationId,
        oldValues: { delegateId: delegation.delegateId },
        newValues: { delegateId: newDelegateId },
        metadata: {
          reason,
          oldDelegateEmail: delegation.delegate.email,
          newDelegateEmail: newDelegate.email,
          delegatorEmail: delegation.delegator.email,
          vesselName: delegation.vessel?.name,
        },
      });

      logger.info(`Delegation transferred: ${delegationId} to ${newDelegate.email}`);

      return updatedDelegation;
    } catch (error) {
      logger.error('Error transferring delegation:', error);
      throw error;
    }
  }
}