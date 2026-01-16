/**
 * ===============================================
 * AUDIT MIDDLEWARE TESTS
 * ===============================================
 * @file tests/unit/middleware/audit.test.ts
 *
 * Unit tests for audit middleware.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { auditMiddleware } from '../../../server/middleware/audit';
import { auditLogger } from '../../../server/services/audit-logger';

// Mock audit logger
vi.mock('../../../server/services/audit-logger', () => ({
  auditLogger: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Audit Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      path: '/api/clients',
      body: { name: 'Test Client', email: 'test@example.com' },
      params: {},
      query: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      get: vi.fn().mockReturnValue('test-agent'),
    };

    mockRes = {
      statusCode: 200,
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn() as unknown as NextFunction;
    vi.clearAllMocks();
  });

  describe('auditMiddleware', () => {
    it('should skip non-write operations', async () => {
      mockReq.method = 'GET';
      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      expect(mockNext).toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    it('should skip health check paths', async () => {
      mockReq.path = '/api/health';
      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      expect(mockNext).toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    it('should audit POST requests with successful response', async () => {
      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      // Call res.json to trigger audit logging
      const responseBody = { id: 1, name: 'Test Client' };
      (mockRes.json as any)(responseBody);

      // Wait for async audit log
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          entityType: 'client',
          entityId: '1',
          requestMethod: 'POST',
          requestPath: '/api/clients',
        })
      );
    });

    it('should audit PUT requests', async () => {
      mockReq.method = 'PUT';
      mockReq.path = '/api/projects/123';
      mockReq.params = { id: '123' };
      mockReq.body = { name: 'Updated Project' };

      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      const responseBody = { id: 123, name: 'Updated Project' };
      (mockRes.json as any)(responseBody);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          entityType: 'project',
          entityId: '123',
          requestMethod: 'PUT',
        })
      );
    });

    it('should audit DELETE requests', async () => {
      mockReq.method = 'DELETE';
      mockReq.path = '/api/invoices/456';
      mockReq.params = { id: '456' };

      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      const responseBody = { success: true };
      (mockRes.json as any)(responseBody);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          entityType: 'invoice',
          entityId: '456',
          newValue: undefined, // DELETE should have undefined newValue
        })
      );
    });

    it('should not audit failed responses (4xx)', async () => {
      mockRes.statusCode = 400;
      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      const responseBody = { error: 'Bad request' };
      (mockRes.json as any)(responseBody);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    it('should not audit failed responses (5xx)', async () => {
      mockRes.statusCode = 500;
      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      const responseBody = { error: 'Internal server error' };
      (mockRes.json as any)(responseBody);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    it('should include user information when authenticated', async () => {
      (mockReq as any).user = {
        id: 1,
        email: 'admin@example.com',
        type: 'admin',
      };

      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      const responseBody = { id: 1 };
      (mockRes.json as any)(responseBody);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          userEmail: 'admin@example.com',
          userType: 'admin',
        })
      );
    });

    it('should handle client user type', async () => {
      (mockReq as any).user = {
        id: 2,
        email: 'client@example.com',
        type: 'client',
      };

      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      const responseBody = { id: 1 };
      (mockRes.json as any)(responseBody);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userType: 'client',
        })
      );
    });

    it('should use system user type when not authenticated', async () => {
      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      const responseBody = { id: 1 };
      (mockRes.json as any)(responseBody);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userType: 'system',
        })
      );
    });

    it('should extract entity ID from response body', async () => {
      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      const responseBody = { id: 999, name: 'Test' };
      (mockRes.json as any)(responseBody);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: '999',
        })
      );
    });

    it('should extract entity ID from response data.id', async () => {
      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      const responseBody = { data: { id: 888 } };
      (mockRes.json as any)(responseBody);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: '888',
        })
      );
    });

    it('should extract entity ID from request params', async () => {
      mockReq.params = { projectId: '777' };
      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      const responseBody = { success: true };
      (mockRes.json as any)(responseBody);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: '777',
        })
      );
    });

    it('should detect login action', async () => {
      mockReq.path = '/api/auth/login';
      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      const responseBody = { id: 1 };
      (mockRes.json as any)(responseBody);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'login',
        })
      );
    });

    it('should detect upload action', async () => {
      mockReq.path = '/api/uploads/upload';
      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      const responseBody = { id: 1 };
      (mockRes.json as any)(responseBody);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'upload',
        })
      );
    });

    it('should preserve original json method functionality', async () => {
      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      const responseBody = { id: 1 };
      const result = (mockRes.json as any)(responseBody);

      expect(result).toBe(mockRes);
    });

    it('should handle audit log errors gracefully', async () => {
      vi.mocked(auditLogger.log).mockRejectedValue(new Error('Audit log failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const middleware = auditMiddleware();
      const handler = middleware(mockReq as Request, mockRes as Response, mockNext);

      await handler;

      const responseBody = { id: 1 };
      (mockRes.json as any)(responseBody);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith('[AUDIT] Failed to log:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
