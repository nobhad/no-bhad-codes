-- ============================================
-- Migration 130: Auto-Pay & Saved Payment Methods
-- ============================================
-- Enables automatic payment collection:
-- - Saved payment methods per client
-- - Auto-pay enrollment per client
-- - Retry queue for failed charges

-- Add auto-pay preference to clients
ALTER TABLE clients ADD COLUMN auto_pay_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN auto_pay_default_method_id INTEGER REFERENCES client_payment_methods(id);

-- Auto-pay retry queue for failed charges
CREATE TABLE IF NOT EXISTS auto_pay_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  payment_method_id INTEGER NOT NULL REFERENCES client_payment_methods(id),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'exhausted')),
  stripe_intent_id TEXT,
  failure_reason TEXT,
  next_retry_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auto_pay_attempts_client ON auto_pay_attempts(client_id);
CREATE INDEX IF NOT EXISTS idx_auto_pay_attempts_invoice ON auto_pay_attempts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_auto_pay_attempts_status ON auto_pay_attempts(status);
CREATE INDEX IF NOT EXISTS idx_auto_pay_attempts_next_retry ON auto_pay_attempts(next_retry_at);
