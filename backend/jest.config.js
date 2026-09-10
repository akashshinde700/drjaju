/**
 * Jest Configuration for Backend
 * Week 3: Unit Testing Implementation
 */

module.exports = {
  testEnvironment: 'node',
  coverageDirectory: './coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/config/**',
    '!src/logs/**',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 10000,
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
