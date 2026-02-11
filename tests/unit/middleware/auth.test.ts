/**
 * ===============================================
 * AUTHENTICATION MIDDLEWARE TESTS
 * ===============================================
 * @file tests/unit/middleware/auth.test.ts
 *
 * Unit tests for authentication middleware.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  authenticateToken,
  requireAdmin,
  requireClient,
  AuthenticatedRequest,
} from '../../../server/middleware/auth';

// Mock JWT
vi.mock('jsonwebtoken');

// Mock environment
vi.mock('../../../server/config/environment', () => ({
  default: {
    JWT_SECRET: 'test-secret-key',
  },
}));

describe('Authentication Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      cookies: {},
      ip: '127.0.0.1',
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn() as unknown as NextFunction;
    process.env.JWT_SECRET = 'test-secret-key';
    vi.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate with Authorization header token', () => {
      const mockDecoded = { id: 1, email: 'test@example.com', type: 'client' };
      vi.mocked(jwt.verify).mockReturnValue(mockDecoded as any);

      mockReq.headers = {
        authorization: 'Bearer valid-token',
      };

      authenticateToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret-key');
      expect(mockReq.user).toEqual({
        id: 1,
        email: 'test@example.com',
        type: 'client',
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should authenticate with cookie token', () => {
      const mockDecoded = { id: 2, email: 'admin@example.com', type: 'admin' };
      vi.mocked(jwt.verify).mockImplementation(() => mockDecoded as any);

      mockReq.cookies = {
        'auth_token': 'cookie-token', // Use correct cookie name from COOKIE_CONFIG
      };

      authenticateToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith('cookie-token', 'test-secret-key');
      expect(mockReq.user).toEqual({
        id: 2,
        email: 'admin@example.com',
        type: 'admin',
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should prefer Authorization header over cookie', () => {
      const mockDecoded = { id: 3, email: 'user@example.com', type: 'client' };
      vi.mocked(jwt.verify).mockReturnValue(mockDecoded as any);

      mockReq.headers = {
        authorization: 'Bearer header-token',
      };
      mockReq.cookies = {
        'auth_token': 'cookie-token', // Use correct cookie name
      };

      authenticateToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith('header-token', 'test-secret-key');
      expect(jwt.verify).toHaveBeenCalledTimes(1);
    });

    it('should return 401 when no token is provided', () => {
      authenticateToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access token required',
        code: 'TOKEN_MISSING',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 when JWT_SECRET is not configured', () => {
      delete process.env.JWT_SECRET;

      mockReq.headers = {
        authorization: 'Bearer token',
      };

      authenticateToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Server configuration error',
        code: 'CONFIG_ERROR',
      });
    });

    it('should return 401 when token is expired', () => {
      const expiredError = new jwt.TokenExpiredError('Token expired', new Date());
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw expiredError;
      });

      mockReq.headers = {
        authorization: 'Bearer expired-token',
      };

      authenticateToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    });

    it('should return 403 when token is invalid', () => {
      const invalidError = new jwt.JsonWebTokenError('Invalid token');
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw invalidError;
      });

      mockReq.headers = {
        authorization: 'Bearer invalid-token',
      };

      authenticateToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
        code: 'TOKEN_INVALID',
      });
    });

    it('should handle clientId in token payload', () => {
      const mockDecoded = { clientId: 5, email: 'client@example.com', type: 'client' };
      vi.mocked(jwt.verify).mockReturnValue(mockDecoded as any);

      mockReq.headers = {
        authorization: 'Bearer token',
      };

      authenticateToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.id).toBe(5);
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin users', () => {
      mockReq.user = {
        id: 1,
        email: 'admin@example.com',
        type: 'admin',
      };

      requireAdmin(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject non-admin users', () => {
      mockReq.user = {
        id: 1,
        email: 'client@example.com',
        type: 'client',
      };

      requireAdmin(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', () => {
      requireAdmin(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    });
  });

  describe('requireClient', () => {
    it('should allow client users', () => {
      mockReq.user = {
        id: 1,
        email: 'client@example.com',
        type: 'client',
      };

      requireClient(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject non-client users', () => {
      mockReq.user = {
        id: 1,
        email: 'admin@example.com',
        type: 'admin',
      };

      requireClient(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Client access required',
        code: 'CLIENT_REQUIRED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', () => {
      requireClient(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    });
  });
});
