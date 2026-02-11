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
import { errorResponse, errorResponseWithPayload } from '../../utils/api-response.js';
import { getInvoiceService, toSnakeCaseRecurringInvoice } from './helpers.js';

const router = express.Router();

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
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, clientId, frequency, dayOfMonth, dayOfWeek, lineItems, notes, terms, startDate, endDate } = req.body;

    if (!projectId || !clientId || !frequency || !lineItems?.length || !startDate) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, 'MISSING_FIELDS', {
        required: ['projectId', 'clientId', 'frequency', 'lineItems', 'startDate']
      });
    }

    const validFrequencies = ['weekly', 'monthly', 'quarterly'];
    if (!validFrequencies.includes(frequency)) {
      return errorResponseWithPayload(res, 'Invalid frequency', 400, 'INVALID_FREQUENCY', { validFrequencies });
    }

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

      res.status(201).json({
        success: true,
        message: 'Recurring invoice pattern created',
        recurring_invoice: toSnakeCaseRecurringInvoice(recurring)
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to create recurring invoice', 500, 'CREATION_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
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

      res.json({
        success: true,
        recurring_invoices: recurring.map(toSnakeCaseRecurringInvoice),
        count: recurring.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve recurring invoices', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
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
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_ID');
    }

    try {
      const recurring = await getInvoiceService().getRecurringInvoices(projectId);

      res.json({
        success: true,
        recurring_invoices: recurring.map(toSnakeCaseRecurringInvoice),
        count: recurring.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve recurring invoices', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
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
    const recurringId = parseInt(req.params.id);

    if (isNaN(recurringId)) {
      return errorResponse(res, 'Invalid recurring invoice ID', 400, 'INVALID_ID');
    }

    try {
      const recurring = await getInvoiceService().updateRecurringInvoice(recurringId, req.body);

      res.json({
        success: true,
        message: 'Recurring invoice updated',
        recurring_invoice: toSnakeCaseRecurringInvoice(recurring)
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to update recurring invoice', 500, 'UPDATE_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
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
    const recurringId = parseInt(req.params.id);

    if (isNaN(recurringId)) {
      return errorResponse(res, 'Invalid recurring invoice ID', 400, 'INVALID_ID');
    }

    try {
      await getInvoiceService().pauseRecurringInvoice(recurringId);

      res.json({
        success: true,
        message: 'Recurring invoice paused'
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to pause recurring invoice', 500, 'PAUSE_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
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
    const recurringId = parseInt(req.params.id);

    if (isNaN(recurringId)) {
      return errorResponse(res, 'Invalid recurring invoice ID', 400, 'INVALID_ID');
    }

    try {
      await getInvoiceService().resumeRecurringInvoice(recurringId);

      res.json({
        success: true,
        message: 'Recurring invoice resumed'
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to resume recurring invoice', 500, 'RESUME_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
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
    const recurringId = parseInt(req.params.id);

    if (isNaN(recurringId)) {
      return errorResponse(res, 'Invalid recurring invoice ID', 400, 'INVALID_ID');
    }

    try {
      await getInvoiceService().deleteRecurringInvoice(recurringId);

      res.json({
        success: true,
        message: 'Recurring invoice deleted'
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to delete recurring invoice', 500, 'DELETION_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export { router as recurringRouter };
export default router;
