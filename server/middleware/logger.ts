/**
 * ===============================================
 * REQUEST LOGGING MIDDLEWARE
 * ===============================================
 * Logs incoming HTTP requests with method, path,
 * status code, and response time for monitoring.
 */

import { Request, Response, NextFunction } from 'express';
import { logger as loggerService } from '../services/logger.js';

/** Paths excluded from request logging */
const SKIP_PATHS = ['/api/health', '/health', '/favicon.ico'];

/** Fields redacted from logged request bodies */
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key'];

/** Status code threshold for warning-level logs */
const WARN_STATUS_THRESHOLD = 400;

/**
 * Remove sensitive data from logged request bodies
 */
const sanitizeBody = (body: Record<string, unknown>): Record<string, unknown> => {
  const sanitized = { ...body };

  for (const field of SENSITIVE_FIELDS) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
};

/**
 * Check whether the request path should be excluded from logging
 */
const shouldSkip = (requestPath: string): boolean =>
  SKIP_PATHS.some((skip) => requestPath.includes(skip));

/**
 * Express middleware that logs each HTTP request on completion.
 *
 * Captures method, path, status code, and response time using the
 * `res.on('finish')` event so every response type is logged.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  if (shouldSkip(req.path)) {
    return next();
  }

  const startTime = Date.now();

  // Log the incoming request
  const hasBody = req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0;
  loggerService.info(`--> ${req.method} ${req.path}`, {
    category: 'HTTP',
    metadata: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      ...(hasBody && { body: sanitizeBody(req.body as Record<string, unknown>) })
    }
  });

  // Log the response when it finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logMethod = res.statusCode >= WARN_STATUS_THRESHOLD ? 'warn' : 'info';

    loggerService[logMethod](
      `<-- ${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
      {
        category: 'HTTP',
        metadata: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseTimeMs: duration
        }
      }
    );
  });

  next();
};

export { requestLogger as logger };
