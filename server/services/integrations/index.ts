/**
 * ===============================================
 * INTEGRATIONS INDEX
 * ===============================================
 * @file server/services/integrations/index.ts
 *
 * Barrel file for all integration services.
 * Includes a unified health check for all integrations.
 */

export * from './zapier-service.js';
export * from './slack-service.js';
export * from './stripe-service.js';
export * from './calendar-service.js';

// Default exports for convenience
import zapierService from './zapier-service.js';
import slackService from './slack-service.js';
import stripeService from './stripe-service.js';
import calendarService from './calendar-service.js';
import { getStripeStatus } from './stripe-service.js';
import { isGoogleCalendarConfigured } from './calendar-service.js';
import { getNotificationConfigs } from './slack-service.js';
import { getDatabase } from '../../database/init.js';
import { logger } from '../logger.js';
import { fetchWithTimeout } from '../../utils/fetch-with-timeout.js';

export { zapierService, slackService, stripeService, calendarService };

// =====================================================
// INTEGRATION HEALTH CHECK
// =====================================================

/** Timeout for external connectivity checks (ms) */
const HEALTH_CHECK_TIMEOUT_MS = 5000;

export interface IntegrationHealthStatus {
  name: string;
  configured: boolean;
  healthy: boolean;
  details?: Record<string, unknown>;
  error?: string;
  checkedAt: string;
}

export interface IntegrationHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  integrations: IntegrationHealthStatus[];
  checkedAt: string;
}

/**
 * Check health of Stripe integration
 */
async function checkStripeHealth(): Promise<IntegrationHealthStatus> {
  const status: IntegrationHealthStatus = {
    name: 'stripe',
    configured: false,
    healthy: false,
    checkedAt: new Date().toISOString()
  };

  try {
    const stripeStatus = getStripeStatus();
    status.configured = stripeStatus.configured;
    status.details = {
      mode: stripeStatus.mode,
      webhookConfigured: stripeStatus.webhookConfigured
    };

    if (!stripeStatus.configured) {
      status.healthy = false;
      status.error = 'Stripe secret key not configured';
      return status;
    }

    // Lightweight connectivity check: verify the API key with a balance retrieve
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    try {
      const response = await fetchWithTimeout('https://api.stripe.com/v1/balance', { timeoutMs: 5000,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Stripe-Version': '2023-10-16'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      status.healthy = response.ok;
      if (!response.ok) {
        status.error = `Stripe API returned ${response.status}`;
      }
    } catch (fetchError) {
      clearTimeout(timeout);
      status.healthy = false;
      status.error = fetchError instanceof Error ? fetchError.message : 'Stripe connectivity check failed';
    }
  } catch (error) {
    status.error = error instanceof Error ? error.message : 'Stripe health check failed';
  }

  return status;
}

/**
 * Check health of Google Calendar integration
 */
async function checkCalendarHealth(): Promise<IntegrationHealthStatus> {
  const status: IntegrationHealthStatus = {
    name: 'google_calendar',
    configured: false,
    healthy: false,
    checkedAt: new Date().toISOString()
  };

  try {
    status.configured = isGoogleCalendarConfigured();

    if (!status.configured) {
      status.error = 'Google Calendar OAuth credentials not configured';
      return status;
    }

    // Check if any active calendar sync configs exist in the database
    const db = getDatabase();
    const activeSyncs = await db.get(
      'SELECT COUNT(*) as count FROM calendar_sync_configs WHERE is_active = 1'
    ) as { count: number } | undefined;

    status.details = {
      activeSyncConfigs: activeSyncs?.count ?? 0
    };

    // Configured and reachable (OAuth endpoints are always available; consider healthy if configured)
    status.healthy = true;
  } catch (error) {
    status.error = error instanceof Error ? error.message : 'Calendar health check failed';
  }

  return status;
}

/**
 * Check health of Slack/Discord webhook integrations
 */
async function checkNotificationWebhooksHealth(): Promise<IntegrationHealthStatus> {
  const status: IntegrationHealthStatus = {
    name: 'notification_webhooks',
    configured: false,
    healthy: false,
    checkedAt: new Date().toISOString()
  };

  try {
    const configs = await getNotificationConfigs();
    const activeConfigs = configs.filter((c) => c.is_active);

    status.configured = activeConfigs.length > 0;
    status.details = {
      totalConfigs: configs.length,
      activeConfigs: activeConfigs.length,
      platforms: [...new Set(activeConfigs.map((c) => c.platform))]
    };

    // Considered healthy if at least one active config exists
    // (we do not ping webhook URLs to avoid side effects)
    status.healthy = status.configured;

    if (!status.configured) {
      status.error = 'No active notification webhook configurations';
    }
  } catch (error) {
    status.error = error instanceof Error ? error.message : 'Notification webhook health check failed';
  }

  return status;
}

/**
 * Check health of Zapier webhook integrations
 */
async function checkZapierHealth(): Promise<IntegrationHealthStatus> {
  const status: IntegrationHealthStatus = {
    name: 'zapier',
    configured: false,
    healthy: false,
    checkedAt: new Date().toISOString()
  };

  try {
    const db = getDatabase();
    const activeWebhooks = await db.get(
      'SELECT COUNT(*) as count FROM webhooks WHERE is_active = 1'
    ) as { count: number } | undefined;

    const webhookCount = activeWebhooks?.count ?? 0;
    status.configured = webhookCount > 0;
    status.details = {
      activeWebhooks: webhookCount
    };

    // Considered healthy if configured (webhooks are outbound, no ping needed)
    status.healthy = status.configured;

    if (!status.configured) {
      status.error = 'No active Zapier webhooks configured';
    }
  } catch (error) {
    status.error = error instanceof Error ? error.message : 'Zapier health check failed';
  }

  return status;
}

/**
 * Run health checks on all integrations and return a unified report.
 * This is a lightweight status check, not a full integration test.
 */
export async function checkIntegrationHealth(): Promise<IntegrationHealthReport> {
  const checkedAt = new Date().toISOString();

  try {
    const integrations = await Promise.all([
      checkStripeHealth(),
      checkCalendarHealth(),
      checkNotificationWebhooksHealth(),
      checkZapierHealth()
    ]);

    const configuredIntegrations = integrations.filter((i) => i.configured);
    const healthyCount = configuredIntegrations.filter((i) => i.healthy).length;
    const configuredCount = configuredIntegrations.length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (configuredCount === 0) {
      overall = 'unhealthy';
    } else if (healthyCount === configuredCount) {
      overall = 'healthy';
    } else if (healthyCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return { overall, integrations, checkedAt };
  } catch (error) {
    logger.error('[Integrations] Health check failed:', {
      error: error instanceof Error ? error : undefined
    });

    return {
      overall: 'unhealthy',
      integrations: [],
      checkedAt
    };
  }
}
