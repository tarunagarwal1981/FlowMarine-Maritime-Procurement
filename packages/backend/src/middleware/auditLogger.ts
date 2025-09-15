import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditLogEntry {
  userId?: string;
  action: string;
  resource: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

/**
 * Comprehensive audit logging middleware
 */
export const auditLogger = (options: {
  logLevel?: 'ALL' | 'WRITE' | 'SENSITIVE';
  excludePaths?: string[];
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
} = {}) => {
  const {
    logLevel = 'WRITE',
    excludePaths = [],
    includeRequestBody = false,
    includeResponseBody = false
  } = options;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Skip excluded paths
    if (excludePaths.some(path => req.path.includes(path))) {
      return next();
    }
    
    // Determine if this request should be logged
    const shouldLog = shouldLogRequest(req, logLevel);
    
    if (!shouldLog) {
      return next();
    }
    
    // Capture original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody: any;
    
    // Override response methods to capture response data
    if (includeResponseBody) {
      res.send = function(body: any) {
        responseBody = body;
        return originalSend.call(this, body);
      };
      
      res.json = function(body: any) {
        responseBody = body;
        return originalJson.call(this, body);
      };
    }
    
    // Continue with request processing
    next();
    
    // Log after response is sent
    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        
        await logAuditEvent({
          userId: req.user?.id,
          action: determineAction(req, res),
          resource: req.path,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: {
            method: req.method,
            statusCode: res.statusCode,
            duration,
            query: req.query,
            params: req.params,
            requestBody: includeRequestBody ? sanitizeRequestBody(req.body) : undefined,
            responseBody: includeResponseBody ? sanitizeResponseBody(responseBody) : undefined,
            contentLength: res.get('Content-Length'),
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Audit logging error:', error);
      }
    });
  };
};

/**
 * Audit logger for specific actions
 */
export const auditAction = (action: string, metadata?: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await logAuditEvent({
        userId: req.user?.id,
        action,
        resource: req.path,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          method: req.method,
          query: req.query,
          params: req.params,
          customMetadata: metadata,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Audit action logging error:', error);
    }
    
    next();
  };
};

/**
 * Security event logger
 */
export const logSecurityEvent = async (event: {
  action: string;
  resource?: string;
  ipAddress?: string;
  userId?: string;
  userAgent?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: any;
}): Promise<void> => {
  try {
    await logAuditEvent({
      userId: event.userId,
      action: `SECURITY_${event.action}`,
      resource: event.resource || 'security',
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: {
        severity: event.severity || 'MEDIUM',
        securityEvent: true,
        ...event.metadata,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Security event logging error:', error);
  }
};

/**
 * Financial operation audit logger
 */
export const auditFinancialOperation = (operation: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Capture original response methods
    const originalJson = res.json;
    let responseData: any;
    
    res.json = function(body: any) {
      responseData = body;
      return originalJson.call(this, body);
    };
    
    next();
    
    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        
        await logAuditEvent({
          userId: req.user?.id,
          action: `FINANCIAL_${operation}`,
          resource: req.path,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: {
            method: req.method,
            statusCode: res.statusCode,
            duration,
            financialOperation: true,
            amount: req.body?.amount,
            currency: req.body?.currency,
            vesselId: req.body?.vesselId || req.params?.vesselId,
            success: res.statusCode >= 200 && res.statusCode < 300,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Financial audit logging error:', error);
      }
    });
  };
};

/**
 * Compliance audit logger for maritime regulations
 */
export const auditComplianceEvent = async (event: {
  regulation: 'SOLAS' | 'MARPOL' | 'ISM' | 'MLC' | 'STCW';
  action: string;
  vesselId?: string;
  userId?: string;
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
  metadata?: any;
}): Promise<void> => {
  try {
    await logAuditEvent({
      userId: event.userId,
      action: `COMPLIANCE_${event.regulation}_${event.action}`,
      resource: 'compliance',
      metadata: {
        regulation: event.regulation,
        complianceStatus: event.complianceStatus,
        vesselId: event.vesselId,
        complianceEvent: true,
        ...event.metadata,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Compliance audit logging error:', error);
  }
};

/**
 * Core audit logging function
 */
async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action as any, // Cast to AuditAction enum
        resource: entry.resource,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        metadata: entry.metadata || {}
      }
    });
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
    
    // Fallback to console logging for critical audit events
    console.log('AUDIT_FALLBACK:', JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry
    }));
  }
}

/**
 * Determine if request should be logged based on log level
 */
function shouldLogRequest(req: Request, logLevel: string): boolean {
  const method = req.method.toLowerCase();
  const path = req.path.toLowerCase();
  
  switch (logLevel) {
    case 'ALL':
      return true;
    
    case 'WRITE':
      return ['post', 'put', 'patch', 'delete'].includes(method);
    
    case 'SENSITIVE':
      return (
        ['post', 'put', 'patch', 'delete'].includes(method) &&
        (
          path.includes('/auth') ||
          path.includes('/financial') ||
          path.includes('/payment') ||
          path.includes('/user') ||
          path.includes('/admin')
        )
      );
    
    default:
      return false;
  }
}

/**
 * Determine action based on request and response
 */
function determineAction(req: Request, res: Response): string {
  const method = req.method.toUpperCase();
  const path = req.path;
  const statusCode = res.statusCode;
  
  // Determine base action from method and path
  let action = `${method}_${path.replace(/\//g, '_').replace(/[^a-zA-Z0-9_]/g, '').toUpperCase()}`;
  
  // Add status indicator
  if (statusCode >= 400) {
    action += '_FAILED';
  } else if (statusCode >= 200 && statusCode < 300) {
    action += '_SUCCESS';
  }
  
  return action;
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'refreshToken',
    'secret',
    'key',
    'bankAccount',
    'creditCard',
    'ssn',
    'taxId'
  ];
  
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Sanitize response body to remove sensitive information
 */
function sanitizeResponseBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'refreshToken',
    'secret',
    'key',
    'bankAccount',
    'creditCard'
  ];
  
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}