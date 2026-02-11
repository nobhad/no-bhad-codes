/**
 * ===============================================
 * SECURITY MIDDLEWARE
 * ===============================================
 * @file server/middleware/security.ts
 *
 * Security middleware for rate limiting, CSRF protection,
 * and other security measures.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.js';
import { errorResponse, errorResponseWithPayload } from '../utils/api-response.js';

// Rate limiting store
interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked?: boolean;
  blockExpiry?: number;
}

class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (
        entry.resetTime < now &&
        (!entry.blocked || (entry.blockExpiry && entry.blockExpiry < now))
      ) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

const rateLimitStore = new RateLimitStore();

/**
 * Rate limiting middleware
 */
export function rateLimit(
  options: {
    windowMs?: number;
    maxRequests?: number;
    blockDuration?: number;
    keyGenerator?: (req: Request) => string;
    skipIf?: (req: Request) => boolean;
    message?: string;
    onLimitReached?: (req: Request, entry: RateLimitEntry) => void;
  } = {}
) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    blockDuration = 60 * 60 * 1000, // 1 hour
    keyGenerator = (req) => req.ip || 'unknown',
    skipIf = () => false,
    message = 'Too many requests',
    onLimitReached
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (skipIf(req)) {
        return next();
      }

      const key = keyGenerator(req);
      const now = Date.now();
      const entry = rateLimitStore.get(key);

      // Check if IP is blocked
      if (entry?.blocked && entry.blockExpiry && entry.blockExpiry > now) {
        const remainingTime = Math.ceil((entry.blockExpiry - now) / 1000);

        await logger.logSecurity(
          'rate_limit_blocked',
          {
            ip: req.ip,
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent'),
            remainingBlockTime: remainingTime
          },
          req
        );

        return errorResponseWithPayload(
          res,
          'IP blocked due to too many requests',
          429,
          'RATE_LIMIT_BLOCKED',
          { retryAfter: remainingTime }
        );
      }

      let currentEntry: RateLimitEntry;

      if (!entry || entry.resetTime <= now) {
        // Create new window
        currentEntry = {
          count: 1,
          resetTime: now + windowMs
        };
      } else {
        // Increment existing window
        currentEntry = {
          ...entry,
          count: entry.count + 1
        };
      }

      rateLimitStore.set(key, currentEntry);

      // Set response headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, maxRequests - currentEntry.count).toString(),
        'X-RateLimit-Reset': new Date(currentEntry.resetTime).toISOString()
      });

      if (currentEntry.count > maxRequests) {
        // Block IP for specified duration
        currentEntry.blocked = true;
        currentEntry.blockExpiry = now + blockDuration;
        rateLimitStore.set(key, currentEntry);

        await logger.logSecurity(
          'rate_limit_exceeded',
          {
            ip: req.ip,
            path: req.path,
            method: req.method,
            requestCount: currentEntry.count,
            maxRequests,
            blockDuration: blockDuration / 1000,
            userAgent: req.get('User-Agent')
          },
          req
        );

        if (onLimitReached) {
          onLimitReached(req, currentEntry);
        }

        return errorResponseWithPayload(
          res,
          message,
          429,
          'RATE_LIMIT_EXCEEDED',
          { retryAfter: Math.ceil(blockDuration / 1000) }
        );
      }

      next();
    } catch (_error) {
      await logger.error('Rate limit middleware error');

      // On error, allow request through but log it
      next();
    }
  };
}

/**
 * CSRF protection middleware
 */
export function csrfProtection(
  options: {
    headerName?: string;
    cookieName?: string;
    skipIf?: (req: Request) => boolean;
  } = {}
) {
  const { headerName = 'x-csrf-token', cookieName = 'csrf-token', skipIf = () => false } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (skipIf(req)) {
        return next();
      }

      // Skip CSRF for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      const token = req.get(headerName) || req.body._csrf;
      const cookieToken = req.cookies?.[cookieName];

      if (!token || !cookieToken || token !== cookieToken) {
        await logger.logSecurity(
          'csrf_token_mismatch',
          {
            ip: req.ip,
            path: req.path,
            method: req.method,
            hasHeaderToken: !!token,
            hasCookieToken: !!cookieToken,
            userAgent: req.get('User-Agent')
          },
          req
        );

        return errorResponse(res, 'Invalid CSRF token', 403, 'CSRF_TOKEN_INVALID');
      }

      next();
    } catch (_error) {
      await logger.error('CSRF protection middleware error');

      errorResponse(res, 'CSRF protection error', 500, 'CSRF_SYSTEM_ERROR');
    }
  };
}

/**
 * IP whitelist/blacklist middleware
 */
export function ipFilter(
  options: {
    whitelist?: string[];
    blacklist?: string[];
    trustProxy?: boolean;
  } = {}
) {
  const { whitelist, blacklist, trustProxy = true } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = trustProxy ? req.ip || req.connection.remoteAddress : req.connection.remoteAddress;

      if (!ip) {
        await logger.logSecurity(
          'ip_filter_no_ip',
          {
            path: req.path,
            method: req.method,
            headers: req.headers
          },
          req
        );

        return errorResponse(res, 'Unable to determine IP address', 400, 'IP_UNKNOWN');
      }

      // Check blacklist first
      if (blacklist && blacklist.includes(ip)) {
        await logger.logSecurity(
          'ip_blacklisted',
          {
            ip,
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent')
          },
          req
        );

        return errorResponse(res, 'Access denied', 403, 'IP_BLACKLISTED');
      }

      // Check whitelist if specified
      if (whitelist && whitelist.length > 0 && !whitelist.includes(ip)) {
        await logger.logSecurity(
          'ip_not_whitelisted',
          {
            ip,
            path: req.path,
            method: req.method,
            whitelist: whitelist.length,
            userAgent: req.get('User-Agent')
          },
          req
        );

        return errorResponse(res, 'Access denied', 403, 'IP_NOT_WHITELISTED');
      }

      next();
    } catch (_error) {
      await logger.error('IP filter middleware error');

      next(); // Allow through on error
    }
  };
}

/**
 * Request size limiting middleware
 */
export function requestSizeLimit(
  options: {
    maxBodySize?: number;
    maxUrlLength?: number;
    maxHeaderSize?: number;
  } = {}
) {
  const {
    maxBodySize = 10 * 1024 * 1024, // 10MB
    maxUrlLength = 2048,
    maxHeaderSize = 8192
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check URL length
      if (req.url.length > maxUrlLength) {
        await logger.logSecurity(
          'url_too_long',
          {
            ip: req.ip,
            urlLength: req.url.length,
            maxUrlLength,
            path: req.path,
            method: req.method
          },
          req
        );

        return errorResponse(res, 'URL too long', 414, 'URL_TOO_LONG');
      }

      // Check header size
      const headerSize = JSON.stringify(req.headers).length;
      if (headerSize > maxHeaderSize) {
        await logger.logSecurity(
          'headers_too_large',
          {
            ip: req.ip,
            headerSize,
            maxHeaderSize,
            path: req.path,
            method: req.method
          },
          req
        );

        return errorResponse(res, 'Request headers too large', 431, 'HEADERS_TOO_LARGE');
      }

      // Body size is typically handled by express.json() limit option
      // but we can add additional checking here
      const contentLength = req.get('Content-Length');
      if (contentLength && parseInt(contentLength) > maxBodySize) {
        await logger.logSecurity(
          'body_too_large',
          {
            ip: req.ip,
            contentLength: parseInt(contentLength),
            maxBodySize,
            path: req.path,
            method: req.method
          },
          req
        );

        return errorResponse(res, 'Request body too large', 413, 'BODY_TOO_LARGE');
      }

      next();
    } catch (_error) {
      await logger.error('Request size limit middleware error');

      next();
    }
  };
}

/**
 * Suspicious activity detection middleware
 */
export function suspiciousActivityDetector(
  options: {
    maxPathTraversal?: number;
    maxSqlInjectionAttempts?: number;
    maxXssAttempts?: number;
    blockDuration?: number;
  } = {}
) {
  const {
    maxPathTraversal = 3,
    maxSqlInjectionAttempts = 3,
    maxXssAttempts = 3,
    blockDuration = 24 * 60 * 60 * 1000 // 24 hours
  } = options;

  const suspiciousActivity = new Map<
    string,
    {
      pathTraversal: number;
      sqlInjection: number;
      xssAttempts: number;
      lastActivity: number;
      blocked?: boolean;
      blockExpiry?: number;
    }
  >();

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = req.ip || 'unknown';
      const now = Date.now();
      const activity = suspiciousActivity.get(ip) || {
        pathTraversal: 0,
        sqlInjection: 0,
        xssAttempts: 0,
        lastActivity: now
      };

      // Check if IP is blocked
      if (activity.blocked && activity.blockExpiry && activity.blockExpiry > now) {
        await logger.logSecurity(
          'suspicious_activity_blocked',
          {
            ip,
            path: req.path,
            method: req.method,
            blockExpiry: activity.blockExpiry
          },
          req
        );

        return errorResponse(res, 'Access denied due to suspicious activity', 403, 'SUSPICIOUS_ACTIVITY_BLOCKED');
      }

      let suspicious = false;
      const fullUrl = req.url;
      const body = req.body ? JSON.stringify(req.body) : '';

      // Check for path traversal
      if (fullUrl.includes('../') || fullUrl.includes('..\\')) {
        activity.pathTraversal++;
        suspicious = true;

        await logger.logSecurity(
          'path_traversal_attempt',
          {
            ip,
            path: req.path,
            fullUrl,
            attempts: activity.pathTraversal
          },
          req
        );
      }

      // Check for SQL injection patterns
      const sqlPatterns = [
        /(\b(select|insert|update|delete|drop|union|exec)\b)/gi,
        /('|(\\')|(;)|(--)|(\|\|))/g,
        /(script|javascript|vbscript|onload|onerror)/gi
      ];

      if (sqlPatterns.some((pattern) => pattern.test(fullUrl) || pattern.test(body))) {
        activity.sqlInjection++;
        suspicious = true;

        await logger.logSecurity(
          'sql_injection_attempt',
          {
            ip,
            path: req.path,
            attempts: activity.sqlInjection
          },
          req
        );
      }

      // Check for XSS patterns
      const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /<iframe/gi,
        /onerror\s*=/gi,
        /onload\s*=/gi
      ];

      if (xssPatterns.some((pattern) => pattern.test(fullUrl) || pattern.test(body))) {
        activity.xssAttempts++;
        suspicious = true;

        await logger.logSecurity(
          'xss_attempt',
          {
            ip,
            path: req.path,
            attempts: activity.xssAttempts
          },
          req
        );
      }

      if (suspicious) {
        activity.lastActivity = now;
        suspiciousActivity.set(ip, activity);

        // Check if we should block this IP
        if (
          activity.pathTraversal >= maxPathTraversal ||
          activity.sqlInjection >= maxSqlInjectionAttempts ||
          activity.xssAttempts >= maxXssAttempts
        ) {
          activity.blocked = true;
          activity.blockExpiry = now + blockDuration;
          suspiciousActivity.set(ip, activity);

          await logger.logSecurity(
            'suspicious_activity_ip_blocked',
            {
              ip,
              pathTraversal: activity.pathTraversal,
              sqlInjection: activity.sqlInjection,
              xssAttempts: activity.xssAttempts,
              blockDuration: blockDuration / 1000
            },
            req
          );

          return errorResponse(res, 'Access denied due to suspicious activity', 403, 'SUSPICIOUS_ACTIVITY_DETECTED');
        }
      }

      next();
    } catch (_error) {
      await logger.error('Suspicious activity detector error');

      next();
    }
  };
}

/**
 * Request fingerprinting middleware
 */
export function requestFingerprint(req: Request, res: Response, next: NextFunction) {
  try {
    const fingerprint = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      acceptLanguage: req.get('Accept-Language'),
      acceptEncoding: req.get('Accept-Encoding'),
      connection: req.get('Connection'),
      timestamp: Date.now()
    };

    // Add fingerprint to request for use by other middleware
    (req as any).fingerprint = fingerprint;

    next();
  } catch (_error) {
    // Don't block request on fingerprinting error
    next();
  }
}

// Export cleanup function for graceful shutdown
export function cleanupSecurityMiddleware() {
  rateLimitStore.destroy();
}
