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
import { ErrorCodes, errorResponse, errorResponseWithPayload, sendSuccess, sanitizeErrorMessage } from '../../utils/api-response.js';
import { invalidateCache } from '../../middleware/cache.js';
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
  invalidateCache(['invoices']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id, 10);
    const { depositInvoiceId, amount } = req.body;

    if (isNaN(invoiceId) || invoiceId <= 0) {
      return errorResponse(res, 'Invalid invoice ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!depositInvoiceId || !amount) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, ErrorCodes.MISSING_FIELDS, {
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

      sendSuccess(res, { credit: toSnakeCaseCredit(credit) }, 'Credit applied successfully');
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : '';
      if (rawMessage.includes('Insufficient') || rawMessage.includes('Invalid')) {
        return errorResponse(res, rawMessage, 400, ErrorCodes.INVALID_CREDIT);
      }
      errorResponseWithPayload(res, 'Failed to apply credit', 500, ErrorCodes.CREDIT_FAILED, {
        message: sanitizeErrorMessage(error, 'Failed to apply deposit credit')
      });
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
    const invoiceId = parseInt(req.params.id, 10);

    if (isNaN(invoiceId) || invoiceId <= 0) {
      return errorResponse(res, 'Invalid invoice ID', 400, ErrorCodes.INVALID_ID);
    }

    try {
      const credits = await getInvoiceService().getInvoiceCredits(invoiceId);
      const totalCredits = await getInvoiceService().getTotalCredits(invoiceId);

      sendSuccess(res, {
        credits: credits.map(toSnakeCaseCredit),
        total_credits: totalCredits
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve credits', 500, ErrorCodes.RETRIEVAL_FAILED, {
        message: sanitizeErrorMessage(error, 'Failed to retrieve invoice credits')
      });
    }
  })
);

export { router as creditsRouter };
export default router;
