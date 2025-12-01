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
      'tests/unit/**/*.{test,spec}.{js,ts}'
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
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        },
        // Higher thresholds for critical modules
        'src/core/**/*.ts': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        },
        'src/services/**/*.ts': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        'server/services/**/*.ts': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
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
