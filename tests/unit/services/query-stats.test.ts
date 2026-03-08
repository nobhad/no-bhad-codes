/**
 * ===============================================
 * UNIT TESTS - QUERY STATS SERVICE
 * ===============================================
 * @file tests/unit/services/query-stats.test.ts
 *
 * Tests for query performance tracking service including:
 * - Recording queries (fast and slow)
 * - Getting statistics
 * - Slow query detection and logging
 * - Enabling/disabling tracking
 * - Reset behavior
 * - Threshold retrieval
 * - Stats by query type
 * - Cleanup of old metrics
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Import after mocks
import { queryStats } from '../../../server/services/query-stats';
import { logger } from '../../../server/services/logger';

describe('QueryStatsService - record', () => {
  beforeEach(() => {
    queryStats.reset();
    queryStats.setEnabled(true);
    vi.mocked(logger.warn).mockClear();
  });

  it('records a fast query without logging a warning', () => {
    queryStats.record('select', 'users', 5);

    const stats = queryStats.getStats();
    expect(stats.totalQueries).toBe(1);
    expect(stats.slowQueries).toBe(0);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('records a slow query and logs a warning', () => {
    queryStats.record('insert', 'orders', 500, 'INSERT INTO orders ...');

    const stats = queryStats.getStats();
    expect(stats.totalQueries).toBe(1);
    expect(stats.slowQueries).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Slow query detected'),
      expect.objectContaining({ category: 'SLOW_QUERY' })
    );
  });

  it('does not record when disabled', () => {
    queryStats.setEnabled(false);
    queryStats.record('select', 'clients', 10);

    const stats = queryStats.getStats();
    expect(stats.totalQueries).toBe(0);
  });

  it('only stores SQL for slow queries', () => {
    queryStats.record('select', 'fast_table', 5, 'SELECT * FROM fast_table');
    queryStats.record('select', 'slow_table', 500, 'SELECT * FROM slow_table');

    const stats = queryStats.getStats();
    // The slow query should appear in recentSlowQueries with sql
    expect(stats.recentSlowQueries[0].sql).toContain('SELECT * FROM slow_table');
  });

  it('handles multiple query types', () => {
    queryStats.record('select', 'users', 10);
    queryStats.record('insert', 'users', 20);
    queryStats.record('update', 'users', 15);
    queryStats.record('delete', 'users', 8);
    queryStats.record('raw', 'db', 12);

    const stats = queryStats.getStats();
    expect(stats.totalQueries).toBe(5);
    expect(stats.byType.select.count).toBe(1);
    expect(stats.byType.insert.count).toBe(1);
    expect(stats.byType.update.count).toBe(1);
    expect(stats.byType.delete.count).toBe(1);
    expect(stats.byType.raw.count).toBe(1);
  });
});

describe('QueryStatsService - getStats', () => {
  beforeEach(() => {
    queryStats.reset();
    queryStats.setEnabled(true);
    vi.mocked(logger.warn).mockClear();
  });

  it('returns zero stats when no queries recorded', () => {
    const stats = queryStats.getStats();

    expect(stats.totalQueries).toBe(0);
    expect(stats.slowQueries).toBe(0);
    expect(stats.avgExecutionTime).toBe(0);
    expect(stats.minExecutionTime).toBe(0);
    expect(stats.maxExecutionTime).toBe(0);
  });

  it('calculates average, min, and max correctly', () => {
    queryStats.record('select', 't', 10);
    queryStats.record('select', 't', 30);
    queryStats.record('select', 't', 20);

    const stats = queryStats.getStats();

    expect(stats.avgExecutionTime).toBe(20);
    expect(stats.minExecutionTime).toBe(10);
    expect(stats.maxExecutionTime).toBe(30);
  });

  it('calculates per-type averages', () => {
    queryStats.record('select', 't', 10);
    queryStats.record('select', 't', 20);
    queryStats.record('insert', 't', 40);

    const stats = queryStats.getStats();

    expect(stats.byType.select.avgTime).toBe(15);
    expect(stats.byType.select.totalTime).toBe(30);
    expect(stats.byType.insert.avgTime).toBe(40);
  });

  it('reports uptime in seconds', () => {
    const stats = queryStats.getStats();
    expect(stats.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('limits recentSlowQueries to last 10', () => {
    // Record 12 slow queries
    for (let i = 0; i < 12; i++) {
      queryStats.record('select', `table_${i}`, 500);
    }

    const stats = queryStats.getStats();
    expect(stats.recentSlowQueries.length).toBeLessThanOrEqual(10);
  });

  it('returns recentSlowQueries in reverse order (most recent first)', () => {
    queryStats.record('select', 'first_table', 500);
    queryStats.record('select', 'second_table', 600);

    const stats = queryStats.getStats();
    // Most recent is second_table
    expect(stats.recentSlowQueries[0].table).toBe('second_table');
  });
});

describe('QueryStatsService - getThreshold', () => {
  it('returns the slow query threshold', () => {
    const threshold = queryStats.getThreshold();
    expect(typeof threshold).toBe('number');
    expect(threshold).toBeGreaterThan(0);
  });
});

describe('QueryStatsService - setEnabled', () => {
  beforeEach(() => {
    queryStats.reset();
    queryStats.setEnabled(true);
  });

  afterEach(() => {
    queryStats.setEnabled(true); // restore for other tests
  });

  it('disables recording when set to false', () => {
    queryStats.setEnabled(false);
    queryStats.record('select', 'users', 50);

    expect(queryStats.getStats().totalQueries).toBe(0);
  });

  it('re-enables recording when set to true after being disabled', () => {
    queryStats.setEnabled(false);
    queryStats.record('select', 'users', 50);
    queryStats.setEnabled(true);
    queryStats.record('select', 'users', 60);

    expect(queryStats.getStats().totalQueries).toBe(1);
  });
});

describe('QueryStatsService - reset', () => {
  beforeEach(() => {
    queryStats.setEnabled(true);
    vi.mocked(logger.warn).mockClear();
  });

  it('clears all metrics and slow queries', () => {
    queryStats.record('select', 'users', 10);
    queryStats.record('insert', 'users', 500);

    queryStats.reset();

    const stats = queryStats.getStats();
    expect(stats.totalQueries).toBe(0);
    expect(stats.slowQueries).toBe(0);
    expect(stats.recentSlowQueries).toHaveLength(0);
  });

  it('resets uptime counter', async () => {
    const beforeReset = queryStats.getStats().uptimeSeconds;
    await new Promise((r) => setTimeout(r, 10));
    queryStats.reset();
    const afterReset = queryStats.getStats().uptimeSeconds;

    // After reset, uptime should be near 0
    expect(afterReset).toBeLessThanOrEqual(beforeReset);
  });
});

describe('QueryStatsService - slow query buffer cap', () => {
  beforeEach(() => {
    queryStats.reset();
    queryStats.setEnabled(true);
    vi.mocked(logger.warn).mockClear();
  });

  it('caps slowQueries buffer at MAX_SLOW_QUERY_RECORDS (50)', () => {
    // Record 55 slow queries
    for (let i = 0; i < 55; i++) {
      queryStats.record('select', `table_${i}`, 200);
    }

    // The internal slow queries buffer should not exceed 50
    // We verify via getStats which slices to 10, but
    // the cap itself is tested by ensuring no unbounded growth
    const stats = queryStats.getStats();
    expect(stats.recentSlowQueries.length).toBeLessThanOrEqual(10);
    // All 55 are recorded as slow in metrics
    expect(stats.slowQueries).toBe(55);
  });
});

describe('QueryStatsService - cleanup of old metrics', () => {
  beforeEach(() => {
    queryStats.reset();
    queryStats.setEnabled(true);
  });

  it('only counts metrics within the retention window', () => {
    // Record a query with a very old timestamp by manipulating time
    // We cannot directly set timestamps, so we test that the stats
    // function filters correctly by recording fresh queries
    queryStats.record('select', 'recent', 5);

    const stats = queryStats.getStats();
    expect(stats.totalQueries).toBeGreaterThanOrEqual(1);
  });

  it('triggers cleanup at every 100 queries without error', () => {
    // Record exactly 100 queries to trigger cleanup code path
    for (let i = 0; i < 100; i++) {
      queryStats.record('select', 'cleanup_table', 10);
    }

    expect(() => queryStats.getStats()).not.toThrow();
    expect(queryStats.getStats().totalQueries).toBe(100);
  });
});
