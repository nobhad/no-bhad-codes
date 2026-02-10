-- =====================================================
-- Migration 052: Contract Templates + Contracts
-- =====================================================
-- Adds tables for contract templates and generated contracts
-- =====================================================

-- UP

CREATE TABLE IF NOT EXISTS contract_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'standard', 'custom', 'amendment', 'nda', 'maintenance'
  content TEXT NOT NULL,
  variables JSON, -- JSON array of allowed variables
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER REFERENCES contract_templates(id),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'viewed', 'signed', 'expired', 'cancelled'
  variables JSON, -- JSON snapshot of resolved variables
  sent_at DATETIME,
  signed_at DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contract_templates_type ON contract_templates(type);
CREATE INDEX IF NOT EXISTS idx_contract_templates_active ON contract_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_contracts_project ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- DOWN

DROP INDEX IF EXISTS idx_contracts_status;
DROP INDEX IF EXISTS idx_contracts_client;
DROP INDEX IF EXISTS idx_contracts_project;

DROP INDEX IF EXISTS idx_contract_templates_active;
DROP INDEX IF EXISTS idx_contract_templates_type;

DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS contract_templates;
