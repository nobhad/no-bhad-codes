/**
 * ===============================================
 * EXPENSE SERVICE
 * ===============================================
 * @file server/services/expense-service.ts
 *
 * Manages expense tracking, project profitability calculations,
 * and expense analytics. Supports soft delete, category breakdown,
 * and CSV export.
 */

import { getDatabase } from '../database/init.js';
import { getFloat } from '../database/row-helpers.js';
import { logger } from './logger.js';
import type {
  CreateExpenseParams,
  ExpenseWithProject,
  ProjectProfitability,
  ExpenseSummary
} from './expense-types.js';

// ============================================
// Constants
// ============================================

const DEFAULT_HOURLY_RATE = 150;
const DEFAULT_MONTHLY_HISTORY = 12;
const ALL_EXPENSES_LIMIT = 500;

const CSV_HEADERS = [
  'ID', 'Date', 'Category', 'Description', 'Amount', 'Vendor',
  'Project', 'Billable', 'Recurring', 'Interval', 'Tax Deductible',
  'Tax Category', 'Notes'
].join(',');

// ============================================
// Helpers
// ============================================

function parseAmount(row: Record<string, unknown>): number {
  return getFloat(row, 'amount');
}

function transformRow(row: Record<string, unknown>): ExpenseWithProject {
  return row as unknown as ExpenseWithProject;
}

function escapeCsvField(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ============================================
// CRUD
// ============================================

/**
 * Create a new expense record.
 */
async function create(params: CreateExpenseParams): Promise<number> {
  const db = getDatabase();

  const result = await db.run(
    `INSERT INTO expenses (
      project_id, category, description, amount, vendor_name,
      expense_date, is_billable, is_recurring, recurring_interval,
      receipt_file_id, tax_deductible, tax_category, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.projectId || null,
      params.category,
      params.description,
      params.amount,
      params.vendorName || null,
      params.expenseDate,
      params.isBillable ? 1 : 0,
      params.isRecurring ? 1 : 0,
      params.recurringInterval || null,
      params.receiptFileId || null,
      params.taxDeductible !== false ? 1 : 0,
      params.taxCategory || null,
      params.notes || null
    ]
  );

  const expenseId = result.lastID!;

  logger.info('Expense created', {
    category: 'expenses',
    metadata: { expenseId, amount: params.amount, expenseCategory: params.category }
  });

  return expenseId;
}

/**
 * Update an existing expense.
 */
async function update(id: number, params: Partial<CreateExpenseParams>): Promise<void> {
  const db = getDatabase();

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (params.projectId !== undefined) {
    updates.push('project_id = ?');
    values.push(params.projectId || null);
  }
  if (params.category !== undefined) {
    updates.push('category = ?');
    values.push(params.category);
  }
  if (params.description !== undefined) {
    updates.push('description = ?');
    values.push(params.description);
  }
  if (params.amount !== undefined) {
    updates.push('amount = ?');
    values.push(params.amount);
  }
  if (params.vendorName !== undefined) {
    updates.push('vendor_name = ?');
    values.push(params.vendorName || null);
  }
  if (params.expenseDate !== undefined) {
    updates.push('expense_date = ?');
    values.push(params.expenseDate);
  }
  if (params.isBillable !== undefined) {
    updates.push('is_billable = ?');
    values.push(params.isBillable ? 1 : 0);
  }
  if (params.isRecurring !== undefined) {
    updates.push('is_recurring = ?');
    values.push(params.isRecurring ? 1 : 0);
  }
  if (params.recurringInterval !== undefined) {
    updates.push('recurring_interval = ?');
    values.push(params.recurringInterval || null);
  }
  if (params.receiptFileId !== undefined) {
    updates.push('receipt_file_id = ?');
    values.push(params.receiptFileId || null);
  }
  if (params.taxDeductible !== undefined) {
    updates.push('tax_deductible = ?');
    values.push(params.taxDeductible ? 1 : 0);
  }
  if (params.taxCategory !== undefined) {
    updates.push('tax_category = ?');
    values.push(params.taxCategory || null);
  }
  if (params.notes !== undefined) {
    updates.push('notes = ?');
    values.push(params.notes || null);
  }

  if (updates.length === 0) return;

  updates.push('updated_at = datetime(\'now\')');
  values.push(id);

  await db.run(
    `UPDATE expenses SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    values
  );

  logger.info('Expense updated', {
    category: 'expenses',
    metadata: { expenseId: id }
  });
}

/**
 * Soft delete an expense.
 */
async function deleteExpense(id: number): Promise<void> {
  const db = getDatabase();

  await db.run(
    'UPDATE expenses SET deleted_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ? AND deleted_at IS NULL',
    [id]
  );

  logger.info('Expense soft-deleted', {
    category: 'expenses',
    metadata: { expenseId: id }
  });
}

// ============================================
// Queries
// ============================================

/**
 * List expenses with optional filters. Excludes soft-deleted records.
 */
async function list(filters?: {
  projectId?: number;
  category?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ExpenseWithProject[]> {
  const db = getDatabase();

  const conditions: string[] = ['e.deleted_at IS NULL'];
  const values: (string | number)[] = [];

  if (filters?.projectId) {
    conditions.push('e.project_id = ?');
    values.push(filters.projectId);
  }
  if (filters?.category) {
    conditions.push('e.category = ?');
    values.push(filters.category);
  }
  if (filters?.startDate) {
    conditions.push('e.expense_date >= ?');
    values.push(filters.startDate);
  }
  if (filters?.endDate) {
    conditions.push('e.expense_date <= ?');
    values.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await db.all(
    `SELECT e.*, p.project_name
     FROM expenses e
     LEFT JOIN projects p ON e.project_id = p.id AND p.deleted_at IS NULL
     ${whereClause}
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT ?`,
    [...values, ALL_EXPENSES_LIMIT]
  );

  return rows.map((row) => transformRow(row as Record<string, unknown>));
}

/**
 * Get a single expense by ID with project name.
 */
async function getById(id: number): Promise<ExpenseWithProject | null> {
  const db = getDatabase();

  const row = await db.get(
    `SELECT e.*, p.project_name
     FROM expenses e
     LEFT JOIN projects p ON e.project_id = p.id AND p.deleted_at IS NULL
     WHERE e.id = ? AND e.deleted_at IS NULL`,
    [id]
  );

  if (!row) return null;
  return transformRow(row as Record<string, unknown>);
}

// ============================================
// Profitability
// ============================================

/**
 * Retrieve the hourly rate from system_settings or use the default.
 */
async function getHourlyRate(): Promise<number> {
  const db = getDatabase();

  const row = await db.get(
    'SELECT setting_value FROM system_settings WHERE setting_key = \'default_hourly_rate\'',
    []
  ) as { setting_value: string } | undefined;

  if (row?.setting_value) {
    const parsed = parseFloat(row.setting_value);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  return DEFAULT_HOURLY_RATE;
}

/**
 * Calculate profitability for a single project.
 */
async function getProjectProfitability(projectId: number): Promise<ProjectProfitability | null> {
  const db = getDatabase();

  // Get project info
  const project = await db.get(
    `SELECT p.id, p.project_name, p.price,
            COALESCE(c.contact_name, c.company_name) as client_name
     FROM projects p
     LEFT JOIN clients c ON p.client_id = c.id AND c.deleted_at IS NULL
     WHERE p.id = ? AND p.deleted_at IS NULL`,
    [projectId]
  ) as { id: number; project_name: string; price: string | null; client_name: string } | undefined;

  if (!project) return null;

  // Revenue: invoices paid
  const invoiceRevenue = await db.get(
    `SELECT COALESCE(SUM(ip.amount), 0) as total
     FROM invoice_payments ip
     JOIN invoices i ON ip.invoice_id = i.id AND i.deleted_at IS NULL
     WHERE i.project_id = ?`,
    [projectId]
  ) as { total: number | string };

  // Revenue: installments paid
  const installmentRevenue = await db.get(
    `SELECT COALESCE(SUM(psi.paid_amount), 0) as total
     FROM payment_schedule_installments psi
     WHERE psi.project_id = ? AND psi.status = 'paid'`,
    [projectId]
  ) as { total: number | string };

  // Costs: expenses
  const expenseTotal = await db.get(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM expenses
     WHERE project_id = ? AND deleted_at IS NULL`,
    [projectId]
  ) as { total: number | string };

  // Costs: billable time
  const timeResult = await db.get(
    `SELECT COALESCE(SUM(hours), 0) as total_hours
     FROM time_entries
     WHERE project_id = ? AND billable = 1`,
    [projectId]
  ) as { total_hours: number | string };

  const hourlyRate = await getHourlyRate();
  const totalHours = parseFloat(String(timeResult.total_hours)) || 0;
  const timeCost = totalHours * hourlyRate;

  const invoicesPaid = parseFloat(String(invoiceRevenue.total)) || 0;
  const installmentsPaid = parseFloat(String(installmentRevenue.total)) || 0;
  const totalRevenue = invoicesPaid + installmentsPaid;

  const expenses = parseFloat(String(expenseTotal.total)) || 0;
  const totalCosts = expenses + timeCost;

  const profit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  // Parse budget from price field
  const budget = project.price ? parseFloat(project.price) || null : null;
  const budgetRemaining = budget != null ? budget - totalCosts : null;

  return {
    projectId: project.id,
    projectName: project.project_name,
    clientName: project.client_name || 'Unknown',
    revenue: { invoicesPaid, installmentsPaid, totalRevenue },
    costs: { expenses, timeCost, totalCosts },
    profit,
    margin: Math.round(margin * 100) / 100,
    budget,
    budgetRemaining
  };
}

/**
 * Calculate profitability for all active projects.
 *
 * Previously N+1: fetched the id list, then ran five sub-queries per
 * project inside getProjectProfitability — 50 projects produced 250
 * queries on an admin dashboard load.
 *
 * Now: a single pre-aggregated query joins the four cost/revenue
 * subtotals by project_id. We still call getHourlyRate once (one
 * setting lookup), and the JS side only does arithmetic.
 */
async function getAllProjectProfitability(): Promise<ProjectProfitability[]> {
  const db = getDatabase();

  const rows = await db.all(
    `SELECT
       p.id,
       p.project_name,
       p.price,
       COALESCE(c.contact_name, c.company_name) AS client_name,
       COALESCE(inv_rev.total, 0)       AS invoices_paid,
       COALESCE(inst_rev.total, 0)      AS installments_paid,
       COALESCE(exp_total.total, 0)     AS expenses,
       COALESCE(time_total.total_hours, 0) AS total_hours
     FROM projects p
     LEFT JOIN clients c
       ON p.client_id = c.id AND c.deleted_at IS NULL
     LEFT JOIN (
       SELECT i.project_id, SUM(ip.amount) AS total
       FROM invoice_payments ip
       JOIN invoices i ON ip.invoice_id = i.id AND i.deleted_at IS NULL
       GROUP BY i.project_id
     ) inv_rev ON p.id = inv_rev.project_id
     LEFT JOIN (
       SELECT project_id, SUM(paid_amount) AS total
       FROM payment_schedule_installments
       WHERE status = 'paid'
       GROUP BY project_id
     ) inst_rev ON p.id = inst_rev.project_id
     LEFT JOIN (
       SELECT project_id, SUM(amount) AS total
       FROM expenses
       WHERE deleted_at IS NULL
       GROUP BY project_id
     ) exp_total ON p.id = exp_total.project_id
     LEFT JOIN (
       SELECT project_id, SUM(hours) AS total_hours
       FROM time_entries
       WHERE billable = 1
       GROUP BY project_id
     ) time_total ON p.id = time_total.project_id
     WHERE p.deleted_at IS NULL
       AND p.status IN ('active', 'in-progress', 'in-review')
     ORDER BY p.project_name ASC`
  ) as Array<{
    id: number;
    project_name: string;
    price: string | null;
    client_name: string | null;
    invoices_paid: number | string;
    installments_paid: number | string;
    expenses: number | string;
    total_hours: number | string;
  }>;

  const hourlyRate = await getHourlyRate();

  return rows.map((row) => {
    const invoicesPaid = parseFloat(String(row.invoices_paid)) || 0;
    const installmentsPaid = parseFloat(String(row.installments_paid)) || 0;
    const totalRevenue = invoicesPaid + installmentsPaid;

    const expenses = parseFloat(String(row.expenses)) || 0;
    const totalHours = parseFloat(String(row.total_hours)) || 0;
    const timeCost = totalHours * hourlyRate;
    const totalCosts = expenses + timeCost;

    const profit = totalRevenue - totalCosts;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    const budget = row.price ? parseFloat(row.price) || null : null;
    const budgetRemaining = budget != null ? budget - totalCosts : null;

    return {
      projectId: row.id,
      projectName: row.project_name,
      clientName: row.client_name || 'Unknown',
      revenue: { invoicesPaid, installmentsPaid, totalRevenue },
      costs: { expenses, timeCost, totalCosts },
      profit,
      margin: Math.round(margin * 100) / 100,
      budget,
      budgetRemaining
    };
  });
}

// ============================================
// Analytics
// ============================================

/**
 * Get expense totals grouped by category.
 */
async function getExpensesByCategory(dateRange?: {
  startDate?: string;
  endDate?: string;
}): Promise<Record<string, number>> {
  const db = getDatabase();

  const conditions: string[] = ['deleted_at IS NULL'];
  const values: string[] = [];

  if (dateRange?.startDate) {
    conditions.push('expense_date >= ?');
    values.push(dateRange.startDate);
  }
  if (dateRange?.endDate) {
    conditions.push('expense_date <= ?');
    values.push(dateRange.endDate);
  }

  const rows = await db.all(
    `SELECT category, COALESCE(SUM(amount), 0) as total
     FROM expenses
     WHERE ${conditions.join(' AND ')}
     GROUP BY category
     ORDER BY total DESC`,
    values
  ) as Array<{ category: string; total: number | string }>;

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.category] = parseFloat(String(row.total)) || 0;
  }
  return result;
}

/**
 * Get monthly expense totals for the last N months.
 */
async function getMonthlyExpenses(months?: number): Promise<Array<{ month: string; total: number }>> {
  const db = getDatabase();
  const monthCount = months || DEFAULT_MONTHLY_HISTORY;

  const rows = await db.all(
    `SELECT strftime('%Y-%m', expense_date) as month,
            COALESCE(SUM(amount), 0) as total
     FROM expenses
     WHERE deleted_at IS NULL
       AND expense_date >= date('now', '-' || ? || ' months')
     GROUP BY strftime('%Y-%m', expense_date)
     ORDER BY month ASC`,
    [monthCount]
  ) as Array<{ month: string; total: number | string }>;

  return rows.map((row) => ({
    month: row.month,
    total: parseFloat(String(row.total)) || 0
  }));
}

/**
 * Get a combined expense summary (totals + by category + by month).
 */
async function getExpenseSummary(dateRange?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExpenseSummary> {
  const byCategory = await getExpensesByCategory(dateRange);
  const byMonth = await getMonthlyExpenses();

  const totalExpenses = Object.values(byCategory).reduce((sum, val) => sum + val, 0);

  return { totalExpenses, byCategory, byMonth };
}

// ============================================
// CSV Export
// ============================================

/**
 * Generate a CSV string of expenses matching the given filters.
 */
async function exportCsv(filters?: {
  projectId?: number;
  category?: string;
  startDate?: string;
  endDate?: string;
}): Promise<string> {
  const expenses = await list(filters);

  const rows = expenses.map((expense) => {
    const amount = parseAmount(expense as unknown as Record<string, unknown>);
    return [
      expense.id,
      escapeCsvField(expense.expense_date),
      escapeCsvField(expense.category),
      escapeCsvField(expense.description),
      amount.toFixed(2),
      escapeCsvField(expense.vendor_name),
      escapeCsvField(expense.project_name),
      expense.is_billable ? 'Yes' : 'No',
      expense.is_recurring ? 'Yes' : 'No',
      escapeCsvField(expense.recurring_interval),
      expense.tax_deductible ? 'Yes' : 'No',
      escapeCsvField(expense.tax_category),
      escapeCsvField(expense.notes)
    ].join(',');
  });

  return [CSV_HEADERS, ...rows].join('\n');
}

// ============================================
// Singleton Export
// ============================================

export const expenseService = {
  create,
  update,
  deleteExpense,
  list,
  getById,
  getProjectProfitability,
  getAllProjectProfitability,
  getExpensesByCategory,
  getMonthlyExpenses,
  getExpenseSummary,
  exportCsv
};
