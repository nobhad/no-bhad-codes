/**
 * ===============================================
 * QUERY PERFORMANCE TRACKING SERVICE
 * ===============================================
 * @file server/services/query-stats.ts
 *
 * Tracks database query execution times, logs slow queries,
 * and provides performance metrics for monitoring.
 */

import { logger } from './logger.js';

export interface QueryMetric {
  type: 'select' | 'insert' | 'update' | 'delete' | 'raw';
  table: string;
  executionTime: number;
  timestamp: number;
  sql?: string;
  slow: boolean;
}

export interface QueryStats {
  totalQueries: number;
  slowQueries: number;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  byType: {
    select: TypeStats;
    insert: TypeStats;
    update: TypeStats;
    delete: TypeStats;
    raw: TypeStats;
  };
  recentSlowQueries: SlowQueryRecord[];
  uptimeSeconds: number;
}

interface TypeStats {
  count: number;
  avgTime: number;
  totalTime: number;
}

interface SlowQueryRecord {
  type: string;
  table: string;
  executionTime: number;
  timestamp: string;
  sql?: string;
}

const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '100', 10);
const MAX_SLOW_QUERY_RECORDS = 50;
const STATS_RETENTION_MS = 60 * 60 * 1000; // 1 hour rolling window

class QueryStatsService {
  private metrics: QueryMetric[] = [];
  private slowQueries: SlowQueryRecord[] = [];
  private startTime: number = Date.now();
  private enabled: boolean = true;

  /**
   * Record a query execution
   */
  record(
    type: QueryMetric['type'],
    table: string,
    executionTime: number,
    sql?: string
  ): void {
    if (!this.enabled) return;

    const isSlow = executionTime >= SLOW_QUERY_THRESHOLD_MS;
    const timestamp = Date.now();

    // Store metric
    this.metrics.push({
      type,
      table,
      executionTime,
      timestamp,
      sql: isSlow ? sql : undefined, // Only store SQL for slow queries
      slow: isSlow
    });

    // Log slow queries
    if (isSlow) {
      const record: SlowQueryRecord = {
        type,
        table,
        executionTime,
        timestamp: new Date(timestamp).toISOString(),
        sql: sql?.substring(0, 200) // Truncate for logging
      };

      this.slowQueries.push(record);

      // Keep only recent slow queries
      if (this.slowQueries.length > MAX_SLOW_QUERY_RECORDS) {
        this.slowQueries.shift();
      }

      // Log warning for slow query
      logger.warn(`Slow query detected: ${type.toUpperCase()} on ${table} took ${executionTime}ms`, {
        category: 'SLOW_QUERY',
        metadata: {
          type,
          table,
          executionTime,
          threshold: SLOW_QUERY_THRESHOLD_MS
        }
      });
    }

    // Cleanup old metrics periodically
    this.cleanup();
  }

  /**
   * Get current statistics
   */
  getStats(): QueryStats {
    const now = Date.now();
    const relevantMetrics = this.metrics.filter(
      (m) => now - m.timestamp < STATS_RETENTION_MS
    );

    const totalQueries = relevantMetrics.length;
    const slowQueries = relevantMetrics.filter((m) => m.slow).length;

    let totalTime = 0;
    let minTime = Infinity;
    let maxTime = 0;

    const byType: QueryStats['byType'] = {
      select: { count: 0, avgTime: 0, totalTime: 0 },
      insert: { count: 0, avgTime: 0, totalTime: 0 },
      update: { count: 0, avgTime: 0, totalTime: 0 },
      delete: { count: 0, avgTime: 0, totalTime: 0 },
      raw: { count: 0, avgTime: 0, totalTime: 0 }
    };

    for (const metric of relevantMetrics) {
      totalTime += metric.executionTime;
      minTime = Math.min(minTime, metric.executionTime);
      maxTime = Math.max(maxTime, metric.executionTime);

      byType[metric.type].count++;
      byType[metric.type].totalTime += metric.executionTime;
    }

    // Calculate averages
    for (const type of Object.keys(byType) as Array<keyof typeof byType>) {
      if (byType[type].count > 0) {
        byType[type].avgTime = Math.round(byType[type].totalTime / byType[type].count);
      }
    }

    return {
      totalQueries,
      slowQueries,
      avgExecutionTime: totalQueries > 0 ? Math.round(totalTime / totalQueries) : 0,
      minExecutionTime: totalQueries > 0 ? minTime : 0,
      maxExecutionTime: maxTime,
      byType,
      recentSlowQueries: [...this.slowQueries].reverse().slice(0, 10),
      uptimeSeconds: Math.floor((now - this.startTime) / 1000)
    };
  }

  /**
   * Get slow query threshold
   */
  getThreshold(): number {
    return SLOW_QUERY_THRESHOLD_MS;
  }

  /**
   * Enable/disable tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.metrics = [];
    this.slowQueries = [];
    this.startTime = Date.now();
  }

  /**
   * Cleanup old metrics to prevent memory bloat
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - STATS_RETENTION_MS;

    // Only cleanup every 100 queries to avoid overhead
    if (this.metrics.length % 100 === 0) {
      this.metrics = this.metrics.filter((m) => m.timestamp > cutoff);
    }
  }
}

// Export singleton instance
export const queryStats = new QueryStatsService();
