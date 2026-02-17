/**
 * Webhook Routes
 * Admin API for webhook configuration and delivery management
 */

import { Router, Request, Response } from 'express';
import { webhookService } from '../services/webhook-service.js';
import { WebhookConfig } from '../models/webhook.js';
import { errorResponse, sendSuccess, sendCreated } from '../utils/api-response.js';
import { logger } from '../services/logger.js';

const router = Router();

/**
 * GET /api/v1/webhooks
 * List all webhooks
 */
router.get('/webhooks', async (req: Request, res: Response) => {
  try {
    const webhooks = await webhookService.listWebhooks();
    sendSuccess(res, { webhooks });
  } catch (error) {
    logger.error('[Webhooks] Failed to list webhooks', { error: error instanceof Error ? error : new Error(String(error)), category: 'WEBHOOK' });
    errorResponse(res, 'Failed to list webhooks', 500, 'INTERNAL_ERROR');
  }
});

/**
 * GET /api/v1/webhooks/:id
 * Get webhook by ID
 */
router.get('/webhooks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const webhook = await webhookService.getWebhookById(parseInt(id));

    if (!webhook) {
      return errorResponse(res, 'Webhook not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // Don't expose secret key in response
    const { secret_key, ...safe } = webhook;
    sendSuccess(res, { webhook: safe });
  } catch (error) {
    logger.error('[Webhooks] Failed to retrieve webhook', { error: error instanceof Error ? error : new Error(String(error)), category: 'WEBHOOK' });
    errorResponse(res, 'Failed to retrieve webhook', 500, 'INTERNAL_ERROR');
  }
});

/**
 * POST /api/v1/webhooks
 * Create new webhook
 * Body: { name, url, events[], payloadTemplate, method?, headers? }
 */
router.post('/webhooks', async (req: Request, res: Response) => {
  try {
    const { name, url, events, payloadTemplate, method, headers, retryMaxAttempts, retryBackoffSeconds } =
      req.body;

    if (!name || !url || !events || !payloadTemplate) {
      return errorResponse(res, 'Missing required fields', 400, 'VALIDATION_ERROR');
    }

    if (!Array.isArray(events) || events.length === 0) {
      return errorResponse(res, 'Events must be non-empty array', 400, 'VALIDATION_ERROR');
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return errorResponse(res, 'Invalid URL', 400, 'VALIDATION_ERROR');
    }

    // Validate payload template is valid JSON
    try {
      JSON.parse(payloadTemplate);
    } catch {
      return errorResponse(res, 'Invalid JSON in payloadTemplate', 400, 'VALIDATION_ERROR');
    }

    const webhook = await webhookService.createWebhook(name, url, events, payloadTemplate, {
      method: method || 'POST',
      headers: headers || {},
      retryMaxAttempts,
      retryBackoffSeconds
    });

    // Don't expose secret key
    const { secret_key, ...safe } = webhook;
    sendCreated(res, { webhook: safe });
  } catch (error) {
    logger.error('[Webhooks] Failed to create webhook', { error: error instanceof Error ? error : new Error(String(error)), category: 'WEBHOOK' });
    errorResponse(res, 'Failed to create webhook', 500, 'INTERNAL_ERROR');
  }
});

/**
 * PUT /api/v1/webhooks/:id
 * Update webhook configuration
 */
router.put('/webhooks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate payload template if provided
    if (req.body.payload_template) {
      try {
        JSON.parse(req.body.payload_template);
      } catch {
        return errorResponse(res, 'Invalid JSON in payload_template', 400, 'VALIDATION_ERROR');
      }
    }

    const webhook = await webhookService.updateWebhook(parseInt(id), req.body);
    const { secret_key, ...safe } = webhook;
    sendSuccess(res, { webhook: safe });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return errorResponse(res, 'Webhook not found', 404, 'RESOURCE_NOT_FOUND');
    }
    logger.error('[Webhooks] Failed to update webhook', { error: error instanceof Error ? error : new Error(String(error)), category: 'WEBHOOK' });
    errorResponse(res, 'Failed to update webhook', 500, 'INTERNAL_ERROR');
  }
});

/**
 * DELETE /api/v1/webhooks/:id
 * Delete webhook (and all associated deliveries)
 */
router.delete('/webhooks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await webhookService.deleteWebhook(parseInt(id));
    sendSuccess(res, undefined, 'Webhook deleted');
  } catch (error) {
    logger.error('[Webhooks] Failed to delete webhook', { error: error instanceof Error ? error : new Error(String(error)), category: 'WEBHOOK' });
    errorResponse(res, 'Failed to delete webhook', 500, 'INTERNAL_ERROR');
  }
});

/**
 * PATCH /api/v1/webhooks/:id/toggle
 * Toggle webhook active/inactive
 * Body: { active: boolean }
 */
router.patch('/webhooks/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return errorResponse(res, 'Active must be boolean', 400, 'VALIDATION_ERROR');
    }

    const webhook = await webhookService.toggleWebhook(parseInt(id), active);
    const { secret_key, ...safe } = webhook;
    sendSuccess(res, { webhook: safe });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return errorResponse(res, 'Webhook not found', 404, 'RESOURCE_NOT_FOUND');
    }
    logger.error('[Webhooks] Failed to toggle webhook', { error: error instanceof Error ? error : new Error(String(error)), category: 'WEBHOOK' });
    errorResponse(res, 'Failed to toggle webhook', 500, 'INTERNAL_ERROR');
  }
});

/**
 * POST /api/v1/webhooks/:id/test
 * Test webhook by sending sample payload
 * Body: { eventType, sampleData? }
 */
router.post('/webhooks/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { eventType, sampleData } = req.body;

    if (!eventType) {
      return errorResponse(res, 'eventType is required', 400, 'VALIDATION_ERROR');
    }

    const webhook = await webhookService.getWebhookById(parseInt(id));

    if (!webhook) {
      return errorResponse(res, 'Webhook not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // Trigger test event
    await webhookService.triggerEvent(eventType, sampleData || { test: true });

    sendSuccess(res, { eventType }, 'Test webhook triggered');
  } catch (error) {
    logger.error('[Webhooks] Failed to test webhook', { error: error instanceof Error ? error : new Error(String(error)), category: 'WEBHOOK' });
    errorResponse(res, 'Failed to test webhook', 500, 'INTERNAL_ERROR');
  }
});

/**
 * GET /api/v1/webhooks/:id/deliveries
 * List webhook deliveries with filtering
 * Query: status?, eventType?, limit?, offset?
 */
router.get('/webhooks/:id/deliveries', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, eventType, limit = 50, offset = 0 } = req.query;

    const result = await webhookService.getWebhookDeliveries(parseInt(id), {
      status: status as string | undefined,
      eventType: eventType as string | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    sendSuccess(res, {
      deliveries: result.deliveries,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) {
    logger.error('[Webhooks] Failed to list deliveries', { error: error instanceof Error ? error : new Error(String(error)), category: 'WEBHOOK' });
    errorResponse(res, 'Failed to list deliveries', 500, 'INTERNAL_ERROR');
  }
});

/**
 * GET /api/v1/webhooks/:id/deliveries/:deliveryId
 * Get specific delivery details
 */
router.get('/webhooks/:id/deliveries/:deliveryId', async (req: Request, res: Response) => {
  try {
    const { deliveryId } = req.params;

    const delivery = await webhookService.getDeliveryById(parseInt(deliveryId));

    if (!delivery) {
      return errorResponse(res, 'Delivery not found', 404, 'RESOURCE_NOT_FOUND');
    }

    sendSuccess(res, { delivery });
  } catch (error) {
    logger.error('[Webhooks] Failed to retrieve delivery', { error: error instanceof Error ? error : new Error(String(error)), category: 'WEBHOOK' });
    errorResponse(res, 'Failed to retrieve delivery', 500, 'INTERNAL_ERROR');
  }
});

/**
 * GET /api/v1/webhooks/:id/stats
 * Get delivery statistics for webhook
 */
router.get('/webhooks/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stats = await webhookService.getDeliveryStats(parseInt(id));
    sendSuccess(res, { stats });
  } catch (error) {
    logger.error('[Webhooks] Failed to retrieve statistics', { error: error instanceof Error ? error : new Error(String(error)), category: 'WEBHOOK' });
    errorResponse(res, 'Failed to retrieve statistics', 500, 'INTERNAL_ERROR');
  }
});

/**
 * POST /api/v1/webhooks/:id/retry
 * Manually retry failed delivery
 * Body: { deliveryId }
 */
router.post('/webhooks/:id/retry', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { deliveryId } = req.body;

    if (!deliveryId) {
      return errorResponse(res, 'deliveryId is required', 400, 'VALIDATION_ERROR');
    }

    const delivery = await webhookService.getDeliveryById(deliveryId);
    if (!delivery) {
      return errorResponse(res, 'Delivery not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // Trigger retry immediately
    await webhookService.processPendingRetries();

    sendSuccess(res, { deliveryId }, 'Delivery queued for retry');
  } catch (error) {
    logger.error('[Webhooks] Failed to retry delivery', { error: error instanceof Error ? error : new Error(String(error)), category: 'WEBHOOK' });
    errorResponse(res, 'Failed to retry delivery', 500, 'INTERNAL_ERROR');
  }
});

/**
 * POST /api/v1/webhooks/:id/secret/regenerate
 * Regenerate webhook secret key for security rotation
 */
router.post('/webhooks/:id/secret/regenerate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const newSecret = await webhookService.regenerateSecret(parseInt(id));

    sendSuccess(res, {
      secret_key: newSecret,
      warning: 'Update any consumers of this webhook with the new secret key'
    }, 'Secret regenerated successfully');
  } catch (error) {
    logger.error('[Webhooks] Failed to regenerate secret', { error: error instanceof Error ? error : new Error(String(error)), category: 'WEBHOOK' });
    errorResponse(res, 'Failed to regenerate secret', 500, 'INTERNAL_ERROR');
  }
});

/**
 * POST /api/v1/webhooks/events/trigger
 * Manually trigger webhook event (for testing/validation)
 * Body: { eventType, data? }
 */
router.post('/events/trigger', async (req: Request, res: Response) => {
  try {
    const { eventType, data } = req.body;

    if (!eventType) {
      return errorResponse(res, 'eventType is required', 400, 'VALIDATION_ERROR');
    }

    await webhookService.triggerEvent(eventType, data || {});

    sendSuccess(res, { eventType, webhooksMatched: 'See logs for details' }, 'Event triggered');
  } catch (error) {
    logger.error('[Webhooks] Failed to trigger event', { error: error instanceof Error ? error : new Error(String(error)), category: 'WEBHOOK' });
    errorResponse(res, 'Failed to trigger event', 500, 'INTERNAL_ERROR');
  }
});

export default router;
