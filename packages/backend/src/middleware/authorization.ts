import { Request, Response, NextFunction } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { PermissionService } from '../services/permissionService';
import { DelegationService } from '../services/delegationService';
import { AuditService } from '../services/auditService';

const prisma = new PrismaClient();

/**
 * Role-based authorization middleware
 */
export const authorizeRole = (requiredRoles: string | string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      const userRole = req.user.role;
      
      // Check if user has required role
      if (!roles.includes(userRole)) {
        // Log unauthorized access attempt
        await logSecurityEvent({
          action: 'UNAUTHORIZED_ROLE_ACCESS',
          resource: req.path,
          ipAddress: req.ip,
          userId: req.user.id,
          metadata: {
            userRole,
            requiredRoles: roles,
            method: req.method
          }
        });
        
        return res.status(403).json({
          success: false,
          error: 'Insufficient role permissions',
          code: 'ROLE_INSUFFICIENT'
        });
      }
      
      next();
    } catch (error) {
      console.error('Authorization middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization error',
        code: 'AUTH_ERROR'
      });
    }
  };
};

/**
 * Permission-based authorization middleware
 */
export const authorizePermission = (requiredPermissions: string | string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
      const userPermissions = req.user.permissions;
      
      // Check if user has at least one required permission
      const hasPermission = permissions.some(permission => 
        userPermissions.includes(permission)
      );
      
      if (!hasPermission) {
        // Log unauthorized access attempt
        await logSecurityEvent({
          action: 'UNAUTHORIZED_PERMISSION_ACCESS',
          resource: req.path,
          ipAddress: req.ip,
          userId: req.user.id,
          metadata: {
            userPermissions,
            requiredPermissions: permissions,
            method: req.method
          }
        });
        
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_INSUFFICIENT'
        });
      }
      
      next();
    } catch (error) {
      console.error('Permission authorization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization error',
        code: 'AUTH_ERROR'
      });
    }
  };
};

/**
 * Role hierarchy authorization - allows higher roles to access lower role resources
 */
export const authorizeRoleHierarchy = (minimumRole: string) => {
  const roleHierarchy = {
    'VESSEL_CREW': 1,
    'CHIEF_ENGINEER': 2,
    'CAPTAIN': 3,
    'SUPERINTENDENT': 4,
    'PROCUREMENT_MANAGER': 5,
    'FINANCE_TEAM': 6,
    'ADMIN': 7
  };
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      const userRoleLevel = roleHierarchy[req.user.role as keyof typeof roleHierarchy];
      const requiredRoleLevel = roleHierarchy[minimumRole as keyof typeof roleHierarchy];
      
      if (!userRoleLevel || !requiredRoleLevel) {
        return res.status(500).json({
          success: false,
          error: 'Invalid role configuration',
          code: 'ROLE_CONFIG_ERROR'
        });
      }
      
      if (userRoleLevel < requiredRoleLevel) {
        // Log unauthorized access attempt
        await logSecurityEvent({
          action: 'UNAUTHORIZED_HIERARCHY_ACCESS',
          resource: req.path,
          ipAddress: req.ip,
          userId: req.user.id,
          metadata: {
            userRole: req.user.role,
            userRoleLevel,
            minimumRole,
            requiredRoleLevel,
            method: req.method
          }
        });
        
        return res.status(403).json({
          success: false,
          error: 'Insufficient role level',
          code: 'ROLE_LEVEL_INSUFFICIENT'
        });
      }
      
      next();
    } catch (error) {
      console.error('Role hierarchy authorization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization error',
        code: 'AUTH_ERROR'
      });
    }
  };
};

/**
 * Helper function to log security events
 */
async function logSecurityEvent(event: {
  action: string;
  resource: string;
  ipAddress?: string;
  userId?: string;
  metadata?: any;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: event.userId,
        action: event.action as any, // Cast to AuditAction enum
        resource: event.resource,
        ipAddress: event.ipAddress,
        metadata: event.metadata || {}
      }
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}