import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyAccessToken, extractTokenFromHeader, isTokenNearExpiry, generateAccessToken } from '../utils/jwt.js';
import { RefreshTokenService } from '../services/refreshTokenService.js';

const prisma = new PrismaClient();

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        vessels: string[];
        permissions: string[];
        isActive: boolean;
      };
    }
  }
}

/**
 * Authentication middleware with automatic token refresh
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
    }
    
    // Verify the access token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error: any) {
      // Log failed authentication attempt
      await logSecurityEvent({
        action: 'TOKEN_VALIDATION_FAILED',
        resource: req.path,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          error: error.message,
          token: token.substring(0, 10) + '...' // Log partial token for debugging
        }
      });
      
      return res.status(403).json({ 
        success: false,
        error: 'Invalid or expired token',
        code: 'TOKEN_INVALID'
      });
    }
    
    // Get user from database to ensure they're still active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        vessels: {
          where: { isActive: true },
          select: { vesselId: true }
        },
        permissions: {
          include: {
            permission: {
              select: { name: true }
            }
          }
        }
      }
    });
    
    if (!user || !user.isActive) {
      await logSecurityEvent({
        action: 'INACTIVE_USER_ACCESS_ATTEMPT',
        resource: req.path,
        ipAddress: req.ip,
        userId: decoded.userId,
        metadata: {
          userExists: !!user,
          userActive: user?.isActive
        }
      });
      
      return res.status(403).json({ 
        success: false,
        error: 'User account is inactive',
        code: 'USER_INACTIVE'
      });
    }
    
    // Check if token is near expiry and refresh if needed
    if (isTokenNearExpiry(token)) {
      try {
        // Look for refresh token in cookies or header
        const refreshToken = req.cookies?.refreshToken || req.headers['x-refresh-token'];
        
        if (refreshToken) {
          const newAccessToken = await RefreshTokenService.validateRefreshToken(refreshToken);
          if (newAccessToken) {
            // Generate new access token
            const vessels = user.vessels.map(v => v.vesselId);
            const permissions = user.permissions.map(p => p.permission.name);
            
            const newToken = generateAccessToken({
              userId: user.id,
              email: user.email,
              role: user.role,
              vessels,
              permissions
            });
            
            // Send new token in response header
            res.setHeader('X-New-Token', newToken);
          }
        }
      } catch (error) {
        // Log but don't fail the request - token refresh is optional
        console.warn('Token refresh failed:', error);
      }
    }
    
    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      vessels: user.vessels.map(v => v.vesselId),
      permissions: user.permissions.map(p => p.permission.name),
      isActive: user.isActive
    };
    
    // Log successful authentication
    await logSecurityEvent({
      action: 'TOKEN_AUTHENTICATED',
      resource: req.path,
      ipAddress: req.ip,
      userId: user.id,
      metadata: {
        method: req.method,
        userAgent: req.get('User-Agent')
      }
    });
    
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    
    await logSecurityEvent({
      action: 'AUTHENTICATION_ERROR',
      resource: req.path,
      ipAddress: req.ip,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    
    return res.status(500).json({ 
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);
  
  if (!token) {
    return next();
  }
  
  // Use the main authentication middleware if token is provided
  return authenticateToken(req, res, next);
};

/**
 * Helper function to log security events
 */
async function logSecurityEvent(event: {
  action: string;
  resource: string;
  ipAddress?: string;
  userId?: string;
  userAgent?: string;
  metadata?: any;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: event.userId,
        action: event.action as any, // Cast to AuditAction enum
        resource: event.resource,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata || {}
      }
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}