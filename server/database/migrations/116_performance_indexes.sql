-- =====================================================
-- Migration 116: Performance Indexes for Missing Columns
-- =====================================================
-- Created: 2026-03-16
--
-- Purpose: Add remaining missing indexes on commonly queried columns
-- that were not covered by previous index migrations (001, 031, 047,
-- 051, 052, 070, 072, 073, 075, 079, 082, 084, 089, 094, 098, 107).
--
-- All statements use IF NOT EXISTS for idempotency.
-- =====================================================

-- UP

-- projects.deleted_at: Frequently filtered in soft-delete views/queries
-- Existing: idx_projects_client_id, idx_projects_status (001),
--           idx_projects_client_status (051), idx_projects_created (098)
-- Missing: deleted_at (used in active_projects view and WHERE deleted_at IS NULL)

CREATE INDEX IF NOT EXISTS idx_projects_deleted_at
  ON projects(deleted_at);

-- messages.created_at: Frequently sorted/filtered in conversation views
-- Existing: idx_messages_project_id (001)
-- Missing: created_at (used in ORDER BY created_at DESC)

CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON messages(created_at);

-- DOWN

DROP INDEX IF EXISTS idx_messages_created_at;
DROP INDEX IF EXISTS idx_projects_deleted_at;
