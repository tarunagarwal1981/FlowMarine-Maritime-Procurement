import { PrismaClient, User, Vessel, EmergencyOverride, UserRole } from '@prisma/client';
import { AuditService } from './auditService';
import { logger } from '../utils/logger';

interface EmergencyOverrideRequest {
  userId: string;
  vesselId: string;
  reason: string;
  expirationHours?: number;
  requiresPostApproval?: boolean;
  metadata?: any;
}

interface EmergencyOverrideValidation {
  isValid: boolean;
  reason: string;
  allowedRoles: UserRole[];
  maxAmount?: number;
  expirationHours: number;
}

export class EmergencyOverrideService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create an emergency override for a user
   */
  async createEmergencyOverride(request: EmergencyOverrideRequest): Promise<EmergencyOverride> {
    try {
      // Validate the user and vessel
      const user = await this.prisma.user.findUnique({
        where: { id: request.userId },
        include: {
          vessels: {
            where: { vesselId: request.vesselId, isActive: true }
          }
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.vessels.length === 0) {
        throw new Error('User does not have access to this vessel');
      }

      // Validate emergency override permissions
      const validation = await this.validateEmergencyOverride(user, request.vesselId);
      
      if (!validation.isValid) {
        throw new Error(`Emergency override denied: ${validation.reason}`);
      }

      // Check for existing active overrides
      const existingOverride = await this.prisma.emergencyOverride.findFirst({
        where: {
          userId: request.userId,
          vesselId: request.vesselId,
          isActive: true,
          expiresAt: { gt: new Date() }
        }
      });

      if (existingOverride) {
        throw new Error('User already has an active emergency override for this vessel');
      }

      // Create the emergency override
      const expirationHours = request.expirationHours || validation.expirationHours;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expirationHours);

      const emergencyOverride = await this.prisma.emergencyOverride.create({
        data: {
          userId: request.userId,
          vesselId: request.vesselId,
          reason: request.reason,
          expiresAt,
          requiresPostApproval: request.requiresPostApproval ?? true,
          metadata: {
            ...request.metadata,
            validationResult: validation,
            createdByRole: user.role
          }
        }
      });

      // Log the emergency override creation
      await AuditService.logAction(
        request.userId,
        'EMERGENCY_OVERRIDE',
        'emergency_override',
        emergencyOverride.id,
        null,
        {
          vesselId: request.vesselId,
          reason: request.reason,
          expiresAt,
          requiresPostApproval: emergencyOverride.requiresPostApproval
        }
      );

      logger.info(`Emergency override created for user ${request.userId} on vessel ${request.vesselId}`);

      return emergencyOverride;

    } catch (error) {
      logger.error('Error creating emergency override:', error);
      throw error;
    }
  }

  /**
   * Validate if a user can create an emergency override
   */
  private async validateEmergencyOverride(user: User, vesselId: string): Promise<EmergencyOverrideValidation> {
    // Define emergency override rules based on user role
    const emergencyRules = {
      'CAPTAIN': {
        allowedRoles: ['CAPTAIN'],
        maxAmount: undefined, // No limit for captain
        expirationHours: 48,
        reason: 'Captain has full emergency authority'
      },
      'CHIEF_ENGINEER': {
        allowedRoles: ['CHIEF_ENGINEER'],
        maxAmount: 25000,
        expirationHours: 24,
        reason: 'Chief Engineer has emergency authority for operational items'
      },
      'SUPERINTENDENT': {
        allowedRoles: ['SUPERINTENDENT'],
        maxAmount: 10000,
        expirationHours: 12,
        reason: 'Superintendent has limited emergency authority'
      }
    };

    const rule = emergencyRules[user.role];
    
    if (!rule) {
      return {
        isValid: false,
        reason: `Role ${user.role} is not authorized for emergency overrides`,
        allowedRoles: [],
        expirationHours: 0
      };
    }

    // Check if user role is in allowed roles
    if (!rule.allowedRoles.includes(user.role)) {
      return {
        isValid: false,
        reason: `Role ${user.role} is not in allowed emergency override roles`,
        allowedRoles: rule.allowedRoles,
        expirationHours: 0
      };
    }

    return {
      isValid: true,
      reason: rule.reason,
      allowedRoles: rule.allowedRoles,
      maxAmount: rule.maxAmount,
      expirationHours: rule.expirationHours
    };
  }

  /**
   * Approve an emergency override (post-approval)
   */
  async approveEmergencyOverride(
    overrideId: string, 
    approverId: string, 
    reason: string
  ): Promise<EmergencyOverride> {
    try {
      const override = await this.prisma.emergencyOverride.findUnique({
        where: { id: overrideId },
        include: { user: true, vessel: true }
      });

      if (!override) {
        throw new Error('Emergency override not found');
      }

      if (!override.requiresPostApproval) {
        throw new Error('This emergency override does not require post-approval');
      }

      if (override.approvedBy) {
        throw new Error('Emergency override has already been approved');
      }

      // Validate approver has authority
      const approver = await this.prisma.user.findUnique({
        where: { id: approverId }
      });

      if (!approver) {
        throw new Error('Approver not found');
      }

      // Check if approver has sufficient authority
      const hasAuthority = this.validateApproverAuthority(approver.role, override.user.role);
      
      if (!hasAuthority) {
        throw new Error(`${approver.role} does not have authority to approve emergency override from ${override.user.role}`);
      }

      // Update the emergency override
      const updatedOverride = await this.prisma.emergencyOverride.update({
        where: { id: overrideId },
        data: {
          approvedBy: approverId,
          approvedAt: new Date(),
          postApprovalReason: reason
        }
      });

      // Log the approval
      await AuditService.logAction(
        approverId,
        'APPROVE',
        'emergency_override',
        overrideId,
        { approvedBy: null, approvedAt: null },
        { approvedBy: approverId, approvedAt: new Date(), postApprovalReason: reason }
      );

      logger.info(`Emergency override ${overrideId} approved by ${approverId}`);

      return updatedOverride;

    } catch (error) {
      logger.error('Error approving emergency override:', error);
      throw error;
    }
  }

  /**
   * Deactivate an emergency override
   */
  async deactivateEmergencyOverride(
    overrideId: string, 
    deactivatedBy: string, 
    reason: string
  ): Promise<EmergencyOverride> {
    try {
      const override = await this.prisma.emergencyOverride.findUnique({
        where: { id: overrideId }
      });

      if (!override) {
        throw new Error('Emergency override not found');
      }

      if (!override.isActive) {
        throw new Error('Emergency override is already deactivated');
      }

      const updatedOverride = await this.prisma.emergencyOverride.update({
        where: { id: overrideId },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivationReason: reason
        }
      });

      // Log the deactivation
      await AuditService.logAction(
        deactivatedBy,
        'UPDATE',
        'emergency_override',
        overrideId,
        { isActive: true },
        { isActive: false, deactivationReason: reason }
      );

      logger.info(`Emergency override ${overrideId} deactivated by ${deactivatedBy}`);

      return updatedOverride;

    } catch (error) {
      logger.error('Error deactivating emergency override:', error);
      throw error;
    }
  }

  /**
   * Get active emergency overrides for a user
   */
  async getActiveOverrides(userId: string): Promise<EmergencyOverride[]> {
    try {
      return await this.prisma.emergencyOverride.findMany({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        include: {
          vessel: {
            select: {
              id: true,
              name: true,
              imoNumber: true
            }
          },
          approver: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error getting active overrides:', error);
      throw error;
    }
  }

  /**
   * Get emergency overrides requiring post-approval
   */
  async getOverridesRequiringApproval(approverId?: string): Promise<EmergencyOverride[]> {
    try {
      const whereClause: any = {
        requiresPostApproval: true,
        approvedBy: null,
        isActive: true
      };

      // If approverId provided, filter by vessels the approver has access to
      if (approverId) {
        const approver = await this.prisma.user.findUnique({
          where: { id: approverId },
          include: {
            vessels: {
              where: { isActive: true }
            }
          }
        });

        if (approver && approver.vessels.length > 0) {
          whereClause.vesselId = {
            in: approver.vessels.map(v => v.vesselId)
          };
        }
      }

      return await this.prisma.emergencyOverride.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          },
          vessel: {
            select: {
              id: true,
              name: true,
              imoNumber: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      });
    } catch (error) {
      logger.error('Error getting overrides requiring approval:', error);
      throw error;
    }
  }

  /**
   * Check if user has active emergency override for vessel
   */
  async hasActiveOverride(userId: string, vesselId: string): Promise<boolean> {
    try {
      const override = await this.prisma.emergencyOverride.findFirst({
        where: {
          userId,
          vesselId,
          isActive: true,
          expiresAt: { gt: new Date() }
        }
      });

      return !!override;
    } catch (error) {
      logger.error('Error checking active override:', error);
      return false;
    }
  }

  /**
   * Validate if approver has authority to approve emergency override
   */
  private validateApproverAuthority(approverRole: UserRole, overrideUserRole: UserRole): boolean {
    // Define approval hierarchy
    const approvalHierarchy = {
      'ADMIN': ['CAPTAIN', 'CHIEF_ENGINEER', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM'],
      'FINANCE_TEAM': ['CAPTAIN', 'CHIEF_ENGINEER', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER'],
      'PROCUREMENT_MANAGER': ['CAPTAIN', 'CHIEF_ENGINEER', 'SUPERINTENDENT'],
      'SUPERINTENDENT': ['CHIEF_ENGINEER'],
      'CAPTAIN': [], // Captain overrides don't need approval from lower roles
      'CHIEF_ENGINEER': [],
      'VESSEL_CREW': []
    };

    const canApprove = approvalHierarchy[approverRole] || [];
    return canApprove.includes(overrideUserRole);
  }

  /**
   * Clean up expired emergency overrides
   */
  async cleanupExpiredOverrides(): Promise<number> {
    try {
      const result = await this.prisma.emergencyOverride.updateMany({
        where: {
          isActive: true,
          expiresAt: { lt: new Date() }
        },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivationReason: 'Expired automatically'
        }
      });

      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired emergency overrides`);
      }

      return result.count;
    } catch (error) {
      logger.error('Error cleaning up expired overrides:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const emergencyOverrideService = new EmergencyOverrideService(new PrismaClient());