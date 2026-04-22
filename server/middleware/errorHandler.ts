/**
 * ===============================================
 * ERROR HANDLING MIDDLEWARE
 * ===============================================
 * Centralized error handling for the Express app
 * with integrated logging service.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.js';
import { isAppError } from '../utils/app-errors.js';

interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

interface LoggingRequest extends Request {
  id?: string;
  logger?: typeof logger;
}

/**
 * Sanitize request body/headers by removing sensitive fields
 * Uses case-insensitive matching for HTTP headers
 */
function sanitizeRequestData(data: unknown): Record<string, unknown> | unknown {
  if (!data || typeof data !== 'object') return data;

  const sensitiveFields = [
    'password',
    'token',
    'apiKey',
    'api_key',
    'secret',
    'authorization',
    'creditCard',
    'credit_card',
    'ssn',
    'cvv',
    'pin',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
    // Payment-related fields
    'stripeToken',
    'stripe_token',
    'paymentToken',
    'payment_token',
    'webhookSecret',
    'webhook_secret',
    'clientSecret',
    'client_secret',
    // OAuth fields
    'refreshToken',
    'refresh_token',
    'accessToken',
    'access_token',
    // Additional auth fields
    'privateKey',
    'private_key',
    'sessionId',
    'session_id'
  ];

  const record = data as Record<string, unknown>;
  const sanitized = { ...record };
  const sensitiveSet = new Set(sensitiveFields.map((f) => f.toLowerCase()));

  for (const key of Object.keys(sanitized)) {
    if (sensitiveSet.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

export const errorHandler = (
  error: ApiError,
  req: LoggingRequest,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let code = error.code || 'INTERNAL_ERROR';
  let details: Record<string, unknown> | undefined;

  // Typed AppError instances carry their own status + code — honor them
  // before the legacy string-matching branches so they're not clobbered
  // by a message that happens to contain "CHECK" or similar.
  if (isAppError(error)) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  }

  // Use request logger if available, otherwise use global logger
  const requestLogger = req.logger || logger;

  // Log the error with full context
  requestLogger.logError(error, {
    category: 'API_ERROR',
    metadata: {
      method: req.method,
      path: req.path,
      statusCode,
      code,
      body: sanitizeRequestData(req.body),
      params: req.params,
      query: req.query,
      headers: sanitizeRequestData(req.headers)
    },
    requestId: req.id,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Handle specific error types (skip the string-match branches if we
  // already classified the error as an AppError above).
  if (isAppError(error)) {
    // already set above
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
    code = 'INVALID_FORMAT';
  } else if (error.message.includes('UNIQUE constraint failed')) {
    statusCode = 409;
    message = 'Resource already exists';
    code = 'DUPLICATE_RESOURCE';
  } else if (error.message.includes('FOREIGN KEY constraint failed')) {
    statusCode = 400;
    message = 'Invalid reference';
    code = 'INVALID_REFERENCE';
  } else if (error.message.includes('CHECK constraint failed')) {
    statusCode = 400;
    message = 'Data validation failed';
    code = 'CHECK_CONSTRAINT_FAILED';
  } else if (error.message.includes('INDEX constraint failed')) {
    statusCode = 409;
    message = 'Resource conflicts with existing data';
    code = 'INDEX_CONSTRAINT_FAILED';
  } else if (error.message.includes('COLLATE constraint failed') || error.message.includes('collation')) {
    statusCode = 400;
    message = 'Invalid text encoding or collation';
    code = 'COLLATION_ERROR';
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
    code = 'INTERNAL_ERROR';
  }

  res.status(statusCode).json({
    error: message,
    code,
    timestamp: new Date().toISOString(),
    ...(details ? { details } : {}),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
