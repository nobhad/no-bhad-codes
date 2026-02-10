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

import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import {
  // Zapier
  formatZapierPayload,
  getZapierTriggerSamples,
  createZapierWebhook,
  getZapierEventTypes,
  // Slack/Discord
  formatSlackMessage,
  formatDiscordMessage,
  sendSlackNotification,
  sendDiscordNotification,
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
  getCalendarSyncConfig
} from '../services/integrations';
import { getDatabase } from '../database/init';

const router = Router();

// Helper for async route handlers
const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response) => {
    Promise.resolve(fn(req, res)).catch((error) => {
      console.error('Integration route error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    });
  };

// ===================================
// INTEGRATION STATUS
// ===================================

/**
 * GET /api/integrations/status
 * Get status of all integrations
 */
router.get('/status', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const db = getDatabase();
  const statuses = await db.all('SELECT * FROM integration_status ORDER BY integration_type');

  // Enhance with runtime checks
  const enhanced = statuses.map((status: Record<string, unknown>) => ({
    ...status,
    runtime_configured: checkRuntimeConfiguration(status.integration_type as string)
  }));

  res.json({ integrations: enhanced });
}));

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

// ===================================
// ZAPIER INTEGRATION
// ===================================

/**
 * GET /api/integrations/zapier/events
 * Get available Zapier event types
 */
router.get('/zapier/events', authenticateToken, requireAdmin, asyncHandler(async (_req, res) => {
  const eventTypes = getZapierEventTypes();
  res.json({ events: eventTypes });
}));

/**
 * GET /api/integrations/zapier/samples
 * Get sample payloads for Zapier trigger testing
 */
router.get('/zapier/samples', authenticateToken, requireAdmin, asyncHandler(async (_req, res) => {
  const samples = getZapierTriggerSamples();
  res.json({ samples });
}));

/**
 * POST /api/integrations/zapier/webhook
 * Create a new Zapier-compatible webhook
 */
router.post('/zapier/webhook', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { name, url, events } = req.body;

  if (!name || !url || !events?.length) {
    res.status(400).json({ error: 'Name, URL, and events are required' });
    return;
  }

  const webhook = await createZapierWebhook(name, url, events);
  res.status(201).json({
    message: 'Zapier webhook created',
    webhook: {
      id: webhook.id,
      secretKey: webhook.secret_key
    }
  });
}));

/**
 * POST /api/integrations/zapier/format
 * Format data into Zapier-compatible payload
 */
router.post('/zapier/format', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { eventType, data, entityId } = req.body;

  if (!eventType || !data) {
    res.status(400).json({ error: 'Event type and data are required' });
    return;
  }

  const payload = formatZapierPayload(eventType, data, entityId);
  res.json({ payload });
}));

// ===================================
// SLACK/DISCORD NOTIFICATIONS
// ===================================

/**
 * GET /api/integrations/notifications
 * Get all notification configurations
 */
router.get('/notifications', authenticateToken, requireAdmin, asyncHandler(async (_req, res) => {
  const configs = await getNotificationConfigs();
  res.json({ notifications: configs });
}));

/**
 * POST /api/integrations/notifications
 * Create/update notification configuration
 */
router.post('/notifications', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id, name, platform, webhook_url, channel, events, is_active } = req.body;

  if (!name || !platform || !webhook_url || !events?.length) {
    res.status(400).json({ error: 'Name, platform, webhook URL, and events are required' });
    return;
  }

  if (!['slack', 'discord'].includes(platform)) {
    res.status(400).json({ error: 'Platform must be slack or discord' });
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
  res.status(id ? 200 : 201).json({ notification: saved });
}));

/**
 * DELETE /api/integrations/notifications/:id
 * Delete notification configuration
 */
router.delete('/notifications/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await deleteNotificationConfig(parseInt(id, 10));
  res.json({ message: 'Notification configuration deleted' });
}));

/**
 * POST /api/integrations/notifications/:id/test
 * Test notification configuration
 */
router.post('/notifications/:id/test', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const configs = await getNotificationConfigs();
  const config = configs.find(c => c.id === parseInt(id, 10));

  if (!config) {
    res.status(404).json({ error: 'Notification configuration not found' });
    return;
  }

  const result = await testNotification(config);
  res.json(result);
}));

/**
 * POST /api/integrations/notifications/preview
 * Preview notification message format
 */
router.post('/notifications/preview', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { platform, eventType, data } = req.body;

  if (!platform || !eventType) {
    res.status(400).json({ error: 'Platform and event type are required' });
    return;
  }

  const testData = data || {
    invoice: {
      id: 1,
      number: 'INV-PREVIEW-001',
      client_name: 'Preview Client',
      amount: 1000.00
    }
  };

  if (platform === 'slack') {
    const message = formatSlackMessage(eventType, testData);
    res.json({ message });
  } else {
    const message = formatDiscordMessage(eventType, testData);
    res.json({ message });
  }
}));

// ===================================
// STRIPE PAYMENTS
// ===================================

/**
 * GET /api/integrations/stripe/status
 * Get Stripe configuration status
 */
router.get('/stripe/status', authenticateToken, requireAdmin, asyncHandler(async (_req, res) => {
  const status = getStripeStatus();
  res.json(status);
}));

/**
 * POST /api/integrations/stripe/payment-link
 * Create payment link for invoice
 */
router.post('/stripe/payment-link', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  if (!isStripeConfigured()) {
    res.status(400).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.' });
    return;
  }

  const { invoiceId, successUrl, cancelUrl } = req.body;

  if (!invoiceId) {
    res.status(400).json({ error: 'Invoice ID is required' });
    return;
  }

  const db = getDatabase();
  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);

  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
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

  res.status(201).json({ paymentLink });
}));

/**
 * GET /api/integrations/stripe/payment-link/:invoiceId
 * Get existing payment link for invoice
 */
router.get('/stripe/payment-link/:invoiceId', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  const link = await getPaymentLink(parseInt(invoiceId, 10));

  if (!link) {
    res.status(404).json({ error: 'No active payment link found' });
    return;
  }

  res.json({ paymentLink: link });
}));

/**
 * DELETE /api/integrations/stripe/payment-link/:invoiceId
 * Expire/cancel payment link for invoice
 */
router.delete('/stripe/payment-link/:invoiceId', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  await expirePaymentLink(parseInt(invoiceId, 10));
  res.json({ message: 'Payment link expired' });
}));

/**
 * POST /api/integrations/stripe/webhook
 * Handle Stripe webhook events (no auth required - uses signature verification)
 */
router.post('/stripe/webhook', asyncHandler(async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    res.status(400).json({ error: 'Missing Stripe signature' });
    return;
  }

  // Get raw body for signature verification
  const rawBody = JSON.stringify(req.body);

  if (!verifyWebhookSignature(rawBody, signature)) {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  await handleWebhookEvent(req.body);
  res.json({ received: true });
}));

// ===================================
// GOOGLE CALENDAR
// ===================================

/**
 * GET /api/integrations/calendar/status
 * Get Google Calendar configuration status
 */
router.get('/calendar/status', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const configured = isGoogleCalendarConfigured();
  const userId = (req as any).user?.id;

  let syncConfig = null;
  if (userId) {
    syncConfig = await getCalendarSyncConfig(userId);
  }

  res.json({
    configured,
    connected: Boolean(syncConfig?.isActive),
    syncConfig: syncConfig ? {
      syncMilestones: syncConfig.syncMilestones,
      syncTasks: syncConfig.syncTasks,
      syncInvoiceDueDates: syncConfig.syncInvoiceDueDates,
      lastSyncAt: syncConfig.lastSyncAt
    } : null
  });
}));

/**
 * GET /api/integrations/calendar/auth-url
 * Get Google OAuth URL for calendar authorization
 */
router.get('/calendar/auth-url', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  if (!isGoogleCalendarConfigured()) {
    res.status(400).json({ error: 'Google Calendar is not configured' });
    return;
  }

  const state = (req as any).user?.id?.toString() || '';
  const authUrl = getGoogleAuthUrl(state);
  res.json({ authUrl });
}));

/**
 * POST /api/integrations/calendar/callback
 * Handle Google OAuth callback
 */
router.post('/calendar/callback', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { code } = req.body;
  const userId = (req as any).user?.id;

  if (!code) {
    res.status(400).json({ error: 'Authorization code is required' });
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

  res.json({ message: 'Calendar connected successfully' });
}));

/**
 * PUT /api/integrations/calendar/settings
 * Update calendar sync settings
 */
router.put('/calendar/settings', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  const { syncMilestones, syncTasks, syncInvoiceDueDates, isActive } = req.body;

  const existing = await getCalendarSyncConfig(userId);
  if (!existing) {
    res.status(404).json({ error: 'Calendar not connected' });
    return;
  }

  await saveCalendarSyncConfig({
    ...existing,
    syncMilestones: syncMilestones ?? existing.syncMilestones,
    syncTasks: syncTasks ?? existing.syncTasks,
    syncInvoiceDueDates: syncInvoiceDueDates ?? existing.syncInvoiceDueDates,
    isActive: isActive ?? existing.isActive
  });

  res.json({ message: 'Calendar settings updated' });
}));

/**
 * GET /api/integrations/calendar/export/project/:projectId
 * Export project milestones/tasks to iCal format
 */
router.get('/calendar/export/project/:projectId', authenticateToken, asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const ical = await exportProjectToICal(parseInt(projectId, 10));

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="project-${projectId}.ics"`);
  res.send(ical);
}));

/**
 * GET /api/integrations/calendar/export/upcoming
 * Export all upcoming items to iCal format
 */
router.get('/calendar/export/upcoming', authenticateToken, asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days as string, 10) || 30;
  const ical = await exportUpcomingToICal(days);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="upcoming.ics"');
  res.send(ical);
}));

export default router;
