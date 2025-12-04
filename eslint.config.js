import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

// Common globals for both JS and TS
const commonGlobals = {
  // Browser globals
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  navigator: 'readonly',
  screen: 'readonly',
  location: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',

  // DOM types
  HTMLElement: 'readonly',
  Element: 'readonly',
  Node: 'readonly',
  EventTarget: 'readonly',
  Event: 'readonly',
  CustomEvent: 'readonly',
  MouseEvent: 'readonly',
  KeyboardEvent: 'readonly',
  TouchEvent: 'readonly',
  HTMLButtonElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLSelectElement: 'readonly',
  HTMLTextAreaElement: 'readonly',
  HTMLFormElement: 'readonly',
  HTMLAnchorElement: 'readonly',
  HTMLDivElement: 'readonly',
  HTMLIFrameElement: 'readonly',
  ShadowRoot: 'readonly',
  EventListener: 'readonly',
  NodeJS: 'readonly',
  NodeListOf: 'readonly',

  // Browser Performance and related APIs
  performance: 'readonly',
  PerformanceObserver: 'readonly',
  PerformanceResourceTiming: 'readonly',
  PopStateEvent: 'readonly',

  // Form and URL APIs
  FormData: 'readonly',
  URLSearchParams: 'readonly',
  Headers: 'readonly',
  Request: 'readonly',
  Response: 'readonly',

  // Browser APIs
  TextEncoder: 'readonly',
  crypto: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
  FileList: 'readonly',
  DataTransfer: 'readonly',
  URL: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',

  // Observer APIs
  MutationObserver: 'readonly',
  IntersectionObserver: 'readonly',
  ResizeObserver: 'readonly',

  // Browser console and utils
  Console: 'readonly',
  btoa: 'readonly',
  atob: 'readonly',

  // Node.js globals
  process: 'readonly',
  global: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  Buffer: 'readonly',
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
  setImmediate: 'readonly',
  clearImmediate: 'readonly',

  // Express types
  Express: 'readonly',

  // Library globals
  gsap: 'readonly',
  CustomEase: 'readonly',

  // Vitest globals
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  vi: 'readonly',
};

export default [
  js.configs.recommended,
  {
    // Global ignore patterns
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      '.storybook/**',
      'coverage/**',
      '*.min.js',
      'archive/**',
      'public/sw.js',
      'sw.js',
      'stories/**',
      'src/stories/**',
      'test-*.js',
      'test-*.html',
    ],
  },
  {
    files: ['src/**/*.{js,mjs}', 'scripts/**/*.js', '*.config.js', '*.config.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: commonGlobals,
    },
    rules: {
      indent: ['error', 2],
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'arrow-spacing': 'error',
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'comma-dangle': ['error', 'never'],
      eqeqeq: ['error', 'always'],
      'no-multiple-empty-lines': ['error', { max: 2 }],
      'no-trailing-spaces': 'error',
      'space-before-function-paren': [
        'error',
        {
          anonymous: 'always',
          named: 'never',
          asyncArrow: 'always',
        },
      ],
      'keyword-spacing': 'error',
      'space-infix-ops': 'error',
      'comma-spacing': ['error', { before: false, after: true }],
      'brace-style': ['error', '1tbs', { allowSingleLine: true }],
      curly: ['error', 'multi-line'],
      'no-else-return': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'warn',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'no-shadow': 'warn',
      'no-use-before-define': ['error', { functions: false }],
    },
  },
  {
    files: ['src/**/*.ts', 'server/**/*.ts', 'scripts/**/*.ts', 'tests/**/*.ts', '*.config.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: commonGlobals,
    },
    rules: {
      // Disable base ESLint rules that are covered by TypeScript-specific rules
      'no-unused-vars': 'off',
      'no-shadow': 'off',
      'no-use-before-define': 'off',

      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-shadow': 'warn',
      '@typescript-eslint/no-use-before-define': ['error', { functions: false }],

      // General rules
      indent: ['error', 2],
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'arrow-spacing': 'error',
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'comma-dangle': ['error', 'never'],
      eqeqeq: ['error', 'always'],
      'no-multiple-empty-lines': ['error', { max: 2 }],
      'no-trailing-spaces': 'error',
      'space-before-function-paren': [
        'error',
        {
          anonymous: 'always',
          named: 'never',
          asyncArrow: 'always',
        },
      ],
      'keyword-spacing': 'error',
      'space-infix-ops': 'error',
      'comma-spacing': ['error', { before: false, after: true }],
      'brace-style': ['error', '1tbs', { allowSingleLine: true }],
      curly: ['error', 'multi-line'],
      'no-else-return': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'warn',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
    },
  },
  {
    // Configuration for test files
    files: ['**/*.test.{js,ts}', '**/*.spec.{js,ts}', 'tests/**/*.{js,ts}'],
    rules: {
      'no-console': 'off', // Allow console logs in tests
    },
  },
  {
    // Configuration for configuration files
    files: ['*.config.{js,ts,mjs}', 'vite.config.js', 'vitest.config.ts', 'playwright.config.ts'],
    rules: {
      'no-console': 'off', // Allow console logs in config files
    },
  },
  {
    // Configuration for admin and security files
    files: [
      'src/admin/**/*.{js,ts}',
      'src/services/code-protection-service.ts',
      'src/utils/obfuscation-utils.ts',
    ],
    rules: {
      'no-debugger': 'off', // Allow debugger in security-related files
      'no-console': 'off', // Allow console in admin files
      'no-alert': 'off', // Allow alert in admin dashboard
    },
  },
];
