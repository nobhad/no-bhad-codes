/**
 * ===============================================
 * GLOBAL TEST SETUP
 * ===============================================
 * @file tests/setup/global.ts
 * 
 * Global setup that runs once before all tests.
 */

export async function setup() {
  // Setup test database in memory
  process.env.DATABASE_PATH = ':memory:';
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Disable logging during tests to reduce noise
  process.env.LOG_FILE = '';
  process.env.LOG_ERROR_FILE = '';
  
  console.log('🧪 Global test setup completed');
}

export async function teardown() {
  console.log('🧪 Global test teardown completed');
}