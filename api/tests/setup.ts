// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.APP_VERSION = 'test-version';

// Global test configuration
beforeAll(() => {
  // Setup any global test configuration
});

afterAll(() => {
  // Cleanup any global test resources
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};