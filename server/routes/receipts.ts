/**
 * ===============================================
 * RECEIPT ROUTES
 * ===============================================
 * @file server/routes/receipts.ts
 *
 * API endpoints for receipt management and PDF download.
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import {
  sendSuccess,
  errorResponse,
  errorResponseWithPayload
} from '../utils/api-response.js';
import { sendPdfResponse } from '../utils/pdf-generator.js';
import { receiptService, Receipt } from '../services/receipt-service.js';
import { getDatabase } from '../database/init.js';

const router = express.Router();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Transform Receipt to snake_case for frontend
 */
function toSnakeCaseReceipt(receipt: Receipt): Record<string, unknown> {
  return {
    id: receipt.id,
    receipt_number: receipt.receiptNumber,
    invoice_id: receipt.invoiceId,
    payment_id: receipt.paymentId,
    amount: receipt.amount,
    file_id: receipt.fileId,
    created_at: receipt.createdAt,
    invoice_number: receipt.invoiceNumber,
    client_name: receipt.clientName,
    client_email: receipt.clientEmail,
    project_name: receipt.projectName
  };
}

/**
 * Check if user can access a receipt
 */
async function canAccessReceipt(req: AuthenticatedRequest, receiptId: number): Promise<boolean> {
  if (req.user?.type === 'admin') {
    return true;
  }

  // For clients, check if receipt belongs to their invoice
  const db = getDatabase();
  const row = await db.get(
    `SELECT 1 FROM receipts r
     JOIN invoices i ON r.invoice_id = i.id
     WHERE r.id = ? AND i.client_id = ?`,
    [receiptId, req.user?.id]
  );

  return !!row;
}

/**
 * Check if user can access invoice receipts
 */
async function canAccessInvoiceReceipts(req: AuthenticatedRequest, invoiceId: number): Promise<boolean> {
  if (req.user?.type === 'admin') {
    return true;
  }

  const db = getDatabase();
  const row = await db.get(
    'SELECT 1 FROM invoices WHERE id = ? AND client_id = ?',
    [invoiceId, req.user?.id]
  );

  return !!row;
}

// ============================================
// ROUTES
// ============================================

/**
 * @swagger
 * /api/receipts:
 *   get:
 *     tags:
 *       - Receipts
 *     summary: Get all receipts (admin) or client receipts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: integer
 *         description: Filter by client ID (admin only)
 *     responses:
 *       200:
 *         description: List of receipts
 */
router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      let receipts: Receipt[];

      if (req.user?.type === 'admin') {
        // Admin can filter by client or get all
        const clientId = req.query.clientId ? parseInt(req.query.clientId as string, 10) : undefined;
        if (clientId) {
          receipts = await receiptService.getReceiptsByClient(clientId);
        } else {
          // Get all receipts (no specific method, use DB directly)
          const db = getDatabase();
          const rows = await db.all(
            `SELECT r.*, i.invoice_number,
                    c.contact_name as client_name, c.email as client_email,
                    p.project_name
             FROM receipts r
             JOIN invoices i ON r.invoice_id = i.id
             JOIN clients c ON i.client_id = c.id
             LEFT JOIN projects p ON i.project_id = p.id
             ORDER BY r.created_at DESC
             LIMIT 100`
          );
          receipts = rows.map((row: any) => ({
            id: row.id,
            receiptNumber: row.receipt_number,
            invoiceId: row.invoice_id,
            paymentId: row.payment_id,
            amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount,
            fileId: row.file_id,
            createdAt: row.created_at,
            invoiceNumber: row.invoice_number,
            clientName: row.client_name,
            clientEmail: row.client_email,
            projectName: row.project_name
          }));
        }
      } else {
        // Client gets their own receipts
        receipts = await receiptService.getReceiptsByClient(req.user!.id);
      }

      sendSuccess(res, {
        receipts: receipts.map(toSnakeCaseReceipt),
        count: receipts.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve receipts', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/receipts/{id}:
 *   get:
 *     tags:
 *       - Receipts
 *     summary: Get a specific receipt
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Receipt details
 *       404:
 *         description: Receipt not found
 */
router.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const receiptId = parseInt(req.params.id, 10);

    if (isNaN(receiptId)) {
      return errorResponse(res, 'Invalid receipt ID', 400, 'INVALID_ID');
    }

    try {
      if (!(await canAccessReceipt(req, receiptId))) {
        return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
      }

      const receipt = await receiptService.getReceiptById(receiptId);
      sendSuccess(res, { receipt: toSnakeCaseReceipt(receipt) });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return errorResponse(res, 'Receipt not found', 404, 'NOT_FOUND');
      }
      errorResponseWithPayload(res, 'Failed to retrieve receipt', 500, 'RETRIEVAL_FAILED', { message });
    }
  })
);

/**
 * @swagger
 * /api/receipts/invoice/{invoiceId}:
 *   get:
 *     tags:
 *       - Receipts
 *     summary: Get all receipts for an invoice
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of receipts for the invoice
 */
router.get(
  '/invoice/:invoiceId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.invoiceId, 10);

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    try {
      if (!(await canAccessInvoiceReceipts(req, invoiceId))) {
        return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
      }

      const receipts = await receiptService.getReceiptsByInvoice(invoiceId);
      sendSuccess(res, {
        receipts: receipts.map(toSnakeCaseReceipt),
        count: receipts.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve receipts', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/receipts/{id}/pdf:
 *   get:
 *     tags:
 *       - Receipts
 *     summary: Download receipt as PDF
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: preview
 *         schema:
 *           type: boolean
 *         description: When true, returns inline preview instead of attachment
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Receipt not found
 */
router.get(
  '/:id/pdf',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const receiptId = parseInt(req.params.id, 10);

    if (isNaN(receiptId)) {
      return errorResponse(res, 'Invalid receipt ID', 400, 'INVALID_ID');
    }

    try {
      if (!(await canAccessReceipt(req, receiptId))) {
        return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
      }

      const { pdfBytes, filename } = await receiptService.getReceiptPdf(receiptId);
      const disposition = req.query.preview === 'true' ? 'inline' : 'attachment';

      sendPdfResponse(res, pdfBytes, { filename, disposition });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return errorResponse(res, 'Receipt not found', 404, 'NOT_FOUND');
      }
      errorResponseWithPayload(res, 'Failed to generate receipt PDF', 500, 'PDF_FAILED', { message });
    }
  })
);

/**
 * @swagger
 * /api/receipts/client/{clientId}:
 *   get:
 *     tags:
 *       - Receipts
 *     summary: Get all receipts for a client (admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of receipts for the client
 */
router.get(
  '/client/:clientId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId, 10);

    if (isNaN(clientId)) {
      return errorResponse(res, 'Invalid client ID', 400, 'INVALID_ID');
    }

    try {
      const receipts = await receiptService.getReceiptsByClient(clientId);
      sendSuccess(res, {
        receipts: receipts.map(toSnakeCaseReceipt),
        count: receipts.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve receipts', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export default router;
