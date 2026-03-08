-- UP
-- Migration: Drop unused/dead tables
-- Created: 2026-03-07
--
-- These tables were created in earlier migrations but are NOT referenced
-- by any application code (routes, services, middleware, or utilities).
-- Each table was verified by searching the entire server/ directory
-- (excluding migrations) for any SQL queries, inserts, updates, or selects.
--
-- IMPORTANT: Only tables with ZERO application code references are dropped.
-- Tables that serve as FK parents for active tables are NOT dropped.

-- =====================================================
-- 1. welcome_sequence_emails (created in 039)
--    Purpose: Tracking individual welcome emails sent to clients
--    Reason for drop: No service or route queries this table
-- =====================================================
DROP TABLE IF EXISTS welcome_sequence_emails;

-- =====================================================
-- 2. welcome_sequence_templates (created in 039)
--    Purpose: Templates for automated welcome email sequences
--    Reason for drop: No service or route queries this table
-- =====================================================
DROP TABLE IF EXISTS welcome_sequence_templates;

-- =====================================================
-- 3. notification_delivery_logs (created in 065)
--    Purpose: Logging delivery status of Slack/Discord notifications
--    Reason for drop: No service or route queries this table
--    Note: FK child of notification_integrations (which IS active)
-- =====================================================
DROP TABLE IF EXISTS notification_delivery_logs;

-- =====================================================
-- 4. stripe_checkout_sessions (created in 065)
--    Purpose: Tracking Stripe checkout sessions for invoice payments
--    Reason for drop: stripe-service.ts uses invoice_payment_links
--                     and invoice_payments instead; never references this table
-- =====================================================
DROP INDEX IF EXISTS idx_stripe_sessions_invoice;
DROP INDEX IF EXISTS idx_stripe_sessions_session;
DROP TABLE IF EXISTS stripe_checkout_sessions;

-- =====================================================
-- 5. stripe_payments (created in 065)
--    Purpose: Stripe-specific payment records
--    Reason for drop: stripe-service.ts uses invoice_payments table instead
-- =====================================================
DROP INDEX IF EXISTS idx_stripe_payments_invoice;
DROP INDEX IF EXISTS idx_stripe_payments_status;
DROP INDEX IF EXISTS idx_stripe_payments_intent;
DROP TABLE IF EXISTS stripe_payments;

-- =====================================================
-- 6. stripe_payment_attempts (created in 065)
--    Purpose: Failed Stripe payment attempt tracking
--    Reason for drop: No service or route queries this table
-- =====================================================
DROP TABLE IF EXISTS stripe_payment_attempts;

-- =====================================================
-- 7. calendar_event_mappings (created in 065)
--    Purpose: Mapping local entities to Google Calendar event IDs
--    Reason for drop: calendar-service.ts uses calendar_sync_configs
--                     but never references calendar_event_mappings
--    Note: FK child of calendar_sync_configs (which IS active)
-- =====================================================
DROP INDEX IF EXISTS idx_calendar_mapping_entity;
DROP INDEX IF EXISTS idx_calendar_mapping_google;
DROP TABLE IF EXISTS calendar_event_mappings;

-- =====================================================
-- 8. analytics_daily_summary (created in 014)
--    Purpose: Pre-aggregated daily visitor analytics
--    Reason for drop: No service or route queries this table;
--                     analytics routes query visitor_sessions directly
-- =====================================================
DROP TABLE IF EXISTS analytics_daily_summary;

-- =====================================================
-- 9. client_onboarding_progress (created in 088)
--    Purpose: Tracking client onboarding step completion
--    Reason for drop: No service or route queries this table;
--                     client_onboarding table (from 058) is used instead
-- =====================================================
DROP TABLE IF EXISTS client_onboarding_progress;

-- =====================================================
-- 10. proposal_contract_terms_templates (created in 061)
--     Purpose: Reusable contract terms for proposals
--     Reason for drop: No service or route queries this table;
--                      proposal-service.ts uses proposal_custom_items instead
-- =====================================================
DROP TABLE IF EXISTS proposal_contract_terms_templates;

-- DOWN
-- Recreate dropped tables if rollback is needed.
-- Minimal schemas provided for structure only; data cannot be recovered.

CREATE TABLE IF NOT EXISTS welcome_sequence_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER,
  client_id INTEGER,
  email_type TEXT,
  subject TEXT,
  sent_at DATETIME,
  opened_at DATETIME,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS welcome_sequence_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  steps TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  integration_id INTEGER NOT NULL REFERENCES notification_integrations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  response_status INTEGER,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stripe_checkout_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  stripe_session_id TEXT NOT NULL UNIQUE,
  payment_url TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'active',
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stripe_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  status TEXT NOT NULL,
  paid_at DATETIME,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stripe_payment_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calendar_event_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_config_id INTEGER NOT NULL REFERENCES calendar_sync_configs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  google_event_id TEXT NOT NULL,
  last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_daily_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL UNIQUE,
  total_sessions INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  total_page_views INTEGER DEFAULT 0,
  avg_session_duration REAL DEFAULT 0,
  bounce_rate REAL DEFAULT 0,
  top_pages TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS client_onboarding_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proposal_contract_terms_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  terms_content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
