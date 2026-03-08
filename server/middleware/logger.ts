/**
 * ===============================================
 * REQUEST LOGGING MIDDLEWARE
 * ===============================================
 * Logs incoming HTTP requests with method, path,
 * status code, and response time for monitoring.
 */

import { Request, Response, NextFunction } from 'express';
import { logger as loggerService } from '../services/logger.js';
import { recordHttpRequest } from '../observability/metrics.js';

/** Paths excluded from request logging */
const SKIP_PATHS = ['/api/health', '/health', '/favicon.ico'];

/** Fields redacted from logged request bodies */
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key'];

/** Status code threshold for warning-level logs */
const WARN_STATUS_THRESHOLD = 400;

// -----------------------------------------------
// In-process API metrics (rolling window)
// -----------------------------------------------

/** Maximum samples held per route for percentile calculation */
const MAX_SAMPLES_PER_ROUTE = 1000;

/** How long samples stay valid (10 minutes) */
const SAMPLE_WINDOW_MS = 10 * 60 * 1000;

interface TimedSample {
  durationMs: number;
  timestamp: number;
}

/** Per-route latency samples */
const latencySamples = new Map<string, TimedSample[]>();

/** Per-route error counts within the rolling window */
const errorCounts = new Map<string, { client: number; server: number; total: number; windowStart: number }>();

/** Global request counter within the rolling window */
let globalRequestCount = 0;
let globalErrorCount = 0;
let globalWindowStart = Date.now();

function resetWindowIfStale(): void {
  const now = Date.now();
  if (now - globalWindowStart > SAMPLE_WINDOW_MS) {
    globalRequestCount = 0;
    globalErrorCount = 0;
    globalWindowStart = now;
    errorCounts.clear();
    latencySamples.clear();
  }
}

function recordSample(routeKey: string, durationMs: number, statusCode: number): void {
  resetWindowIfStale();
  const now = Date.now();

  // Latency samples
  let samples = latencySamples.get(routeKey);
  if (!samples) {
    samples = [];
    latencySamples.set(routeKey, samples);
  }
  samples.push({ durationMs, timestamp: now });
  // Evict old samples
  while (samples.length > MAX_SAMPLES_PER_ROUTE) {
    samples.shift();
  }

  // Error counts
  globalRequestCount++;
  if (statusCode >= 400) {
    globalErrorCount++;
    let counts = errorCounts.get(routeKey);
    if (!counts) {
      counts = { client: 0, server: 0, total: 0, windowStart: now };
      errorCounts.set(routeKey, counts);
    }
    counts.total++;
    if (statusCode >= 500) {
      counts.server++;
    } else {
      counts.client++;
    }
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Get P50/P95/P99 latency and error rate metrics.
 * Returns aggregated stats for the rolling window (last 10 minutes).
 */
export function getApiMetrics(): {
  window: { durationMs: number; requests: number; errors: number; errorRate: number };
  latency: { p50: number; p95: number; p99: number; avg: number; max: number };
  byRoute: Record<string, {
    latency: { p50: number; p95: number; p99: number; avg: number; count: number };
    errors: { client: number; server: number; total: number };
  }>;
} {
  resetWindowIfStale();

  // Aggregate all latency samples
  const allDurations: number[] = [];
  const routeMetrics: Record<string, {
    latency: { p50: number; p95: number; p99: number; avg: number; count: number };
    errors: { client: number; server: number; total: number };
  }> = {};

  for (const [route, samples] of latencySamples.entries()) {
    const durations = samples.map((s) => s.durationMs).sort((a, b) => a - b);
    allDurations.push(...durations);
    const sum = durations.reduce((a, b) => a + b, 0);

    routeMetrics[route] = {
      latency: {
        p50: percentile(durations, 50),
        p95: percentile(durations, 95),
        p99: percentile(durations, 99),
        avg: durations.length > 0 ? Math.round(sum / durations.length) : 0,
        count: durations.length
      },
      errors: errorCounts.get(route) || { client: 0, server: 0, total: 0 }
    };
  }

  // Add routes with errors but no latency samples
  for (const [route, counts] of errorCounts.entries()) {
    if (!routeMetrics[route]) {
      routeMetrics[route] = {
        latency: { p50: 0, p95: 0, p99: 0, avg: 0, count: 0 },
        errors: counts
      };
    }
  }

  allDurations.sort((a, b) => a - b);
  const totalSum = allDurations.reduce((a, b) => a + b, 0);

  return {
    window: {
      durationMs: SAMPLE_WINDOW_MS,
      requests: globalRequestCount,
      errors: globalErrorCount,
      errorRate: globalRequestCount > 0 ? Math.round((globalErrorCount / globalRequestCount) * 10000) / 100 : 0
    },
    latency: {
      p50: percentile(allDurations, 50),
      p95: percentile(allDurations, 95),
      p99: percentile(allDurations, 99),
      avg: allDurations.length > 0 ? Math.round(totalSum / allDurations.length) : 0,
      max: allDurations.length > 0 ? allDurations[allDurations.length - 1] : 0
    },
    byRoute: routeMetrics
  };
}

/**
 * Remove sensitive data from logged request bodies
 */
const sanitizeBody = (body: Record<string, unknown>): Record<string, unknown> => {
  const sanitized = { ...body };

  for (const field of SENSITIVE_FIELDS) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
};

/**
 * Check whether the request path should be excluded from logging
 */
const shouldSkip = (requestPath: string): boolean =>
  SKIP_PATHS.some((skip) => requestPath.includes(skip));

/**
 * Express middleware that logs each HTTP request on completion.
 *
 * Captures method, path, status code, and response time using the
 * `res.on('finish')` event so every response type is logged.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  if (shouldSkip(req.path)) {
    return next();
  }

  const startTime = Date.now();

  // Log the incoming request
  const hasBody = req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0;
  loggerService.info(`--> ${req.method} ${req.path}`, {
    category: 'HTTP',
    metadata: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      ...(hasBody && { body: sanitizeBody(req.body as Record<string, unknown>) })
    }
  });

  // Log the response when it finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logMethod = res.statusCode >= WARN_STATUS_THRESHOLD ? 'warn' : 'info';

    loggerService[logMethod](
      `<-- ${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
      {
        category: 'HTTP',
        metadata: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseTimeMs: duration
        }
      }
    );

    // Record into OpenTelemetry histogram/counters
    const routeKey = `${req.method} ${req.route?.path || req.path}`;
    recordHttpRequest(req.method, req.route?.path || req.path, res.statusCode, duration);

    // Record into in-process rolling window for percentile calculation
    recordSample(routeKey, duration, res.statusCode);
  });

  next();
};

export { requestLogger as logger };
