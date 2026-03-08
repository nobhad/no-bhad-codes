/**
 * ===============================================
 * HEALTH CHECK ENDPOINTS
 * ===============================================
 * @file server/routes/health.ts
 *
 * Provides health check endpoints for monitoring,
 * load balancers, and Kubernetes probes.
 *
 * Endpoints:
 *   GET /health        - Full diagnostic health check
 *   GET /health/live   - Liveness probe (process running)
 *   GET /health/ready  - Readiness probe (can handle traffic)
 */

import { Router, Request, Response } from 'express';
import { getDatabase, getDatabaseStats } from '../database/init.js';
import { emailService } from '../services/email-service.js';
import { getSchedulerService } from '../services/scheduler-service.js';
import { getMetricsSummary } from '../observability/metrics.js';
import { getCurrentTraceId } from '../observability/tracing.js';
import { getApiMetrics } from '../middleware/logger.js';

const router = Router();

/**
 * Health status types
 */
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface ServiceHealth {
  status: 'up' | 'down' | 'unknown';
  message?: string;
  latencyMs?: number;
}

interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime: number;
  traceId?: string;
  services?: {
    database?: ServiceHealth;
    email?: ServiceHealth;
    scheduler?: ServiceHealth;
  };
  metrics?: ReturnType<typeof getMetricsSummary>;
}

/**
 * Full diagnostic health check
 * GET /health
 *
 * Performs comprehensive health checks including:
 * - Database connectivity and pool status
 * - Email service status
 * - Scheduler service status
 * - Memory and CPU metrics
 *
 * Returns 200 if healthy, 503 if degraded/unhealthy
 */
router.get('/', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  const health: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    traceId: getCurrentTraceId(),
    services: {}
  };

  // Check database connectivity
  const dbStart = Date.now();
  try {
    const db = getDatabase();
    await db.get('SELECT 1');
    const dbStats = getDatabaseStats();

    health.services!.database = {
      status: 'up',
      latencyMs: Date.now() - dbStart,
      message: dbStats
        ? `Pool: ${dbStats.activeConnections}/${dbStats.totalConnections} active, ${dbStats.queuedRequests} queued`
        : undefined
    };
  } catch (err) {
    health.status = 'degraded';
    health.services!.database = {
      status: 'down',
      message: (err as Error).message,
      latencyMs: Date.now() - dbStart
    };
  }

  // Check email service
  try {
    const emailStatus = emailService.getStatus();
    health.services!.email = {
      status: emailStatus.initialized ? 'up' : 'down',
      message: emailStatus.initialized ? 'Configured' : 'Not configured'
    };
  } catch {
    health.services!.email = {
      status: 'unknown',
      message: 'Unable to check status'
    };
  }

  // Check scheduler service
  try {
    const scheduler = getSchedulerService();
    const schedulerStatus = scheduler.getStatus();
    const activeJobs = Object.entries(schedulerStatus.jobs)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);
    health.services!.scheduler = {
      status: schedulerStatus.isRunning ? 'up' : 'down',
      message: schedulerStatus.isRunning
        ? `Active jobs: ${activeJobs.join(', ') || 'none'}`
        : 'Stopped'
    };
  } catch {
    health.services!.scheduler = {
      status: 'unknown',
      message: 'Unable to check status'
    };
  }

  // Include metrics summary
  try {
    health.metrics = getMetricsSummary();
  } catch {
    // Metrics not critical for health check
  }

  // Determine overall health status
  const criticalServicesDown = health.services!.database?.status === 'down';
  if (criticalServicesDown) {
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;

  // Add response time header
  res.set('X-Response-Time', `${Date.now() - startTime}ms`);
  res.status(statusCode).json(health);
});

/**
 * Liveness probe
 * GET /health/live
 *
 * Simple liveness check - returns 200 if the process is running.
 * Used by Kubernetes liveness probes to determine if the container
 * should be restarted.
 *
 * Does NOT check external dependencies.
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'live',
    timestamp: new Date().toISOString()
  });
});

/**
 * Readiness probe
 * GET /health/ready
 *
 * Readiness check - returns 200 if the server can handle traffic.
 * Used by Kubernetes readiness probes and load balancers to determine
 * if the instance should receive traffic.
 *
 * Checks critical dependencies (database) but not optional services.
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Check database - this is critical for readiness
    const db = getDatabase();
    await db.get('SELECT 1');
    const dbStats = getDatabaseStats();

    // Check if database pool is overwhelmed (too many queued requests)
    const maxQueuedRequests = 10;
    if (dbStats && dbStats.queuedRequests > maxQueuedRequests) {
      res.set('X-Response-Time', `${Date.now() - startTime}ms`);
      return res.status(503).json({
        status: 'not_ready',
        reason: 'Database pool overwhelmed',
        timestamp: new Date().toISOString(),
        details: {
          queuedRequests: dbStats.queuedRequests,
          maxAllowed: maxQueuedRequests
        }
      });
    }

    res.set('X-Response-Time', `${Date.now() - startTime}ms`);
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.set('X-Response-Time', `${Date.now() - startTime}ms`);
    res.status(503).json({
      status: 'not_ready',
      reason: (err as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Database-specific health check
 * GET /health/db
 *
 * Detailed database health including:
 * - Connection pool statistics
 * - Query latency test
 */
router.get('/db', async (_req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const db = getDatabase();
    const dbStats = getDatabaseStats();

    // Test query latency
    const queryStart = Date.now();
    await db.get('SELECT 1');
    const queryLatency = Date.now() - queryStart;

    res.set('X-Response-Time', `${Date.now() - startTime}ms`);
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      latencyMs: queryLatency,
      pool: dbStats || {
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        maxConnections: 0,
        queuedRequests: 0
      }
    });
  } catch (err) {
    res.set('X-Response-Time', `${Date.now() - startTime}ms`);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (err as Error).message
    });
  }
});

/**
 * API metrics endpoint
 * GET /health/metrics
 *
 * Returns P50/P95/P99 latency percentiles and error rates
 * from a rolling 10-minute window. Broken down by route.
 */
router.get('/metrics', (_req: Request, res: Response) => {
  const startTime = Date.now();
  const system = getMetricsSummary();
  const api = getApiMetrics();

  res.set('X-Response-Time', `${Date.now() - startTime}ms`);
  res.status(200).json({
    timestamp: new Date().toISOString(),
    system,
    api
  });
});

export default router;
