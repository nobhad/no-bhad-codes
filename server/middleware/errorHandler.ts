/**
 * ===============================================
 * ERROR HANDLING MIDDLEWARE
 * ===============================================
 * Centralized error handling for the Express app
 * with integrated logging service.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.js';

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
function sanitizeRequestData(data: any): any {
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
    'x-access-token'
  ];

  const sanitized = { ...data };
  const sensitiveSet = new Set(sensitiveFields.map(f => f.toLowerCase()));

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

  // Handle specific error types
  if (error.name === 'ValidationError') {
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
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
