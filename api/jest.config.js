module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: [
      '**/__test__/**/*.ts',
      '**/?(*.)+(spec|test).ts'
    ],
    transform: {
      '^.+\\.ts$': ['ts-jest', {
        tsconfig: 'tsconfig.json',
      }],
    },
    collectCoverageFrom: [
      'src/**/*.ts',
      '!src/**/*.d.ts',
      '!src/main.ts',
      '!src/**/index.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageThreshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
    moduleNameMapper: {
      '^src/(.*)$': '<rootDir>/src/$1',
    },
    testTimeout: 10000,
    verbose: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    // Memory management settings
    maxWorkers: 1,
    workerIdleMemoryLimit: '512MB',
    // Prevent memory leaks
    detectLeaks: false,
    detectOpenHandles: true,
    forceExit: true,
  };
  