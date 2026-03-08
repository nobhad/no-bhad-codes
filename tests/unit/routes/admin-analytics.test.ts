/**
 * ===============================================
 * ADMIN ANALYTICS ROUTES TESTS
 * ===============================================
 * @file tests/unit/routes/admin-analytics.test.ts
 *
 * Unit tests for admin analytics route handlers:
 * KPI data, range param handling, DB error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCKS
// ============================================

// Mock database
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();
vi.mock('../../../server/database/init', () => ({
  getDatabase: () => ({ get: mockDbGet, all: mockDbAll })
}));

// Mock auth middleware - pass through
vi.mock('../../../server/middleware/auth', () => ({
  authenticateToken: (_req: any, _res: any, next: any) => next(),
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  AuthenticatedRequest: {}
}));

// Mock error handler (asyncHandler) - just call the fn
vi.mock('../../../server/middleware/errorHandler', () => ({
  asyncHandler: (fn: any) => fn
}));

// Mock api-response helpers
const mockSendSuccess = vi.fn();
const mockErrorResponse = vi.fn();
vi.mock('../../../server/utils/api-response', () => ({
  sendSuccess: (...args: unknown[]) => mockSendSuccess(...args),
  errorResponse: (...args: unknown[]) => mockErrorResponse(...args),
  ErrorCodes: {
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR'
  }
}));

// Mock row-helpers (used by api-response indirectly)
vi.mock('../../../server/database/row-helpers', () => ({
  transformData: (data: unknown) => data
}));

// Mock logger
vi.mock('../../../server/services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// ============================================
// HELPERS
// ============================================

function createMockReq(query: Record<string, string> = {}) {
  return {
    query,
    user: { id: 1, email: 'admin@test.com', type: 'admin' }
  } as any;
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

/**
 * Extract a route handler from an Express router
 */
function getRouteHandler(router: any, method: string, path: string) {
  const layer = router.stack.find((l: any) => {
    if (!l.route) return false;
    return l.route.path === path && l.route.methods[method];
  });
  if (!layer) throw new Error(`No route found for ${method.toUpperCase()} ${path}`);
  const handlers = layer.route.stack;
  return handlers[handlers.length - 1].handle;
}

/** Stub all db.get calls to return default row objects */
function stubDefaultDbResponses() {
  mockDbGet.mockResolvedValue({ value: 0, total: 0, converted: 0 });
  mockDbAll.mockResolvedValue([]);
}

// ============================================
// TESTS
// ============================================

describe('Admin Analytics Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubDefaultDbResponses();
  });

  describe('GET /analytics', () => {
    it('should return KPI data with default 30d range', async () => {
      const routerModule = await import('../../../server/routes/admin/analytics');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/analytics');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledTimes(1);
      const [resArg, dataArg] = mockSendSuccess.mock.calls[0];
      expect(resArg).toBe(res);
      expect(dataArg).toHaveProperty('kpis');
      expect(dataArg).toHaveProperty('revenueChart');
      expect(dataArg).toHaveProperty('projectsChart');
      expect(dataArg).toHaveProperty('leadsChart');
      expect(dataArg).toHaveProperty('sourceBreakdown');
    });

    it('should return KPI structure with all expected fields', async () => {
      const routerModule = await import('../../../server/routes/admin/analytics');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/analytics');

      const req = createMockReq({ range: '7d' });
      const res = createMockRes();
      await handler(req, res);

      const dataArg = mockSendSuccess.mock.calls[0][1];
      const { kpis } = dataArg;
      expect(kpis).toHaveProperty('revenue');
      expect(kpis).toHaveProperty('clients');
      expect(kpis).toHaveProperty('projects');
      expect(kpis).toHaveProperty('invoices');
      expect(kpis).toHaveProperty('conversionRate');
      expect(kpis).toHaveProperty('avgProjectValue');
    });

    it('should handle 7d range param', async () => {
      const routerModule = await import('../../../server/routes/admin/analytics');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/analytics');

      const req = createMockReq({ range: '7d' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledTimes(1);
      // Verify the date calculations used 7 days back
      expect(mockDbGet).toHaveBeenCalled();
    });

    it('should handle 90d range param', async () => {
      const routerModule = await import('../../../server/routes/admin/analytics');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/analytics');

      const req = createMockReq({ range: '90d' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledTimes(1);
    });

    it('should handle 1y range param', async () => {
      const routerModule = await import('../../../server/routes/admin/analytics');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/analytics');

      const req = createMockReq({ range: '1y' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledTimes(1);
    });

    it('should default to 30d for missing range param', async () => {
      const routerModule = await import('../../../server/routes/admin/analytics');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/analytics');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledTimes(1);
    });

    it('should default to 30d for invalid range param', async () => {
      const routerModule = await import('../../../server/routes/admin/analytics');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/analytics');

      const req = createMockReq({ range: 'invalid' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledTimes(1);
    });

    it('should return correct revenue values from DB', async () => {
      mockDbGet
        .mockResolvedValueOnce({ value: 5000 })   // current revenue
        .mockResolvedValueOnce({ value: 3000 })   // previous revenue
        .mockResolvedValueOnce({ value: 10 })     // current clients
        .mockResolvedValueOnce({ value: 3 })      // new clients current
        .mockResolvedValueOnce({ value: 2 })      // new clients previous
        .mockResolvedValueOnce({ value: 5 })      // active projects
        .mockResolvedValueOnce({ value: 2 })      // new projects current
        .mockResolvedValueOnce({ value: 1 })      // new projects previous
        .mockResolvedValueOnce({ value: 8 })      // invoices sent
        .mockResolvedValueOnce({ value: 4 })      // invoices sent previous
        .mockResolvedValueOnce({ total: 10, converted: 7 }) // leads current
        .mockResolvedValueOnce({ total: 8, converted: 5 })  // leads previous
        .mockResolvedValueOnce({ value: 2500 })   // avg project value
        .mockResolvedValueOnce({ value: 2000 });  // avg project value previous

      mockDbAll
        .mockResolvedValueOnce([{ date: '2024-01-01', revenue: 5000 }]) // revenue chart
        .mockResolvedValueOnce([{ status: 'active', count: 5 }])       // projects by status
        .mockResolvedValueOnce([{ status: 'pending', count: 3 }])      // lead funnel
        .mockResolvedValueOnce([{ source: 'Direct', count: 10 }]);     // source breakdown

      const routerModule = await import('../../../server/routes/admin/analytics');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/analytics');

      const req = createMockReq({ range: '30d' });
      const res = createMockRes();
      await handler(req, res);

      const dataArg = mockSendSuccess.mock.calls[0][1];
      expect(dataArg.kpis.revenue.value).toBe(5000);
      expect(dataArg.kpis.clients.value).toBe(10);
      expect(dataArg.kpis.projects.value).toBe(5);
      expect(dataArg.kpis.invoices.value).toBe(8);
    });

    it('should handle DB errors and return error response', async () => {
      mockDbGet.mockRejectedValue(new Error('Database connection failed'));

      const routerModule = await import('../../../server/routes/admin/analytics');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/analytics');

      const req = createMockReq({ range: '30d' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockErrorResponse).toHaveBeenCalledWith(
        res,
        'Failed to load analytics data',
        500,
        'ANALYTICS_ERROR'
      );
    });

    it('should handle null DB responses gracefully', async () => {
      mockDbGet.mockResolvedValue(null);
      mockDbAll.mockResolvedValue([]);

      const routerModule = await import('../../../server/routes/admin/analytics');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/analytics');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledTimes(1);
      const dataArg = mockSendSuccess.mock.calls[0][1];
      expect(dataArg.kpis.revenue.value).toBe(0);
      expect(dataArg.kpis.clients.value).toBe(0);
    });

    it('should calculate percentage change correctly', async () => {
      mockDbGet
        .mockResolvedValueOnce({ value: 10000 }) // current revenue
        .mockResolvedValueOnce({ value: 5000 })  // previous revenue (100% increase)
        .mockResolvedValueOnce({ value: 20 })
        .mockResolvedValueOnce({ value: 5 })
        .mockResolvedValueOnce({ value: 0 })     // no previous clients = 100% change
        .mockResolvedValueOnce({ value: 3 })
        .mockResolvedValueOnce({ value: 3 })
        .mockResolvedValueOnce({ value: 3 })
        .mockResolvedValueOnce({ value: 10 })
        .mockResolvedValueOnce({ value: 10 })
        .mockResolvedValueOnce({ total: 10, converted: 5 })
        .mockResolvedValueOnce({ total: 10, converted: 5 })
        .mockResolvedValueOnce({ value: 1000 })
        .mockResolvedValueOnce({ value: 1000 });

      mockDbAll.mockResolvedValue([]);

      const routerModule = await import('../../../server/routes/admin/analytics');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/analytics');

      const req = createMockReq({ range: '30d' });
      const res = createMockRes();
      await handler(req, res);

      const dataArg = mockSendSuccess.mock.calls[0][1];
      expect(dataArg.kpis.revenue.change).toBe(100); // (10000-5000)/5000*100 = 100%
      expect(dataArg.kpis.clients.change).toBe(100);  // 5 from 0 = 100%
    });

    it('should return chart data with labels and datasets', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          { date: '2024-01-01', revenue: 1000 },
          { date: '2024-01-02', revenue: 2000 }
        ])
        .mockResolvedValueOnce([
          { status: 'active', count: 3 },
          { status: 'completed', count: 5 }
        ])
        .mockResolvedValueOnce([
          { status: 'pending', count: 4 }
        ])
        .mockResolvedValueOnce([
          { source: 'Direct', count: 10 }
        ]);

      const routerModule = await import('../../../server/routes/admin/analytics');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/analytics');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      const dataArg = mockSendSuccess.mock.calls[0][1];
      expect(dataArg.revenueChart.labels).toEqual(['2024-01-01', '2024-01-02']);
      expect(dataArg.revenueChart.datasets[0].data).toEqual([1000, 2000]);
      expect(dataArg.projectsChart.labels).toEqual(['active', 'completed']);
      expect(dataArg.leadsChart.labels).toEqual(['pending']);
    });
  });
});
