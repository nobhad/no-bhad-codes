/**
 * ===============================================
 * METRICS COLLECTION UTILITIES
 * ===============================================
 * @file server/observability/metrics.ts
 *
 * Defines and manages application metrics for
 * monitoring and alerting purposes.
 */

import { getMeter } from './index.js';
import type { Counter, Histogram, ObservableGauge, Attributes } from '@opentelemetry/api';

// Lazy-initialized metrics
let httpRequestDuration: Histogram | null = null;
let httpRequestTotal: Counter | null = null;
let httpErrorTotal: Counter | null = null;
let activeConnections: ObservableGauge | null = null;

// Callback functions for observable metrics
let dbStatsCallback: (() => { active: number; idle: number; queued: number }) | null = null;
let activeConnectionsCallback: (() => number) | null = null;

/**
 * Initialize all application metrics
 * Call this after OpenTelemetry is initialized
 */
export function initMetrics(): void {
  const meter = getMeter('client');

  // HTTP Request Duration Histogram
  // Measures request latency with specific percentile buckets
  httpRequestDuration = meter.createHistogram('http.server.request.duration', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms',
    advice: {
      explicitBucketBoundaries: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
    }
  });

  // HTTP Request Counter
  httpRequestTotal = meter.createCounter('http.server.request.total', {
    description: 'Total number of HTTP requests'
  });

  // HTTP Error Counter
  httpErrorTotal = meter.createCounter('http.server.error.total', {
    description: 'Total number of HTTP errors (4xx and 5xx)'
  });

  // Active HTTP Connections Observable Gauge
  activeConnections = meter.createObservableGauge('http.server.active_connections', {
    description: 'Number of currently active HTTP connections'
  });

  activeConnections.addCallback((observableResult) => {
    if (activeConnectionsCallback) {
      observableResult.observe(activeConnectionsCallback());
    }
  });

  // Database Pool Metrics
  const dbActiveConnections = meter.createObservableGauge('db.pool.connections.active', {
    description: 'Number of active database connections'
  });

  const dbIdleConnections = meter.createObservableGauge('db.pool.connections.idle', {
    description: 'Number of idle database connections'
  });

  const dbQueuedRequests = meter.createObservableGauge('db.pool.requests.queued', {
    description: 'Number of queued database requests'
  });

  dbActiveConnections.addCallback((observableResult) => {
    if (dbStatsCallback) {
      observableResult.observe(dbStatsCallback().active);
    }
  });

  dbIdleConnections.addCallback((observableResult) => {
    if (dbStatsCallback) {
      observableResult.observe(dbStatsCallback().idle);
    }
  });

  dbQueuedRequests.addCallback((observableResult) => {
    if (dbStatsCallback) {
      observableResult.observe(dbStatsCallback().queued);
    }
  });

  // System Metrics (Memory, CPU)
  const memoryUsage = meter.createObservableGauge('process.memory.heap_used', {
    description: 'Process heap memory usage in bytes',
    unit: 'bytes'
  });

  memoryUsage.addCallback((observableResult) => {
    const usage = process.memoryUsage();
    observableResult.observe(usage.heapUsed);
  });

  const memoryTotal = meter.createObservableGauge('process.memory.heap_total', {
    description: 'Process total heap memory in bytes',
    unit: 'bytes'
  });

  memoryTotal.addCallback((observableResult) => {
    const usage = process.memoryUsage();
    observableResult.observe(usage.heapTotal);
  });

  const memoryRss = meter.createObservableGauge('process.memory.rss', {
    description: 'Process resident set size in bytes',
    unit: 'bytes'
  });

  memoryRss.addCallback((observableResult) => {
    const usage = process.memoryUsage();
    observableResult.observe(usage.rss);
  });

  console.log('✅ Application metrics initialized');
}

/**
 * Record HTTP request completion
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number
): void {
  const attributes: Attributes = {
    'http.method': method,
    'http.route': route,
    'http.status_code': statusCode
  };

  if (httpRequestDuration) {
    httpRequestDuration.record(durationMs, attributes);
  }

  if (httpRequestTotal) {
    httpRequestTotal.add(1, attributes);
  }

  // Record errors separately for easier alerting
  if (statusCode >= 400 && httpErrorTotal) {
    httpErrorTotal.add(1, {
      ...attributes,
      'http.error_type': statusCode >= 500 ? 'server_error' : 'client_error'
    });
  }
}

/**
 * Register callback for database pool statistics
 */
export function registerDbStatsCallback(
  callback: () => { active: number; idle: number; queued: number }
): void {
  dbStatsCallback = callback;
}

/**
 * Register callback for active HTTP connections
 */
export function registerActiveConnectionsCallback(callback: () => number): void {
  activeConnectionsCallback = callback;
}

/**
 * Get metrics summary for health check endpoints
 */
export function getMetricsSummary(): {
  http: {
    activeConnections: number;
  };
  database: {
    activeConnections: number;
    idleConnections: number;
    queuedRequests: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  uptime: number;
  } {
  const memoryUsage = process.memoryUsage();
  const dbStats = dbStatsCallback ? dbStatsCallback() : { active: 0, idle: 0, queued: 0 };

  return {
    http: {
      activeConnections: activeConnectionsCallback ? activeConnectionsCallback() : 0
    },
    database: {
      activeConnections: dbStats.active,
      idleConnections: dbStats.idle,
      queuedRequests: dbStats.queued
    },
    memory: {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
      external: memoryUsage.external
    },
    uptime: process.uptime()
  };
}

/**
 * Create a custom counter metric
 */
export function createCounter(name: string, description: string): Counter {
  const meter = getMeter('client');
  return meter.createCounter(name, { description });
}

/**
 * Create a custom histogram metric
 */
export function createHistogram(name: string, description: string, buckets?: number[]): Histogram {
  const meter = getMeter('client');
  return meter.createHistogram(name, {
    description,
    advice: buckets ? { explicitBucketBoundaries: buckets } : undefined
  });
}

// Business metrics
let invoiceCounter: Counter | null = null;
let emailCounter: Counter | null = null;
let taskCounter: Counter | null = null;

/**
 * Initialize business-specific metrics
 */
export function initBusinessMetrics(): void {
  const meter = getMeter('client-business');

  invoiceCounter = meter.createCounter('business.invoices.created', {
    description: 'Number of invoices created'
  });

  emailCounter = meter.createCounter('business.emails.sent', {
    description: 'Number of emails sent'
  });

  taskCounter = meter.createCounter('business.tasks.completed', {
    description: 'Number of tasks completed'
  });
}

/**
 * Record invoice creation
 */
export function recordInvoiceCreated(attributes?: Attributes): void {
  if (invoiceCounter) {
    invoiceCounter.add(1, attributes);
  }
}

/**
 * Record email sent
 */
export function recordEmailSent(attributes?: Attributes): void {
  if (emailCounter) {
    emailCounter.add(1, attributes);
  }
}

/**
 * Record task completion
 */
export function recordTaskCompleted(attributes?: Attributes): void {
  if (taskCounter) {
    taskCounter.add(1, attributes);
  }
}
