-- =====================================================
-- Migration 074: Contract Signature Consolidation
-- =====================================================
-- Phase 3.3 of Database Normalization
--
-- Purpose: Add signature tracking columns to contracts table
-- and migrate existing signature data from projects.
--
-- Note: Only migrates columns that actually exist in projects table:
--   - contract_signed_at
--   - contract_countersigned_at, contract_countersigner_*
--   - contract_signed_pdf_path
--
-- Date: 2026-02-10

-- UP

-- =====================================================
-- SECTION 1: Add missing columns to contracts table
-- =====================================================

-- Signature request tracking (new columns for future use)
ALTER TABLE contracts ADD COLUMN signature_token TEXT;
ALTER TABLE contracts ADD COLUMN signature_requested_at DATETIME;
ALTER TABLE contracts ADD COLUMN signature_expires_at DATETIME;

-- =====================================================
-- SECTION 2: Create index for token lookups
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_contracts_signature_token
ON contracts(signature_token) WHERE signature_token IS NOT NULL;

-- =====================================================
-- SECTION 3: Migrate signature data from projects to contracts
-- =====================================================
-- Only migrate columns that exist in the projects table

-- Update signed_at from projects.contract_signed_at
UPDATE contracts
SET signed_at = COALESCE(
  signed_at,
  (SELECT p.contract_signed_at
   FROM projects p
   WHERE p.id = contracts.project_id
   AND p.contract_signed_at IS NOT NULL)
)
WHERE EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = contracts.project_id
  AND p.contract_signed_at IS NOT NULL
);

-- Update countersigner info from projects
UPDATE contracts
SET
  countersigned_at = COALESCE(countersigned_at,
    (SELECT p.contract_countersigned_at FROM projects p WHERE p.id = contracts.project_id)),
  countersigner_name = COALESCE(countersigner_name,
    (SELECT p.contract_countersigner_name FROM projects p WHERE p.id = contracts.project_id)),
  countersigner_email = COALESCE(countersigner_email,
    (SELECT p.contract_countersigner_email FROM projects p WHERE p.id = contracts.project_id)),
  countersigner_ip = COALESCE(countersigner_ip,
    (SELECT p.contract_countersigner_ip FROM projects p WHERE p.id = contracts.project_id)),
  countersigner_user_agent = COALESCE(countersigner_user_agent,
    (SELECT p.contract_countersigner_user_agent FROM projects p WHERE p.id = contracts.project_id)),
  countersignature_data = COALESCE(countersignature_data,
    (SELECT p.contract_countersignature_data FROM projects p WHERE p.id = contracts.project_id)),
  signed_pdf_path = COALESCE(signed_pdf_path,
    (SELECT p.contract_signed_pdf_path FROM projects p WHERE p.id = contracts.project_id))
WHERE EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = contracts.project_id
  AND (p.contract_countersigned_at IS NOT NULL OR p.contract_signed_pdf_path IS NOT NULL)
);

-- Update contract status based on signature state
UPDATE contracts
SET status = 'signed'
WHERE signed_at IS NOT NULL
AND status NOT IN ('signed', 'expired', 'cancelled');

-- =====================================================
-- SECTION 4: Add contract_id to signature log
-- =====================================================

ALTER TABLE contract_signature_log ADD COLUMN contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contract_signature_log_contract
ON contract_signature_log(contract_id);

-- Populate contract_id for existing log entries
UPDATE contract_signature_log
SET contract_id = (
  SELECT c.id
  FROM contracts c
  WHERE c.project_id = contract_signature_log.project_id
  ORDER BY c.created_at DESC
  LIMIT 1
)
WHERE contract_id IS NULL;

-- DOWN

DROP INDEX IF EXISTS idx_contract_signature_log_contract;
DROP INDEX IF EXISTS idx_contracts_signature_token;
