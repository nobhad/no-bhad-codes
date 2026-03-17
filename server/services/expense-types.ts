/**
 * ===============================================
 * EXPENSE TYPES
 * ===============================================
 * @file server/services/expense-types.ts
 *
 * Type definitions for expense tracking and project profitability.
 */

// ============================================
// Expense Categories
// ============================================

export type ExpenseCategory =
  | 'software'
  | 'hosting'
  | 'domain'
  | 'stock_assets'
  | 'subcontractor'
  | 'hardware'
  | 'travel'
  | 'marketing'
  | 'office'
  | 'professional_services'
  | 'subscription'
  | 'other';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  software: 'Software',
  hosting: 'Hosting',
  domain: 'Domain',
  stock_assets: 'Stock Assets',
  subcontractor: 'Subcontractor',
  hardware: 'Hardware',
  travel: 'Travel',
  marketing: 'Marketing',
  office: 'Office',
  professional_services: 'Professional Services',
  subscription: 'Subscription',
  other: 'Other'
};

// ============================================
// Recurring Intervals
// ============================================

export type RecurringInterval = 'weekly' | 'monthly' | 'quarterly' | 'annual';

// ============================================
// DB Row Types
// ============================================

export interface ExpenseRow {
  id: number;
  project_id: number | null;
  category: string;
  description: string;
  amount: number | string;
  vendor_name: string | null;
  expense_date: string;
  is_billable: number;
  is_recurring: number;
  recurring_interval: string | null;
  receipt_file_id: number | null;
  tax_deductible: number;
  tax_category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ExpenseWithProject extends ExpenseRow {
  project_name: string | null;
}

// ============================================
// API Types
// ============================================

export interface CreateExpenseParams {
  projectId?: number | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  vendorName?: string | null;
  expenseDate: string;
  isBillable?: boolean;
  isRecurring?: boolean;
  recurringInterval?: RecurringInterval | null;
  receiptFileId?: number | null;
  taxDeductible?: boolean;
  taxCategory?: string | null;
  notes?: string | null;
}

// ============================================
// Profitability Types
// ============================================

export interface ProjectProfitability {
  projectId: number;
  projectName: string;
  clientName: string;
  revenue: {
    invoicesPaid: number;
    installmentsPaid: number;
    totalRevenue: number;
  };
  costs: {
    expenses: number;
    timeCost: number;
    totalCosts: number;
  };
  profit: number;
  margin: number;
  budget: number | null;
  budgetRemaining: number | null;
}

export interface ExpenseSummary {
  totalExpenses: number;
  byCategory: Record<string, number>;
  byMonth: Array<{ month: string; total: number }>;
}
