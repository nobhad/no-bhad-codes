-- UP
-- Migration: Client Management Enhancement
-- Phase 1: CRM-grade contact management, activities, custom fields, tags, health scoring
-- Created: 2025-02-01

-- =====================================================
-- CONTACTS WITHIN CLIENT ACCOUNTS
-- =====================================================
-- Multiple people per company (contacts for a client organization)
CREATE TABLE IF NOT EXISTS client_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,              -- Job title
  department TEXT,
  role TEXT DEFAULT 'general',  -- 'primary', 'billing', 'technical', 'decision_maker', 'general'
  is_primary BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- =====================================================
-- CLIENT ACTIVITY TIMELINE
-- =====================================================
-- Activity feed for tracking all client interactions
CREATE TABLE IF NOT EXISTS client_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL,  -- 'note', 'call', 'email', 'meeting', 'status_change', 'invoice_sent', 'payment_received', 'project_created', 'proposal_sent'
  title TEXT NOT NULL,
  description TEXT,
  metadata JSON,           -- Additional structured data (e.g., { "invoice_id": 123, "amount": 500 })
  created_by TEXT,         -- 'admin', 'system', 'client', or specific user email
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- =====================================================
-- CUSTOM FIELDS SYSTEM
-- =====================================================
-- Define custom fields that can be added to clients
CREATE TABLE IF NOT EXISTS client_custom_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  field_name TEXT NOT NULL UNIQUE,      -- Internal identifier (snake_case)
  field_label TEXT NOT NULL,             -- Display label
  field_type TEXT NOT NULL,              -- 'text', 'number', 'date', 'select', 'multiselect', 'boolean', 'url', 'email', 'phone'
  options JSON,                          -- For select/multiselect: ["Option 1", "Option 2"]
  is_required BOOLEAN DEFAULT FALSE,
  placeholder TEXT,                      -- Placeholder text for input
  default_value TEXT,                    -- Default value for new clients
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Store custom field values per client
CREATE TABLE IF NOT EXISTS client_custom_field_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  field_id INTEGER NOT NULL,
  field_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (field_id) REFERENCES client_custom_fields(id) ON DELETE CASCADE,
  UNIQUE(client_id, field_id)
);

-- =====================================================
-- TAGS & SEGMENTATION
-- =====================================================
-- Tags for categorizing and segmenting clients
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6b7280',       -- Hex color for visual identification
  description TEXT,
  tag_type TEXT DEFAULT 'client',     -- 'client', 'project', 'lead', 'general'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for client-tag relationships
CREATE TABLE IF NOT EXISTS client_tags (
  client_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, tag_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- =====================================================
-- CLIENT HEALTH SCORING & CRM FIELDS
-- =====================================================
-- Add new columns to clients table for CRM functionality
ALTER TABLE clients ADD COLUMN health_score INTEGER DEFAULT 100;
ALTER TABLE clients ADD COLUMN health_status TEXT DEFAULT 'healthy';  -- 'healthy', 'at_risk', 'critical'
ALTER TABLE clients ADD COLUMN lifetime_value DECIMAL(10,2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN acquisition_source TEXT;                -- Where the client came from
ALTER TABLE clients ADD COLUMN industry TEXT;                          -- Client's industry
ALTER TABLE clients ADD COLUMN company_size TEXT;                      -- 'solo', 'small' (2-10), 'medium' (11-50), 'enterprise' (50+)
ALTER TABLE clients ADD COLUMN website TEXT;                           -- Client's website URL
ALTER TABLE clients ADD COLUMN last_contact_date DATE;                 -- Last interaction date
ALTER TABLE clients ADD COLUMN next_follow_up_date DATE;               -- Scheduled follow-up
ALTER TABLE clients ADD COLUMN notes TEXT;                             -- General notes about client
ALTER TABLE clients ADD COLUMN preferred_contact_method TEXT;          -- 'email', 'phone', 'text', 'slack'

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_email ON client_contacts(email);
CREATE INDEX IF NOT EXISTS idx_client_contacts_role ON client_contacts(role);

CREATE INDEX IF NOT EXISTS idx_client_activities_client ON client_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_client_activities_type ON client_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_client_activities_created ON client_activities(created_at);

CREATE INDEX IF NOT EXISTS idx_client_custom_fields_active ON client_custom_fields(is_active);
CREATE INDEX IF NOT EXISTS idx_client_custom_field_values_client ON client_custom_field_values(client_id);
CREATE INDEX IF NOT EXISTS idx_client_custom_field_values_field ON client_custom_field_values(field_id);

CREATE INDEX IF NOT EXISTS idx_tags_type ON tags(tag_type);
CREATE INDEX IF NOT EXISTS idx_client_tags_client ON client_tags(client_id);
CREATE INDEX IF NOT EXISTS idx_client_tags_tag ON client_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_clients_health_status ON clients(health_status);
CREATE INDEX IF NOT EXISTS idx_clients_industry ON clients(industry);
CREATE INDEX IF NOT EXISTS idx_clients_acquisition_source ON clients(acquisition_source);

-- =====================================================
-- SEED DEFAULT TAGS
-- =====================================================
INSERT OR IGNORE INTO tags (name, color, tag_type, description) VALUES
('VIP', '#f59e0b', 'client', 'High-value or priority clients'),
('Referral', '#10b981', 'client', 'Client was referred by another client'),
('New', '#3b82f6', 'client', 'Recently acquired client'),
('Returning', '#8b5cf6', 'client', 'Client with previous completed projects'),
('Enterprise', '#ef4444', 'client', 'Large enterprise client'),
('Startup', '#06b6d4', 'client', 'Startup or early-stage company'),
('Agency', '#ec4899', 'client', 'Agency or partner'),
('Non-Profit', '#84cc16', 'client', 'Non-profit organization');

-- =====================================================
-- SEED DEFAULT CUSTOM FIELDS
-- =====================================================
INSERT OR IGNORE INTO client_custom_fields (field_name, field_label, field_type, display_order) VALUES
('linkedin_url', 'LinkedIn Profile', 'url', 1),
('twitter_handle', 'Twitter Handle', 'text', 2),
('timezone', 'Timezone', 'text', 3),
('contract_type', 'Contract Type', 'select', 4);

-- Update contract_type options
UPDATE client_custom_fields
SET options = '["Retainer", "Project-Based", "Hourly", "Fixed Price"]'
WHERE field_name = 'contract_type';

-- DOWN
-- Rollback: Drop all new tables and columns

DROP INDEX IF EXISTS idx_clients_acquisition_source;
DROP INDEX IF EXISTS idx_clients_industry;
DROP INDEX IF EXISTS idx_clients_health_status;
DROP INDEX IF EXISTS idx_client_tags_tag;
DROP INDEX IF EXISTS idx_client_tags_client;
DROP INDEX IF EXISTS idx_tags_type;
DROP INDEX IF EXISTS idx_client_custom_field_values_field;
DROP INDEX IF EXISTS idx_client_custom_field_values_client;
DROP INDEX IF EXISTS idx_client_custom_fields_active;
DROP INDEX IF EXISTS idx_client_activities_created;
DROP INDEX IF EXISTS idx_client_activities_type;
DROP INDEX IF EXISTS idx_client_activities_client;
DROP INDEX IF EXISTS idx_client_contacts_role;
DROP INDEX IF EXISTS idx_client_contacts_email;
DROP INDEX IF EXISTS idx_client_contacts_client;

DROP TABLE IF EXISTS client_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS client_custom_field_values;
DROP TABLE IF EXISTS client_custom_fields;
DROP TABLE IF EXISTS client_activities;
DROP TABLE IF EXISTS client_contacts;

-- Note: SQLite doesn't support DROP COLUMN, so client columns would remain
-- In production, use a migration that recreates the clients table without new columns
