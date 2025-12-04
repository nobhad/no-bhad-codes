/**
 * ===============================================
 * ERROR TRACKING SERVICE
 * ===============================================
 * @file server/services/error-tracking.ts
 *
 * Centralized error tracking and monitoring with Sentry integration.
 */

import * as Sentry from '@sentry/node';
// Profiling integration is optional and may not be available in all setups

export interface ErrorContext {
  user?: {
    id: string;
    email?: string;
  };
  request?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  };
  extra?: Record<string, any>;
  tags?: Record<string, string>;
  level?: 'error' | 'warning' | 'info' | 'debug';
}

export class ErrorTrackingService {
  private static instance: ErrorTrackingService;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService();
    }
    return ErrorTrackingService.instance;
  }

  /**
   * Initialize Sentry with configuration
   */
  init(
    config: {
      dsn?: string;
      environment?: string;
      release?: string;
      enableProfiling?: boolean;
      sampleRate?: number;
      tracesSampleRate?: number;
    } = {}
  ): void {
    const {
      dsn = process.env.SENTRY_DSN,
      environment = process.env.NODE_ENV || 'development',
      release = process.env.npm_package_version || '1.0.0',
      enableProfiling = false,
      sampleRate = environment === 'production' ? 1.0 : 0.1,
      tracesSampleRate = environment === 'production' ? 0.1 : 1.0,
    } = config;

    // Check if DSN is missing or a placeholder value
    if (!dsn || dsn.includes('your-sentry') || dsn.includes('placeholder') || !dsn.startsWith('https://')) {
      if (dsn && dsn !== '') {
        console.warn('⚠️ Invalid Sentry DSN detected (placeholder or malformed). Error tracking disabled.');
      } else {
        console.warn('⚠️ Sentry DSN not provided. Error tracking disabled.');
      }
      return;
    }

    const integrations = [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      Sentry.graphqlIntegration(),
    ];

    // Profiling integration is optional and may not be available
    if (enableProfiling) {
      try {
        const { nodeProfilingIntegration } = require('@sentry/profiling-node');
        integrations.push(nodeProfilingIntegration());
      } catch (error: any) {
        console.warn(
          '⚠️ Sentry profiling integration not available:',
          error?.message || 'Unknown error'
        );
      }
    }

    Sentry.init({
      dsn,
      environment,
      release,
      sampleRate,
      tracesSampleRate,
      integrations,
      beforeSend(event) {
        // Filter out sensitive information
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }

        if (event.request?.data) {
          if (typeof event.request.data === 'object' && event.request.data !== null) {
            delete (event.request.data as any).password;
            delete (event.request.data as any).token;
          }
        }

        return event;
      },
      beforeSendTransaction(event) {
        // Filter sensitive data from transactions
        return event;
      },
    });

    this.isInitialized = true;
    console.log(`✅ Sentry initialized for ${environment} environment`);
  }

  /**
   * Capture an exception with context
   */
  captureException(error: Error, context: ErrorContext = {}): string {
    if (!this.isInitialized) {
      console.error('Error Tracking not initialized:', error);
      return '';
    }

    return Sentry.withScope((scope) => {
      // Set user context
      if (context.user) {
        scope.setUser({
          id: context.user.id,
          email: context.user.email,
        });
      }

      // Set request context
      if (context.request) {
        scope.setContext('request', {
          method: context.request.method,
          url: context.request.url,
          headers: context.request.headers,
        });
      }

      // Set extra context
      if (context.extra) {
        Object.keys(context.extra).forEach((key) => {
          scope.setExtra(key, context.extra![key]);
        });
      }

      // Set tags
      if (context.tags) {
        Object.keys(context.tags).forEach((key) => {
          scope.setTag(key, context.tags![key]);
        });
      }

      // Set level
      if (context.level) {
        scope.setLevel(context.level);
      }

      return Sentry.captureException(error);
    });
  }

  /**
   * Capture a message with context
   */
  captureMessage(
    message: string,
    level: 'error' | 'warning' | 'info' | 'debug' = 'info',
    context: ErrorContext = {}
  ): string {
    if (!this.isInitialized) {
      console.log(`[${level.toUpperCase()}]`, message);
      return '';
    }

    return Sentry.withScope((scope) => {
      if (context.user) {
        scope.setUser({
          id: context.user.id,
          email: context.user.email,
        });
      }

      if (context.extra) {
        Object.keys(context.extra).forEach((key) => {
          scope.setExtra(key, context.extra![key]);
        });
      }

      if (context.tags) {
        Object.keys(context.tags).forEach((key) => {
          scope.setTag(key, context.tags![key]);
        });
      }

      scope.setLevel(level);

      return Sentry.captureMessage(message, level);
    });
  }

  /**
   * Start a performance transaction
   */
  startTransaction(name: string, operation: string = 'http'): any {
    if (!this.isInitialized) {
      return undefined;
    }

    // Use Sentry's current transaction API
    return Sentry.startSpan(
      {
        name,
        op: operation,
      },
      (span) => {
        return span;
      }
    );
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(breadcrumb: {
    message: string;
    category?: string;
    level?: 'error' | 'warning' | 'info' | 'debug';
    data?: Record<string, any>;
  }): void {
    if (!this.isInitialized) {
      return;
    }

    Sentry.addBreadcrumb({
      message: breadcrumb.message,
      category: breadcrumb.category || 'custom',
      level: breadcrumb.level || 'info',
      data: breadcrumb.data,
      timestamp: Date.now() / 1000,
    });
  }

  /**
   * Set user context globally
   */
  setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.isInitialized) {
      return;
    }

    Sentry.setUser(user);
  }

  /**
   * Set tags globally
   */
  setTags(tags: Record<string, string>): void {
    if (!this.isInitialized) {
      return;
    }

    Sentry.setTags(tags);
  }

  /**
   * Flush pending events (useful before shutdown)
   */
  async flush(timeout: number = 2000): Promise<boolean> {
    if (!this.isInitialized) {
      return true;
    }

    return Sentry.flush(timeout);
  }

  /**
   * Close Sentry client
   */
  async close(timeout: number = 2000): Promise<boolean> {
    if (!this.isInitialized) {
      return true;
    }

    return Sentry.close(timeout);
  }

  /**
   * Express error handler middleware
   */
  errorHandler() {
    return Sentry.expressErrorHandler({
      shouldHandleError(error) {
        // Log all errors to Sentry
        return true;
      },
    });
  }

  /**
   * Express request handler middleware
   */
  requestHandler() {
    return Sentry.expressIntegration();
  }

  /**
   * Get Sentry instance for advanced usage
   */
  getSentry(): typeof Sentry {
    return Sentry;
  }
}

// Export singleton instance
export const errorTracker = ErrorTrackingService.getInstance();
