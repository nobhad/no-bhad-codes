/**
 * ===============================================
 * CACHE MIDDLEWARE
 * ===============================================
 * @file server/middleware/cache.ts
 *
 * Express middleware for HTTP response caching with Redis
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { cacheService } from '../services/cache-service.js';

export interface CacheMiddlewareOptions {
  ttl?: number; // Time to live in seconds
  keyGenerator?: (req: Request) => string; // Custom cache key generator
  skipCache?: (req: Request, res: Response) => boolean; // Condition to skip caching
  tags?: string[] | ((req: Request) => string[]); // Cache tags for invalidation
  varyBy?: string[]; // Headers to include in cache key
  onlySuccessfulResponses?: boolean; // Only cache 2xx responses
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request, varyBy: string[] = []): string {
  const baseKey = `route:${req.method}:${req.originalUrl || req.url}`;

  // Add query parameters
  const query = Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : '';

  // Add specific headers if specified
  const headers = varyBy.reduce(
    (acc, header) => {
      const value = req.get(header);
      if (value) acc[header] = value;
      return acc;
    },
    {} as Record<string, string>
  );

  const headersString = Object.keys(headers).length > 0 ? JSON.stringify(headers) : '';

  // Add user context for authenticated requests
  const userContext = (req as any).user ? `user:${(req as any).user.id}` : '';

  const fullKey = `${baseKey}:${query}:${headersString}:${userContext}`;

  // Hash long keys to keep them manageable
  if (fullKey.length > 200) {
    return `route:${crypto.createHash('md5').update(fullKey).digest('hex')}`;
  }

  return fullKey;
}

/**
 * Cache middleware factory
 */
export function cache(
  options: CacheMiddlewareOptions = {}
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator,
    skipCache,
    tags,
    varyBy = [],
    onlySuccessfulResponses = true
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip caching for non-GET requests by default
    if (req.method !== 'GET') {
      return next();
    }

    // Check if we should skip caching for this request
    if (skipCache && skipCache(req, res)) {
      return next();
    }

    // Skip if cache service is not available
    if (!cacheService.isAvailable()) {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator ? keyGenerator(req) : generateCacheKey(req, varyBy);

    try {
      // Try to get cached response
      const cached = await cacheService.get(cacheKey);

      if (cached && typeof cached === 'object' && cached.body && cached.headers) {
        console.log(`📋 Cache HIT: ${cacheKey}`);

        // Set cached headers
        Object.entries(cached.headers as Record<string, string>).forEach(([key, value]) => {
          res.set(key, value);
        });

        // Add cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);

        res.status(cached.status || 200).json(cached.body);
        return;
      }

      console.log(`📋 Cache MISS: ${cacheKey}`);
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);

      // Intercept response
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      let responseBody: any;
      let responseSent = false;

      // Override res.json
      res.json = function (body: any) {
        if (!responseSent) {
          responseBody = body;
          responseSent = true;

          // Cache the response asynchronously
          setImmediate(() => {
            cacheResponse(
              cacheKey,
              {
                status: res.statusCode,
                headers: getResponseHeaders(res),
                body
              },
              ttl,
              tags,
              req
            ).catch((error) => {
              console.error('Error caching response:', error);
            });
          });
        }

        return originalJson(body);
      };

      // Override res.send
      res.send = function (body: any) {
        if (!responseSent) {
          responseBody = body;
          responseSent = true;

          // Cache the response asynchronously
          setImmediate(() => {
            cacheResponse(
              cacheKey,
              {
                status: res.statusCode,
                headers: getResponseHeaders(res),
                body
              },
              ttl,
              tags,
              req
            ).catch((error) => {
              console.error('Error caching response:', error);
            });
          });
        }

        return originalSend(body);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      // Continue without caching on error
      next();
    }
  };
}

/**
 * Cache the response
 */
async function cacheResponse(
  key: string,
  response: { status: number; headers: Record<string, string>; body: any },
  ttl: number,
  tags: string[] | ((req: Request) => string[]) | undefined,
  req: Request
): Promise<void> {
  const { status, headers, body } = response;

  // Only cache successful responses if specified
  if (status >= 200 && status < 300) {
    const cacheTags = typeof tags === 'function' ? tags(req) : tags;

    await cacheService.set(
      key,
      {
        status,
        headers,
        body
      },
      {
        ttl,
        tags: cacheTags
      }
    );

    console.log(`📋 Cached response: ${key} (TTL: ${ttl}s)`);
  }
}

/**
 * Get response headers to cache
 */
function getResponseHeaders(res: Response): Record<string, string> {
  const headers: Record<string, string> = {};

  // Only cache specific headers that are safe to cache
  const cacheableHeaders = [
    'content-type',
    'content-encoding',
    'cache-control',
    'expires',
    'last-modified',
    'etag'
  ];

  cacheableHeaders.forEach((header) => {
    const value = res.get(header);
    if (value) {
      headers[header] = value;
    }
  });

  return headers;
}

/**
 * Invalidate cache by tag middleware
 */
export function invalidateCache(
  tags: string | string[]
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store tags to invalidate after successful response
    (req as any).cacheInvalidateTags = Array.isArray(tags) ? tags : [tags];

    // Intercept successful responses
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    const invalidateTags = async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const tagsToInvalidate = (req as any).cacheInvalidateTags as string[];

        for (const tag of tagsToInvalidate) {
          try {
            const count = await cacheService.invalidateByTag(tag);
            console.log(`🗑️  Invalidated ${count} cached entries for tag: ${tag}`);
          } catch (error) {
            console.error(`Error invalidating cache tag ${tag}:`, error);
          }
        }
      }
    };

    res.json = function (body: any) {
      setImmediate(invalidateTags);
      return originalJson(body);
    };

    res.send = function (body: any) {
      setImmediate(invalidateTags);
      return originalSend(body);
    };

    next();
  };
}

/**
 * Database query caching helper
 */
export class QueryCache {
  /**
   * Cache database query result
   */
  static async getOrSet<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    options: {
      ttl?: number;
      tags?: string[];
    } = {}
  ): Promise<T> {
    const { ttl = 600, tags = [] } = options; // 10 minutes default

    return await cacheService.getOrSet(`query:${queryKey}`, queryFn, { ttl, tags });
  }

  /**
   * Invalidate query cache by tags
   */
  static async invalidate(tags: string | string[]): Promise<void> {
    const tagArray = Array.isArray(tags) ? tags : [tags];

    for (const tag of tagArray) {
      await cacheService.invalidateByTag(tag);
    }
  }

  /**
   * Generate consistent cache key for database queries
   */
  static generateKey(
    table: string,
    conditions: Record<string, any> = {},
    suffix: string = ''
  ): string {
    const conditionsStr =
      Object.keys(conditions).length > 0
        ? crypto.createHash('md5').update(JSON.stringify(conditions)).digest('hex')
        : 'all';

    return `${table}:${conditionsStr}${suffix ? `:${suffix}` : ''}`;
  }
}

export default cache;
