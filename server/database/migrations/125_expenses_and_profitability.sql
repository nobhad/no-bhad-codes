-- ===============================================
-- EXPENSES AND PROFITABILITY TRACKING
-- ===============================================
-- Migration 125: Expense tracking table with categories,
-- recurring support, and tax deduction tracking.
-- Phase 4A: Expense Tracking and Project Profitability.
-- Created: 2026-03-17

-- ===============================================
-- EXPENSES TABLE
-- ===============================================
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  category TEXT NOT NULL DEFAULT 'other' CHECK(category IN (
    'software', 'hosting', 'domain', 'stock_assets', 'subcontractor',
    'hardware', 'travel', 'marketing', 'office', 'professional_services',
    'subscription', 'other'
  )),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  vendor_name TEXT,
  expense_date TEXT NOT NULL,
  is_billable INTEGER NOT NULL DEFAULT 0,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurring_interval TEXT CHECK(recurring_interval IN ('weekly', 'monthly', 'quarterly', 'annual')),
  receipt_file_id INTEGER,
  tax_deductible INTEGER NOT NULL DEFAULT 1,
  tax_category TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (receipt_file_id) REFERENCES files(id)
);

-- ===============================================
-- INDEXES
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_expenses_project_id ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at ON expenses(deleted_at);
