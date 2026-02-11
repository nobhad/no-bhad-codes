/**
 * ===============================================
 * INVOICE CREDIT ROUTES
 * ===============================================
 * @file server/routes/invoices/credits.ts
 *
 * Deposit credit endpoints.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, errorResponseWithPayload } from '../../utils/api-response.js';
import { getInvoiceService, toSnakeCaseCredit } from './helpers.js';

const router = express.Router();

/**
 * @swagger
 * /api/invoices/{id}/apply-credit:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Apply deposit credit to an invoice
 *     description: Apply credit from a paid deposit invoice to reduce the amount due
 */
router.post(
  '/:id/apply-credit',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { depositInvoiceId, amount } = req.body;

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    if (!depositInvoiceId || !amount) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, 'MISSING_FIELDS', {
        required: ['depositInvoiceId', 'amount']
      });
    }

    try {
      const credit = await getInvoiceService().applyDepositCredit(
        invoiceId,
        depositInvoiceId,
        parseFloat(amount),
        req.user?.email
      );

      res.json({
        success: true,
        message: 'Credit applied successfully',
        credit: toSnakeCaseCredit(credit)
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('Insufficient') || message.includes('Invalid')) {
        return errorResponse(res, message, 400, 'INVALID_CREDIT');
      }
      errorResponseWithPayload(res, 'Failed to apply credit', 500, 'CREDIT_FAILED', { message });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/credits:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get credits applied to an invoice
 */
router.get(
  '/:id/credits',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    try {
      const credits = await getInvoiceService().getInvoiceCredits(invoiceId);
      const totalCredits = await getInvoiceService().getTotalCredits(invoiceId);

      res.json({
        success: true,
        credits: credits.map(toSnakeCaseCredit),
        total_credits: totalCredits
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve credits', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export { router as creditsRouter };
export default router;
