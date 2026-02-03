-- =====================================================
-- Migration 042: Workflow Triggers
-- =====================================================
-- Event-driven automation system for triggering actions
-- based on system events (invoice created, contract signed, etc.)
-- =====================================================

-- ===============================================
-- WORKFLOW TRIGGER DEFINITIONS
-- ===============================================
-- Defines what events trigger what actions
CREATE TABLE IF NOT EXISTS workflow_triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL,  -- 'invoice.created', 'contract.signed', 'project.status_changed', etc.
  conditions JSON,           -- Optional conditions: {"status": "approved", "amount_gt": 1000}
  action_type TEXT NOT NULL, -- 'send_email', 'create_task', 'update_status', 'webhook', 'notify'
  action_config JSON NOT NULL, -- Action-specific config
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0, -- Higher = runs first
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- WORKFLOW TRIGGER LOGS
-- ===============================================
-- Audit log of trigger executions
CREATE TABLE IF NOT EXISTS workflow_trigger_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSON,
  action_result TEXT,  -- 'success', 'failed', 'skipped'
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trigger_id) REFERENCES workflow_triggers(id) ON DELETE CASCADE
);

-- ===============================================
-- SYSTEM EVENTS LOG
-- ===============================================
-- Log all system events for debugging and replay
CREATE TABLE IF NOT EXISTS system_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  entity_type TEXT,       -- 'invoice', 'project', 'client', 'contract', etc.
  entity_id INTEGER,
  event_data JSON,
  triggered_by TEXT,      -- User email or 'system'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- PERFORMANCE INDEXES
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_event ON workflow_triggers(event_type, is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_trigger_logs_trigger ON workflow_trigger_logs(trigger_id);
CREATE INDEX IF NOT EXISTS idx_workflow_trigger_logs_date ON workflow_trigger_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_entity ON system_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_system_events_date ON system_events(created_at);

-- ===============================================
-- SEED DEFAULT WORKFLOW TRIGGERS
-- ===============================================
INSERT OR IGNORE INTO workflow_triggers (id, name, description, event_type, action_type, action_config, is_active) VALUES
-- Invoice triggers
(1, 'Invoice Created Notification', 'Notify admin when invoice is created', 'invoice.created', 'notify', '{"channel": "admin", "message": "New invoice created: {{invoice.number}}"}', TRUE),
(2, 'Invoice Paid Celebration', 'Send thank you when invoice is paid', 'invoice.paid', 'send_email', '{"template": "payment_received", "to": "client"}', TRUE),

-- Contract triggers
(3, 'Contract Signed Notification', 'Notify admin when contract is signed', 'contract.signed', 'notify', '{"channel": "admin", "message": "Contract signed for project: {{project.name}}"}', TRUE),
(4, 'Contract Signed Update Project', 'Update project status when contract signed', 'contract.signed', 'update_status', '{"entity": "project", "status": "active"}', TRUE),

-- Project triggers
(5, 'Project Completed Notification', 'Notify client when project is completed', 'project.completed', 'send_email', '{"template": "project_completed", "to": "client"}', TRUE),

-- Client triggers
(6, 'New Client Welcome', 'Send welcome email to new clients', 'client.created', 'send_email', '{"template": "welcome", "to": "client"}', FALSE),

-- Message triggers
(7, 'New Message Notification', 'Notify recipient of new message', 'message.created', 'notify', '{"channel": "recipient", "message": "New message: {{message.preview}}"}', TRUE);
