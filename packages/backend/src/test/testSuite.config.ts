/**
 * Comprehensive Test Suite Configuration for FlowMarine
 * Defines test categories, execution order, and reporting requirements
 */

export interface TestSuiteConfig {
  name: string;
  description: string;
  categories: TestCategory[];
  executionOrder: string[];
  reportingConfig: ReportingConfig;
  performanceThresholds: PerformanceThresholds;
  coverageRequirements: CoverageRequirements;
}

export interface TestCategory {
  id: string;
  name: string;
  description: string;
  patterns: