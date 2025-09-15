#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestValidationResult {
  file: string;
  valid: boolean;
  issues: string[];
  testCount: number;
  hasDescribe: boolean;
  hasIt: boolean;
  hasExpect: boolean;
}

function validateTestFile(filePath: string): TestValidationResult {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  
  const result: TestValidationResult = {
    file: fileName,
    valid: true,
    issues: [],
    testCount: 0,
    hasDescribe: false,
    hasIt: false,
    hasExpect: false,
  };

  // Check for basic test structure
  if (!content.includes('describe(')) {
    result.issues.push('Missing describe() blocks');
    result.valid = false;
  } else {
    result.hasDescribe = true;
  }

  if (!content.includes('it(') && !content.includes('test(')) {
    result.issues.push('Missing it() or test() blocks');
    result.valid = false;
  } else {
    result.hasIt = true;
  }

  if (!content.includes('expect(')) {
    result.issues.push('Missing expect() assertions');
    result.valid = false;
  } else {
    result.hasExpect = true;
  }

  // Count test cases
  const itMatches = content.match(/\bit\(/g) || [];
  const testMatches = content.match(/\btest\(/g) || [];
  result.testCount = itMatches.length + testMatches.length;

  // Check for imports
  if (!content.includes('import') && !content.includes('require')) {
    result.issues.push('Missing imports');
    result.valid = false;
  }

  // Check for vitest imports
  if (!content.includes('vitest')) {
    result.issues.push('Missing vitest imports');
    result.valid = false;
  }

  // Check for proper test file naming
  if (!fileName.includes('.test.') && !fileName.includes('.spec.')) {
    result.issues.push('File should have .test. or .spec. in name');
    result.valid = false;
  }

  return result;
}

function scanTestDirectory(dir: string): TestValidationResult[] {
  const results: TestValidationResult[] = [];
  
  function scanRecursive(currentDir: string) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const itemPath = path.join(currentDir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        scanRecursive(itemPath);
      } else if (item.endsWith('.test.ts') || item.endsWith('.spec.ts')) {
        try {
          const result = validateTestFile(itemPath);
          results.push(result);
        } catch (error) {
          results.push({
            file: item,
            valid: false,
            issues: [`Error reading file: ${error.message}`],
            testCount: 0,
            hasDescribe: false,
            hasIt: false,
            hasExpect: false,
          });
        }
      }
    }
  }
  
  scanRecursive(dir);
  return results;
}

function generateReport(results: TestValidationResult[]): void {
  console.log('🧪 FlowMarine Test Validation Report');
  console.log('=' .repeat(50));
  
  const validTests = results.filter(r => r.valid);
  const invalidTests = results.filter(r => !r.valid);
  const totalTests = results.reduce((sum, r) => sum + r.testCount, 0);
  
  console.log(`\n📊 Summary:`);
  console.log(`  Total test files: ${results.length}`);
  console.log(`  Valid test files: ${validTests.length}`);
  console.log(`  Invalid test files: ${invalidTests.length}`);
  console.log(`  Total test cases: ${totalTests}`);
  console.log(`  Success rate: ${((validTests.length / results.length) * 100).toFixed(1)}%`);
  
  if (validTests.length > 0) {
    console.log(`\n✅ Valid Test Files:`);
    validTests.forEach(result => {
      console.log(`  ${result.file} (${result.testCount} tests)`);
    });
  }
  
  if (invalidTests.length > 0) {
    console.log(`\n❌ Invalid Test Files:`);
    invalidTests.forEach(result => {
      console.log(`  ${result.file}:`);
      result.issues.forEach(issue => {
        console.log(`    - ${issue}`);
      });
    });
  }
  
  console.log(`\n📋 Test Coverage by Category:`);
  const categories = {
    services: results.filter(r => r.file.includes('Service')),
    utils: results.filter(r => r.file.includes('utils/')),
    middleware: results.filter(r => r.file.includes('middleware/')),
    integration: results.filter(r => r.file.includes('integration/')),
    security: results.filter(r => r.file.includes('security/')),
    scenarios: results.filter(r => r.file.includes('scenarios/')),
    e2e: results.filter(r => r.file.includes('e2e/')),
  };
  
  Object.entries(categories).forEach(([category, files]) => {
    const validCount = files.filter(f => f.valid).length;
    const totalCount = files.length;
    const testCount = files.reduce((sum, f) => sum + f.testCount, 0);
    
    if (totalCount > 0) {
      console.log(`  ${category}: ${validCount}/${totalCount} files (${testCount} tests)`);
    }
  });
  
  console.log(`\n🎯 Recommendations:`);
  
  if (invalidTests.length > 0) {
    console.log(`  - Fix ${invalidTests.length} invalid test files`);
  }
  
  if (totalTests < 100) {
    console.log(`  - Add more test cases (current: ${totalTests}, recommended: 100+)`);
  }
  
  const missingCategories = Object.entries(categories)
    .filter(([_, files]) => files.length === 0)
    .map(([category]) => category);
    
  if (missingCategories.length > 0) {
    console.log(`  - Add tests for: ${missingCategories.join(', ')}`);
  }
  
  console.log(`\n${'=' .repeat(50)}`);
  
  if (invalidTests.length === 0 && totalTests >= 50) {
    console.log(`🎉 All tests are valid! Ready for execution.`);
  } else {
    console.log(`⚠️  Please address the issues above before running tests.`);
  }
}

// Main execution
const testDir = __dirname;
console.log(`Scanning test directory: ${testDir}`);

try {
  const results = scanTestDirectory(testDir);
  generateReport(results);
} catch (error) {
  console.error('Error during test validation:', error);
  process.exit(1);
}