/**
 * ===============================================
 * INVOICE PAYMENT PLAN ROUTES
 * ===============================================
 * @file server/routes/invoices/payment-plans.ts
 *
 * Payment plan template endpoints.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, errorResponseWithPayload } from '../../utils/api-response.js';
import { getInvoiceService, toSnakeCaseInvoice, toSnakeCasePaymentPlan } from './helpers.js';

const router = express.Router();

/**
 * @swagger
 * /api/invoices/payment-plans:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get all payment plan templates
 */
router.get(
  '/payment-plans',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const templates = await getInvoiceService().getPaymentPlanTemplates();
      res.json({
        success: true,
        templates: templates.map(toSnakeCasePaymentPlan),
        count: templates.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve payment plan templates', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/payment-plans:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create a new payment plan template
 */
router.post(
  '/payment-plans',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, description, payments, isDefault } = req.body;

    if (!name || !payments || !Array.isArray(payments) || payments.length === 0) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, 'MISSING_FIELDS', {
        required: ['name', 'payments']
      });
    }

    try {
      const template = await getInvoiceService().createPaymentPlanTemplate({
        name,
        description,
        payments,
        isDefault: isDefault || false
      });

      res.status(201).json({
        success: true,
        message: 'Payment plan template created',
        template: toSnakeCasePaymentPlan(template)
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to create payment plan template', 500, 'CREATION_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/payment-plans/{id}:
 *   delete:
 *     tags:
 *       - Invoices
 *     summary: Delete a payment plan template
 */
router.delete(
  '/payment-plans/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const templateId = parseInt(req.params.id);

    if (isNaN(templateId)) {
      return errorResponse(res, 'Invalid template ID', 400, 'INVALID_ID');
    }

    try {
      await getInvoiceService().deletePaymentPlanTemplate(templateId);
      res.json({
        success: true,
        message: 'Payment plan template deleted'
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to delete payment plan template', 500, 'DELETION_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/generate-from-plan:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Generate invoices from a payment plan template
 */
router.post(
  '/generate-from-plan',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, clientId, templateId, totalAmount } = req.body;

    if (!projectId || !clientId || !templateId || !totalAmount) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, 'MISSING_FIELDS', {
        required: ['projectId', 'clientId', 'templateId', 'totalAmount']
      });
    }

    try {
      const invoices = await getInvoiceService().generateInvoicesFromTemplate(
        projectId,
        clientId,
        templateId,
        totalAmount
      );

      res.status(201).json({
        success: true,
        message: `Generated ${invoices.length} invoices from payment plan`,
        invoices: invoices.map(toSnakeCaseInvoice),
        count: invoices.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to generate invoices from plan', 500, 'GENERATION_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export { router as paymentPlansRouter };
export default router;
