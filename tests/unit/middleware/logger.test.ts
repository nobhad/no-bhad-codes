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
    error: vi.fn(),
  },
}));

describe('Request Logger Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
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
      get: vi.fn().mockReturnValue('test-agent'),
    };

    mockRes = {
      statusCode: 200,
      json: vi.fn().mockReturnThis(),
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
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(loggerService.info).not.toHaveBeenCalled();
    });

    it('should skip logging for /health path', () => {
      mockReq.path = '/health';
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(loggerService.info).not.toHaveBeenCalled();
    });

    it('should skip logging for favicon.ico', () => {
      mockReq.path = '/favicon.ico';
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(loggerService.info).not.toHaveBeenCalled();
    });

    it('should log request information', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith('GET /api/test', {
        category: 'request',
        metadata: {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
        },
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should log request body when present', () => {
      mockReq.body = { name: 'Test', email: 'test@example.com' };
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        'GET /api/test',
        expect.objectContaining({
          metadata: expect.objectContaining({
            body: { name: 'Test', email: 'test@example.com' },
          }),
        })
      );
    });

    it('should sanitize sensitive fields in request body', () => {
      mockReq.body = {
        name: 'Test',
        password: 'secret123',
        token: 'abc123',
        secret: 'my-secret',
        key: 'api-key',
      };
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        'GET /api/test',
        expect.objectContaining({
          metadata: expect.objectContaining({
            body: {
              name: 'Test',
              password: '[REDACTED]',
              token: '[REDACTED]',
              secret: '[REDACTED]',
              key: '[REDACTED]',
            },
          }),
        })
      );
    });

    it('should log response with info for successful requests', () => {
      const startTime = 1000000;
      const endTime = 1000100; // 100ms later
      Date.now = vi.fn().mockReturnValueOnce(startTime).mockReturnValueOnce(endTime);
      
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      // Call res.json to trigger response logging
      (mockRes.json as any)({ data: 'test' });

      expect(loggerService.info).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test - 200'),
        expect.objectContaining({
          category: 'response',
          metadata: expect.objectContaining({
            statusCode: 200,
            duration: 100,
          }),
        })
      );
    });

    it('should log response with warn for error responses', () => {
      mockRes.statusCode = 404;
      const startTime = 1000000;
      const endTime = 1000100; // 100ms later
      Date.now = vi.fn().mockReturnValueOnce(startTime).mockReturnValueOnce(endTime);
      
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      // Call res.json to trigger response logging
      (mockRes.json as any)({ error: 'Not found' });

      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test - 404'),
        expect.objectContaining({
          category: 'response',
          metadata: expect.objectContaining({
            statusCode: 404,
            duration: 100,
          }),
        })
      );
    });

    it('should log response with warn for 5xx errors', () => {
      mockRes.statusCode = 500;
      const startTime = 1000000;
      const endTime = 1000100; // 100ms later
      Date.now = vi.fn().mockReturnValueOnce(startTime).mockReturnValueOnce(endTime);
      
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      // Call res.json to trigger response logging
      (mockRes.json as any)({ error: 'Server error' });

      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test - 500'),
        expect.objectContaining({
          category: 'response',
        })
      );
    });

    it('should preserve original json method functionality', () => {
      const originalJson = mockRes.json;
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      const responseBody = { data: 'test' };
      const result = (mockRes.json as any)(responseBody);

      expect(result).toBe(mockRes);
    });

    it('should handle requests without body', () => {
      mockReq.body = undefined;
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        'GET /api/test',
        expect.objectContaining({
          metadata: expect.not.objectContaining({
            body: expect.anything(),
          }),
        })
      );
    });

    it('should handle empty body object', () => {
      mockReq.body = {};
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        'GET /api/test',
        expect.objectContaining({
          metadata: expect.not.objectContaining({
            body: expect.anything(),
          }),
        })
      );
    });

    it('should calculate duration correctly', () => {
      const startTime = 1000000;
      Date.now = vi.fn().mockReturnValueOnce(startTime).mockReturnValueOnce(startTime + 250);
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      (mockRes.json as any)({ data: 'test' });

      expect(loggerService.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          metadata: expect.objectContaining({
            duration: 250,
          }),
        })
      );
    });

    it('should handle POST requests', () => {
      mockReq.method = 'POST';
      mockReq.body = { name: 'New Item' };
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        'POST /api/test',
        expect.any(Object)
      );
    });

    it('should handle PUT requests', () => {
      mockReq.method = 'PUT';
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        'PUT /api/test',
        expect.any(Object)
      );
    });

    it('should handle DELETE requests', () => {
      mockReq.method = 'DELETE';
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(loggerService.info).toHaveBeenCalledWith(
        'DELETE /api/test',
        expect.any(Object)
      );
    });
  });
});
