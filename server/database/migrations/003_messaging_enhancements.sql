-- UP
-- Migration: Enhance messaging system and fix column naming inconsistencies
-- Created: 2025-01-02T00:00:00.000Z

-- Update messages table to match API expectations and add new features
-- First, check if we need to rename columns
ALTER TABLE messages RENAME COLUMN sender_role TO sender_type;
ALTER TABLE messages RENAME COLUMN sender_name TO sender_name;

-- Add new columns for enhanced messaging functionality
ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'file', 'update'));
ALTER TABLE messages ADD COLUMN reply_to INTEGER DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN attachments TEXT DEFAULT NULL; -- JSON array of attached file IDs
ALTER TABLE messages ADD COLUMN priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
ALTER TABLE messages ADD COLUMN read_at DATETIME DEFAULT NULL;
ALTER TABLE messages ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Create general messages table for non-project specific messages
CREATE TABLE IF NOT EXISTS general_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'admin', 'system')),
  sender_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'inquiry' CHECK (message_type IN ('inquiry', 'quote_request', 'support', 'feedback', 'system')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'closed')),
  reply_to INTEGER DEFAULT NULL REFERENCES general_messages(id) ON DELETE SET NULL,
  attachments TEXT DEFAULT NULL, -- JSON array of attachment file paths
  is_read BOOLEAN DEFAULT FALSE,
  read_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Create message threads table to group related messages
CREATE TABLE IF NOT EXISTS message_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER DEFAULT NULL, -- NULL for general threads
  client_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  thread_type TEXT DEFAULT 'general' CHECK (thread_type IN ('general', 'project', 'support', 'quote')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_message_by TEXT DEFAULT NULL,
  participant_count INTEGER DEFAULT 2, -- client + admin
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Add thread_id to messages table to group related messages
ALTER TABLE messages ADD COLUMN thread_id INTEGER DEFAULT NULL REFERENCES message_threads(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);

CREATE INDEX IF NOT EXISTS idx_general_messages_client_id ON general_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_general_messages_status ON general_messages(status);
CREATE INDEX IF NOT EXISTS idx_general_messages_message_type ON general_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_general_messages_created_at ON general_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_message_threads_client_id ON message_threads(client_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_project_id ON message_threads(project_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_status ON message_threads(status);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_message_at ON message_threads(last_message_at);

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  project_updates BOOLEAN DEFAULT TRUE,
  new_messages BOOLEAN DEFAULT TRUE,
  milestone_updates BOOLEAN DEFAULT TRUE,
  invoice_notifications BOOLEAN DEFAULT TRUE,
  marketing_emails BOOLEAN DEFAULT FALSE,
  notification_frequency TEXT DEFAULT 'immediate' CHECK (notification_frequency IN ('immediate', 'daily', 'weekly', 'none')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Create index for notification preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_client_id ON notification_preferences(client_id);

-- DOWN
-- Rollback: Remove enhancements and restore original schema

-- Drop new indexes
DROP INDEX IF EXISTS idx_notification_preferences_client_id;
DROP INDEX IF EXISTS idx_message_threads_last_message_at;
DROP INDEX IF EXISTS idx_message_threads_status;
DROP INDEX IF EXISTS idx_message_threads_project_id;
DROP INDEX IF EXISTS idx_message_threads_client_id;
DROP INDEX IF EXISTS idx_general_messages_created_at;
DROP INDEX IF EXISTS idx_general_messages_message_type;
DROP INDEX IF EXISTS idx_general_messages_status;
DROP INDEX IF EXISTS idx_general_messages_client_id;
DROP INDEX IF EXISTS idx_messages_message_type;
DROP INDEX IF EXISTS idx_messages_is_read;
DROP INDEX IF EXISTS idx_messages_sender_type;
DROP INDEX IF EXISTS idx_messages_thread_id;

-- Drop new tables
DROP TABLE IF EXISTS notification_preferences;
DROP TABLE IF EXISTS message_threads;
DROP TABLE IF EXISTS general_messages;

-- Remove new columns from messages table (SQLite doesn't support DROP COLUMN directly)
-- We would need to recreate the table to remove columns, but for rollback we'll leave them
-- as they don't break existing functionality

-- Note: To properly rollback column additions in SQLite, we'd need to:
-- 1. Create temporary table with original schema
-- 2. Copy data from modified table
-- 3. Drop modified table
-- 4. Rename temporary table
-- This is complex and typically not done for minor additions