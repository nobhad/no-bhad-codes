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
import { ErrorCodes, errorResponse, errorResponseWithPayload, sendSuccess, sanitizeErrorMessage } from '../../utils/api-response.js';
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
    const {
      projectId,
      clientId,
      scheduledDate,
      triggerType,
      triggerMilestoneId,
      lineItems,
      notes,
      terms
    } = req.body;

    if (!projectId || !clientId || !scheduledDate || !lineItems?.length) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, ErrorCodes.MISSING_FIELDS, {
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

      sendSuccess(res, {
        scheduled_invoice: toSnakeCaseScheduledInvoice(scheduled)
      }, 'Invoice scheduled', 201);
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to schedule invoice', 500, ErrorCodes.SCHEDULING_FAILED, {
        message: sanitizeErrorMessage(error, 'Failed to schedule invoice')
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

      sendSuccess(res, {
        scheduled_invoices: scheduled.map(toSnakeCaseScheduledInvoice),
        count: scheduled.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(
        res,
        'Failed to retrieve scheduled invoices',
        500,
        ErrorCodes.RETRIEVAL_FAILED,
        {
          message: sanitizeErrorMessage(error, 'Failed to retrieve scheduled invoices')
        }
      );
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
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_ID);
    }

    try {
      const scheduled = await getInvoiceService().getScheduledInvoices(projectId);

      sendSuccess(res, {
        scheduled_invoices: scheduled.map(toSnakeCaseScheduledInvoice),
        count: scheduled.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(
        res,
        'Failed to retrieve scheduled invoices',
        500,
        ErrorCodes.RETRIEVAL_FAILED,
        {
          message: sanitizeErrorMessage(error, 'Failed to retrieve scheduled invoices')
        }
      );
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
    const scheduledId = parseInt(req.params.id, 10);

    if (isNaN(scheduledId) || scheduledId <= 0) {
      return errorResponse(res, 'Invalid scheduled invoice ID', 400, ErrorCodes.INVALID_ID);
    }

    try {
      await getInvoiceService().cancelScheduledInvoice(scheduledId);

      sendSuccess(res, undefined, 'Scheduled invoice cancelled');
    } catch (error: unknown) {
      errorResponseWithPayload(
        res,
        'Failed to cancel scheduled invoice',
        500,
        ErrorCodes.CANCELLATION_FAILED,
        {
          message: sanitizeErrorMessage(error, 'Failed to cancel scheduled invoice')
        }
      );
    }
  })
);

export { router as scheduledRouter };
export default router;
