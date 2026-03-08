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
        // Entry points - not unit-testable
        'src/main.ts',
        'src/main-site.ts',
        'src/admin.ts',
        'src/portal.ts',
        'src/portal-global-error-handler.ts',
        'src/i18n.ts',
        'server/app.ts',
        // Type-only files
        '**/types/**',
        '**/*.type.ts',
        '**/*.types.ts',
        // Animation/GSAP modules - require browser + GSAP, not unit-testable
        'src/modules/**',
        // DOM-only utilities - require real browser DOM, not unit-testable in jsdom
        'src/utils/confirm-dialog.ts',
        'src/utils/modal-dropdown.ts',
        'src/utils/modal-utils.ts',
        'src/utils/button-loading.ts',
        'src/utils/loading-utils.ts',
        'src/utils/toast-notifications.ts',
        'src/utils/event-handlers.ts',
        'src/utils/focus-trap.ts',
        'src/utils/copy-email.ts',
        'src/utils/dom-cache.ts',
        'src/utils/dom-helpers.ts',
        'src/utils/dom-utils.ts',
        'src/utils/table-export.ts',
        'src/utils/gsap-utilities.ts',
        'src/utils/attachment-manager.ts',
        'src/utils/set-copyright-year.ts',
        'src/utils/react-cleanup.ts',
        // Client-side browser services - DOM/tracking dependent
        'src/services/visitor-tracking.ts',
        'src/services/code-protection-service.ts',
        'src/services/performance-service.ts',
        'src/services/bundle-analyzer.ts',
        // Browser auth (DOM/cookie dependent)
        'src/auth/**',
        // Client-side features (set-password flow, etc.)
        'src/features/**',
        // Core app (browser lifecycle, DOM-heavy)
        'src/core/app.ts',
        // React UI components and features (require rendering setup not configured)
        'src/react/features/**',
        'src/react/components/**',
        'src/react/app/**',
        'src/react/stores/**',
        // React hooks that use GSAP or complex browser APIs
        'src/react/hooks/useGsap.ts',
        'src/react/hooks/usePortalAuth.ts',
        'src/react/hooks/usePortalFetch.ts'
      ],
      include: ['src/**/*.{js,ts}', 'server/**/*.{js,ts}'],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
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
