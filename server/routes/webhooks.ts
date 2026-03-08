/**
 * Webhook Routes
 * Admin API for webhook configuration and delivery management
 */

import { Router, Response } from 'express';
import { webhookService } from '../services/webhook-service.js';
import { errorResponse, sendSuccess, sendCreated, sanitizeErrorMessage, ErrorCodes } from '../utils/api-response.js';
import { logger } from '../services/logger.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateRequest, ValidationSchema } from '../middleware/validation.js';

const router = Router();

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const WEBHOOK_NAME_MAX_LENGTH = 200;
const WEBHOOK_URL_MAX_LENGTH = 2000;
const WEBHOOK_EVENTS_MAX = 50;
const PAYLOAD_TEMPLATE_MAX_LENGTH = 50000;
const EVENT_TYPE_MAX_LENGTH = 100;
const RETRY_MAX_ATTEMPTS = 10;
const RETRY_BACKOFF_MAX_SECONDS = 3600;
const HTTP_METHOD_VALUES = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const WebhookValidationSchemas = {
  create: {
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: WEBHOOK_NAME_MAX_LENGTH }
    ],
    url: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: WEBHOOK_URL_MAX_LENGTH }
    ],
    events: [
      { type: 'required' as const },
      { type: 'array' as const, minLength: 1, maxLength: WEBHOOK_EVENTS_MAX }
    ],
    payloadTemplate: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: PAYLOAD_TEMPLATE_MAX_LENGTH }
    ],
    method: { type: 'string' as const, allowedValues: HTTP_METHOD_VALUES },
    headers: { type: 'object' as const },
    retryMaxAttempts: { type: 'number' as const, min: 0, max: RETRY_MAX_ATTEMPTS },
    retryBackoffSeconds: { type: 'number' as const, min: 1, max: RETRY_BACKOFF_MAX_SECONDS }
  } as ValidationSchema,

  update: {
    name: { type: 'string' as const, minLength: 1, maxLength: WEBHOOK_NAME_MAX_LENGTH },
    url: { type: 'string' as const, minLength: 1, maxLength: WEBHOOK_URL_MAX_LENGTH },
    events: { type: 'array' as const, maxLength: WEBHOOK_EVENTS_MAX },
    payload_template: { type: 'string' as const, maxLength: PAYLOAD_TEMPLATE_MAX_LENGTH },
    method: { type: 'string' as const, allowedValues: HTTP_METHOD_VALUES },
    headers: { type: 'object' as const }
  } as ValidationSchema,

  toggle: {
    active: [
      { type: 'required' as const },
      { type: 'boolean' as const }
    ]
  } as ValidationSchema,

  test: {
    eventType: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: EVENT_TYPE_MAX_LENGTH }
    ],
    sampleData: { type: 'object' as const }
  } as ValidationSchema,

  retry: {
    deliveryId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ]
  } as ValidationSchema,

  triggerEvent: {
    eventType: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: EVENT_TYPE_MAX_LENGTH }
    ],
    data: { type: 'object' as const }
  } as ValidationSchema
};

// All webhook routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * @swagger
 * /api/webhooks/webhooks:
 *   get:
 *     tags: [Webhooks]
 *     summary: List all webhooks
 *     description: Returns all configured webhooks.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of webhooks
 *       500:
 *         description: Internal error
 */
router.get('/webhooks', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const webhooks = await webhookService.listWebhooks();
    sendSuccess(res, { webhooks });
  } catch (error) {
    logger.error('[Webhooks] Failed to list webhooks', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'WEBHOOK'
    });
    errorResponse(res, 'Failed to list webhooks', 500, ErrorCodes.INTERNAL_ERROR);
  }
}));

/**
 * @swagger
 * /api/webhooks/webhooks/{id}:
 *   get:
 *     tags: [Webhooks]
 *     summary: Get webhook by ID
 *     description: Returns a specific webhook configuration (secret key excluded).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Webhook details
 *       404:
 *         description: Webhook not found
 */
router.get('/webhooks/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const webhookId = parseInt(id, 10);
    if (isNaN(webhookId) || webhookId <= 0) {
      return errorResponse(res, 'Invalid webhook ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const webhook = await webhookService.getWebhookById(webhookId);

    if (!webhook) {
      return errorResponse(res, 'Webhook not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Don't expose secret key in response
    const { secret_key: _secret_key, ...safe } = webhook;
    sendSuccess(res, { webhook: safe });
  } catch (error) {
    logger.error('[Webhooks] Failed to retrieve webhook', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'WEBHOOK'
    });
    errorResponse(res, 'Failed to retrieve webhook', 500, ErrorCodes.INTERNAL_ERROR);
  }
}));

/**
 * @swagger
 * /api/webhooks/webhooks:
 *   post:
 *     tags: [Webhooks]
 *     summary: Create a new webhook
 *     description: Creates a new webhook with URL, events, and payload template.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, url, events, payloadTemplate]
 *             properties:
 *               name:
 *                 type: string
 *               url:
 *                 type: string
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *               payloadTemplate:
 *                 type: string
 *               method:
 *                 type: string
 *                 enum: [GET, POST, PUT, PATCH, DELETE]
 *               headers:
 *                 type: object
 *     responses:
 *       201:
 *         description: Webhook created
 *       400:
 *         description: Validation error
 */
router.post('/webhooks', validateRequest(WebhookValidationSchemas.create, { allowUnknownFields: true }), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      url,
      events,
      payloadTemplate,
      method,
      headers,
      retryMaxAttempts,
      retryBackoffSeconds
    } = req.body;

    if (!name || !url || !events || !payloadTemplate) {
      return errorResponse(res, 'Missing required fields', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!Array.isArray(events) || events.length === 0) {
      return errorResponse(res, 'Events must be non-empty array', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return errorResponse(res, 'Invalid URL', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate payload template is valid JSON
    try {
      JSON.parse(payloadTemplate);
    } catch {
      return errorResponse(res, 'Invalid JSON in payloadTemplate', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const webhook = await webhookService.createWebhook(name, url, events, payloadTemplate, {
      method: method || 'POST',
      headers: headers || {},
      retryMaxAttempts,
      retryBackoffSeconds
    });

    // Don't expose secret key
    const { secret_key: _secret_key, ...safe } = webhook;
    sendCreated(res, { webhook: safe });
  } catch (error) {
    logger.error('[Webhooks] Failed to create webhook', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'WEBHOOK'
    });
    errorResponse(res, 'Failed to create webhook', 500, ErrorCodes.INTERNAL_ERROR);
  }
}));

/**
 * @swagger
 * /api/webhooks/webhooks/{id}:
 *   put:
 *     tags: [Webhooks]
 *     summary: Update webhook configuration
 *     description: Updates an existing webhook configuration.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Webhook updated
 *       404:
 *         description: Webhook not found
 */
router.put('/webhooks/:id', validateRequest(WebhookValidationSchemas.update, { allowUnknownFields: true }), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const webhookId = parseInt(id, 10);
    if (isNaN(webhookId) || webhookId <= 0) {
      return errorResponse(res, 'Invalid webhook ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate payload template if provided
    if (req.body.payload_template) {
      try {
        JSON.parse(req.body.payload_template);
      } catch {
        return errorResponse(res, 'Invalid JSON in payload_template', 400, ErrorCodes.VALIDATION_ERROR);
      }
    }

    const webhook = await webhookService.updateWebhook(webhookId, req.body);
    const { secret_key: _secret_key, ...safe } = webhook;
    sendSuccess(res, { webhook: safe });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : '';
    if (rawMessage.includes('not found')) {
      return errorResponse(res, 'Webhook not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    logger.error('[Webhooks] Failed to update webhook', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'WEBHOOK'
    });
    errorResponse(res, sanitizeErrorMessage(error, 'Failed to update webhook'), 500, ErrorCodes.INTERNAL_ERROR);
  }
}));

/**
 * @swagger
 * /api/webhooks/webhooks/{id}:
 *   delete:
 *     tags: [Webhooks]
 *     summary: Delete a webhook
 *     description: Deletes a webhook and all associated deliveries.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Webhook deleted
 *       500:
 *         description: Internal error
 */
router.delete('/webhooks/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const webhookId = parseInt(id, 10);
    if (isNaN(webhookId) || webhookId <= 0) {
      return errorResponse(res, 'Invalid webhook ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    await webhookService.deleteWebhook(webhookId);
    sendSuccess(res, undefined, 'Webhook deleted');
  } catch (error) {
    logger.error('[Webhooks] Failed to delete webhook', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'WEBHOOK'
    });
    errorResponse(res, 'Failed to delete webhook', 500, ErrorCodes.INTERNAL_ERROR);
  }
}));

/**
 * @swagger
 * /api/webhooks/webhooks/{id}/toggle:
 *   patch:
 *     tags: [Webhooks]
 *     summary: Toggle webhook active/inactive
 *     description: Toggles a webhook between active and inactive states.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [active]
 *             properties:
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Webhook toggled
 *       404:
 *         description: Webhook not found
 */
router.patch('/webhooks/:id/toggle', validateRequest(WebhookValidationSchemas.toggle), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const webhookId = parseInt(id, 10);
    if (isNaN(webhookId) || webhookId <= 0) {
      return errorResponse(res, 'Invalid webhook ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return errorResponse(res, 'Active must be boolean', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const webhook = await webhookService.toggleWebhook(webhookId, active);
    const { secret_key: _secret_key, ...safe } = webhook;
    sendSuccess(res, { webhook: safe });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : '';
    if (rawMessage.includes('not found')) {
      return errorResponse(res, 'Webhook not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    logger.error('[Webhooks] Failed to toggle webhook', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'WEBHOOK'
    });
    errorResponse(res, sanitizeErrorMessage(error, 'Failed to toggle webhook'), 500, ErrorCodes.INTERNAL_ERROR);
  }
}));

/**
 * @swagger
 * /api/webhooks/webhooks/{id}/test:
 *   post:
 *     tags: [Webhooks]
 *     summary: Test a webhook
 *     description: Tests a webhook by sending a sample payload.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventType]
 *             properties:
 *               eventType:
 *                 type: string
 *               sampleData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Test webhook triggered
 *       404:
 *         description: Webhook not found
 */
router.post('/webhooks/:id/test', validateRequest(WebhookValidationSchemas.test, { allowUnknownFields: true }), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const webhookId = parseInt(id, 10);
    if (isNaN(webhookId) || webhookId <= 0) {
      return errorResponse(res, 'Invalid webhook ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { eventType, sampleData } = req.body;

    if (!eventType) {
      return errorResponse(res, 'eventType is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const webhook = await webhookService.getWebhookById(webhookId);

    if (!webhook) {
      return errorResponse(res, 'Webhook not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Trigger test event
    await webhookService.triggerEvent(eventType, sampleData || { test: true });

    sendSuccess(res, { eventType }, 'Test webhook triggered');
  } catch (error) {
    logger.error('[Webhooks] Failed to test webhook', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'WEBHOOK'
    });
    errorResponse(res, 'Failed to test webhook', 500, ErrorCodes.INTERNAL_ERROR);
  }
}));

/**
 * @swagger
 * /api/webhooks/webhooks/{id}/deliveries:
 *   get:
 *     tags: [Webhooks]
 *     summary: List webhook deliveries
 *     description: Returns webhook delivery history with filtering and pagination.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, success, failed]
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of deliveries with pagination
 */
router.get('/webhooks/:id/deliveries', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const webhookId = parseInt(id, 10);
    if (isNaN(webhookId) || webhookId <= 0) {
      return errorResponse(res, 'Invalid webhook ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { status, eventType, limit = '50', offset = '0' } = req.query;
    const parsedLimit = parseInt(limit as string, 10);
    const parsedOffset = parseInt(offset as string, 10);
    if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
      return errorResponse(res, 'Invalid pagination parameters', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const validStatuses = ['pending', 'success', 'failed'] as const;
    const statusFilter = status && validStatuses.includes(status as typeof validStatuses[number])
      ? status as 'pending' | 'success' | 'failed'
      : undefined;

    const result = await webhookService.getWebhookDeliveries(webhookId, {
      status: statusFilter,
      eventType: eventType as string | undefined,
      limit: parsedLimit,
      offset: parsedOffset
    });

    sendSuccess(res, {
      deliveries: result.deliveries,
      pagination: {
        total: result.total,
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
  } catch (error) {
    logger.error('[Webhooks] Failed to list deliveries', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'WEBHOOK'
    });
    errorResponse(res, 'Failed to list deliveries', 500, ErrorCodes.INTERNAL_ERROR);
  }
}));

/**
 * @swagger
 * /api/webhooks/webhooks/{id}/deliveries/{deliveryId}:
 *   get:
 *     tags: [Webhooks]
 *     summary: Get specific delivery details
 *     description: Returns details of a specific webhook delivery.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: deliveryId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Delivery details
 *       404:
 *         description: Delivery not found
 */
router.get(
  '/webhooks/:id/deliveries/:deliveryId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, deliveryId } = req.params;
      const webhookId = parseInt(id, 10);
      const parsedDeliveryId = parseInt(deliveryId, 10);
      if (isNaN(webhookId) || webhookId <= 0 || isNaN(parsedDeliveryId) || parsedDeliveryId <= 0) {
        return errorResponse(res, 'Invalid ID parameters', 400, ErrorCodes.VALIDATION_ERROR);
      }

      const delivery = await webhookService.getDeliveryById(parsedDeliveryId);

      if (!delivery) {
        return errorResponse(res, 'Delivery not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      sendSuccess(res, { delivery });
    } catch (error) {
      logger.error('[Webhooks] Failed to retrieve delivery', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'WEBHOOK'
      });
      errorResponse(res, 'Failed to retrieve delivery', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

/**
 * @swagger
 * /api/webhooks/webhooks/{id}/stats:
 *   get:
 *     tags: [Webhooks]
 *     summary: Get webhook delivery statistics
 *     description: Returns delivery statistics for a specific webhook.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Delivery statistics
 */
router.get('/webhooks/:id/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const webhookId = parseInt(id, 10);
    if (isNaN(webhookId) || webhookId <= 0) {
      return errorResponse(res, 'Invalid webhook ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const stats = await webhookService.getDeliveryStats(webhookId);
    sendSuccess(res, { stats });
  } catch (error) {
    logger.error('[Webhooks] Failed to retrieve statistics', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'WEBHOOK'
    });
    errorResponse(res, 'Failed to retrieve statistics', 500, ErrorCodes.INTERNAL_ERROR);
  }
}));

/**
 * @swagger
 * /api/webhooks/webhooks/{id}/retry:
 *   post:
 *     tags: [Webhooks]
 *     summary: Retry failed delivery
 *     description: Manually retries a failed webhook delivery.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deliveryId]
 *             properties:
 *               deliveryId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Delivery queued for retry
 *       404:
 *         description: Delivery not found
 */
router.post('/webhooks/:id/retry', validateRequest(WebhookValidationSchemas.retry), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const webhookId = parseInt(id, 10);
    if (isNaN(webhookId) || webhookId <= 0) {
      return errorResponse(res, 'Invalid webhook ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { deliveryId } = req.body;

    if (!deliveryId) {
      return errorResponse(res, 'deliveryId is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const parsedDeliveryId = parseInt(deliveryId, 10);
    if (isNaN(parsedDeliveryId) || parsedDeliveryId <= 0) {
      return errorResponse(res, 'Invalid delivery ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const delivery = await webhookService.getDeliveryById(parsedDeliveryId);
    if (!delivery) {
      return errorResponse(res, 'Delivery not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Trigger retry immediately
    await webhookService.processPendingRetries();

    sendSuccess(res, { deliveryId: parsedDeliveryId }, 'Delivery queued for retry');
  } catch (error) {
    logger.error('[Webhooks] Failed to retry delivery', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'WEBHOOK'
    });
    errorResponse(res, 'Failed to retry delivery', 500, ErrorCodes.INTERNAL_ERROR);
  }
}));

/**
 * @swagger
 * /api/webhooks/webhooks/{id}/secret/regenerate:
 *   post:
 *     tags: [Webhooks]
 *     summary: Regenerate webhook secret
 *     description: Regenerates the webhook secret key for security rotation.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: New secret key returned
 *       500:
 *         description: Internal error
 */
router.post('/webhooks/:id/secret/regenerate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const webhookId = parseInt(id, 10);
    if (isNaN(webhookId) || webhookId <= 0) {
      return errorResponse(res, 'Invalid webhook ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const newSecret = await webhookService.regenerateSecret(webhookId);

    sendSuccess(
      res,
      {
        secret_key: newSecret,
        warning: 'Update any consumers of this webhook with the new secret key'
      },
      'Secret regenerated successfully'
    );
  } catch (error) {
    logger.error('[Webhooks] Failed to regenerate secret', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'WEBHOOK'
    });
    errorResponse(res, 'Failed to regenerate secret', 500, ErrorCodes.INTERNAL_ERROR);
  }
}));

/**
 * @swagger
 * /api/webhooks/events/trigger:
 *   post:
 *     tags: [Webhooks]
 *     summary: Trigger webhook event
 *     description: Manually triggers a webhook event for testing and validation.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventType]
 *             properties:
 *               eventType:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Event triggered
 *       400:
 *         description: eventType required
 */
router.post('/events/trigger', validateRequest(WebhookValidationSchemas.triggerEvent, { allowUnknownFields: true }), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { eventType, data } = req.body;

    if (!eventType) {
      return errorResponse(res, 'eventType is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await webhookService.triggerEvent(eventType, data || {});

    sendSuccess(res, { eventType, webhooksMatched: 'See logs for details' }, 'Event triggered');
  } catch (error) {
    logger.error('[Webhooks] Failed to trigger event', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'WEBHOOK'
    });
    errorResponse(res, 'Failed to trigger event', 500, ErrorCodes.INTERNAL_ERROR);
  }
}));

export default router;
