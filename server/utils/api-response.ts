/**
 * ===============================================
 * API RESPONSE UTILITIES
 * ===============================================
 * @file server/utils/api-response.ts
 *
 * Standardized API response helpers for consistent
 * response format across all endpoints.
 *
 * CANONICAL RESPONSE FORMAT:
 * Success: { success: true, data?: T, message?: string }
 * Error:   { success: false, error: string, code: string, details?: object }
 */

import { Response } from 'express';

// ============================================
// TYPES & INTERFACES
// ============================================

/**
 * Standard API response interface
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Error codes for consistent error identification
 */
export const ErrorCodes = {
  // Authentication errors
  MISSING_CREDENTIALS: 'MISSING_CREDENTIALS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  ACCESS_DENIED: 'ACCESS_DENIED',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_FIELDS: 'MISSING_FIELDS',
  MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  INVALID_STATUS: 'INVALID_STATUS',
  NO_UPDATES: 'NO_UPDATES',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  CONFLICT: 'CONFLICT',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Business logic
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  OPERATION_FAILED: 'OPERATION_FAILED',
  INVALID_CLIENT: 'INVALID_CLIENT',
  BAD_REQUEST: 'BAD_REQUEST'
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================
// SUCCESS RESPONSES
// ============================================

/**
 * Send a success response with data wrapped in `data` property
 * @example sendSuccess(res, { user: {...} }, 'User created')
 */
export function sendSuccess<T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200
): Response {
  const response: ApiResponse<T> = {
    success: true
  };

  if (message) {
    response.message = message;
  }

  if (data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send a created response (201)
 */
export function sendCreated<T>(
  res: Response,
  data?: T,
  message = 'Created successfully'
): Response {
  return sendSuccess(res, data, message, 201);
}

/**
 * Success response with just a message
 */
export function messageResponse(
  res: Response,
  message: string,
  status = 200
): Response {
  return res.status(status).json({
    success: true,
    message
  });
}

// ============================================
// ERROR RESPONSES
// ============================================

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  message: string,
  code: ErrorCode | string = ErrorCodes.INTERNAL_ERROR,
  statusCode = 500,
  details?: Record<string, unknown>
): Response {
  const response: ApiResponse & { details?: Record<string, unknown> } = {
    success: false,
    error: message,
    code
  };

  if (details) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
}

/**
 * Standard error response (backward compatible)
 */
export function errorResponse(
  res: Response,
  message: string,
  status = 400,
  code?: string
): Response {
  return res.status(status).json({
    success: false,
    error: message,
    code: code || getErrorCode(status)
  });
}

/**
 * Error response with additional payload fields
 */
export function errorResponseWithPayload(
  res: Response,
  message: string,
  status = 400,
  code?: string,
  payload?: Record<string, unknown>
): Response {
  return res.status(status).json({
    success: false,
    error: message,
    code: code || getErrorCode(status),
    ...(payload || {})
  });
}

/**
 * Send a bad request error (400)
 */
export function sendBadRequest(
  res: Response,
  message: string,
  code: ErrorCode | string = ErrorCodes.VALIDATION_ERROR,
  details?: Record<string, unknown>
): Response {
  return sendError(res, message, code, 400, details);
}

/**
 * Send an unauthorized error (401)
 */
export function sendUnauthorized(
  res: Response,
  message = 'Unauthorized',
  code: ErrorCode | string = ErrorCodes.UNAUTHORIZED
): Response {
  return sendError(res, message, code, 401);
}

/**
 * Send a forbidden error (403)
 */
export function sendForbidden(
  res: Response,
  message = 'Forbidden',
  code: ErrorCode | string = ErrorCodes.FORBIDDEN
): Response {
  return sendError(res, message, code, 403);
}

/**
 * Send a not found error (404)
 */
export function sendNotFound(
  res: Response,
  message = 'Resource not found',
  code: ErrorCode | string = ErrorCodes.NOT_FOUND
): Response {
  return sendError(res, message, code, 404);
}

/**
 * Send a conflict error (409)
 */
export function sendConflict(
  res: Response,
  message: string,
  code: ErrorCode | string = ErrorCodes.CONFLICT
): Response {
  return sendError(res, message, code, 409);
}

/**
 * Send a rate limit error (429)
 */
export function sendRateLimited(
  res: Response,
  message = 'Too many requests',
  code: ErrorCode | string = ErrorCodes.RATE_LIMIT_EXCEEDED
): Response {
  return sendError(res, message, code, 429);
}

/**
 * Send a server error (500)
 */
export function sendServerError(
  res: Response,
  message = 'Internal server error',
  code: ErrorCode | string = ErrorCodes.INTERNAL_ERROR
): Response {
  return sendError(res, message, code, 500);
}

// ============================================
// PAGINATED RESPONSES
// ============================================

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated API response
 */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

/**
 * Send a paginated response
 * @example sendPaginated(res, users, { page: 1, perPage: 10, total: 100 })
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    perPage: number;
    total: number;
  },
  message?: string
): Response {
  const totalPages = Math.ceil(pagination.total / pagination.perPage);

  const response: PaginatedApiResponse<T> = {
    success: true,
    data,
    pagination: {
      page: pagination.page,
      perPage: pagination.perPage,
      total: pagination.total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1
    }
  };

  if (message) {
    response.message = message;
  }

  return res.json(response);
}

// ============================================
// UTILITIES
// ============================================

/**
 * Get default error code for status
 */
function getErrorCode(status: number): string {
  switch (status) {
  case 400:
    return 'BAD_REQUEST';
  case 401:
    return 'UNAUTHORIZED';
  case 403:
    return 'ACCESS_DENIED';
  case 404:
    return 'RESOURCE_NOT_FOUND';
  case 409:
    return 'DUPLICATE_RESOURCE';
  case 422:
    return 'VALIDATION_ERROR';
  case 429:
    return 'RATE_LIMIT_EXCEEDED';
  case 500:
    return 'INTERNAL_ERROR';
  default:
    return 'ERROR';
  }
}
