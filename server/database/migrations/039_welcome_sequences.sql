-- =====================================================
-- Migration 039: Welcome Sequences
-- =====================================================
-- Automated onboarding email sequences for new clients
-- =====================================================

-- ===============================================
-- WELCOME SEQUENCE EMAILS TABLE
-- ===============================================
-- Tracks scheduled welcome/onboarding emails for clients
CREATE TABLE IF NOT EXISTS welcome_sequence_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  email_type TEXT NOT NULL,  -- 'welcome', 'getting_started', 'tips', 'check_in'
  scheduled_date DATE NOT NULL,
  sent_at DATETIME,
  status TEXT DEFAULT 'pending',  -- 'pending', 'sent', 'skipped', 'failed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- ===============================================
-- WELCOME SEQUENCE TEMPLATES TABLE
-- ===============================================
-- Defines the welcome sequence (which emails, when)
CREATE TABLE IF NOT EXISTS welcome_sequence_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_type TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  days_after_signup INTEGER NOT NULL,  -- Days after account creation
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- PERFORMANCE INDEXES
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_welcome_sequence_emails_client ON welcome_sequence_emails(client_id);
CREATE INDEX IF NOT EXISTS idx_welcome_sequence_emails_status ON welcome_sequence_emails(status, scheduled_date);

-- ===============================================
-- ADD WELCOME SEQUENCE FLAG TO CLIENTS
-- ===============================================
ALTER TABLE clients ADD COLUMN welcome_sequence_started_at DATETIME;
ALTER TABLE clients ADD COLUMN welcome_sequence_completed BOOLEAN DEFAULT FALSE;

-- ===============================================
-- SEED DEFAULT WELCOME SEQUENCE
-- ===============================================
INSERT OR IGNORE INTO welcome_sequence_templates (id, email_type, subject, days_after_signup, sort_order) VALUES
(1, 'welcome', 'Welcome to No Bhad Codes!', 0, 1),
(2, 'getting_started', 'Getting Started with Your Client Portal', 1, 2),
(3, 'tips', 'Tips for Working Together', 3, 3),
(4, 'check_in', 'How''s Everything Going?', 7, 4);
