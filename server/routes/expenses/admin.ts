/**
 * ===============================================
 * EXPENSE ADMIN ROUTES
 * ===============================================
 * @file server/routes/expenses/admin.ts
 *
 * Admin endpoints for managing expenses and viewing profitability.
 *
 * GET    /                           — List expenses (query filters)
 * POST   /                           — Create expense
 * GET    /profitability              — All projects profitability
 * GET    /profitability/:projectId   — Single project profitability
 * GET    /analytics                  — Expense breakdown (category + monthly)
 * GET    /analytics/export           — CSV download
 * GET    /:id                        — Single expense
 * PUT    /:id                        — Update expense
 * DELETE /:id                        — Soft delete expense
 */

import { Router, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { expenseService } from '../../services/expense-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';

const router = Router();

// ============================================
// LIST / CREATE
// ============================================

/**
 * GET /api/expenses
 * List expenses with optional filters.
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

    const expenses = await expenseService.list({ projectId, category, startDate, endDate });
    sendSuccess(res, { expenses });
  })
);

/**
 * POST /api/expenses
 * Create a new expense.
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const {
      projectId, category, description, amount, vendorName,
      expenseDate, isBillable, isRecurring, recurringInterval,
      receiptFileId, taxDeductible, taxCategory, notes
    } = req.body;

    if (!category || !description || amount == null || !expenseDate) {
      errorResponse(res, 'category, description, amount, and expenseDate are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    if (typeof amount !== 'number' || amount < 0) {
      errorResponse(res, 'amount must be a non-negative number', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const expenseId = await expenseService.create({
      projectId: projectId || null,
      category,
      description,
      amount,
      vendorName: vendorName || null,
      expenseDate,
      isBillable: !!isBillable,
      isRecurring: !!isRecurring,
      recurringInterval: recurringInterval || null,
      receiptFileId: receiptFileId || null,
      taxDeductible: taxDeductible !== false,
      taxCategory: taxCategory || null,
      notes: notes || null
    });

    sendCreated(res, { expenseId }, 'Expense created');
  })
);

// ============================================
// PROFITABILITY (must be before /:id)
// ============================================

/**
 * GET /api/expenses/profitability
 * Get profitability for all active projects.
 */
router.get(
  '/profitability',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: JWTAuthRequest, res: Response) => {
    const profitability = await expenseService.getAllProjectProfitability();
    sendSuccess(res, { profitability });
  })
);

/**
 * GET /api/expenses/profitability/:projectId
 * Get profitability for a single project.
 */
router.get(
  '/profitability/:projectId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const projectId = Number(req.params.projectId);

    if (isNaN(projectId)) {
      errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const profitability = await expenseService.getProjectProfitability(projectId);

    if (!profitability) {
      errorResponse(res, 'Project not found', 404, ErrorCodes.NOT_FOUND);
      return;
    }

    sendSuccess(res, { profitability });
  })
);

// ============================================
// ANALYTICS (must be before /:id)
// ============================================

/**
 * GET /api/expenses/analytics
 * Get expense breakdown by category and month.
 */
router.get(
  '/analytics',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

    const summary = await expenseService.getExpenseSummary({ startDate, endDate });
    sendSuccess(res, { summary });
  })
);

/**
 * GET /api/expenses/analytics/export
 * Download expenses as CSV.
 */
router.get(
  '/analytics/export',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

    const csv = await expenseService.exportCsv({ projectId, category, startDate, endDate });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
    res.send(csv);
  })
);

// ============================================
// SINGLE EXPENSE CRUD
// ============================================

/**
 * GET /api/expenses/:id
 * Get a single expense by ID.
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const expenseId = Number(req.params.id);

    if (isNaN(expenseId)) {
      errorResponse(res, 'Invalid expense ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const expense = await expenseService.getById(expenseId);

    if (!expense) {
      errorResponse(res, 'Expense not found', 404, ErrorCodes.NOT_FOUND);
      return;
    }

    sendSuccess(res, { expense });
  })
);

/**
 * PUT /api/expenses/:id
 * Update an existing expense.
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const expenseId = Number(req.params.id);

    if (isNaN(expenseId)) {
      errorResponse(res, 'Invalid expense ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const existing = await expenseService.getById(expenseId);
    if (!existing) {
      errorResponse(res, 'Expense not found', 404, ErrorCodes.NOT_FOUND);
      return;
    }

    await expenseService.update(expenseId, req.body);
    sendSuccess(res, undefined, 'Expense updated');
  })
);

/**
 * DELETE /api/expenses/:id
 * Soft delete an expense.
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const expenseId = Number(req.params.id);

    if (isNaN(expenseId)) {
      errorResponse(res, 'Invalid expense ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const existing = await expenseService.getById(expenseId);
    if (!existing) {
      errorResponse(res, 'Expense not found', 404, ErrorCodes.NOT_FOUND);
      return;
    }

    await expenseService.deleteExpense(expenseId);
    sendSuccess(res, undefined, 'Expense deleted');
  })
);

export default router;
