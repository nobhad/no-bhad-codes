-- UP
-- Migration: Messaging Enhancement
-- Phase 5: Threads, mentions, reactions, notifications, internal messages
-- Created: 2026-02-01

-- =====================================================
-- MESSAGE MENTIONS
-- =====================================================
-- Track mentions in messages (@user, @team, @all)
CREATE TABLE IF NOT EXISTS message_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  mentioned_type TEXT NOT NULL,    -- 'user', 'team', 'all'
  mentioned_id TEXT,               -- User email or team name (null for @all)
  notified BOOLEAN DEFAULT FALSE,
  notified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES general_messages(id) ON DELETE CASCADE
);

-- =====================================================
-- MESSAGE REACTIONS
-- =====================================================
-- Emoji or text reactions on messages
CREATE TABLE IF NOT EXISTS message_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,         -- 'admin', 'client'
  reaction TEXT NOT NULL,          -- Emoji or reaction type
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES general_messages(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_email, reaction)
);

-- =====================================================
-- MESSAGE SUBSCRIPTIONS
-- =====================================================
-- Per-project notification preferences
CREATE TABLE IF NOT EXISTS message_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,         -- 'admin', 'client'
  notify_all BOOLEAN DEFAULT TRUE,
  notify_mentions BOOLEAN DEFAULT TRUE,
  notify_replies BOOLEAN DEFAULT TRUE,
  muted_until DATETIME,            -- Temporary mute
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, user_email)
);

-- =====================================================
-- MESSAGE READ RECEIPTS
-- =====================================================
-- Track read status per user
CREATE TABLE IF NOT EXISTS message_read_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES general_messages(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_email)
);

-- =====================================================
-- PINNED MESSAGES
-- =====================================================
-- Track pinned messages in threads
CREATE TABLE IF NOT EXISTS pinned_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  pinned_by TEXT NOT NULL,
  pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES general_messages(id) ON DELETE CASCADE,
  UNIQUE(thread_id, message_id)
);

-- =====================================================
-- UPDATE GENERAL_MESSAGES TABLE
-- =====================================================
ALTER TABLE general_messages ADD COLUMN parent_message_id INTEGER REFERENCES general_messages(id);
ALTER TABLE general_messages ADD COLUMN is_internal BOOLEAN DEFAULT FALSE;
ALTER TABLE general_messages ADD COLUMN edited_at DATETIME;
ALTER TABLE general_messages ADD COLUMN deleted_at DATETIME;
ALTER TABLE general_messages ADD COLUMN deleted_by TEXT;
ALTER TABLE general_messages ADD COLUMN reaction_count INTEGER DEFAULT 0;
ALTER TABLE general_messages ADD COLUMN reply_count INTEGER DEFAULT 0;
ALTER TABLE general_messages ADD COLUMN mention_count INTEGER DEFAULT 0;

-- =====================================================
-- UPDATE MESSAGE_THREADS TABLE
-- =====================================================
ALTER TABLE message_threads ADD COLUMN pinned_count INTEGER DEFAULT 0;
-- participant_count already exists from migration 005
ALTER TABLE message_threads ADD COLUMN archived_at DATETIME;
ALTER TABLE message_threads ADD COLUMN archived_by TEXT;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_message_mentions_message ON message_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_user ON message_mentions(mentioned_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_type ON message_mentions(mentioned_type);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_email);

CREATE INDEX IF NOT EXISTS idx_message_subscriptions_project ON message_subscriptions(project_id);
CREATE INDEX IF NOT EXISTS idx_message_subscriptions_user ON message_subscriptions(user_email);

CREATE INDEX IF NOT EXISTS idx_message_read_receipts_message ON message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_user ON message_read_receipts(user_email);

CREATE INDEX IF NOT EXISTS idx_pinned_messages_thread ON pinned_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_message ON pinned_messages(message_id);

CREATE INDEX IF NOT EXISTS idx_messages_parent ON general_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_internal ON general_messages(is_internal);
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON general_messages(deleted_at);

CREATE INDEX IF NOT EXISTS idx_threads_archived ON message_threads(archived_at);

-- DOWN
-- Rollback: Drop all new tables and columns

DROP INDEX IF EXISTS idx_threads_archived;
DROP INDEX IF EXISTS idx_messages_deleted;
DROP INDEX IF EXISTS idx_messages_internal;
DROP INDEX IF EXISTS idx_messages_parent;
DROP INDEX IF EXISTS idx_pinned_messages_message;
DROP INDEX IF EXISTS idx_pinned_messages_thread;
DROP INDEX IF EXISTS idx_message_read_receipts_user;
DROP INDEX IF EXISTS idx_message_read_receipts_message;
DROP INDEX IF EXISTS idx_message_subscriptions_user;
DROP INDEX IF EXISTS idx_message_subscriptions_project;
DROP INDEX IF EXISTS idx_message_reactions_user;
DROP INDEX IF EXISTS idx_message_reactions_message;
DROP INDEX IF EXISTS idx_message_mentions_type;
DROP INDEX IF EXISTS idx_message_mentions_user;
DROP INDEX IF EXISTS idx_message_mentions_message;

DROP TABLE IF EXISTS pinned_messages;
DROP TABLE IF EXISTS message_read_receipts;
DROP TABLE IF EXISTS message_subscriptions;
DROP TABLE IF EXISTS message_reactions;
DROP TABLE IF EXISTS message_mentions;

-- Note: SQLite doesn't support DROP COLUMN, so general_messages/message_threads columns would remain
