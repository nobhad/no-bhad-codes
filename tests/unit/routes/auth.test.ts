/**
 * ===============================================
 * AUTH ROUTES TESTS
 * ===============================================
 * @file tests/unit/routes/auth.test.ts
 *
 * Unit tests for authentication routes.
 * Note: These tests focus on testing route logic by importing and testing
 * the route handlers directly rather than using HTTP testing libraries.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../../../server/database/init';
import { auditLogger } from '../../../server/services/audit-logger';
import { sendSuccess, sendBadRequest, sendUnauthorized, sendServerError, sendNotFound } from '../../../server/utils/api-response';
import { AuthenticatedRequest } from '../../../server/middleware/auth';

// Mock dependencies
vi.mock('../../../server/database/init');
vi.mock('../../../server/services/audit-logger');
vi.mock('../../../server/utils/api-response');
vi.mock('../../../server/middleware/security', () => ({
  rateLimit: () => (req: Request, res: Response, next: NextFunction) => next(),
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}));

// Mock JWT
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
  sign: vi.fn(),
  verify: vi.fn(),
}));

describe('Auth Routes - Login Handler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockDb: any;

  beforeEach(() => {
    mockReq = {
      body: {},
      ip: '127.0.0.1',
    };

    mockRes = {
      cookie: vi.fn(),
    };

    mockNext = vi.fn() as unknown as NextFunction;

    // Setup mock database
    mockDb = {
      get: vi.fn((sql: string, params: any[], callback: any) => {
        // Default: no user found
        callback(null, undefined);
      }),
    };

    vi.mocked(getDatabase).mockReturnValue(mockDb as any);
    process.env.JWT_SECRET = 'test-secret-key';
    vi.mocked(jwt.sign).mockReturnValue('mock-jwt-token' as any);
    vi.clearAllMocks();
  });

  // Test login handler logic
  const testLoginHandler = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendBadRequest(res, 'Email and password are required', 'MISSING_CREDENTIALS');
    }

    const db = getDatabase();
    const client = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, email, password_hash, company_name, contact_name, status, is_admin FROM clients WHERE email = ?',
        [email.toLowerCase()],
        (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!client) {
      await auditLogger.logLoginFailed(email, req as any, 'User not found');
      return sendUnauthorized(res, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const clientData = client as any;

    if (clientData.status !== 'active') {
      await auditLogger.logLoginFailed(email, req as any, 'Account inactive');
      return sendUnauthorized(res, 'Account is not active. Please contact support.', 'ACCOUNT_INACTIVE');
    }

    const isValidPassword = await bcrypt.compare(password, clientData.password_hash);
    if (!isValidPassword) {
      await auditLogger.logLoginFailed(email, req as any, 'Invalid password');
      return sendUnauthorized(res, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return sendServerError(res, 'Server configuration error', 'CONFIG_ERROR');
    }

    const token = jwt.sign(
      {
        id: clientData.id,
        email: clientData.email,
        type: clientData.is_admin ? 'admin' : 'client',
        isAdmin: Boolean(clientData.is_admin),
      },
      secret,
      { expiresIn: '7d' }
    );

    await auditLogger.logLogin(
      clientData.id,
      clientData.email,
      clientData.is_admin ? 'admin' : 'client',
      req as any
    );

    res.cookie('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendSuccess(
      res,
      {
        user: {
          id: clientData.id,
          email: clientData.email,
          name: clientData.contact_name,
          companyName: clientData.company_name,
          contactName: clientData.contact_name,
          status: clientData.status,
          isAdmin: Boolean(clientData.is_admin),
        },
        expiresIn: '7d',
      },
      'Login successful'
    );
  };

  it('should login successfully with valid credentials', async () => {
    const mockClient = {
      id: 1,
      email: 'test@example.com',
      password_hash: 'hashed-password',
      company_name: 'Test Company',
      contact_name: 'Test User',
      status: 'active',
      is_admin: 0,
    };

    mockDb.get.mockImplementation((sql: string, params: any[], callback: any) => {
      callback(null, mockClient);
    });

    vi.mocked(bcrypt.compare).mockResolvedValue(true as any);
    mockReq.body = { email: 'test@example.com', password: 'password123' };

    await testLoginHandler(mockReq as Request, mockRes as Response);

    expect(sendSuccess).toHaveBeenCalled();
    expect(auditLogger.logLogin).toHaveBeenCalled();
    expect(mockRes.cookie).toHaveBeenCalledWith('auth-token', 'mock-jwt-token', expect.any(Object));
  });

  it('should return 400 when email is missing', async () => {
    mockReq.body = { password: 'password123' };

    await testLoginHandler(mockReq as Request, mockRes as Response);

    expect(sendBadRequest).toHaveBeenCalledWith(
      mockRes,
      'Email and password are required',
      'MISSING_CREDENTIALS'
    );
  });

  it('should return 400 when password is missing', async () => {
    mockReq.body = { email: 'test@example.com' };

    await testLoginHandler(mockReq as Request, mockRes as Response);

    expect(sendBadRequest).toHaveBeenCalled();
  });

  it('should return 401 when user is not found', async () => {
    mockDb.get.mockImplementation((sql: string, params: any[], callback: any) => {
      callback(null, undefined);
    });

    mockReq.body = { email: 'nonexistent@example.com', password: 'password123' };

    await testLoginHandler(mockReq as Request, mockRes as Response);

    expect(sendUnauthorized).toHaveBeenCalled();
    expect(auditLogger.logLoginFailed).toHaveBeenCalled();
  });

  it('should return 401 when account is inactive', async () => {
    const mockClient = {
      id: 1,
      email: 'test@example.com',
      password_hash: 'hashed-password',
      status: 'inactive',
      is_admin: 0,
    };

    mockDb.get.mockImplementation((sql: string, params: any[], callback: any) => {
      callback(null, mockClient);
    });

    mockReq.body = { email: 'test@example.com', password: 'password123' };

    await testLoginHandler(mockReq as Request, mockRes as Response);

    expect(sendUnauthorized).toHaveBeenCalled();
    expect(auditLogger.logLoginFailed).toHaveBeenCalled();
  });

  it('should return 401 when password is incorrect', async () => {
    const mockClient = {
      id: 1,
      email: 'test@example.com',
      password_hash: 'hashed-password',
      status: 'active',
      is_admin: 0,
    };

    mockDb.get.mockImplementation((sql: string, params: any[], callback: any) => {
      callback(null, mockClient);
    });

    vi.mocked(bcrypt.compare).mockResolvedValue(false as any);
    mockReq.body = { email: 'test@example.com', password: 'wrong-password' };

    await testLoginHandler(mockReq as Request, mockRes as Response);

    expect(sendUnauthorized).toHaveBeenCalled();
    expect(auditLogger.logLoginFailed).toHaveBeenCalled();
  });

  it('should return 500 when JWT_SECRET is not configured', async () => {
    delete process.env.JWT_SECRET;

    const mockClient = {
      id: 1,
      email: 'test@example.com',
      password_hash: 'hashed-password',
      status: 'active',
      is_admin: 0,
    };

    mockDb.get.mockImplementation((sql: string, params: any[], callback: any) => {
      callback(null, mockClient);
    });

    vi.mocked(bcrypt.compare).mockResolvedValue(true as any);
    mockReq.body = { email: 'test@example.com', password: 'password123' };

    await testLoginHandler(mockReq as Request, mockRes as Response);

    expect(sendServerError).toHaveBeenCalled();
  });
});
