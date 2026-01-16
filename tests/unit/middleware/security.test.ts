/**
 * ===============================================
 * SECURITY MIDDLEWARE TESTS
 * ===============================================
 * @file tests/unit/middleware/security.test.ts
 *
 * Unit tests for security middleware.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  rateLimit,
  csrfProtection,
  ipFilter,
  requestSizeLimit,
  suspiciousActivityDetector,
  requestFingerprint,
  cleanupSecurityMiddleware,
} from '../../../server/middleware/security';
import { logger } from '../../../server/services/logger';

// Mock logger service
vi.mock('../../../server/services/logger', () => ({
  logger: {
    logSecurity: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Security Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      ip: '127.0.0.1',
      url: '/api/test',
      body: {},
      headers: {},
      query: {},
      params: {},
      get: vi.fn(),
      cookies: {},
      connection: {
        remoteAddress: '127.0.0.1',
      } as any,
    };

    mockRes = {
      statusCode: 200,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn() as unknown as NextFunction;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupSecurityMiddleware();
  });

  describe('rateLimit', () => {
    it('should allow requests within limit', async () => {
      const middleware = rateLimit({ windowMs: 1000, maxRequests: 5 });
      
      for (let i = 0; i < 5; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockRes.status).not.toHaveBeenCalledWith(429);
    });

    it('should block requests exceeding limit', async () => {
      const middleware = rateLimit({ windowMs: 1000, maxRequests: 2 });
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
        })
      );
    });

    it('should set rate limit headers', async () => {
      const middleware = rateLimit({ maxRequests: 10 });
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // The middleware uses res.set with an object, not individual calls
      expect(mockRes.set).toHaveBeenCalled();
      const setCalls = (mockRes.set as any).mock.calls;
      const headerCall = setCalls.find((call: any[]) => 
        typeof call[0] === 'object' && call[0]['X-RateLimit-Limit']
      );
      expect(headerCall).toBeDefined();
      expect(headerCall[0]['X-RateLimit-Limit']).toBe('10');
    });

    it('should use custom key generator', async () => {
      const keyGenerator = vi.fn().mockReturnValue('custom-key');
      const middleware = rateLimit({ keyGenerator, maxRequests: 1 });
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(keyGenerator).toHaveBeenCalled();
    });

    it('should skip rate limiting when skipIf returns true', async () => {
      const middleware = rateLimit({
        skipIf: (req) => req.path === '/api/test',
        maxRequests: 1,
      });
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it('should block IP after exceeding limit', async () => {
      const middleware = rateLimit({ maxRequests: 1, blockDuration: 1000 });
      
      // Exceed limit
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Try again - should be blocked
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'RATE_LIMIT_BLOCKED',
        })
      );
    });

    it('should call onLimitReached callback', async () => {
      const onLimitReached = vi.fn();
      const middleware = rateLimit({ maxRequests: 1, onLimitReached });
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(onLimitReached).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const middleware = rateLimit({ keyGenerator: () => { throw new Error('Key error'); } });
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('csrfProtection', () => {
    it('should allow safe methods without CSRF token', async () => {
      const middleware = csrfProtection();
      
      mockReq.method = 'GET';
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow HEAD requests without CSRF token', async () => {
      const middleware = csrfProtection();
      
      mockReq.method = 'HEAD';
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow OPTIONS requests without CSRF token', async () => {
      const middleware = csrfProtection();
      
      mockReq.method = 'OPTIONS';
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject POST without CSRF token', async () => {
      const middleware = csrfProtection();
      
      mockReq.method = 'POST';
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid CSRF token',
          code: 'CSRF_TOKEN_INVALID',
        })
      );
    });

    it('should accept valid CSRF token in header', async () => {
      const token = 'valid-token';
      const middleware = csrfProtection();
      
      mockReq.method = 'POST';
      mockReq.get = vi.fn().mockReturnValue(token);
      (mockReq as any).cookies = { 'csrf-token': token };
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should accept valid CSRF token in body', async () => {
      const token = 'valid-token';
      const middleware = csrfProtection();
      
      mockReq.method = 'POST';
      mockReq.body = { _csrf: token };
      (mockReq as any).cookies = { 'csrf-token': token };
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject mismatched CSRF tokens', async () => {
      const middleware = csrfProtection();
      
      mockReq.method = 'POST';
      mockReq.get = vi.fn().mockReturnValue('header-token');
      (mockReq as any).cookies = { 'csrf-token': 'cookie-token' };
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should skip CSRF check when skipIf returns true', async () => {
      const middleware = csrfProtection({
        skipIf: (req) => req.path === '/api/test',
      });
      
      mockReq.method = 'POST';
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const middleware = csrfProtection();
      mockReq.method = 'POST';
      mockReq.get = vi.fn().mockImplementation(() => { throw new Error('Error'); });
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('ipFilter', () => {
    it('should allow requests when no filter is set', async () => {
      const middleware = ipFilter();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should block blacklisted IPs', async () => {
      const middleware = ipFilter({ blacklist: ['127.0.0.1'] });
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'IP_BLACKLISTED',
        })
      );
    });

    it('should allow whitelisted IPs', async () => {
      const middleware = ipFilter({ whitelist: ['127.0.0.1'] });
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should block non-whitelisted IPs when whitelist is set', async () => {
      const middleware = ipFilter({ whitelist: ['192.168.1.1'] });
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'IP_NOT_WHITELISTED',
        })
      );
    });

    it('should handle missing IP address', async () => {
      mockReq.ip = undefined;
      (mockReq as any).connection = { remoteAddress: undefined };
      
      const middleware = ipFilter();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'IP_UNKNOWN',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const middleware = ipFilter();
      mockReq.ip = undefined;
      (mockReq as any).connection = null;
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requestSizeLimit', () => {
    it('should allow requests within size limits', async () => {
      const middleware = requestSizeLimit();
      mockReq.url = '/api/test';
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject URLs that are too long', async () => {
      const middleware = requestSizeLimit({ maxUrlLength: 10 });
      mockReq.url = '/api/very/long/url/path';
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(414);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'URL_TOO_LONG',
        })
      );
    });

    it('should reject requests with headers that are too large', async () => {
      const middleware = requestSizeLimit({ maxHeaderSize: 100 });
      mockReq.headers = {
        'x-large-header': 'a'.repeat(200),
      };
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(431);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'HEADERS_TOO_LARGE',
        })
      );
    });

    it('should reject requests with body that is too large', async () => {
      const middleware = requestSizeLimit({ maxBodySize: 1000 });
      mockReq.get = vi.fn().mockReturnValue('2000');
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'BODY_TOO_LARGE',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const middleware = requestSizeLimit();
      mockReq.url = undefined as any;
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('suspiciousActivityDetector', () => {
    it('should allow normal requests', async () => {
      const middleware = suspiciousActivityDetector();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect path traversal attempts', async () => {
      const middleware = suspiciousActivityDetector({ maxPathTraversal: 2 });
      mockReq.url = '/api/../../../etc/passwd';
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SUSPICIOUS_ACTIVITY_DETECTED',
        })
      );
    });

    it('should detect SQL injection attempts', async () => {
      const middleware = suspiciousActivityDetector({ maxSqlInjectionAttempts: 2 });
      mockReq.url = "/api/test?id=1' OR '1'='1";
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should detect XSS attempts', async () => {
      const middleware = suspiciousActivityDetector({ maxXssAttempts: 2 });
      mockReq.url = '/api/test?x=<script>alert(1)</script>';
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should block IP after multiple suspicious activities', async () => {
      const middleware = suspiciousActivityDetector({ maxPathTraversal: 2 });
      mockReq.url = '/api/../../../etc/passwd';
      
      // First attempt - should pass but be logged (count = 1)
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      
      // Clear mocks for second call
      vi.clearAllMocks();
      mockNext = vi.fn() as unknown as NextFunction;
      mockRes.status = vi.fn().mockReturnThis();
      mockRes.json = vi.fn().mockReturnThis();
      
      // Second attempt - should be blocked (count = 2, equals maxPathTraversal)
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SUSPICIOUS_ACTIVITY_DETECTED',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const middleware = suspiciousActivityDetector();
      mockReq.url = undefined as any;
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requestFingerprint', () => {
    it('should create request fingerprint', () => {
      mockReq.get = vi.fn().mockImplementation((header: string) => {
        if (header === 'User-Agent') return 'test-agent';
        if (header === 'Accept-Language') return 'en-US';
        if (header === 'Accept-Encoding') return 'gzip';
        if (header === 'Connection') return 'keep-alive';
        return undefined;
      });

      requestFingerprint(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).fingerprint).toBeDefined();
      expect((mockReq as any).fingerprint.ip).toBe('127.0.0.1');
      expect((mockReq as any).fingerprint.userAgent).toBe('test-agent');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      mockReq.get = vi.fn().mockImplementation(() => { throw new Error('Error'); });
      
      requestFingerprint(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
