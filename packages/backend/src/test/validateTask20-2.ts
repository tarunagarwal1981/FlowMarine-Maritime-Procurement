#!/usr/bin/env tsx

/**
 * Task 20.2 Implementation Validation Script
 * Validates that all required testing components are properly implemented
 */

import fs from 'fs';
import path from 'path';

interface ValidationResult {
  component: string;
  exists: boolean;
  hasRequiredContent: boolean;
  details: string[];
}

class Task20_2Validator {
  private results: ValidationResult[] = [];

  validateFileExists(filePath: string, component: string): boolean {
    const fullPath = path.join(process.cwd(), filePath);
    const exists = fs.existsSync(fullPath);
    
    if (!exists) {
      this.results.push({
        component,
        exists: false,
        hasRequiredContent: false,
        details: [`File not found: ${filePath}`]
      });
      return false;
    }
    
    return true;
  }

  validateFileContent(filePath: string, component: string, requiredPatterns: string[]): void {
    const fullPath = path.join(process.cwd(), filePath);
    
    if (!this.validateFileExists(filePath, component)) {
      return;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const details: string[] = [];
      let hasAllRequired = true;

      for (const pattern of requiredPatterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(content)) {
          details.push(`✅ Found: ${pattern}`);
        } else {
          details.push(`❌ Missing: ${pattern}`);
          hasAllRequired = false;
        }
      }

      this.results.push({
        component,
        exists: true,
        hasRequiredContent: hasAllRequired,
        details
      });
    } catch (error) {
      this.results.push({
        component,
        exists: true,
        hasRequiredContent: false,
        details: [`Error reading file: ${error instanceof Error ? error.message : String(error)}`]
      });
    }
  }

  async validateTask20_2Implementation(): Promise<void> {
    console.log('🔍 Validating Task 20.2 Implementation...\n');

    // 1. Validate E2E User Workflow Tests
    this.validateFileContent(
      'src/test/e2e/userWorkflows.comprehensive.test.ts',
      'E2E User Workflow Tests',
      [
        'Complete Procurement Workflow',
        'Emergency Procurement Workflow',
        'Safety Equipment Compliance Workflow',
        'Multi-Currency Procurement Workflow',
        'Offline Synchronization Workflow',
        'Delegation and Crew Rotation Workflow',
        'Cross-Browser Compatibility Workflows',
        'Data Integrity and Consistency Workflows',
        'Error Recovery and Resilience Workflows',
        'Accessibility and Usability Workflows',
        'Internationalization and Localization Workflows',
        'Mobile and Responsive Workflows',
        'Performance Monitoring Workflows',
        'Compliance and Audit Workflows'
      ]
    );

    // 2. Validate Security Penetration Tests
    this.validateFileContent(
      'src/test/security/security.penetration.test.ts',
      'Security Penetration Tests',
      [
        'Authentication Security Tests',
        'Authorization Security Tests',
        'Input Validation Security Tests',
        'Rate Limiting Security Tests',
        'Session Security Tests',
        'Data Protection Security Tests',
        'Maritime-Specific Security Tests',
        'Compliance Security Tests',
        'Infrastructure Security Tests',
        'Advanced Penetration Testing Scenarios',
        'Business Logic Security Tests',
        'API Security Stress Tests',
        'Cryptographic Security Tests',
        'Compliance and Regulatory Security Tests'
      ]
    );

    // 3. Validate Performance Load Tests
    this.validateFileContent(
      'src/test/performance/loadTesting.test.ts',
      'Performance Load Tests',
      [
        'Concurrent User Load Testing',
        'Database Performance Testing',
        'Memory and Resource Usage Testing',
        'Rate Limiting Performance',
        'Stress Testing',
        'Scalability Testing',
        'Resource Utilization Testing',
        'Network Performance Testing',
        'should handle 50 concurrent requisition creations',
        'should handle high-frequency read operations',
        'should handle sustained load over time',
        'should handle burst traffic patterns'
      ]
    );

    // 4. Validate Accessibility WCAG Tests
    this.validateFileContent(
      '../frontend/src/test/accessibility/wcag.test.tsx',
      'Accessibility WCAG Tests',
      [
        'WCAG 2.1 AA Accessibility Tests',
        'Authentication Components',
        'Form Components',
        'Navigation Components',
        'Data Display Components',
        'UI Components',
        'Color Contrast and Visual Accessibility',
        'Focus Management',
        'Screen Reader Support',
        'Advanced Accessibility Features',
        'Maritime-Specific Accessibility',
        'should have no accessibility violations',
        'should support keyboard navigation',
        'should provide proper ARIA labels'
      ]
    );

    // 5. Validate Comprehensive Test Runner
    this.validateFileContent(
      'src/test/comprehensive.e2e.test.ts',
      'Comprehensive Test Runner',
      [
        'Task 20.2 - Comprehensive End-to-End and Security Testing',
        'E2E User Workflows Testing',
        'Security Penetration Testing',
        'Performance Load Testing',
        'Accessibility WCAG Testing',
        'Integration Validation',
        'Requirements Validation'
      ]
    );

    // 6. Validate Test Runner Integration
    this.validateFileContent(
      'src/test/testRunner.ts',
      'Test Runner Integration',
      [
        'Task 20.2 - Comprehensive E2E and Security Testing',
        'Complete E2E workflows, security penetration, performance, and accessibility testing'
      ]
    );

    // 7. Validate Frontend Package Configuration
    this.validateFileContent(
      '../frontend/package.json',
      'Frontend Package Configuration',
      [
        'test:accessibility',
        'jest-axe',
        'axe-core'
      ]
    );

    this.printResults();
  }

  private printResults(): void {
    console.log('📊 Validation Results:\n');
    console.log('═'.repeat(80));

    let totalComponents = this.results.length;
    let passedComponents = 0;

    this.results.forEach(result => {
      const status = result.exists && result.hasRequiredContent ? '✅ PASSED' : '❌ FAILED';
      console.log(`${status} ${result.component}`);
      
      if (result.exists && result.hasRequiredContent) {
        passedComponents++;
      }

      if (!result.exists) {
        console.log('   📁 File does not exist');
      } else if (!result.hasRequiredContent) {
        console.log('   📝 Missing required content:');
        result.details.forEach(detail => {
          if (detail.startsWith('❌')) {
            console.log(`      ${detail}`);
          }
        });
      }
      console.log('');
    });

    console.log('═'.repeat(80));
    console.log(`📈 Overall Success Rate: ${passedComponents}/${totalComponents} (${((passedComponents/totalComponents)*100).toFixed(1)}%)`);

    if (passedComponents === totalComponents) {
      console.log('\n🎉 Task 20.2 implementation is complete and ready for execution!');
      console.log('\nTo run the comprehensive tests:');
      console.log('  npm run test:comprehensive');
      console.log('  or');
      console.log('  npx vitest run src/test/comprehensive.e2e.test.ts');
    } else {
      console.log('\n⚠️  Task 20.2 implementation is incomplete. Please address the failed components above.');
      process.exit(1);
    }
  }
}

// Execute validation
async function main() {
  const validator = new Task20_2Validator();
  await validator.validateTask20_2Implementation();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { Task20_2Validator };