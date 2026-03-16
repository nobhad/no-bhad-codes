/**
 * ===============================================
 * PORTAL ROUTES TESTS
 * ===============================================
 * @file tests/unit/routes/portal.test.ts
 *
 * Unit tests for portal route handlers:
 * authentication, role-based access, redirects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock JWT
const JWT_SECRET = 'test-secret';
const mockVerify = vi.fn();
vi.mock('jsonwebtoken', () => ({
  default: { verify: (...args: unknown[]) => mockVerify(...args) }
}));

// Mock navigation config
vi.mock('../../../server/config/navigation', () => ({
  getPortalConfig: vi.fn((type: string) => ({ portalType: type })),
  ADMIN_TAB_IDS: ['admin-clients', 'admin-projects'],
  CLIENT_TAB_IDS: ['portal-invoices', 'portal-messages'],
  ICONS: { user: 'User' }
}));

// Mock auth constants
vi.mock('../../../server/utils/auth-constants', () => ({
  COOKIE_CONFIG: { AUTH_TOKEN_NAME: 'auth_token' }
}));

// Mock business config
vi.mock('../../../server/config/business', () => ({
  BUSINESS_INFO: { name: 'Test Business' }
}));

// Helper to create mock request/response
function createMockReq(cookies: Record<string, string> = {}, params: Record<string, string> = {}) {
  return { cookies, params } as any;
}

function createMockRes() {
  const res: any = {};
  res.redirect = vi.fn().mockReturnValue(res);
  res.render = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.type = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

describe('Portal Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  describe('GET /portal', () => {
    it('should redirect to /#/portal when no auth cookie', async () => {
      mockVerify.mockImplementation(() => { throw new Error('invalid'); });

      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/portal');

      const req = createMockReq({});
      const res = createMockRes();
      handler(req, res);

      expect(res.redirect).toHaveBeenCalledWith('/#/portal');
    });

    it('should redirect to /dashboard when valid auth cookie exists', async () => {
      mockVerify.mockReturnValue({ type: 'admin', id: 1 });

      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/portal');

      const req = createMockReq({ auth_token: 'valid-token' });
      const res = createMockRes();
      handler(req, res);

      expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('GET /dashboard', () => {
    it('should redirect to /#/portal when no auth', async () => {
      mockVerify.mockImplementation(() => { throw new Error('invalid'); });

      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/dashboard');

      const req = createMockReq({});
      const res = createMockRes();
      handler(req, res);

      expect(res.redirect).toHaveBeenCalledWith('/#/portal');
    });

    it('should render admin portal for admin users', async () => {
      mockVerify.mockReturnValue({ type: 'admin', id: 1 });

      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/dashboard');

      const req = createMockReq({ auth_token: 'valid-token' });
      const res = createMockRes();
      handler(req, res);

      expect(res.render).toHaveBeenCalledWith('layouts/portal', expect.objectContaining({
        portalType: 'admin',
        bodyClass: 'admin'
      }));
    });

    it('should render client portal for client users', async () => {
      mockVerify.mockReturnValue({ type: 'client', clientId: 42 });

      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/dashboard');

      const req = createMockReq({ auth_token: 'valid-token' });
      const res = createMockRes();
      handler(req, res);

      expect(res.render).toHaveBeenCalledWith('layouts/portal', expect.objectContaining({
        portalType: 'client',
        bodyClass: 'client'
      }));
    });
  });

  describe('Legacy redirects', () => {
    it('should 301 redirect /admin/login to /#/portal', async () => {
      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/admin/login');

      const res = createMockRes();
      handler(createMockReq(), res);

      expect(res.redirect).toHaveBeenCalledWith(301, '/#/portal');
    });

    it('should 301 redirect /client/login to /#/portal', async () => {
      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/client/login');

      const res = createMockRes();
      handler(createMockReq(), res);

      expect(res.redirect).toHaveBeenCalledWith(301, '/#/portal');
    });

    it('should 301 redirect /admin to /dashboard', async () => {
      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/admin');

      const res = createMockRes();
      handler(createMockReq(), res);

      expect(res.redirect).toHaveBeenCalledWith(301, '/dashboard');
    });

    it('should 301 redirect /client to /dashboard', async () => {
      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/client');

      const res = createMockRes();
      handler(createMockReq(), res);

      expect(res.redirect).toHaveBeenCalledWith(301, '/dashboard');
    });
  });

});

/**
 * Helper to extract a route handler from an Express router
 * by matching method + path. Works with Express 4.x layer stack.
 * For routes with middleware (e.g., rate limiter), returns the last handler.
 */
function getRouteHandler(router: any, method: string, path: string) {
  const layer = router.stack.find((l: any) => {
    if (!l.route) return false;
    return l.route.path === path && l.route.methods[method];
  });
  if (!layer) throw new Error(`No route found for ${method.toUpperCase()} ${path}`);
  // Return the last handler in the stack (after middleware)
  const handlers = layer.route.stack;
  return handlers[handlers.length - 1].handle;
}
