import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logSecurityEvent } from './auditLogger.js';

const prisma = new PrismaClient();

interface IPRestrictionConfig {
  allowedIPs?: string[];
  blockedIPs?: string[];
  allowedNetworks?: string[];
  blockedNetworks?: string[];
  requireWhitelist?: boolean;
}

/**
 * IP restriction middleware for financial operations
 */
export const ipRestriction = (config: IPRestrictionConfig = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientIP = getClientIP(req);
      
      if (!clientIP) {
        await logSecurityEvent({
          action: 'IP_UNKNOWN',
          resource: req.path,
          userId: req.user?.id,
          severity: 'HIGH',
          metadata: {
            headers: req.headers,
            method: req.method
          }
        });
        
        return res.status(403).json({
          success: false,
          error: 'Unable to determine client IP address',
          code: 'IP_UNKNOWN'
        });
      }
      
      // Check blocked IPs first
      if (config.blockedIPs && config.blockedIPs.includes(clientIP)) {
        await logSecurityEvent({
          action: 'IP_BLOCKED',
          resource: req.path,
          ipAddress: clientIP,
          userId: req.user?.id,
          severity: 'HIGH',
          metadata: {
            reason: 'IP in blocked list',
            method: req.method
          }
        });
        
        return res.status(403).json({
          success: false,
          error: 'Access denied from this IP address',
          code: 'IP_BLOCKED'
        });
      }
      
      // Check blocked networks
      if (config.blockedNetworks && isIPInNetworks(clientIP, config.blockedNetworks)) {
        await logSecurityEvent({
          action: 'IP_NETWORK_BLOCKED',
          resource: req.path,
          ipAddress: clientIP,
          userId: req.user?.id,
          severity: 'HIGH',
          metadata: {
            reason: 'IP in blocked network',
            blockedNetworks: config.blockedNetworks,
            method: req.method
          }
        });
        
        return res.status(403).json({
          success: false,
          error: 'Access denied from this network',
          code: 'IP_NETWORK_BLOCKED'
        });
      }
      
      // If whitelist is required, check allowed IPs and networks
      if (config.requireWhitelist) {
        const isAllowedIP = config.allowedIPs && config.allowedIPs.includes(clientIP);
        const isAllowedNetwork = config.allowedNetworks && isIPInNetworks(clientIP, config.allowedNetworks);
        
        if (!isAllowedIP && !isAllowedNetwork) {
          await logSecurityEvent({
            action: 'IP_NOT_WHITELISTED',
            resource: req.path,
            ipAddress: clientIP,
            userId: req.user?.id,
            severity: 'HIGH',
            metadata: {
              reason: 'IP not in whitelist',
              allowedIPs: config.allowedIPs,
              allowedNetworks: config.allowedNetworks,
              method: req.method
            }
          });
          
          return res.status(403).json({
            success: false,
            error: 'Access denied - IP not authorized',
            code: 'IP_NOT_WHITELISTED'
          });
        }
      }
      
      // Log successful IP validation for sensitive operations
      if (req.path.includes('/financial') || req.path.includes('/payment')) {
        await logSecurityEvent({
          action: 'IP_VALIDATED',
          resource: req.path,
          ipAddress: clientIP,
          userId: req.user?.id,
          severity: 'LOW',
          metadata: {
            method: req.method,
            userAgent: req.get('User-Agent')
          }
        });
      }
      
      next();
    } catch (error) {
      console.error('IP restriction middleware error:', error);
      
      await logSecurityEvent({
        action: 'IP_RESTRICTION_ERROR',
        resource: req.path,
        ipAddress: getClientIP(req),
        userId: req.user?.id,
        severity: 'MEDIUM',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          method: req.method
        }
      });
      
      return res.status(500).json({
        success: false,
        error: 'IP validation error',
        code: 'IP_VALIDATION_ERROR'
      });
    }
  };
};

/**
 * Financial operations IP restriction (stricter)
 */
export const financialIPRestriction = ipRestriction({
  requireWhitelist: process.env.NODE_ENV === 'production',
  allowedNetworks: process.env.FINANCIAL_ALLOWED_NETWORKS?.split(',') || [],
  blockedNetworks: [
    // Block common VPN/proxy networks
    '10.0.0.0/8',     // Private network (if not explicitly allowed)
    '172.16.0.0/12',  // Private network (if not explicitly allowed)
    '192.168.0.0/16'  // Private network (if not explicitly allowed)
  ]
});

/**
 * Admin operations IP restriction
 */
export const adminIPRestriction = ipRestriction({
  requireWhitelist: true,
  allowedIPs: process.env.ADMIN_ALLOWED_IPS?.split(',') || [],
  allowedNetworks: process.env.ADMIN_ALLOWED_NETWORKS?.split(',') || []
});

/**
 * Vessel operations IP restriction (more lenient)
 */
export const vesselIPRestriction = ipRestriction({
  requireWhitelist: false,
  blockedNetworks: [
    // Block known malicious networks
    '0.0.0.0/8',
    '127.0.0.0/8',
    '169.254.0.0/16',
    '224.0.0.0/4',
    '240.0.0.0/4'
  ]
});

/**
 * Geographic IP restriction based on country
 */
export const geoIPRestriction = (allowedCountries: string[], blockedCountries: string[] = []) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientIP = getClientIP(req);
      
      if (!clientIP) {
        return res.status(403).json({
          success: false,
          error: 'Unable to determine client location',
          code: 'GEO_IP_UNKNOWN'
        });
      }
      
      // In a real implementation, you would use a GeoIP service
      // For now, we'll skip this check in development
      if (process.env.NODE_ENV === 'development') {
        return next();
      }
      
      // TODO: Implement actual GeoIP lookup
      // const country = await getCountryFromIP(clientIP);
      
      // if (blockedCountries.includes(country)) {
      //   await logSecurityEvent({
      //     action: 'GEO_IP_BLOCKED',
      //     resource: req.path,
      //     ipAddress: clientIP,
      //     userId: req.user?.id,
      //     severity: 'HIGH',
      //     metadata: { country, blockedCountries }
      //   });
      //   
      //   return res.status(403).json({
      //     success: false,
      //     error: 'Access denied from this location',
      //     code: 'GEO_IP_BLOCKED'
      //   });
      // }
      
      next();
    } catch (error) {
      console.error('Geographic IP restriction error:', error);
      next(); // Don't block on geo-IP errors
    }
  };
};

/**
 * Dynamic IP restriction based on user behavior
 */
export const dynamicIPRestriction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next();
    }
    
    const clientIP = getClientIP(req);
    const userId = req.user.id;
    
    // Check for suspicious IP changes
    const recentLogins = await prisma.auditLog.findMany({
      where: {
        userId,
        action: 'LOGIN_SUCCESS',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    const recentIPs = recentLogins
      .map(log => log.ipAddress)
      .filter(ip => ip && ip !== clientIP);
    
    // If user is accessing from a new IP and has recent activity from other IPs
    if (recentIPs.length > 0 && !recentIPs.includes(clientIP)) {
      await logSecurityEvent({
        action: 'SUSPICIOUS_IP_CHANGE',
        resource: req.path,
        ipAddress: clientIP,
        userId,
        severity: 'MEDIUM',
        metadata: {
          recentIPs: recentIPs.slice(0, 3), // Log only first 3 for privacy
          method: req.method
        }
      });
      
      // For high-security operations, require additional verification
      if (req.path.includes('/financial') || req.path.includes('/admin')) {
        return res.status(403).json({
          success: false,
          error: 'Additional verification required for new location',
          code: 'NEW_LOCATION_VERIFICATION_REQUIRED'
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Dynamic IP restriction error:', error);
    next(); // Don't block on dynamic IP errors
  }
};

/**
 * Get client IP address from request
 */
function getClientIP(req: Request): string | null {
  // Check various headers for the real IP
  const xForwardedFor = req.headers['x-forwarded-for'];
  const xRealIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  
  if (typeof xForwardedFor === 'string') {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim();
  }
  
  if (typeof xRealIP === 'string') {
    return xRealIP.trim();
  }
  
  if (typeof cfConnectingIP === 'string') {
    return cfConnectingIP.trim();
  }
  
  // Fallback to connection remote address
  return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip || null;
}

/**
 * Check if IP is in any of the specified networks
 */
function isIPInNetworks(ip: string, networks: string[]): boolean {
  for (const network of networks) {
    if (isIPInNetwork(ip, network)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if IP is in a specific network (CIDR notation)
 */
function isIPInNetwork(ip: string, network: string): boolean {
  try {
    const [networkIP, prefixLength] = network.split('/');
    const prefix = parseInt(prefixLength, 10);
    
    if (isNaN(prefix) || prefix < 0 || prefix > 32) {
      return false;
    }
    
    const ipNum = ipToNumber(ip);
    const networkNum = ipToNumber(networkIP);
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    
    return (ipNum & mask) === (networkNum & mask);
  } catch (error) {
    console.error('Error checking IP in network:', error);
    return false;
  }
}

/**
 * Convert IP address to number
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    throw new Error('Invalid IP address format');
  }
  
  return parts.reduce((acc, part) => {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) {
      throw new Error('Invalid IP address part');
    }
    return (acc << 8) + num;
  }, 0) >>> 0;
}