-- =====================================================
-- Migration 054: Contract Countersign + Signed PDF Storage
-- =====================================================

-- UP

ALTER TABLE projects ADD COLUMN contract_countersigned_at DATETIME;
ALTER TABLE projects ADD COLUMN contract_countersigner_name TEXT;
ALTER TABLE projects ADD COLUMN contract_countersigner_email TEXT;
ALTER TABLE projects ADD COLUMN contract_countersigner_ip TEXT;
ALTER TABLE projects ADD COLUMN contract_countersigner_user_agent TEXT;
ALTER TABLE projects ADD COLUMN contract_countersignature_data TEXT;
ALTER TABLE projects ADD COLUMN contract_signed_pdf_path TEXT;

ALTER TABLE contracts ADD COLUMN signer_name TEXT;
ALTER TABLE contracts ADD COLUMN signer_email TEXT;
ALTER TABLE contracts ADD COLUMN signer_ip TEXT;
ALTER TABLE contracts ADD COLUMN signer_user_agent TEXT;
ALTER TABLE contracts ADD COLUMN signature_data TEXT;
ALTER TABLE contracts ADD COLUMN countersigned_at DATETIME;
ALTER TABLE contracts ADD COLUMN countersigner_name TEXT;
ALTER TABLE contracts ADD COLUMN countersigner_email TEXT;
ALTER TABLE contracts ADD COLUMN countersigner_ip TEXT;
ALTER TABLE contracts ADD COLUMN countersigner_user_agent TEXT;
ALTER TABLE contracts ADD COLUMN countersignature_data TEXT;
ALTER TABLE contracts ADD COLUMN signed_pdf_path TEXT;

-- DOWN

-- SQLite does not support DROP COLUMN reliably; no rollback for added columns.
