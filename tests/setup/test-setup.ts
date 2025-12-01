/**
 * ===============================================
 * TEST SETUP
 * ===============================================
 * @file tests/setup/test-setup.ts
 *
 * Global test setup and configuration.
 */

import { vi, beforeEach, afterEach } from 'vitest';

// DOM environment is handled by Vitest's jsdom configuration

// Mock window properties that might not exist in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
});

// Mock fetch
global.fetch = vi.fn();

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };
beforeEach(() => {
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
  console.info = vi.fn();
  console.debug = vi.fn();
});

beforeEach(() => {
  // Set up fresh DOM for each test
  if (document.body) {
    document.body.innerHTML =
      '<div id="app"><header class="header"><nav class="navigation"><div class="theme-toggle" id="theme-toggle"><div class="theme-icon-wrap">🌙</div></div></nav></header><main id="main"></main><footer class="footer"></footer></div>';
  }
});

afterEach(() => {
  // Restore console methods
  Object.assign(console, originalConsole);

  // Clear all mocks
  vi.clearAllMocks();

  // Reset DOM
  if (document.body) {
    document.body.innerHTML = '';
  }
  if (document.head) {
    document.head.innerHTML = '';
  }
});

// Setup global test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock environment configuration
vi.mock('../../server/config/environment.js', () => ({
  default: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    DATABASE_PATH: ':memory:',
    LOG_FILE: './logs/test.log',
    LOG_ERROR_FILE: './logs/test-error.log',
    JWT_SECRET: 'test-secret-key',
    EMAIL_ENABLED: false,
    ENABLE_REGISTRATION: true,
    ENABLE_API_DOCS: false
  }
}));

// Global test utilities
global.testUtils = {
  createElement: (tag: string, attributes: Record<string, string> = {}): HTMLElement => {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    return element;
  },

  createMockModule: (name: string, container?: HTMLElement) => {
    const mockContainer = container || document.createElement('div');
    return {
      name,
      container: mockContainer,
      isInitialized: false,
      init: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      log: vi.fn()
    };
  },

  waitFor: (condition: () => boolean, timeout = 1000): Promise<void> => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  },

  flushPromises: (): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
};

// Extend global types
declare global {
  var testUtils: {
    createElement: (tag: string, attributes?: Record<string, string>) => HTMLElement;
    createMockModule: (name: string, container?: HTMLElement) => any;
    waitFor: (condition: () => boolean, timeout?: number) => Promise<void>;
    flushPromises: () => Promise<void>;
  };
}
