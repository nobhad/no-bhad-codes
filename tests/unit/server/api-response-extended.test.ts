/**
 * ===============================================
 * API RESPONSE UTILITIES EXTENDED TESTS
 * ===============================================
 * @file tests/unit/server/api-response-extended.test.ts
 *
 * Extended coverage for standardized API response helpers.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'express';

vi.mock('../../../server/database/row-helpers', () => ({
  transformData: (data: unknown) => data
}));

import {
  ErrorCodes,
  sendSuccess,
  sendCreated,
  messageResponse,
  sendError,
  errorResponse,
  errorResponseWithPayload,
  sendBadRequest,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendRateLimited,
  sendServerError,
  sendPaginated,
  sanitizeErrorMessage
} from '../../../server/utils/api-response';

function createMockRes() {
  const res = {
    statusCode: 200,
    json: vi.fn().mockReturnThis(),
    status: vi.fn()
  } as unknown as Response & { json: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> };

  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

describe('ErrorCodes', () => {
  it('has MISSING_CREDENTIALS', () => {
    expect(ErrorCodes.MISSING_CREDENTIALS).toBe('MISSING_CREDENTIALS');
  });

  it('has NOT_FOUND', () => {
    expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
  });

  it('has VALIDATION_ERROR', () => {
    expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
  });

  it('has RATE_LIMIT_EXCEEDED', () => {
    expect(ErrorCodes.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('has INTERNAL_ERROR', () => {
    expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
  });

  it('has TWO_FACTOR_REQUIRED', () => {
    expect(ErrorCodes.TWO_FACTOR_REQUIRED).toBe('TWO_FACTOR_REQUIRED');
  });

  it('has UNAUTHORIZED', () => {
    expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
  });
});

describe('sendSuccess', () => {
  it('responds with status 200 by default', () => {
    const res = createMockRes();
    sendSuccess(res as unknown as Response, undefined, undefined);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(200);
  });

  it('sets success to true', () => {
    const res = createMockRes();
    sendSuccess(res as unknown as Response, undefined, undefined);
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it('includes message when provided', () => {
    const res = createMockRes();
    sendSuccess(res as unknown as Response, undefined, 'All good');
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'All good' })
    );
  });

  it('includes data when provided', () => {
    const res = createMockRes();
    sendSuccess(res as unknown as Response, { id: 1 }, undefined);
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { id: 1 } })
    );
  });

  it('omits data property when not provided', () => {
    const res = createMockRes();
    sendSuccess(res as unknown as Response, undefined, undefined);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body).not.toHaveProperty('data');
  });

  it('respects a custom statusCode', () => {
    const res = createMockRes();
    sendSuccess(res as unknown as Response, undefined, undefined, 202);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(202);
  });
});

describe('sendCreated', () => {
  it('responds with status 201', () => {
    const res = createMockRes();
    sendCreated(res as unknown as Response, { id: 1 });
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(201);
  });

  it('sets success to true', () => {
    const res = createMockRes();
    sendCreated(res as unknown as Response, { id: 1 });
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it('includes data', () => {
    const res = createMockRes();
    sendCreated(res as unknown as Response, { id: 42 });
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { id: 42 } })
    );
  });

  it('uses default message', () => {
    const res = createMockRes();
    sendCreated(res as unknown as Response, {});
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Created successfully' })
    );
  });
});

describe('messageResponse', () => {
  it('responds with status 200 by default', () => {
    const res = createMockRes();
    messageResponse(res as unknown as Response, 'hello');
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(200);
  });

  it('sets success to true with message', () => {
    const res = createMockRes();
    messageResponse(res as unknown as Response, 'Operation complete');
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({
      success: true,
      message: 'Operation complete'
    });
  });

  it('respects a custom status code', () => {
    const res = createMockRes();
    messageResponse(res as unknown as Response, 'OK', 202);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(202);
  });
});

describe('sendError', () => {
  it('responds with status 500 by default', () => {
    const res = createMockRes();
    sendError(res as unknown as Response, 'Something broke');
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(500);
  });

  it('sets success to false', () => {
    const res = createMockRes();
    sendError(res as unknown as Response, 'Something broke');
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('includes the error message', () => {
    const res = createMockRes();
    sendError(res as unknown as Response, 'My error');
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'My error' })
    );
  });

  it('includes the error code', () => {
    const res = createMockRes();
    sendError(res as unknown as Response, 'My error', ErrorCodes.NOT_FOUND, 404);
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_FOUND' })
    );
  });

  it('includes details when provided', () => {
    const res = createMockRes();
    sendError(res as unknown as Response, 'Error', ErrorCodes.VALIDATION_ERROR, 400, { field: 'email' });
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ details: { field: 'email' } })
    );
  });

  it('omits details when not provided', () => {
    const res = createMockRes();
    sendError(res as unknown as Response, 'Error');
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body).not.toHaveProperty('details');
  });

  it('uses a custom statusCode', () => {
    const res = createMockRes();
    sendError(res as unknown as Response, 'Error', ErrorCodes.NOT_FOUND, 404);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(404);
  });
});

describe('errorResponse', () => {
  it('responds with status 400 by default', () => {
    const res = createMockRes();
    errorResponse(res as unknown as Response, 'Bad request');
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(400);
  });

  it('sets success to false', () => {
    const res = createMockRes();
    errorResponse(res as unknown as Response, 'Bad request');
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('includes the error message', () => {
    const res = createMockRes();
    errorResponse(res as unknown as Response, 'Something wrong');
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Something wrong' })
    );
  });

  it('auto-generates code from status when not provided', () => {
    const res = createMockRes();
    errorResponse(res as unknown as Response, 'Err', 400);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.code).toBeTruthy();
  });

  it('uses the provided code', () => {
    const res = createMockRes();
    errorResponse(res as unknown as Response, 'Err', 400, 'MY_CODE');
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'MY_CODE' })
    );
  });

  it('respects custom status', () => {
    const res = createMockRes();
    errorResponse(res as unknown as Response, 'Err', 422);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(422);
  });
});

describe('errorResponseWithPayload', () => {
  it('merges payload fields into the response', () => {
    const res = createMockRes();
    errorResponseWithPayload(res as unknown as Response, 'Error', 400, 'CODE', { extra: 'data' });
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ extra: 'data', success: false, error: 'Error' })
    );
  });

  it('uses 400 as default status', () => {
    const res = createMockRes();
    errorResponseWithPayload(res as unknown as Response, 'Error');
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(400);
  });

  it('works without payload', () => {
    const res = createMockRes();
    errorResponseWithPayload(res as unknown as Response, 'Error', 400, 'CODE');
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Error', code: 'CODE' })
    );
  });
});

describe('sendBadRequest', () => {
  it('responds with status 400', () => {
    const res = createMockRes();
    sendBadRequest(res as unknown as Response, 'Bad input');
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(400);
  });

  it('uses VALIDATION_ERROR as the default code', () => {
    const res = createMockRes();
    sendBadRequest(res as unknown as Response, 'Bad input');
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    );
  });

  it('sets success to false', () => {
    const res = createMockRes();
    sendBadRequest(res as unknown as Response, 'Bad input');
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });
});

describe('sendUnauthorized', () => {
  it('responds with status 401', () => {
    const res = createMockRes();
    sendUnauthorized(res as unknown as Response);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(401);
  });

  it('uses UNAUTHORIZED as the code', () => {
    const res = createMockRes();
    sendUnauthorized(res as unknown as Response);
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
  });

  it('uses a custom message', () => {
    const res = createMockRes();
    sendUnauthorized(res as unknown as Response, 'Token expired');
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Token expired' })
    );
  });
});

describe('sendForbidden', () => {
  it('responds with status 403', () => {
    const res = createMockRes();
    sendForbidden(res as unknown as Response);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(403);
  });

  it('sets success to false', () => {
    const res = createMockRes();
    sendForbidden(res as unknown as Response);
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });
});

describe('sendNotFound', () => {
  it('responds with status 404', () => {
    const res = createMockRes();
    sendNotFound(res as unknown as Response);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(404);
  });

  it('uses NOT_FOUND as the code', () => {
    const res = createMockRes();
    sendNotFound(res as unknown as Response);
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_FOUND' })
    );
  });

  it('uses a custom message', () => {
    const res = createMockRes();
    sendNotFound(res as unknown as Response, 'Invoice not found');
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invoice not found' })
    );
  });
});

describe('sendConflict', () => {
  it('responds with status 409', () => {
    const res = createMockRes();
    sendConflict(res as unknown as Response, 'Already exists');
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(409);
  });

  it('sets success to false', () => {
    const res = createMockRes();
    sendConflict(res as unknown as Response, 'Duplicate');
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });
});

describe('sendRateLimited', () => {
  it('responds with status 429', () => {
    const res = createMockRes();
    sendRateLimited(res as unknown as Response);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(429);
  });

  it('sets success to false', () => {
    const res = createMockRes();
    sendRateLimited(res as unknown as Response);
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });
});

describe('sendServerError', () => {
  it('responds with status 500', () => {
    const res = createMockRes();
    sendServerError(res as unknown as Response);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(500);
  });

  it('uses INTERNAL_ERROR as the code', () => {
    const res = createMockRes();
    sendServerError(res as unknown as Response);
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_ERROR' })
    );
  });

  it('sets success to false', () => {
    const res = createMockRes();
    sendServerError(res as unknown as Response);
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });
});

describe('sendPaginated', () => {
  it('includes the data array', () => {
    const res = createMockRes();
    sendPaginated(res as unknown as Response, [{ id: 1 }, { id: 2 }], { page: 1, perPage: 10, total: 2 });
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('includes pagination metadata', () => {
    const res = createMockRes();
    sendPaginated(res as unknown as Response, [], { page: 2, perPage: 10, total: 25 });
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.perPage).toBe(10);
    expect(body.pagination.total).toBe(25);
  });

  it('calculates totalPages correctly', () => {
    const res = createMockRes();
    sendPaginated(res as unknown as Response, [], { page: 1, perPage: 10, total: 25 });
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.pagination.totalPages).toBe(3);
  });

  it('calculates hasNext correctly', () => {
    const res = createMockRes();
    sendPaginated(res as unknown as Response, [], { page: 1, perPage: 10, total: 25 });
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.pagination.hasNext).toBe(true);
  });

  it('hasNext is false on last page', () => {
    const res = createMockRes();
    sendPaginated(res as unknown as Response, [], { page: 3, perPage: 10, total: 25 });
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.pagination.hasNext).toBe(false);
  });

  it('calculates hasPrev correctly', () => {
    const res = createMockRes();
    sendPaginated(res as unknown as Response, [], { page: 2, perPage: 10, total: 25 });
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.pagination.hasPrev).toBe(true);
  });

  it('hasPrev is false on first page', () => {
    const res = createMockRes();
    sendPaginated(res as unknown as Response, [], { page: 1, perPage: 10, total: 25 });
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.pagination.hasPrev).toBe(false);
  });

  it('includes message when provided', () => {
    const res = createMockRes();
    sendPaginated(res as unknown as Response, [], { page: 1, perPage: 10, total: 0 }, 'Results loaded');
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.message).toBe('Results loaded');
  });

  it('sets success to true', () => {
    const res = createMockRes();
    sendPaginated(res as unknown as Response, [], { page: 1, perPage: 10, total: 0 });
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
  });
});

describe('sanitizeErrorMessage', () => {
  it('returns the real error message in non-production environments', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const error = new Error('Detailed internal message');
    const result = sanitizeErrorMessage(error);
    expect(result).toBe('Detailed internal message');

    process.env.NODE_ENV = originalEnv;
  });

  it('returns "Unknown error" for non-Error values in non-production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const result = sanitizeErrorMessage('some string error');
    expect(result).toBe('Unknown error');

    process.env.NODE_ENV = originalEnv;
  });

  it('returns generic fallback in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Database connection failed');
    const result = sanitizeErrorMessage(error);
    expect(result).toBe('An unexpected error occurred');

    process.env.NODE_ENV = originalEnv;
  });

  it('uses a custom fallback in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Sensitive error');
    const result = sanitizeErrorMessage(error, 'Custom safe message');
    expect(result).toBe('Custom safe message');

    process.env.NODE_ENV = originalEnv;
  });

  it('returns message from Error instance', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const result = sanitizeErrorMessage(new Error('Real message'));
    expect(result).toBe('Real message');

    process.env.NODE_ENV = originalEnv;
  });
});
