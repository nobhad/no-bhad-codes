/**
 * ===============================================
 * INVOICE BATCH ROUTES
 * ===============================================
 * @file server/routes/invoices/batch.ts
 *
 * Batch exports and payment rollups.
 */

import archiver from 'archiver';
import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, errorResponseWithPayload } from '../../utils/api-response.js';
import { getDatabase } from '../../database/init.js';
import { getString } from '../../database/row-helpers.js';
import { getInvoiceService, toSnakeCasePayment } from './helpers.js';
import { generateInvoicePdf, InvoicePdfData } from './pdf.js';
import { InvoiceLineItem } from '../../services/invoice-service.js';
import { logger } from '../../services/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/invoices/all-payments:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get all payments across all invoices
 */
router.get(
  '/all-payments',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    try {
      const payments = await getInvoiceService().getAllPayments(dateFrom, dateTo);
      res.json({
        success: true,
        payments: payments.map(toSnakeCasePayment),
        count: payments.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve payments', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * POST /api/invoices/export-batch
 * Export multiple invoices as a ZIP file
 * Body: { invoiceIds: number[] }
 */
router.post(
  '/export-batch',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { invoiceIds } = req.body;

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return errorResponse(res, 'invoiceIds must be a non-empty array', 400, 'INVALID_INPUT');
    }

    if (invoiceIds.length > 100) {
      return errorResponse(res, 'Maximum 100 invoices can be exported at once', 400, 'TOO_MANY_INVOICES');
    }

    const db = getDatabase();
    const invoiceService = getInvoiceService();

    // Helper function to format date
    const formatDate = (dateStr: string | undefined): string => {
      if (!dateStr) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    // Set up ZIP response
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="invoices-${Date.now()}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      logger.error('[Invoices] ZIP archive error:', { error: err });
      if (!res.headersSent) {
        errorResponse(res, 'Failed to create ZIP archive', 500, 'ZIP_FAILED');
      }
    });

    archive.pipe(res);

    let successCount = 0;
    let errorCount = 0;
    const errors: { id: number; error: string }[] = [];

    for (const invoiceId of invoiceIds) {
      try {
        const invoice = await invoiceService.getInvoiceById(invoiceId);

        // Get client info
        const client = await db.get(
          'SELECT contact_name, company_name, email, client_type FROM clients WHERE id = ?',
          [invoice.clientId]
        );

        // Build line items
        const lineItems: InvoicePdfData['lineItems'] = Array.isArray(invoice.lineItems)
          ? invoice.lineItems.map((item: InvoiceLineItem) => ({
            description: item.description || '',
            quantity: item.quantity || 1,
            rate: item.rate || item.amount || 0,
            amount: item.amount || 0
          }))
          : [];

        // Get credits
        const invoiceCredits = await invoiceService.getInvoiceCredits(invoiceId);
        const totalCredits = await invoiceService.getTotalCredits(invoiceId);

        // Build PDF data
        const pdfData: InvoicePdfData = {
          invoiceNumber: invoice.invoiceNumber,
          issuedDate: formatDate(invoice.issuedDate || invoice.createdAt),
          dueDate: 'Within 14 days',
          clientName: invoice.clientName || (client ? getString(client, 'contact_name') : '') || 'Client',
          clientCompany: client ? getString(client, 'company_name') : '',
          clientEmail: invoice.clientEmail || (client ? getString(client, 'email') : '') || '',
          projectId: invoice.projectId,
          lineItems,
          subtotal: invoice.amountTotal || 0,
          total: invoice.amountTotal || 0,
          notes: invoice.notes,
          terms: invoice.terms,
          isDeposit: invoice.invoiceType === 'deposit',
          depositPercentage: invoice.depositPercentage,
          credits: invoiceCredits.map((c) => ({
            depositInvoiceNumber: c.depositInvoiceNumber || `INV-${c.depositInvoiceId}`,
            amount: c.amount
          })),
          totalCredits
        };

        // Generate PDF
        const pdfBytes = await generateInvoicePdf(pdfData);

        // Add to ZIP
        archive.append(Buffer.from(pdfBytes), { name: `${invoice.invoiceNumber}.pdf` });
        successCount++;
      } catch (error) {
         logger.error(`[Invoices] Failed to generate PDF for invoice ${invoiceId}:`, { error: error instanceof Error ? error : undefined });
        errorCount++;
        errors.push({
          id: invoiceId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Add manifest file with export summary
    const manifest = {
      exportedAt: new Date().toISOString(),
      totalRequested: invoiceIds.length,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    await archive.finalize();
  })
);

export { router as batchRouter };
export default router;
