/**
 * ===============================================
 * INTEGRATIONS API ROUTES
 * ===============================================
 * @file server/routes/integrations.ts
 *
 * API endpoints for external integrations:
 * - Zapier webhook format helpers
 * - Slack/Discord notifications
 * - Stripe payment links
 * - Google Calendar sync
 */

import { Router } from 'express';
import express, { Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  // Zapier
  formatZapierPayload,
  getZapierTriggerSamples,
  createZapierWebhook,
  getZapierEventTypes,
  // Slack/Discord
  formatSlackMessage,
  formatDiscordMessage,
  saveNotificationConfig,
  getNotificationConfigs,
  deleteNotificationConfig,
  testNotification,
  NotificationConfig,
  // Stripe
  isStripeConfigured,
  createPaymentLink,
  getPaymentLink,
  expirePaymentLink,
  getStripeStatus,
  verifyWebhookSignature,
  handleWebhookEvent,
  // Calendar
  isGoogleCalendarConfigured,
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  exportProjectToICal,
  exportUpcomingToICal,
  saveCalendarSyncConfig,
  getCalendarSyncConfig,
  // Health check
  checkIntegrationHealth
} from '../services/integrations/index.js';
import { getDatabase } from '../database/init.js';
import { errorResponse, sendSuccess, sendCreated } from '../utils/api-response.js';

// Explicit column lists for SELECT queries (avoid SELECT *)
const INTEGRATION_STATUS_COLUMNS = `
  id, integration_type, is_configured, is_active, configuration,
  last_activity_at, error_message, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const INVOICE_COLUMNS = `
  id, client_id, project_id, invoice_number, description, status,
  amount_subtotal, amount_tax, amount_total, amount_paid, tax_rate,
  payment_method, payment_reference, paid_date, issued_date, due_date,
  notes, line_items, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const router = Router();

// ===================================
// INTEGRATION STATUS
// ===================================

/**
 * @swagger
 * /api/integrations/status:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Get integration statuses
 *     description: Retrieve status of all configured integrations. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Integration statuses
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = getDatabase();
    const statuses = await db.all(
      `SELECT ${INTEGRATION_STATUS_COLUMNS} FROM integration_status ORDER BY integration_type LIMIT 100`
    );

    // Enhance with runtime checks
    const enhanced = statuses.map((status: Record<string, unknown>) => ({
      ...status,
      runtime_configured: checkRuntimeConfiguration(status.integration_type as string)
    }));

    sendSuccess(res, { integrations: enhanced });
  })
);

function checkRuntimeConfiguration(type: string): boolean {
  switch (type) {
  case 'stripe':
    return isStripeConfigured();
  case 'google_calendar':
    return isGoogleCalendarConfigured();
  case 'slack':
  case 'discord':
    return true; // Configured per-webhook
  case 'zapier':
    return true; // Uses existing webhook system
  default:
    return false;
  }
}

/**
 * @swagger
 * /api/integrations/health:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Check integration health
 *     description: Run lightweight health checks on all integrations. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Health check report
 */
router.get(
  '/health',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const report = await checkIntegrationHealth();
    sendSuccess(res, report);
  })
);

// ===================================
// ZAPIER INTEGRATION
// ===================================

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
      errorResponse(res, 'Name, URL, and events are required', 400, 'VALIDATION_ERROR');
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
      errorResponse(res, 'Event type and data are required', 400, 'VALIDATION_ERROR');
      return;
    }

    const payload = formatZapierPayload(eventType, data, entityId);
    sendSuccess(res, { payload });
  })
);

// ===================================
// SLACK/DISCORD NOTIFICATIONS
// ===================================

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
      errorResponse(res, 'Platform must be slack or discord', 400, 'VALIDATION_ERROR');
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
      errorResponse(res, 'Notification configuration not found', 404, 'RESOURCE_NOT_FOUND');
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
      errorResponse(res, 'Platform and event type are required', 400, 'VALIDATION_ERROR');
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

// ===================================
// STRIPE PAYMENTS
// ===================================

/**
 * @swagger
 * /api/integrations/stripe/status:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Get Stripe status
 *     description: Retrieve Stripe configuration and connection status. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Stripe configuration status
 */
router.get(
  '/stripe/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const status = getStripeStatus();
    sendSuccess(res, status);
  })
);

/**
 * @swagger
 * /api/integrations/stripe/payment-link:
 *   post:
 *     tags:
 *       - Integrations
 *     summary: Create Stripe payment link
 *     description: Create a payment link for an invoice via Stripe. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoiceId
 *             properties:
 *               invoiceId:
 *                 type: integer
 *               successUrl:
 *                 type: string
 *               cancelUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment link created
 *       400:
 *         description: Stripe not configured or validation error
 *       404:
 *         description: Invoice not found
 */
router.post(
  '/stripe/payment-link',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!isStripeConfigured()) {
      errorResponse(
        res,
        'Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.',
        400,
        'STRIPE_NOT_CONFIGURED'
      );
      return;
    }

    const { invoiceId, successUrl, cancelUrl } = req.body;

    if (!invoiceId) {
      errorResponse(res, 'Invoice ID is required', 400, 'VALIDATION_ERROR');
      return;
    }

    const db = getDatabase();
    const invoice = await db.get(`SELECT ${INVOICE_COLUMNS} FROM invoices WHERE id = ?`, [invoiceId]);

    if (!invoice) {
      errorResponse(res, 'Invoice not found', 404, 'RESOURCE_NOT_FOUND');
      return;
    }

    const invoiceData = invoice as { total_amount: number; invoice_number: string };
    const paymentLink = await createPaymentLink({
      invoiceId,
      amount: Math.round(invoiceData.total_amount * 100), // Convert to cents
      description: `Invoice #${invoiceData.invoice_number}`,
      successUrl,
      cancelUrl
    });

    sendCreated(res, { paymentLink });
  })
);

/**
 * @swagger
 * /api/integrations/stripe/payment-link/{invoiceId}:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Get payment link for invoice
 *     description: Retrieve an existing Stripe payment link for an invoice. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Payment link details
 *       404:
 *         description: No active payment link found
 */
router.get(
  '/stripe/payment-link/:invoiceId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { invoiceId } = req.params;
    const link = await getPaymentLink(parseInt(invoiceId, 10));

    if (!link) {
      errorResponse(res, 'No active payment link found', 404, 'RESOURCE_NOT_FOUND');
      return;
    }

    sendSuccess(res, { paymentLink: link });
  })
);

/**
 * @swagger
 * /api/integrations/stripe/payment-link/{invoiceId}:
 *   delete:
 *     tags:
 *       - Integrations
 *     summary: Expire payment link
 *     description: Expire or cancel a Stripe payment link for an invoice. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Payment link expired
 */
router.delete(
  '/stripe/payment-link/:invoiceId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { invoiceId } = req.params;
    await expirePaymentLink(parseInt(invoiceId, 10));
    sendSuccess(res, undefined, 'Payment link expired');
  })
);

/**
 * @swagger
 * /api/integrations/stripe/webhook:
 *   post:
 *     tags:
 *       - Integrations
 *     summary: Stripe webhook handler
 *     description: Handle incoming Stripe webhook events. Uses Stripe signature verification instead of JWT auth.
 *     parameters:
 *       - in: header
 *         name: stripe-signature
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook processed
 *       400:
 *         description: Missing signature
 *       401:
 *         description: Invalid signature
 */
router.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      errorResponse(res, 'Missing Stripe signature', 400, 'VALIDATION_ERROR');
      return;
    }

    // Get raw body for signature verification - req.body is a Buffer from express.raw()
    const rawBody =
      req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);

    if (!verifyWebhookSignature(rawBody, signature)) {
      errorResponse(res, 'Invalid Stripe webhook signature', 401, 'UNAUTHORIZED');
      return;
    }

    // Parse the JSON body now that signature is verified
    const event = req.body instanceof Buffer ? JSON.parse(rawBody) : req.body;

    await handleWebhookEvent(event);
    sendSuccess(res, { received: true });
  })
);

// ===================================
// GOOGLE CALENDAR
// ===================================

/**
 * @swagger
 * /api/integrations/calendar/status:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Get calendar sync status
 *     description: Retrieve Google Calendar configuration and sync status. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Calendar sync status
 */
router.get(
  '/calendar/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const configured = isGoogleCalendarConfigured();
    const userId = req.user?.id;

    let syncConfig = null;
    if (userId) {
      syncConfig = await getCalendarSyncConfig(userId);
    }

    sendSuccess(res, {
      configured,
      connected: Boolean(syncConfig?.isActive),
      syncConfig: syncConfig
        ? {
          syncMilestones: syncConfig.syncMilestones,
          syncTasks: syncConfig.syncTasks,
          syncInvoiceDueDates: syncConfig.syncInvoiceDueDates,
          lastSyncAt: syncConfig.lastSyncAt
        }
        : null
    });
  })
);

/**
 * @swagger
 * /api/integrations/calendar/auth-url:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Get Google Calendar auth URL
 *     description: Get the Google OAuth authorization URL for calendar integration. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: OAuth authorization URL
 *       400:
 *         description: Google Calendar not configured
 */
router.get(
  '/calendar/auth-url',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!isGoogleCalendarConfigured()) {
      errorResponse(
        res,
        'Google Calendar is not configured',
        400,
        'GOOGLE_CALENDAR_NOT_CONFIGURED'
      );
      return;
    }

    const state = req.user?.id?.toString() || '';
    const authUrl = getGoogleAuthUrl(state);
    sendSuccess(res, { authUrl });
  })
);

/**
 * @swagger
 * /api/integrations/calendar/callback:
 *   post:
 *     tags:
 *       - Integrations
 *     summary: Google Calendar OAuth callback
 *     description: Handle the Google OAuth callback and store tokens. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Calendar connected
 *       400:
 *         description: Authorization code required
 */
router.post(
  '/calendar/callback',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
      return;
    }

    if (!code) {
      errorResponse(res, 'Authorization code is required', 400, 'VALIDATION_ERROR');
      return;
    }

    const tokens = await exchangeCodeForTokens(code);

    // Save sync configuration
    await saveCalendarSyncConfig({
      userId,
      calendarId: 'primary',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_at,
      syncMilestones: true,
      syncTasks: true,
      syncInvoiceDueDates: false,
      isActive: true
    });

    sendSuccess(res, undefined, 'Calendar connected successfully');
  })
);

/**
 * @swagger
 * /api/integrations/calendar/settings:
 *   put:
 *     tags:
 *       - Integrations
 *     summary: Update calendar sync settings
 *     description: Update calendar synchronization preferences. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               syncMilestones:
 *                 type: boolean
 *               syncTasks:
 *                 type: boolean
 *               syncInvoiceDueDates:
 *                 type: boolean
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Settings updated
 *       404:
 *         description: Calendar not connected
 */
router.put(
  '/calendar/settings',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
      return;
    }
    const { syncMilestones, syncTasks, syncInvoiceDueDates, isActive } = req.body;

    const existing = await getCalendarSyncConfig(userId);
    if (!existing) {
      errorResponse(res, 'Calendar not connected', 404, 'RESOURCE_NOT_FOUND');
      return;
    }

    await saveCalendarSyncConfig({
      ...existing,
      syncMilestones: syncMilestones ?? existing.syncMilestones,
      syncTasks: syncTasks ?? existing.syncTasks,
      syncInvoiceDueDates: syncInvoiceDueDates ?? existing.syncInvoiceDueDates,
      isActive: isActive ?? existing.isActive
    });

    sendSuccess(res, undefined, 'Calendar settings updated');
  })
);

/**
 * @swagger
 * /api/integrations/calendar/export/project/{projectId}:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Export project calendar
 *     description: Export project milestones and tasks in iCal format.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: iCal file
 *         content:
 *           text/calendar:
 *             schema:
 *               type: string
 */
router.get(
  '/calendar/export/project/:projectId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { projectId } = req.params;
    const ical = await exportProjectToICal(parseInt(projectId, 10));

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="project-${projectId}.ics"`);
    res.send(ical);
  })
);

/**
 * @swagger
 * /api/integrations/calendar/export/upcoming:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Export upcoming events calendar
 *     description: Export all upcoming milestones and tasks in iCal format.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to look ahead (1-365)
 *     responses:
 *       200:
 *         description: iCal file
 *         content:
 *           text/calendar:
 *             schema:
 *               type: string
 */
router.get(
  '/calendar/export/upcoming',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const daysParam = parseInt(req.query.days as string, 10);
    const days = isNaN(daysParam) || daysParam < 1 || daysParam > 365 ? 30 : daysParam;
    const ical = await exportUpcomingToICal(days);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="upcoming.ics"');
    res.send(ical);
  })
);

export default router;
