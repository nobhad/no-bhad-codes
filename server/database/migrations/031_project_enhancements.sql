-- UP
-- Migration: Project Management Enhancement
-- Phase 2: Tasks, time tracking, templates, dependencies, project health
-- Created: 2025-02-01

-- =====================================================
-- PROJECT TASKS
-- =====================================================
-- Tasks within projects with subtask support
CREATE TABLE IF NOT EXISTS project_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  milestone_id INTEGER,           -- Optional link to milestone
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',  -- 'pending', 'in_progress', 'completed', 'blocked', 'cancelled'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  assigned_to TEXT,               -- Team member name/email
  due_date DATE,
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  sort_order INTEGER DEFAULT 0,
  parent_task_id INTEGER,         -- For subtasks
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_task_id) REFERENCES project_tasks(id) ON DELETE CASCADE
);

-- =====================================================
-- TASK DEPENDENCIES
-- =====================================================
-- Define dependencies between tasks
CREATE TABLE IF NOT EXISTS task_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  depends_on_task_id INTEGER NOT NULL,
  dependency_type TEXT DEFAULT 'finish_to_start', -- 'finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES project_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_task_id) REFERENCES project_tasks(id) ON DELETE CASCADE,
  UNIQUE(task_id, depends_on_task_id)
);

-- =====================================================
-- TASK COMMENTS
-- =====================================================
-- Comments on tasks
CREATE TABLE IF NOT EXISTS task_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES project_tasks(id) ON DELETE CASCADE
);

-- =====================================================
-- TIME TRACKING
-- =====================================================
-- Time entries for projects and tasks
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  task_id INTEGER,                -- Optional link to task
  user_name TEXT NOT NULL,
  description TEXT,
  hours DECIMAL(5,2) NOT NULL,
  date DATE NOT NULL,
  billable BOOLEAN DEFAULT TRUE,
  hourly_rate DECIMAL(10,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES project_tasks(id) ON DELETE SET NULL
);

-- =====================================================
-- PROJECT TEMPLATES
-- =====================================================
-- Reusable project templates
CREATE TABLE IF NOT EXISTS project_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT,
  default_milestones JSON,        -- [{name, description, deliverables, order, estimated_days}]
  default_tasks JSON,             -- [{title, description, estimated_hours, milestone_index, priority}]
  estimated_duration_days INTEGER,
  default_hourly_rate DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PROJECT TAGS (reusing tags table from client enhancements)
-- =====================================================
-- Junction table for project-tag relationships
CREATE TABLE IF NOT EXISTS project_tags (
  project_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, tag_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- =====================================================
-- TASK CHECKLISTS
-- =====================================================
-- Checklist items within tasks
CREATE TABLE IF NOT EXISTS task_checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at DATETIME,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES project_tasks(id) ON DELETE CASCADE
);

-- =====================================================
-- UPDATE PROJECTS TABLE
-- =====================================================
ALTER TABLE projects ADD COLUMN hourly_rate DECIMAL(10,2);
ALTER TABLE projects ADD COLUMN estimated_hours DECIMAL(6,2);
ALTER TABLE projects ADD COLUMN actual_hours DECIMAL(6,2);
ALTER TABLE projects ADD COLUMN template_id INTEGER REFERENCES project_templates(id);
ALTER TABLE projects ADD COLUMN archived_at DATETIME;
ALTER TABLE projects ADD COLUMN project_health TEXT DEFAULT 'on_track';  -- 'on_track', 'at_risk', 'off_track'
ALTER TABLE projects ADD COLUMN health_notes TEXT;

-- =====================================================
-- UPDATE MILESTONES TABLE
-- =====================================================
ALTER TABLE milestones ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE milestones ADD COLUMN estimated_hours DECIMAL(5,2);
ALTER TABLE milestones ADD COLUMN actual_hours DECIMAL(5,2);
ALTER TABLE milestones ADD COLUMN status TEXT DEFAULT 'pending';  -- 'pending', 'in_progress', 'completed', 'blocked'

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_milestone ON project_tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_parent ON project_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned ON project_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_project_tasks_due ON project_tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends ON task_dependencies(depends_on_task_id);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_name);

CREATE INDEX IF NOT EXISTS idx_project_templates_type ON project_templates(project_type);
CREATE INDEX IF NOT EXISTS idx_project_templates_active ON project_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_project_tags_project ON project_tags(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tags_tag ON project_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_task_checklist_task ON task_checklist_items(task_id);

CREATE INDEX IF NOT EXISTS idx_projects_template ON projects(template_id);
CREATE INDEX IF NOT EXISTS idx_projects_health ON projects(project_health);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived_at);

-- =====================================================
-- SEED DEFAULT PROJECT TEMPLATES
-- =====================================================
INSERT OR IGNORE INTO project_templates (name, description, project_type, default_milestones, default_tasks, estimated_duration_days) VALUES
(
  'Simple Website',
  'Basic informational website with 3-5 pages',
  'simple-site',
  '[{"name":"Discovery & Planning","description":"Requirements gathering and project planning","deliverables":"Project brief, sitemap","order":0,"estimated_days":3},{"name":"Design","description":"UI/UX design and mockups","deliverables":"Homepage design, inner page templates","order":1,"estimated_days":5},{"name":"Development","description":"Frontend development and CMS integration","deliverables":"Working website","order":2,"estimated_days":7},{"name":"Launch","description":"Testing, deployment, and handoff","deliverables":"Live website, documentation","order":3,"estimated_days":2}]',
  '[{"title":"Kickoff meeting","milestone_index":0,"priority":"high","estimated_hours":1},{"title":"Content gathering","milestone_index":0,"priority":"medium","estimated_hours":3},{"title":"Sitemap creation","milestone_index":0,"priority":"high","estimated_hours":2},{"title":"Homepage mockup","milestone_index":1,"priority":"high","estimated_hours":8},{"title":"Inner page templates","milestone_index":1,"priority":"medium","estimated_hours":6},{"title":"Client review","milestone_index":1,"priority":"high","estimated_hours":2},{"title":"HTML/CSS development","milestone_index":2,"priority":"high","estimated_hours":16},{"title":"CMS setup","milestone_index":2,"priority":"medium","estimated_hours":8},{"title":"Content entry","milestone_index":2,"priority":"medium","estimated_hours":4},{"title":"Browser testing","milestone_index":3,"priority":"high","estimated_hours":3},{"title":"Deployment","milestone_index":3,"priority":"high","estimated_hours":2},{"title":"Client training","milestone_index":3,"priority":"medium","estimated_hours":2}]',
  17
),
(
  'Business Website',
  'Professional business website with 8-12 pages',
  'business-site',
  '[{"name":"Discovery & Strategy","description":"Business analysis, requirements, and strategy","deliverables":"Project brief, strategy document, sitemap","order":0,"estimated_days":5},{"name":"Design Phase","description":"Brand alignment, UI/UX design","deliverables":"Style guide, all page designs","order":1,"estimated_days":10},{"name":"Development","description":"Full-stack development","deliverables":"Working website with all features","order":2,"estimated_days":15},{"name":"Content & SEO","description":"Content integration and SEO optimization","deliverables":"Fully populated site, SEO setup","order":3,"estimated_days":5},{"name":"Launch & Training","description":"Final testing, launch, and handoff","deliverables":"Live website, documentation, training","order":4,"estimated_days":3}]',
  '[{"title":"Discovery call","milestone_index":0,"priority":"high","estimated_hours":2},{"title":"Competitor analysis","milestone_index":0,"priority":"medium","estimated_hours":4},{"title":"Requirements document","milestone_index":0,"priority":"high","estimated_hours":6},{"title":"Brand review","milestone_index":1,"priority":"high","estimated_hours":3},{"title":"Homepage design","milestone_index":1,"priority":"high","estimated_hours":12},{"title":"Service page designs","milestone_index":1,"priority":"high","estimated_hours":16},{"title":"Responsive designs","milestone_index":1,"priority":"medium","estimated_hours":8},{"title":"Frontend development","milestone_index":2,"priority":"high","estimated_hours":40},{"title":"Backend/CMS setup","milestone_index":2,"priority":"high","estimated_hours":20},{"title":"Form integrations","milestone_index":2,"priority":"medium","estimated_hours":6},{"title":"Content entry","milestone_index":3,"priority":"medium","estimated_hours":12},{"title":"SEO implementation","milestone_index":3,"priority":"high","estimated_hours":8},{"title":"QA testing","milestone_index":4,"priority":"high","estimated_hours":6},{"title":"Launch","milestone_index":4,"priority":"high","estimated_hours":3},{"title":"Training session","milestone_index":4,"priority":"medium","estimated_hours":3}]',
  38
),
(
  'E-commerce Store',
  'Full e-commerce website with product catalog and checkout',
  'e-commerce',
  '[{"name":"Planning & Strategy","description":"E-commerce strategy, platform selection, requirements","deliverables":"Technical spec, product structure, payment plan","order":0,"estimated_days":7},{"name":"Design","description":"Store design, product pages, checkout flow","deliverables":"Full store designs, UI kit","order":1,"estimated_days":12},{"name":"Store Setup","description":"Platform setup, product configuration","deliverables":"Working store structure","order":2,"estimated_days":8},{"name":"Development","description":"Custom development, integrations","deliverables":"Fully functional store","order":3,"estimated_days":20},{"name":"Product Population","description":"Product entry, images, descriptions","deliverables":"All products live","order":4,"estimated_days":7},{"name":"Testing & Launch","description":"Order testing, payment testing, launch","deliverables":"Live store","order":5,"estimated_days":5}]',
  '[{"title":"Platform evaluation","milestone_index":0,"priority":"high","estimated_hours":6},{"title":"Payment gateway setup","milestone_index":0,"priority":"high","estimated_hours":4},{"title":"Product taxonomy","milestone_index":0,"priority":"medium","estimated_hours":6},{"title":"Homepage design","milestone_index":1,"priority":"high","estimated_hours":16},{"title":"Product page design","milestone_index":1,"priority":"high","estimated_hours":12},{"title":"Cart/checkout design","milestone_index":1,"priority":"high","estimated_hours":12},{"title":"Platform installation","milestone_index":2,"priority":"high","estimated_hours":8},{"title":"Theme customization","milestone_index":2,"priority":"high","estimated_hours":24},{"title":"Payment integration","milestone_index":3,"priority":"high","estimated_hours":12},{"title":"Shipping setup","milestone_index":3,"priority":"high","estimated_hours":8},{"title":"Custom features","milestone_index":3,"priority":"medium","estimated_hours":20},{"title":"Product entry","milestone_index":4,"priority":"medium","estimated_hours":24},{"title":"Order testing","milestone_index":5,"priority":"high","estimated_hours":8},{"title":"Launch","milestone_index":5,"priority":"high","estimated_hours":4}]',
  59
);

-- =====================================================
-- SEED PROJECT TAGS
-- =====================================================
INSERT OR IGNORE INTO tags (name, color, tag_type, description) VALUES
('Rush', '#ef4444', 'project', 'Fast turnaround project'),
('Maintenance', '#f59e0b', 'project', 'Ongoing maintenance project'),
('Redesign', '#8b5cf6', 'project', 'Website or app redesign'),
('New Build', '#10b981', 'project', 'New project from scratch'),
('Complex', '#ec4899', 'project', 'High complexity project'),
('Simple', '#06b6d4', 'project', 'Simple, straightforward project'),
('Fixed Price', '#3b82f6', 'project', 'Fixed price contract'),
('Hourly', '#84cc16', 'project', 'Hourly billing');

-- DOWN
-- Rollback: Drop all new tables and columns

DROP INDEX IF EXISTS idx_projects_archived;
DROP INDEX IF EXISTS idx_projects_health;
DROP INDEX IF EXISTS idx_projects_template;
DROP INDEX IF EXISTS idx_task_checklist_task;
DROP INDEX IF EXISTS idx_project_tags_tag;
DROP INDEX IF EXISTS idx_project_tags_project;
DROP INDEX IF EXISTS idx_project_templates_active;
DROP INDEX IF EXISTS idx_project_templates_type;
DROP INDEX IF EXISTS idx_time_entries_user;
DROP INDEX IF EXISTS idx_time_entries_date;
DROP INDEX IF EXISTS idx_time_entries_task;
DROP INDEX IF EXISTS idx_time_entries_project;
DROP INDEX IF EXISTS idx_task_comments_task;
DROP INDEX IF EXISTS idx_task_dependencies_depends;
DROP INDEX IF EXISTS idx_task_dependencies_task;
DROP INDEX IF EXISTS idx_project_tasks_due;
DROP INDEX IF EXISTS idx_project_tasks_assigned;
DROP INDEX IF EXISTS idx_project_tasks_parent;
DROP INDEX IF EXISTS idx_project_tasks_status;
DROP INDEX IF EXISTS idx_project_tasks_milestone;
DROP INDEX IF EXISTS idx_project_tasks_project;

DROP TABLE IF EXISTS task_checklist_items;
DROP TABLE IF EXISTS project_tags;
DROP TABLE IF EXISTS project_templates;
DROP TABLE IF EXISTS time_entries;
DROP TABLE IF EXISTS task_comments;
DROP TABLE IF EXISTS task_dependencies;
DROP TABLE IF EXISTS project_tasks;

-- Note: SQLite doesn't support DROP COLUMN, so project/milestone columns would remain
