-- =====================================================
-- Migration 040: Deliverable Workflows
-- =====================================================
-- Adds workflow tracking for deliverables (Draft -> Review -> Approved)
-- =====================================================

-- ===============================================
-- DELIVERABLE WORKFLOWS TABLE
-- ===============================================
-- Tracks the approval workflow for deliverable files
CREATE TABLE IF NOT EXISTS deliverable_workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  status TEXT DEFAULT 'draft',  -- 'draft', 'pending_review', 'in_review', 'changes_requested', 'approved', 'rejected'
  version INTEGER DEFAULT 1,
  submitted_at DATETIME,
  submitted_by TEXT,
  reviewed_at DATETIME,
  reviewed_by TEXT,
  approved_at DATETIME,
  approved_by TEXT,
  rejection_reason TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ===============================================
-- DELIVERABLE REVIEW COMMENTS
-- ===============================================
-- Comments during the review process
CREATE TABLE IF NOT EXISTS deliverable_review_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL,
  author_email TEXT NOT NULL,
  author_name TEXT,
  author_type TEXT NOT NULL,  -- 'admin', 'client'
  comment TEXT NOT NULL,
  comment_type TEXT DEFAULT 'feedback',  -- 'feedback', 'approval', 'rejection', 'revision_request'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES deliverable_workflows(id) ON DELETE CASCADE
);

-- ===============================================
-- DELIVERABLE HISTORY
-- ===============================================
-- Tracks status changes for audit trail
CREATE TABLE IF NOT EXISTS deliverable_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES deliverable_workflows(id) ON DELETE CASCADE
);

-- ===============================================
-- PERFORMANCE INDEXES
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_deliverable_workflows_file ON deliverable_workflows(file_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_workflows_project ON deliverable_workflows(project_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_workflows_status ON deliverable_workflows(status);
CREATE INDEX IF NOT EXISTS idx_deliverable_review_comments_workflow ON deliverable_review_comments(workflow_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_history_workflow ON deliverable_history(workflow_id);
