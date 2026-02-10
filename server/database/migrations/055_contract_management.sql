-- =====================================================
-- Migration 055: Contract Management Enhancements
-- =====================================================

-- UP

ALTER TABLE contracts ADD COLUMN parent_contract_id INTEGER REFERENCES contracts(id);
ALTER TABLE contracts ADD COLUMN renewal_at DATETIME;
ALTER TABLE contracts ADD COLUMN renewal_reminder_sent_at DATETIME;
ALTER TABLE contracts ADD COLUMN last_reminder_at DATETIME;
ALTER TABLE contracts ADD COLUMN reminder_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_contracts_parent ON contracts(parent_contract_id);
CREATE INDEX IF NOT EXISTS idx_contracts_renewal_at ON contracts(renewal_at);

-- DOWN

-- SQLite does not support DROP COLUMN reliably; no rollback for added columns.
