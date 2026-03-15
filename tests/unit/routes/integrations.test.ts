/**
 * ===============================================
 * INTEGRATIONS ROUTES TESTS
 * ===============================================
 * @file tests/unit/routes/integrations.test.ts
 *
 * Unit tests for integrations route handlers:
 * status, health check, Zapier, notifications, Stripe, calendar.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCKS
// ============================================

// Mock database
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();
const mockDbRun = vi.fn();
vi.mock('../../../server/database/init', () => ({
  getDatabase: () => ({ get: mockDbGet, all: mockDbAll, run: mockDbRun })
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

// Mock integrations service
const mockIsStripeConfigured = vi.fn();
const mockIsGoogleCalendarConfigured = vi.fn();
const mockCheckIntegrationHealth = vi.fn();
const mockGetZapierEventTypes = vi.fn();
const mockGetZapierTriggerSamples = vi.fn();
const mockCreateZapierWebhook = vi.fn();
const mockFormatZapierPayload = vi.fn();
const mockFormatSlackMessage = vi.fn();
const mockFormatDiscordMessage = vi.fn();
const mockSaveNotificationConfig = vi.fn();
const mockGetNotificationConfigs = vi.fn();
const mockDeleteNotificationConfig = vi.fn();
const mockTestNotification = vi.fn();
const mockCreatePaymentLink = vi.fn();
const mockGetPaymentLink = vi.fn();
const mockExpirePaymentLink = vi.fn();
const mockGetStripeStatus = vi.fn();
const mockVerifyWebhookSignature = vi.fn();
const mockHandleWebhookEvent = vi.fn();
const mockGetGoogleAuthUrl = vi.fn();
const mockExchangeCodeForTokens = vi.fn();
const mockExportProjectToICal = vi.fn();
const mockExportUpcomingToICal = vi.fn();
const mockSaveCalendarSyncConfig = vi.fn();
const mockGetCalendarSyncConfig = vi.fn();

vi.mock('../../../server/services/integrations/index', () => ({
  isStripeConfigured: (...args: unknown[]) => mockIsStripeConfigured(...args),
  isGoogleCalendarConfigured: (...args: unknown[]) => mockIsGoogleCalendarConfigured(...args),
  checkIntegrationHealth: (...args: unknown[]) => mockCheckIntegrationHealth(...args),
  getZapierEventTypes: (...args: unknown[]) => mockGetZapierEventTypes(...args),
  getZapierTriggerSamples: (...args: unknown[]) => mockGetZapierTriggerSamples(...args),
  createZapierWebhook: (...args: unknown[]) => mockCreateZapierWebhook(...args),
  formatZapierPayload: (...args: unknown[]) => mockFormatZapierPayload(...args),
  formatSlackMessage: (...args: unknown[]) => mockFormatSlackMessage(...args),
  formatDiscordMessage: (...args: unknown[]) => mockFormatDiscordMessage(...args),
  saveNotificationConfig: (...args: unknown[]) => mockSaveNotificationConfig(...args),
  getNotificationConfigs: (...args: unknown[]) => mockGetNotificationConfigs(...args),
  deleteNotificationConfig: (...args: unknown[]) => mockDeleteNotificationConfig(...args),
  testNotification: (...args: unknown[]) => mockTestNotification(...args),
  createPaymentLink: (...args: unknown[]) => mockCreatePaymentLink(...args),
  getPaymentLink: (...args: unknown[]) => mockGetPaymentLink(...args),
  expirePaymentLink: (...args: unknown[]) => mockExpirePaymentLink(...args),
  getStripeStatus: (...args: unknown[]) => mockGetStripeStatus(...args),
  verifyWebhookSignature: (...args: unknown[]) => mockVerifyWebhookSignature(...args),
  handleWebhookEvent: (...args: unknown[]) => mockHandleWebhookEvent(...args),
  getGoogleAuthUrl: (...args: unknown[]) => mockGetGoogleAuthUrl(...args),
  exchangeCodeForTokens: (...args: unknown[]) => mockExchangeCodeForTokens(...args),
  exportProjectToICal: (...args: unknown[]) => mockExportProjectToICal(...args),
  exportUpcomingToICal: (...args: unknown[]) => mockExportUpcomingToICal(...args),
  saveCalendarSyncConfig: (...args: unknown[]) => mockSaveCalendarSyncConfig(...args),
  getCalendarSyncConfig: (...args: unknown[]) => mockGetCalendarSyncConfig(...args)
}));

// Mock api-response helpers
const mockSendSuccess = vi.fn();
const mockSendCreated = vi.fn();
const mockErrorResponse = vi.fn();
vi.mock('../../../server/utils/api-response', () => ({
  sendSuccess: (...args: unknown[]) => mockSendSuccess(...args),
  sendCreated: (...args: unknown[]) => mockSendCreated(...args),
  errorResponse: (...args: unknown[]) => mockErrorResponse(...args),
  ErrorCodes: {
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    STRIPE_NOT_CONFIGURED: 'STRIPE_NOT_CONFIGURED',
    GOOGLE_CALENDAR_NOT_CONFIGURED: 'GOOGLE_CALENDAR_NOT_CONFIGURED'
  }
}));

// Mock row-helpers
vi.mock('../../../server/database/row-helpers', () => ({
  transformData: (data: unknown) => data
}));

// Mock integration status service
const mockGetAllIntegrationStatuses = vi.fn();
vi.mock('../../../server/services/integration-status-service', () => ({
  integrationStatusService: {
    getAllIntegrationStatuses: (...args: unknown[]) => mockGetAllIntegrationStatuses(...args),
    getIntegrationStatus: vi.fn(),
    updateIntegrationStatus: vi.fn()
  }
}));

// Mock logger
vi.mock('../../../server/services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// ============================================
// HELPERS
// ============================================

function createMockReq(
  overrides: Record<string, unknown> = {}
) {
  return {
    query: {},
    params: {},
    body: {},
    headers: {},
    user: { id: 1, email: 'admin@test.com', type: 'admin' },
    ...overrides
  } as any;
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
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

// ============================================
// TESTS
// ============================================

describe('Integrations Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsStripeConfigured.mockReturnValue(false);
    mockIsGoogleCalendarConfigured.mockReturnValue(false);
  });

  describe('GET /status', () => {
    it('should return integration statuses from DB', async () => {
      mockGetAllIntegrationStatuses.mockResolvedValue([
        { integration_type: 'stripe', is_configured: 1, is_active: 1 },
        { integration_type: 'slack', is_configured: 1, is_active: 0 }
      ]);
      mockIsStripeConfigured.mockReturnValue(true);

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/status');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledTimes(1);
      const dataArg = mockSendSuccess.mock.calls[0][1];
      expect(dataArg).toHaveProperty('integrations');
      expect(dataArg.integrations).toHaveLength(2);
      expect(dataArg.integrations[0]).toHaveProperty('runtime_configured');
    });

    it('should enhance statuses with runtime configuration checks', async () => {
      mockGetAllIntegrationStatuses.mockResolvedValue([
        { integration_type: 'stripe', is_configured: 1 }
      ]);
      mockIsStripeConfigured.mockReturnValue(true);

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/status');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      const dataArg = mockSendSuccess.mock.calls[0][1];
      expect(dataArg.integrations[0].runtime_configured).toBe(true);
    });

    it('should return empty integrations when DB has none', async () => {
      mockGetAllIntegrationStatuses.mockResolvedValue([]);

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/status');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      const dataArg = mockSendSuccess.mock.calls[0][1];
      expect(dataArg.integrations).toEqual([]);
    });
  });

  describe('GET /health', () => {
    it('should return health report for all integrations', async () => {
      const mockReport = {
        overall: 'healthy',
        integrations: [
          { name: 'stripe', configured: true, healthy: true, checkedAt: '2024-01-01' },
          { name: 'slack', configured: false, healthy: false, checkedAt: '2024-01-01' }
        ],
        checkedAt: '2024-01-01'
      };
      mockCheckIntegrationHealth.mockResolvedValue(mockReport);

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/health');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(mockCheckIntegrationHealth).toHaveBeenCalled();
      expect(mockSendSuccess).toHaveBeenCalledWith(res, mockReport);
    });

    it('should report degraded when some integrations fail', async () => {
      const mockReport = {
        overall: 'degraded',
        integrations: [
          { name: 'stripe', configured: true, healthy: false, error: 'API key invalid', checkedAt: '2024-01-01' }
        ],
        checkedAt: '2024-01-01'
      };
      mockCheckIntegrationHealth.mockResolvedValue(mockReport);

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/health');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      const dataArg = mockSendSuccess.mock.calls[0][1];
      expect(dataArg.overall).toBe('degraded');
    });
  });

  describe('GET /zapier/events', () => {
    it('should return available Zapier event types', async () => {
      const events = ['invoice.created', 'client.created', 'project.updated'];
      mockGetZapierEventTypes.mockReturnValue(events);

      const routerModule = await import('../../../server/routes/integrations/zapier');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/zapier/events');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledWith(res, { events });
    });
  });

  describe('POST /zapier/webhook', () => {
    it('should create a new Zapier webhook', async () => {
      mockCreateZapierWebhook.mockResolvedValue({ id: 1, secret_key: 'abc123' });

      const routerModule = await import('../../../server/routes/integrations/zapier');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/zapier/webhook');

      const req = createMockReq({
        body: {
          name: 'Test Webhook',
          url: 'https://hooks.zapier.com/test',
          events: ['invoice.created']
        }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockCreateZapierWebhook).toHaveBeenCalledWith(
        'Test Webhook',
        'https://hooks.zapier.com/test',
        ['invoice.created']
      );
      expect(mockSendCreated).toHaveBeenCalledWith(
        res,
        { webhook: { id: 1, secretKey: 'abc123' } },
        'Zapier webhook created'
      );
    });

    it('should validate required webhook fields', async () => {
      const routerModule = await import('../../../server/routes/integrations/zapier');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/zapier/webhook');

      const req = createMockReq({ body: { name: 'Test' } }); // missing url and events
      const res = createMockRes();
      await handler(req, res);

      expect(mockErrorResponse).toHaveBeenCalledWith(
        res,
        'Name, URL, and events are required',
        400,
        'VALIDATION_ERROR'
      );
    });
  });

  describe('GET /notifications', () => {
    it('should return notification configurations', async () => {
      const configs = [
        { id: 1, name: 'Slack Alerts', platform: 'slack', events: ['invoice.paid'] }
      ];
      mockGetNotificationConfigs.mockResolvedValue(configs);

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/notifications');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledWith(res, { notifications: configs });
    });
  });

  describe('POST /notifications', () => {
    it('should create a new notification config', async () => {
      const saved = { id: 1, name: 'Slack Alert', platform: 'slack' };
      mockSaveNotificationConfig.mockResolvedValue(saved);

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/notifications');

      const req = createMockReq({
        body: {
          name: 'Slack Alert',
          platform: 'slack',
          webhook_url: 'https://hooks.slack.com/test',
          events: ['invoice.created']
        }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSaveNotificationConfig).toHaveBeenCalled();
      expect(mockSendCreated).toHaveBeenCalledWith(res, { notification: saved });
    });

    it('should reject invalid platform', async () => {
      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/notifications');

      const req = createMockReq({
        body: {
          name: 'Test',
          platform: 'teams',
          webhook_url: 'https://test.com',
          events: ['invoice.created']
        }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockErrorResponse).toHaveBeenCalledWith(
        res,
        'Platform must be slack or discord',
        400,
        'VALIDATION_ERROR'
      );
    });

    it('should validate required notification fields', async () => {
      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/notifications');

      const req = createMockReq({ body: { name: 'Test' } }); // missing platform, url, events
      const res = createMockRes();
      await handler(req, res);

      expect(mockErrorResponse).toHaveBeenCalledWith(
        res,
        'Name, platform, webhook URL, and events are required',
        400,
        'VALIDATION_ERROR'
      );
    });
  });

  describe('GET /stripe/status', () => {
    it('should return Stripe configuration status', async () => {
      mockGetStripeStatus.mockReturnValue({ configured: true, mode: 'test' });

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/stripe/status');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledWith(res, { configured: true, mode: 'test' });
    });
  });

  describe('POST /stripe/payment-link', () => {
    it('should return error when Stripe is not configured', async () => {
      mockIsStripeConfigured.mockReturnValue(false);

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/stripe/payment-link');

      const req = createMockReq({ body: { invoiceId: 1 } });
      const res = createMockRes();
      await handler(req, res);

      expect(mockErrorResponse).toHaveBeenCalledWith(
        res,
        'Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.',
        400,
        'STRIPE_NOT_CONFIGURED'
      );
    });

    it('should return error when invoice ID is missing', async () => {
      mockIsStripeConfigured.mockReturnValue(true);

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/stripe/payment-link');

      const req = createMockReq({ body: {} });
      const res = createMockRes();
      await handler(req, res);

      expect(mockErrorResponse).toHaveBeenCalledWith(
        res,
        'Invoice ID is required',
        400,
        'VALIDATION_ERROR'
      );
    });

    it('should return error when invoice not found in DB', async () => {
      mockIsStripeConfigured.mockReturnValue(true);
      mockDbGet.mockResolvedValue(null);

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/stripe/payment-link');

      const req = createMockReq({ body: { invoiceId: 999 } });
      const res = createMockRes();
      await handler(req, res);

      expect(mockErrorResponse).toHaveBeenCalledWith(
        res,
        'Invoice not found',
        404,
        'RESOURCE_NOT_FOUND'
      );
    });
  });

  describe('GET /calendar/status', () => {
    it('should return calendar status when not configured', async () => {
      mockIsGoogleCalendarConfigured.mockReturnValue(false);

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/calendar/status');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledWith(res, expect.objectContaining({
        configured: false,
        connected: false,
        syncConfig: null
      }));
    });

    it('should return calendar status with sync config when connected', async () => {
      mockIsGoogleCalendarConfigured.mockReturnValue(true);
      mockGetCalendarSyncConfig.mockResolvedValue({
        isActive: true,
        syncMilestones: true,
        syncTasks: false,
        syncInvoiceDueDates: true,
        lastSyncAt: '2024-01-01T00:00:00Z'
      });

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/calendar/status');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      const dataArg = mockSendSuccess.mock.calls[0][1];
      expect(dataArg.configured).toBe(true);
      expect(dataArg.connected).toBe(true);
      expect(dataArg.syncConfig).toHaveProperty('syncMilestones', true);
    });
  });

  describe('GET /calendar/auth-url', () => {
    it('should return auth URL when calendar is configured', async () => {
      mockIsGoogleCalendarConfigured.mockReturnValue(true);
      mockGetGoogleAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?...');

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/calendar/auth-url');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledWith(res, {
        authUrl: 'https://accounts.google.com/o/oauth2/auth?...'
      });
    });

    it('should return error when calendar is not configured', async () => {
      mockIsGoogleCalendarConfigured.mockReturnValue(false);

      const routerModule = await import('../../../server/routes/integrations/status');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/calendar/auth-url');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(mockErrorResponse).toHaveBeenCalledWith(
        res,
        'Google Calendar is not configured',
        400,
        'GOOGLE_CALENDAR_NOT_CONFIGURED'
      );
    });
  });
});
