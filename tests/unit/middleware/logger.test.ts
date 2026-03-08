/**
 * ===============================================
 * REQUEST LOGGER MIDDLEWARE TESTS
 * ===============================================
 * @file tests/unit/middleware/logger.test.ts
 *
 * Unit tests for request logging middleware.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requestLogger } from '../../../server/middleware/logger';
import { logger as loggerService } from '../../../server/services/logger';

// Mock logger service
vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('Request Logger Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response> & { on: ReturnType<typeof vi.fn> };
  let mockNext: NextFunction;
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    originalDateNow = Date.now;
    const startTime = 1000000;
    vi.spyOn(Date, 'now').mockReturnValue(startTime);

    mockReq = {
      method: 'GET',
      path: '/api/test',
      body: {},
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-agent')
    };

    mockRes = {
      statusCode: 200,
      json: vi.fn().mockReturnThis(),
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          callback();
        }
      })
    };

    mockNext = vi.fn() as unknown as NextFunction;
    vi.clearAllMocks();
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('requestLogger', () => {
    it('should skip logging for health check paths', () => {
      mockReq.path = '/api/health';
      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(loggerService.info).not.toHaveBeenCalled();
    });

    it('should skip logging for /health path', () => {
      mockReq.path = '/health';
      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(loggerService.info).not.toHaveBeenCalled();
    });

    it('should skip logging for favicon.ico', () => {
      mockReq.path = '/favicon.ico';
      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(loggerService.info).not.toHaveBeenCalled();
    });

    it('should log request information', () => {
      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test'),
        expect.objectContaining({
          category: 'HTTP',
          metadata: expect.objectContaining({
            ip: '127.0.0.1'
          })
        })
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should log request body when present', () => {
      mockReq.body = { name: 'Test', email: 'test@example.com' };
      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test'),
        expect.objectContaining({
          metadata: expect.objectContaining({
            body: { name: 'Test', email: 'test@example.com' }
          })
        })
      );
    });

    it('should sanitize sensitive fields in request body', () => {
      mockReq.body = {
        name: 'Test',
        password: 'secret123',
        token: 'abc123',
        secret: 'my-secret',
        key: 'api-key'
      };
      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test'),
        expect.objectContaining({
          metadata: expect.objectContaining({
            body: {
              name: 'Test',
              password: '[REDACTED]',
              token: '[REDACTED]',
              secret: '[REDACTED]',
              key: '[REDACTED]'
            }
          })
        })
      );
    });

    it('should log response with info for successful requests', () => {
      const startTime = 1000000;
      const endTime = 1000100;
      Date.now = vi.fn().mockReturnValueOnce(startTime).mockReturnValueOnce(endTime);

      mockRes.on = vi.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          callback();
        }
      });

      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test'),
        expect.objectContaining({
          category: 'HTTP',
          metadata: expect.objectContaining({
            statusCode: 200
          })
        })
      );
    });

    it('should log response with warn for error responses', () => {
      mockRes.statusCode = 404;
      const startTime = 1000000;
      const endTime = 1000100;
      Date.now = vi.fn().mockReturnValueOnce(startTime).mockReturnValueOnce(endTime);

      mockRes.on = vi.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          callback();
        }
      });

      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test'),
        expect.objectContaining({
          category: 'HTTP',
          metadata: expect.objectContaining({
            statusCode: 404
          })
        })
      );
    });

    it('should log response with warn for 5xx errors', () => {
      mockRes.statusCode = 500;
      const startTime = 1000000;
      const endTime = 1000100;
      Date.now = vi.fn().mockReturnValueOnce(startTime).mockReturnValueOnce(endTime);

      mockRes.on = vi.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          callback();
        }
      });

      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test'),
        expect.objectContaining({
          category: 'HTTP'
        })
      );
    });

    it('should handle requests without body', () => {
      mockReq.body = undefined;
      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test'),
        expect.objectContaining({
          metadata: expect.not.objectContaining({
            body: expect.anything()
          })
        })
      );
    });

    it('should handle empty body object', () => {
      mockReq.body = {};
      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test'),
        expect.objectContaining({
          metadata: expect.not.objectContaining({
            body: expect.anything()
          })
        })
      );
    });

    it('should calculate duration and include it in response log', () => {
      const startTime = 1000000;
      Date.now = vi.fn().mockReturnValueOnce(startTime).mockReturnValueOnce(startTime + 250);

      mockRes.on = vi.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          callback();
        }
      });

      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        expect.stringContaining('250ms'),
        expect.objectContaining({
          metadata: expect.objectContaining({
            responseTimeMs: 250
          })
        })
      );
    });

    it('should handle POST requests', () => {
      mockReq.method = 'POST';
      mockReq.body = { name: 'New Item' };
      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        expect.stringContaining('POST /api/test'),
        expect.any(Object)
      );
    });

    it('should handle PUT requests', () => {
      mockReq.method = 'PUT';
      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        expect.stringContaining('PUT /api/test'),
        expect.any(Object)
      );
    });

    it('should handle DELETE requests', () => {
      mockReq.method = 'DELETE';
      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        expect.stringContaining('DELETE /api/test'),
        expect.any(Object)
      );
    });

    it('should call next()', () => {
      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should attach finish listener to the response', () => {
      requestLogger(mockReq as Request, mockRes as unknown as Response, mockNext);
      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });
  });
});
