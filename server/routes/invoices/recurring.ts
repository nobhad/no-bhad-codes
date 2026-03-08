/**
 * ===============================================
 * INVOICE RECURRING ROUTES
 * ===============================================
 * @file server/routes/invoices/recurring.ts
 *
 * Recurring invoice endpoints.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, errorResponseWithPayload, sendSuccess, sendCreated, messageResponse, sanitizeErrorMessage } from '../../utils/api-response.js';
import { getInvoiceService, toSnakeCaseRecurringInvoice } from './helpers.js';
import { validateRequest } from '../../middleware/validation.js';

const router = express.Router();

// Recurring invoice validation schemas
const RecurringValidationSchemas = {
  create: {
    projectId: [{ type: 'required' as const }, { type: 'number' as const, min: 1 }],
    clientId: [{ type: 'required' as const }, { type: 'number' as const, min: 1 }],
    frequency: [
      { type: 'required' as const },
      { type: 'string' as const, allowedValues: ['weekly', 'monthly', 'quarterly'] }
    ],
    startDate: [{ type: 'required' as const }, { type: 'string' as const, minLength: 8, maxLength: 20 }],
    endDate: { type: 'string' as const, maxLength: 20 },
    lineItems: [{ type: 'required' as const }, { type: 'array' as const, minLength: 1 }],
    dayOfMonth: { type: 'number' as const, min: 1, max: 31 },
    dayOfWeek: { type: 'number' as const, min: 0, max: 6 },
    notes: { type: 'string' as const, maxLength: 2000 },
    terms: { type: 'string' as const, maxLength: 2000 }
  }
};

/**
 * @swagger
 * /api/invoices/recurring:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create a recurring invoice pattern
 */
router.post(
  '/recurring',
  authenticateToken,
  requireAdmin,
  // Validate and sanitize input
  validateRequest(RecurringValidationSchemas.create),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const {
      projectId,
      clientId,
      frequency,
      dayOfMonth,
      dayOfWeek,
      lineItems,
      notes,
      terms,
      startDate,
      endDate
    } = req.body;

    try {
      const recurring = await getInvoiceService().createRecurringInvoice({
        projectId,
        clientId,
        frequency,
        dayOfMonth,
        dayOfWeek,
        lineItems,
        notes,
        terms,
        startDate,
        endDate
      });

      sendCreated(res, { recurring_invoice: toSnakeCaseRecurringInvoice(recurring) }, 'Recurring invoice pattern created');
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to create recurring invoice', 500, 'CREATION_FAILED', {
        message: sanitizeErrorMessage(error, 'Failed to create recurring invoice pattern')
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/recurring:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get all recurring invoices
 */
router.get(
  '/recurring',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const recurring = await getInvoiceService().getRecurringInvoices();

      sendSuccess(res, {
        recurring_invoices: recurring.map(toSnakeCaseRecurringInvoice),
        count: recurring.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(
        res,
        'Failed to retrieve recurring invoices',
        500,
        'RETRIEVAL_FAILED',
        {
          message: sanitizeErrorMessage(error, 'Failed to retrieve recurring invoices')
        }
      );
    }
  })
);

/**
 * @swagger
 * /api/invoices/recurring/{projectId}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get recurring invoices for a project
 */
router.get(
  '/recurring/:projectId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_ID');
    }

    try {
      const recurring = await getInvoiceService().getRecurringInvoices(projectId);

      sendSuccess(res, {
        recurring_invoices: recurring.map(toSnakeCaseRecurringInvoice),
        count: recurring.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(
        res,
        'Failed to retrieve recurring invoices',
        500,
        'RETRIEVAL_FAILED',
        {
          message: sanitizeErrorMessage(error, 'Failed to retrieve recurring invoices')
        }
      );
    }
  })
);

/**
 * @swagger
 * /api/invoices/recurring/{id}:
 *   put:
 *     tags:
 *       - Invoices
 *     summary: Update a recurring invoice pattern
 */
router.put(
  '/recurring/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const recurringId = parseInt(req.params.id, 10);

    if (isNaN(recurringId)) {
      return errorResponse(res, 'Invalid recurring invoice ID', 400, 'INVALID_ID');
    }

    try {
      const recurring = await getInvoiceService().updateRecurringInvoice(recurringId, req.body);

      sendSuccess(res, { recurring_invoice: toSnakeCaseRecurringInvoice(recurring) }, 'Recurring invoice updated');
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to update recurring invoice', 500, 'UPDATE_FAILED', {
        message: sanitizeErrorMessage(error, 'Failed to update recurring invoice')
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/recurring/{id}/pause:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Pause a recurring invoice
 */
router.post(
  '/recurring/:id/pause',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const recurringId = parseInt(req.params.id, 10);

    if (isNaN(recurringId)) {
      return errorResponse(res, 'Invalid recurring invoice ID', 400, 'INVALID_ID');
    }

    try {
      await getInvoiceService().pauseRecurringInvoice(recurringId);

      messageResponse(res, 'Recurring invoice paused');
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to pause recurring invoice', 500, 'PAUSE_FAILED', {
        message: sanitizeErrorMessage(error, 'Failed to pause recurring invoice')
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/recurring/{id}/resume:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Resume a paused recurring invoice
 */
router.post(
  '/recurring/:id/resume',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const recurringId = parseInt(req.params.id, 10);

    if (isNaN(recurringId)) {
      return errorResponse(res, 'Invalid recurring invoice ID', 400, 'INVALID_ID');
    }

    try {
      await getInvoiceService().resumeRecurringInvoice(recurringId);

      messageResponse(res, 'Recurring invoice resumed');
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to resume recurring invoice', 500, 'RESUME_FAILED', {
        message: sanitizeErrorMessage(error, 'Failed to resume recurring invoice')
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/recurring/{id}:
 *   delete:
 *     tags:
 *       - Invoices
 *     summary: Delete a recurring invoice pattern
 */
router.delete(
  '/recurring/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const recurringId = parseInt(req.params.id, 10);

    if (isNaN(recurringId)) {
      return errorResponse(res, 'Invalid recurring invoice ID', 400, 'INVALID_ID');
    }

    try {
      await getInvoiceService().deleteRecurringInvoice(recurringId);

      messageResponse(res, 'Recurring invoice deleted');
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to delete recurring invoice', 500, 'DELETION_FAILED', {
        message: sanitizeErrorMessage(error, 'Failed to delete recurring invoice')
      });
    }
  })
);

export { router as recurringRouter };
export default router;
