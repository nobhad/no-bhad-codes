/**
 * ===============================================
 * DATA QUALITY ROUTES TESTS
 * ===============================================
 * @file tests/unit/routes/data-quality.test.ts
 *
 * Unit tests for data quality route handlers:
 * email validation, duplicate scanning, security checks.
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
  requireAdmin: (_req: any, _res: any, next: any) => next()
}));

// Mock duplicate detection service
const mockCheckForDuplicates = vi.fn();
const mockMergeDuplicates = vi.fn();
const mockGetDuplicateStats = vi.fn();
vi.mock('../../../server/services/duplicate-detection-service', () => ({
  checkForDuplicates: (...args: unknown[]) => mockCheckForDuplicates(...args),
  mergeDuplicates: (...args: unknown[]) => mockMergeDuplicates(...args),
  getDuplicateStats: (...args: unknown[]) => mockGetDuplicateStats(...args)
}));

// Mock validation service
const mockValidateEmail = vi.fn();
const mockValidatePhone = vi.fn();
const mockValidateUrl = vi.fn();
const mockValidateFile = vi.fn();
const mockValidateObject = vi.fn();
const mockSanitizeInput = vi.fn();
const mockDetectXSS = vi.fn();
const mockDetectSQLInjection = vi.fn();
vi.mock('../../../server/services/validation-service', () => ({
  validateEmail: (...args: unknown[]) => mockValidateEmail(...args),
  validatePhone: (...args: unknown[]) => mockValidatePhone(...args),
  validateUrl: (...args: unknown[]) => mockValidateUrl(...args),
  validateFile: (...args: unknown[]) => mockValidateFile(...args),
  validateObject: (...args: unknown[]) => mockValidateObject(...args),
  sanitizeInput: (...args: unknown[]) => mockSanitizeInput(...args),
  detectXSS: (...args: unknown[]) => mockDetectXSS(...args),
  detectSQLInjection: (...args: unknown[]) => mockDetectSQLInjection(...args)
}));

// Mock rate limiter
const mockBlockIP = vi.fn();
const mockUnblockIP = vi.fn();
const mockGetRateLimitStats = vi.fn();
vi.mock('../../../server/middleware/rate-limiter', () => ({
  blockIP: (...args: unknown[]) => mockBlockIP(...args),
  unblockIP: (...args: unknown[]) => mockUnblockIP(...args),
  getRateLimitStats: (...args: unknown[]) => mockGetRateLimitStats(...args)
}));

// Mock user service
vi.mock('../../../server/services/user-service', () => ({
  userService: { getUserIdByEmail: vi.fn().mockResolvedValue(1) }
}));

// Mock api-response helpers
const mockSendSuccess = vi.fn();
const mockErrorResponseWithPayload = vi.fn();
const mockSanitizeErrorMessage = vi.fn().mockReturnValue('Error message');
vi.mock('../../../server/utils/api-response', () => ({
  sendSuccess: (...args: unknown[]) => mockSendSuccess(...args),
  errorResponseWithPayload: (...args: unknown[]) => mockErrorResponseWithPayload(...args),
  sanitizeErrorMessage: (...args: unknown[]) => mockSanitizeErrorMessage(...args),
  ErrorCodes: {
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR'
  }
}));

// Mock row-helpers
vi.mock('../../../server/database/row-helpers', () => ({
  transformData: (data: unknown) => data
}));

// Mock error handler (asyncHandler) - just call the fn
vi.mock('../../../server/middleware/errorHandler', () => ({
  asyncHandler: (fn: any) => fn
}));

// Mock data quality service
vi.mock('../../../server/services/data-quality-service', () => ({
  dataQualityService: {
    logSecurityThreat: vi.fn().mockResolvedValue(undefined),
    dismissDuplicate: vi.fn().mockResolvedValue(undefined),
    getDuplicateHistory: vi.fn().mockResolvedValue({ detectionLogs: [], resolutionLogs: [] }),
    storeMetrics: vi.fn().mockResolvedValue(undefined),
    getMetricsHistory: vi.fn().mockResolvedValue([])
  }
}));

// Mock logger
vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn().mockResolvedValue(undefined),
    debug: vi.fn()
  }
}));

// ============================================
// HELPERS
// ============================================

function createMockReq(body: Record<string, unknown> = {}, query: Record<string, string> = {}) {
  return {
    body,
    query,
    params: {},
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
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

// ============================================
// TESTS
// ============================================

describe('Data Quality Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /validate/email', () => {
    it('should validate a valid email address', async () => {
      mockValidateEmail.mockReturnValue({ valid: true, normalized: 'user@example.com' });

      const routerModule = await import('../../../server/routes/data-quality/validation');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/validate/email');

      const req = createMockReq({ email: 'user@example.com' });
      const res = createMockRes();
      handler(req, res);

      expect(mockValidateEmail).toHaveBeenCalledWith('user@example.com');
      expect(mockSendSuccess).toHaveBeenCalledWith(res, { valid: true, normalized: 'user@example.com' });
    });

    it('should return validation error when email is missing', async () => {
      const routerModule = await import('../../../server/routes/data-quality/validation');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/validate/email');

      const req = createMockReq({});
      const res = createMockRes();
      handler(req, res);

      expect(mockErrorResponseWithPayload).toHaveBeenCalledWith(
        res, 'Validation error', 400, 'VALIDATION_ERROR',
        { message: 'Email is required' }
      );
      expect(mockValidateEmail).not.toHaveBeenCalled();
    });

    it('should return invalid result for bad email format', async () => {
      mockValidateEmail.mockReturnValue({ valid: false, reason: 'Invalid format' });

      const routerModule = await import('../../../server/routes/data-quality/validation');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/validate/email');

      const req = createMockReq({ email: 'not-an-email' });
      const res = createMockRes();
      handler(req, res);

      expect(mockValidateEmail).toHaveBeenCalledWith('not-an-email');
      expect(mockSendSuccess).toHaveBeenCalledWith(res, { valid: false, reason: 'Invalid format' });
    });

    it('should handle thrown errors in validation', async () => {
      mockValidateEmail.mockImplementation(() => { throw new Error('Validation crashed'); });

      const routerModule = await import('../../../server/routes/data-quality/validation');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/validate/email');

      const req = createMockReq({ email: 'user@example.com' });
      const res = createMockRes();
      handler(req, res);

      expect(mockErrorResponseWithPayload).toHaveBeenCalledWith(
        res, 'Validation failed', 500, 'INTERNAL_ERROR',
        expect.objectContaining({ message: expect.any(String) })
      );
    });
  });

  describe('POST /duplicates/scan', () => {
    it('should scan for duplicates and return results', async () => {
      const mockResults = [
        { id: 1, matchScore: 0.95, matchType: 'email' }
      ];
      mockCheckForDuplicates.mockResolvedValue(mockResults);

      const routerModule = await import('../../../server/routes/data-quality/duplicates');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/duplicates/scan');

      const req = createMockReq({
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockCheckForDuplicates).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe'
        })
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, {
        duplicates: mockResults,
        count: 1,
        scanDuration: expect.any(Number)
      });
    });

    it('should return empty results when no duplicates found', async () => {
      mockCheckForDuplicates.mockResolvedValue([]);

      const routerModule = await import('../../../server/routes/data-quality/duplicates');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/duplicates/scan');

      const req = createMockReq({ email: 'unique@example.com' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledWith(res, {
        duplicates: [],
        count: 0,
        scanDuration: expect.any(Number)
      });
    });

    it('should handle duplicate detection service errors', async () => {
      mockCheckForDuplicates.mockRejectedValue(new Error('Service unavailable'));

      const routerModule = await import('../../../server/routes/data-quality/duplicates');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/duplicates/scan');

      const req = createMockReq({ email: 'user@example.com' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockErrorResponseWithPayload).toHaveBeenCalledWith(
        res, 'Failed to scan for duplicates', 500, 'INTERNAL_ERROR',
        expect.objectContaining({ message: expect.any(String) })
      );
    });
  });

  describe('POST /duplicates/check', () => {
    it('should check for duplicates with email', async () => {
      mockCheckForDuplicates.mockResolvedValue([]);

      const routerModule = await import('../../../server/routes/data-quality/duplicates');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/duplicates/check');

      const req = createMockReq({ email: 'user@example.com' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledWith(res, expect.objectContaining({
        hasDuplicates: false,
        count: 0
      }));
    });

    it('should require at least email or name', async () => {
      const routerModule = await import('../../../server/routes/data-quality/duplicates');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/duplicates/check');

      const req = createMockReq({ company: 'Acme Inc' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockErrorResponseWithPayload).toHaveBeenCalledWith(
        res, 'Validation error', 400, 'VALIDATION_ERROR',
        { message: 'At least email or name is required' }
      );
    });
  });

  describe('POST /duplicates/merge', () => {
    it('should merge duplicate records successfully', async () => {
      mockMergeDuplicates.mockResolvedValue({ message: 'Records merged successfully' });

      const routerModule = await import('../../../server/routes/data-quality/duplicates');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/duplicates/merge');

      const req = createMockReq({
        keepId: 1,
        keepType: 'client',
        mergeIds: [2, 3],
        fieldSelections: {}
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockMergeDuplicates).toHaveBeenCalledWith(expect.objectContaining({
        keepId: 1,
        keepType: 'client',
        mergeIds: [2, 3]
      }));
      expect(mockSendSuccess).toHaveBeenCalledWith(res, undefined, 'Records merged successfully');
    });

    it('should validate required merge parameters', async () => {
      const routerModule = await import('../../../server/routes/data-quality/duplicates');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/duplicates/merge');

      const req = createMockReq({ keepId: 1 }); // missing keepType and mergeIds
      const res = createMockRes();
      await handler(req, res);

      expect(mockErrorResponseWithPayload).toHaveBeenCalledWith(
        res, 'Validation error', 400, 'VALIDATION_ERROR',
        { message: 'keepId, keepType, and mergeIds array are required' }
      );
    });
  });

  describe('POST /security/check', () => {
    it('should detect safe input', async () => {
      mockDetectXSS.mockReturnValue({ detected: false });
      mockDetectSQLInjection.mockReturnValue({ detected: false });

      const routerModule = await import('../../../server/routes/data-quality/validation');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/security/check');

      const req = createMockReq({ input: 'Hello World' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledWith(res, {
        safe: true,
        xss: { detected: false },
        sqlInjection: { detected: false }
      });
    });

    it('should detect XSS threats and log them', async () => {
      mockDetectXSS.mockReturnValue({ detected: true, pattern: 'script' });
      mockDetectSQLInjection.mockReturnValue({ detected: false });
      mockDbRun.mockResolvedValue({ changes: 1 });

      const routerModule = await import('../../../server/routes/data-quality/validation');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/security/check');

      const req = createMockReq({ input: '<script>alert("xss")</script>' });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledWith(res, {
        safe: false,
        xss: { detected: true, pattern: 'script' },
        sqlInjection: { detected: false }
      });
      // Should log the threat to DB
      expect(mockDbRun).toHaveBeenCalled();
    });

    it('should require input parameter', async () => {
      const routerModule = await import('../../../server/routes/data-quality/validation');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/security/check');

      const req = createMockReq({});
      const res = createMockRes();
      await handler(req, res);

      expect(mockErrorResponseWithPayload).toHaveBeenCalledWith(
        res, 'Validation error', 400, 'VALIDATION_ERROR',
        { message: 'input is required' }
      );
    });
  });

  describe('GET /metrics', () => {
    it('should return data quality metrics', async () => {
      const mockMetrics = {
        totalChecks: 100,
        duplicatesFound: 5,
        averageMatchScore: 0.85
      };
      mockGetDuplicateStats.mockResolvedValue(mockMetrics);

      const routerModule = await import('../../../server/routes/data-quality/metrics');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/metrics');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledWith(res, mockMetrics);
    });

    it('should handle metrics service errors', async () => {
      mockGetDuplicateStats.mockRejectedValue(new Error('Stats unavailable'));

      const routerModule = await import('../../../server/routes/data-quality/metrics');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'get', '/metrics');

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(mockErrorResponseWithPayload).toHaveBeenCalledWith(
        res, 'Failed to fetch metrics', 500, 'INTERNAL_ERROR',
        expect.objectContaining({ message: expect.any(String) })
      );
    });
  });

  describe('POST /sanitize', () => {
    it('should sanitize input text', async () => {
      mockSanitizeInput.mockReturnValue({ sanitized: 'clean text', changes: 1 });

      const routerModule = await import('../../../server/routes/data-quality/validation');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/sanitize');

      const req = createMockReq({ input: 'dirty <b>text</b>' });
      const res = createMockRes();
      handler(req, res);

      expect(mockSanitizeInput).toHaveBeenCalledWith('dirty <b>text</b>', {});
      expect(mockSendSuccess).toHaveBeenCalledWith(res, { sanitized: 'clean text', changes: 1 });
    });

    it('should require input parameter', async () => {
      const routerModule = await import('../../../server/routes/data-quality/validation');
      const router = routerModule.default;
      const handler = getRouteHandler(router, 'post', '/sanitize');

      const req = createMockReq({});
      const res = createMockRes();
      handler(req, res);

      expect(mockErrorResponseWithPayload).toHaveBeenCalledWith(
        res, 'Validation error', 400, 'VALIDATION_ERROR',
        { message: 'input is required' }
      );
    });
  });
});
