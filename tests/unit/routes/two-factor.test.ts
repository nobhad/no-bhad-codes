/**
 * ===============================================
 * TWO-FACTOR AUTHENTICATION ROUTES TESTS
 * ===============================================
 * @file tests/unit/routes/two-factor.test.ts
 *
 * Unit tests for 2FA route handlers: setup, verify,
 * login, disable, and status endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCKS
// ============================================

const JWT_SECRET = 'test-secret';
const ADMIN_EMAIL = 'admin@test.com';

// Mock JWT
const mockJwtVerify = vi.fn();
const mockJwtSign = vi.fn().mockReturnValue('signed-jwt-token');
vi.mock('jsonwebtoken', () => {
  const TokenExpiredError = class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TokenExpiredError';
    }
  };
  return {
    default: {
      verify: (...args: unknown[]) => mockJwtVerify(...args),
      sign: (...args: unknown[]) => mockJwtSign(...args),
      TokenExpiredError
    },
    TokenExpiredError
  };
});

// Mock bcryptjs
const mockBcryptHash = vi.fn().mockResolvedValue('hashed-code');
const mockBcryptCompare = vi.fn().mockResolvedValue(false);
vi.mock('bcryptjs', () => ({
  default: {
    hash: (...args: unknown[]) => mockBcryptHash(...args),
    compare: (...args: unknown[]) => mockBcryptCompare(...args)
  }
}));

// Mock database
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
vi.mock('../../../server/database/init', () => ({
  getDatabase: () => ({
    get: (...args: unknown[]) => mockDbGet(...args),
    run: (...args: unknown[]) => mockDbRun(...args)
  })
}));

// Mock authenticateToken middleware — pass through, setting req.user from the request
vi.mock('../../../server/middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    // req.user is set by the test via createMockReq
    next();
  }
}));

// Mock asyncHandler — just unwraps the async function
vi.mock('../../../server/middleware/errorHandler', () => ({
  asyncHandler: (fn: any) => fn
}));

// Mock rate limiter — pass through
vi.mock('../../../server/middleware/security', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next()
}));

// Mock TOTP utilities
const mockGenerateTOTPSecret = vi.fn().mockReturnValue('MOCK_TOTP_SECRET');
const mockVerifyTOTP = vi.fn().mockReturnValue(true);
const mockBuildProvisioningURI = vi.fn().mockReturnValue('otpauth://totp/test');
const mockGenerateBackupCodes = vi.fn().mockReturnValue(['aaaa-bbbb-cccc', 'dddd-eeee-ffff']);
vi.mock('../../../server/utils/totp', () => ({
  generateTOTPSecret: (...args: unknown[]) => mockGenerateTOTPSecret(...args),
  verifyTOTP: (...args: unknown[]) => mockVerifyTOTP(...args),
  buildProvisioningURI: (...args: unknown[]) => mockBuildProvisioningURI(...args),
  generateBackupCodes: (...args: unknown[]) => mockGenerateBackupCodes(...args)
}));

// Mock api-response helpers
const mockSendSuccess = vi.fn((_res, _data, _msg) => undefined);
const mockSendBadRequest = vi.fn((_res, _msg, _code) => undefined);
const mockSendUnauthorized = vi.fn((_res, _msg, _code) => undefined);
const mockSendServerError = vi.fn((_res, _msg, _code) => undefined);

vi.mock('../../../server/utils/api-response', () => ({
  sendSuccess: (...args: unknown[]) => mockSendSuccess(...args),
  sendBadRequest: (...args: unknown[]) => mockSendBadRequest(...args),
  sendUnauthorized: (...args: unknown[]) => mockSendUnauthorized(...args),
  sendServerError: (...args: unknown[]) => mockSendServerError(...args),
  ErrorCodes: {
    ACCESS_DENIED: 'ACCESS_DENIED',
    MISSING_FIELDS: 'MISSING_FIELDS',
    INVALID_TOKEN: 'INVALID_TOKEN',
    CONFIG_ERROR: 'CONFIG_ERROR',
    TWO_FACTOR_ALREADY_ENABLED: 'TWO_FACTOR_ALREADY_ENABLED',
    TWO_FACTOR_NOT_ENABLED: 'TWO_FACTOR_NOT_ENABLED',
    TWO_FACTOR_SETUP_REQUIRED: 'TWO_FACTOR_SETUP_REQUIRED',
    TWO_FACTOR_INVALID_CODE: 'TWO_FACTOR_INVALID_CODE',
    TWO_FACTOR_TEMP_TOKEN_EXPIRED: 'TWO_FACTOR_TEMP_TOKEN_EXPIRED'
  }
}));

// Mock audit logger
vi.mock('../../../server/services/audit-logger', () => ({
  auditLogger: {
    log: vi.fn().mockResolvedValue(undefined),
    logLogin: vi.fn().mockResolvedValue(undefined),
    logLoginFailed: vi.fn().mockResolvedValue(undefined)
  }
}));

// Mock logger
vi.mock('../../../server/services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Mock auth-constants
vi.mock('../../../server/utils/auth-constants', () => ({
  COOKIE_CONFIG: {
    AUTH_TOKEN_NAME: 'auth_token',
    ADMIN_OPTIONS: { httpOnly: true, secure: true }
  },
  JWT_CONFIG: { ADMIN_TOKEN_EXPIRY: '8h' },
  PASSWORD_CONFIG: { SALT_ROUNDS: 10 }
}));

// Mock two-factor-constants (use real values structure)
vi.mock('../../../server/utils/two-factor-constants', () => ({
  TOTP_CONFIG: {
    SECRET_LENGTH_BYTES: 20,
    CODE_DIGITS: 6,
    TIME_STEP_SECONDS: 30,
    ALGORITHM: 'SHA1',
    WINDOW: 1,
    ISSUER: 'NoBhadCodes Admin'
  },
  BACKUP_CODE_CONFIG: { COUNT: 8, CODE_LENGTH_BYTES: 6, SEPARATOR: '-', GROUP_SIZE: 4 },
  TEMP_TOKEN_CONFIG: {
    EXPIRY_SECONDS: 300,
    SUBJECT: '2fa-pending',
    EXPIRY_STRING: '5m'
  },
  TWO_FACTOR_SETTINGS_KEYS: {
    SECRET: 'admin.two_factor_secret',
    ENABLED: 'admin.two_factor_enabled',
    BACKUP_CODES: 'admin.two_factor_backup_codes'
  },
  TWO_FACTOR_RATE_LIMIT: { MAX_ATTEMPTS: 5, WINDOW_MS: 900000 }
}));

// ============================================
// HELPERS
// ============================================

function createMockReq(
  overrides: Record<string, unknown> = {}
) {
  return {
    body: {},
    cookies: {},
    ip: '127.0.0.1',
    get: vi.fn().mockReturnValue('test-agent'),
    ...overrides
  } as any;
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

/**
 * Helper to extract a route handler from an Express router
 * by matching method + path. Returns the last handler (after middleware).
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

/**
 * Configure mockDbGet to return specific values for specific settings keys.
 * Simulates the system_settings table lookups.
 */
function setupDbSettings(settings: Record<string, string | null>) {
  mockDbGet.mockImplementation((_sql: string, params: string[]) => {
    const key = params[0];
    const value = settings[key];
    if (value === undefined || value === null) return Promise.resolve(undefined);
    return Promise.resolve({ setting_value: value });
  });
}

// ============================================
// TESTS
// ============================================

describe('Two-Factor Authentication Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.ADMIN_EMAIL = ADMIN_EMAIL;
  });

  // ------------------------------------------
  // POST /setup
  // ------------------------------------------
  describe('POST /setup', () => {
    it('should generate TOTP secret for admin user', async () => {
      setupDbSettings({
        'admin.two_factor_enabled': null
      });

      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/setup');

      const req = createMockReq({ user: { id: 0, email: ADMIN_EMAIL, type: 'admin' } });
      const res = createMockRes();
      await handler(req, res);

      expect(mockGenerateTOTPSecret).toHaveBeenCalled();
      expect(mockBuildProvisioningURI).toHaveBeenCalledWith(ADMIN_EMAIL, 'MOCK_TOTP_SECRET');
      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        expect.objectContaining({
          secret: 'MOCK_TOTP_SECRET',
          provisioningURI: 'otpauth://totp/test'
        }),
        expect.any(String)
      );
    });

    it('should reject non-admin users', async () => {
      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/setup');

      const req = createMockReq({ user: { id: 42, email: 'client@test.com', type: 'client' } });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendUnauthorized).toHaveBeenCalledWith(res, 'Admin access required', 'ACCESS_DENIED');
      expect(mockGenerateTOTPSecret).not.toHaveBeenCalled();
    });

    it('should reject setup when 2FA is already enabled', async () => {
      setupDbSettings({
        'admin.two_factor_enabled': 'true'
      });

      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/setup');

      const req = createMockReq({ user: { id: 0, email: ADMIN_EMAIL, type: 'admin' } });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendBadRequest).toHaveBeenCalledWith(
        res,
        expect.stringContaining('already enabled'),
        'TWO_FACTOR_ALREADY_ENABLED'
      );
    });
  });

  // ------------------------------------------
  // POST /verify
  // ------------------------------------------
  describe('POST /verify', () => {
    it('should enable 2FA with valid code and return backup codes', async () => {
      setupDbSettings({
        'admin.two_factor_enabled': null,
        'admin.two_factor_secret': 'STORED_SECRET'
      });
      mockVerifyTOTP.mockReturnValue(true);

      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/verify');

      const req = createMockReq({
        user: { id: 0, email: ADMIN_EMAIL, type: 'admin' },
        body: { code: '123456' }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockVerifyTOTP).toHaveBeenCalledWith('STORED_SECRET', '123456');
      expect(mockGenerateBackupCodes).toHaveBeenCalled();
      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        expect.objectContaining({
          backupCodes: expect.any(Array)
        }),
        expect.stringContaining('backup codes')
      );
      // Should have upserted the enabled flag and backup codes
      expect(mockDbRun).toHaveBeenCalled();
    });

    it('should reject invalid TOTP code during verification', async () => {
      setupDbSettings({
        'admin.two_factor_enabled': null,
        'admin.two_factor_secret': 'STORED_SECRET'
      });
      mockVerifyTOTP.mockReturnValue(false);

      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/verify');

      const req = createMockReq({
        user: { id: 0, email: ADMIN_EMAIL, type: 'admin' },
        body: { code: '000000' }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendBadRequest).toHaveBeenCalledWith(
        res,
        expect.stringContaining('Invalid verification code'),
        'TWO_FACTOR_INVALID_CODE'
      );
      expect(mockGenerateBackupCodes).not.toHaveBeenCalled();
    });

    it('should reject when no code is provided', async () => {
      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/verify');

      const req = createMockReq({
        user: { id: 0, email: ADMIN_EMAIL, type: 'admin' },
        body: {}
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendBadRequest).toHaveBeenCalledWith(
        res,
        'TOTP code is required',
        'MISSING_FIELDS'
      );
    });
  });

  // ------------------------------------------
  // POST /login
  // ------------------------------------------
  describe('POST /login', () => {
    it('should complete 2FA login with valid TOTP code', async () => {
      mockJwtVerify.mockReturnValue({ email: ADMIN_EMAIL, sub: '2fa-pending' });
      setupDbSettings({
        'admin.two_factor_secret': 'STORED_SECRET'
      });
      mockVerifyTOTP.mockReturnValue(true);

      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/login');

      const req = createMockReq({
        body: { tempToken: 'valid-temp-token', code: '123456' }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockJwtVerify).toHaveBeenCalledWith('valid-temp-token', JWT_SECRET);
      expect(mockVerifyTOTP).toHaveBeenCalledWith('STORED_SECRET', '123456');
      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({ id: 0, email: ADMIN_EMAIL, type: 'admin' }),
        JWT_SECRET,
        expect.any(Object)
      );
      expect(res.cookie).toHaveBeenCalledWith('auth_token', 'signed-jwt-token', expect.any(Object));
      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        expect.objectContaining({
          user: expect.objectContaining({ email: ADMIN_EMAIL, isAdmin: true }),
          usedBackupCode: false
        }),
        'Admin login successful'
      );
    });

    it('should reject when temp token is invalid', async () => {
      mockJwtVerify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/login');

      const req = createMockReq({
        body: { tempToken: 'bad-token', code: '123456' }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendUnauthorized).toHaveBeenCalledWith(
        res,
        expect.stringContaining('Invalid verification session'),
        'INVALID_TOKEN'
      );
    });

    it('should reject when temp token is expired', async () => {
      // Import the mocked jwt to get TokenExpiredError
      const jwt = (await import('jsonwebtoken')).default as any;
      mockJwtVerify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('jwt expired');
      });

      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/login');

      const req = createMockReq({
        body: { tempToken: 'expired-token', code: '123456' }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendUnauthorized).toHaveBeenCalledWith(
        res,
        expect.stringContaining('expired'),
        'TWO_FACTOR_TEMP_TOKEN_EXPIRED'
      );
    });

    it('should reject when temp token has wrong subject', async () => {
      mockJwtVerify.mockReturnValue({ email: ADMIN_EMAIL, sub: 'wrong-subject' });

      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/login');

      const req = createMockReq({
        body: { tempToken: 'valid-token', code: '123456' }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendUnauthorized).toHaveBeenCalledWith(
        res,
        'Invalid verification session.',
        'INVALID_TOKEN'
      );
    });

    it('should accept valid backup code during login', async () => {
      mockJwtVerify.mockReturnValue({ email: ADMIN_EMAIL, sub: '2fa-pending' });
      setupDbSettings({
        'admin.two_factor_secret': 'STORED_SECRET',
        'admin.two_factor_backup_codes': JSON.stringify(['$2a$10$hashedcode1', '$2a$10$hashedcode2'])
      });
      // TOTP fails but backup code matches
      mockVerifyTOTP.mockReturnValue(false);
      mockBcryptCompare.mockResolvedValueOnce(true);

      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/login');

      const req = createMockReq({
        body: { tempToken: 'valid-temp-token', code: 'aaaa-bbbb-cccc' }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockBcryptCompare).toHaveBeenCalled();
      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        expect.objectContaining({ usedBackupCode: true }),
        'Admin login successful'
      );
      // Should have removed the used backup code from storage
      expect(mockDbRun).toHaveBeenCalled();
    });

    it('should reject when neither TOTP nor backup code is valid', async () => {
      mockJwtVerify.mockReturnValue({ email: ADMIN_EMAIL, sub: '2fa-pending' });
      setupDbSettings({
        'admin.two_factor_secret': 'STORED_SECRET',
        'admin.two_factor_backup_codes': JSON.stringify(['$2a$10$hashedcode1'])
      });
      mockVerifyTOTP.mockReturnValue(false);
      mockBcryptCompare.mockResolvedValue(false);

      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/login');

      const req = createMockReq({
        body: { tempToken: 'valid-temp-token', code: 'wrong-code' }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendUnauthorized).toHaveBeenCalledWith(
        res,
        'Invalid verification code.',
        'TWO_FACTOR_INVALID_CODE'
      );
    });

    it('should reject when tempToken or code is missing', async () => {
      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/login');

      const req = createMockReq({ body: { tempToken: 'token-only' } });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendBadRequest).toHaveBeenCalledWith(
        res,
        expect.stringContaining('required'),
        'MISSING_FIELDS'
      );
    });
  });

  // ------------------------------------------
  // POST /disable
  // ------------------------------------------
  describe('POST /disable', () => {
    it('should disable 2FA with valid TOTP code', async () => {
      setupDbSettings({
        'admin.two_factor_enabled': 'true',
        'admin.two_factor_secret': 'STORED_SECRET'
      });
      mockVerifyTOTP.mockReturnValue(true);

      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/disable');

      const req = createMockReq({
        user: { id: 0, email: ADMIN_EMAIL, type: 'admin' },
        body: { code: '654321' }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockVerifyTOTP).toHaveBeenCalledWith('STORED_SECRET', '654321');
      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        undefined,
        expect.stringContaining('disabled')
      );
      // Should have cleared enabled flag, secret, and backup codes (3 upsert calls)
      const upsertCalls = mockDbRun.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('INSERT OR REPLACE')
      );
      expect(upsertCalls.length).toBeGreaterThanOrEqual(3);
    });

    it('should reject disable without providing code', async () => {
      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/disable');

      const req = createMockReq({
        user: { id: 0, email: ADMIN_EMAIL, type: 'admin' },
        body: {}
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendBadRequest).toHaveBeenCalledWith(
        res,
        expect.stringContaining('required'),
        'MISSING_FIELDS'
      );
    });

    it('should reject disable with invalid TOTP code', async () => {
      setupDbSettings({
        'admin.two_factor_enabled': 'true',
        'admin.two_factor_secret': 'STORED_SECRET'
      });
      mockVerifyTOTP.mockReturnValue(false);

      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/disable');

      const req = createMockReq({
        user: { id: 0, email: ADMIN_EMAIL, type: 'admin' },
        body: { code: '000000' }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendBadRequest).toHaveBeenCalledWith(
        res,
        expect.stringContaining('Invalid verification code'),
        'TWO_FACTOR_INVALID_CODE'
      );
    });

    it('should reject disable when 2FA is not currently enabled', async () => {
      setupDbSettings({
        'admin.two_factor_enabled': 'false'
      });

      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'post', '/disable');

      const req = createMockReq({
        user: { id: 0, email: ADMIN_EMAIL, type: 'admin' },
        body: { code: '123456' }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendBadRequest).toHaveBeenCalledWith(
        res,
        expect.stringContaining('not currently enabled'),
        'TWO_FACTOR_NOT_ENABLED'
      );
    });
  });

  // ------------------------------------------
  // GET /status
  // ------------------------------------------
  describe('GET /status', () => {
    it('should return enabled status with backup code count', async () => {
      setupDbSettings({
        'admin.two_factor_enabled': 'true',
        'admin.two_factor_backup_codes': JSON.stringify(['hash1', 'hash2', 'hash3'])
      });

      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'get', '/status');

      const req = createMockReq({
        user: { id: 0, email: ADMIN_EMAIL, type: 'admin' }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        { enabled: true, remainingBackupCodes: 3 }
      );
    });

    it('should reject non-admin from checking status', async () => {
      const { twoFactorRouter } = await import('../../../server/routes/two-factor');
      const handler = getRouteHandler(twoFactorRouter, 'get', '/status');

      const req = createMockReq({
        user: { id: 5, email: 'client@test.com', type: 'client' }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(mockSendUnauthorized).toHaveBeenCalledWith(res, 'Admin access required', 'ACCESS_DENIED');
    });
  });
});
