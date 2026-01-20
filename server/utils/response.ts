/**
 * ===============================================
 * API RESPONSE UTILITIES
 * ===============================================
 * @file server/utils/response.ts
 *
 * Standardized API response format helpers.
 * All API endpoints should use these helpers for consistent responses.
 */

import { Response } from 'express';

/**
 * Standard API response interface
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
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

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_FIELDS: 'MISSING_FIELDS',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
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
  OPERATION_FAILED: 'OPERATION_FAILED'
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Send a success response
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
export function sendCreated<T>(res: Response, data?: T, message?: string): Response {
  return sendSuccess(res, data, message, 201);
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  message: string,
  code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
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
 * Send a bad request error (400)
 */
export function sendBadRequest(
  res: Response,
  message: string,
  code: ErrorCode = ErrorCodes.VALIDATION_ERROR,
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
  code: ErrorCode = ErrorCodes.UNAUTHORIZED
): Response {
  return sendError(res, message, code, 401);
}

/**
 * Send a forbidden error (403)
 */
export function sendForbidden(
  res: Response,
  message = 'Forbidden',
  code: ErrorCode = ErrorCodes.FORBIDDEN
): Response {
  return sendError(res, message, code, 403);
}

/**
 * Send a not found error (404)
 */
export function sendNotFound(
  res: Response,
  message = 'Resource not found',
  code: ErrorCode = ErrorCodes.NOT_FOUND
): Response {
  return sendError(res, message, code, 404);
}

/**
 * Send a conflict error (409)
 */
export function sendConflict(
  res: Response,
  message: string,
  code: ErrorCode = ErrorCodes.CONFLICT
): Response {
  return sendError(res, message, code, 409);
}

/**
 * Send a rate limit error (429)
 */
export function sendRateLimited(
  res: Response,
  message = 'Too many requests',
  code: ErrorCode = ErrorCodes.RATE_LIMIT_EXCEEDED
): Response {
  return sendError(res, message, code, 429);
}

/**
 * Send a server error (500)
 */
export function sendServerError(
  res: Response,
  message = 'Internal server error',
  code: ErrorCode = ErrorCodes.INTERNAL_ERROR
): Response {
  return sendError(res, message, code, 500);
}
