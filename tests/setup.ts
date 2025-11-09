/**
 * Test setup file for Vitest
 */

import { beforeEach, afterEach } from 'vitest';

// Setup DOM before each test
beforeEach(() => {
  // Create a basic DOM structure
  document.body.innerHTML = `
    <div id="app">
      <header class="header">
        <nav class="navigation">
          <div class="theme-toggle" id="theme-toggle">
            <div class="theme-icon-wrap">🌙</div>
          </div>
        </nav>
      </header>
      <main id="main"></main>
      <footer class="footer"></footer>
    </div>
  `;
  
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
    value: localStorageMock,
    writable: true
  });
});

// Cleanup after each test
afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

// Mock GSAP since we're testing in Node environment
vi.mock('gsap', () => ({
  gsap: {
    set: vi.fn(),
    to: vi.fn(() => ({ kill: vi.fn() })),
    from: vi.fn(() => ({ kill: vi.fn() })),
    fromTo: vi.fn(() => ({ kill: vi.fn() })),
    timeline: vi.fn(() => ({
      to: vi.fn(),
      from: vi.fn(),
      fromTo: vi.fn(),
      set: vi.fn(),
      kill: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      restart: vi.fn()
    })),
    killTweensOf: vi.fn()
  }
}));

// Mock window.matchMedia for reduced motion detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock fetch for data loading tests
global.fetch = vi.fn();

// Mock Performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    timing: {
      navigationStart: Date.now() - 1000,
      requestStart: Date.now() - 800,
      responseStart: Date.now() - 600,
      domContentLoadedEventEnd: Date.now() - 400,
      loadEventEnd: Date.now() - 200
    }
  },
  writable: true
});

// Mock PerformanceObserver
const MockPerformanceObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => [])
})) as any;
Object.defineProperty(MockPerformanceObserver, 'supportedEntryTypes', {
  value: ['navigation', 'resource', 'mark', 'measure', 'paint'],
  writable: false,
  configurable: true
});
global.PerformanceObserver = MockPerformanceObserver;

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: []
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock console methods to avoid noise in tests
const consoleMock = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
};
Object.assign(console, consoleMock);

// Mock document.createElement to return proper elements
const originalCreateElement = document.createElement.bind(document);
document.createElement = vi.fn((tagName: string) => {
  const element = originalCreateElement(tagName);
  // Add common properties that tests might expect
  if (tagName === 'div') {
    Object.defineProperty(element, 'offsetWidth', { value: 100, writable: true });
    Object.defineProperty(element, 'offsetHeight', { value: 50, writable: true });
  }
  return element;
});