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
        'src/utils/dom-cache.ts',
        'src/utils/dom-utils.ts',
        'src/utils/table-export.ts',
        'src/utils/gsap-utilities.ts',
        'src/utils/attachment-manager.ts',
        'src/utils/set-copyright-year.ts',
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
        // Core browser modules - module registry, debug tooling, browser service wiring
        'src/core/modules-config.ts',
        'src/core/debug.ts',
        'src/core/services-config.ts',
        // UI components - require real DOM rendering (not jsdom-compatible)
        'src/components/**',
        // UI factories - build DOM button/badge/icon elements
        'src/factories/**',
        // Browser-only utilities
        'src/utils/api-wrappers.ts',
        'src/utils/logging/**',
        'src/utils/obfuscation-plugin.ts',
        'src/utils/file-download.ts',
        // Constants with parameterized function returns (browser-side API endpoint builders)
        'src/constants/api-endpoints.ts',
        'src/constants/icons.ts',
        'src/constants/notifications.ts',
        'src/constants/keyboard.ts',
        // Animation config - GSAP-dependent
        'src/config/animation-constants.ts',
        // React UI components and features (require rendering setup not configured)
        'src/react/features/**',
        'src/react/components/**',
        'src/react/app/**',
        'src/react/stores/**',
        // React hooks - require React Testing Library (not installed) or portal-specific setup
        'src/react/hooks/**',
        // React factories, config, utils, lib - browser/portal context dependent
        'src/react/factories/**',
        'src/react/config/**',
        'src/react/utils/**',
        'src/react/lib/**',
        // Server route handlers - integration-test territory (HTTP request lifecycle)
        'server/routes/**',
        // Server scripts - one-off migration and development utilities
        'server/scripts/**',
        // Server environment config - process.env bootstrapping, not unit-testable
        'server/config/environment.ts',
        // Logging transports - file system and console I/O dependent
        'server/services/logging/**',
        // Database initialization - requires real SQLite driver, integration-test territory
        'server/database/init.ts',
        // Database migrations - run-once scripts, not unit-testable
        'server/database/migrations.ts'
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
