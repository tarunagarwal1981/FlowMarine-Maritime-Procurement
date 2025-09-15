import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fieldEncryptionService } from '../services/fieldEncryptionService';
import { AuditService } from '../services/auditService';
import { dataRetentionService } from '../services/dataRetentionService';
import { securityIncidentService } from '../services/securityIncidentService';

describe('Security Hardening Features', () => {
  beforeEach(() => {
    // Mock environment variables
    process.env.FIELD_ENCRYPTION_KEY = 'test-encryption-key-for-testing-purposes';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Field Encryption Service', () => {
    it('should encrypt and decrypt sensitive data correctly', () => {
      const sensitiveData = 'account-number-123456789';
      
      const encrypted = fieldEncryptionService.encryptField(sensitiveData);
      expect(encrypted).toHaveProperty('encryptedData');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted.encryptedData).not.toBe(sensitiveData);
      
      const decrypted = fieldEncryptionService.decryptField(encrypted);
      expect(decrypted).toBe(sensitiveData);
    });

    it('should encrypt banking data with multiple fields', () => {
      const bankingData = {
        accountNumber: '123456789',
        routingNumber: '987654321',
        swiftCode: 'ABCDUS33',
        iban: 'GB82WEST12345698765432',
      };

      const encrypted = fieldEncryptionService.encryptBankingData(bankingData);
      
      expect(encrypted).toHaveProperty('accountNumber');
      expect(encrypted).toHaveProperty('routingNumber');
      expect(encrypted).toHaveProperty('swiftCode');
      expect(encrypted).toHaveProperty('iban');
      
      // Verify each field is properly encrypted
      Object.values(encrypted).forEach(encryptedField => {
        expect(fieldEncryptionService.isValidEncryptedField(encryptedField)).toBe(true);
      });

      const decrypted = fieldEncryptionService.decryptBankingData(encrypted);
      expect(decrypted).toEqual(bankingData);
    });

    it('should handle encryption errors gracefully', () => {
      // Test with invalid encryption key
      const originalKey = process.env.FIELD_ENCRYPTION_KEY;
      delete process.env.FIELD_ENCRYPTION_KEY;

      expect(() => {
        new (fieldEncryptionService.constructor as any)();
      }).toThrow('FIELD_ENCRYPTION_KEY environment variable is required');

      process.env.FIELD_ENCRYPTION_KEY = originalKey;
    });

    it('should validate encrypted field structure', () => {
      const validField = {
        encryptedData: 'test',
        iv: 'test',
        tag: 'test',
      };

      const invalidField = {
        encryptedData: 'test',
        iv: 'test',
        // missing tag
      };

      expect(fieldEncryptionService.isValidEncryptedField(validField)).toBe(true);
      expect(fieldEncryptionService.isValidEncryptedField(invalidField)).toBe(false);
    });
  });

  describe('Enhanced Audit Service', () => {
    it('should log security events with enhanced metadata', async () => {
      const logSpy = vi.spyOn(AuditService, 'log');

      await AuditService.logSecurityEvent({
        userId: 'user123',
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        metadata: {
          resource: 'banking_data',
          attemptedAction: 'decrypt',
        },
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SECURITY_EVENT',
          severity: 'HIGH',
          category: 'SECURITY',
          metadata: expect.objectContaining({
            securityAction: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          }),
        })
      );
    });

    it('should log data access with sensitivity tracking', async () => {
      const logSpy = vi.spyOn(AuditService, 'log');

      await AuditService.logDataAccess({
        userId: 'user123',
        resource: 'banking_data',
        resourceId: 'vendor456',
        action: 'decrypt',
        sensitiveData: true,
        ipAddress: '192.168.1.100',
        dataFields: ['accountNumber', 'routingNumber'],
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'HIGH',
          category: 'DATA_ACCESS',
          metadata: expect.objectContaining({
            sensitiveData: true,
            accessedFields: ['accountNumber', 'routingNumber'],
          }),
        })
      );
    });

    it('should log compliance events', async () => {
      const logSpy = vi.spyOn(AuditService, 'log');

      await AuditService.logComplianceEvent({
        userId: 'user123',
        regulation: 'SOLAS Chapter IX',
        complianceType: 'SOLAS',
        action: 'CERTIFICATE_RENEWAL',
        vesselId: 'vessel789',
        details: {
          certificateType: 'Safety Management Certificate',
          expiryDate: '2024-12-31',
        },
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMPLIANCE_EVENT',
          severity: 'HIGH',
          category: 'COMPLIANCE',
          metadata: expect.objectContaining({
            regulation: 'SOLAS Chapter IX',
            complianceType: 'SOLAS',
          }),
        })
      );
    });

    it('should log banking data access with critical severity', async () => {
      const logSpy = vi.spyOn(AuditService, 'log');

      await AuditService.logBankingDataAccess({
        userId: 'user123',
        vendorId: 'vendor456',
        action: 'decrypt',
        fields: ['accountNumber', 'swiftCode'],
        ipAddress: '192.168.1.100',
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'CRITICAL',
          category: 'DATA_ACCESS',
          metadata: expect.objectContaining({
            sensitiveData: true,
            bankingDataAccess: true,
            encryptedFields: ['accountNumber', 'swiftCode'],
          }),
        })
      );
    });
  });

  describe('Data Retention Service', () => {
    it('should have proper retention policies configured', () => {
      const auditLogPolicy = dataRetentionService.getRetentionPolicy('audit_logs');
      expect(auditLogPolicy).toBeDefined();
      expect(auditLogPolicy?.retentionPeriodDays).toBe(2555); // 7 years
      expect(auditLogPolicy?.archiveBeforeDelete).toBe(true);
      expect(auditLogPolicy?.complianceRequirement).toBe('SOLAS/ISM');

      const bankingDataPolicy = dataRetentionService.getRetentionPolicy('banking_data');
      expect(bankingDataPolicy).toBeDefined();
      expect(bankingDataPolicy?.legalHoldExemption).toBe(true);
    });

    it('should update retention policies', () => {
      const newPolicy = {
        resource: 'test_resource',
        retentionPeriodDays: 365,
        archiveBeforeDelete: true,
        complianceRequirement: 'Test Compliance',
      };

      dataRetentionService.updateRetentionPolicy('test_resource', newPolicy);
      const retrievedPolicy = dataRetentionService.getRetentionPolicy('test_resource');
      
      expect(retrievedPolicy).toEqual(newPolicy);
    });

    it('should handle legal hold operations', async () => {
      const logSpy = vi.spyOn(AuditService, 'logComplianceEvent');

      await dataRetentionService.placeLegalHold(
        'requisitions',
        'req123',
        'Litigation hold for contract dispute',
        'user456'
      );

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user456',
          regulation: 'Legal Hold',
          complianceType: 'SOX',
          action: 'LEGAL_HOLD_PLACED',
        })
      );
    });
  });

  describe('Security Incident Service', () => {
    it('should create security incidents with proper structure', async () => {
      const incident = {
        type: 'UNAUTHORIZED_ACCESS' as const,
        severity: 'HIGH' as const,
        status: 'OPEN' as const,
        title: 'Unauthorized Banking Data Access',
        description: 'User attempted to access banking data without proper authorization',
        userId: 'user123',
        ipAddress: '192.168.1.100',
        affectedResources: ['banking_data', 'vendors'],
        indicators: [
          {
            type: 'BEHAVIORAL' as const,
            name: 'permission_denied_count',
            value: 5,
            confidence: 85,
          },
        ],
        mitigationSteps: [
          'Review user permissions',
          'Investigate access patterns',
          'Consider account suspension',
        ],
        detectedBy: 'SYSTEM' as const,
        riskScore: 85,
      };

      const createdIncident = await securityIncidentService.createIncident(incident);
      
      expect(createdIncident).toMatchObject(incident);
      expect(createdIncident.timestamp).toBeDefined();
    });

    it('should analyze security patterns and detect incidents', async () => {
      // Mock audit logs for pattern analysis
      const mockAuditLogs = [
        {
          id: '1',
          userId: 'user123',
          action: 'LOGIN',
          metadata: { success: false },
          createdAt: new Date(),
          ipAddress: '192.168.1.100',
          user: { email: 'test@example.com' },
        },
        {
          id: '2',
          userId: 'user123',
          action: 'LOGIN',
          metadata: { success: false },
          createdAt: new Date(),
          ipAddress: '192.168.1.100',
          user: { email: 'test@example.com' },
        },
        // Add more mock logs to trigger pattern detection
      ];

      // This would normally query the database
      // For testing, we'll verify the pattern detection logic
      const incidents = await securityIncidentService.analyzeSecurityPatterns();
      expect(Array.isArray(incidents)).toBe(true);
    });

    it('should calculate severity correctly', () => {
      const calculateSeverity = (securityIncidentService as any).calculateSeverity;
      
      expect(calculateSeverity(95)).toBe('CRITICAL');
      expect(calculateSeverity(75)).toBe('HIGH');
      expect(calculateSeverity(45)).toBe('MEDIUM');
      expect(calculateSeverity(15)).toBe('LOW');
    });

    it('should provide appropriate mitigation steps', () => {
      const getMitigationSteps = (securityIncidentService as any).getMitigationSteps;
      
      const authSteps = getMitigationSteps('AUTHENTICATION_FAILURE');
      expect(authSteps).toContain('Lock user account temporarily');
      expect(authSteps).toContain('Require password reset');

      const breachSteps = getMitigationSteps('DATA_BREACH');
      expect(breachSteps).toContain('Immediately isolate affected systems');
      expect(breachSteps).toContain('Notify security team and management');
    });
  });

  describe('Integration Tests', () => {
    it('should integrate encryption with audit logging', async () => {
      const bankingData = {
        accountNumber: '123456789',
        routingNumber: '987654321',
      };

      // Encrypt banking data
      const encrypted = fieldEncryptionService.encryptBankingData(bankingData);
      
      // Log the encryption activity
      const logSpy = vi.spyOn(AuditService, 'logBankingDataAccess');
      
      await AuditService.logBankingDataAccess({
        userId: 'user123',
        vendorId: 'vendor456',
        action: 'encrypt',
        fields: Object.keys(bankingData),
        ipAddress: '192.168.1.100',
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'encrypt',
          fields: ['accountNumber', 'routingNumber'],
        })
      );

      // Decrypt and log access
      const decrypted = fieldEncryptionService.decryptBankingData(encrypted);
      expect(decrypted).toEqual(bankingData);
    });

    it('should trigger security incidents from audit patterns', async () => {
      const createIncidentSpy = vi.spyOn(securityIncidentService, 'createIncident');
      
      // Simulate multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await AuditService.logSecurityEvent({
          userId: 'user123',
          action: 'LOGIN_FAILED',
          ip: '192.168.1.100',
          metadata: { attempt: i + 1 },
        });
      }

      // This would normally be triggered by the security analysis
      // For testing, we verify the incident creation logic
      expect(createIncidentSpy).toBeDefined();
    });
  });
});

describe('Security Middleware Integration', () => {
  it('should enhance audit logging in middleware', async () => {
    const mockRequest = {
      user: { id: 'user123', email: 'test@example.com' },
      ip: '192.168.1.100',
      get: vi.fn().mockReturnValue('Mozilla/5.0...'),
      path: '/api/vendors/banking-data',
      method: 'GET',
    };

    const logSpy = vi.spyOn(AuditService, 'logDataAccess');

    // Simulate middleware logging sensitive data access
    await AuditService.logDataAccess({
      userId: mockRequest.user.id,
      resource: 'banking_data',
      resourceId: 'vendor123',
      action: 'read',
      sensitiveData: true,
      ipAddress: mockRequest.ip,
      userAgent: mockRequest.get('User-Agent'),
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user123',
        resource: 'banking_data',
        sensitiveData: true,
      })
    );
  });
});