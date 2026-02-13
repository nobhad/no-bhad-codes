-- Migration: Create receipts table for payment receipts
-- Created: 2026-02-11
-- Required for: Receipt generation on invoice payments

-- UP

-- =====================================================
-- RECEIPTS TABLE
-- =====================================================
-- Store receipt records for each payment made on invoices
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_number TEXT NOT NULL UNIQUE,
  invoice_id INTEGER NOT NULL,
  payment_id INTEGER,
  amount REAL NOT NULL,
  file_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES invoice_payments(id) ON DELETE SET NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_receipts_invoice ON receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipts_payment ON receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_created ON receipts(created_at);

-- DOWN
DROP INDEX IF EXISTS idx_receipts_created;
DROP INDEX IF EXISTS idx_receipts_number;
DROP INDEX IF EXISTS idx_receipts_payment;
DROP INDEX IF EXISTS idx_receipts_invoice;
DROP TABLE IF EXISTS receipts;
