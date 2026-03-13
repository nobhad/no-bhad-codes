/**
 * Slack/Discord notification routes.
 *
 * GET    /notifications          - List notification configurations
 * POST   /notifications          - Create or update notification config
 * DELETE /notifications/:id      - Delete notification config
 * POST   /notifications/:id/test - Test notification config
 * POST   /notifications/preview  - Preview notification message
 */

import { Router } from 'express';
import { Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  formatSlackMessage,
  formatDiscordMessage,
  saveNotificationConfig,
  getNotificationConfigs,
  deleteNotificationConfig,
  testNotification,
  NotificationConfig
} from '../../services/integrations/index.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';

const router = Router();

/**
 * @swagger
 * /api/integrations/notifications:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: List notification configurations
 *     description: Retrieve all Slack/Discord notification configurations. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Notification configurations
 */
router.get(
  '/notifications',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const configs = await getNotificationConfigs();
    sendSuccess(res, { notifications: configs });
  })
);

/**
 * @swagger
 * /api/integrations/notifications:
 *   post:
 *     tags:
 *       - Integrations
 *     summary: Create or update notification config
 *     description: Create or update a Slack/Discord notification configuration. Admin only.
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
 *               - platform
 *               - webhook_url
 *               - events
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [slack, discord]
 *               webhook_url:
 *                 type: string
 *               channel:
 *                 type: string
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Configuration updated
 *       201:
 *         description: Configuration created
 *       400:
 *         description: Validation error
 */
router.post(
  '/notifications',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, name, platform, webhook_url, channel, events, is_active } = req.body;

    if (!name || !platform || !webhook_url || !events?.length) {
      errorResponse(
        res,
        'Name, platform, webhook URL, and events are required',
        400,
        'VALIDATION_ERROR'
      );
      return;
    }

    if (!['slack', 'discord'].includes(platform)) {
      errorResponse(res, 'Platform must be slack or discord', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const config: NotificationConfig = {
      id,
      name,
      platform,
      webhook_url,
      channel,
      events,
      is_active: is_active !== false
    };

    const saved = await saveNotificationConfig(config);
    if (id) {
      sendSuccess(res, { notification: saved });
    } else {
      sendCreated(res, { notification: saved });
    }
  })
);

/**
 * @swagger
 * /api/integrations/notifications/{id}:
 *   delete:
 *     tags:
 *       - Integrations
 *     summary: Delete notification config
 *     description: Delete a notification configuration. Admin only.
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
 *         description: Configuration deleted
 */
router.delete(
  '/notifications/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    await deleteNotificationConfig(parseInt(id, 10));
    sendSuccess(res, undefined, 'Notification configuration deleted');
  })
);

/**
 * @swagger
 * /api/integrations/notifications/{id}/test:
 *   post:
 *     tags:
 *       - Integrations
 *     summary: Test notification config
 *     description: Send a test notification to verify configuration. Admin only.
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
 *         description: Test notification sent
 *       404:
 *         description: Configuration not found
 */
router.post(
  '/notifications/:id/test',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const configs = await getNotificationConfigs();
    const config = configs.find((c) => c.id === parseInt(id, 10));

    if (!config) {
      errorResponse(res, 'Notification configuration not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    const result = await testNotification(config);
    sendSuccess(res, result);
  })
);

/**
 * @swagger
 * /api/integrations/notifications/preview:
 *   post:
 *     tags:
 *       - Integrations
 *     summary: Preview notification message
 *     description: Preview how a notification message will look. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - platform
 *               - eventType
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [slack, discord]
 *               eventType:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Message preview
 *       400:
 *         description: Validation error
 */
router.post(
  '/notifications/preview',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { platform, eventType, data } = req.body;

    if (!platform || !eventType) {
      errorResponse(res, 'Platform and event type are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const testData = data || {
      invoice: {
        id: 1,
        number: 'INV-PREVIEW-001',
        client_name: 'Preview Client',
        amount: 1000.0
      }
    };

    if (platform === 'slack') {
      const message = formatSlackMessage(eventType, testData);
      sendSuccess(res, { message });
    } else {
      const message = formatDiscordMessage(eventType, testData);
      sendSuccess(res, { message });
    }
  })
);

export default router;
