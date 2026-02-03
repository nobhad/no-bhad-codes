-- UP
-- Migration: Notification Preferences
-- Tier 2: Client notification preferences configuration
-- Created: 2026-02-02

-- =====================================================
-- NOTIFICATION PREFERENCES
-- =====================================================
-- Drop old version of table (had client_id instead of user_id)
DROP TABLE IF EXISTS notification_preferences;

-- Store user notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'client',           -- 'client', 'admin'

  -- Email notification settings
  email_enabled BOOLEAN DEFAULT TRUE,                 -- Master switch for emails
  email_frequency TEXT DEFAULT 'immediate',           -- 'immediate', 'daily_digest', 'weekly_digest', 'none'
  digest_time TEXT DEFAULT '09:00',                   -- Preferred time for digest emails (HH:MM)
  digest_day TEXT DEFAULT 'monday',                   -- Preferred day for weekly digest

  -- Event-specific preferences (1 = enabled, 0 = disabled)
  notify_new_message BOOLEAN DEFAULT TRUE,            -- New message received
  notify_message_reply BOOLEAN DEFAULT TRUE,          -- Reply to your message
  notify_invoice_created BOOLEAN DEFAULT TRUE,        -- New invoice created
  notify_invoice_reminder BOOLEAN DEFAULT TRUE,       -- Invoice payment reminder
  notify_invoice_paid BOOLEAN DEFAULT FALSE,          -- Payment confirmation
  notify_project_update BOOLEAN DEFAULT TRUE,         -- Project status change
  notify_project_milestone BOOLEAN DEFAULT TRUE,      -- Milestone completed
  notify_document_request BOOLEAN DEFAULT TRUE,       -- New document request
  notify_document_approved BOOLEAN DEFAULT TRUE,      -- Document approved
  notify_document_rejected BOOLEAN DEFAULT TRUE,      -- Document rejected (always want to know)
  notify_deliverable_ready BOOLEAN DEFAULT TRUE,      -- Deliverable ready for review
  notify_proposal_created BOOLEAN DEFAULT TRUE,       -- New proposal sent
  notify_contract_ready BOOLEAN DEFAULT TRUE,         -- Contract ready for signature
  notify_file_uploaded BOOLEAN DEFAULT FALSE,         -- New file uploaded to project

  -- Quiet hours (don't send notifications during these times)
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TEXT DEFAULT '22:00',             -- Start of quiet hours (HH:MM)
  quiet_hours_end TEXT DEFAULT '08:00',               -- End of quiet hours (HH:MM)

  -- Communication preferences
  marketing_emails BOOLEAN DEFAULT TRUE,              -- Marketing/promotional emails
  newsletter_emails BOOLEAN DEFAULT TRUE,             -- Newsletter subscription
  product_updates BOOLEAN DEFAULT TRUE,               -- Product update announcements

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, user_type)
);

-- =====================================================
-- NOTIFICATION LOG
-- =====================================================
-- Track sent notifications
CREATE TABLE IF NOT EXISTS notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,
  notification_type TEXT NOT NULL,                    -- Type of notification sent
  channel TEXT NOT NULL DEFAULT 'email',              -- 'email', 'push', 'in_app'
  subject TEXT,
  message_preview TEXT,
  status TEXT DEFAULT 'pending',                      -- 'pending', 'sent', 'delivered', 'failed', 'bounced'
  error_message TEXT,
  sent_at DATETIME,
  delivered_at DATETIME,
  read_at DATETIME,
  metadata JSON,                                      -- Additional data (entity_id, entity_type, etc.)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- DIGEST QUEUE
-- =====================================================
-- Queue notifications for digest emails
CREATE TABLE IF NOT EXISTS notification_digest_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  entity_type TEXT,                                   -- 'message', 'invoice', 'project', etc.
  entity_id INTEGER,
  priority INTEGER DEFAULT 0,                         -- Higher = more important
  processed BOOLEAN DEFAULT FALSE,
  processed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON notification_log(status);
CREATE INDEX IF NOT EXISTS idx_notification_digest_queue_user ON notification_digest_queue(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_notification_digest_queue_processed ON notification_digest_queue(processed);

-- DOWN
DROP INDEX IF EXISTS idx_notification_digest_queue_processed;
DROP INDEX IF EXISTS idx_notification_digest_queue_user;
DROP INDEX IF EXISTS idx_notification_log_status;
DROP INDEX IF EXISTS idx_notification_log_type;
DROP INDEX IF EXISTS idx_notification_log_user;
DROP INDEX IF EXISTS idx_notification_prefs_user;

DROP TABLE IF EXISTS notification_digest_queue;
DROP TABLE IF EXISTS notification_log;
DROP TABLE IF EXISTS notification_preferences;
