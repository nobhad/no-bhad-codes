-- Migration: Fix general_messages thread_id column
-- Created: 2025-12-03

-- Up
ALTER TABLE general_messages ADD COLUMN thread_id INTEGER DEFAULT NULL REFERENCES message_threads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_general_messages_thread_id ON general_messages(thread_id);

-- Down
DROP INDEX IF EXISTS idx_general_messages_thread_id;
