-- =====================================================
-- Migration 088: Add contract_reminders_enabled to projects
-- =====================================================
-- This column was referenced in migration 038 but never added.
-- Used by the scheduler service to control contract reminder emails.
--
-- Date: 2026-02-13

-- UP

-- Add contract_reminders_enabled column if it doesn't exist
ALTER TABLE projects ADD COLUMN contract_reminders_enabled BOOLEAN DEFAULT TRUE;

-- DOWN

-- Note: SQLite doesn't support DROP COLUMN easily
-- Would need to recreate table to remove column
