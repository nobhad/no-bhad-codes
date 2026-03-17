-- =====================================================
-- Migration 124: Custom Automations Engine
-- =====================================================
-- Flexible event-driven automation system for triggering
-- configurable action chains on system events.
-- =====================================================

-- ===============================================
-- CUSTOM AUTOMATIONS TABLE
-- ===============================================
CREATE TABLE IF NOT EXISTS custom_automations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  trigger_event TEXT NOT NULL,
  trigger_conditions TEXT DEFAULT '{}',
  stop_on_error INTEGER NOT NULL DEFAULT 0,
  max_runs_per_entity INTEGER DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_custom_automations_event ON custom_automations(trigger_event, is_active);

-- ===============================================
-- AUTOMATION ACTIONS TABLE
-- ===============================================
CREATE TABLE IF NOT EXISTS automation_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id INTEGER NOT NULL,
  action_order INTEGER NOT NULL,
  action_type TEXT NOT NULL CHECK(action_type IN (
    'send_email', 'create_task', 'update_status', 'send_notification',
    'wait', 'enroll_sequence', 'create_invoice', 'assign_questionnaire',
    'webhook', 'add_tag', 'add_note'
  )),
  action_config TEXT NOT NULL DEFAULT '{}',
  condition TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (automation_id) REFERENCES custom_automations(id) ON DELETE CASCADE
);
CREATE INDEX idx_automation_actions_automation ON automation_actions(automation_id, action_order);

-- ===============================================
-- AUTOMATION RUNS TABLE
-- ===============================================
CREATE TABLE IF NOT EXISTS automation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id INTEGER NOT NULL,
  trigger_event TEXT NOT NULL,
  trigger_entity_type TEXT,
  trigger_entity_id INTEGER,
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed', 'waiting')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  error_message TEXT,
  FOREIGN KEY (automation_id) REFERENCES custom_automations(id)
);
CREATE INDEX idx_automation_runs_automation ON automation_runs(automation_id);
CREATE INDEX idx_automation_runs_status ON automation_runs(status);

-- ===============================================
-- AUTOMATION ACTION LOGS TABLE
-- ===============================================
CREATE TABLE IF NOT EXISTS automation_action_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  action_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'executed', 'failed', 'skipped', 'waiting')),
  executed_at TEXT,
  result TEXT,
  error_message TEXT,
  FOREIGN KEY (run_id) REFERENCES automation_runs(id),
  FOREIGN KEY (action_id) REFERENCES automation_actions(id)
);

-- ===============================================
-- AUTOMATION SCHEDULED ACTIONS TABLE
-- ===============================================
CREATE TABLE IF NOT EXISTS automation_scheduled_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  action_id INTEGER NOT NULL,
  execute_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'executed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES automation_runs(id),
  FOREIGN KEY (action_id) REFERENCES automation_actions(id)
);
CREATE INDEX idx_scheduled_actions_execute ON automation_scheduled_actions(status, execute_at);

-- ===============================================
-- SEED: Pre-built Automation Templates
-- ===============================================

-- Template 1: New Project Setup
INSERT INTO custom_automations (id, name, description, is_active, trigger_event, trigger_conditions, stop_on_error)
VALUES (
  1,
  'New Project Setup',
  'Automatically sends a welcome email, creates a kickoff task, and notifies the admin when a new project is created.',
  0,
  'project.created',
  '{}',
  0
);

INSERT INTO automation_actions (automation_id, action_order, action_type, action_config) VALUES
(1, 1, 'send_email', '{"to":"{{client_email}}","subject":"Welcome to your new project: {{project_name}}","body":"Hi {{client_name}},\n\nYour project \"{{project_name}}\" has been created. We will be in touch shortly with next steps.\n\nBest regards"}'),
(1, 2, 'create_task', '{"title":"Kickoff meeting for {{project_name}}","description":"Schedule and conduct kickoff meeting with {{client_name}}","dueDaysFromNow":2,"assignTo":"admin"}'),
(1, 3, 'send_notification', '{"to":"admin","subject":"New project created: {{project_name}}","body":"A new project \"{{project_name}}\" has been created for client {{client_name}} ({{client_email}})."}');

-- Template 2: Invoice Follow-Up
INSERT INTO custom_automations (id, name, description, is_active, trigger_event, trigger_conditions, stop_on_error)
VALUES (
  2,
  'Invoice Follow-Up',
  'Sends a reminder email to the client when an invoice becomes overdue, waits 3 days, then notifies the admin.',
  0,
  'invoice.overdue',
  '{}',
  0
);

INSERT INTO automation_actions (automation_id, action_order, action_type, action_config) VALUES
(2, 1, 'send_email', '{"to":"{{client_email}}","subject":"Reminder: Invoice #{{invoice_number}} is overdue","body":"Hi {{client_name}},\n\nThis is a friendly reminder that invoice #{{invoice_number}} for {{invoice_amount}} is now overdue. Please arrange payment at your earliest convenience.\n\nThank you"}'),
(2, 2, 'wait', '{"delayDays":3}'),
(2, 3, 'send_notification', '{"to":"admin","subject":"Overdue invoice alert: #{{invoice_number}}","body":"Invoice #{{invoice_number}} for client {{client_name}} ({{client_email}}) totaling {{invoice_amount}} is still overdue after the initial reminder was sent 3 days ago."}');
