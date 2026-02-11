/**
 * ===============================================
 * INVOICE SCHEDULED ROUTES
 * ===============================================
 * @file server/routes/invoices/scheduled.ts
 *
 * Scheduled invoice endpoints.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, errorResponseWithPayload } from '../../utils/api-response.js';
import { getInvoiceService, toSnakeCaseScheduledInvoice } from './helpers.js';

const router = express.Router();

/**
 * @swagger
 * /api/invoices/schedule:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Schedule an invoice for future generation
 */
router.post(
  '/schedule',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, clientId, scheduledDate, triggerType, triggerMilestoneId, lineItems, notes, terms } = req.body;

    if (!projectId || !clientId || !scheduledDate || !lineItems?.length) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, 'MISSING_FIELDS', {
        required: ['projectId', 'clientId', 'scheduledDate', 'lineItems']
      });
    }

    try {
      const scheduled = await getInvoiceService().scheduleInvoice({
        projectId,
        clientId,
        scheduledDate,
        triggerType,
        triggerMilestoneId,
        lineItems,
        notes,
        terms
      });

      res.status(201).json({
        success: true,
        message: 'Invoice scheduled',
        scheduled_invoice: toSnakeCaseScheduledInvoice(scheduled)
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to schedule invoice', 500, 'SCHEDULING_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/scheduled:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get all scheduled invoices
 */
router.get(
  '/scheduled',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const scheduled = await getInvoiceService().getScheduledInvoices();

      res.json({
        success: true,
        scheduled_invoices: scheduled.map(toSnakeCaseScheduledInvoice),
        count: scheduled.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve scheduled invoices', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/scheduled/{projectId}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get scheduled invoices for a project
 */
router.get(
  '/scheduled/:projectId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_ID');
    }

    try {
      const scheduled = await getInvoiceService().getScheduledInvoices(projectId);

      res.json({
        success: true,
        scheduled_invoices: scheduled.map(toSnakeCaseScheduledInvoice),
        count: scheduled.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve scheduled invoices', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/scheduled/{id}:
 *   delete:
 *     tags:
 *       - Invoices
 *     summary: Cancel a scheduled invoice
 */
router.delete(
  '/scheduled/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const scheduledId = parseInt(req.params.id);

    if (isNaN(scheduledId)) {
      return errorResponse(res, 'Invalid scheduled invoice ID', 400, 'INVALID_ID');
    }

    try {
      await getInvoiceService().cancelScheduledInvoice(scheduledId);

      res.json({
        success: true,
        message: 'Scheduled invoice cancelled'
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to cancel scheduled invoice', 500, 'CANCELLATION_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export { router as scheduledRouter };
export default router;
