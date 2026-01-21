/**
 * ===============================================
 * REDIS CACHING SERVICE
 * ===============================================
 * @file server/services/cache-service.ts
 *
 * Comprehensive Redis-based caching system with TTL, invalidation, and pattern matching
 */

import Redis from 'ioredis';
import { errorTracker } from './error-tracking.js';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for bulk invalidation
  compress?: boolean; // Compress large values
}

export interface CacheStats {
  connected: boolean;
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  memoryUsage?: string;
  keyCount?: number;
}

export class CacheService {
  private static instance: CacheService;
  private client: Redis | null = null;
  private isConnected = false;
  private stats: CacheStats = {
    connected: false,
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };
  private config: CacheConfig | null = null;

  private constructor() {}

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Initialize Redis connection
   */
  async init(config: CacheConfig): Promise<void> {
    try {
      this.config = config;

      // Create Redis client with configuration
      this.client = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db || 0,
        keyPrefix: config.keyPrefix || 'nbc:',
        maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
        lazyConnect: config.lazyConnect || true,
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          return err.message.includes(targetError);
        }
      });

      // Set up event listeners
      this.client.on('connect', () => {
        console.log('🔗 Redis connected');
        this.isConnected = true;
        this.stats.connected = true;
      });

      this.client.on('ready', () => {
        console.log('✅ Redis ready');
      });

      this.client.on('error', (error) => {
        console.error('❌ Redis error:', error);
        this.stats.errors++;
        this.isConnected = false;
        this.stats.connected = false;

        errorTracker.captureException(error, {
          tags: { component: 'redis-cache' },
          extra: { config: this.config }
        });
      });

      this.client.on('close', () => {
        console.log('🔴 Redis connection closed');
        this.isConnected = false;
        this.stats.connected = false;
      });

      // Test connection
      await this.client.connect();
      await this.client.ping();
      console.log('✅ Cache service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize cache service:', error);
      throw new Error(`Cache service initialization failed: ${error}`);
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) {
      console.warn('⚠️  Cache not available, skipping get');
      this.stats.misses++;
      return null;
    }

    try {
      const value = await this.client.get(key);

      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      this.stats.errors++;
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: string | number | boolean | object | null, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      console.warn('⚠️  Cache not available, skipping set');
      return false;
    }

    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      const ttl = options.ttl || 3600; // Default 1 hour

      await this.client.setex(key, ttl, serializedValue);

      // Store tags for bulk invalidation
      if (options.tags && options.tags.length > 0) {
        await this.storeTags(key, options.tags);
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.del(key);
      this.stats.deletes++;
      return result > 0;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Set expiration for existing key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      console.error(`Cache expire error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    if (!this.isConnected || !this.client || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const values = await this.client.mget(...keys);

      return values.map((value, _index) => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }

        this.stats.hits++;

        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      });
    } catch (error) {
      console.error('Cache mget error:', error);
      this.stats.errors++;
      this.stats.misses += keys.length;
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValuePairs: Record<string, any>, ttl: number = 3600): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const pipeline = this.client.pipeline();

      Object.entries(keyValuePairs).forEach(([key, value]) => {
        const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
        pipeline.setex(key, ttl, serializedValue);
      });

      await pipeline.exec();
      this.stats.sets += Object.keys(keyValuePairs).length;
      return true;
    } catch (error) {
      console.error('Cache mset error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Increment numeric value
   */
  async increment(key: string, amount: number = 1): Promise<number | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const result = await this.client.incrby(key, amount);
      return result;
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Store cache tags for bulk invalidation
   */
  private async storeTags(key: string, tags: string[]): Promise<void> {
    if (!this.client) return;

    try {
      const pipeline = this.client.pipeline();

      tags.forEach((tag) => {
        pipeline.sadd(`tag:${tag}`, key);
        pipeline.expire(`tag:${tag}`, 86400); // Tags expire in 24 hours
      });

      await pipeline.exec();
    } catch (error) {
      console.error('Error storing cache tags:', error);
    }
  }

  /**
   * Invalidate cache by tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const keys = await this.client.smembers(`tag:${tag}`);

      if (keys.length === 0) {
        return 0;
      }

      const pipeline = this.client.pipeline();
      keys.forEach((key) => pipeline.del(key));
      pipeline.del(`tag:${tag}`);

      await pipeline.exec();
      this.stats.deletes += keys.length;

      console.log(`🗑️  Invalidated ${keys.length} cache keys for tag: ${tag}`);
      return keys.length;
    } catch (error) {
      console.error(`Cache tag invalidation error for tag ${tag}:`, error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      await this.client.del(...keys);
      this.stats.deletes += keys.length;

      console.log(`🗑️  Invalidated ${keys.length} cache keys for pattern: ${pattern}`);
      return keys.length;
    } catch (error) {
      console.error(`Cache pattern invalidation error for pattern ${pattern}:`, error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.flushdb();
      console.log('🗑️  Cache cleared');
      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (!this.isConnected || !this.client) {
      return this.stats;
    }

    try {
      const info = await this.client.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.*?)\r/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : 'Unknown';

      const keyCount = await this.client.dbsize();

      return {
        ...this.stats,
        memoryUsage,
        keyCount
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return this.stats;
    }
  }

  /**
   * Test cache connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Cache connection test failed:', error);
      return false;
    }
  }

  /**
   * Close cache connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
      this.stats.connected = false;
      console.log('🔴 Cache service disconnected');
    }
  }

  /**
   * Get or set pattern (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // If not in cache, fetch from source
    try {
      const fresh = await fetcher();

      // Store in cache for next time
      await this.set(key, fresh as string | number | boolean | object | null, options);

      return fresh;
    } catch (error) {
      console.error(`Error in getOrSet for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();
