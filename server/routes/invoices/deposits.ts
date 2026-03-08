/**
 * ===============================================
 * INVOICE DEPOSIT ROUTES
 * ===============================================
 * @file server/routes/invoices/deposits.ts
 *
 * Deposit invoice endpoints.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { ErrorCodes, errorResponse, errorResponseWithPayload, sendSuccess, sendCreated, sanitizeErrorMessage } from '../../utils/api-response.js';
import { getInvoiceService, toSnakeCaseDeposit, toSnakeCaseInvoice } from './helpers.js';
import { logger } from '../../services/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/invoices/deposit:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create a deposit invoice
 *     description: Create a special deposit invoice for a project
 */
router.post(
  '/deposit',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, clientId, amount, percentage, description } = req.body;

    if (!projectId || !clientId || !amount) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, ErrorCodes.MISSING_FIELDS, {
        required: ['projectId', 'clientId', 'amount']
      });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return errorResponseWithPayload(res, 'Invalid amount', 400, ErrorCodes.INVALID_AMOUNT, {
        message: 'Amount must be a positive number'
      });
    }

    try {
      const invoice = await getInvoiceService().createDepositInvoice(
        projectId,
        clientId,
        amount,
        percentage,
        description
      );

      sendCreated(res, { invoice: toSnakeCaseInvoice(invoice) }, 'Deposit invoice created successfully');
    } catch (error: unknown) {
      logger.error('[Invoices] Error creating deposit invoice:', {
        error: error instanceof Error ? error : undefined
      });
      errorResponseWithPayload(res, 'Failed to create deposit invoice', 500, ErrorCodes.CREATION_FAILED, {
        message: sanitizeErrorMessage(error, 'Failed to create deposit invoice')
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/deposits/{projectId}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get available deposits for a project
 *     description: Returns paid deposit invoices that have available credit
 */
router.get(
  '/deposits/:projectId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_ID);
    }

    try {
      const deposits = await getInvoiceService().getAvailableDeposits(projectId);
      sendSuccess(res, {
        deposits: deposits.map(toSnakeCaseDeposit),
        count: deposits.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(
        res,
        'Failed to retrieve available deposits',
        500,
        ErrorCodes.RETRIEVAL_FAILED,
        {
          message: sanitizeErrorMessage(error, 'Failed to retrieve available deposits')
        }
      );
    }
  })
);

export { router as depositsRouter };
export default router;
