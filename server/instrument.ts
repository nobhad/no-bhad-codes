/**
 * ===============================================
 * APPLICATION INSTRUMENTATION
 * ===============================================
 * @file server/instrument.ts
 *
 * Initializes OpenTelemetry and Sentry instrumentation.
 * MUST be imported FIRST before any other modules.
 *
 * Load order is critical:
 * 1. OpenTelemetry (for distributed tracing)
 * 2. Sentry (for error tracking, links to OTel traces)
 */

import dotenv from 'dotenv';

// Load env vars first
dotenv.config();

// Initialize OpenTelemetry BEFORE Sentry
// This must happen before any other imports to properly instrument the runtime
import { initOpenTelemetry, shutdownOpenTelemetry } from './observability/index.js';
import { getCurrentTraceId } from './observability/tracing.js';

initOpenTelemetry();

// Initialize Sentry after OpenTelemetry
import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;

// Only report from real deployments. SENTRY_DSN lives in .env too, so without
// this guard every local `npm run dev:server` reported into the same project as
// production — a laptop boot on port 4001 sitting in the issue list next to
// Railway's on 8080. Set SENTRY_ENABLE_LOCAL=true to opt a local run back in
// when you are deliberately testing error reporting.
const sentryEnabled =
  process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLE_LOCAL === 'true';

if (
  sentryEnabled &&
  dsn &&
  !dsn.includes('your-sentry') &&
  !dsn.includes('placeholder') &&
  dsn.startsWith('https://')
) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Disable profiling to avoid "require is not defined" warning in ES modules
    profilesSampleRate: 0,
    // Add OpenTelemetry trace context to Sentry events
    beforeSend(event) {
      const traceId = getCurrentTraceId();
      if (traceId) {
        event.contexts = event.contexts || {};
        // Add trace ID as a custom context field to avoid type issues
        event.contexts.otel = {
          trace_id: traceId
        };
        // Also add to tags for easier searching
        event.tags = event.tags || {};
        event.tags.otel_trace_id = traceId;
      }
      return event;
    }
  });
  console.log(`✅ Sentry instrumentation loaded for ${process.env.NODE_ENV || 'development'}`);
} else {
  console.warn('⚠️ Sentry DSN not configured. Error tracking disabled.');
}

export { Sentry, shutdownOpenTelemetry };
