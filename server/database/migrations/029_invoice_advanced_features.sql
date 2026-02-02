-- ===============================================
-- INVOICE ADVANCED FEATURES
-- ===============================================
-- Migration 029: Add tax, discounts, late fees, payment terms, payment history
-- Created: 2026-02-01

-- ===============================================
-- PAYMENT HISTORY TABLE
-- ===============================================
-- Tracks all payments made on an invoice (for partial payments history)
CREATE TABLE IF NOT EXISTS invoice_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,  -- 'venmo', 'paypal', 'bank_transfer', 'check', 'cash', 'credit_card', 'other'
  payment_reference TEXT,
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- ===============================================
-- PAYMENT TERMS PRESETS TABLE
-- ===============================================
-- Stores reusable payment terms (Net 15, Net 30, etc.)
CREATE TABLE IF NOT EXISTS payment_terms_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  days_until_due INTEGER NOT NULL,
  description TEXT,
  late_fee_rate DECIMAL(5,2),  -- Percentage late fee (e.g., 1.5 for 1.5%)
  late_fee_type TEXT DEFAULT 'none',  -- 'none', 'flat', 'percentage', 'daily_percentage'
  late_fee_flat_amount DECIMAL(10,2),  -- For flat late fees
  grace_period_days INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- INVOICE SCHEMA UPDATES
-- ===============================================
-- Add tax support
ALTER TABLE invoices ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN tax_amount DECIMAL(10,2) DEFAULT 0;

-- Add discount support (invoice-level)
ALTER TABLE invoices ADD COLUMN discount_type TEXT;  -- 'percentage', 'fixed', NULL
ALTER TABLE invoices ADD COLUMN discount_value DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0;

-- Add late fee support
ALTER TABLE invoices ADD COLUMN late_fee_rate DECIMAL(5,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN late_fee_type TEXT DEFAULT 'none';
ALTER TABLE invoices ADD COLUMN late_fee_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN late_fee_applied_at DATETIME;

-- Add payment terms
ALTER TABLE invoices ADD COLUMN payment_terms_id INTEGER REFERENCES payment_terms_presets(id);
ALTER TABLE invoices ADD COLUMN payment_terms_name TEXT;

-- Add internal notes (separate from client-facing notes)
ALTER TABLE invoices ADD COLUMN internal_notes TEXT;

-- Add invoice number customization
ALTER TABLE invoices ADD COLUMN invoice_prefix TEXT;
ALTER TABLE invoices ADD COLUMN invoice_sequence INTEGER;

-- Add subtotal (before tax/discount)
ALTER TABLE invoices ADD COLUMN subtotal DECIMAL(10,2);

-- ===============================================
-- PERFORMANCE INDEXES
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date ON invoice_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_invoices_late_fee ON invoices(late_fee_applied_at);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_terms ON invoices(payment_terms_id);

-- ===============================================
-- SEED DEFAULT PAYMENT TERMS
-- ===============================================
INSERT OR IGNORE INTO payment_terms_presets (id, name, days_until_due, description, late_fee_rate, late_fee_type, is_default) VALUES
(1, 'Due on Receipt', 0, 'Payment due immediately upon receipt', NULL, 'none', FALSE),
(2, 'Net 7', 7, 'Payment due within 7 days', NULL, 'none', FALSE),
(3, 'Net 15', 15, 'Payment due within 15 days', 1.5, 'percentage', FALSE),
(4, 'Net 30', 30, 'Payment due within 30 days', 1.5, 'percentage', TRUE),
(5, 'Net 45', 45, 'Payment due within 45 days', 2.0, 'percentage', FALSE),
(6, 'Net 60', 60, 'Payment due within 60 days', 2.0, 'percentage', FALSE),
(7, 'Net 90', 90, 'Payment due within 90 days', 2.5, 'percentage', FALSE),
(8, '2/10 Net 30', 30, '2% discount if paid within 10 days, otherwise net 30', 1.5, 'percentage', FALSE);
