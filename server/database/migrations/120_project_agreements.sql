-- Migration 120: Project Agreements
-- Unified agreement flow: proposal review + contract signing + deposit payment in one flow

CREATE TABLE IF NOT EXISTS project_agreements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT 'Project Agreement',
  status TEXT NOT NULL DEFAULT 'draft',
  proposal_id INTEGER,
  contract_id INTEGER,
  questionnaire_id INTEGER,
  steps_config TEXT,
  welcome_message TEXT,
  current_step INTEGER DEFAULT 0,
  sent_at TEXT,
  viewed_at TEXT,
  completed_at TEXT,
  expires_at TEXT,
  reminder_sent_3d INTEGER NOT NULL DEFAULT 0,
  reminder_sent_7d INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id) ON DELETE SET NULL,
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL
);

CREATE INDEX idx_project_agreements_project ON project_agreements(project_id);
CREATE INDEX idx_project_agreements_client ON project_agreements(client_id);
CREATE INDEX idx_project_agreements_status ON project_agreements(status);

CREATE TABLE IF NOT EXISTS agreement_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agreement_id INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  entity_id INTEGER,
  custom_title TEXT,
  custom_content TEXT,
  started_at TEXT,
  completed_at TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agreement_id) REFERENCES project_agreements(id) ON DELETE CASCADE
);

CREATE INDEX idx_agreement_steps_agreement ON agreement_steps(agreement_id);
CREATE INDEX idx_agreement_steps_type ON agreement_steps(step_type);
CREATE INDEX idx_agreement_steps_status ON agreement_steps(status);
