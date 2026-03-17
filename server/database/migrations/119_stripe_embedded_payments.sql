-- Migration 119: Stripe Embedded Payments
-- Adds stripe_customer_id to clients, payment methods table, and payment intents tracking

-- Add Stripe customer ID to clients for re-usable payment methods
ALTER TABLE clients ADD COLUMN stripe_customer_id TEXT;

-- Track saved payment methods per client
CREATE TABLE IF NOT EXISTS client_payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  stripe_payment_method_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'card',
  brand TEXT,
  last_four TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX idx_client_payment_methods_client ON client_payment_methods(client_id);

-- Track PaymentIntents for embedded Stripe Elements flow
CREATE TABLE IF NOT EXISTS stripe_payment_intents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_intent_id TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL,
  invoice_id INTEGER,
  installment_id INTEGER,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'requires_payment_method',
  payment_method_id INTEGER,
  failure_reason TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (payment_method_id) REFERENCES client_payment_methods(id) ON DELETE SET NULL
);

CREATE INDEX idx_stripe_payment_intents_client ON stripe_payment_intents(client_id);
CREATE INDEX idx_stripe_payment_intents_invoice ON stripe_payment_intents(invoice_id);
CREATE INDEX idx_stripe_payment_intents_stripe_id ON stripe_payment_intents(stripe_intent_id);
CREATE INDEX idx_stripe_payment_intents_status ON stripe_payment_intents(status);
