import { beforeAll, afterAll, beforeEach } from 'vitest';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || 'postgresql://flowmarine_test:flowmarine_test_password@localhost:5433/flowmarine_test';

// Mock external services for testing
beforeAll(async () => {
  // Setup test database connection
  // This will be expanded when Prisma is configured
});

afterAll(async () => {
  // Cleanup test database connections
});

beforeEach(async () => {
  // Reset test data before each test
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: console.error, // Keep error logging for debugging
};