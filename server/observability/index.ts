/**
 * ===============================================
 * OPENTELEMETRY OBSERVABILITY MODULE
 * ===============================================
 * @file server/observability/index.ts
 *
 * Initializes OpenTelemetry SDK for distributed tracing
 * and metrics collection. MUST be imported before other
 * application code (alongside Sentry in instrument.ts).
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT
} from '@opentelemetry/semantic-conventions';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import {
  ConsoleMetricExporter,
  PeriodicExportingMetricReader,
  type MetricReader
} from '@opentelemetry/sdk-metrics';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import {
  trace,
  metrics,
  SpanStatusCode,
  diag,
  DiagConsoleLogger,
  DiagLogLevel
} from '@opentelemetry/api';

// Environment configuration
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'client';
const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const OTEL_ENABLED = process.env.OTEL_ENABLED !== 'false';
const OTEL_EXPORTER_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const OTEL_DEBUG = process.env.OTEL_DEBUG === 'true';

// Metrics exporter selection.
//
// Default is Prometheus: starts an HTTP endpoint on PROMETHEUS_PORT
// (9464 by default) that scrapers can pull from, so latency and
// error-rate histograms survive restarts instead of living only in
// process memory. Set METRICS_EXPORTER=otlp to push to an OTel
// collector instead (requires OTEL_EXPORTER_OTLP_ENDPOINT), =console
// for stdout, =none to disable.
type MetricsExporterKind = 'prometheus' | 'otlp' | 'console' | 'none';

function resolveMetricsExporterKind(): MetricsExporterKind {
  const raw = (process.env.METRICS_EXPORTER || '').toLowerCase();
  if (raw === 'prometheus' || raw === 'otlp' || raw === 'console' || raw === 'none') {
    return raw;
  }
  // No explicit choice: prefer OTLP if an endpoint is configured,
  // otherwise Prometheus. Keeps existing OTLP-based deploys working
  // by default.
  return OTEL_EXPORTER_ENDPOINT ? 'otlp' : 'prometheus';
}

const PROMETHEUS_PORT = parseInt(process.env.PROMETHEUS_PORT || '9464', 10);
const PROMETHEUS_HOST = process.env.PROMETHEUS_HOST || '0.0.0.0';
const PROMETHEUS_ENDPOINT = process.env.PROMETHEUS_ENDPOINT || '/metrics';

// Enable debug logging if requested
if (OTEL_DEBUG) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

// Create resource describing the service
const resource = resourceFromAttributes({
  [SEMRESATTRS_SERVICE_NAME]: SERVICE_NAME,
  [SEMRESATTRS_SERVICE_VERSION]: SERVICE_VERSION,
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: NODE_ENV
});

// Configure exporters based on environment
function getTraceExporter() {
  if (NODE_ENV === 'production' && OTEL_EXPORTER_ENDPOINT) {
    return new OTLPTraceExporter({
      url: OTEL_EXPORTER_ENDPOINT
    });
  }
  // Use console exporter for development (only if debug enabled)
  if (OTEL_DEBUG) {
    return new ConsoleSpanExporter();
  }
  // No-op in dev without debug
  return undefined;
}

function getMetricReader(): MetricReader | undefined {
  const kind = resolveMetricsExporterKind();

  switch (kind) {
  case 'none':
    return undefined;

  case 'prometheus':
    // PrometheusExporter *is* a MetricReader and manages its own
    // HTTP listener — scrapers pull from http://host:port/metrics.
    return new PrometheusExporter({
      port: PROMETHEUS_PORT,
      host: PROMETHEUS_HOST,
      endpoint: PROMETHEUS_ENDPOINT
    });

  case 'otlp':
    if (!OTEL_EXPORTER_ENDPOINT) {
      console.warn(
        '⚠️ METRICS_EXPORTER=otlp but OTEL_EXPORTER_OTLP_ENDPOINT is not set — disabling metrics export'
      );
      return undefined;
    }
    return new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: OTEL_EXPORTER_ENDPOINT }),
      exportIntervalMillis: 60000
    });

  case 'console':
    return new PeriodicExportingMetricReader({
      exporter: new ConsoleMetricExporter(),
      exportIntervalMillis: 60000
    });
  }
}

// SDK instance
let sdk: NodeSDK | null = null;
let isInitialized = false;

/**
 * Initialize OpenTelemetry SDK
 * Should be called before any other application code
 */
export function initOpenTelemetry(): void {
  if (!OTEL_ENABLED) {
    console.log('⚠️ OpenTelemetry disabled via OTEL_ENABLED=false');
    return;
  }

  if (isInitialized) {
    console.warn('⚠️ OpenTelemetry already initialized');
    return;
  }

  try {
    const traceExporter = getTraceExporter();
    const metricReader = getMetricReader();

    // Paths to ignore for tracing
    const ignorePaths = ['/health', '/health/live', '/health/ready', '/health/db', '/favicon.ico'];

    sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable noisy instrumentations in development
          '@opentelemetry/instrumentation-fs': {
            enabled: NODE_ENV === 'production'
          },
          '@opentelemetry/instrumentation-dns': {
            enabled: NODE_ENV === 'production'
          },
          // Configure HTTP instrumentation with request filter
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            ignoreIncomingRequestHook: (req) => {
              const url = req.url || '';
              return ignorePaths.some((path) => url.startsWith(path));
            }
          },
          // Configure Express instrumentation
          '@opentelemetry/instrumentation-express': {
            enabled: true
          }
        })
      ]
    });

    sdk.start();
    isInitialized = true;

    const tracesInfo = OTEL_EXPORTER_ENDPOINT
      ? `OTLP → ${OTEL_EXPORTER_ENDPOINT}`
      : OTEL_DEBUG
        ? 'Console (debug mode)'
        : 'Disabled (no endpoint)';

    const metricsKind = resolveMetricsExporterKind();
    const metricsInfo =
      metricsKind === 'prometheus'
        ? `Prometheus scrape → http://${PROMETHEUS_HOST}:${PROMETHEUS_PORT}${PROMETHEUS_ENDPOINT}`
        : metricsKind === 'otlp'
          ? OTEL_EXPORTER_ENDPOINT
            ? `OTLP → ${OTEL_EXPORTER_ENDPOINT}`
            : 'Disabled (OTLP selected but no endpoint)'
          : metricsKind === 'console'
            ? 'Console'
            : 'Disabled';

    console.log(`✅ OpenTelemetry initialized for ${SERVICE_NAME} (${NODE_ENV})`);
    console.log(`   Traces:  ${tracesInfo}`);
    console.log(`   Metrics: ${metricsInfo}`);
  } catch (error) {
    console.error('❌ Failed to initialize OpenTelemetry:', error);
    // Don't throw - observability failure shouldn't crash the app
  }
}

/**
 * Gracefully shutdown OpenTelemetry SDK
 * Should be called during application shutdown
 */
export async function shutdownOpenTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }

  try {
    await sdk.shutdown();
    console.log('✅ OpenTelemetry shutdown complete');
  } catch (error) {
    console.error('❌ Error shutting down OpenTelemetry:', error);
  }
}

/**
 * Get the tracer for creating spans
 */
export function getTracer(name: string = SERVICE_NAME) {
  return trace.getTracer(name, SERVICE_VERSION);
}

/**
 * Get the meter for creating metrics
 */
export function getMeter(name: string = SERVICE_NAME) {
  return metrics.getMeter(name, SERVICE_VERSION);
}

/**
 * Check if OpenTelemetry is initialized
 */
export function isOtelInitialized(): boolean {
  return isInitialized;
}

// Re-export commonly used types and utilities
export { trace, metrics, SpanStatusCode };
export type { Span, Tracer, Meter, Counter, Histogram, ObservableGauge } from '@opentelemetry/api';
