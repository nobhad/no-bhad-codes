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
import { errorResponse, errorResponseWithPayload } from '../../utils/api-response.js';
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
      return errorResponseWithPayload(res, 'Missing required fields', 400, 'MISSING_FIELDS', {
        required: ['projectId', 'clientId', 'amount']
      });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return errorResponseWithPayload(res, 'Invalid amount', 400, 'INVALID_AMOUNT', {
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

      res.status(201).json({
        success: true,
        message: 'Deposit invoice created successfully',
        invoice: toSnakeCaseInvoice(invoice)
      });
    } catch (error: unknown) {
      logger.error('[Invoices] Error creating deposit invoice:', { error: error instanceof Error ? error : undefined });
      errorResponseWithPayload(res, 'Failed to create deposit invoice', 500, 'CREATION_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
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
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_ID');
    }

    try {
      const deposits = await getInvoiceService().getAvailableDeposits(projectId);
      res.json({
        success: true,
        deposits: deposits.map(toSnakeCaseDeposit),
        count: deposits.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve available deposits', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export { router as depositsRouter };
export default router;
