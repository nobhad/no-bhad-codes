/**
 * ===============================================
 * HEALTH CHECK SERVICE
 * ===============================================
 * @file server/services/health-check-service.ts
 *
 * Database health check operations extracted from
 * the health route to maintain separation of concerns.
 */

import { getDatabase, getDatabaseStats } from '../database/init.js';

// =====================================================
// TYPES
// =====================================================

export interface DatabaseHealthResult {
  status: 'up' | 'down';
  latencyMs: number;
  message?: string;
}

export interface DatabasePoolStats {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maxConnections: number;
  queuedRequests: number;
}

export interface ReadinessCheckResult {
  ready: boolean;
  reason?: string;
  queuedRequests?: number;
  maxAllowed?: number;
}

// =====================================================
// CONSTANTS
// =====================================================

const MAX_QUEUED_REQUESTS = 10;

// =====================================================
// SERVICE
// =====================================================

class HealthCheckService {
  /**
   * Run a database connectivity check with latency measurement
   */
  async checkDatabaseHealth(): Promise<DatabaseHealthResult> {
    const start = Date.now();
    try {
      const db = getDatabase();
      await db.get('SELECT 1');
      const stats = getDatabaseStats();
      return {
        status: 'up',
        latencyMs: Date.now() - start,
        message: stats
          ? `Pool: ${stats.activeConnections}/${stats.totalConnections} active, ${stats.queuedRequests} queued`
          : undefined
      };
    } catch (err) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: (err as Error).message
      };
    }
  }

  /**
   * Readiness probe: verify database connectivity and pool capacity
   */
  async checkReadiness(): Promise<ReadinessCheckResult> {
    const db = getDatabase();
    await db.get('SELECT 1');
    const stats = getDatabaseStats();

    if (stats && stats.queuedRequests > MAX_QUEUED_REQUESTS) {
      return {
        ready: false,
        reason: 'Database pool overwhelmed',
        queuedRequests: stats.queuedRequests,
        maxAllowed: MAX_QUEUED_REQUESTS
      };
    }

    return { ready: true };
  }

  /**
   * Detailed database health including pool stats and query latency
   */
  async getDatabaseDetailedHealth(): Promise<{
    latencyMs: number;
    pool: DatabasePoolStats;
  }> {
    const db = getDatabase();
    const stats = getDatabaseStats();

    const queryStart = Date.now();
    await db.get('SELECT 1');
    const queryLatency = Date.now() - queryStart;

    return {
      latencyMs: queryLatency,
      pool: stats || {
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        maxConnections: 0,
        queuedRequests: 0
      }
    };
  }
}

export const healthCheckService = new HealthCheckService();
