-- UP
-- Migration: Lead/Intake Enhancement
-- Phase 4: Lead scoring, pipeline stages, tasks, notes, duplicate detection
-- Created: 2025-02-01

-- =====================================================
-- LEAD SCORING RULES
-- =====================================================
-- Define rules for automatic lead scoring
CREATE TABLE IF NOT EXISTS lead_scoring_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  field_name TEXT NOT NULL,         -- Field to evaluate (budget_range, project_type, timeline, etc.)
  operator TEXT NOT NULL,           -- 'equals', 'contains', 'greater_than', 'less_than', 'in', 'not_empty'
  threshold_value TEXT NOT NULL,    -- Value to compare against
  points INTEGER NOT NULL,          -- Points to add (positive) or subtract (negative)
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PIPELINE STAGES
-- =====================================================
-- Define pipeline stages for lead progression
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6b7280',
  sort_order INTEGER DEFAULT 0,
  win_probability DECIMAL(3,2) DEFAULT 0,  -- 0.00 to 1.00
  is_won BOOLEAN DEFAULT FALSE,
  is_lost BOOLEAN DEFAULT FALSE,
  auto_convert_to_project BOOLEAN DEFAULT FALSE,  -- Auto-convert when moved here
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- LEAD TASKS / FOLLOW-UPS
-- =====================================================
-- Tasks and follow-ups for leads (projects with pending status)
CREATE TABLE IF NOT EXISTS lead_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,      -- Lead = project with pending status
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'follow_up',  -- 'follow_up', 'call', 'email', 'meeting', 'proposal', 'demo', 'other'
  due_date DATE,
  due_time TIME,
  status TEXT DEFAULT 'pending',    -- 'pending', 'completed', 'cancelled', 'snoozed'
  assigned_to TEXT,                 -- Team member name/email
  priority TEXT DEFAULT 'medium',   -- 'low', 'medium', 'high', 'urgent'
  reminder_at DATETIME,             -- When to send reminder
  completed_at DATETIME,
  completed_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- =====================================================
-- LEAD NOTES
-- =====================================================
-- Notes for leads
CREATE TABLE IF NOT EXISTS lead_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- =====================================================
-- LEAD SOURCES
-- =====================================================
-- Track where leads come from
CREATE TABLE IF NOT EXISTS lead_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- DUPLICATE LEAD TRACKING
-- =====================================================
-- Track potential duplicate leads
CREATE TABLE IF NOT EXISTS lead_duplicates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id_1 INTEGER NOT NULL,
  lead_id_2 INTEGER NOT NULL,
  similarity_score DECIMAL(3,2),    -- 0.00 to 1.00
  match_fields JSON,                -- Which fields matched
  status TEXT DEFAULT 'pending',    -- 'pending', 'merged', 'not_duplicate', 'dismissed'
  resolved_at DATETIME,
  resolved_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id_1) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id_2) REFERENCES projects(id) ON DELETE CASCADE
);

-- =====================================================
-- UPDATE PROJECTS TABLE FOR LEAD TRACKING
-- =====================================================
-- Add lead-specific columns to projects table
ALTER TABLE projects ADD COLUMN lead_score INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN lead_score_breakdown JSON;
ALTER TABLE projects ADD COLUMN pipeline_stage_id INTEGER REFERENCES pipeline_stages(id);
ALTER TABLE projects ADD COLUMN lead_source_id INTEGER REFERENCES lead_sources(id);
ALTER TABLE projects ADD COLUMN assigned_to TEXT;
ALTER TABLE projects ADD COLUMN expected_value DECIMAL(10,2);
ALTER TABLE projects ADD COLUMN expected_close_date DATE;
ALTER TABLE projects ADD COLUMN lost_reason TEXT;
ALTER TABLE projects ADD COLUMN lost_at DATETIME;
ALTER TABLE projects ADD COLUMN won_at DATETIME;
ALTER TABLE projects ADD COLUMN competitor TEXT;
ALTER TABLE projects ADD COLUMN last_activity_at DATETIME;
ALTER TABLE projects ADD COLUMN next_follow_up_at DATETIME;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_lead_scoring_rules_active ON lead_scoring_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_lead_scoring_rules_field ON lead_scoring_rules(field_name);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_order ON pipeline_stages(sort_order);

CREATE INDEX IF NOT EXISTS idx_lead_tasks_project ON lead_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_due ON lead_tasks(due_date, status);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_status ON lead_tasks(status);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_assigned ON lead_tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_lead_notes_project ON lead_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_pinned ON lead_notes(is_pinned);

CREATE INDEX IF NOT EXISTS idx_lead_sources_active ON lead_sources(is_active);

CREATE INDEX IF NOT EXISTS idx_lead_duplicates_status ON lead_duplicates(status);
CREATE INDEX IF NOT EXISTS idx_lead_duplicates_leads ON lead_duplicates(lead_id_1, lead_id_2);

CREATE INDEX IF NOT EXISTS idx_projects_pipeline ON projects(pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_projects_lead_score ON projects(lead_score);
CREATE INDEX IF NOT EXISTS idx_projects_assigned ON projects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_projects_lead_source ON projects(lead_source_id);
CREATE INDEX IF NOT EXISTS idx_projects_expected_close ON projects(expected_close_date);

-- =====================================================
-- SEED DEFAULT PIPELINE STAGES
-- =====================================================
INSERT OR IGNORE INTO pipeline_stages (name, description, sort_order, win_probability, color) VALUES
('New Lead', 'Fresh lead, not yet contacted', 0, 0.10, '#6b7280'),
('Contacted', 'Initial contact made', 1, 0.20, '#3b82f6'),
('Qualified', 'Lead is qualified and interested', 2, 0.40, '#8b5cf6'),
('Proposal Sent', 'Proposal has been sent', 3, 0.60, '#f59e0b'),
('Negotiation', 'Negotiating terms and pricing', 4, 0.80, '#ef4444'),
('Won', 'Deal closed successfully', 5, 1.00, '#10b981'),
('Lost', 'Deal was lost', 6, 0.00, '#dc2626');

-- Mark won/lost stages
UPDATE pipeline_stages SET is_won = TRUE, auto_convert_to_project = TRUE WHERE name = 'Won';
UPDATE pipeline_stages SET is_lost = TRUE WHERE name = 'Lost';

-- =====================================================
-- SEED DEFAULT LEAD SOURCES
-- =====================================================
INSERT OR IGNORE INTO lead_sources (name, description) VALUES
('Website', 'Contact form or intake form on website'),
('Referral', 'Referred by existing client or partner'),
('Social Media', 'Found through social media'),
('Cold Outreach', 'Cold email or call'),
('Conference/Event', 'Met at conference or event'),
('Partner', 'Lead from partner organization'),
('Organic Search', 'Found through search engine'),
('Paid Ads', 'Came through paid advertising'),
('Other', 'Other source');

-- =====================================================
-- SEED DEFAULT SCORING RULES
-- =====================================================
INSERT OR IGNORE INTO lead_scoring_rules (name, field_name, operator, threshold_value, points, description) VALUES
('High Budget', 'budget_range', 'in', '$10k-$25k,$25k+', 25, 'High budget projects get more points'),
('Medium Budget', 'budget_range', 'in', '$5k-$10k', 15, 'Medium budget projects'),
('Low Budget', 'budget_range', 'in', 'Under $2k,$2k-$5k', 5, 'Lower budget projects'),
('Business Website', 'project_type', 'equals', 'business', 10, 'Business websites are valuable'),
('E-commerce', 'project_type', 'equals', 'e-commerce', 20, 'E-commerce projects are high value'),
('Custom App', 'project_type', 'equals', 'custom', 25, 'Custom applications are highest value'),
('Urgent Timeline', 'timeline', 'in', 'asap,1-2_weeks', 15, 'Urgent timelines indicate serious leads'),
('Has Description', 'description', 'not_empty', '', 10, 'Leads with descriptions are more engaged'),
('Returning Client', 'client_type', 'equals', 'returning', 20, 'Returning clients are valuable');

-- DOWN
-- Rollback: Drop all new tables and columns

DROP INDEX IF EXISTS idx_projects_expected_close;
DROP INDEX IF EXISTS idx_projects_lead_source;
DROP INDEX IF EXISTS idx_projects_assigned;
DROP INDEX IF EXISTS idx_projects_lead_score;
DROP INDEX IF EXISTS idx_projects_pipeline;
DROP INDEX IF EXISTS idx_lead_duplicates_leads;
DROP INDEX IF EXISTS idx_lead_duplicates_status;
DROP INDEX IF EXISTS idx_lead_sources_active;
DROP INDEX IF EXISTS idx_lead_notes_pinned;
DROP INDEX IF EXISTS idx_lead_notes_project;
DROP INDEX IF EXISTS idx_lead_tasks_assigned;
DROP INDEX IF EXISTS idx_lead_tasks_status;
DROP INDEX IF EXISTS idx_lead_tasks_due;
DROP INDEX IF EXISTS idx_lead_tasks_project;
DROP INDEX IF EXISTS idx_pipeline_stages_order;
DROP INDEX IF EXISTS idx_lead_scoring_rules_field;
DROP INDEX IF EXISTS idx_lead_scoring_rules_active;

DROP TABLE IF EXISTS lead_duplicates;
DROP TABLE IF EXISTS lead_sources;
DROP TABLE IF EXISTS lead_notes;
DROP TABLE IF EXISTS lead_tasks;
DROP TABLE IF EXISTS pipeline_stages;
DROP TABLE IF EXISTS lead_scoring_rules;

-- Note: SQLite doesn't support DROP COLUMN, so project columns would remain
