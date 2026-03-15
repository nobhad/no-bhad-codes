/**
 * ===============================================
 * CLIENT PORTAL ROUTES TESTS
 * ===============================================
 * @file tests/unit/routes/client-portal.test.ts
 *
 * Unit tests for client-facing portal endpoints:
 * profile (GET/PUT /me), password change, invoices,
 * timeline, and access control.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before any imports that reference them
// ---------------------------------------------------------------------------

// Database mock
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
const mockDbAll = vi.fn();
vi.mock('../../../server/database/init', () => ({
  getDatabase: () => ({ get: mockDbGet, run: mockDbRun, all: mockDbAll })
}));

// bcryptjs mock
const mockBcryptCompare = vi.fn();
const mockBcryptHash = vi.fn();
vi.mock('bcryptjs', () => ({
  default: {
    compare: (...args: unknown[]) => mockBcryptCompare(...args),
    hash: (...args: unknown[]) => mockBcryptHash(...args)
  }
}));

// Logger mock
vi.mock('../../../server/services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Audit logger mock
vi.mock('../../../server/services/audit-logger', () => ({
  auditLogger: { logUpdate: vi.fn().mockResolvedValue(undefined) }
}));

// Email service mock
vi.mock('../../../server/services/email-service', () => ({
  emailService: { sendEmail: vi.fn().mockResolvedValue(undefined) }
}));

// Cache middleware mock — passthrough
vi.mock('../../../server/middleware/cache', () => ({
  cache: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  invalidateCache: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  QueryCache: class { get() { return null; } set() {} invalidate() {} }
}));

// Validation middleware mock — passthrough (we test handlers, not validation layer)
vi.mock('../../../server/middleware/validation', () => ({
  validateRequest: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

// Security / rate-limit mock — passthrough
vi.mock('../../../server/middleware/security', () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

// Auth middleware mock — passthrough (we set req.user directly in tests)
vi.mock('../../../server/middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: () => void) => {
    next();
  },
  requireAdmin: (req: any, res: any, next: () => void) => {
    if (!req.user || req.user.type !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    next();
  },
  requireClient: (req: any, res: any, next: () => void) => {
    if (!req.user || req.user.type !== 'client') {
      return res.status(403).json({ success: false, error: 'Client access required' });
    }
    next();
  }
}));

// Row helpers mock — must include transformData used by sendSuccess/sendPaginated
vi.mock('../../../server/database/row-helpers', () => ({
  getString: (_row: any, key: string) => _row?.[key] ?? '',
  getNumber: (_row: any, key: string) => _row?.[key] ?? 0,
  transformData: (data: unknown) => data
}));

// Soft-delete service mock
vi.mock('../../../server/services/soft-delete-service', () => ({
  softDeleteService: { softDelete: vi.fn() }
}));

// Notification preferences service mock
vi.mock('../../../server/services/notification-preferences-service', () => ({
  notificationPreferencesService: {
    getPreferences: vi.fn().mockResolvedValue({}),
    updatePreferences: vi.fn().mockResolvedValue(undefined)
  }
}));

// Client service mock
const mockGetClientProfile = vi.fn();
const mockGetClientProfileBasic = vi.fn();
const mockUpdateClientProfile = vi.fn();
const mockGetClientPasswordHash = vi.fn();
const mockUpdateClientPassword = vi.fn();
vi.mock('../../../server/services/client-service', () => ({
  clientService: {
    getClientById: vi.fn(),
    updateClient: vi.fn(),
    getClientProfile: (...args: unknown[]) => mockGetClientProfile(...args),
    getClientProfileBasic: (...args: unknown[]) => mockGetClientProfileBasic(...args),
    updateClientProfile: (...args: unknown[]) => mockUpdateClientProfile(...args),
    getClientPasswordHash: (...args: unknown[]) => mockGetClientPasswordHash(...args),
    updateClientPassword: (...args: unknown[]) => mockUpdateClientPassword(...args),
    getClientBilling: vi.fn(),
    updateClientBilling: vi.fn(),
    getClientProjects: vi.fn(),
    getPendingInvoiceCount: vi.fn(),
    getUnreadMessageCount: vi.fn(),
    getClientRecentActivity: vi.fn(),
    getPendingDocRequestCount: vi.fn(),
    getPendingContractCount: vi.fn(),
    getPendingQuestionnaireCount: vi.fn(),
    getPendingApprovalCount: vi.fn(),
    getOutstandingBalance: vi.fn(),
    getDeliverablesInReviewCount: vi.fn(),
    getCurrentDeliverable: vi.fn(),
    getClientOwnContacts: vi.fn(),
    insertClientContact: vi.fn(),
    verifyContactOwnership: vi.fn(),
    updateClientContact: vi.fn(),
    verifyContactOwnershipActive: vi.fn()
  }
}));

// Timeline service mock
const mockGetClientTimeline = vi.fn();
const mockGetRecentActivitySummary = vi.fn();
vi.mock('../../../server/services/timeline-service', () => ({
  timelineService: {
    getClientTimeline: (...args: unknown[]) => mockGetClientTimeline(...args),
    getRecentActivitySummary: (...args: unknown[]) => mockGetRecentActivitySummary(...args)
  }
}));

// Invoice service mock
const mockGetClientInvoices = vi.fn();
const mockGetInvoiceById = vi.fn();
vi.mock('../../../server/routes/invoices/helpers', () => ({
  getInvoiceService: () => ({
    getClientInvoices: (...args: unknown[]) => mockGetClientInvoices(...args),
    getInvoiceById: (...args: unknown[]) => mockGetInvoiceById(...args),
    getInvoiceByNumber: vi.fn()
  }),
  toSnakeCaseInvoice: (inv: any) => ({
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    client_id: inv.clientId,
    amount_total: inv.amountTotal,
    amount_paid: inv.amountPaid || 0,
    status: inv.status
  })
}));

// Access control mock
const mockCanAccessInvoice = vi.fn();
vi.mock('../../../server/utils/access-control', () => ({
  isUserAdmin: vi.fn(),
  canAccessInvoice: (...args: unknown[]) => mockCanAccessInvoice(...args),
  canAccessProject: vi.fn(),
  canAccessFile: vi.fn(),
  canAccessFolder: vi.fn(),
  canAccessTask: vi.fn(),
  canAccessMilestone: vi.fn(),
  canAccessChecklistItem: vi.fn(),
  canAccessFileComment: vi.fn(),
  canAccessThread: vi.fn(),
  canAccessDocumentRequest: vi.fn(),
  canAccessContract: vi.fn(),
  canAccessProposal: vi.fn(),
  getClientIdFromEntity: vi.fn()
}));

// Also mock the re-export path
vi.mock('../../../server/middleware/access-control', () => ({
  isUserAdmin: vi.fn(),
  canAccessInvoice: (...args: unknown[]) => mockCanAccessInvoice(...args),
  canAccessProject: vi.fn(),
  canAccessFile: vi.fn(),
  canAccessFolder: vi.fn(),
  canAccessTask: vi.fn(),
  canAccessMilestone: vi.fn(),
  canAccessChecklistItem: vi.fn(),
  canAccessFileComment: vi.fn(),
  canAccessThread: vi.fn(),
  canAccessDocumentRequest: vi.fn(),
  canAccessContract: vi.fn(),
  canAccessProposal: vi.fn(),
  getClientIdFromEntity: vi.fn()
}));

// crypto mock (for invitation tokens etc.)
vi.mock('crypto', () => ({
  default: { randomBytes: vi.fn(() => ({ toString: () => 'mock-token' })) },
  randomBytes: vi.fn(() => ({ toString: () => 'mock-token' }))
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock Express request with optional user, body, params, query.
 * NOTE: We set req.user directly because getRouteHandler extracts
 * only the final handler (after middleware), so authenticateToken
 * never runs in these unit tests.
 */
function createMockReq(options: {
  user?: { id: number | undefined; email: string; type: 'admin' | 'client' };
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
  ip?: string;
  headers?: Record<string, string>;
} = {}) {
  return {
    user: options.user,
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    cookies: options.cookies || {},
    ip: options.ip || '127.0.0.1',
    headers: options.headers || {}
  } as any;
}

/** Build a mock Express response with chainable methods */
function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.redirect = vi.fn().mockReturnValue(res);
  res.render = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.type = vi.fn().mockReturnValue(res);
  return res;
}

/**
 * Flush all pending microtasks/promises.
 *
 * The codebase's asyncHandler does NOT return its inner promise:
 *   (req, res, next) => { Promise.resolve(fn(req,res,next)).catch(next); }
 * so `await handler(req, res)` resolves immediately. We must drain the
 * microtask queue to let async route handlers finish.
 *
 * We chain multiple setTimeout ticks to handle deeply nested async chains.
 */
async function flushPromises(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * Find a route layer in an Express router by method + path.
 * Searches recursively through sub-routers mounted via router.use().
 * Returns the layer object (with .route property) or null.
 */
function findRouteLayer(router: any, method: string, path: string): any {
  for (const l of router.stack) {
    if (l.route && l.route.path === path && l.route.methods[method]) {
      return l;
    }
    if (!l.route && l.handle && l.handle.stack) {
      const found = findRouteLayer(l.handle, method, path);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Extract a route handler from an Express router by method + path.
 * Returns the last handler in the middleware chain (the actual handler).
 * Also searches recursively through sub-routers mounted via router.use().
 */
function getRouteHandler(router: any, method: string, path: string) {
  // Search in the current router's stack
  for (const l of router.stack) {
    // Direct route layer
    if (l.route && l.route.path === path && l.route.methods[method]) {
      const handlers = l.route.stack;
      return handlers[handlers.length - 1].handle;
    }
    // Sub-router layer (mounted via router.use())
    if (!l.route && l.handle && l.handle.stack) {
      try {
        return getRouteHandler(l.handle, method, path);
      } catch {
        // Not found in this sub-router, continue
      }
    }
  }
  throw new Error(`No route found for ${method.toUpperCase()} ${path}`);
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('Client Portal Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Client Profile
  // =========================================================================
  describe('Client Profile -- GET /me', () => {
    it('should return the authenticated client profile', async () => {
      const clientRow = {
        id: 42,
        email: 'client@example.com',
        company_name: 'Acme Corp',
        contact_name: 'Jane Doe',
        phone: '555-1234',
        status: 'active',
        client_type: 'business',
        created_at: '2025-01-01',
        updated_at: '2025-06-01'
      };
      mockGetClientProfile.mockResolvedValue(clientRow);

      const { default: router } = await import('../../../server/routes/clients');
      const handler = getRouteHandler(router, 'get', '/me');

      const req = createMockReq({
        user: { id: 42, email: 'client@example.com', type: 'client' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ client: clientRow })
        })
      );
    });

    it('should return 403 when a non-client user accesses /me', async () => {
      const { default: router } = await import('../../../server/routes/clients');
      const handler = getRouteHandler(router, 'get', '/me');

      const req = createMockReq({
        user: { id: 1, email: 'admin@example.com', type: 'admin' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, code: 'ACCESS_DENIED' })
      );
    });

    it('should return 404 when client record does not exist', async () => {
      mockGetClientProfile.mockResolvedValue(undefined);

      const { default: router } = await import('../../../server/routes/clients');
      const handler = getRouteHandler(router, 'get', '/me');

      const req = createMockReq({
        user: { id: 999, email: 'gone@example.com', type: 'client' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, code: 'CLIENT_NOT_FOUND' })
      );
    });
  });

  describe('Client Profile -- PUT /me', () => {
    it('should update the client profile and return updated data', async () => {
      const updatedRow = {
        id: 42,
        email: 'client@example.com',
        company_name: 'Acme Inc',
        contact_name: 'Jane Smith',
        phone: '555-9999',
        client_type: 'business'
      };
      mockUpdateClientProfile.mockResolvedValue(undefined);
      mockGetClientProfileBasic.mockResolvedValue(updatedRow);

      const { default: router } = await import('../../../server/routes/clients');
      const handler = getRouteHandler(router, 'put', '/me');

      const req = createMockReq({
        user: { id: 42, email: 'client@example.com', type: 'client' },
        body: {
          contact_name: 'Jane Smith',
          company_name: 'Acme Inc',
          phone: '555-9999'
        }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(mockUpdateClientProfile).toHaveBeenCalledWith(42, {
        contact_name: 'Jane Smith',
        company_name: 'Acme Inc',
        phone: '555-9999'
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ client: updatedRow })
        })
      );
    });

    it('should return 403 when admin tries to use PUT /me', async () => {
      const { default: router } = await import('../../../server/routes/clients');
      const handler = getRouteHandler(router, 'put', '/me');

      const req = createMockReq({
        user: { id: 1, email: 'admin@example.com', type: 'admin' },
        body: { contact_name: 'Hacker' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // =========================================================================
  // Password Change
  // =========================================================================
  describe('Client Password -- PUT /me/password', () => {
    it('should change password when current password is valid', async () => {
      mockGetClientPasswordHash.mockResolvedValue({ password_hash: '$2a$12$existinghash' });
      mockBcryptCompare.mockResolvedValue(true);
      mockBcryptHash.mockResolvedValue('$2a$12$newhashedpassword');
      mockUpdateClientPassword.mockResolvedValue(undefined);

      const { default: router } = await import('../../../server/routes/clients');
      const handler = getRouteHandler(router, 'put', '/me/password');

      const req = createMockReq({
        user: { id: 42, email: 'client@example.com', type: 'client' },
        body: { currentPassword: 'OldPass123!', newPassword: 'NewSecure456!' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(mockBcryptCompare).toHaveBeenCalledWith('OldPass123!', '$2a$12$existinghash');
      expect(mockBcryptHash).toHaveBeenCalledWith('NewSecure456!', 12);
      expect(mockUpdateClientPassword).toHaveBeenCalledWith(42, '$2a$12$newhashedpassword');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Password changed successfully' })
      );
    });

    it('should return 401 when current password is wrong', async () => {
      mockGetClientPasswordHash.mockResolvedValue({ password_hash: '$2a$12$existinghash' });
      mockBcryptCompare.mockResolvedValue(false);

      const { default: router } = await import('../../../server/routes/clients');
      const handler = getRouteHandler(router, 'put', '/me/password');

      const req = createMockReq({
        user: { id: 42, email: 'client@example.com', type: 'client' },
        body: { currentPassword: 'WrongPass!', newPassword: 'NewSecure456!' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_PASSWORD' })
      );
    });

    it('should return 400 when new password is too short', async () => {
      const { default: router } = await import('../../../server/routes/clients');
      const handler = getRouteHandler(router, 'put', '/me/password');

      const req = createMockReq({
        user: { id: 42, email: 'client@example.com', type: 'client' },
        body: { currentPassword: 'OldPass123!', newPassword: 'short' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'WEAK_PASSWORD' })
      );
    });

    it('should return 400 when required password fields are missing', async () => {
      const { default: router } = await import('../../../server/routes/clients');
      const handler = getRouteHandler(router, 'put', '/me/password');

      const req = createMockReq({
        user: { id: 42, email: 'client@example.com', type: 'client' },
        body: {}
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'MISSING_FIELDS' })
      );
    });
  });

  // =========================================================================
  // Client Invoices (via invoice client-routes)
  // =========================================================================
  describe('Client Invoices -- GET /me (invoices)', () => {
    it('should return only the authenticated client invoices with summary', async () => {
      const invoices = [
        { id: 1, invoiceNumber: 'INV-001', clientId: 42, amountTotal: 1000, amountPaid: 1000, status: 'paid' },
        { id: 2, invoiceNumber: 'INV-002', clientId: 42, amountTotal: 500, amountPaid: 0, status: 'sent' }
      ];
      mockGetClientInvoices.mockResolvedValue(invoices);

      const { clientRoutesRouter } = await import('../../../server/routes/invoices/client-routes');
      const handler = getRouteHandler(clientRoutesRouter, 'get', '/me');

      const req = createMockReq({
        user: { id: 42, email: 'client@example.com', type: 'client' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(mockGetClientInvoices).toHaveBeenCalledWith(42);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            count: 2,
            summary: expect.objectContaining({
              totalPaid: 1000,
              totalOutstanding: 500
            })
          })
        })
      );
    });

    it('should return 401 when no clientId is present on request', async () => {
      const { clientRoutesRouter } = await import('../../../server/routes/invoices/client-routes');
      const handler = getRouteHandler(clientRoutesRouter, 'get', '/me');

      const req = createMockReq({
        user: { id: undefined, email: '', type: 'client' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'AUTH_REQUIRED' })
      );
    });
  });

  describe('Client Invoices -- GET /:id', () => {
    it('should return a specific invoice when access is allowed', async () => {
      const invoice = { id: 10, invoiceNumber: 'INV-010', clientId: 42, amountTotal: 2000 };
      mockCanAccessInvoice.mockResolvedValue(true);
      mockGetInvoiceById.mockResolvedValue(invoice);

      const { clientRoutesRouter } = await import('../../../server/routes/invoices/client-routes');
      const handler = getRouteHandler(clientRoutesRouter, 'get', '/:id');

      const req = createMockReq({
        user: { id: 42, email: 'client@example.com', type: 'client' },
        params: { id: '10' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(mockCanAccessInvoice).toHaveBeenCalledWith(req, 10);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ invoice })
        })
      );
    });

    it('should return 404 when client tries to access another client invoice', async () => {
      mockCanAccessInvoice.mockResolvedValue(false);

      const { clientRoutesRouter } = await import('../../../server/routes/invoices/client-routes');
      const handler = getRouteHandler(clientRoutesRouter, 'get', '/:id');

      const req = createMockReq({
        user: { id: 42, email: 'client@example.com', type: 'client' },
        params: { id: '99' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      // Returns 404 (not 403) to prevent information disclosure
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('should return 400 for non-numeric invoice ID', async () => {
      const { clientRoutesRouter } = await import('../../../server/routes/invoices/client-routes');
      const handler = getRouteHandler(clientRoutesRouter, 'get', '/:id');

      const req = createMockReq({
        user: { id: 42, email: 'client@example.com', type: 'client' },
        params: { id: 'abc' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_ID' })
      );
    });
  });

  // =========================================================================
  // Client Timeline
  // =========================================================================
  describe('Client Timeline -- GET /me/timeline', () => {
    it('should return paginated activity timeline', async () => {
      const events = [
        { id: 1, type: 'invoice_created', createdAt: '2025-06-01' },
        { id: 2, type: 'project_updated', createdAt: '2025-06-02' }
      ];
      mockGetClientTimeline.mockResolvedValue({ events, total: 2 });

      const { default: router } = await import('../../../server/routes/clients');
      const handler = getRouteHandler(router, 'get', '/me/timeline');

      const req = createMockReq({
        user: { id: 42, email: 'client@example.com', type: 'client' },
        query: { page: '1', perPage: '10' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(mockGetClientTimeline).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ limit: expect.any(Number), offset: expect.any(Number) })
      );
      // sendPaginated calls res.json() directly (no res.status() call)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ type: 'invoice_created' })
          ]),
          pagination: expect.objectContaining({
            total: 2
          })
        })
      );
    });

    it('should return 403 for non-client users accessing timeline', async () => {
      const { default: router } = await import('../../../server/routes/clients');
      const handler = getRouteHandler(router, 'get', '/me/timeline');

      const req = createMockReq({
        user: { id: 1, email: 'admin@example.com', type: 'admin' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ACCESS_DENIED' })
      );
    });

    it('should return 400 for invalid projectId query parameter', async () => {
      const { default: router } = await import('../../../server/routes/clients');
      const handler = getRouteHandler(router, 'get', '/me/timeline');

      const req = createMockReq({
        user: { id: 42, email: 'client@example.com', type: 'client' },
        query: { projectId: 'not-a-number' }
      });
      const res = createMockRes();
      handler(req, res);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });
  });

  // =========================================================================
  // Error Cases -- Unauthenticated / Auth enforcement
  // =========================================================================
  describe('Error Cases -- Authentication enforcement', () => {
    it('should have authenticateToken middleware on GET /me profile route', async () => {
      const { default: router } = await import('../../../server/routes/clients');
      const layer = findRouteLayer(router, 'get', '/me');

      expect(layer).toBeTruthy();
      const middlewareNames = layer!.route.stack.map((s: any) =>
        s.handle.name || 'anonymous'
      );
      expect(middlewareNames).toContain('authenticateToken');
    });

    it('should have authenticateToken middleware on PUT /me/password route', async () => {
      const { default: router } = await import('../../../server/routes/clients');
      const layer = findRouteLayer(router, 'put', '/me/password');

      expect(layer).toBeTruthy();
      const middlewareNames = layer!.route.stack.map((s: any) =>
        s.handle.name || 'anonymous'
      );
      expect(middlewareNames).toContain('authenticateToken');
    });

    it('should have authenticateToken middleware on invoice GET /me route', async () => {
      const { clientRoutesRouter } = await import('../../../server/routes/invoices/client-routes');
      const layer = clientRoutesRouter.stack.find((l: any) => {
        return l.route?.path === '/me' && l.route?.methods.get;
      });

      expect(layer).toBeTruthy();
      const middlewareNames = layer!.route.stack.map((s: any) =>
        s.handle.name || 'anonymous'
      );
      expect(middlewareNames).toContain('authenticateToken');
    });

    it('should have authenticateToken middleware on invoice GET /:id route', async () => {
      const { clientRoutesRouter } = await import('../../../server/routes/invoices/client-routes');
      const layer = clientRoutesRouter.stack.find((l: any) => {
        return l.route?.path === '/:id' && l.route?.methods.get;
      });

      expect(layer).toBeTruthy();
      const middlewareNames = layer!.route.stack.map((s: any) =>
        s.handle.name || 'anonymous'
      );
      expect(middlewareNames).toContain('authenticateToken');
    });
  });
});
