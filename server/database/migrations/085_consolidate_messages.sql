-- =====================================================
-- Migration 085: Consolidate Message Tables
-- =====================================================
-- Phase 3 of Backend Cleanup
--
-- This migration unifies the `messages` and `general_messages` tables
-- into a single `messages` table with a `context_type` column.
--
-- Current State:
--   - `messages` - Project-specific messages (basic schema)
--   - `general_messages` - General/thread-based messages (rich features)
--   - `message_threads` - Thread containers
--   - Supporting tables tied to `general_messages`:
--     - message_mentions
--     - message_reactions
--     - message_subscriptions
--     - message_read_receipts
--     - pinned_messages
--
-- Target State:
--   - `messages` - Unified table with context_type ('project' or 'general')
--   - All supporting tables reference unified `messages` table
--   - `general_messages` kept for 30-day safety period (renamed)
--
-- Date: 2026-02-12
-- =====================================================

-- UP

-- =====================================================
-- SECTION 1: Create new unified messages table
-- =====================================================
-- SQLite doesn't support ALTER TABLE ADD COLUMN with constraints well,
-- so we create a new table with all needed columns

CREATE TABLE messages_unified (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Context differentiation
  context_type TEXT NOT NULL DEFAULT 'project' CHECK (context_type IN ('project', 'general')),
  -- Foreign keys
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  thread_id INTEGER REFERENCES message_threads(id) ON DELETE CASCADE,
  -- Sender info (normalize to 'admin' instead of 'developer')
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'admin', 'system')),
  sender_name TEXT,
  -- Content
  subject TEXT,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'file', 'update', 'inquiry', 'quote_request', 'support', 'feedback')),
  -- Priority and status
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'closed')),
  -- Threading
  reply_to INTEGER,
  parent_message_id INTEGER,
  -- Attachments
  attachments TEXT,
  -- Internal messages (admin-only visibility)
  is_internal BOOLEAN DEFAULT FALSE,
  -- Timestamps
  read_at DATETIME,
  edited_at DATETIME,
  deleted_at DATETIME,
  deleted_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Denormalized counts for performance
  reaction_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  mention_count INTEGER DEFAULT 0
);

-- =====================================================
-- SECTION 2: Migrate data from `messages` table (project messages)
-- =====================================================
-- Note: We map 'developer' to 'admin' during migration

INSERT INTO messages_unified (
  id, context_type, project_id, client_id, thread_id,
  sender_type, sender_name, subject, message, message_type,
  priority, status, reply_to, parent_message_id, attachments,
  is_internal, read_at, edited_at, deleted_at, deleted_by,
  created_at, updated_at, reaction_count, reply_count, mention_count
)
SELECT
  id,
  'project',
  project_id,
  (SELECT client_id FROM projects WHERE projects.id = messages.project_id),
  thread_id,
  CASE WHEN sender_type = 'developer' THEN 'admin' ELSE sender_type END,
  sender_name,
  NULL,  -- no subject for project messages
  message,
  COALESCE(message_type, 'text'),
  COALESCE(priority, 'normal'),
  CASE WHEN read_at IS NOT NULL THEN 'read' ELSE 'new' END,
  reply_to,
  NULL,  -- no parent_message_id in old messages
  attachments,
  FALSE, -- no internal messages in old table
  read_at,
  NULL,  -- no edited_at in old table
  NULL,  -- no deleted_at in old table
  NULL,  -- no deleted_by in old table
  created_at,
  COALESCE(updated_at, created_at),
  0, 0, 0
FROM messages;

-- =====================================================
-- SECTION 3: Migrate data from `general_messages` table
-- =====================================================
-- Offset IDs by max(messages.id) to avoid conflicts

INSERT INTO messages_unified (
  context_type, project_id, client_id, thread_id,
  sender_type, sender_name, subject, message, message_type,
  priority, status, reply_to, parent_message_id, attachments,
  is_internal, read_at, edited_at, deleted_at, deleted_by,
  created_at, updated_at, reaction_count, reply_count, mention_count
)
SELECT
  'general',
  (SELECT project_id FROM message_threads WHERE message_threads.id = general_messages.thread_id),
  client_id,
  thread_id,
  sender_type,
  sender_name,
  subject,
  message,
  COALESCE(message_type, 'text'),
  COALESCE(priority, 'normal'),
  COALESCE(status, 'new'),
  reply_to,
  parent_message_id,
  attachments,
  COALESCE(is_internal, FALSE),
  read_at,
  edited_at,
  deleted_at,
  deleted_by,
  created_at,
  COALESCE(updated_at, created_at),
  COALESCE(reaction_count, 0),
  COALESCE(reply_count, 0),
  COALESCE(mention_count, 0)
FROM general_messages;

-- =====================================================
-- SECTION 4: Create ID mapping table for FK updates
-- =====================================================
-- This maps old general_messages IDs to new messages_unified IDs

CREATE TABLE _message_id_mapping (
  old_id INTEGER PRIMARY KEY,
  new_id INTEGER NOT NULL
);

-- Record the mapping (general_messages id -> messages_unified id)
-- We need to match by unique combination of fields since IDs will differ
INSERT INTO _message_id_mapping (old_id, new_id)
SELECT
  gm.id as old_id,
  mu.id as new_id
FROM general_messages gm
JOIN messages_unified mu ON
  mu.context_type = 'general' AND
  mu.thread_id = gm.thread_id AND
  mu.message = gm.message AND
  mu.created_at = gm.created_at;

-- =====================================================
-- SECTION 5: Update FK references in supporting tables
-- =====================================================

-- Update message_mentions
UPDATE message_mentions
SET message_id = (
  SELECT new_id FROM _message_id_mapping WHERE old_id = message_mentions.message_id
)
WHERE EXISTS (
  SELECT 1 FROM _message_id_mapping WHERE old_id = message_mentions.message_id
);

-- Update message_reactions
UPDATE message_reactions
SET message_id = (
  SELECT new_id FROM _message_id_mapping WHERE old_id = message_reactions.message_id
)
WHERE EXISTS (
  SELECT 1 FROM _message_id_mapping WHERE old_id = message_reactions.message_id
);

-- Update message_read_receipts
UPDATE message_read_receipts
SET message_id = (
  SELECT new_id FROM _message_id_mapping WHERE old_id = message_read_receipts.message_id
)
WHERE EXISTS (
  SELECT 1 FROM _message_id_mapping WHERE old_id = message_read_receipts.message_id
);

-- Update pinned_messages
UPDATE pinned_messages
SET message_id = (
  SELECT new_id FROM _message_id_mapping WHERE old_id = pinned_messages.message_id
)
WHERE EXISTS (
  SELECT 1 FROM _message_id_mapping WHERE old_id = pinned_messages.message_id
);

-- =====================================================
-- SECTION 6: Swap tables
-- =====================================================

-- Rename old tables for safety (keep for 30 days)
ALTER TABLE messages RENAME TO _messages_deprecated_085;
ALTER TABLE general_messages RENAME TO _general_messages_deprecated_085;

-- Rename new table to messages
ALTER TABLE messages_unified RENAME TO messages;

-- Drop mapping table
DROP TABLE _message_id_mapping;

-- =====================================================
-- SECTION 7: Create indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_messages_context ON messages(context_type);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(deleted_at);
CREATE INDEX IF NOT EXISTS idx_messages_internal ON messages(is_internal);
CREATE INDEX IF NOT EXISTS idx_messages_context_project ON messages(context_type, project_id);
CREATE INDEX IF NOT EXISTS idx_messages_context_thread ON messages(context_type, thread_id);

-- =====================================================
-- Migration Notes
-- =====================================================
--
-- After this migration:
-- 1. All message queries should use `messages` table with context_type filter
-- 2. Project messages: WHERE context_type = 'project' AND project_id = ?
-- 3. General messages: WHERE context_type = 'general' AND thread_id = ?
-- 4. sender_type now consistently uses 'admin' instead of 'developer'
-- 5. Old tables kept as _messages_deprecated_085 and _general_messages_deprecated_085
--    - DROP these after 30 days: 2026-03-14
--
-- Code changes needed:
-- 1. message-service.ts: Update all queries from general_messages to messages
-- 2. routes/messages.ts: Update to use unified table
-- 3. routes/projects/messages.ts: Update to use unified table with context_type
-- =====================================================

-- DOWN

-- Restore from backup if needed - this migration is complex to reverse
-- The deprecated tables are preserved for rollback:
-- ALTER TABLE _messages_deprecated_085 RENAME TO messages;
-- ALTER TABLE _general_messages_deprecated_085 RENAME TO general_messages;
-- DROP TABLE messages; (the unified one)
