/**
 * ===============================================
 * ERROR HANDLER MIDDLEWARE TESTS
 * ===============================================
 * @file tests/unit/middleware/errorHandler.test.ts
 *
 * Unit tests for error handling middleware.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { errorHandler, asyncHandler } from '../../../server/middleware/errorHandler';
import { logger } from '../../../server/services/logger';

// Mock logger
vi.mock('../../../server/services/logger', () => ({
  logger: {
    logError: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Error Handler Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/test',
      body: {},
      params: {},
      query: {},
      headers: {},
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-agent'),
      id: 'test-request-id',
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn() as unknown as NextFunction;
    process.env.NODE_ENV = 'test';
    vi.clearAllMocks();
  });

  describe('errorHandler', () => {
    it('should handle generic errors', () => {
      const error = new Error('Test error');

      errorHandler(error, mockReq as any, mockRes as Response, mockNext);

      expect(logger.logError).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Test error',
          code: 'INTERNAL_ERROR',
          timestamp: expect.any(String),
        })
      );
    });

    it('should handle errors with statusCode', () => {
      const error: any = new Error('Not found');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';

      errorHandler(error, mockReq as any, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Not found',
          code: 'NOT_FOUND',
        })
      );
    });

    it('should handle ValidationError', () => {
      const error: any = new Error('Validation failed');
      error.name = 'ValidationError';

      errorHandler(error, mockReq as any, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        })
      );
    });

    it('should handle CastError', () => {
      const error: any = new Error('Invalid cast');
      error.name = 'CastError';

      errorHandler(error, mockReq as any, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid data format',
          code: 'INVALID_FORMAT',
        })
      );
    });

    it('should handle UNIQUE constraint errors', () => {
      const error: any = new Error('UNIQUE constraint failed: email');
      error.name = 'DatabaseError';

      errorHandler(error, mockReq as any, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Resource already exists',
          code: 'DUPLICATE_RESOURCE',
        })
      );
    });

    it('should handle FOREIGN KEY constraint errors', () => {
      const error: any = new Error('FOREIGN KEY constraint failed');
      error.name = 'DatabaseError';

      errorHandler(error, mockReq as any, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid reference',
          code: 'INVALID_REFERENCE',
        })
      );
    });

    it('should hide error details in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Sensitive error details');

      errorHandler(error, mockReq as any, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        })
      );
      expect(mockRes.json).not.toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String),
        })
      );
    });

    it('should include stack trace in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      errorHandler(error, mockReq as any, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: 'Error stack trace',
        })
      );
    });

    it('should use request logger if available', () => {
      const requestLogger = {
        logError: vi.fn(),
      };
      (mockReq as any).logger = requestLogger;
      const error = new Error('Test error');

      errorHandler(error, mockReq as any, mockRes as Response, mockNext);

      expect(requestLogger.logError).toHaveBeenCalled();
      expect(logger.logError).not.toHaveBeenCalled();
    });
  });

  describe('asyncHandler', () => {
    it('should call async function and pass through success', async () => {
      const asyncFn = vi.fn().mockResolvedValue(undefined);

      const handler = asyncHandler(asyncFn);
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch errors and pass to next', async () => {
      const error = new Error('Async error');
      const asyncFn = vi.fn().mockRejectedValue(error);

      const handler = asyncHandler(asyncFn);
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(asyncFn).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle synchronous errors', async () => {
      const error = new Error('Sync error');
      const syncFn = vi.fn().mockImplementation(() => {
        throw error;
      });

      const handler = asyncHandler(syncFn);
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
