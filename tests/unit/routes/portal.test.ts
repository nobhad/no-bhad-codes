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

// Mock api-response helpers
const mockSendUnauthorized = vi.fn((_res, _msg) => undefined);
const mockSendNotFound = vi.fn((_res, _msg) => undefined);
const mockSendForbidden = vi.fn((_res, _msg) => undefined);
const mockSendServerError = vi.fn((_res, _msg) => undefined);

vi.mock('../../../server/utils/api-response', () => ({
  sendUnauthorized: (...args: unknown[]) => mockSendUnauthorized(...args),
  sendNotFound: (...args: unknown[]) => mockSendNotFound(...args),
  sendForbidden: (...args: unknown[]) => mockSendForbidden(...args),
  sendServerError: (...args: unknown[]) => mockSendServerError(...args)
}));

// Mock logger
vi.mock('../../../server/services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
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
        bodyClass: 'client-portal'
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

  describe('GET /dashboard/tab/:tabId', () => {
    const mockFetchTabData = vi.fn();
    const mockHasTabDataFetcher = vi.fn();
    const mockGetServerTableDef = vi.fn();

    beforeEach(() => {
      vi.doMock('../../../server/services/tab-data-service', () => ({
        fetchTabData: mockFetchTabData,
        hasTabDataFetcher: mockHasTabDataFetcher,
        getServerTableDef: mockGetServerTableDef
      }));
      mockFetchTabData.mockReset();
      mockHasTabDataFetcher.mockReset();
      mockGetServerTableDef.mockReset();
    });

    it('should return 401 when no auth cookie', async () => {
      mockVerify.mockImplementation(() => { throw new Error('invalid'); });

      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/dashboard/tab/:tabId');

      const req = createMockReq({}, { tabId: 'admin-clients' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendUnauthorized).toHaveBeenCalledWith(res, 'Authentication required');
    });

    it('should return 401 when JWT has no userId', async () => {
      mockVerify.mockReturnValue({ type: 'admin' });

      mockHasTabDataFetcher.mockReturnValue(true);
      mockGetServerTableDef.mockReturnValue({ id: 'admin-clients', portal: 'admin' });

      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/dashboard/tab/:tabId');

      const req = createMockReq({ auth_token: 'valid-token' }, { tabId: 'admin-clients' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendUnauthorized).toHaveBeenCalledWith(res, 'Invalid token: missing user ID');
    });

    it('should return 404 when tab does not exist', async () => {
      mockVerify.mockReturnValue({ type: 'admin', id: 1 });

      mockHasTabDataFetcher.mockReturnValue(false);
      mockGetServerTableDef.mockReturnValue(undefined);

      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/dashboard/tab/:tabId');

      const req = createMockReq({ auth_token: 'valid-token' }, { tabId: 'nonexistent' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendNotFound).toHaveBeenCalledWith(res, 'Tab not found');
    });

    it('should return 404 when client tries to access admin tab (no enumeration)', async () => {
      mockVerify.mockReturnValue({ type: 'client', clientId: 42 });

      mockHasTabDataFetcher.mockReturnValue(true);
      mockGetServerTableDef.mockReturnValue({ id: 'admin-clients', portal: 'admin' });

      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/dashboard/tab/:tabId');

      const req = createMockReq({ auth_token: 'valid-token' }, { tabId: 'admin-clients' });
      const res = createMockRes();
      await handler(req, res);

      // Should return 404, not 403 — prevents tab enumeration
      expect(mockSendNotFound).toHaveBeenCalledWith(res, 'Tab not found');
      expect(mockSendUnauthorized).not.toHaveBeenCalled();
    });

    it('should return 500 when fetchTabData returns null', async () => {
      mockVerify.mockReturnValue({ type: 'admin', id: 1 });

      mockHasTabDataFetcher.mockReturnValue(true);
      mockGetServerTableDef.mockReturnValue({ id: 'admin-clients', portal: 'admin' });
      mockFetchTabData.mockResolvedValue(null);

      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/dashboard/tab/:tabId');

      const req = createMockReq({ auth_token: 'valid-token' }, { tabId: 'admin-clients' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendServerError).toHaveBeenCalledWith(res, 'Failed to fetch tab data');
    });

    it('should return 500 on unexpected errors', async () => {
      mockVerify.mockReturnValue({ type: 'admin', id: 1 });

      mockHasTabDataFetcher.mockReturnValue(true);
      mockGetServerTableDef.mockReturnValue({ id: 'admin-clients', portal: 'admin' });
      mockFetchTabData.mockRejectedValue(new Error('DB down'));

      const { portalRoutes } = await import('../../../server/routes/portal');
      const handler = getRouteHandler(portalRoutes, 'get', '/dashboard/tab/:tabId');

      const req = createMockReq({ auth_token: 'valid-token' }, { tabId: 'admin-clients' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendServerError).toHaveBeenCalled();
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
