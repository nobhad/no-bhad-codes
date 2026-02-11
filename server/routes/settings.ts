/**
 * ===============================================
 * SETTINGS ROUTES
 * ===============================================
 * @file server/routes/settings.ts
 *
 * Admin endpoints for managing system settings.
 * Provides CRUD operations for business info, payment settings,
 * and other configurable values stored in system_settings table.
 *
 * Phase 3.1 of Database Normalization
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { settingsService } from '../services/settings-service.js';
import { auditLogger } from '../services/audit-logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/settings:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Get all settings
 *     description: Get all system settings, optionally filtered by prefix
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: prefix
 *         schema:
 *           type: string
 *         description: Filter settings by key prefix (e.g., 'business', 'payment')
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const prefix = req.query.prefix as string | undefined;
    const settings = await settingsService.getSettings(prefix);

    // Filter out sensitive values for non-superadmin users
    const filtered = settings.map((s) => ({
      ...s,
      value: s.isSensitive ? '********' : s.value
    }));

    res.json(filtered);
  })
);

/**
 * @swagger
 * /api/settings/{key}:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Get a single setting
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Setting retrieved successfully
 *       404:
 *         description: Setting not found
 */
router.get(
  '/:key',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const setting = await settingsService.getSetting(req.params.key);

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({
      ...setting,
      value: setting.isSensitive ? '********' : setting.value
    });
  })
);

/**
 * @swagger
 * /api/settings/{key}:
 *   put:
 *     tags:
 *       - Settings
 *     summary: Update a setting
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               value:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [string, number, boolean, json]
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Setting updated successfully
 */
router.put(
  '/:key',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { value, type, description } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const setting = await settingsService.setSetting(req.params.key, value, {
      type,
      description
    });

    await auditLogger.log({
      action: 'setting_updated',
      entityType: 'system_settings',
      entityId: String(setting.id),
      userId: req.user?.id,
      changes: { key: req.params.key, newValue: value }
    });

    res.json(setting);
  })
);

/**
 * @swagger
 * /api/settings/{key}:
 *   delete:
 *     tags:
 *       - Settings
 *     summary: Delete a setting
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Setting deleted successfully
 *       404:
 *         description: Setting not found
 */
router.delete(
  '/:key',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const deleted = await settingsService.deleteSetting(req.params.key);

    if (!deleted) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    await auditLogger.log({
      action: 'setting_deleted',
      entityType: 'system_settings',
      entityId: req.params.key,
      userId: req.user?.id,
      changes: { key: req.params.key }
    });

    res.json({ success: true, message: 'Setting deleted' });
  })
);

/**
 * @swagger
 * /api/settings/business/info:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Get business info
 *     description: Get all business information settings
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Business info retrieved successfully
 */
router.get(
  '/business/info',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const businessInfo = await settingsService.getBusinessInfo();
    res.json(businessInfo);
  })
);

/**
 * @swagger
 * /api/settings/business/info:
 *   put:
 *     tags:
 *       - Settings
 *     summary: Update business info
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               owner:
 *                 type: string
 *               contact:
 *                 type: string
 *               tagline:
 *                 type: string
 *               email:
 *                 type: string
 *               website:
 *                 type: string
 *     responses:
 *       200:
 *         description: Business info updated successfully
 */
router.put(
  '/business/info',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const businessInfo = await settingsService.updateBusinessInfo(req.body);

    await auditLogger.log({
      action: 'business_info_updated',
      entityType: 'system_settings',
      entityId: req.params.key,
      userId: req.user?.id,
      changes: req.body
    });

    res.json(businessInfo);
  })
);

/**
 * @swagger
 * /api/settings/payment:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Get payment settings
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Payment settings retrieved successfully
 */
router.get(
  '/payment',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const paymentSettings = await settingsService.getPaymentSettings();
    res.json(paymentSettings);
  })
);

/**
 * @swagger
 * /api/settings/payment:
 *   put:
 *     tags:
 *       - Settings
 *     summary: Update payment settings
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               venmoHandle:
 *                 type: string
 *               zelleEmail:
 *                 type: string
 *               paypalEmail:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment settings updated successfully
 */
router.put(
  '/payment',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const paymentSettings = await settingsService.updatePaymentSettings(req.body);

    await auditLogger.log({
      action: 'payment_settings_updated',
      entityType: 'system_settings',
      entityId: req.params.key,
      userId: req.user?.id,
      changes: req.body
    });

    res.json(paymentSettings);
  })
);

/**
 * @swagger
 * /api/settings/invoice:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Get invoice settings
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Invoice settings retrieved successfully
 */
router.get(
  '/invoice',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceSettings = await settingsService.getInvoiceSettings();
    res.json(invoiceSettings);
  })
);

export default router;
