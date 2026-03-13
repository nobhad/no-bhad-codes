/**
 * Zapier integration routes.
 *
 * GET  /zapier/events  - Get Zapier event types
 * GET  /zapier/samples - Get Zapier sample payloads
 * POST /zapier/webhook - Create Zapier webhook
 * POST /zapier/format  - Format Zapier payload
 */

import { Router } from 'express';
import { Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  formatZapierPayload,
  getZapierTriggerSamples,
  createZapierWebhook,
  getZapierEventTypes
} from '../../services/integrations/index.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';

const router = Router();

/**
 * @swagger
 * /api/integrations/zapier/events:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Get Zapier event types
 *     description: Retrieve available Zapier event types for webhook configuration. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Available Zapier event types
 */
router.get(
  '/zapier/events',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const eventTypes = getZapierEventTypes();
    sendSuccess(res, { events: eventTypes });
  })
);

/**
 * @swagger
 * /api/integrations/zapier/samples:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Get Zapier sample payloads
 *     description: Retrieve sample payloads for Zapier trigger testing. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sample payloads
 */
router.get(
  '/zapier/samples',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const samples = getZapierTriggerSamples();
    sendSuccess(res, { samples });
  })
);

/**
 * @swagger
 * /api/integrations/zapier/webhook:
 *   post:
 *     tags:
 *       - Integrations
 *     summary: Create Zapier webhook
 *     description: Create a new Zapier-compatible webhook endpoint. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - url
 *               - events
 *             properties:
 *               name:
 *                 type: string
 *               url:
 *                 type: string
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Zapier webhook created
 *       400:
 *         description: Validation error
 */
router.post(
  '/zapier/webhook',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, url, events } = req.body;

    if (!name || !url || !events?.length) {
      errorResponse(res, 'Name, URL, and events are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const NAME_MAX_LENGTH = 200;
    const URL_MAX_LENGTH = 2000;

    if (name.length > NAME_MAX_LENGTH) {
      errorResponse(res, `Name must be ${NAME_MAX_LENGTH} characters or fewer`, 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    if (url.length > URL_MAX_LENGTH) {
      errorResponse(res, `URL must be ${URL_MAX_LENGTH} characters or fewer`, 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    try {
      new URL(url);
    } catch {
      errorResponse(res, 'Invalid webhook URL', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    if (!events.every((e: unknown) => typeof e === 'string')) {
      errorResponse(res, 'All events must be strings', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const webhook = await createZapierWebhook(name, url, events);
    sendCreated(
      res,
      {
        webhook: {
          id: webhook.id,
          secretKey: webhook.secret_key
        }
      },
      'Zapier webhook created'
    );
  })
);

/**
 * @swagger
 * /api/integrations/zapier/format:
 *   post:
 *     tags:
 *       - Integrations
 *     summary: Format Zapier payload
 *     description: Format data into a Zapier-compatible payload. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *               - data
 *             properties:
 *               eventType:
 *                 type: string
 *               data:
 *                 type: object
 *               entityId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Formatted payload
 *       400:
 *         description: Validation error
 */
router.post(
  '/zapier/format',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { eventType, data, entityId } = req.body;

    if (!eventType || !data) {
      errorResponse(res, 'Event type and data are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const payload = formatZapierPayload(eventType, data, entityId);
    sendSuccess(res, { payload });
  })
);

export default router;
