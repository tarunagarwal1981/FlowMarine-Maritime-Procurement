import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Validate vessel access middleware
 */
export const validateVesselAccess = (vesselIdParam: string = 'vesselId') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      // Get vessel ID from params, body, or query
      const vesselId = req.params[vesselIdParam] || 
                      req.body[vesselIdParam] || 
                      req.query[vesselIdParam];
      
      if (!vesselId) {
        return res.status(400).json({
          success: false,
          error: 'Vessel ID is required',
          code: 'VESSEL_ID_REQUIRED'
        });
      }
      
      // Check if user has access to this vessel
      const userVessels = req.user.vessels;
      
      // Admins and certain roles have access to all vessels
      const privilegedRoles = ['ADMIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER'];
      const hasPrivilegedRole = privilegedRoles.includes(req.user.role);
      
      if (!hasPrivilegedRole && !userVessels.includes(vesselId)) {
        // Log vessel access denial
        await logSecurityEvent({
          action: 'VESSEL_ACCESS_DENIED',
          resource: req.path,
          ipAddress: req.ip,
          userId: req.user.id,
          metadata: {
            requestedVesselId: vesselId,
            userVessels,
            userRole: req.user.role,
            method: req.method
          }
        });
        
        return res.status(403).json({
          success: false,
          error: 'Access denied to vessel',
          code: 'VESSEL_ACCESS_DENIED'
        });
      }
      
      // Verify vessel exists and is active
      const vessel = await prisma.vessel.findUnique({
        where: { id: vesselId },
        select: { id: true, name: true, isActive: true }
      });
      
      if (!vessel) {
        return res.status(404).json({
          success: false,
          error: 'Vessel not found',
          code: 'VESSEL_NOT_FOUND'
        });
      }
      
      if (!vessel.isActive) {
        return res.status(403).json({
          success: false,
          error: 'Vessel is inactive',
          code: 'VESSEL_INACTIVE'
        });
      }
      
      // Add vessel info to request for use in handlers
      req.vessel = {
        id: vessel.id,
        name: vessel.name
      };
      
      // Log successful vessel access
      await logSecurityEvent({
        action: 'VESSEL_ACCESS_GRANTED',
        resource: req.path,
        ipAddress: req.ip,
        userId: req.user.id,
        metadata: {
          vesselId: vessel.id,
          vesselName: vessel.name,
          method: req.method
        }
      });
      
      next();
    } catch (error) {
      console.error('Vessel access validation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Vessel access validation error',
        code: 'VESSEL_ACCESS_ERROR'
      });
    }
  };
};

/**
 * Validate multiple vessel access (for bulk operations)
 */
export const validateMultipleVesselAccess = (vesselIdsParam: string = 'vesselIds') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      // Get vessel IDs from params, body, or query
      let vesselIds = req.params[vesselIdsParam] || 
                     req.body[vesselIdsParam] || 
                     req.query[vesselIdsParam];
      
      if (!vesselIds) {
        return res.status(400).json({
          success: false,
          error: 'Vessel IDs are required',
          code: 'VESSEL_IDS_REQUIRED'
        });
      }
      
      // Ensure vesselIds is an array
      if (typeof vesselIds === 'string') {
        vesselIds = vesselIds.split(',');
      }
      
      if (!Array.isArray(vesselIds) || vesselIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid vessel IDs format',
          code: 'INVALID_VESSEL_IDS'
        });
      }
      
      // Check if user has access to all vessels
      const userVessels = req.user.vessels;
      const privilegedRoles = ['ADMIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER'];
      const hasPrivilegedRole = privilegedRoles.includes(req.user.role);
      
      if (!hasPrivilegedRole) {
        const unauthorizedVessels = vesselIds.filter(id => !userVessels.includes(id));
        
        if (unauthorizedVessels.length > 0) {
          // Log vessel access denial
          await logSecurityEvent({
            action: 'MULTIPLE_VESSEL_ACCESS_DENIED',
            resource: req.path,
            ipAddress: req.ip,
            userId: req.user.id,
            metadata: {
              requestedVesselIds: vesselIds,
              unauthorizedVessels,
              userVessels,
              userRole: req.user.role,
              method: req.method
            }
          });
          
          return res.status(403).json({
            success: false,
            error: 'Access denied to one or more vessels',
            code: 'MULTIPLE_VESSEL_ACCESS_DENIED',
            unauthorizedVessels
          });
        }
      }
      
      // Verify all vessels exist and are active
      const vessels = await prisma.vessel.findMany({
        where: { 
          id: { in: vesselIds },
          isActive: true
        },
        select: { id: true, name: true }
      });
      
      const foundVesselIds = vessels.map(v => v.id);
      const missingVessels = vesselIds.filter(id => !foundVesselIds.includes(id));
      
      if (missingVessels.length > 0) {
        return res.status(404).json({
          success: false,
          error: 'One or more vessels not found or inactive',
          code: 'VESSELS_NOT_FOUND',
          missingVessels
        });
      }
      
      // Add vessels info to request
      req.vessels = vessels;
      
      // Log successful vessel access
      await logSecurityEvent({
        action: 'MULTIPLE_VESSEL_ACCESS_GRANTED',
        resource: req.path,
        ipAddress: req.ip,
        userId: req.user.id,
        metadata: {
          vesselIds: foundVesselIds,
          vesselCount: vessels.length,
          method: req.method
        }
      });
      
      next();
    } catch (error) {
      console.error('Multiple vessel access validation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Vessel access validation error',
        code: 'VESSEL_ACCESS_ERROR'
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

// Extend Express Request type to include vessel info
declare global {
  namespace Express {
    interface Request {
      vessel?: {
        id: string;
        name: string;
      };
      vessels?: {
        id: string;
        name: string;
      }[];
    }
  }
}