/**
 * ===============================================
 * INVOICE CLIENT ROUTES
 * ===============================================
 * @file server/routes/invoices/client-routes.ts
 *
 * Client-facing invoice endpoints.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessInvoice } from '../../middleware/access-control.js';
import { errorResponse, errorResponseWithPayload } from '../../utils/api-response.js';
import { getInvoiceService, toSnakeCaseInvoice } from './helpers.js';

const router = express.Router();

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get invoice by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    try {
      const invoice = await getInvoiceService().getInvoiceById(invoiceId);
      if (!(await canAccessInvoice(req, invoiceId))) {
        return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
      }
      res.json({ success: true, invoice });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }
      errorResponseWithPayload(res, 'Failed to retrieve invoice', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/number/{invoiceNumber}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get invoice by invoice number
 */
router.get(
  '/number/:invoiceNumber',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { invoiceNumber } = req.params;

    try {
      const invoice = await getInvoiceService().getInvoiceByNumber(invoiceNumber);
      if (!invoice.id) {
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }
      if (!(await canAccessInvoice(req, invoice.id))) {
        return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
      }
      res.json({ success: true, invoice });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }
      errorResponseWithPayload(res, 'Failed to retrieve invoice', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/me:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get all invoices for the authenticated client
 *     description: Returns invoices for the currently logged-in client with summary stats
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Client invoices retrieved successfully
 */
router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;

    if (!clientId) {
      return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
    }

    try {
      const invoices = await getInvoiceService().getClientInvoices(clientId);

      // Calculate summary stats
      let totalOutstanding = 0;
      let totalPaid = 0;

      invoices.forEach((invoice) => {
        if (invoice.status === 'paid') {
          totalPaid += invoice.amountTotal || 0;
        } else if (['sent', 'viewed', 'partial', 'overdue'].includes(invoice.status)) {
          totalOutstanding += invoice.amountTotal || 0;
          // Subtract any partial payments
          if (invoice.amountPaid) {
            totalOutstanding -= invoice.amountPaid || 0;
            totalPaid += invoice.amountPaid || 0;
          }
        }
      });

      // Transform invoices to snake_case for frontend compatibility
      const transformedInvoices = invoices.map(toSnakeCaseInvoice);

      res.json({
        success: true,
        invoices: transformedInvoices,
        count: invoices.length,
        summary: {
          totalOutstanding,
          totalPaid
        }
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve invoices', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export { router as clientRoutesRouter };
export default router;
