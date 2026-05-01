-- =====================================================
-- Migration 037: Contract E-Signature System
-- =====================================================
-- Adds columns and tables for contract signature tracking
-- =====================================================

-- Note: signature columns on projects (contract_signature_token, etc.) are
-- added in migration 087_add_project_signature_columns.sql. The original
-- ALTER statements here were commented out under the (incorrect) assumption
-- those columns already existed; the index that referenced them has moved
-- to 087 alongside the column creation so this migration runs cleanly on
-- fresh databases.

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
