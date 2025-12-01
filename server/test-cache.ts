#!/usr/bin/env node

/**
 * Simple test script to verify Redis cache functionality
 */

import { cacheService } from './services/cache-service.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  lazyConnect: boolean;
}

interface TestValue {
  message: string;
  timestamp: string;
}

interface ExpensiveOperationResult {
  computed: boolean;
  value: number;
  time: number;
}

async function testCacheService(): Promise<void> {
  console.log('🧪 Testing Redis Cache Service...\n');

  try {
    // Test cache configuration
    const cacheConfig: CacheConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'test:',
      lazyConnect: true
    };

    console.log('🔗 Connecting to Redis...');
    console.log(`   Host: ${cacheConfig.host}:${cacheConfig.port}`);
    console.log(`   Database: ${cacheConfig.db}`);
    console.log(`   Key Prefix: ${cacheConfig.keyPrefix}`);

    await cacheService.init(cacheConfig);
    console.log('✅ Cache service initialized!\n');

    // Test connection
    console.log('🔗 Testing cache connection...');
    const isConnected = await cacheService.testConnection();
    console.log(isConnected ? '✅ Connection test passed!' : '❌ Connection test failed!');

    if (!isConnected) {
      console.log('💡 Make sure Redis is running: redis-server');
      return;
    }

    // Test basic operations
    console.log('\n📝 Testing basic cache operations...');

    // Test SET
    const testKey = 'test-key';
    const testValue: TestValue = { message: 'Hello Cache!', timestamp: new Date().toISOString() };

    console.log('   Setting test value...');
    const setResult = await cacheService.set(testKey, testValue, { ttl: 60 });
    console.log(setResult ? '✅ SET operation successful' : '❌ SET operation failed');

    // Test GET
    console.log('   Getting test value...');
    const getValue = await cacheService.get<TestValue>(testKey);
    console.log('✅ GET operation successful:', JSON.stringify(getValue, null, 2));

    // Test EXISTS
    console.log('   Checking if key exists...');
    const exists = await cacheService.exists(testKey);
    console.log(exists ? '✅ Key exists' : '❌ Key does not exist');

    // Test cache-aside pattern
    console.log('\n🔄 Testing getOrSet pattern...');
    const expensiveOperation = async (): Promise<ExpensiveOperationResult> => {
      console.log('   🔄 Performing expensive operation...');
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate work
      return { computed: true, value: Math.random(), time: Date.now() };
    };

    console.log('   First call (should execute function):');
    const result1 = await cacheService.getOrSet('expensive-op', expensiveOperation, { ttl: 30 });
    console.log('   Result:', JSON.stringify(result1, null, 2));

    console.log('   Second call (should use cache):');
    const result2 = await cacheService.getOrSet('expensive-op', expensiveOperation, { ttl: 30 });
    console.log('   Result:', JSON.stringify(result2, null, 2));

    console.log(result1.time === result2.time ? '✅ Cache hit!' : '❌ Cache miss!');

    // Test tagging and invalidation
    console.log('\n🏷️  Testing cache tagging and invalidation...');

    await cacheService.set(
      'user:1',
      { id: 1, name: 'John' },
      { ttl: 60, tags: ['users', 'user:1'] }
    );
    await cacheService.set(
      'user:2',
      { id: 2, name: 'Jane' },
      { ttl: 60, tags: ['users', 'user:2'] }
    );
    await cacheService.set('post:1', { id: 1, title: 'Hello' }, { ttl: 60, tags: ['posts'] });

    console.log('   Added test data with tags...');

    console.log('   Invalidating users tag...');
    const invalidated = await cacheService.invalidateByTag('users');
    console.log(`   ✅ Invalidated ${invalidated} entries`);

    // Verify invalidation
    const user1 = await cacheService.get('user:1');
    const post1 = await cacheService.get('post:1');
    console.log(user1 ? '❌ User cache not invalidated' : '✅ User cache invalidated');
    console.log(post1 ? '✅ Post cache preserved' : '❌ Post cache incorrectly invalidated');

    // Test statistics
    console.log('\n📊 Testing cache statistics...');
    const stats = await cacheService.getStats();
    console.log('   Cache Stats:');
    console.log(`     Connected: ${stats.connected}`);
    console.log(`     Hits: ${stats.hits}`);
    console.log(`     Misses: ${stats.misses}`);
    console.log(`     Sets: ${stats.sets}`);
    console.log(`     Deletes: ${stats.deletes}`);
    console.log(`     Errors: ${stats.errors}`);
    console.log(`     Memory Usage: ${stats.memoryUsage || 'N/A'}`);
    console.log(`     Key Count: ${stats.keyCount || 'N/A'}`);

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await cacheService.delete(testKey);
    await cacheService.delete('expensive-op');
    await cacheService.delete('post:1');
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All cache tests passed successfully!');
    console.log('\n💡 Redis caching is ready for production use!');
  } catch (error: any) {
    console.error('❌ Cache service test failed:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Tips to fix connection issues:');
      console.log(
        '   1. Install Redis: brew install redis (macOS) or apt-get install redis (Ubuntu)'
      );
      console.log('   2. Start Redis server: redis-server');
      console.log('   3. Check Redis is running: redis-cli ping');
      console.log('   4. Update .env with correct Redis settings');
    }

    process.exit(1);
  } finally {
    await cacheService.disconnect();
    console.log('\n🔴 Cache service disconnected');
  }
}

// Run the test
testCacheService().catch(console.error);
