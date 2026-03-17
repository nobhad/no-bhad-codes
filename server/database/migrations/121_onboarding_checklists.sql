-- Migration 121: Onboarding Checklists
-- Post-agreement onboarding with auto-complete from workflow events

CREATE TABLE IF NOT EXISTS onboarding_checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  welcome_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  dismissed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX idx_onboarding_checklists_project ON onboarding_checklists(project_id);
CREATE INDEX idx_onboarding_checklists_client ON onboarding_checklists(client_id);
CREATE INDEX idx_onboarding_checklists_status ON onboarding_checklists(status);

CREATE TABLE IF NOT EXISTS onboarding_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  step_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  entity_type TEXT,
  entity_id INTEGER,
  auto_detect INTEGER NOT NULL DEFAULT 0,
  navigate_tab TEXT,
  navigate_entity_id INTEGER,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (checklist_id) REFERENCES onboarding_checklists(id) ON DELETE CASCADE
);

CREATE INDEX idx_onboarding_steps_checklist ON onboarding_steps(checklist_id);
CREATE INDEX idx_onboarding_steps_status ON onboarding_steps(status);
CREATE INDEX idx_onboarding_steps_entity ON onboarding_steps(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS onboarding_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  project_type TEXT,
  steps_config TEXT NOT NULL DEFAULT '[]',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default templates
INSERT INTO onboarding_templates (name, project_type, steps_config, is_default) VALUES
('Standard Website', 'website', '[{"step_type":"review_proposal","label":"Review Your Proposal","description":"Review the project scope and pricing","auto_detect":true,"entity_type":"proposal","navigate_tab":"proposals"},{"step_type":"sign_contract","label":"Sign Your Contract","description":"Review and sign the project contract","auto_detect":true,"entity_type":"contract","navigate_tab":"contracts"},{"step_type":"pay_deposit","label":"Pay Deposit","description":"Submit your initial deposit payment","auto_detect":true,"entity_type":"invoice","navigate_tab":"documents"},{"step_type":"complete_questionnaire","label":"Complete Project Questionnaire","description":"Tell us about your vision and requirements","auto_detect":true,"entity_type":"questionnaire","navigate_tab":"requests-hub"},{"step_type":"upload_assets","label":"Upload Brand Assets","description":"Share your logo, brand colors, and any reference materials","navigate_tab":"files"}]', 1),
('Simple Project', NULL, '[{"step_type":"sign_contract","label":"Sign Your Contract","description":"Review and sign the project contract","auto_detect":true,"entity_type":"contract","navigate_tab":"contracts"},{"step_type":"pay_deposit","label":"Pay Deposit","description":"Submit your initial deposit payment","auto_detect":true,"entity_type":"invoice","navigate_tab":"documents"},{"step_type":"complete_questionnaire","label":"Complete Questionnaire","description":"Help us understand your needs","auto_detect":true,"entity_type":"questionnaire","navigate_tab":"requests-hub"}]', 0);
