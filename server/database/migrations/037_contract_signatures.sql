-- =====================================================
-- Migration 037: Contract E-Signature System
-- =====================================================
-- Adds columns and tables for contract signature tracking
-- =====================================================

-- Add signature columns to projects table
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

-- Create contract signature audit log table
CREATE TABLE IF NOT EXISTS contract_signature_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'requested', 'viewed', 'signed', 'expired', 'reminder_sent'
  actor_email TEXT,
  actor_ip TEXT,
  actor_user_agent TEXT,
  details TEXT, -- JSON for additional context
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contract_signature_log_project
ON contract_signature_log(project_id);

CREATE INDEX IF NOT EXISTS idx_contract_signature_log_action
ON contract_signature_log(action);
