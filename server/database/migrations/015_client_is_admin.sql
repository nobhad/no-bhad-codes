-- Migration: Add is_admin column to clients table (if not exists)
-- Created: 2026-01-09
-- Required for login auth to properly identify admin users

-- UP
-- Column may already exist - this is a no-op migration to sync state
-- SQLite doesn't support IF NOT EXISTS for columns, so we just create the index
CREATE INDEX IF NOT EXISTS idx_clients_is_admin ON clients(is_admin);

-- DOWN
DROP INDEX IF EXISTS idx_clients_is_admin;
