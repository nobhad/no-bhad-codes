/**
 * ===============================================
 * CACHE SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/cache-service.test.ts
 *
 * Unit tests for cache service.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CacheService } from '../../../server/services/cache-service';
import { errorTracker } from '../../../server/services/error-tracking';

// Create mock Redis client factory
const createMockRedisClient = () => {
  const pipeline = {
    setex: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([['OK', 'value']]),
  };

  return {
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    mget: vi.fn().mockResolvedValue([]),
    pipeline: vi.fn().mockReturnValue(pipeline),
    smembers: vi.fn().mockResolvedValue([]),
    keys: vi.fn().mockResolvedValue([]),
    flushdb: vi.fn().mockResolvedValue('OK'),
    info: vi.fn().mockResolvedValue('used_memory_human:1.00M\r\n'),
    dbsize: vi.fn().mockResolvedValue(100),
    incrby: vi.fn().mockResolvedValue(1),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };
};

// Create a shared mock client that will be returned by the constructor
let mockRedisClient = createMockRedisClient();

vi.mock('ioredis', () => {
  const MockRedis = vi.fn().mockImplementation(() => {
    return mockRedisClient;
  });
  return {
    default: MockRedis,
  };
});

// Mock error tracker
vi.mock('../../../server/services/error-tracking', () => ({
  errorTracker: {
    captureException: vi.fn(),
  },
}));

// Mock console methods
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Cache Service', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    // Reset mock Redis client before each test
    mockRedisClient = createMockRedisClient();
    vi.clearAllMocks();
    
    // Get fresh instance for each test
    cacheService = CacheService.getInstance();
    
    // Reset the instance's internal state
    (cacheService as any).client = null;
    (cacheService as any).isConnected = false;
    (cacheService as any).stats = {
      connected: false,
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  });

  afterEach(() => {
    consoleLogSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = CacheService.getInstance();
      const instance2 = CacheService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('init', () => {
    it('should initialize Redis connection', async () => {
      await cacheService.init({
        host: 'localhost',
        port: 6379,
      });

      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.ping).toHaveBeenCalled();
      expect(cacheService.isAvailable()).toBe(true);
    });

    it('should set up event listeners', async () => {
      await cacheService.init({
        host: 'localhost',
        port: 6379,
      });

      expect(mockRedisClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should handle initialization errors', async () => {
      mockRedisClient.connect.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(
        cacheService.init({
          host: 'localhost',
          port: 6379,
        })
      ).rejects.toThrow('Cache service initialization failed');
    });

    it('should use custom configuration', async () => {
      await cacheService.init({
        host: 'redis.example.com',
        port: 6380,
        password: 'secret',
        db: 1,
        keyPrefix: 'custom:',
      });

      expect(mockRedisClient.connect).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should return null when cache is not available', async () => {
      // Ensure cache is not initialized
      (cacheService as any).client = null;
      (cacheService as any).isConnected = false;
      
      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
      // Note: console.warn may not be called if the check happens before the warning
    });

    it('should return cached value', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ data: 'test' }));

      const result = await cacheService.get('test-key');

      expect(result).toEqual({ data: 'test' });
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null for non-existent key', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
    });

    it('should handle string values', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.get.mockResolvedValueOnce('plain-string');

      const result = await cacheService.get('test-key');

      expect(result).toBe('plain-string');
    });

    it('should handle get errors gracefully', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.get.mockRejectedValueOnce(new Error('Redis error'));

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    it('should return false when cache is not available', async () => {
      const result = await cacheService.set('test-key', 'value');
      expect(result).toBe(false);
    });

    it('should set value in cache', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });

      const result = await cacheService.set('test-key', { data: 'test' });

      expect(result).toBe(true);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-key',
        3600, // default TTL
        JSON.stringify({ data: 'test' })
      );
    });

    it('should use custom TTL', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });

      await cacheService.set('test-key', 'value', { ttl: 600 });

      expect(mockRedisClient.setex).toHaveBeenCalledWith('test-key', 600, 'value');
    });

    it('should store tags', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      const pipeline = mockRedisClient.pipeline();

      await cacheService.set('test-key', 'value', { tags: ['tag1', 'tag2'] });

      expect(pipeline.sadd).toHaveBeenCalledWith('tag:tag1', 'test-key');
      expect(pipeline.sadd).toHaveBeenCalledWith('tag:tag2', 'test-key');
    });

    it('should handle set errors gracefully', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.setex.mockRejectedValueOnce(new Error('Redis error'));

      const result = await cacheService.set('test-key', 'value');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should return false when cache is not available', async () => {
      const result = await cacheService.delete('test-key');
      expect(result).toBe(false);
    });

    it('should delete key from cache', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });

      const result = await cacheService.delete('test-key');

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
    });

    it('should handle delete errors gracefully', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.del.mockRejectedValueOnce(new Error('Redis error'));

      const result = await cacheService.delete('test-key');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return false when cache is not available', async () => {
      const result = await cacheService.exists('test-key');
      expect(result).toBe(false);
    });

    it('should check if key exists', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.exists.mockResolvedValueOnce(1);

      const result = await cacheService.exists('test-key');

      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('test-key');
    });

    it('should return false for non-existent key', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.exists.mockResolvedValueOnce(0);

      const result = await cacheService.exists('test-key');

      expect(result).toBe(false);
    });
  });

  describe('expire', () => {
    it('should return false when cache is not available', async () => {
      const result = await cacheService.expire('test-key', 60);
      expect(result).toBe(false);
    });

    it('should set expiration for key', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });

      const result = await cacheService.expire('test-key', 60);

      expect(result).toBe(true);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('test-key', 60);
    });
  });

  describe('mget', () => {
    it('should return array of nulls when cache is not available', async () => {
      const result = await cacheService.mget(['key1', 'key2']);
      expect(result).toEqual([null, null]);
    });

    it('should get multiple keys', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.mget.mockResolvedValueOnce([
        JSON.stringify({ data: 'value1' }),
        null,
        'plain-string',
      ]);

      const result = await cacheService.mget(['key1', 'key2', 'key3']);

      expect(result[0]).toEqual({ data: 'value1' });
      expect(result[1]).toBeNull();
      expect(result[2]).toBe('plain-string');
    });
  });

  describe('mset', () => {
    it('should return false when cache is not available', async () => {
      const result = await cacheService.mset({ key1: 'value1' });
      expect(result).toBe(false);
    });

    it('should set multiple key-value pairs', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      const pipeline = mockRedisClient.pipeline();

      const result = await cacheService.mset(
        { key1: 'value1', key2: { data: 'value2' } },
        600
      );

      expect(result).toBe(true);
      expect(pipeline.setex).toHaveBeenCalledWith('key1', 600, 'value1');
      expect(pipeline.setex).toHaveBeenCalledWith('key2', 600, JSON.stringify({ data: 'value2' }));
    });
  });

  describe('increment', () => {
    it('should return null when cache is not available', async () => {
      const result = await cacheService.increment('counter');
      expect(result).toBeNull();
    });

    it('should increment numeric value', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.incrby.mockResolvedValueOnce(5);

      const result = await cacheService.increment('counter', 3);

      expect(result).toBe(5);
      expect(mockRedisClient.incrby).toHaveBeenCalledWith('counter', 3);
    });

    it('should use default increment of 1', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.incrby.mockResolvedValueOnce(2);

      const result = await cacheService.increment('counter');

      expect(mockRedisClient.incrby).toHaveBeenCalledWith('counter', 1);
    });
  });

  describe('invalidateByTag', () => {
    it('should return 0 when cache is not available', async () => {
      const result = await cacheService.invalidateByTag('tag1');
      expect(result).toBe(0);
    });

    it('should invalidate keys by tag', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.smembers.mockResolvedValueOnce(['key1', 'key2', 'key3']);
      const pipeline = mockRedisClient.pipeline();

      const result = await cacheService.invalidateByTag('tag1');

      expect(result).toBe(3);
      expect(pipeline.del).toHaveBeenCalledTimes(4); // 3 keys + tag
    });

    it('should return 0 for non-existent tag', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.smembers.mockResolvedValueOnce([]);

      const result = await cacheService.invalidateByTag('tag1');

      expect(result).toBe(0);
    });
  });

  describe('invalidateByPattern', () => {
    it('should return 0 when cache is not available', async () => {
      const result = await cacheService.invalidateByPattern('pattern:*');
      expect(result).toBe(0);
    });

    it('should invalidate keys by pattern', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.keys.mockResolvedValueOnce(['key1', 'key2']);

      const result = await cacheService.invalidateByPattern('pattern:*');

      expect(result).toBe(2);
      expect(mockRedisClient.del).toHaveBeenCalledWith('key1', 'key2');
    });
  });

  describe('clear', () => {
    it('should return false when cache is not available', async () => {
      const result = await cacheService.clear();
      expect(result).toBe(false);
    });

    it('should clear all cache', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });

      const result = await cacheService.clear();

      expect(result).toBe(true);
      expect(mockRedisClient.flushdb).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return stats when cache is not available', async () => {
      const stats = await cacheService.getStats();
      expect(stats.connected).toBe(false);
    });

    it('should return cache statistics', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });

      const stats = await cacheService.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('sets');
      expect(stats).toHaveProperty('deletes');
      expect(stats).toHaveProperty('errors');
    });

    it('should include memory usage and key count', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });

      const stats = await cacheService.getStats();

      expect(stats.memoryUsage).toBeDefined();
      expect(stats.keyCount).toBe(100);
    });
  });

  describe('testConnection', () => {
    it('should return false when client is not initialized', async () => {
      const result = await cacheService.testConnection();
      expect(result).toBe(false);
    });

    it('should test connection successfully', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });

      const result = await cacheService.testConnection();

      expect(result).toBe(true);
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should return false on connection test failure', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.ping.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await cacheService.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });

      await cacheService.disconnect();

      expect(mockRedisClient.disconnect).toHaveBeenCalled();
      expect(cacheService.isAvailable()).toBe(false);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if available', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ data: 'cached' }));

      const fetcher = vi.fn();
      const result = await cacheService.getOrSet('test-key', fetcher);

      expect(result).toEqual({ data: 'cached' });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should fetch and cache value if not in cache', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.get.mockResolvedValueOnce(null);

      const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' });
      const result = await cacheService.getOrSet('test-key', fetcher);

      expect(result).toEqual({ data: 'fresh' });
      expect(fetcher).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalled();
    });

    it('should propagate fetcher errors', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      mockRedisClient.get.mockResolvedValueOnce(null);

      const fetcher = vi.fn().mockRejectedValue(new Error('Fetcher error'));

      await expect(cacheService.getOrSet('test-key', fetcher)).rejects.toThrow('Fetcher error');
    });
  });

  describe('isAvailable', () => {
    it('should return false when not initialized', () => {
      expect(cacheService.isAvailable()).toBe(false);
    });

    it('should return true when initialized', async () => {
      await cacheService.init({ host: 'localhost', port: 6379 });
      expect(cacheService.isAvailable()).toBe(true);
    });
  });
});
