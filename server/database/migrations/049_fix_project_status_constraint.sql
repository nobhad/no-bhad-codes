-- Migration: Fix project status CHECK constraint
-- Created: 2026-02-06
-- Reason: Original constraint only allows: 'pending', 'in-progress', 'in-review', 'completed', 'on-hold'
--         TypeScript types also expect: 'active', 'cancelled'
--         This migration adds the missing status values.

-- UP
-- SQLite requires table recreation to modify CHECK constraints
-- IMPORTANT: Before running, verify column list matches actual schema with:
-- SELECT sql FROM sqlite_master WHERE type='table' AND name='projects';

PRAGMA foreign_keys = OFF;

-- Step 1: Create new table with updated CHECK constraint
-- Column list from migrations: 001, 007, 020, 021, 025, 031
CREATE TABLE projects_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  project_name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'in-progress', 'in-review', 'completed', 'on-hold', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  start_date DATE,
  estimated_end_date DATE,
  actual_end_date DATE,
  budget_range TEXT,
  project_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- From 007_project_request_columns
  timeline TEXT,
  preview_url TEXT,
  -- From 020_project_price
  price TEXT,
  -- From 021_project_additional_fields
  notes TEXT,
  repository_url TEXT,
  staging_url TEXT,
  production_url TEXT,
  deposit_amount TEXT,
  contract_signed_at DATETIME,
  -- From 025_fix_project_status_constraint
  cancelled_by TEXT,
  cancellation_reason TEXT,
  -- From 031_project_enhancements
  hourly_rate DECIMAL(10,2),
  estimated_hours DECIMAL(6,2),
  actual_hours DECIMAL(6,2),
  template_id INTEGER REFERENCES project_templates(id),
  archived_at DATETIME,
  project_health TEXT DEFAULT 'on_track',
  health_notes TEXT,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Step 2: Copy data from old table (using explicit column list for safety)
INSERT INTO projects_new (
  id, client_id, project_name, description, status, priority, progress,
  start_date, estimated_end_date, actual_end_date, budget_range, project_type,
  created_at, updated_at, timeline, preview_url, price, notes, repository_url,
  staging_url, production_url, deposit_amount, contract_signed_at,
  cancelled_by, cancellation_reason, hourly_rate, estimated_hours, actual_hours,
  template_id, archived_at, project_health, health_notes
)
SELECT
  id, client_id, project_name, description, status, priority, progress,
  start_date, estimated_end_date, actual_end_date, budget_range, project_type,
  created_at, updated_at, timeline, preview_url, price, notes, repository_url,
  staging_url, production_url, deposit_amount, contract_signed_at,
  cancelled_by, cancellation_reason, hourly_rate, estimated_hours, actual_hours,
  template_id, archived_at, project_health, health_notes
FROM projects;

-- Step 3: Drop old table
DROP TABLE projects;

-- Step 4: Rename new table
ALTER TABLE projects_new RENAME TO projects;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_template ON projects(template_id);
CREATE INDEX IF NOT EXISTS idx_projects_health ON projects(project_health);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived_at);

PRAGMA foreign_keys = ON;

-- DOWN
-- Revert to original constraint (note: this will fail if 'active' or 'cancelled' values exist)
-- To rollback, first update any 'active'/'cancelled' statuses to valid values

PRAGMA foreign_keys = OFF;

CREATE TABLE projects_old (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  project_name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'in-review', 'completed', 'on-hold')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  start_date DATE,
  estimated_end_date DATE,
  actual_end_date DATE,
  budget_range TEXT,
  project_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  timeline TEXT,
  preview_url TEXT,
  price TEXT,
  notes TEXT,
  repository_url TEXT,
  staging_url TEXT,
  production_url TEXT,
  deposit_amount TEXT,
  contract_signed_at DATETIME,
  cancelled_by TEXT,
  cancellation_reason TEXT,
  hourly_rate DECIMAL(10,2),
  estimated_hours DECIMAL(6,2),
  actual_hours DECIMAL(6,2),
  template_id INTEGER REFERENCES project_templates(id),
  archived_at DATETIME,
  project_health TEXT DEFAULT 'on_track',
  health_notes TEXT,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

INSERT INTO projects_old SELECT * FROM projects;
DROP TABLE projects;
ALTER TABLE projects_old RENAME TO projects;

CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_template ON projects(template_id);
CREATE INDEX IF NOT EXISTS idx_projects_health ON projects(project_health);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived_at);

PRAGMA foreign_keys = ON;
