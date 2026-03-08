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
import { ErrorCodes, errorResponse, errorResponseWithPayload, sendSuccess, sendCreated, messageResponse, sanitizeErrorMessage } from '../../utils/api-response.js';
import { getInvoiceService, toSnakeCaseInvoice, toSnakeCasePaymentPlan } from './helpers.js';
import { validateRequest } from '../../middleware/validation.js';

const router = express.Router();

// Payment plan validation schemas
const PaymentPlanValidationSchemas = {
  create: {
    name: [{ type: 'required' as const }, { type: 'string' as const, minLength: 1, maxLength: 100 }],
    description: { type: 'string' as const, maxLength: 500 },
    payments: [
      { type: 'required' as const },
      {
        type: 'array' as const,
        minLength: 1,
        maxLength: 12,
        customValidator: (items: unknown) => {
          if (!Array.isArray(items)) return 'Payments must be an array';
          let totalPercentage = 0;
          for (const item of items) {
            if (typeof item !== 'object' || item === null) return 'Each payment must be an object';
            const entry = item as Record<string, unknown>;
            if (typeof entry.percentage !== 'number' || entry.percentage <= 0 || entry.percentage > 100) {
              return 'Each payment must have a valid percentage between 0 and 100';
            }
            totalPercentage += entry.percentage;
            if (typeof entry.daysAfterInvoice !== 'number' || entry.daysAfterInvoice < 0) {
              return 'Each payment must have valid daysAfterInvoice';
            }
          }
          if (Math.abs(totalPercentage - 100) > 0.01) {
            return 'Payment percentages must total 100%';
          }
          return true;
        }
      }
    ],
    isDefault: { type: 'boolean' as const }
  }
};

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
      sendSuccess(res, {
        templates: templates.map(toSnakeCasePaymentPlan),
        count: templates.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(
        res,
        'Failed to retrieve payment plan templates',
        500,
        ErrorCodes.RETRIEVAL_FAILED,
        {
          message: sanitizeErrorMessage(error, 'Failed to retrieve payment plan templates')
        }
      );
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
  // Validate and sanitize input
  validateRequest(PaymentPlanValidationSchemas.create),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, description, payments, isDefault } = req.body;

    try {
      const template = await getInvoiceService().createPaymentPlanTemplate({
        name,
        description,
        payments,
        isDefault: isDefault || false
      });

      sendCreated(res, { template: toSnakeCasePaymentPlan(template) }, 'Payment plan template created');
    } catch (error: unknown) {
      errorResponseWithPayload(
        res,
        'Failed to create payment plan template',
        500,
        ErrorCodes.CREATION_FAILED,
        {
          message: sanitizeErrorMessage(error, 'Failed to create payment plan template')
        }
      );
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
    const templateId = parseInt(req.params.id, 10);

    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.INVALID_ID);
    }

    try {
      await getInvoiceService().deletePaymentPlanTemplate(templateId);
      messageResponse(res, 'Payment plan template deleted');
    } catch (error: unknown) {
      errorResponseWithPayload(
        res,
        'Failed to delete payment plan template',
        500,
        ErrorCodes.DELETION_FAILED,
        {
          message: sanitizeErrorMessage(error, 'Failed to delete payment plan template')
        }
      );
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
      return errorResponseWithPayload(res, 'Missing required fields', 400, ErrorCodes.MISSING_FIELDS, {
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

      sendCreated(res, {
        invoices: invoices.map(toSnakeCaseInvoice),
        count: invoices.length
      }, `Generated ${invoices.length} invoices from payment plan`);
    } catch (error: unknown) {
      errorResponseWithPayload(
        res,
        'Failed to generate invoices from plan',
        500,
        ErrorCodes.GENERATION_FAILED,
        {
          message: sanitizeErrorMessage(error, 'Failed to generate invoices from payment plan')
        }
      );
    }
  })
);

export { router as paymentPlansRouter };
export default router;
