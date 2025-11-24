// Test setup file
// This file runs before all tests

beforeAll(async () => {
  // Setup test environment
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://user:password@localhost:5432/eterna_orders_test?schema=public";
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || "redis://localhost:6379";
});

afterAll(async () => {
  // Cleanup after all tests
});

