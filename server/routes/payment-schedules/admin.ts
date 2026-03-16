/**
 * ===============================================
 * PAYMENT SCHEDULE ROUTES - ADMIN
 * ===============================================
 * @file server/routes/payment-schedules/admin.ts
 *
 * Admin CRUD endpoints for payment schedule installments.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { paymentScheduleService } from '../../services/payment-schedule-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { validateRequest } from '../../middleware/validation.js';
import { PaymentScheduleValidationSchemas } from './shared.js';

const router = express.Router();

// =====================================================
// LIST & QUERY
// =====================================================

/**
 * GET /api/payment-schedules
 * List installments with optional filters
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, clientId } = req.query;

    if (projectId) {
      const installments = await paymentScheduleService.getByProject(Number(projectId));
      sendSuccess(res, { installments });
      return;
    }

    if (clientId) {
      const installments = await paymentScheduleService.getByClient(Number(clientId));
      sendSuccess(res, { installments });
      return;
    }

    // Default: return overdue installments for dashboard
    const installments = await paymentScheduleService.getOverdue();
    sendSuccess(res, { installments });
  })
);

/**
 * GET /api/payment-schedules/overdue
 * Get all overdue installments
 */
router.get(
  '/overdue',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const installments = await paymentScheduleService.getOverdue();
    sendSuccess(res, { installments });
  })
);

/**
 * GET /api/payment-schedules/:id
 * Get a single installment
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const installment = await paymentScheduleService.getInstallment(Number(req.params.id));
    if (!installment) {
      errorResponse(res, 'Installment not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }
    sendSuccess(res, { installment });
  })
);

// =====================================================
// CREATE
// =====================================================

/**
 * POST /api/payment-schedules
 * Create a payment schedule (batch of installments)
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest(PaymentScheduleValidationSchemas.createSchedule),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { project_id, client_id, contract_id, installments } = req.body;

    if (!installments || !Array.isArray(installments) || installments.length === 0) {
      errorResponse(res, 'Installments array is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const created = await paymentScheduleService.createSchedule(
      project_id,
      client_id,
      installments.map((inst: { label?: string; amount: number; due_date: string; notes?: string }, index: number) => ({
        installmentNumber: index + 1,
        label: inst.label,
        amount: inst.amount,
        dueDate: inst.due_date,
        notes: inst.notes
      })),
      contract_id
    );

    sendCreated(res, { installments: created }, `Created ${created.length} installments`);
  })
);

/**
 * POST /api/payment-schedules/from-split
 * Create installments from a percentage split
 */
router.post(
  '/from-split',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { project_id, client_id, total_amount, splits, start_date, contract_id } = req.body;

    if (!project_id || !client_id || !total_amount || !splits || !start_date) {
      errorResponse(res, 'project_id, client_id, total_amount, splits, and start_date are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const installments = await paymentScheduleService.createFromSplit(
      project_id,
      client_id,
      total_amount,
      splits,
      start_date,
      contract_id
    );

    sendCreated(res, { installments }, `Created ${installments.length} installments from split`);
  })
);

// =====================================================
// UPDATE
// =====================================================

/**
 * PUT /api/payment-schedules/:id
 * Update an installment
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest(PaymentScheduleValidationSchemas.updateInstallment),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = Number(req.params.id);
    const existing = await paymentScheduleService.getInstallment(id);
    if (!existing) {
      errorResponse(res, 'Installment not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    const installment = await paymentScheduleService.updateInstallment(id, {
      label: req.body.label,
      amount: req.body.amount,
      dueDate: req.body.due_date,
      status: req.body.status,
      notes: req.body.notes
    });

    sendSuccess(res, { installment }, 'Installment updated');
  })
);

/**
 * POST /api/payment-schedules/:id/mark-paid
 * Mark an installment as paid
 */
router.post(
  '/:id/mark-paid',
  authenticateToken,
  requireAdmin,
  validateRequest(PaymentScheduleValidationSchemas.markPaid),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = Number(req.params.id);
    const existing = await paymentScheduleService.getInstallment(id);
    if (!existing) {
      errorResponse(res, 'Installment not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    const installment = await paymentScheduleService.markPaid(id, {
      paidDate: req.body.paid_date,
      paidAmount: req.body.paid_amount || existing.amount,
      paymentMethod: req.body.payment_method,
      paymentReference: req.body.payment_reference
    });

    // Generate receipt for installment payment
    if (installment.invoiceId) {
      try {
        const { receiptService } = await import('../../services/receipt-service.js');
        await receiptService.createReceipt(
          installment.invoiceId,
          null,
          req.body.paid_amount || existing.amount,
          {
            paymentMethod: req.body.payment_method,
            paymentReference: req.body.payment_reference,
            paymentDate: req.body.paid_date
          }
        );
      } catch (receiptError) {
        // Non-critical — don't fail the mark-paid operation
        const { logger } = await import('../../services/logger.js');
        logger.error('[PaymentSchedules] Failed to generate receipt for installment payment:', {
          error: receiptError instanceof Error ? receiptError : undefined
        });
      }
    }

    sendSuccess(res, { installment }, 'Installment marked as paid');
  })
);

// =====================================================
// DELETE
// =====================================================

/**
 * DELETE /api/payment-schedules/:id
 * Delete an installment
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = Number(req.params.id);
    const existing = await paymentScheduleService.getInstallment(id);
    if (!existing) {
      errorResponse(res, 'Installment not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    await paymentScheduleService.deleteInstallment(id);
    sendSuccess(res, null, 'Installment deleted');
  })
);

/**
 * POST /api/payment-schedules/check-overdue
 * Batch update pending → overdue for past-due installments
 */
router.post(
  '/check-overdue',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const count = await paymentScheduleService.checkAndUpdateOverdue();
    sendSuccess(res, { updated: count }, `Updated ${count} installments to overdue`);
  })
);

export default router;
