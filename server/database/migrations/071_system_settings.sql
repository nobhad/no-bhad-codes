-- =====================================================
-- Migration 071: System Settings Table
-- =====================================================
-- Phase 3.1 of Database Normalization
--
-- Purpose: Move hardcoded business data out of invoice rows into a
-- centralized settings table. This eliminates redundant storage of
-- business info (name, email, payment handles) in every invoice row.
--
-- Columns removed from invoices (deferred to 075):
--   - business_name, business_contact, business_email
--   - business_website, venmo_handle, paypal_email
--
-- Date: 2026-02-10

-- UP

-- =====================================================
-- SECTION 1: Create system_settings table
-- =====================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type TEXT DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
  description TEXT,
  is_sensitive BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast key lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- =====================================================
-- SECTION 2: Seed default business settings
-- =====================================================
-- These defaults match the existing hardcoded values in invoice rows
-- and server/config/business.ts

INSERT OR IGNORE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
  ('business.name', 'No Bhad Codes', 'string', 'Business name displayed on documents'),
  ('business.owner', 'Noelle Bhaduri', 'string', 'Owner/principal name'),
  ('business.contact', 'Noelle Bhaduri', 'string', 'Primary contact person name'),
  ('business.tagline', 'Web Development & Design', 'string', 'Business tagline/description'),
  ('business.email', 'nobhaduri@gmail.com', 'string', 'Primary business email'),
  ('business.website', 'nobhad.codes', 'string', 'Business website URL (without https://)');

-- Payment method settings
INSERT OR IGNORE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
  ('payment.venmo_handle', '@nobhaduri', 'string', 'Venmo handle for payments'),
  ('payment.zelle_email', 'nobhaduri@gmail.com', 'string', 'Zelle email for payments'),
  ('payment.paypal_email', '', 'string', 'PayPal email for payments (optional)');

-- Invoice settings
INSERT OR IGNORE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
  ('invoice.default_currency', 'USD', 'string', 'Default currency for new invoices'),
  ('invoice.default_terms', 'Payment due within 30 days of invoice date.', 'string', 'Default invoice terms'),
  ('invoice.prefix', 'INV-', 'string', 'Invoice number prefix'),
  ('invoice.next_sequence', '1', 'number', 'Next invoice sequence number');

-- Email notification settings
INSERT OR IGNORE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
  ('email.from_name', 'No Bhad Codes', 'string', 'Display name for outgoing emails'),
  ('email.from_address', 'nobhaduri@gmail.com', 'string', 'From address for outgoing emails');

-- DOWN

DROP INDEX IF EXISTS idx_system_settings_key;
DROP TABLE IF EXISTS system_settings;
