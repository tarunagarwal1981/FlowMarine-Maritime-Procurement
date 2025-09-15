#!/usr/bin/env tsx

/**
 * Comprehensive Test Runner for FlowMarine Backend
 * Executes all unit tests, integration tests, and maritime-specific scenarios
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

interface TestSuite {
  name: string;
  pattern: string;
  description: string;
  timeout?: number;
}

const testSuites: TestSuite[] = [
  {
    name: 'Unit Tests - Utils',
    pattern: 'src/test/utils/*.test.ts',
    description: 'Testing utility functions (encryption, JWT, validation)',
  },
  {
    name: 'Unit Tests - Middleware',
    pattern: 'src/test/middleware/*.test.ts',
    description: 'Testing authentication, authorization, and security middleware',
  },
  {
    name: 'Unit Tests - Services',
    pattern: 'src/test/services/*.test.ts',
    description: 'Testing core business logic services',
  },
  {
    name: 'Unit Tests - Core Services',
    pattern: 'src/test/*Service.test.ts',
    description: 'Testing individual service implementations',
  },
  {
    name: 'Integration Tests',
    pattern: 'src/test/integration/*.test.ts',
    description: 'Testing API endpoints and workflows',
    timeout: 60000,
  },
  {
    name: 'Security Tests',
    pattern: 'src/test/security/*.test.ts',
    description: 'Testing security implementations and vulnerabilities',
    timeout: 45000,
  },
  {
    name: 'Maritime Scenarios',
    pattern: 'src/test/scenarios/*.test.ts',
    description: 'Testing maritime-specific business scenarios',
    timeout: 45000,
  },
  {
    name: 'Task 20.2 - Comprehensive E2E and Security Testing',
    pattern: 'src/test/comprehensive.e2e.test.ts',
    description: 'Complete E2E workflows, security penetration, performance, and accessibility testing',
    timeout: 600000, // 10 minutes for comprehensive testing
  },
];

class TestRunner {
  private results: Array<{ suite: string; passed: boolean; error?: string }> = [];

  async runTestSuite(suite: TestSuite): Promise<boolean> {
    console.log(`\n🧪 Running ${suite.name}`);
    console.log(`📝 ${suite.description}`);
    console.log(`🔍 Pattern: ${suite.pattern}`);
    console.log('─'.repeat(80));

    try {
      const timeout = suite.timeout || 30000;
      const command = `npx vitest run ${suite.pattern} --reporter=verbose --timeout=${timeout}`;
      
      execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd(),
        timeout: timeout + 10000, // Add buffer for command execution
      });

      console.log(`✅ ${suite.name} - PASSED`);
      this.results.push({ suite: suite.name, passed: true });
      return true;
    } catch (error) {
      console.log(`❌ ${suite.name} - FAILED`);
      this.results.push({ 
        suite: suite.name, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting FlowMarine Backend Test Suite');
    console.log('═'.repeat(80));

    const startTime = Date.now();
    let passedSuites = 0;

    for (const suite of testSuites) {
      const passed = await this.runTestSuite(suite);
      if (passed) passedSuites++;
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log('\n📊 Test Results Summary');
    console.log('═'.repeat(80));
    console.log(`⏱️  Total Duration: ${duration.toFixed(2)}s`);
    console.log(`✅ Passed Suites: ${passedSuites}/${testSuites.length}`);
    console.log(`❌ Failed Suites: ${testSuites.length - passedSuites}/${testSuites.length}`);

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.suite}`);
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error.substring(0, 100)}...`);
      }
    });

    if (passedSuites === testSuites.length) {
      console.log('\n🎉 All test suites passed!');
      process.exit(0);
    } else {
      console.log('\n💥 Some test suites failed. Check the output above for details.');
      process.exit(1);
    }
  }

  async runCoverageReport(): Promise<void> {
    console.log('\n📈 Generating Coverage Report');
    console.log('─'.repeat(80));

    try {
      execSync('npx vitest run --coverage', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('✅ Coverage report generated successfully');
    } catch (error) {
      console.log('❌ Failed to generate coverage report');
      console.error(error);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const runner = new TestRunner();

  if (args.includes('--coverage')) {
    await runner.runCoverageReport();
  } else if (args.includes('--help')) {
    console.log(`
FlowMarine Backend Test Runner

Usage:
  npm run test:all              Run all test suites
  npm run test:all --coverage   Run all tests with coverage report
  npm run test:all --help       Show this help message

Test Suites:
${testSuites.map(suite => `  - ${suite.name}: ${suite.description}`).join('\n')}
    `);
  } else {
    await runner.runAllTests();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { TestRunner };