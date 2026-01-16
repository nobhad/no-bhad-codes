/**
 * ===============================================
 * ROUTER SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/router-service.test.ts
 *
 * Unit tests for client-side router service.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RouterService, Route } from '../../../src/services/router-service';

// Mock window.location
const mockLocation = {
  hash: '',
  pathname: '/',
  href: 'http://localhost/',
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock window.history
const mockHistory = {
  pushState: vi.fn(),
  replaceState: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  go: vi.fn(),
};

Object.defineProperty(window, 'history', {
  value: mockHistory,
  writable: true,
});

describe('RouterService', () => {
  let routerService: RouterService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.hash = '';
    mockLocation.pathname = '/';
    routerService = new RouterService();
  });

  afterEach(async () => {
    if (routerService) {
      await routerService.destroy();
    }
    vi.clearAllTimers();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      expect(routerService).toBeInstanceOf(RouterService);
    });

    it('should initialize with custom config', () => {
      const customRouter = new RouterService({
        defaultRoute: '/home',
        smoothScrolling: false,
        scrollOffset: 100,
      });

      expect(customRouter).toBeInstanceOf(RouterService);
      customRouter.destroy();
    });
  });

  describe('route registration', () => {
    it('should register a new route', () => {
      const route: Route = {
        path: '/test',
        section: 'test-section',
        title: 'Test Page',
      };

      routerService.registerRoute(route);

      expect(routerService['routes'].has('/test')).toBe(true);
    });

    it('should register route with beforeEnter hook', () => {
      const beforeEnter = vi.fn().mockReturnValue(true);
      const route: Route = {
        path: '/protected',
        section: 'protected',
        beforeEnter,
      };

      routerService.registerRoute(route);

      expect(routerService['routes'].has('/protected')).toBe(true);
    });

    it('should register route with onEnter hook', () => {
      const onEnter = vi.fn();
      const route: Route = {
        path: '/test',
        section: 'test',
        onEnter,
      };

      routerService.registerRoute(route);

      expect(routerService['routes'].has('/test')).toBe(true);
    });
  });

  describe('navigation', () => {
    beforeEach(async () => {
      await routerService.init();
    });

    it('should navigate to a registered route', async () => {
      const route: Route = {
        path: '/test',
        section: 'test-section',
      };

      routerService.registerRoute(route);

      await routerService.navigate('/test');

      expect(routerService.getCurrentRoute()).toBe('/test');
    });

    it('should call onEnter hook when navigating', async () => {
      const onEnter = vi.fn();
      const route: Route = {
        path: '/test',
        section: 'test',
        onEnter,
      };

      routerService.registerRoute(route);
      await routerService.navigate('/test');

      expect(onEnter).toHaveBeenCalled();
    });

    it('should call onLeave hook when leaving route', async () => {
      const onLeave = vi.fn();
      const route1: Route = {
        path: '/route1',
        section: 'route1',
        onLeave,
      };
      const route2: Route = {
        path: '/route2',
        section: 'route2',
      };

      routerService.registerRoute(route1);
      routerService.registerRoute(route2);

      await routerService.navigate('/route1');
      await routerService.navigate('/route2');

      expect(onLeave).toHaveBeenCalled();
    });

    it('should prevent navigation if beforeEnter returns false', async () => {
      const beforeEnter = vi.fn().mockReturnValue(false);
      const route: Route = {
        path: '/protected',
        section: 'protected',
        beforeEnter,
      };

      routerService.registerRoute(route);

      const result = await routerService.navigate('/protected');

      expect(result).toBe(false);
      expect(beforeEnter).toHaveBeenCalled();
    });

    it('should allow navigation if beforeEnter returns true', async () => {
      const beforeEnter = vi.fn().mockReturnValue(true);
      const route: Route = {
        path: '/protected',
        section: 'protected',
        beforeEnter,
      };

      routerService.registerRoute(route);

      const result = await routerService.navigate('/protected');

      expect(result).toBe(true);
    });
  });

  describe('getCurrentRoute', () => {
    it('should return current route', async () => {
      await routerService.init();
      await routerService.navigate('/about');

      expect(routerService.getCurrentRoute()).toBe('/about');
    });
  });

  describe('hash routing', () => {
    beforeEach(async () => {
      await routerService.init();
    });

    it('should handle hash change events', async () => {
      const route: Route = {
        path: '#/test',
        section: 'test',
      };

      routerService.registerRoute(route);

      // Simulate hash change
      mockLocation.hash = '#/test';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      // Wait for async handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(routerService.getCurrentRoute()).toBe('#/test');
    });
  });

  describe('default routes', () => {
    it('should have default routes registered after init', async () => {
      await routerService.init();

      expect(routerService['routes'].has('/')).toBe(true);
      expect(routerService['routes'].has('#/about')).toBe(true);
      expect(routerService['routes'].has('#/contact')).toBe(true);
    });
  });
});
