-- =====================================================
-- Migration 087: Add Contract Signature Columns to Projects
-- =====================================================
-- These columns were assumed to exist in migration 037 but were never
-- added. They are used by the contracts API for dual-write pattern
-- (writing to both projects and contracts tables).
--
-- Date: 2026-02-13

-- UP

-- Add signature tracking columns to projects table
-- Using CREATE TABLE trick to check if column exists (SQLite limitation)
-- If column already exists, the ALTER TABLE will fail silently

-- Add contract_signature_token if not exists
CREATE TABLE IF NOT EXISTS _migration_check (id INTEGER);
DROP TABLE IF EXISTS _migration_check;

-- Note: SQLite doesn't have IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- These will fail silently if columns already exist (caught in migration runner)

ALTER TABLE projects ADD COLUMN contract_signature_token TEXT;
ALTER TABLE projects ADD COLUMN contract_signature_requested_at TEXT;
ALTER TABLE projects ADD COLUMN contract_signature_expires_at TEXT;
ALTER TABLE projects ADD COLUMN contract_signer_name TEXT;
ALTER TABLE projects ADD COLUMN contract_signer_email TEXT;
ALTER TABLE projects ADD COLUMN contract_signer_ip TEXT;
ALTER TABLE projects ADD COLUMN contract_signer_user_agent TEXT;
ALTER TABLE projects ADD COLUMN contract_signature_data TEXT;

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_projects_contract_signature_token
ON projects(contract_signature_token) WHERE contract_signature_token IS NOT NULL;

-- DOWN

-- Note: SQLite doesn't support DROP COLUMN easily
-- Would need to recreate table to drop columns
DROP INDEX IF EXISTS idx_projects_contract_signature_token;
