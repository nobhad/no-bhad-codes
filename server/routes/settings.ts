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
import { rateLimit } from '../middleware/security.js';
import { settingsService } from '../services/settings-service.js';
import { auditLogger } from '../services/audit-logger.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../utils/api-response.js';
import { validateRequest, ValidationSchema } from '../middleware/validation.js';

const router = express.Router();

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const SETTING_VALUE_MAX_LENGTH = 10000;
const SETTING_KEY_MAX_LENGTH = 200;
const BUSINESS_FIELD_MAX_LENGTH = 200;
const PAYMENT_HANDLE_MAX_LENGTH = 100;
const INVOICE_PREFIX_MAX_LENGTH = 20;
const INVOICE_SEQUENCE_MAX = 999999;
const CURRENCY_CODE_LENGTH = 3;

const SettingsValidationSchemas = {
  updateSetting: {
    value: [
      { type: 'required' as const }
    ],
    type: {
      type: 'string' as const,
      allowedValues: ['string', 'number', 'boolean', 'json']
    },
    description: { type: 'string' as const, maxLength: SETTING_KEY_MAX_LENGTH }
  } as ValidationSchema,

  updateBusinessInfo: {
    name: { type: 'string' as const, maxLength: BUSINESS_FIELD_MAX_LENGTH },
    owner: { type: 'string' as const, maxLength: BUSINESS_FIELD_MAX_LENGTH },
    contact: { type: 'string' as const, maxLength: BUSINESS_FIELD_MAX_LENGTH },
    tagline: { type: 'string' as const, maxLength: BUSINESS_FIELD_MAX_LENGTH },
    email: { type: 'email' as const },
    website: { type: 'string' as const, maxLength: BUSINESS_FIELD_MAX_LENGTH }
  } as ValidationSchema,

  updatePaymentSettings: {
    venmoHandle: { type: 'string' as const, maxLength: PAYMENT_HANDLE_MAX_LENGTH },
    zelleEmail: { type: 'email' as const },
    paypalEmail: { type: 'email' as const }
  } as ValidationSchema,

  updateInvoiceSettings: {
    defaultCurrency: { type: 'string' as const, minLength: CURRENCY_CODE_LENGTH, maxLength: CURRENCY_CODE_LENGTH },
    defaultTerms: { type: 'string' as const, maxLength: SETTING_VALUE_MAX_LENGTH },
    prefix: { type: 'string' as const, maxLength: INVOICE_PREFIX_MAX_LENGTH },
    nextSequence: { type: 'number' as const, min: 1, max: INVOICE_SEQUENCE_MAX }
  } as ValidationSchema
};

// Strict rate limiting for settings modifications (10 requests per 5 minutes)
const settingsModifyRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 10,
  message: 'Too many settings modifications, please try again later'
});

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

    sendSuccess(res, filtered);
  })
);

// =====================================================
// SPECIFIC NAMED ROUTES (must be defined BEFORE /:key wildcard)
// =====================================================

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
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const businessInfo = await settingsService.getBusinessInfo();
    sendSuccess(res, businessInfo);
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
  settingsModifyRateLimit,
  authenticateToken,
  requireAdmin,
  validateRequest(SettingsValidationSchemas.updateBusinessInfo, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const businessInfo = await settingsService.updateBusinessInfo(req.body);

    await auditLogger.log({
      action: 'business_info_updated',
      entityType: 'system_settings',
      entityId: req.params.key,
      userId: req.user?.id,
      changes: req.body
    });

    sendSuccess(res, businessInfo);
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
    sendSuccess(res, paymentSettings);
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
  settingsModifyRateLimit,
  authenticateToken,
  requireAdmin,
  validateRequest(SettingsValidationSchemas.updatePaymentSettings, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const paymentSettings = await settingsService.updatePaymentSettings(req.body);

    await auditLogger.log({
      action: 'payment_settings_updated',
      entityType: 'system_settings',
      entityId: req.params.key,
      userId: req.user?.id,
      changes: req.body
    });

    sendSuccess(res, paymentSettings);
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
    sendSuccess(res, invoiceSettings);
  })
);

/**
 * @swagger
 * /api/settings/invoice:
 *   put:
 *     tags:
 *       - Settings
 *     summary: Update invoice settings
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               defaultCurrency:
 *                 type: string
 *               defaultTerms:
 *                 type: string
 *               prefix:
 *                 type: string
 *               nextSequence:
 *                 type: number
 *     responses:
 *       200:
 *         description: Invoice settings updated successfully
 */
router.put(
  '/invoice',
  settingsModifyRateLimit,
  authenticateToken,
  requireAdmin,
  validateRequest(SettingsValidationSchemas.updateInvoiceSettings, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceSettings = await settingsService.updateInvoiceSettings(req.body);

    await auditLogger.log({
      action: 'invoice_settings_updated',
      entityType: 'system_settings',
      entityId: req.params.key,
      userId: req.user?.id,
      changes: req.body
    });

    sendSuccess(res, invoiceSettings);
  })
);

// =====================================================
// WILDCARD ROUTES (must be AFTER specific named routes)
// =====================================================

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
    const key = req.params.key;

    // Express 5 router may match /:key before static routes like /payment.
    // Delegate to the correct service method for known named routes.
    if (key === 'payment') {
      const paymentSettings = await settingsService.getPaymentSettings();
      return sendSuccess(res, paymentSettings);
    }
    if (key === 'invoice') {
      const invoiceSettings = await settingsService.getInvoiceSettings();
      return sendSuccess(res, invoiceSettings);
    }

    const setting = await settingsService.getSetting(key);

    if (!setting) {
      return errorResponse(res, 'Setting not found', 404, ErrorCodes.NOT_FOUND);
    }

    sendSuccess(res, {
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
  settingsModifyRateLimit,
  authenticateToken,
  requireAdmin,
  validateRequest(SettingsValidationSchemas.updateSetting, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { value, type, description } = req.body;

    if (value === undefined) {
      return errorResponse(res, 'Value is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
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

    sendSuccess(res, setting);
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
  settingsModifyRateLimit,
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const deleted = await settingsService.deleteSetting(req.params.key);

    if (!deleted) {
      return errorResponse(res, 'Setting not found', 404, ErrorCodes.NOT_FOUND);
    }

    await auditLogger.log({
      action: 'setting_deleted',
      entityType: 'system_settings',
      entityId: req.params.key,
      userId: req.user?.id,
      changes: { key: req.params.key }
    });

    sendSuccess(res, null, 'Setting deleted');
  })
);

export default router;
