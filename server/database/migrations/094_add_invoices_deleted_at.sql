-- UP

-- Fix: invoices table missing deleted_at column that active_invoices view depends on
ALTER TABLE invoices ADD COLUMN deleted_at DATETIME;
ALTER TABLE invoices ADD COLUMN deleted_by TEXT;
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON invoices(deleted_at);

-- DOWN

DROP INDEX IF EXISTS idx_invoices_deleted_at;
-- SQLite does not support DROP COLUMN; columns are harmless if left in place.
