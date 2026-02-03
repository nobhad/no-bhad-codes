-- =====================================================
-- Migration 041: Approval Workflows
-- =====================================================
-- Generic approval workflow system for any entity
-- Supports sequential and parallel approval patterns
-- =====================================================

-- ===============================================
-- APPROVAL WORKFLOW DEFINITIONS
-- ===============================================
-- Defines reusable approval workflow templates
CREATE TABLE IF NOT EXISTS approval_workflow_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL,  -- 'proposal', 'invoice', 'contract', 'deliverable', 'project'
  workflow_type TEXT DEFAULT 'sequential',  -- 'sequential', 'parallel', 'any_one'
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- APPROVAL WORKFLOW STEPS
-- ===============================================
-- Defines the steps/approvers in a workflow
CREATE TABLE IF NOT EXISTS approval_workflow_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_definition_id INTEGER NOT NULL,
  step_order INTEGER NOT NULL,
  approver_type TEXT NOT NULL,  -- 'user', 'role', 'client'
  approver_value TEXT NOT NULL,  -- email, role name, or 'owner'
  is_optional BOOLEAN DEFAULT FALSE,
  auto_approve_after_hours INTEGER,  -- Auto-approve if no response
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_definition_id) REFERENCES approval_workflow_definitions(id) ON DELETE CASCADE,
  UNIQUE(workflow_definition_id, step_order)
);

-- ===============================================
-- APPROVAL WORKFLOW INSTANCES
-- ===============================================
-- Active approval workflow for a specific entity
CREATE TABLE IF NOT EXISTS approval_workflow_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_definition_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',  -- 'pending', 'in_progress', 'approved', 'rejected', 'cancelled'
  current_step INTEGER DEFAULT 1,
  initiated_by TEXT NOT NULL,
  initiated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  notes TEXT,
  FOREIGN KEY (workflow_definition_id) REFERENCES approval_workflow_definitions(id) ON DELETE CASCADE
);

-- ===============================================
-- APPROVAL REQUESTS
-- ===============================================
-- Individual approval requests to approvers
CREATE TABLE IF NOT EXISTS approval_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_instance_id INTEGER NOT NULL,
  step_id INTEGER NOT NULL,
  approver_email TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'skipped'
  decision_at DATETIME,
  decision_comment TEXT,
  reminder_sent_at DATETIME,
  reminder_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_instance_id) REFERENCES approval_workflow_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES approval_workflow_steps(id) ON DELETE CASCADE
);

-- ===============================================
-- APPROVAL HISTORY
-- ===============================================
-- Audit trail of all approval actions
CREATE TABLE IF NOT EXISTS approval_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_instance_id INTEGER NOT NULL,
  action TEXT NOT NULL,  -- 'initiated', 'approved', 'rejected', 'skipped', 'cancelled', 'auto_approved'
  actor_email TEXT NOT NULL,
  step_id INTEGER,
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_instance_id) REFERENCES approval_workflow_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES approval_workflow_steps(id) ON DELETE SET NULL
);

-- ===============================================
-- PERFORMANCE INDEXES
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_approval_definitions_entity ON approval_workflow_definitions(entity_type);
CREATE INDEX IF NOT EXISTS idx_approval_definitions_active ON approval_workflow_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_approval_steps_definition ON approval_workflow_steps(workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_approval_instances_entity ON approval_workflow_instances(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_instances_status ON approval_workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_instance ON approval_requests(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_approver ON approval_requests(approver_email, status);
CREATE INDEX IF NOT EXISTS idx_approval_history_instance ON approval_history(workflow_instance_id);

-- ===============================================
-- SEED DEFAULT APPROVAL WORKFLOWS
-- ===============================================
INSERT OR IGNORE INTO approval_workflow_definitions (id, name, description, entity_type, workflow_type, is_default) VALUES
(1, 'Standard Proposal Approval', 'Single admin approval for proposals', 'proposal', 'any_one', TRUE),
(2, 'Standard Contract Approval', 'Single admin approval for contracts', 'contract', 'any_one', TRUE),
(3, 'Invoice Approval', 'Admin approval before sending invoice', 'invoice', 'any_one', TRUE),
(4, 'Two-Step Approval', 'Sequential approval by two admins', 'proposal', 'sequential', FALSE);

-- Seed steps for default workflows
INSERT OR IGNORE INTO approval_workflow_steps (id, workflow_definition_id, step_order, approver_type, approver_value) VALUES
(1, 1, 1, 'role', 'admin'),
(2, 2, 1, 'role', 'admin'),
(3, 3, 1, 'role', 'admin'),
(4, 4, 1, 'role', 'admin'),
(5, 4, 2, 'role', 'admin');
