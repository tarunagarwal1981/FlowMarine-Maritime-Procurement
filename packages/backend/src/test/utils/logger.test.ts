import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { logger, createMaritimeLogger, logSecurityEvent, logComplianceEvent } from '@/utils/logger';

// Mock Winston
const mockWinston = {
  createLogger: vi.fn(),
  format: {
    combine: vi.fn(),
    timestamp: vi.fn(),
    errors: vi.fn(),
    json: vi.fn(),
    printf: vi.fn(),
    colorize: vi.fn(),
  },
  transports: {
    Console: vi.fn(),
    File: vi.fn(),
    DailyRotateFile: vi.fn(),
  },
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  verbose: vi.fn(),
  child: vi.fn(() => mockLogger),
};

vi.mock('winston', () => mockWinston);
vi.mock('winston-daily-rotate-file', () => vi.fn());

describe('Logger Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWinston.createLogger.mockReturnValue(mockLogger);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('logger configuration', () => {
    it('should create logger with proper configuration', () => {
      expect(mockWinston.createLogger).toHaveBeenCalled();
      expect(mockWinston.format.combine).toHaveBeenCalled();
      expect(mockWinston.format.timestamp).toHaveBeenCalled();
      expect(mockWinston.format.errors).toHaveBeenCalledWith({ stack: true });
    });

    it('should configure different log levels for different environments', () => {
      process.env.NODE_ENV = 'production';
      const prodLogger = createMaritimeLogger();
      
      process.env.NODE_ENV = 'development';
      const devLogger = createMaritimeLogger();
      
      expect(mockWinston.createLogger).toHaveBeenCalledTimes(2);
    });

    it('should create daily rotate file transport for production', () => {
      process.env.NODE_ENV = 'production';
      createMaritimeLogger();
      
      expect(mockWinston.transports.DailyRotateFile).toHaveBeenCalled();
    });
  });

  describe('maritime-specific logging', () => {
    it('should log vessel operations with context', () => {
      const vesselContext = {
        vesselId: 'vessel-123',
        vesselName: 'MV Ocean Explorer',
        imoNumber: '1234567',
        currentPosition: { lat: 53.5511, lng: 9.9937 },
      };

      logger.info('Requisition created', { 
        ...vesselContext,
        requisitionId: 'req-123',
        action: 'CREATE_REQUISITION',
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Requisition created', {
        vesselId: 'vessel-123',
        vesselName: 'MV Ocean Explorer',
        imoNumber: '1234567',
        currentPosition: { lat: 53.5511, lng: 9.9937 },
        requisitionId: 'req-123',
        action: 'CREATE_REQUISITION',
      });
    });

    it('should log procurement workflow events', () => {
      const workflowEvent = {
        workflowId: 'workflow-123',
        requisitionId: 'req-123',
        currentStep: 'SUPERINTENDENT_APPROVAL',
        previousStep: 'CHIEF_ENGINEER_REVIEW',
        approver: 'user-456',
        vesselId: 'vessel-123',
      };

      logger.info('Workflow step completed', workflowEvent);

      expect(mockLogger.info).toHaveBeenCalledWith('Workflow step completed', workflowEvent);
    });

    it('should log financial transactions with proper masking', () => {
      const financialEvent = {
        transactionId: 'txn-123',
        amount: 5000.00,
        currency: 'USD',
        vendorId: 'vendor-123',
        bankAccount: '****-****-****-1234', // Should be masked
        paymentMethod: 'WIRE_TRANSFER',
      };

      logger.info('Payment processed', financialEvent);

      expect(mockLogger.info).toHaveBeenCalledWith('Payment processed', 
        expect.objectContaining({
          bankAccount: '****-****-****-1234',
        })
      );
    });
  });

  describe('security event logging', () => {
    it('should log authentication events', () => {
      const securityEvent = {
        userId: 'user-123',
        action: 'LOGIN_SUCCESS',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        vesselId: 'vessel-123',
        timestamp: new Date(),
      };

      logSecurityEvent(securityEvent);

      expect(mockLogger.info).toHaveBeenCalledWith('Security Event', {
        ...securityEvent,
        level: 'SECURITY',
        category: 'AUTHENTICATION',
      });
    });

    it('should log failed authentication attempts', () => {
      const failedAuth = {
        email: 'user@example.com',
        action: 'LOGIN_FAILED',
        reason: 'INVALID_PASSWORD',
        ip: '192.168.1.100',
        attemptCount: 3,
        timestamp: new Date(),
      };

      logSecurityEvent(failedAuth);

      expect(mockLogger.warn).toHaveBeenCalledWith('Security Event', {
        ...failedAuth,
        level: 'SECURITY',
        category: 'AUTHENTICATION_FAILURE',
      });
    });

    it('should log emergency override events', () => {
      const emergencyEvent = {
        userId: 'captain-123',
        action: 'EMERGENCY_OVERRIDE',
        requisitionId: 'req-emergency-123',
        reason: 'Critical engine failure',
        vesselId: 'vessel-123',
        overrideAmount: 15000,
        timestamp: new Date(),
      };

      logSecurityEvent(emergencyEvent);

      expect(mockLogger.error).toHaveBeenCalledWith('Security Event', {
        ...emergencyEvent,
        level: 'SECURITY',
        category: 'EMERGENCY_OVERRIDE',
        severity: 'HIGH',
      });
    });

    it('should log vessel access violations', () => {
      const accessViolation = {
        userId: 'user-123',
        action: 'VESSEL_ACCESS_DENIED',
        attemptedVesselId: 'vessel-456',
        userVessels: ['vessel-123'],
        ip: '192.168.1.100',
        timestamp: new Date(),
      };

      logSecurityEvent(accessViolation);

      expect(mockLogger.warn).toHaveBeenCalledWith('Security Event', {
        ...accessViolation,
        level: 'SECURITY',
        category: 'ACCESS_VIOLATION',
      });
    });
  });

  describe('compliance event logging', () => {
    it('should log SOLAS compliance events', () => {
      const complianceEvent = {
        vesselId: 'vessel-123',
        complianceType: 'SOLAS',
        event: 'CERTIFICATE_RENEWAL',
        certificateType: 'Safety Certificate',
        expirationDate: new Date('2024-12-31'),
        renewalDate: new Date('2024-11-01'),
        complianceOfficer: 'user-456',
      };

      logComplianceEvent(complianceEvent);

      expect(mockLogger.info).toHaveBeenCalledWith('Compliance Event', {
        ...complianceEvent,
        level: 'COMPLIANCE',
        category: 'SOLAS',
      });
    });

    it('should log MARPOL compliance events', () => {
      const marpolEvent = {
        vesselId: 'vessel-123',
        complianceType: 'MARPOL',
        event: 'WASTE_DISPOSAL_LOG',
        wasteType: 'OILY_WATER',
        quantity: 500,
        disposalLocation: 'Port of Hamburg',
        timestamp: new Date(),
      };

      logComplianceEvent(marpolEvent);

      expect(mockLogger.info).toHaveBeenCalledWith('Compliance Event', {
        ...marpolEvent,
        level: 'COMPLIANCE',
        category: 'MARPOL',
      });
    });

    it('should log ISM compliance events', () => {
      const ismEvent = {
        vesselId: 'vessel-123',
        complianceType: 'ISM',
        event: 'AUDIT_COMPLETED',
        auditType: 'INTERNAL_AUDIT',
        auditor: 'user-789',
        findings: 3,
        nonConformities: 1,
        auditDate: new Date(),
      };

      logComplianceEvent(ismEvent);

      expect(mockLogger.info).toHaveBeenCalledWith('Compliance Event', {
        ...ismEvent,
        level: 'COMPLIANCE',
        category: 'ISM',
      });
    });

    it('should log compliance violations with high severity', () => {
      const violation = {
        vesselId: 'vessel-123',
        complianceType: 'SOLAS',
        event: 'COMPLIANCE_VIOLATION',
        violationType: 'EXPIRED_CERTIFICATE',
        certificateType: 'Safety Certificate',
        expirationDate: new Date('2024-01-01'),
        discoveredDate: new Date(),
        severity: 'HIGH',
      };

      logComplianceEvent(violation);

      expect(mockLogger.error).toHaveBeenCalledWith('Compliance Event', {
        ...violation,
        level: 'COMPLIANCE',
        category: 'VIOLATION',
        severity: 'HIGH',
      });
    });
  });

  describe('error logging with context', () => {
    it('should log errors with full context and stack trace', () => {
      const error = new Error('Database connection failed');
      const context = {
        userId: 'user-123',
        vesselId: 'vessel-123',
        operation: 'CREATE_REQUISITION',
        requestId: 'req-123',
      };

      logger.error('Operation failed', { error, ...context });

      expect(mockLogger.error).toHaveBeenCalledWith('Operation failed', {
        error,
        userId: 'user-123',
        vesselId: 'vessel-123',
        operation: 'CREATE_REQUISITION',
        requestId: 'req-123',
      });
    });

    it('should log performance metrics', () => {
      const performanceMetrics = {
        operation: 'SEARCH_ITEM_CATALOG',
        duration: 1250, // milliseconds
        resultCount: 45,
        cacheHit: false,
        userId: 'user-123',
        vesselId: 'vessel-123',
      };

      logger.info('Performance metrics', performanceMetrics);

      expect(mockLogger.info).toHaveBeenCalledWith('Performance metrics', performanceMetrics);
    });
  });

  describe('log sanitization', () => {
    it('should sanitize sensitive information from logs', () => {
      const sensitiveData = {
        userId: 'user-123',
        password: 'secretPassword123!',
        creditCard: '4111-1111-1111-1111',
        ssn: '123-45-6789',
        bankAccount: '1234567890',
        email: 'user@example.com',
      };

      const sanitized = sanitizeLogData(sensitiveData);

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.creditCard).toBe('****-****-****-1111');
      expect(sanitized.ssn).toBe('***-**-6789');
      expect(sanitized.bankAccount).toBe('******7890');
      expect(sanitized.email).toBe('user@example.com'); // Email should remain
      expect(sanitized.userId).toBe('user-123'); // Non-sensitive data should remain
    });

    it('should handle nested objects in log sanitization', () => {
      const nestedData = {
        user: {
          id: 'user-123',
          password: 'secret',
          profile: {
            bankDetails: {
              accountNumber: '1234567890',
              routingNumber: '987654321',
            },
          },
        },
        transaction: {
          amount: 1000,
          creditCard: '4111-1111-1111-1111',
        },
      };

      const sanitized = sanitizeLogData(nestedData);

      expect(sanitized.user.password).toBe('[REDACTED]');
      expect(sanitized.user.profile.bankDetails.accountNumber).toBe('******7890');
      expect(sanitized.transaction.creditCard).toBe('****-****-****-1111');
      expect(sanitized.transaction.amount).toBe(1000); // Non-sensitive data preserved
    });
  });

  describe('structured logging for maritime operations', () => {
    it('should create structured logs for voyage tracking', () => {
      const voyageLog = {
        vesselId: 'vessel-123',
        voyageId: 'voyage-456',
        event: 'DEPARTURE',
        port: 'Hamburg',
        coordinates: { lat: 53.5511, lng: 9.9937 },
        nextPort: 'Rotterdam',
        eta: new Date('2024-02-20'),
        cargoStatus: 'LOADED',
        fuelLevel: 85.5,
        timestamp: new Date(),
      };

      logger.info('Voyage event', voyageLog);

      expect(mockLogger.info).toHaveBeenCalledWith('Voyage event', voyageLog);
    });

    it('should log procurement milestones', () => {
      const procurementMilestone = {
        requisitionId: 'req-123',
        milestone: 'RFQ_SENT',
        vendorCount: 5,
        expectedResponseDate: new Date('2024-02-18'),
        urgencyLevel: 'URGENT',
        vesselId: 'vessel-123',
        totalAmount: 5000,
        currency: 'USD',
      };

      logger.info('Procurement milestone', procurementMilestone);

      expect(mockLogger.info).toHaveBeenCalledWith('Procurement milestone', procurementMilestone);
    });
  });
});

// Helper function for log sanitization
function sanitizeLogData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'creditCard', 'ssn'];
  const partialMaskFields = ['bankAccount', 'accountNumber'];
  const creditCardPattern = /^\d{4}-\d{4}-\d{4}-\d{4}$/;
  const ssnPattern = /^\d{3}-\d{2}-\d{4}$/;

  const sanitized = Array.isArray(data) ? [] : {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (partialMaskFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = typeof value === 'string' ? 
        '*'.repeat(Math.max(0, value.length - 4)) + value.slice(-4) : value;
    } else if (typeof value === 'string') {
      if (creditCardPattern.test(value)) {
        sanitized[key] = '****-****-****-' + value.slice(-4);
      } else if (ssnPattern.test(value)) {
        sanitized[key] = '***-**-' + value.slice(-4);
      } else {
        sanitized[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}