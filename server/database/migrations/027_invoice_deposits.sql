-- Migration: Add deposit invoice support and credit tracking
-- Created: 2026-01-30

-- Add invoice_type to distinguish deposit vs standard invoices
ALTER TABLE invoices ADD COLUMN invoice_type TEXT DEFAULT 'standard'
  CHECK (invoice_type IN ('standard', 'deposit'));

-- Track deposit-specific fields
ALTER TABLE invoices ADD COLUMN deposit_for_project_id INTEGER;
ALTER TABLE invoices ADD COLUMN deposit_percentage DECIMAL(5, 2);

-- Track credits applied to an invoice
CREATE TABLE IF NOT EXISTS invoice_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,           -- Invoice receiving the credit
  deposit_invoice_id INTEGER NOT NULL,   -- Deposit invoice being applied
  amount DECIMAL(10, 2) NOT NULL,        -- Credit amount applied
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  applied_by TEXT,                       -- Admin who applied
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (deposit_invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Add default deposit percentage to projects table
ALTER TABLE projects ADD COLUMN default_deposit_percentage DECIMAL(5, 2) DEFAULT 50;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_invoice_credits_invoice ON invoice_credits(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_credits_deposit ON invoice_credits(deposit_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_deposit_project ON invoices(deposit_for_project_id);

-- DOWN
DROP INDEX IF EXISTS idx_invoices_deposit_project;
DROP INDEX IF EXISTS idx_invoices_type;
DROP INDEX IF EXISTS idx_invoice_credits_deposit;
DROP INDEX IF EXISTS idx_invoice_credits_invoice;
DROP TABLE IF EXISTS invoice_credits;
-- Note: SQLite doesn't support DROP COLUMN, would need table recreation for full rollback
