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

// Rate limit configuration
export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  blockDurationMs: number; // How long to block after exceeding limit
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

// Default configurations for different endpoint types
export const RATE_LIMIT_PRESETS = {
  // Strict limit for public form submissions
  publicForm: {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 5,             // 5 requests per minute
    blockDurationMs: 5 * 60 * 1000  // Block for 5 minutes
  },
  // Standard API limit
  standard: {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 60,            // 60 requests per minute
    blockDurationMs: 60 * 1000  // Block for 1 minute
  },
  // Relaxed limit for authenticated users
  authenticated: {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 120,           // 120 requests per minute
    blockDurationMs: 30 * 1000  // Block for 30 seconds
  },
  // Very strict for sensitive operations
  sensitive: {
    windowMs: 60 * 60 * 1000,   // 1 hour
    maxRequests: 10,            // 10 requests per hour
    blockDurationMs: 60 * 60 * 1000  // Block for 1 hour
  }
};

// In-memory cache for rate limiting (faster than DB)
const rateLimitCache = new Map<string, {
  count: number;
  windowStart: number;
  blockedUntil?: number;
}>();

// Cleanup old entries periodically
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitCache.entries()) {
    // Remove entries older than 1 hour
    if (now - data.windowStart > 60 * 60 * 1000) {
      rateLimitCache.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Get client IP address from request
 */
function getClientIP(req: Request): string {
  // Check for forwarded headers (common with proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    return ips[0].trim();
  }

  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return typeof realIP === 'string' ? realIP : realIP[0];
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
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
    console.error('Failed to log rate limit event:', error);
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
  };
}

/**
 * Pre-configured rate limiters
 */
export const rateLimiters = {
  publicForm: createRateLimiter(RATE_LIMIT_PRESETS.publicForm),
  standard: createRateLimiter(RATE_LIMIT_PRESETS.standard),
  authenticated: createRateLimiter(RATE_LIMIT_PRESETS.authenticated),
  sensitive: createRateLimiter(RATE_LIMIT_PRESETS.sensitive)
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

  await db.run(
    `UPDATE blocked_ips SET is_active = 0 WHERE ip_address = ?`,
    [ip]
  );

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
      `SELECT COUNT(*) as count FROM rate_limit_log WHERE created_at > datetime('now', '-24 hours')`
    ) as Promise<{ count: number } | undefined>,
    db.get(
      `SELECT COUNT(*) as count FROM rate_limit_log WHERE is_blocked = 1 AND created_at > datetime('now', '-24 hours')`
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

export default {
  createRateLimiter,
  rateLimiters,
  blockIP,
  unblockIP,
  getRateLimitStats,
  RATE_LIMIT_PRESETS
};
