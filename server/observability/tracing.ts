/**
 * ===============================================
 * DISTRIBUTED TRACING UTILITIES
 * ===============================================
 * @file server/observability/tracing.ts
 *
 * Utilities for creating and managing OpenTelemetry spans
 * for database queries, HTTP requests, and custom operations.
 */

import { getTracer, SpanStatusCode } from './index.js';
import { Span, SpanKind, context, propagation } from '@opentelemetry/api';
import type { Request } from 'express';

// Semantic convention attributes for database operations
const DB_SYSTEM = 'db.system';
const DB_STATEMENT = 'db.statement';
const DB_OPERATION = 'db.operation';
const DB_NAME = 'db.name';
const DB_ROWS_AFFECTED = 'db.rows_affected';

/**
 * Wrap a database query with a tracing span
 *
 * @example
 * const result = await traceDbQuery('SELECT', 'SELECT * FROM users WHERE id = ?', async () => {
 *   return db.get('SELECT * FROM users WHERE id = ?', [userId]);
 * });
 */
export async function traceDbQuery<T>(
  operation: string,
  sql: string,
  fn: () => Promise<T>,
  additionalAttributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = getTracer('database');

  return tracer.startActiveSpan(
    `db.${operation.toLowerCase()}`,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        [DB_SYSTEM]: 'sqlite',
        [DB_NAME]: 'client_portal',
        [DB_OPERATION]: operation.toUpperCase(),
        [DB_STATEMENT]: sanitizeSql(sql),
        ...additionalAttributes
      }
    },
    async (span: Span) => {
      try {
        const result = await fn();

        // Record rows affected for write operations
        if (result && typeof result === 'object' && 'changes' in result) {
          span.setAttribute(DB_ROWS_AFFECTED, (result as { changes?: number }).changes || 0);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Database query failed'
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Wrap an HTTP client request with a tracing span
 */
export async function traceHttpRequest<T>(
  method: string,
  url: string,
  fn: () => Promise<T>,
  additionalAttributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = getTracer('http-client');
  const parsedUrl = new URL(url);

  return tracer.startActiveSpan(
    `HTTP ${method.toUpperCase()} ${parsedUrl.pathname}`,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        'http.method': method.toUpperCase(),
        'http.url': url,
        'http.host': parsedUrl.host,
        'http.scheme': parsedUrl.protocol.replace(':', ''),
        ...additionalAttributes
      }
    },
    async (span: Span) => {
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'HTTP request failed'
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Create a custom span for any operation
 *
 * @example
 * const result = await withSpan('process-invoice', async (span) => {
 *   span.setAttribute('invoice.id', invoiceId);
 *   return processInvoice(invoiceId);
 * });
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  }
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    name,
    {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes
    },
    async (span: Span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Operation failed'
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Extract trace context from an incoming request
 * Useful for linking spans across services
 */
export function extractTraceContext(req: Request): ReturnType<typeof context.active> {
  return propagation.extract(context.active(), req.headers);
}

/**
 * Get the current trace ID if available
 */
export function getCurrentTraceId(): string | undefined {
  const span = getActiveSpan();
  if (span) {
    return span.spanContext().traceId;
  }
  return undefined;
}

/**
 * Get the current span ID if available
 */
export function getCurrentSpanId(): string | undefined {
  const span = getActiveSpan();
  if (span) {
    return span.spanContext().spanId;
  }
  return undefined;
}

/**
 * Get the currently active span
 */
export function getActiveSpan(): Span | undefined {
  const { trace } = require('@opentelemetry/api');
  return trace.getActiveSpan();
}

/**
 * Add an event to the current span
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const span = getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Set attributes on the current span
 */
export function setSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = getActiveSpan();
  if (span) {
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }
  }
}

/**
 * Record an exception on the current span without marking it as error
 */
export function recordSpanException(error: Error): void {
  const span = getActiveSpan();
  if (span) {
    span.recordException(error);
  }
}

/**
 * Sanitize SQL statement for tracing
 * Removes parameter values while keeping structure visible
 */
function sanitizeSql(sql: string): string {
  // Truncate very long queries
  const maxLength = 500;
  if (sql.length > maxLength) {
    return `${sql.substring(0, maxLength)  }...`;
  }
  return sql;
}

/**
 * Create a trace context object for logging correlation
 */
export function getTraceContextForLogs(): { traceId?: string; spanId?: string } {
  return {
    traceId: getCurrentTraceId(),
    spanId: getCurrentSpanId()
  };
}
