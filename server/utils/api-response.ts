/**
 * ===============================================
 * API RESPONSE UTILITIES
 * ===============================================
 * @file server/utils/api-response.ts
 *
 * Standardized API response helpers for consistent
 * response format across all endpoints.
 */

import { Response } from 'express';

/**
 * Standard success response
 */
export function successResponse<T>(
  res: Response,
  data: T,
  status = 200
): Response {
  return res.status(status).json({
    success: true,
    ...data
  });
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

/**
 * Created response (201)
 */
export function createdResponse<T>(
  res: Response,
  data: T,
  message?: string
): Response {
  return res.status(201).json({
    success: true,
    message: message || 'Created successfully',
    ...data
  });
}

/**
 * Standard error response
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
 * Not found response (404)
 */
export function notFoundResponse(
  res: Response,
  entity: string
): Response {
  return res.status(404).json({
    success: false,
    error: `${entity} not found`,
    code: 'RESOURCE_NOT_FOUND'
  });
}

/**
 * Forbidden response (403)
 */
export function forbiddenResponse(
  res: Response,
  message = 'Access denied'
): Response {
  return res.status(403).json({
    success: false,
    error: message,
    code: 'ACCESS_DENIED'
  });
}

/**
 * Unauthorized response (401)
 */
export function unauthorizedResponse(
  res: Response,
  message = 'Authentication required'
): Response {
  return res.status(401).json({
    success: false,
    error: message,
    code: 'UNAUTHORIZED'
  });
}

/**
 * Validation error response (400)
 */
export function validationErrorResponse(
  res: Response,
  message: string,
  details?: Record<string, string>
): Response {
  return res.status(400).json({
    success: false,
    error: message,
    code: 'VALIDATION_ERROR',
    details
  });
}

/**
 * Conflict response (409)
 */
export function conflictResponse(
  res: Response,
  message: string
): Response {
  return res.status(409).json({
    success: false,
    error: message,
    code: 'DUPLICATE_RESOURCE'
  });
}

/**
 * Internal server error response (500)
 */
export function serverErrorResponse(
  res: Response,
  message = 'Internal server error'
): Response {
  return res.status(500).json({
    success: false,
    error: message,
    code: 'INTERNAL_ERROR'
  });
}

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
    case 500:
      return 'INTERNAL_ERROR';
    default:
      return 'ERROR';
  }
}
