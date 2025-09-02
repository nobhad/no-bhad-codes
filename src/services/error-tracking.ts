/**
 * ===============================================
 * FRONTEND ERROR TRACKING SERVICE
 * ===============================================
 * @file src/services/error-tracking.ts
 *
 * Frontend error tracking and monitoring with Sentry integration.
 */

import * as Sentry from '@sentry/browser';
import { BaseService } from './base-service';

export interface FrontendErrorContext {
  user?: {
    id: string;
    email?: string;
  };
  page?: {
    url: string;
    referrer?: string;
    userAgent?: string;
  };
  component?: string;
  action?: string;
  extra?: Record<string, any>;
  tags?: Record<string, string>;
  level?: 'error' | 'warning' | 'info' | 'debug';
}

export class FrontendErrorTrackingService extends BaseService {

  constructor() {
    super('ErrorTrackingService');
  }

  async init(config: {
    dsn?: string;
    environment?: string;
    release?: string;
    sampleRate?: number;
    tracesSampleRate?: number;
    enableUserFeedback?: boolean;
  } = {}): Promise<void> {
    const {
      dsn = this.getDsnFromMeta(),
      environment = this.getEnvironment(),
      release = this.getRelease(),
      sampleRate = environment === 'production' ? 1.0 : 0.1,
      tracesSampleRate = environment === 'production' ? 0.1 : 1.0,
      enableUserFeedback = true
    } = config;

    if (!dsn) {
      this.warn('Sentry DSN not provided. Error tracking disabled.');
      return;
    }

    try {
      Sentry.init({
        dsn,
        environment,
        release,
        sampleRate,
        tracesSampleRate,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            maskAllText: environment === 'production',
            blockAllMedia: environment === 'production'
          }),
          Sentry.feedbackIntegration({
            colorScheme: 'system',
            enableUserFeedback,
            showBranding: false
          })
        ],
        beforeSend(event, hint) {
          // Filter out development noise
          if (environment === 'development') {
            const error = hint.originalException;
            if (error instanceof Error && error.message.includes('ResizeObserver loop limit exceeded')) {
              return null;
            }
          }

          // Remove sensitive information
          if (event.request?.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }

          return event;
        },
        beforeSendTransaction(event) {
          // Filter out development transactions
          if (environment === 'development' && event.transaction?.includes('localhost')) {
            return null;
          }
          return event;
        }
      });

      this.isInitialized = true;
      this.log(`Error tracking initialized for ${environment} environment`);
      
      // Set initial context
      this.setInitialContext();
      
    } catch (error) {
      this.error('Failed to initialize error tracking:', error);
    }
  }

  /**
   * Capture an exception with context
   */
  captureException(error: Error, context: FrontendErrorContext = {}): string {
    if (!this.isInitialized) {
      console.error('Error tracking not initialized:', error);
      return '';
    }

    return Sentry.withScope(scope => {
      // Set user context
      if (context.user) {
        scope.setUser({
          id: context.user.id,
          email: context.user.email
        });
      }

      // Set page context
      if (context.page) {
        scope.setContext('page', context.page);
      } else {
        scope.setContext('page', {
          url: window.location.href,
          referrer: document.referrer,
          userAgent: navigator.userAgent
        });
      }

      // Set component context
      if (context.component) {
        scope.setTag('component', context.component);
      }

      // Set action context
      if (context.action) {
        scope.setTag('action', context.action);
      }

      // Set extra context
      if (context.extra) {
        Object.keys(context.extra).forEach(key => {
          scope.setExtra(key, context.extra![key]);
        });
      }

      // Set tags
      if (context.tags) {
        Object.keys(context.tags).forEach(key => {
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
  captureMessage(message: string, level: 'error' | 'warning' | 'info' | 'debug' = 'info', context: FrontendErrorContext = {}): string {
    if (!this.isInitialized) {
      console.log(`[${level.toUpperCase()}]`, message);
      return '';
    }

    return Sentry.withScope(scope => {
      // Apply context similar to captureException
      if (context.user) {
        scope.setUser(context.user);
      }

      if (context.component) {
        scope.setTag('component', context.component);
      }

      if (context.action) {
        scope.setTag('action', context.action);
      }

      if (context.extra) {
        Object.keys(context.extra).forEach(key => {
          scope.setExtra(key, context.extra![key]);
        });
      }

      if (context.tags) {
        Object.keys(context.tags).forEach(key => {
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
  startTransaction(name: string, operation: string = 'navigation'): any {
    if (!this.isInitialized) {
      return undefined;
    }

    // Use Sentry's current API for browser
    return Sentry.startSpan({
      name,
      op: operation
    }, (span) => {
      return span;
    });
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
      timestamp: Date.now() / 1000
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
   * Show user feedback dialog
   */
  showFeedbackDialog(): void {
    if (!this.isInitialized) {
      return;
    }

    // Show feedback dialog with current user if available
    Sentry.showReportDialog();
  }

  /**
   * Get Sentry instance for advanced usage
   */
  getSentry(): typeof Sentry {
    return Sentry;
  }

  // Private helper methods

  private getDsnFromMeta(): string | undefined {
    const metaTag = document.querySelector('meta[name="sentry-dsn"]');
    return metaTag?.getAttribute('content') || undefined;
  }

  private getEnvironment(): string {
    const metaTag = document.querySelector('meta[name="app-environment"]');
    return metaTag?.getAttribute('content') || 
           (window.location.hostname === 'localhost' ? 'development' : 'production');
  }

  private getRelease(): string {
    const metaTag = document.querySelector('meta[name="app-version"]');
    return metaTag?.getAttribute('content') || '1.0.0';
  }

  private setInitialContext(): void {
    // Set browser and device information
    Sentry.setContext('browser', {
      name: this.getBrowserName(),
      version: this.getBrowserVersion(),
      userAgent: navigator.userAgent
    });

    Sentry.setContext('device', {
      type: this.getDeviceType(),
      pixelRatio: window.devicePixelRatio,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`
    });

    // Set initial page context
    Sentry.setContext('page', {
      url: window.location.href,
      referrer: document.referrer,
      title: document.title
    });
  }

  private getBrowserName(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private getBrowserVersion(): string {
    const userAgent = navigator.userAgent;
    const match = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/);
    return match ? match[2] : 'Unknown';
  }

  private getDeviceType(): string {
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      return 'mobile';
    }
    if (/iPad|Android(?=.*\bMobile\b)/i.test(navigator.userAgent)) {
      return 'tablet';
    }
    return 'desktop';
  }
}

// Export singleton instance
export const frontendErrorTracker = new FrontendErrorTrackingService();