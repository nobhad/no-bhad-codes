-- ===============================================
-- CONSOLIDATE NOTIFICATION PREFERENCES
-- ===============================================
-- Migration: 069_consolidate_notification_preferences.sql
-- Description: Migrate inline notification columns from clients to notification_preferences table
-- Created: 2026-02-10
--
-- RATIONALE:
-- - clients table has 4 inline notification columns (notification_messages, notification_status, etc.)
-- - notification_preferences table is the proper normalized table with 25+ options
-- - This migration consolidates to single source of truth
--
-- COLUMNS BEING REMOVED FROM clients:
-- - notification_messages -> notify_new_message
-- - notification_status -> notify_project_update
-- - notification_invoices -> notify_invoice_created
-- - notification_weekly -> email_frequency = 'weekly_digest'

-- ===============================================
-- SECTION 1: MIGRATE DATA TO notification_preferences
-- ===============================================

-- For each client that has notification settings but no entry in notification_preferences,
-- create an entry with their current preferences migrated

INSERT INTO notification_preferences (
  user_id,
  user_type,
  email_enabled,
  email_frequency,
  notify_new_message,
  notify_invoice_created,
  notify_project_update
)
SELECT
  c.id,
  'client',
  1, -- email_enabled default true
  CASE WHEN c.notification_weekly = 1 THEN 'weekly_digest' ELSE 'immediate' END,
  CASE WHEN c.notification_messages = 1 THEN 1 ELSE 0 END,
  CASE WHEN c.notification_invoices = 1 THEN 1 ELSE 0 END,
  CASE WHEN c.notification_status = 1 THEN 1 ELSE 0 END
FROM clients c
WHERE c.id NOT IN (
  SELECT user_id FROM notification_preferences WHERE user_type = 'client'
);

-- For clients that already have notification_preferences entries,
-- update them with the legacy values if the legacy values are set to OFF
-- (since defaults are ON, only migrate explicit OFF settings)

UPDATE notification_preferences
SET
  notify_new_message = (
    SELECT CASE WHEN c.notification_messages = 0 THEN 0 ELSE notify_new_message END
    FROM clients c WHERE c.id = notification_preferences.user_id
  ),
  notify_invoice_created = (
    SELECT CASE WHEN c.notification_invoices = 0 THEN 0 ELSE notify_invoice_created END
    FROM clients c WHERE c.id = notification_preferences.user_id
  ),
  notify_project_update = (
    SELECT CASE WHEN c.notification_status = 0 THEN 0 ELSE notify_project_update END
    FROM clients c WHERE c.id = notification_preferences.user_id
  ),
  email_frequency = (
    SELECT CASE WHEN c.notification_weekly = 1 THEN 'weekly_digest' ELSE email_frequency END
    FROM clients c WHERE c.id = notification_preferences.user_id
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE user_type = 'client'
  AND user_id IN (SELECT id FROM clients);

-- ===============================================
-- SECTION 2: RECREATE clients TABLE WITHOUT NOTIFICATION COLUMNS
-- ===============================================

-- Create new clients table without notification columns
CREATE TABLE clients_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  company_name TEXT,
  contact_name TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reset_token TEXT,
  reset_token_expiry DATETIME,
  billing_company TEXT,
  billing_address TEXT,
  billing_address2 TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_zip TEXT,
  billing_country TEXT,
  is_admin INTEGER DEFAULT 0,
  invitation_token TEXT,
  invitation_expires_at DATETIME,
  invitation_sent_at DATETIME,
  last_login_at DATETIME,
  magic_link_token TEXT,
  magic_link_expires_at DATETIME,
  client_type TEXT DEFAULT 'business',
  health_score INTEGER DEFAULT 100,
  health_status TEXT DEFAULT 'healthy',
  lifetime_value DECIMAL(10,2) DEFAULT 0,
  acquisition_source TEXT,
  industry TEXT,
  company_size TEXT,
  website TEXT,
  last_contact_date DATE,
  next_follow_up_date DATE,
  notes TEXT,
  preferred_contact_method TEXT,
  welcome_sequence_started_at DATETIME,
  welcome_sequence_completed BOOLEAN DEFAULT FALSE,
  deleted_at DATETIME,
  deleted_by TEXT
);

-- Copy all data (excluding notification columns)
INSERT INTO clients_new (
  id, email, password_hash, company_name, contact_name, phone, status,
  created_at, updated_at, reset_token, reset_token_expiry,
  billing_company, billing_address, billing_address2, billing_city,
  billing_state, billing_zip, billing_country,
  is_admin, invitation_token, invitation_expires_at, invitation_sent_at,
  last_login_at, magic_link_token, magic_link_expires_at,
  client_type, health_score, health_status, lifetime_value,
  acquisition_source, industry, company_size, website,
  last_contact_date, next_follow_up_date, notes, preferred_contact_method,
  welcome_sequence_started_at, welcome_sequence_completed,
  deleted_at, deleted_by
)
SELECT
  id, email, password_hash, company_name, contact_name, phone, status,
  created_at, updated_at, reset_token, reset_token_expiry,
  billing_company, billing_address, billing_address2, billing_city,
  billing_state, billing_zip, billing_country,
  is_admin, invitation_token, invitation_expires_at, invitation_sent_at,
  last_login_at, magic_link_token, magic_link_expires_at,
  client_type, health_score, health_status, lifetime_value,
  acquisition_source, industry, company_size, website,
  last_contact_date, next_follow_up_date, notes, preferred_contact_method,
  welcome_sequence_started_at, welcome_sequence_completed,
  deleted_at, deleted_by
FROM clients;

-- Drop old table and rename new one
DROP TABLE clients;
ALTER TABLE clients_new RENAME TO clients;

-- Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_name);
CREATE INDEX IF NOT EXISTS idx_clients_health ON clients(health_score);
CREATE INDEX IF NOT EXISTS idx_clients_deleted ON clients(deleted_at);

-- ===============================================
-- NOTES FOR APPLICATION CODE UPDATES:
-- ===============================================
--
-- 1. REMOVED COLUMNS FROM clients TABLE:
--    - notification_messages
--    - notification_status
--    - notification_invoices
--    - notification_weekly
--
-- 2. CODE CHANGES REQUIRED:
--    In server/routes/clients.ts:
--    - Remove notification_* from GET /me SELECT query
--    - Update PUT /me/notifications to use notificationPreferencesService
--
-- 3. MAPPING:
--    notification_messages -> notify_new_message
--    notification_status -> notify_project_update
--    notification_invoices -> notify_invoice_created
--    notification_weekly -> email_frequency = 'weekly_digest'
