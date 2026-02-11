/**
 * ===============================================
 * INVOICE AGING ROUTES
 * ===============================================
 * @file server/routes/invoices/aging.ts
 *
 * Aging report endpoints.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponseWithPayload } from '../../utils/api-response.js';
import { getInvoiceService, toSnakeCaseInvoice } from './helpers.js';

const router = express.Router();

/**
 * @swagger
 * /api/invoices/aging-report:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get accounts receivable aging report
 */
router.get(
  '/aging-report',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;

    try {
      const report = await getInvoiceService().getAgingReport(clientId);

      // Transform the report for frontend
      const transformedReport = {
        generated_at: report.generatedAt,
        total_outstanding: report.totalOutstanding,
        buckets: report.buckets.map(bucket => ({
          bucket: bucket.bucket,
          count: bucket.count,
          total_amount: bucket.totalAmount,
          invoices: bucket.invoices.map(toSnakeCaseInvoice)
        }))
      };

      res.json({
        success: true,
        report: transformedReport
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to generate aging report', 500, 'REPORT_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export { router as agingRouter };
export default router;
