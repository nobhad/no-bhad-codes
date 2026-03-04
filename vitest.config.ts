import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/test-setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,ts}',
      'server/**/*.{test,spec}.{js,ts}',
      'tests/server/**/*.{test,spec}.{js,ts}',
      'tests/unit/**/*.{test,spec}.{js,ts}',
      'tests/integration/**/*.{test,spec}.{js,ts}'
    ],
    exclude: ['node_modules/**', 'dist/**', 'build/**', '**/*.d.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov', 'text-summary'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/vite.config.*',
        '**/vitest.config.*',
        '**/playwright.config.*',
        '**/*.test.*',
        '**/*.spec.*',
        'src/main.ts',
        'server/app.ts',
        '**/types/**',
        '**/*.type.ts',
        '**/*.types.ts'
      ],
      include: ['src/**/*.{js,ts}', 'server/**/*.{js,ts}'],
      thresholds: {
        // Current baseline thresholds - increase incrementally
        global: {
          branches: 5,
          functions: 5,
          lines: 8,
          statements: 8
        },
        // Critical modules - higher standards for new code
        // Target: Increase by 5% each sprint
        'src/core/**/*.ts': {
          branches: 20,
          functions: 25,
          lines: 30,
          statements: 30
        },
        'src/services/**/*.ts': {
          branches: 15,
          functions: 15,
          lines: 20,
          statements: 20
        },
        'server/services/**/*.ts': {
          branches: 20,
          functions: 25,
          lines: 25,
          statements: 25
        }
      }
    },
    // Fail tests if coverage thresholds are not met
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    silent: false,
    watch: false,
    reporters: ['verbose', 'html', 'json'],
    outputFile: {
      html: './coverage/index.html',
      json: './coverage/coverage.json'
    }
    // Coverage reporting configuration
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tests': resolve(__dirname, 'tests')
    }
  }
});
