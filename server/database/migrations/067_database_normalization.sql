-- ===============================================
-- DATABASE NORMALIZATION - PHASE 1
-- ===============================================
-- Migration: 067_database_normalization.sql
-- Description: Remove redundant is_read boolean fields (use read_at instead)
-- Created: 2026-02-10
--
-- RATIONALE:
-- - is_read BOOLEAN is redundant when read_at DATETIME exists
-- - Can derive is_read from: read_at IS NOT NULL
-- - Removes data consistency issues (is_read=TRUE but read_at=NULL)

-- ===============================================
-- SECTION 1: MESSAGES TABLE - Remove is_read
-- ===============================================

-- Create new messages table without is_read
CREATE TABLE messages_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  sender_name TEXT NOT NULL,
  sender_type TEXT DEFAULT 'client',
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  message_type TEXT DEFAULT 'text',
  reply_to INTEGER,
  attachments TEXT,
  priority TEXT DEFAULT 'normal',
  read_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  thread_id INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Copy data, converting is_read=1 to read_at if read_at was null
INSERT INTO messages_new (id, project_id, sender_name, sender_type, message, created_at, message_type, reply_to, attachments, priority, read_at, updated_at, thread_id)
SELECT id, project_id, sender_name, sender_type, message, created_at, message_type, reply_to, attachments, priority,
       CASE WHEN is_read = 1 AND read_at IS NULL THEN created_at ELSE read_at END,
       updated_at, thread_id
FROM messages;

-- Replace old table
DROP TABLE messages;
ALTER TABLE messages_new RENAME TO messages;

-- Recreate indexes
CREATE INDEX idx_messages_project ON messages(project_id);
CREATE INDEX idx_messages_read_at ON messages(read_at);
CREATE INDEX idx_messages_thread ON messages(thread_id);

-- ===============================================
-- SECTION 2: GENERAL_MESSAGES TABLE - Remove is_read
-- ===============================================

-- Create new general_messages table without is_read
CREATE TABLE general_messages_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  sender_type TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'inquiry',
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'new',
  reply_to INTEGER,
  attachments TEXT,
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  thread_id INTEGER,
  parent_message_id INTEGER,
  is_internal BOOLEAN DEFAULT FALSE,
  edited_at DATETIME,
  deleted_at DATETIME,
  deleted_by TEXT,
  reaction_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  mention_count INTEGER DEFAULT 0,
  FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE CASCADE
);

-- Copy data, converting is_read=1 to read_at if read_at was null
INSERT INTO general_messages_new (id, client_id, sender_type, sender_name, subject, message, message_type, priority, status, reply_to, attachments, read_at, created_at, updated_at, thread_id, parent_message_id, is_internal, edited_at, deleted_at, deleted_by, reaction_count, reply_count, mention_count)
SELECT id, client_id, sender_type, sender_name, subject, message, message_type, priority, status, reply_to, attachments,
       CASE WHEN is_read = 1 AND read_at IS NULL THEN created_at ELSE read_at END,
       created_at, updated_at, thread_id, parent_message_id, is_internal, edited_at, deleted_at, deleted_by, reaction_count, reply_count, mention_count
FROM general_messages;

-- Replace old table
DROP TABLE general_messages;
ALTER TABLE general_messages_new RENAME TO general_messages;

-- Recreate indexes
CREATE INDEX idx_general_messages_thread ON general_messages(thread_id);
CREATE INDEX idx_general_messages_read_at ON general_messages(read_at);
CREATE INDEX idx_general_messages_client ON general_messages(client_id);

-- ===============================================
-- APPLICATION CODE CHANGES REQUIRED:
-- ===============================================
--
-- 1. REMOVED COLUMNS:
--    - messages.is_read
--    - general_messages.is_read
--
-- 2. QUERY UPDATES:
--    Replace: WHERE is_read = 0
--    With:    WHERE read_at IS NULL
--
--    Replace: WHERE is_read = 1
--    With:    WHERE read_at IS NOT NULL
--
--    Replace: UPDATE ... SET is_read = 1
--    With:    UPDATE ... SET read_at = CURRENT_TIMESTAMP
--
-- 3. TYPE UPDATES:
--    In server/types/database.ts:
--    Remove is_read from MessageRow, MessageInsert, MessageUpdate
