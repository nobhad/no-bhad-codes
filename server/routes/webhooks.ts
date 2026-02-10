/**
 * Webhook Routes
 * Admin API for webhook configuration and delivery management
 */

import { Router, Request, Response } from 'express';
import { webhookService } from '../services/webhook-service.js';
import { WebhookConfig } from '../models/webhook.js';

const router = Router();

/**
 * GET /api/v1/webhooks
 * List all webhooks
 */
router.get('/webhooks', async (req: Request, res: Response) => {
  try {
    const webhooks = await webhookService.listWebhooks();
    res.json({ webhooks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list webhooks' });
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
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Don't expose secret key in response
    const { secret_key, ...safe } = webhook;
    res.json({ webhook: safe });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve webhook' });
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
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Events must be non-empty array' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Validate payload template is valid JSON
    try {
      JSON.parse(payloadTemplate);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON in payloadTemplate' });
    }

    const webhook = await webhookService.createWebhook(name, url, events, payloadTemplate, {
      method: method || 'POST',
      headers: headers || {},
      retryMaxAttempts,
      retryBackoffSeconds
    });

    // Don't expose secret key
    const { secret_key, ...safe } = webhook;
    res.status(201).json({ webhook: safe });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create webhook' });
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
        return res.status(400).json({ error: 'Invalid JSON in payload_template' });
      }
    }

    const webhook = await webhookService.updateWebhook(parseInt(id), req.body);
    const { secret_key, ...safe } = webhook;
    res.json({ webhook: safe });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.status(500).json({ error: 'Failed to update webhook' });
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
    res.json({ message: 'Webhook deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete webhook' });
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
      return res.status(400).json({ error: 'Active must be boolean' });
    }

    const webhook = await webhookService.toggleWebhook(parseInt(id), active);
    const { secret_key, ...safe } = webhook;
    res.json({ webhook: safe });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.status(500).json({ error: 'Failed to toggle webhook' });
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
      return res.status(400).json({ error: 'eventType is required' });
    }

    const webhook = await webhookService.getWebhookById(parseInt(id));

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Trigger test event
    await webhookService.triggerEvent(eventType, sampleData || { test: true });

    res.json({ message: 'Test webhook triggered', eventType });
  } catch (error) {
    res.status(500).json({ error: 'Failed to test webhook' });
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

    res.json({
      deliveries: result.deliveries,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list deliveries' });
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
      return res.status(404).json({ error: 'Delivery not found' });
    }

    res.json({ delivery });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve delivery' });
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
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve statistics' });
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
      return res.status(400).json({ error: 'deliveryId is required' });
    }

    const delivery = await webhookService.getDeliveryById(deliveryId);
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    // Trigger retry immediately
    await webhookService.processPendingRetries();

    res.json({ message: 'Delivery queued for retry', deliveryId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retry delivery' });
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

    res.json({
      message: 'Secret regenerated successfully',
      secret_key: newSecret,
      warning: 'Update any consumers of this webhook with the new secret key'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to regenerate secret' });
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
      return res.status(400).json({ error: 'eventType is required' });
    }

    await webhookService.triggerEvent(eventType, data || {});

    res.json({ message: 'Event triggered', eventType, webhooksMatched: 'See logs for details' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger event' });
  }
});

export default router;
