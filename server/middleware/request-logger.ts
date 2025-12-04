/**
 * ===============================================
 * REQUEST LOGGING MIDDLEWARE
 * ===============================================
 * @file server/middleware/request-logger.ts
 *
 * Express middleware for logging HTTP requests
 * using the centralized logging service.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.js';
import { randomUUID } from 'crypto';

/**
 * Extended request interface with logging context
 */
export interface LoggingRequest extends Request {
  id: string;
  startTime: number;
  logger: typeof logger;
}

/**
 * Request logging middleware
 * Adds request ID, timing, and comprehensive logging
 */
export function requestLogger() {
  return (req: LoggingRequest, res: Response, next: NextFunction): void => {
    // Add unique request ID
    req.id = randomUUID();
    req.startTime = Date.now();

    // Create child logger with request context
    req.logger = logger.child({
      requestId: req.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Log incoming request
    req.logger.info(`Incoming ${req.method} ${req.url}`, {
      category: 'HTTP',
      metadata: {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        contentLength: req.get('content-length'),
        contentType: req.get('content-type'),
      },
    });

    // Capture response finish event
    res.on('finish', () => {
      const duration = Date.now() - req.startTime;

      // Log completed request
      logger.logRequest(req, res, duration);

      // Log slow requests
      if (duration > 1000) {
        req.logger.warn(`Slow request detected: ${duration}ms`, {
          category: 'PERFORMANCE',
          metadata: {
            duration,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
          },
        });
      }
    });

    // Capture response error event
    res.on('error', (error: Error) => {
      req.logger.logError(error, {
        category: 'HTTP_ERROR',
        requestId: req.id,
      });
    });

    next();
  };
}

/**
 * Error logging middleware
 * Catches and logs application errors
 */
export function errorLogger() {
  return (error: Error, req: LoggingRequest, res: Response, next: NextFunction): void => {
    // Log the error with full context
    req.logger.logError(error, {
      category: 'APPLICATION_ERROR',
      metadata: {
        method: req.method,
        url: req.url,
        body: req.body,
        params: req.params,
        query: req.query,
        statusCode: res.statusCode,
      },
    });

    // Pass error to next error handler
    next(error);
  };
}

/**
 * Security event logging middleware
 */
export function securityLogger() {
  return (req: LoggingRequest, res: Response, next: NextFunction): void => {
    // Log authentication attempts
    if (req.url.includes('/auth/login')) {
      req.logger.info('Authentication attempt', {
        category: 'SECURITY',
        metadata: {
          ip: req.ip,
          userAgent: req.get('user-agent'),
          email: req.body?.email,
        },
      });
    }

    // Log failed authentication
    res.on('finish', () => {
      if (req.url.includes('/auth/login') && res.statusCode === 401) {
        req.logger.logSecurity('Failed login attempt', {
          ip: req.ip,
          email: req.body?.email,
          statusCode: res.statusCode,
        });
      }

      // Log suspicious activities
      if (res.statusCode === 429) {
        req.logger.logSecurity('Rate limit exceeded', {
          ip: req.ip,
          url: req.url,
          method: req.method,
        });
      }
    });

    next();
  };
}
