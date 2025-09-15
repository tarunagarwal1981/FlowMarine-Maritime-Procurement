import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logSecurityEvent, auditComplianceEvent } from './auditLogger.js';

const prisma = new PrismaClient();

interface EmergencyOverride {
  id: string;
  userId: string;
  vesselId: string;
  reason: string;
  approvedBy?: string;
  expiresAt: Date;
  isActive: boolean;
  requiresPostApproval: boolean;
}

/**
 * Emergency access middleware for captain override procedures
 */
export const emergencyAccess = (options: {
  allowedRoles?: string[];
  requiresJustification?: boolean;
  maxDuration?: number; // in hours
  requiresPostApproval?: boolean;
} = {}) => {
  const {
    allowedRoles = ['CAPTAIN', 'CHIEF_ENGINEER'],
    requiresJustification = true,
    maxDuration = 24, // 24 hours default
    requiresPostApproval = true
  } = options;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      // Check if user has emergency access role
      if (!allowedRoles.includes(req.user.role)) {
        await logSecurityEvent({
          action: 'EMERGENCY_ACCESS_DENIED_ROLE',
          resource: req.path,
          ipAddress: req.ip,
          userId: req.user.id,
          severity: 'HIGH',
          metadata: {
            userRole: req.user.role,
            allowedRoles,
            method: req.method
          }
        });
        
        return res.status(403).json({
          success: false,
          error: 'Emergency access not authorized for this role',
          code: 'EMERGENCY_ACCESS_ROLE_DENIED'
        });
      }
      
      // Check for emergency override header or parameter
      const emergencyReason = req.headers['x-emergency-reason'] as string || 
                             req.body.emergencyReason || 
                             req.query.emergencyReason as string;
      
      if (!emergencyReason && requiresJustification) {
        return res.status(400).json({
          success: false,
          error: 'Emergency justification required',
          code: 'EMERGENCY_JUSTIFICATION_REQUIRED'
        });
      }
      
      // Get vessel ID for emergency override
      const vesselId = req.params.vesselId || req.body.vesselId || req.query.vesselId;
      
      if (!vesselId) {
        return res.status(400).json({
          success: false,
          error: 'Vessel ID required for emergency access',
          code: 'VESSEL_ID_REQUIRED'
        });
      }
      
      // Verify user has access to the vessel
      if (!req.user.vessels.includes(vesselId)) {
        await logSecurityEvent({
          action: 'EMERGENCY_ACCESS_VESSEL_DENIED',
          resource: req.path,
          ipAddress: req.ip,
          userId: req.user.id,
          severity: 'HIGH',
          metadata: {
            requestedVesselId: vesselId,
            userVessels: req.user.vessels,
            emergencyReason,
            method: req.method
          }
        });
        
        return res.status(403).json({
          success: false,
          error: 'Emergency access denied - no vessel authorization',
          code: 'EMERGENCY_VESSEL_ACCESS_DENIED'
        });
      }
      
      // Create emergency override record
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + maxDuration);
      
      const emergencyOverride = await prisma.emergencyOverride.create({
        data: {
          userId: req.user.id,
          vesselId,
          reason: emergencyReason,
          expiresAt,
          isActive: true,
          requiresPostApproval: requiresPostApproval,
          metadata: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            resource: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
          }
        }
      });
      
      // Log emergency access granted
      await logSecurityEvent({
        action: 'EMERGENCY_ACCESS_GRANTED',
        resource: req.path,
        ipAddress: req.ip,
        userId: req.user.id,
        severity: 'CRITICAL',
        metadata: {
          emergencyOverrideId: emergencyOverride.id,
          vesselId,
          reason: emergencyReason,
          expiresAt,
          requiresPostApproval,
          method: req.method
        }
      });
      
      // Log compliance event for maritime regulations
      await auditComplianceEvent({
        regulation: 'SOLAS',
        action: 'EMERGENCY_OVERRIDE_ACTIVATED',
        vesselId,
        userId: req.user.id,
        complianceStatus: 'PENDING',
        metadata: {
          emergencyOverrideId: emergencyOverride.id,
          reason: emergencyReason,
          requiresPostApproval
        }
      });
      
      // Add emergency override info to request
      req.emergencyOverride = {
        id: emergencyOverride.id,
        reason: emergencyReason,
        expiresAt,
        requiresPostApproval
      };
      
      // Set response headers to indicate emergency access
      res.setHeader('X-Emergency-Access', 'true');
      res.setHeader('X-Emergency-Override-Id', emergencyOverride.id);
      res.setHeader('X-Emergency-Expires', expiresAt.toISOString());
      
      if (requiresPostApproval) {
        res.setHeader('X-Post-Approval-Required', 'true');
      }
      
      next();
    } catch (error) {
      console.error('Emergency access middleware error:', error);
      
      await logSecurityEvent({
        action: 'EMERGENCY_ACCESS_ERROR',
        resource: req.path,
        ipAddress: req.ip,
        userId: req.user?.id,
        severity: 'HIGH',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          method: req.method
        }
      });
      
      return res.status(500).json({
        success: false,
        error: 'Emergency access validation error',
        code: 'EMERGENCY_ACCESS_ERROR'
      });
    }
  };
};

/**
 * Validate existing emergency override
 */
export const validateEmergencyOverride = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const overrideId = req.headers['x-emergency-override-id'] as string;
    
    if (!overrideId) {
      return next();
    }
    
    const override = await prisma.emergencyOverride.findUnique({
      where: { id: overrideId },
      include: {
        user: {
          select: { id: true, email: true, role: true }
        },
        vessel: {
          select: { id: true, name: true }
        }
      }
    });
    
    if (!override) {
      return res.status(404).json({
        success: false,
        error: 'Emergency override not found',
        code: 'EMERGENCY_OVERRIDE_NOT_FOUND'
      });
    }
    
    if (!override.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Emergency override is no longer active',
        code: 'EMERGENCY_OVERRIDE_INACTIVE'
      });
    }
    
    if (override.expiresAt < new Date()) {
      // Automatically deactivate expired override
      await prisma.emergencyOverride.update({
        where: { id: overrideId },
        data: { isActive: false }
      });
      
      return res.status(403).json({
        success: false,
        error: 'Emergency override has expired',
        code: 'EMERGENCY_OVERRIDE_EXPIRED'
      });
    }
    
    // Add override info to request
    req.emergencyOverride = {
      id: override.id,
      reason: override.reason,
      expiresAt: override.expiresAt,
      requiresPostApproval: override.requiresPostApproval
    };
    
    next();
  } catch (error) {
    console.error('Emergency override validation error:', error);
    next();
  }
};

/**
 * Require post-approval for emergency actions
 */
export const requirePostApproval = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.emergencyOverride?.requiresPostApproval) {
      return next();
    }
    
    // Check if post-approval has been provided
    const postApprovalBy = req.headers['x-post-approval-by'] as string;
    const postApprovalReason = req.headers['x-post-approval-reason'] as string;
    
    if (!postApprovalBy || !postApprovalReason) {
      return res.status(400).json({
        success: false,
        error: 'Post-approval documentation required for emergency action',
        code: 'POST_APPROVAL_REQUIRED',
        metadata: {
          emergencyOverrideId: req.emergencyOverride.id,
          requiredHeaders: ['x-post-approval-by', 'x-post-approval-reason']
        }
      });
    }
    
    // Validate post-approval authority
    const approver = await prisma.user.findUnique({
      where: { email: postApprovalBy },
      select: { id: true, role: true, isActive: true }
    });
    
    if (!approver || !approver.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Invalid post-approval authority',
        code: 'INVALID_POST_APPROVAL_AUTHORITY'
      });
    }
    
    const authorizedRoles = ['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'ADMIN'];
    if (!authorizedRoles.includes(approver.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient authority for post-approval',
        code: 'INSUFFICIENT_POST_APPROVAL_AUTHORITY'
      });
    }
    
    // Record post-approval
    await prisma.emergencyOverride.update({
      where: { id: req.emergencyOverride.id },
      data: {
        approvedBy: approver.id,
        approvedAt: new Date(),
        postApprovalReason: postApprovalReason,
        metadata: {
          ...req.emergencyOverride,
          postApproval: {
            approvedBy: postApprovalBy,
            approvedAt: new Date().toISOString(),
            reason: postApprovalReason,
            ipAddress: req.ip
          }
        }
      }
    });
    
    // Log post-approval
    await logSecurityEvent({
      action: 'EMERGENCY_POST_APPROVAL',
      resource: req.path,
      ipAddress: req.ip,
      userId: req.user?.id,
      severity: 'HIGH',
      metadata: {
        emergencyOverrideId: req.emergencyOverride.id,
        approvedBy: postApprovalBy,
        approverId: approver.id,
        reason: postApprovalReason,
        method: req.method
      }
    });
    
    // Update compliance status
    await auditComplianceEvent({
      regulation: 'SOLAS',
      action: 'EMERGENCY_OVERRIDE_POST_APPROVED',
      vesselId: req.params.vesselId || req.body.vesselId,
      userId: req.user?.id,
      complianceStatus: 'COMPLIANT',
      metadata: {
        emergencyOverrideId: req.emergencyOverride.id,
        approvedBy: postApprovalBy,
        reason: postApprovalReason
      }
    });
    
    next();
  } catch (error) {
    console.error('Post-approval validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Post-approval validation error',
      code: 'POST_APPROVAL_ERROR'
    });
  }
};

/**
 * Deactivate emergency override
 */
export const deactivateEmergencyOverride = async (overrideId: string, reason?: string): Promise<void> => {
  try {
    await prisma.emergencyOverride.update({
      where: { id: overrideId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivationReason: reason
      }
    });
    
    await logSecurityEvent({
      action: 'EMERGENCY_OVERRIDE_DEACTIVATED',
      resource: 'emergency',
      severity: 'MEDIUM',
      metadata: {
        emergencyOverrideId: overrideId,
        reason
      }
    });
  } catch (error) {
    console.error('Error deactivating emergency override:', error);
  }
};

/**
 * Clean up expired emergency overrides
 */
export const cleanupExpiredOverrides = async (): Promise<number> => {
  try {
    const result = await prisma.emergencyOverride.updateMany({
      where: {
        isActive: true,
        expiresAt: { lt: new Date() }
      },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivationReason: 'Expired'
      }
    });
    
    if (result.count > 0) {
      await logSecurityEvent({
        action: 'EMERGENCY_OVERRIDES_EXPIRED',
        resource: 'emergency',
        severity: 'LOW',
        metadata: {
          expiredCount: result.count
        }
      });
    }
    
    return result.count;
  } catch (error) {
    console.error('Error cleaning up expired overrides:', error);
    return 0;
  }
};

// Extend Express Request type to include emergency override info
declare global {
  namespace Express {
    interface Request {
      emergencyOverride?: {
        id: string;
        reason: string;
        expiresAt: Date;
        requiresPostApproval: boolean;
      };
    }
  }
}

// Set up periodic cleanup (every hour)
setInterval(cleanupExpiredOverrides, 60 * 60 * 1000);