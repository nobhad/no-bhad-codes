-- ===============================================
-- INTEGRATIONS TABLES
-- ===============================================
-- Migration: 065_integrations.sql
-- Description: Tables for Stripe, Calendar, Slack/Discord integrations
-- Created: 2026-02-10

-- Clean up partial tables from failed migration attempts
DROP TABLE IF EXISTS notification_integrations;
DROP TABLE IF EXISTS notification_delivery_logs;
DROP TABLE IF EXISTS invoice_payment_links;
DROP INDEX IF EXISTS idx_payment_links_invoice;
DROP INDEX IF EXISTS idx_payment_links_session;

-- Notification integrations (Slack/Discord)
CREATE TABLE notification_integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('slack', 'discord')),
  webhook_url TEXT NOT NULL,
  channel TEXT,
  events TEXT NOT NULL, -- Comma-separated event types
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notification delivery logs
CREATE TABLE notification_delivery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  integration_id INTEGER NOT NULL REFERENCES notification_integrations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  response_status INTEGER,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Stripe checkout sessions (payment links)
CREATE TABLE stripe_checkout_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  stripe_session_id TEXT NOT NULL UNIQUE,
  payment_url TEXT NOT NULL,
  amount INTEGER NOT NULL, -- In cents
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stripe_sessions_invoice ON stripe_checkout_sessions(invoice_id);
CREATE INDEX idx_stripe_sessions_session ON stripe_checkout_sessions(stripe_session_id);

-- Stripe payment records (separate from manual invoice_payments)
CREATE TABLE stripe_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  paid_at DATETIME,
  metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stripe_payments_invoice ON stripe_payments(invoice_id);
CREATE INDEX idx_stripe_payments_status ON stripe_payments(status);
CREATE INDEX idx_stripe_payments_intent ON stripe_payments(stripe_payment_intent_id);

-- Stripe payment attempts (failed payments)
CREATE TABLE stripe_payment_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Calendar sync configurations
CREATE TABLE IF NOT EXISTS calendar_sync_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  calendar_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER NOT NULL,
  sync_milestones BOOLEAN DEFAULT TRUE,
  sync_tasks BOOLEAN DEFAULT TRUE,
  sync_invoice_due_dates BOOLEAN DEFAULT FALSE,
  last_sync_at DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_sync_user ON calendar_sync_configs(user_id);

-- Calendar event mappings (track synced events)
CREATE TABLE IF NOT EXISTS calendar_event_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_config_id INTEGER NOT NULL REFERENCES calendar_sync_configs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('milestone', 'task', 'invoice')),
  entity_id INTEGER NOT NULL,
  google_event_id TEXT NOT NULL,
  last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_mapping_entity ON calendar_event_mappings(sync_config_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_calendar_mapping_google ON calendar_event_mappings(google_event_id);

-- Add Stripe fields to invoices table if not exists
-- Note: SQLite will error if column already exists, but migration runner handles this gracefully

-- Integration status tracking
CREATE TABLE IF NOT EXISTS integration_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  integration_type TEXT NOT NULL CHECK (integration_type IN ('stripe', 'google_calendar', 'slack', 'discord', 'zapier')),
  is_configured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  configuration TEXT, -- JSON with non-sensitive config
  last_activity_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_status_type ON integration_status(integration_type);

-- Seed default integration status records
INSERT OR IGNORE INTO integration_status (integration_type, is_configured, is_active, created_at, updated_at)
VALUES
  ('stripe', FALSE, FALSE, datetime('now'), datetime('now')),
  ('google_calendar', FALSE, FALSE, datetime('now'), datetime('now')),
  ('slack', FALSE, FALSE, datetime('now'), datetime('now')),
  ('discord', FALSE, FALSE, datetime('now'), datetime('now')),
  ('zapier', FALSE, FALSE, datetime('now'), datetime('now'));
