-- Migration: 070_remove_text_user_columns.sql
-- Description: Remove redundant TEXT user columns, keep INTEGER FK columns
-- Date: 2026-02-10
-- Phase: 2.6 of Database Normalization
--
-- PREREQUISITE: Migration 068 must have run (creates users table and user_id columns)
--
-- SQLite doesn't support DROP COLUMN, so we recreate affected tables.
-- Only dropping columns from tables that have data or are actively used.

-- =====================================================
-- STEP 1: Fix unmatched 'admin' and 'system' values
-- =====================================================

-- Map 'admin' author to admin user
UPDATE project_updates
SET author_user_id = 2
WHERE author = 'admin' AND author_user_id IS NULL;

-- Map 'system' author to system user
UPDATE project_updates
SET author_user_id = 1
WHERE author = 'system' AND author_user_id IS NULL;

-- Same for other tables that might have 'admin' or 'system'
UPDATE task_comments SET author_user_id = 2 WHERE author = 'admin' AND author_user_id IS NULL;
UPDATE task_comments SET author_user_id = 1 WHERE author = 'system' AND author_user_id IS NULL;

UPDATE client_notes SET author_user_id = 2 WHERE author = 'admin' AND author_user_id IS NULL;
UPDATE client_notes SET author_user_id = 1 WHERE author = 'system' AND author_user_id IS NULL;

UPDATE lead_notes SET author_user_id = 2 WHERE author = 'admin' AND author_user_id IS NULL;
UPDATE lead_notes SET author_user_id = 1 WHERE author = 'system' AND author_user_id IS NULL;

UPDATE client_activities SET created_by_user_id = 2 WHERE created_by = 'admin' AND created_by_user_id IS NULL;
UPDATE client_activities SET created_by_user_id = 1 WHERE created_by = 'system' AND created_by_user_id IS NULL;

-- =====================================================
-- STEP 2: Recreate project_updates without TEXT author
-- =====================================================

CREATE TABLE project_updates_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  update_type TEXT DEFAULT 'general',
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO project_updates_new (id, project_id, title, description, update_type, author_user_id, created_at)
SELECT id, project_id, title, description, update_type, author_user_id, created_at
FROM project_updates;

DROP TABLE project_updates;
ALTER TABLE project_updates_new RENAME TO project_updates;

CREATE INDEX idx_project_updates_project ON project_updates(project_id);
CREATE INDEX idx_project_updates_author ON project_updates(author_user_id);

-- =====================================================
-- STEP 3: Recreate task_comments without TEXT author
-- =====================================================

CREATE TABLE task_comments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO task_comments_new (id, task_id, author_user_id, content, created_at, updated_at)
SELECT id, task_id, author_user_id, content, created_at, updated_at
FROM task_comments;

DROP TABLE task_comments;
ALTER TABLE task_comments_new RENAME TO task_comments;

CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_task_comments_author ON task_comments(author_user_id);

-- =====================================================
-- STEP 4: Recreate client_notes without TEXT author
-- =====================================================

CREATE TABLE client_notes_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO client_notes_new (id, client_id, author_user_id, content, is_pinned, created_at, updated_at)
SELECT id, client_id, author_user_id, content, is_pinned, created_at, updated_at
FROM client_notes;

DROP TABLE client_notes;
ALTER TABLE client_notes_new RENAME TO client_notes;

CREATE INDEX idx_client_notes_client ON client_notes(client_id);
CREATE INDEX idx_client_notes_author ON client_notes(author_user_id);
CREATE INDEX idx_client_notes_pinned ON client_notes(is_pinned);

-- =====================================================
-- STEP 5: Recreate lead_notes without TEXT author
-- =====================================================

CREATE TABLE lead_notes_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO lead_notes_new (id, project_id, author_user_id, content, is_pinned, created_at, updated_at)
SELECT id, project_id, author_user_id, content, is_pinned, created_at, updated_at
FROM lead_notes;

DROP TABLE lead_notes;
ALTER TABLE lead_notes_new RENAME TO lead_notes;

CREATE INDEX idx_lead_notes_project ON lead_notes(project_id);
CREATE INDEX idx_lead_notes_author ON lead_notes(author_user_id);
CREATE INDEX idx_lead_notes_pinned ON lead_notes(is_pinned);

-- =====================================================
-- STEP 6: Recreate time_entries without TEXT user_name
-- =====================================================

CREATE TABLE time_entries_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES project_tasks(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  description TEXT,
  hours DECIMAL(5,2) NOT NULL,
  date DATE NOT NULL,
  billable BOOLEAN DEFAULT TRUE,
  hourly_rate DECIMAL(10,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO time_entries_new (id, project_id, task_id, user_id, description, hours, date, billable, hourly_rate, created_at, updated_at)
SELECT id, project_id, task_id, user_id, description, hours, date, billable, hourly_rate, created_at, updated_at
FROM time_entries;

DROP TABLE time_entries;
ALTER TABLE time_entries_new RENAME TO time_entries;

CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_task ON time_entries(task_id);
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_date ON time_entries(date);
CREATE INDEX idx_time_entries_project_date ON time_entries(project_id, date);

-- =====================================================
-- STEP 7: Update project_tasks - remove assigned_to TEXT
-- =====================================================

CREATE TABLE project_tasks_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  sort_order INTEGER DEFAULT 0,
  parent_task_id INTEGER REFERENCES project_tasks(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

INSERT INTO project_tasks_new (
  id, project_id, milestone_id, title, description, status, priority,
  assigned_to_user_id, due_date, estimated_hours, actual_hours, sort_order,
  parent_task_id, created_at, updated_at, completed_at
)
SELECT
  id, project_id, milestone_id, title, description, status, priority,
  assigned_to_user_id, due_date, estimated_hours, actual_hours, sort_order,
  parent_task_id, created_at, updated_at, completed_at
FROM project_tasks;

DROP TABLE project_tasks;
ALTER TABLE project_tasks_new RENAME TO project_tasks;

CREATE INDEX idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_milestone ON project_tasks(milestone_id);
CREATE INDEX idx_project_tasks_status ON project_tasks(status);
CREATE INDEX idx_project_tasks_assigned ON project_tasks(assigned_to_user_id);
CREATE INDEX idx_project_tasks_due ON project_tasks(due_date);
CREATE INDEX idx_project_tasks_parent ON project_tasks(parent_task_id);

-- =====================================================
-- STEP 8: Update lead_tasks - remove assigned_to TEXT
-- =====================================================

CREATE TABLE lead_tasks_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'follow_up',
  due_date DATE,
  due_time TIME,
  status TEXT DEFAULT 'pending',
  assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'medium',
  reminder_at DATETIME,
  completed_at DATETIME,
  completed_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO lead_tasks_new (
  id, project_id, title, description, task_type, due_date, due_time, status,
  assigned_to_user_id, priority, reminder_at, completed_at, completed_by, created_at, updated_at
)
SELECT
  id, project_id, title, description, task_type, due_date, due_time, status,
  assigned_to_user_id, priority, reminder_at, completed_at, completed_by, created_at, updated_at
FROM lead_tasks;

DROP TABLE lead_tasks;
ALTER TABLE lead_tasks_new RENAME TO lead_tasks;

CREATE INDEX idx_lead_tasks_project ON lead_tasks(project_id);
CREATE INDEX idx_lead_tasks_status ON lead_tasks(status);
CREATE INDEX idx_lead_tasks_assigned ON lead_tasks(assigned_to_user_id);
CREATE INDEX idx_lead_tasks_due ON lead_tasks(due_date, status);

-- =====================================================
-- NOTE: Other tables with user_id columns
-- =====================================================
-- The following tables also have TEXT columns that could be removed:
-- - document_requests (requested_by, uploaded_by, reviewed_by)
-- - file_comments (author_email)
-- - kb_articles (author_email)
-- - questionnaires (created_by)
-- - saved_reports (created_by)
-- - deliverable_workflows (submitted_by, reviewed_by, approved_by)
-- - client_activities (created_by)
-- - files (uploaded_by - stores TYPE not email, keep as-is)
--
-- These can be cleaned up in a future migration if needed.
-- For now, the most commonly used tables have been updated.
