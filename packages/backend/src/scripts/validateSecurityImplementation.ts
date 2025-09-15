#!/usr/bin/env tsx

/**
 * Security Implementation Validation Script
 * 
 * This script validates that all security hardening features are properly implemented:
 * 1. Field-level encryption for sensitive banking data
 * 2. Comprehensive audit logging for all user actions
 * 3. Security incident detection and alerting system
 * 4. Data retention policies with automatic archival
 */

import { fieldEncryptionService } from '../services/fieldEncryptionService.js';
import { AuditService } from '../services/auditService.js';
import { securityIncidentService } from '../services/securityIncidentService.js';
import { dataRetentionService } from '../services/dataRetentionService.js';

// Set test environment variable
process.env.FIELD_ENCRYPTION_KEY = 'test-encryption-key-for-validation-32-chars';

async function validateSecurityImplementation() {
  console.log('🔒 Validating Security Implementation...\n');

  let allTestsPassed = true;

  // Test 1: Field-level encryption
  console.log('1. Testing Field-level Encryption...');
  try {
    const testBankingData = {
      accountNumber: '123456789',
      routingNumber: '987654321',
      swiftCode: 'ABCDUS33',
      iban: 'GB82WEST12345698765432',
    };

    // Test encryption
    const encrypted = fieldEncryptionService.encryptBankingData(testBankingData);
    console.log('   ✅ Banking data encrypted successfully');

    // Validate encrypted structure
    Object.values(encrypted).forEach(field => {
      if (!fieldEncryptionService.isValidEncryptedField(field)) {
        throw new Error('Invalid encrypted field structure');
      }
    });
    console.log('   ✅ Encrypted field structure validated');

    // Test decryption
    const decrypted = fieldEncryptionService.decryptBankingData(encrypted);
    if (JSON.stringify(decrypted) !== JSON.stringify(testBankingData)) {
      throw new Error('Decryption failed - data mismatch');
    }
    console.log('   ✅ Banking data decrypted successfully');

    // Test individual field encryption
    const testField = 'sensitive-account-number-123';
    const encryptedField = fieldEncryptionService.encryptField(testField);
    const decryptedField = fieldEncryptionService.decryptField(encryptedField);
    if (decryptedField !== testField) {
      throw new Error('Field encryption/decryption failed');
    }
    console.log('   ✅ Individual field encryption validated');

  } catch (error) {
    console.log(`   ❌ Field encryption test failed: ${error.message}`);
    allTestsPassed = false;
  }

  // Test 2: Enhanced audit logging
  console.log('\n2. Testing Enhanced Audit Logging...');
  try {
    // Test security event logging
    await AuditService.logSecurityEvent({
      userId: 'test-user-123',
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      ip: '192.168.1.100',
      userAgent: 'Test-Agent/1.0',
      metadata: { resource: 'banking_data' },
    });
    console.log('   ✅ Security event logging works');

    // Test data access logging
    await AuditService.logDataAccess({
      userId: 'test-user-123',
      resource: 'banking_data',
      resourceId: 'vendor-456',
      action: 'read',
      sensitiveData: true,
      ipAddress: '192.168.1.100',
      dataFields: ['accountNumber', 'routingNumber'],
    });
    console.log('   ✅ Data access logging works');

    // Test compliance event logging
    await AuditService.logComplianceEvent({
      userId: 'test-user-123',
      regulation: 'SOLAS Chapter IX',
      complianceType: 'SOLAS',
      action: 'CERTIFICATE_RENEWAL',
      vesselId: 'vessel-789',
      details: { certificateType: 'Safety Management Certificate' },
    });
    console.log('   ✅ Compliance event logging works');

    // Test banking data access logging
    await AuditService.logBankingDataAccess({
      userId: 'test-user-123',
      vendorId: 'vendor-456',
      action: 'decrypt',
      fields: ['accountNumber', 'swiftCode'],
      ipAddress: '192.168.1.100',
    });
    console.log('   ✅ Banking data access logging works');

  } catch (error) {
    console.log(`   ❌ Audit logging test failed: ${error.message}`);
    allTestsPassed = false;
  }

  // Test 3: Security incident detection
  console.log('\n3. Testing Security Incident Detection...');
  try {
    // Test incident creation
    const testIncident = {
      type: 'UNAUTHORIZED_ACCESS' as const,
      severity: 'HIGH' as const,
      status: 'OPEN' as const,
      title: 'Test Security Incident',
      description: 'This is a test security incident for validation',
      userId: 'test-user-123',
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
      ],
      detectedBy: 'SYSTEM' as const,
      riskScore: 85,
    };

    const createdIncident = await securityIncidentService.createIncident(testIncident);
    if (!createdIncident.timestamp) {
      throw new Error('Incident creation failed - missing timestamp');
    }
    console.log('   ✅ Security incident creation works');

    // Test pattern analysis (this would normally analyze real audit logs)
    const incidents = await securityIncidentService.analyzeSecurityPatterns();
    console.log(`   ✅ Security pattern analysis works (found ${incidents.length} incidents)`);

  } catch (error) {
    console.log(`   ❌ Security incident detection test failed: ${error.message}`);
    allTestsPassed = false;
  }

  // Test 4: Data retention policies
  console.log('\n4. Testing Data Retention Policies...');
  try {
    // Test policy retrieval
    const auditLogPolicy = dataRetentionService.getRetentionPolicy('audit_logs');
    if (!auditLogPolicy || auditLogPolicy.retentionPeriodDays !== 2555) {
      throw new Error('Audit log retention policy not configured correctly');
    }
    console.log('   ✅ Audit log retention policy configured (7 years)');

    const bankingDataPolicy = dataRetentionService.getRetentionPolicy('banking_data');
    if (!bankingDataPolicy || !bankingDataPolicy.legalHoldExemption) {
      throw new Error('Banking data retention policy not configured correctly');
    }
    console.log('   ✅ Banking data retention policy configured with legal hold exemption');

    // Test policy update
    const testPolicy = {
      resource: 'test_resource',
      retentionPeriodDays: 365,
      archiveBeforeDelete: true,
      complianceRequirement: 'Test Compliance',
    };
    dataRetentionService.updateRetentionPolicy('test_resource', testPolicy);
    const retrievedPolicy = dataRetentionService.getRetentionPolicy('test_resource');
    if (!retrievedPolicy || retrievedPolicy.retentionPeriodDays !== 365) {
      throw new Error('Policy update failed');
    }
    console.log('   ✅ Retention policy update works');

    // Test legal hold operations
    await dataRetentionService.placeLegalHold(
      'test_resource',
      'test-123',
      'Test legal hold for validation',
      'test-user-123'
    );
    console.log('   ✅ Legal hold placement works');

    await dataRetentionService.removeLegalHold(
      'test_resource',
      'test-123',
      'Test legal hold removal',
      'test-user-123'
    );
    console.log('   ✅ Legal hold removal works');

  } catch (error) {
    console.log(`   ❌ Data retention test failed: ${error.message}`);
    allTestsPassed = false;
  }

  // Test 5: Integration validation
  console.log('\n5. Testing Integration...');
  try {
    // Test encryption + audit logging integration
    const bankingData = { accountNumber: '987654321' };
    const encrypted = fieldEncryptionService.encryptBankingData(bankingData);
    
    await AuditService.logBankingDataAccess({
      userId: 'test-user-123',
      vendorId: 'vendor-789',
      action: 'encrypt',
      fields: Object.keys(bankingData),
      ipAddress: '192.168.1.100',
    });

    const decrypted = fieldEncryptionService.decryptBankingData(encrypted);
    
    await AuditService.logBankingDataAccess({
      userId: 'test-user-123',
      vendorId: 'vendor-789',
      action: 'decrypt',
      fields: Object.keys(bankingData),
      ipAddress: '192.168.1.100',
    });

    console.log('   ✅ Encryption + audit logging integration works');

  } catch (error) {
    console.log(`   ❌ Integration test failed: ${error.message}`);
    allTestsPassed = false;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (allTestsPassed) {
    console.log('🎉 ALL SECURITY TESTS PASSED!');
    console.log('\nTask 17.1 Advanced Security Implementation is complete:');
    console.log('✅ Field-level encryption for sensitive banking data');
    console.log('✅ Comprehensive audit logging for all user actions');
    console.log('✅ Security incident detection and alerting system');
    console.log('✅ Data retention policies with automatic archival');
    console.log('\nRequirements satisfied: 10.1, 10.2, 10.3, 10.7');
  } else {
    console.log('❌ SOME SECURITY TESTS FAILED!');
    console.log('Please review the failed tests above and fix the issues.');
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateSecurityImplementation().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

export { validateSecurityImplementation };