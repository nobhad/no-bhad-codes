/**
 * ===============================================
 * INVOICE ROUTES
 * ===============================================
 * @file server/routes/invoices.ts
 *
 * Invoice management endpoints for creating, viewing, and updating invoices
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { canAccessInvoice } from '../middleware/access-control.js';
import {
  InvoiceService,
  InvoiceCreateData,
  Invoice,
  PaymentPlanTemplate,
  ScheduledInvoice,
  PaymentTermsPreset,
  InvoicePayment
} from '../services/invoice-service.js';
import { getDatabase } from '../database/init.js';
import { getPdfCacheKey, getCachedPdf, cachePdf } from '../utils/pdf-utils.js';
import { notDeleted } from '../database/query-helpers.js';
import { softDeleteService } from '../services/soft-delete-service.js';
import { errorResponse, errorResponseWithPayload, sendSuccess, sendCreated } from '../utils/api-response.js';
import { sendPdfResponse } from '../utils/pdf-generator.js';
import { coreRouter } from './invoices/core.js';
import { depositsRouter } from './invoices/deposits.js';
import { creditsRouter } from './invoices/credits.js';
import { paymentPlansRouter } from './invoices/payment-plans.js';
import { scheduledRouter } from './invoices/scheduled.js';
import { recurringRouter } from './invoices/recurring.js';
import { remindersRouter } from './invoices/reminders.js';
import { clientRoutesRouter } from './invoices/client-routes.js';
import { batchRouter } from './invoices/batch.js';
import { agingRouter } from './invoices/aging.js';
import {
  getInvoiceService,
  toSnakeCaseInvoice
} from './invoices/helpers.js';

const router = express.Router();

router.use(coreRouter);
router.use(depositsRouter);
router.use(creditsRouter);
router.use(paymentPlansRouter);
router.use(scheduledRouter);
router.use(recurringRouter);
router.use(remindersRouter);
router.use(clientRoutesRouter);
router.use(batchRouter);
router.use(agingRouter);

// ============================================
// MILESTONE-LINKED INVOICE ENDPOINTS
// ============================================

/**
 * @swagger
 * /api/invoices/milestone/{milestoneId}:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create an invoice linked to a milestone
 */
router.post(
  '/milestone/:milestoneId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const milestoneId = parseInt(req.params.milestoneId);

    if (isNaN(milestoneId)) {
      return errorResponse(res, 'Invalid milestone ID', 400, 'INVALID_ID');
    }

    const invoiceData: InvoiceCreateData = req.body;

    if (!invoiceData.projectId || !invoiceData.clientId || !invoiceData.lineItems?.length) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, 'MISSING_FIELDS', {
        required: ['projectId', 'clientId', 'lineItems']
      });
    }

    try {
      const invoice = await getInvoiceService().createMilestoneInvoice(milestoneId, invoiceData);

      sendCreated(res, { invoice: toSnakeCaseInvoice(invoice) }, 'Milestone invoice created');
    } catch (error: unknown) {
      return errorResponseWithPayload(res, 'Failed to create milestone invoice', 500, 'CREATION_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/milestone/{milestoneId}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get invoices linked to a milestone
 */
router.get(
  '/milestone/:milestoneId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const milestoneId = parseInt(req.params.milestoneId);

    if (isNaN(milestoneId)) {
      return errorResponse(res, 'Invalid milestone ID', 400, 'INVALID_ID');
    }

    try {
      const invoices = await getInvoiceService().getInvoicesByMilestone(milestoneId);

      sendSuccess(res, {
        invoices: invoices.map(toSnakeCaseInvoice),
        count: invoices.length
      });
    } catch (error: unknown) {
      return errorResponseWithPayload(res, 'Failed to retrieve milestone invoices', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/link-milestone:
 *   put:
 *     tags:
 *       - Invoices
 *     summary: Link an existing invoice to a milestone
 */
router.put(
  '/:id/link-milestone',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { milestoneId } = req.body;

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    if (!milestoneId) {
      return errorResponseWithPayload(res, 'Missing milestone ID', 400, 'MISSING_FIELDS', {
        required: ['milestoneId']
      });
    }

    try {
      const invoice = await getInvoiceService().linkInvoiceToMilestone(invoiceId, milestoneId);

      sendSuccess(res, { invoice: toSnakeCaseInvoice(invoice) }, 'Invoice linked to milestone');
    } catch (error: unknown) {
      return errorResponseWithPayload(res, 'Failed to link invoice to milestone', 500, 'LINK_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);


// ============================================
// INVOICE EDIT ENDPOINT
// ============================================

/**
 * @swagger
 * /api/invoices/{id}:
 *   put:
 *     tags:
 *       - Invoices
 *     summary: Update a draft invoice
 *     description: Update invoice details (only draft invoices can be edited)
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    // Handle status-only updates (backwards compatibility)
    if (req.body.status && Object.keys(req.body).length === 1) {
      const validStatuses = ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'];
      if (!validStatuses.includes(req.body.status)) {
        return errorResponseWithPayload(res, 'Invalid status', 400, 'INVALID_STATUS', { validStatuses });
      }

      try {
        const invoice = await getInvoiceService().updateInvoiceStatus(invoiceId, req.body.status);
        sendSuccess(res, { invoice: toSnakeCaseInvoice(invoice) }, 'Invoice status updated');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('not found')) {
          return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
        }
        return errorResponseWithPayload(res, 'Failed to update invoice', 500, 'UPDATE_FAILED', { message });
      }
      return;
    }

    try {
      const invoice = await getInvoiceService().updateInvoice(invoiceId, req.body);
      sendSuccess(res, { invoice: toSnakeCaseInvoice(invoice) }, 'Invoice updated successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('Only draft invoices can be edited')) {
        return errorResponse(res, 'Only draft invoices can be edited', 400, 'INVALID_STATUS');
      }
      if (message.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }
      return errorResponseWithPayload(res, 'Failed to update invoice', 500, 'UPDATE_FAILED', { message });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get invoice by ID
 *     description: Retrieve a single invoice by its ID
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
 *         description: Invoice retrieved successfully
 *       404:
 *         description: Invoice not found
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
      sendSuccess(res, { invoice });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }
      return errorResponse(res, 'Failed to retrieve invoice', 500, 'RETRIEVAL_FAILED');
    }
  })
);

// ============================================
// DELETE / VOID INVOICE
// ============================================

/**
 * @swagger
 * /api/invoices/{id}:
 *   delete:
 *     tags:
 *       - Invoices
 *     summary: Delete or void an invoice
 *     description: |
 *       Draft/Cancelled invoices are permanently deleted.
 *       Sent/Viewed/Partial/Overdue invoices are voided (status changed to cancelled).
 *       Paid invoices cannot be deleted or voided.
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
 *         description: Invoice deleted or voided
 *       400:
 *         description: Cannot delete paid invoice
 *       404:
 *         description: Invoice not found
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    try {
      const deletedBy = req.user?.email || 'admin';
      const result = await softDeleteService.softDeleteInvoice(invoiceId, deletedBy);

      if (!result.success) {
        // Check if it's a "cannot delete paid" error
        if (result.message.includes('paid')) {
          return errorResponse(res, result.message, 400, 'CANNOT_DELETE_PAID');
        }
        return errorResponse(res, result.message, 404, 'NOT_FOUND');
      }

      sendSuccess(res, { action: 'soft_deleted' }, result.message);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errorResponseWithPayload(res, 'Failed to delete invoice', 500, 'DELETE_FAILED', { message });
    }
  })
);

// ============================================
// DUPLICATE / CLONE INVOICE
// ============================================

/**
 * @swagger
 * /api/invoices/{id}/duplicate:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Duplicate an invoice
 *     description: Creates a new draft invoice as a copy of an existing invoice
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Invoice duplicated successfully
 *       404:
 *         description: Invoice not found
 */
router.post(
  '/:id/duplicate',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    try {
      const newInvoice = await getInvoiceService().duplicateInvoice(invoiceId);

      sendCreated(res, { invoice: toSnakeCaseInvoice(newInvoice) }, 'Invoice duplicated successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }
      errorResponseWithPayload(res, 'Failed to duplicate invoice', 500, 'DUPLICATE_FAILED', { message });
    }
  })
);

// ============================================
// RECORD PAYMENT
// ============================================

/**
 * @swagger
 * /api/invoices/{id}/record-payment:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Record a payment on an invoice
 *     description: Records a partial or full payment. Status auto-updates to 'partial' or 'paid'.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - paymentMethod
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 500
 *               paymentMethod:
 *                 type: string
 *                 example: "bank_transfer"
 *               paymentReference:
 *                 type: string
 *                 example: "TXN-12345"
 *     responses:
 *       200:
 *         description: Payment recorded successfully
 *       400:
 *         description: Invalid payment data
 */
router.post(
  '/:id/record-payment',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { amount, paymentMethod, paymentReference } = req.body;

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return errorResponse(res, 'Invalid payment amount', 400, 'INVALID_AMOUNT');
    }

    if (!paymentMethod) {
      return errorResponse(res, 'Payment method is required', 400, 'MISSING_PAYMENT_METHOD');
    }

    try {
      const invoice = await getInvoiceService().recordPayment(
        invoiceId,
        amount,
        paymentMethod,
        paymentReference
      );

      const paymentMessage = invoice.status === 'paid'
        ? 'Payment recorded - invoice is now fully paid'
        : 'Partial payment recorded successfully';
      sendSuccess(res, { invoice: toSnakeCaseInvoice(invoice) }, paymentMessage);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }

      if (message.includes('already fully paid') || message.includes('cancelled')) {
        return errorResponse(res, message, 400, 'PAYMENT_NOT_ALLOWED');
      }
      errorResponseWithPayload(res, 'Failed to record payment', 500, 'PAYMENT_FAILED', { message });
    }
  })
);

// ============================================
// CHECK AND MARK OVERDUE (ADMIN TRIGGER)
// ============================================

/**
 * @swagger
 * /api/invoices/check-overdue:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Check and mark overdue invoices
 *     description: Manually trigger the overdue check (also runs automatically via scheduler)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue check completed
 */
router.post(
  '/check-overdue',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const count = await getInvoiceService().checkAndMarkOverdue();

      const overdueMessage = count > 0
        ? `Marked ${count} invoice(s) as overdue`
        : 'No invoices needed to be marked as overdue';
      sendSuccess(res, { count }, overdueMessage);
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to check overdue invoices', 500, 'CHECK_OVERDUE_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// ============================================
// PAYMENT TERMS PRESETS
// ============================================

/**
 * Transform PaymentTermsPreset to snake_case for frontend
 */
function toSnakeCasePaymentTerms(terms: PaymentTermsPreset): Record<string, unknown> {
  return {
    id: terms.id,
    name: terms.name,
    days_until_due: terms.daysUntilDue,
    description: terms.description,
    late_fee_rate: terms.lateFeeRate,
    late_fee_type: terms.lateFeeType,
    late_fee_flat_amount: terms.lateFeeFlatAmount,
    grace_period_days: terms.gracePeriodDays,
    is_default: terms.isDefault,
    created_at: terms.createdAt
  };
}

/**
 * Transform InvoicePayment to snake_case for frontend
 */
function toSnakeCasePayment(payment: InvoicePayment): Record<string, unknown> {
  return {
    id: payment.id,
    invoice_id: payment.invoiceId,
    amount: payment.amount,
    payment_method: payment.paymentMethod,
    payment_reference: payment.paymentReference,
    payment_date: payment.paymentDate,
    notes: payment.notes,
    created_at: payment.createdAt
  };
}

/**
 * @swagger
 * /api/invoices/payment-terms:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get all payment terms presets
 *     description: Returns all available payment terms (Net 15, Net 30, etc.)
 */
router.get(
  '/payment-terms',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const terms = await getInvoiceService().getPaymentTermsPresets();
      sendSuccess(res, { terms: terms.map(toSnakeCasePaymentTerms) });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve payment terms', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/payment-terms:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create a custom payment terms preset
 */
router.post(
  '/payment-terms',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, daysUntilDue, description, lateFeeRate, lateFeeType, lateFeeFlatAmount, gracePeriodDays, isDefault } = req.body;

    if (!name || daysUntilDue === undefined) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, 'MISSING_FIELDS', {
        required: ['name', 'daysUntilDue']
      });
    }

    try {
      const terms = await getInvoiceService().createPaymentTermsPreset({
        name,
        daysUntilDue,
        description,
        lateFeeRate,
        lateFeeType,
        lateFeeFlatAmount,
        gracePeriodDays,
        isDefault
      });

      sendCreated(res, { terms: toSnakeCasePaymentTerms(terms) }, 'Payment terms preset created');
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to create payment terms', 500, 'CREATION_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/apply-terms:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Apply payment terms to an invoice
 */
router.post(
  '/:id/apply-terms',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { termsId } = req.body;

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    if (!termsId) {
      return errorResponseWithPayload(res, 'Missing termsId', 400, 'MISSING_FIELDS', {
        required: ['termsId']
      });
    }

    try {
      const invoice = await getInvoiceService().applyPaymentTerms(invoiceId, termsId);
      sendSuccess(res, { invoice: toSnakeCaseInvoice(invoice) }, 'Payment terms applied');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return errorResponse(res, 'Invoice or payment terms not found', 404, 'NOT_FOUND');
      }
      errorResponseWithPayload(res, 'Failed to apply payment terms', 500, 'UPDATE_FAILED', { message });
    }
  })
);

// ============================================
// TAX AND DISCOUNT
// ============================================

/**
 * @swagger
 * /api/invoices/{id}/tax-discount:
 *   put:
 *     tags:
 *       - Invoices
 *     summary: Update invoice tax and discount
 */
router.put(
  '/:id/tax-discount',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { taxRate, discountType, discountValue } = req.body;

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    try {
      const invoice = await getInvoiceService().updateInvoiceTaxAndDiscount(
        invoiceId,
        taxRate,
        discountType,
        discountValue
      );

      sendSuccess(res, { invoice: toSnakeCaseInvoice(invoice) }, 'Tax and discount updated');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('draft')) {
        return errorResponse(res, 'Only draft invoices can be modified', 400, 'INVALID_STATUS');
      }
      errorResponseWithPayload(res, 'Failed to update tax/discount', 500, 'UPDATE_FAILED', { message });
    }
  })
);

// ============================================
// LATE FEES
// ============================================

/**
 * @swagger
 * /api/invoices/{id}/late-fee:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Calculate late fee for an invoice
 */
router.get(
  '/:id/late-fee',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    try {
      const invoice = await getInvoiceService().getInvoiceById(invoiceId);
      const lateFee = getInvoiceService().calculateLateFee(invoice);

      sendSuccess(res, {
        invoiceId,
        lateFee,
        alreadyApplied: !!invoice.lateFeeAppliedAt,
        lateFeeAppliedAt: invoice.lateFeeAppliedAt
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }
      errorResponseWithPayload(res, 'Failed to calculate late fee', 500, 'CALCULATION_FAILED', { message });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/apply-late-fee:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Apply late fee to an overdue invoice
 */
router.post(
  '/:id/apply-late-fee',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    try {
      const invoice = await getInvoiceService().applyLateFee(invoiceId);
      sendSuccess(res, { invoice: toSnakeCaseInvoice(invoice) }, 'Late fee applied');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('already been applied')) {
        return errorResponse(res, 'Late fee already applied', 400, 'ALREADY_APPLIED');
      }
      if (message.includes('No late fee applicable')) {
        return errorResponse(res, 'No late fee applicable', 400, 'NOT_APPLICABLE');
      }
      errorResponseWithPayload(res, 'Failed to apply late fee', 500, 'APPLY_FAILED', { message });
    }
  })
);

/**
 * @swagger
 * /api/invoices/process-late-fees:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Process late fees for all eligible invoices
 */
router.post(
  '/process-late-fees',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const count = await getInvoiceService().processLateFees();
      sendSuccess(res, { count }, `Late fees applied to ${count} invoices`);
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to process late fees', 500, 'PROCESS_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// ============================================
// PAYMENT HISTORY
// ============================================

/**
 * @swagger
 * /api/invoices/{id}/payments:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get payment history for an invoice
 */
router.get(
  '/:id/payments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    try {
      const payments = await getInvoiceService().getPaymentHistory(invoiceId);
      sendSuccess(res, { payments: payments.map(toSnakeCasePayment) });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve payment history', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/record-payment-with-history:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Record a payment and add to payment history
 */
router.post(
  '/:id/record-payment-with-history',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { amount, paymentMethod, paymentReference, notes } = req.body;

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    if (!amount || !paymentMethod) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, 'MISSING_FIELDS', {
        required: ['amount', 'paymentMethod']
      });
    }

    try {
      const result = await getInvoiceService().recordPaymentWithHistory(
        invoiceId,
        amount,
        paymentMethod,
        paymentReference,
        notes
      );

      sendSuccess(res, {
        invoice: toSnakeCaseInvoice(result.invoice),
        payment: toSnakeCasePayment(result.payment)
      }, 'Payment recorded');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errorResponseWithPayload(res, 'Failed to record payment', 500, 'RECORD_FAILED', { message });
    }
  })
);


// ============================================
// INTERNAL NOTES
// ============================================

/**
 * @swagger
 * /api/invoices/{id}/internal-notes:
 *   put:
 *     tags:
 *       - Invoices
 *     summary: Update internal notes on an invoice
 */
router.put(
  '/:id/internal-notes',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { internalNotes } = req.body;

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    try {
      const invoice = await getInvoiceService().updateInternalNotes(invoiceId, internalNotes || '');
      sendSuccess(res, { invoice: toSnakeCaseInvoice(invoice) }, 'Internal notes updated');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }
      errorResponseWithPayload(res, 'Failed to update internal notes', 500, 'UPDATE_FAILED', { message });
    }
  })
);

// ============================================
// COMPREHENSIVE STATISTICS
// ============================================

/**
 * @swagger
 * /api/invoices/comprehensive-stats:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get comprehensive invoice statistics
 */
router.get(
  '/comprehensive-stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    try {
      const stats = await getInvoiceService().getComprehensiveStats(dateFrom, dateTo);

      sendSuccess(res, {
        stats: {
          total_invoices: stats.totalInvoices,
          total_revenue: stats.totalRevenue,
          total_outstanding: stats.totalOutstanding,
          total_overdue: stats.totalOverdue,
          average_invoice_amount: stats.averageInvoiceAmount,
          average_days_to_payment: stats.averageDaysToPayment,
          status_breakdown: stats.statusBreakdown,
          monthly_revenue: stats.monthlyRevenue
        }
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve statistics', 500, 'STATS_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// ============================================
// CUSTOM INVOICE NUMBER
// ============================================

/**
 * @swagger
 * /api/invoices/with-custom-number:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create invoice with custom number prefix
 */
router.post(
  '/with-custom-number',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { prefix, ...invoiceData } = req.body;

    if (!invoiceData.projectId || !invoiceData.clientId || !invoiceData.lineItems?.length) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, 'MISSING_FIELDS', {
        required: ['projectId', 'clientId', 'lineItems']
      });
    }

    try {
      const invoice = await getInvoiceService().createInvoiceWithCustomNumber({
        ...invoiceData,
        prefix
      });

      sendCreated(res, { invoice: toSnakeCaseInvoice(invoice) }, 'Invoice created with custom number');
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to create invoice', 500, 'CREATION_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);


export { router as invoicesRouter };
export default router;
