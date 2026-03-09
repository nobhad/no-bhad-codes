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
import { transformData } from '../database/row-helpers.js';

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
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_FIELDS: 'MISSING_FIELDS',
  MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  INVALID_STATUS: 'INVALID_STATUS',
  INVALID_TYPE: 'INVALID_TYPE',
  INVALID_PATTERN: 'INVALID_PATTERN',
  INVALID_VALUE: 'INVALID_VALUE',
  INVALID_NUMBER: 'INVALID_NUMBER',
  INVALID_BOOLEAN: 'INVALID_BOOLEAN',
  INVALID_ARRAY: 'INVALID_ARRAY',
  INVALID_OBJECT: 'INVALID_OBJECT',
  INVALID_ID: 'INVALID_ID',
  INVALID_QUERY: 'INVALID_QUERY',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_HOURS: 'INVALID_HOURS',
  INVALID_CREDIT: 'INVALID_CREDIT',
  INVALID_CATEGORY: 'INVALID_CATEGORY',
  INVALID_ACCESS_TYPE: 'INVALID_ACCESS_TYPE',
  INVALID_AVATAR_TYPE: 'INVALID_AVATAR_TYPE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  INVALID_FILE_ID: 'INVALID_FILE_ID',
  INVALID_FILENAME: 'INVALID_FILENAME',
  INVALID_LINE_ITEMS: 'INVALID_LINE_ITEMS',
  INVALID_PROJECT_ID: 'INVALID_PROJECT_ID',
  INVALID_SIGNATURE_LINK: 'INVALID_SIGNATURE_LINK',
  INVALID_TRIGGER_ID: 'INVALID_TRIGGER_ID',
  INVALID_UPDATE_TYPE: 'INVALID_UPDATE_TYPE',
  INVALID_FORMAT: 'INVALID_FORMAT',
  NO_UPDATES: 'NO_UPDATES',
  NO_FIELDS: 'NO_FIELDS',
  WEAK_PASSWORD: 'WEAK_PASSWORD',

  // Missing field errors
  MISSING_CONTENT: 'MISSING_CONTENT',
  MISSING_DATE_RANGE: 'MISSING_DATE_RANGE',
  MISSING_DEPENDENCY: 'MISSING_DEPENDENCY',
  MISSING_MESSAGE: 'MISSING_MESSAGE',
  MISSING_MESSAGE_IDS: 'MISSING_MESSAGE_IDS',
  MISSING_NAME: 'MISSING_NAME',
  MISSING_PARAMETERS: 'MISSING_PARAMETERS',
  MISSING_PAYMENT_METHOD: 'MISSING_PAYMENT_METHOD',
  MISSING_PROJECT: 'MISSING_PROJECT',
  MISSING_QUERY: 'MISSING_QUERY',
  MISSING_REACTION: 'MISSING_REACTION',
  MISSING_SIGNATURE: 'MISSING_SIGNATURE',
  MISSING_SIGNER_NAME: 'MISSING_SIGNER_NAME',
  MISSING_THREAD_ID: 'MISSING_THREAD_ID',
  MISSING_TITLE: 'MISSING_TITLE',
  MISSING_CLIENT_EMAIL: 'MISSING_CLIENT_EMAIL',
  MESSAGE_REQUIRED: 'MESSAGE_REQUIRED',
  TERMS_NOT_ACCEPTED: 'TERMS_NOT_ACCEPTED',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  MILESTONE_NOT_FOUND: 'MILESTONE_NOT_FOUND',
  PROPOSAL_NOT_FOUND: 'PROPOSAL_NOT_FOUND',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  THREAD_NOT_FOUND: 'THREAD_NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  CONFLICT: 'CONFLICT',
  EMAIL_EXISTS: 'EMAIL_EXISTS',

  // File errors
  FILE_MISSING: 'FILE_MISSING',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  NO_FILE: 'NO_FILE',
  NO_FILES: 'NO_FILES',
  NO_PROJECT_FILE: 'NO_PROJECT_FILE',
  NO_AVATAR: 'NO_AVATAR',
  TOO_MANY_FILES: 'TOO_MANY_FILES',
  UPLOAD_ERROR: 'UPLOAD_ERROR',
  PATH_TRAVERSAL_DETECTED: 'PATH_TRAVERSAL_DETECTED',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  DB_ERROR: 'DB_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATA_QUERY_ERROR: 'DATA_QUERY_ERROR',
  HEALTH_CHECK_ERROR: 'HEALTH_CHECK_ERROR',

  // Operation failure errors
  OPERATION_FAILED: 'OPERATION_FAILED',
  CREATION_FAILED: 'CREATION_FAILED',
  UPDATE_FAILED: 'UPDATE_FAILED',
  DELETE_FAILED: 'DELETE_FAILED',
  DELETION_FAILED: 'DELETION_FAILED',
  RETRIEVAL_FAILED: 'RETRIEVAL_FAILED',
  SEARCH_FAILED: 'SEARCH_FAILED',
  PROCESS_FAILED: 'PROCESS_FAILED',
  RECORD_FAILED: 'RECORD_FAILED',
  SEND_FAILED: 'SEND_FAILED',
  APPLY_FAILED: 'APPLY_FAILED',
  CALCULATION_FAILED: 'CALCULATION_FAILED',
  DUPLICATE_FAILED: 'DUPLICATE_FAILED',
  RESTORE_FAILED: 'RESTORE_FAILED',
  SKIP_FAILED: 'SKIP_FAILED',
  STATS_FAILED: 'STATS_FAILED',
  SCHEDULING_FAILED: 'SCHEDULING_FAILED',
  REPORT_FAILED: 'REPORT_FAILED',
  PAUSE_FAILED: 'PAUSE_FAILED',
  RESUME_FAILED: 'RESUME_FAILED',
  CREDIT_FAILED: 'CREDIT_FAILED',
  ZIP_FAILED: 'ZIP_FAILED',
  CANCELLATION_FAILED: 'CANCELLATION_FAILED',
  GENERATION_FAILED: 'GENERATION_FAILED',
  LINK_FAILED: 'LINK_FAILED',
  CHECK_OVERDUE_FAILED: 'CHECK_OVERDUE_FAILED',
  TEST_CREATION_FAILED: 'TEST_CREATION_FAILED',
  TEST_EMAIL_FAILED: 'TEST_EMAIL_FAILED',
  QUERY_ERROR: 'QUERY_ERROR',

  // Permission errors
  DELETE_FORBIDDEN: 'DELETE_FORBIDDEN',
  EDIT_FORBIDDEN: 'EDIT_FORBIDDEN',

  // Business logic
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INVALID_CLIENT: 'INVALID_CLIENT',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  NO_CLIENT_EMAIL: 'NO_CLIENT_EMAIL',
  STATUS_ERROR: 'STATUS_ERROR',
  CLIENT_CREATION_ERROR: 'CLIENT_CREATION_ERROR',

  // Invoice/payment errors
  INVOICE_PAID: 'INVOICE_PAID',
  INVOICE_CANCELLED: 'INVOICE_CANCELLED',
  TOO_MANY_INVOICES: 'TOO_MANY_INVOICES',
  CANNOT_DELETE_PAID: 'CANNOT_DELETE_PAID',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_NOT_ALLOWED: 'PAYMENT_NOT_ALLOWED',
  SEND_REMINDER_FAILED: 'SEND_REMINDER_FAILED',

  // Contract/signature errors
  ALREADY_SIGNED: 'ALREADY_SIGNED',
  ALREADY_APPLIED: 'ALREADY_APPLIED',
  SIGNATURE_DECLINED: 'SIGNATURE_DECLINED',
  SIGNATURE_EXPIRED: 'SIGNATURE_EXPIRED',
  SIGNATURE_LINK_EXPIRED: 'SIGNATURE_LINK_EXPIRED',
  CONTRACT_ALREADY_SIGNED: 'CONTRACT_ALREADY_SIGNED',
  CLIENT_SIGNATURE_REQUIRED: 'CLIENT_SIGNATURE_REQUIRED',

  // PDF/email errors
  PDF_FAILED: 'PDF_FAILED',
  PDF_GENERATION_FAILED: 'PDF_GENERATION_FAILED',
  EMAIL_FAILED: 'EMAIL_FAILED',

  // Analytics/reporting errors
  ANALYTICS_ERROR: 'ANALYTICS_ERROR',
  PERFORMANCE_ERROR: 'PERFORMANCE_ERROR',
  AUDIT_LOG_ERROR: 'AUDIT_LOG_ERROR',
  CONTACT_PROCESSING_ERROR: 'CONTACT_PROCESSING_ERROR',
  MILESTONE_CREATION_ERROR: 'MILESTONE_CREATION_ERROR',
  MILESTONE_UPDATE_ERROR: 'MILESTONE_UPDATE_ERROR',

  // Cache errors
  CACHE_CLEAR_ERROR: 'CACHE_CLEAR_ERROR',
  CACHE_CLEAR_FAILED: 'CACHE_CLEAR_FAILED',
  CACHE_INVALIDATE_ERROR: 'CACHE_INVALIDATE_ERROR',
  CACHE_STATS_ERROR: 'CACHE_STATS_ERROR',
  CACHE_UNAVAILABLE: 'CACHE_UNAVAILABLE',
  STRIPE_NOT_CONFIGURED: 'STRIPE_NOT_CONFIGURED',
  GOOGLE_CALENDAR_NOT_CONFIGURED: 'GOOGLE_CALENDAR_NOT_CONFIGURED',
  ADMIN_EMAIL_NOT_CONFIGURED: 'ADMIN_EMAIL_NOT_CONFIGURED',

  // Two-factor authentication
  TWO_FACTOR_REQUIRED: 'TWO_FACTOR_REQUIRED',
  TWO_FACTOR_INVALID_CODE: 'TWO_FACTOR_INVALID_CODE',
  TWO_FACTOR_ALREADY_ENABLED: 'TWO_FACTOR_ALREADY_ENABLED',
  TWO_FACTOR_NOT_ENABLED: 'TWO_FACTOR_NOT_ENABLED',
  TWO_FACTOR_SETUP_REQUIRED: 'TWO_FACTOR_SETUP_REQUIRED',
  TWO_FACTOR_TEMP_TOKEN_EXPIRED: 'TWO_FACTOR_TEMP_TOKEN_EXPIRED'
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================
// SUCCESS RESPONSES
// ============================================

/**
 * Send a success response with data wrapped in `data` property
 * Automatically transforms data:
 * - Converts SQLite 0/1 to boolean for known boolean fields
 * - Parses JSON strings for known JSON fields
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
    // Transform data to convert 0/1 to booleans and parse JSON fields
    response.data = transformData(data);
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
export function messageResponse(res: Response, message: string, status = 200): Response {
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
 * Automatically transforms data:
 * - Converts SQLite 0/1 to boolean for known boolean fields
 * - Parses JSON strings for known JSON fields
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
    // Transform data to convert 0/1 to booleans and parse JSON fields
    data: transformData(data),
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
// PAGINATION QUERY HELPERS
// ============================================

/** Default pagination values */
const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 500;

/**
 * Parsed pagination parameters from query string
 */
export interface ParsedPagination {
  page: number;
  perPage: number;
  offset: number;
  limit: number;
}

/**
 * Parse and validate pagination query parameters.
 * Supports both page-based (?page=2&perPage=25) and
 * offset-based (?limit=25&offset=25) query params.
 *
 * Page-based params take priority when both are present.
 *
 * @example
 *   const pagination = parsePaginationQuery(req.query);
 *   // Use pagination.limit and pagination.offset in SQL
 *   // Use pagination.page and pagination.perPage in sendPaginated()
 */
export function parsePaginationQuery(
  query: Record<string, unknown>,
  defaults: { perPage?: number } = {}
): ParsedPagination {
  const defaultPerPage = defaults.perPage ?? DEFAULT_PER_PAGE;

  // Prefer page-based params, fall back to offset-based
  const hasPageParams = query.page !== undefined;
  const hasOffsetParams = query.offset !== undefined || query.limit !== undefined;

  let page: number;
  let perPage: number;

  if (hasPageParams) {
    page = Math.max(DEFAULT_PAGE, parseInt(String(query.page), 10) || DEFAULT_PAGE);
    perPage = Math.min(
      MAX_PER_PAGE,
      Math.max(1, parseInt(String(query.perPage ?? query.limit ?? defaultPerPage), 10) || defaultPerPage)
    );
  } else if (hasOffsetParams) {
    const offset = Math.max(0, parseInt(String(query.offset), 10) || 0);
    perPage = Math.min(
      MAX_PER_PAGE,
      Math.max(1, parseInt(String(query.limit ?? defaultPerPage), 10) || defaultPerPage)
    );
    page = Math.floor(offset / perPage) + 1;
  } else {
    page = DEFAULT_PAGE;
    perPage = defaultPerPage;
  }

  return {
    page,
    perPage,
    offset: (page - 1) * perPage,
    limit: perPage
  };
}

// ============================================
// UTILITIES
// ============================================

const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred';
const FALLBACK_ERROR_MESSAGE = 'Unknown error';

/**
 * Returns a client-safe error message.
 * In production, returns a generic message to avoid leaking
 * internal details (stack traces, DB errors, file paths, etc.).
 * In development, returns the real error message for debugging.
 *
 * IMPORTANT: Always log the real error separately for debugging.
 * This function is ONLY for the message sent to the client.
 *
 * @param error - The caught error (unknown type from catch blocks)
 * @param fallback - Optional custom generic message for production
 * @returns A sanitized string safe to send to clients
 */
export function sanitizeErrorMessage(
  error: unknown,
  fallback: string = GENERIC_ERROR_MESSAGE
): string {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    return fallback;
  }

  return error instanceof Error ? error.message : FALLBACK_ERROR_MESSAGE;
}

/**
 * Get default error code for status
 */
function getErrorCode(status: number): ErrorCode | string {
  switch (status) {
  case 400:
    return ErrorCodes.BAD_REQUEST;
  case 401:
    return ErrorCodes.UNAUTHORIZED;
  case 403:
    return ErrorCodes.ACCESS_DENIED;
  case 404:
    return ErrorCodes.RESOURCE_NOT_FOUND;
  case 409:
    return ErrorCodes.DUPLICATE_RESOURCE;
  case 422:
    return ErrorCodes.VALIDATION_ERROR;
  case 429:
    return ErrorCodes.RATE_LIMIT_EXCEEDED;
  case 500:
    return ErrorCodes.INTERNAL_ERROR;
  default:
    return 'ERROR';
  }
}
