import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore: RateLimitStore = {};

/**
 * General rate limiter middleware
 */
export const rateLimiter = (config: RateLimitConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = generateRateLimitKey(req);
      const now = Date.now();
      const windowStart = now - config.windowMs;
      
      // Clean up old entries
      if (rateLimitStore[key] && rateLimitStore[key].resetTime < now) {
        delete rateLimitStore[key];
      }
      
      // Initialize or get current count
      if (!rateLimitStore[key]) {
        rateLimitStore[key] = {
          count: 0,
          resetTime: now + config.windowMs
        };
      }
      
      const current = rateLimitStore[key];
      
      // Check if limit exceeded
      if (current.count >= config.maxRequests) {
        const resetTimeSeconds = Math.ceil((current.resetTime - now) / 1000);
        
        // Log rate limit exceeded
        await logSecurityEvent({
          action: 'RATE_LIMIT_EXCEEDED',
          resource: req.path,
          ipAddress: req.ip,
          userId: req.user?.id,
          metadata: {
            limit: config.maxRequests,
            windowMs: config.windowMs,
            resetTimeSeconds,
            method: req.method
          }
        });
        
        return res.status(429).json({
          success: false,
          error: config.message || 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: resetTimeSeconds
        });
      }
      
      // Increment counter
      current.count++;
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - current.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(current.resetTime / 1000));
      
      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      next(); // Don't block requests on rate limiter errors
    }
  };
};

/**
 * Vessel operations rate limiter (more lenient for vessel crews)
 */
export const vesselRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000, // Higher limit for vessel operations
  message: 'Too many requests from vessel. Please try again later.'
});

/**
 * Shore operations rate limiter (stricter for shore-based users)
 */
export const shoreRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 500, // Lower limit for shore operations
  message: 'Too many requests. Please try again later.'
});

/**
 * Authentication rate limiter (very strict for login attempts)
 */
export const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // Very low limit for auth attempts
  message: 'Too many authentication attempts. Please try again later.'
});

/**
 * Financial operations rate limiter (strictest for financial endpoints)
 */
export const financialRateLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 100, // Very low limit for financial operations
  message: 'Too many financial operation requests. Please try again later.'
});

/**
 * API rate limiter (general API usage)
 */
export const apiRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000, // General API limit
  message: 'API rate limit exceeded. Please try again later.'
});

/**
 * Adaptive rate limiter based on user role and vessel status
 */
export const adaptiveRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      // Use strict limits for unauthenticated requests
      return authRateLimiter(req, res, next);
    }
    
    // Determine if user is on vessel or shore
    const isVesselUser = ['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN'].includes(req.user.role);
    
    // Check if this is a financial operation
    const isFinancialOperation = req.path.includes('/financial') || 
                                req.path.includes('/payment') || 
                                req.path.includes('/invoice');
    
    if (isFinancialOperation) {
      return financialRateLimiter(req, res, next);
    }
    
    if (isVesselUser) {
      return vesselRateLimiter(req, res, next);
    } else {
      return shoreRateLimiter(req, res, next);
    }
  } catch (error) {
    console.error('Adaptive rate limiter error:', error);
    next(); // Don't block requests on rate limiter errors
  }
};

/**
 * Generate rate limit key based on IP and user
 */
function generateRateLimitKey(req: Request): string {
  const ip = req.ip || 'unknown';
  const userId = req.user?.id || 'anonymous';
  const path = req.path;
  
  return `${ip}:${userId}:${path}`;
}

/**
 * Clean up expired rate limit entries (should be called periodically)
 */
export const cleanupRateLimitStore = (): void => {
  const now = Date.now();
  const keys = Object.keys(rateLimitStore);
  
  for (const key of keys) {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  }
};

/**
 * Get rate limit status for a request
 */
export const getRateLimitStatus = (req: Request, config: RateLimitConfig): {
  limit: number;
  remaining: number;
  resetTime: number;
  exceeded: boolean;
} => {
  const key = generateRateLimitKey(req);
  const current = rateLimitStore[key];
  
  if (!current) {
    return {
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
      exceeded: false
    };
  }
  
  return {
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - current.count),
    resetTime: current.resetTime,
    exceeded: current.count >= config.maxRequests
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

// Set up periodic cleanup (every 5 minutes)
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);