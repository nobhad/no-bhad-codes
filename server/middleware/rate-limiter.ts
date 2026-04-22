/**
 * ===============================================
 * RATE LIMITING MIDDLEWARE
 * ===============================================
 * @file server/middleware/rate-limiter.ts
 *
 * Provides rate limiting for API endpoints to prevent
 * abuse and ensure fair usage.
 */

import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../database/init.js';
import { errorResponseWithPayload } from '../utils/api-response.js';
import { logger } from '../services/logger.js';
import type { JWTAuthRequest } from '../types/request.js';

// Rate limit configuration
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  blockDurationMs: number; // How long to block after exceeding limit
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

// Default configurations for different endpoint types
export const RATE_LIMIT_PRESETS = {
  // Strict limit for public form submissions (anti-spam)
  // Intentionally low to prevent bot spam while allowing legitimate users
  // 10 req/min is enough for form submissions with retries
  publicForm: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute (relaxed from 5)
    blockDurationMs: 5 * 60 * 1000 // Block for 5 minutes
  },
  // Standard API limit
  standard: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    blockDurationMs: 60 * 1000 // Block for 1 minute
  },
  // Relaxed limit for authenticated users
  authenticated: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120, // 120 requests per minute
    blockDurationMs: 30 * 1000 // Block for 30 seconds
  },
  // Very strict for sensitive operations
  sensitive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 requests per hour
    blockDurationMs: 60 * 60 * 1000 // Block for 1 hour
  },
  // Per-user rate limit for authenticated routes (keyed by user ID)
  authenticatedPerUser: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120, // 120 requests per minute per user
    blockDurationMs: 30 * 1000, // Block for 30 seconds
    keyGenerator: userKeyGenerator
  },
  // Strict per-user limit for sensitive authenticated operations
  sensitivePerUser: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 requests per hour per user
    blockDurationMs: 60 * 60 * 1000, // Block for 1 hour
    keyGenerator: userKeyGenerator
  }
};

// In-memory cache for rate limiting (faster than DB)
const rateLimitCache = new Map<
  string,
  {
    count: number;
    windowStart: number;
    blockedUntil?: number;
  }
>();

// Cleanup old entries periodically
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitCache.entries()) {
    // Remove entries older than 5 minutes
    if (now - data.windowStart > 5 * 60 * 1000) {
      rateLimitCache.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Get client IP address from request.
 *
 * Uses req.ip, which is populated by Express using the trust-proxy
 * setting (`app.set('trust proxy', 1)` in server/app.ts). That makes
 * the read:
 *   - correct behind our one known proxy (returns the real client IP)
 *   - resistant to X-Forwarded-For spoofing from untrusted clients
 *     (Express parses the header from the right based on the hop count)
 *
 * Previously this function read x-forwarded-for directly and took the
 * leftmost entry, which a client could set themselves to shift their
 * rate-limit bucket — collapsing all rate limits to ineffective.
 */
function getClientIP(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Key generator that uses authenticated user ID when available,
 * falling back to client IP for unauthenticated requests.
 * Keys are scoped to the request path.
 */
export function userKeyGenerator(req: Request): string {
  const authReq = req as JWTAuthRequest;
  const identifier = authReq.user?.id
    ? `user:${authReq.user.id}`
    : `ip:${getClientIP(req)}`;
  return `${identifier}:${req.path}`;
}

/**
 * Key generator that rate limits by user ID AND IP together.
 * Useful when you want to prevent both account-level and IP-level abuse.
 */
export function combinedKeyGenerator(req: Request): string {
  const authReq = req as JWTAuthRequest;
  const ip = getClientIP(req);
  const userId = authReq.user?.id;
  return userId
    ? `user:${userId}+ip:${ip}:${req.path}`
    : `ip:${ip}:${req.path}`;
}

/**
 * Check if IP is permanently blocked
 */
async function isIPBlocked(ip: string): Promise<boolean> {
  try {
    const db = getDatabase();
    const blocked = await db.get(
      `SELECT id FROM blocked_ips
       WHERE ip_address = ? AND is_active = 1
       AND (expires_at IS NULL OR expires_at > datetime('now'))`,
      [ip]
    );
    return Boolean(blocked);
  } catch {
    // If DB fails, don't block (fail open for availability)
    return false;
  }
}

/**
 * Log rate limit event to database
 */
async function logRateLimitEvent(
  ip: string,
  endpoint: string,
  requestCount: number,
  isBlocked: boolean,
  blockedUntil?: Date
): Promise<void> {
  try {
    const db = getDatabase();
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60000); // 1 minute ago

    await db.run(
      `INSERT INTO rate_limit_log (ip_address, endpoint, request_count, window_start, window_end, is_blocked, blocked_until, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        ip,
        endpoint,
        requestCount,
        windowStart.toISOString(),
        now.toISOString(),
        isBlocked ? 1 : 0,
        blockedUntil?.toISOString() || null
      ]
    );
  } catch (error) {
    logger.error('Failed to log rate limit event', {
      error: error instanceof Error ? error : undefined
    });
  }
}

/**
 * Create rate limiting middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    blockDurationMs,
    keyGenerator = (req) => `${getClientIP(req)}:${req.path}`
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = getClientIP(req);
      const key = keyGenerator(req);
      const now = Date.now();

      // Check if IP is permanently blocked
      if (await isIPBlocked(ip)) {
        errorResponseWithPayload(res, 'Access denied', 403, 'IP_BLOCKED', {
          message: 'Your IP address has been blocked'
        });
        return;
      }

      // Get or create rate limit entry
      let entry = rateLimitCache.get(key);

      // Check if currently blocked
      if (entry?.blockedUntil && entry.blockedUntil > now) {
        const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil(entry.blockedUntil / 1000));

        errorResponseWithPayload(res, 'Too Many Requests', 429, 'RATE_LIMIT_EXCEEDED', {
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter
        });
        return;
      }

      // Reset window if expired
      if (!entry || now - entry.windowStart > windowMs) {
        entry = {
          count: 0,
          windowStart: now
        };
      }

      // Increment request count
      entry.count++;

      // Check if limit exceeded
      if (entry.count > maxRequests) {
        entry.blockedUntil = now + blockDurationMs;
        rateLimitCache.set(key, entry);

        const retryAfter = Math.ceil(blockDurationMs / 1000);
        res.setHeader('Retry-After', retryAfter);
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil(entry.blockedUntil / 1000));

        // Log the rate limit event
        await logRateLimitEvent(ip, req.path, entry.count, true, new Date(entry.blockedUntil));

        errorResponseWithPayload(res, 'Too Many Requests', 429, 'RATE_LIMIT_EXCEEDED', {
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter
        });
        return;
      }

      // Update cache
      rateLimitCache.set(key, entry);

      // Set rate limit headers
      const remaining = Math.max(0, maxRequests - entry.count);
      const resetTime = Math.ceil((entry.windowStart + windowMs) / 1000);

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime);

      next();
    } catch (_error) {
      // Rate limiting is security middleware - fail closed
      logger.error('Rate limiter middleware error', {
        error: _error instanceof Error ? _error : undefined
      });

      errorResponseWithPayload(res, 'Rate limiter error', 500, 'RATE_LIMIT_ERROR', {
        message: 'An internal error occurred'
      });
    }
  };
}

/**
 * Pre-configured rate limiters
 */
export const rateLimiters = {
  publicForm: createRateLimiter(RATE_LIMIT_PRESETS.publicForm),
  standard: createRateLimiter(RATE_LIMIT_PRESETS.standard),
  authenticated: createRateLimiter(RATE_LIMIT_PRESETS.authenticated),
  sensitive: createRateLimiter(RATE_LIMIT_PRESETS.sensitive),
  authenticatedPerUser: createRateLimiter(RATE_LIMIT_PRESETS.authenticatedPerUser),
  sensitivePerUser: createRateLimiter(RATE_LIMIT_PRESETS.sensitivePerUser)
};

/**
 * Block an IP address
 */
export async function blockIP(
  ip: string,
  reason: string,
  blockedBy: string = 'system',
  expiresAt?: Date
): Promise<void> {
  const db = getDatabase();

  await db.run(
    `INSERT OR REPLACE INTO blocked_ips (ip_address, reason, blocked_by, blocked_at, expires_at, is_active)
     VALUES (?, ?, ?, datetime('now'), ?, 1)`,
    [ip, reason, blockedBy, expiresAt?.toISOString() || null]
  );
}

/**
 * Unblock an IP address
 */
export async function unblockIP(ip: string): Promise<void> {
  const db = getDatabase();

  await db.run('UPDATE blocked_ips SET is_active = 0 WHERE ip_address = ?', [ip]);

  // Clear from cache
  for (const key of rateLimitCache.keys()) {
    if (key.startsWith(`${ip}:`)) {
      rateLimitCache.delete(key);
    }
  }
}

/**
 * Get rate limit statistics
 */
export async function getRateLimitStats(): Promise<{
  totalRequests24h: number;
  blockedRequests24h: number;
  topEndpoints: { endpoint: string; count: number }[];
  blockedIPs: { ip: string; reason: string; blockedAt: string }[];
}> {
  const db = getDatabase();

  const [totalResult, blockedResult, topEndpoints, blockedIPs] = await Promise.all([
    db.get(
      'SELECT COUNT(*) as count FROM rate_limit_log WHERE created_at > datetime(\'now\', \'-24 hours\')'
    ) as Promise<{ count: number } | undefined>,
    db.get(
      'SELECT COUNT(*) as count FROM rate_limit_log WHERE is_blocked = 1 AND created_at > datetime(\'now\', \'-24 hours\')'
    ) as Promise<{ count: number } | undefined>,
    db.all(
      `SELECT endpoint, SUM(request_count) as count
       FROM rate_limit_log
       WHERE created_at > datetime('now', '-24 hours')
       GROUP BY endpoint
       ORDER BY count DESC
       LIMIT 10`
    ) as Promise<{ endpoint: string; count: number }[]>,
    db.all(
      `SELECT ip_address as ip, reason, blocked_at as blockedAt
       FROM blocked_ips
       WHERE is_active = 1
       ORDER BY blocked_at DESC
       LIMIT 20`
    ) as Promise<{ ip: string; reason: string; blockedAt: string }[]>
  ]);

  return {
    totalRequests24h: totalResult?.count || 0,
    blockedRequests24h: blockedResult?.count || 0,
    topEndpoints: topEndpoints || [],
    blockedIPs: blockedIPs || []
  };
}
