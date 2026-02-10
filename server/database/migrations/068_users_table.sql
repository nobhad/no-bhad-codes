-- ===============================================
-- USERS TABLE & TEXT FK MIGRATION - PHASE 2
-- ===============================================
-- Migration: 068_users_table.sql
-- Description: Create users table and add user_id foreign key columns
-- Created: 2026-02-10
--
-- RATIONALE:
-- - 35+ tables store user references as TEXT (email/name)
-- - No referential integrity, no CASCADE deletes
-- - This migration creates the users table and adds FK columns
-- - TEXT columns kept temporarily for backward compatibility

-- ===============================================
-- SECTION 1: CREATE USERS TABLE
-- ===============================================

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT DEFAULT 'team_member' CHECK (role IN ('admin', 'team_member', 'contractor', 'system')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_active_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Seed system user (for automated actions)
INSERT INTO users (email, display_name, role, is_active)
VALUES ('system@nobhad.codes', 'System', 'system', TRUE);

-- Seed admin user (primary admin)
INSERT INTO users (email, display_name, role, is_active)
VALUES ('nobhaduri@gmail.com', 'Noelle Bhaduri', 'admin', TRUE);

-- ===============================================
-- SECTION 2: ADD user_id COLUMNS TO TABLES
-- ===============================================
-- Adding new INTEGER columns alongside existing TEXT columns
-- This allows gradual migration without breaking existing code

-- project_tasks
ALTER TABLE project_tasks ADD COLUMN assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_user ON project_tasks(assigned_to_user_id);

-- lead_tasks
ALTER TABLE lead_tasks ADD COLUMN assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lead_tasks_assigned_user ON lead_tasks(assigned_to_user_id);

-- time_entries
ALTER TABLE time_entries ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);

-- project_updates
ALTER TABLE project_updates ADD COLUMN author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_project_updates_author ON project_updates(author_user_id);

-- files
ALTER TABLE files ADD COLUMN uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by_user ON files(uploaded_by_user_id);

-- task_comments
ALTER TABLE task_comments ADD COLUMN author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_task_comments_author ON task_comments(author_user_id);

-- client_notes
ALTER TABLE client_notes ADD COLUMN author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_client_notes_author ON client_notes(author_user_id);

-- lead_notes
ALTER TABLE lead_notes ADD COLUMN author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lead_notes_author ON lead_notes(author_user_id);

-- document_requests (multiple user columns)
ALTER TABLE document_requests ADD COLUMN requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE document_requests ADD COLUMN uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE document_requests ADD COLUMN reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_doc_requests_requested_by ON document_requests(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_doc_requests_uploaded_by ON document_requests(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_doc_requests_reviewed_by ON document_requests(reviewed_by_user_id);

-- file_comments
ALTER TABLE file_comments ADD COLUMN author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_file_comments_author ON file_comments(author_user_id);

-- kb_articles
ALTER TABLE kb_articles ADD COLUMN author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_kb_articles_author ON kb_articles(author_user_id);

-- questionnaires
ALTER TABLE questionnaires ADD COLUMN created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_questionnaires_created_by ON questionnaires(created_by_user_id);

-- proposal_requests
ALTER TABLE proposal_requests ADD COLUMN reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_proposal_requests_reviewed_by ON proposal_requests(reviewed_by_user_id);

-- deliverable_workflows
ALTER TABLE deliverable_workflows ADD COLUMN submitted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE deliverable_workflows ADD COLUMN reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE deliverable_workflows ADD COLUMN approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deliverable_submitted ON deliverable_workflows(submitted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_reviewed ON deliverable_workflows(reviewed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_approved ON deliverable_workflows(approved_by_user_id);

-- deliverable_review_comments
ALTER TABLE deliverable_review_comments ADD COLUMN author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deliverable_comments_author ON deliverable_review_comments(author_user_id);

-- duplicate_resolution_log
ALTER TABLE duplicate_resolution_log ADD COLUMN resolved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_dup_resolution_user ON duplicate_resolution_log(resolved_by_user_id);

-- lead_duplicates
ALTER TABLE lead_duplicates ADD COLUMN resolved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lead_dup_resolved ON lead_duplicates(resolved_by_user_id);

-- blocked_ips
ALTER TABLE blocked_ips ADD COLUMN blocked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_blocked_ips_user ON blocked_ips(blocked_by_user_id);

-- saved_reports
ALTER TABLE saved_reports ADD COLUMN created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_saved_reports_user ON saved_reports(created_by_user_id);

-- ad_hoc_requests
ALTER TABLE ad_hoc_requests ADD COLUMN converted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_adhoc_converted_by ON ad_hoc_requests(converted_by_user_id);

-- client_activities
ALTER TABLE client_activities ADD COLUMN created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_client_activities_user ON client_activities(created_by_user_id);

-- ===============================================
-- SECTION 3: POPULATE user_id FROM TEXT COLUMNS
-- ===============================================
-- Match existing TEXT values to users table and populate new columns

-- First, extract unique emails/names from existing data and create users
-- This handles cases where team members aren't already in users table

-- Extract from project_tasks.assigned_to (if email format)
INSERT OR IGNORE INTO users (email, display_name, role)
SELECT DISTINCT assigned_to, assigned_to, 'team_member'
FROM project_tasks
WHERE assigned_to IS NOT NULL
  AND assigned_to LIKE '%@%'
  AND assigned_to NOT IN (SELECT email FROM users);

-- Extract from time_entries.user_name (may be name, not email)
-- Skip if not email format - will need manual resolution

-- Now populate the user_id columns from matched emails

-- project_tasks
UPDATE project_tasks
SET assigned_to_user_id = (
  SELECT id FROM users WHERE email = project_tasks.assigned_to
)
WHERE assigned_to IS NOT NULL AND assigned_to LIKE '%@%';

-- lead_tasks
UPDATE lead_tasks
SET assigned_to_user_id = (
  SELECT id FROM users WHERE email = lead_tasks.assigned_to
)
WHERE assigned_to IS NOT NULL AND assigned_to LIKE '%@%';

-- time_entries (user_name may not be email - try matching)
UPDATE time_entries
SET user_id = (
  SELECT id FROM users WHERE email = time_entries.user_name OR display_name = time_entries.user_name
)
WHERE user_name IS NOT NULL;

-- project_updates
UPDATE project_updates
SET author_user_id = (
  SELECT id FROM users WHERE email = project_updates.author OR display_name = project_updates.author
)
WHERE author IS NOT NULL;

-- files
UPDATE files
SET uploaded_by_user_id = (
  SELECT id FROM users WHERE email = files.uploaded_by OR display_name = files.uploaded_by
)
WHERE uploaded_by IS NOT NULL;

-- task_comments
UPDATE task_comments
SET author_user_id = (
  SELECT id FROM users WHERE email = task_comments.author OR display_name = task_comments.author
)
WHERE author IS NOT NULL;

-- client_notes
UPDATE client_notes
SET author_user_id = (
  SELECT id FROM users WHERE email = client_notes.author OR display_name = client_notes.author
)
WHERE author IS NOT NULL;

-- lead_notes
UPDATE lead_notes
SET author_user_id = (
  SELECT id FROM users WHERE email = lead_notes.author OR display_name = lead_notes.author
)
WHERE author IS NOT NULL;

-- document_requests
UPDATE document_requests
SET requested_by_user_id = (SELECT id FROM users WHERE email = document_requests.requested_by)
WHERE requested_by IS NOT NULL AND requested_by LIKE '%@%';

UPDATE document_requests
SET uploaded_by_user_id = (SELECT id FROM users WHERE email = document_requests.uploaded_by)
WHERE uploaded_by IS NOT NULL AND uploaded_by LIKE '%@%';

UPDATE document_requests
SET reviewed_by_user_id = (SELECT id FROM users WHERE email = document_requests.reviewed_by)
WHERE reviewed_by IS NOT NULL AND reviewed_by LIKE '%@%';

-- file_comments
UPDATE file_comments
SET author_user_id = (SELECT id FROM users WHERE email = file_comments.author_email)
WHERE author_email IS NOT NULL;

-- kb_articles
UPDATE kb_articles
SET author_user_id = (SELECT id FROM users WHERE email = kb_articles.author_email)
WHERE author_email IS NOT NULL;

-- questionnaires
UPDATE questionnaires
SET created_by_user_id = (SELECT id FROM users WHERE email = questionnaires.created_by)
WHERE created_by IS NOT NULL AND created_by LIKE '%@%';

-- proposal_requests
UPDATE proposal_requests
SET reviewed_by_user_id = (SELECT id FROM users WHERE email = proposal_requests.reviewed_by)
WHERE reviewed_by IS NOT NULL AND reviewed_by LIKE '%@%';

-- deliverable_workflows
UPDATE deliverable_workflows
SET submitted_by_user_id = (SELECT id FROM users WHERE email = deliverable_workflows.submitted_by)
WHERE submitted_by IS NOT NULL AND submitted_by LIKE '%@%';

UPDATE deliverable_workflows
SET reviewed_by_user_id = (SELECT id FROM users WHERE email = deliverable_workflows.reviewed_by)
WHERE reviewed_by IS NOT NULL AND reviewed_by LIKE '%@%';

UPDATE deliverable_workflows
SET approved_by_user_id = (SELECT id FROM users WHERE email = deliverable_workflows.approved_by)
WHERE approved_by IS NOT NULL AND approved_by LIKE '%@%';

-- deliverable_review_comments
UPDATE deliverable_review_comments
SET author_user_id = (SELECT id FROM users WHERE email = deliverable_review_comments.author_email)
WHERE author_email IS NOT NULL;

-- duplicate_resolution_log
UPDATE duplicate_resolution_log
SET resolved_by_user_id = (SELECT id FROM users WHERE email = duplicate_resolution_log.resolved_by)
WHERE resolved_by IS NOT NULL AND resolved_by LIKE '%@%';

-- lead_duplicates
UPDATE lead_duplicates
SET resolved_by_user_id = (SELECT id FROM users WHERE email = lead_duplicates.resolved_by)
WHERE resolved_by IS NOT NULL AND resolved_by LIKE '%@%';

-- blocked_ips
UPDATE blocked_ips
SET blocked_by_user_id = (SELECT id FROM users WHERE email = blocked_ips.blocked_by)
WHERE blocked_by IS NOT NULL AND blocked_by LIKE '%@%';

-- saved_reports
UPDATE saved_reports
SET created_by_user_id = (SELECT id FROM users WHERE email = saved_reports.created_by)
WHERE created_by IS NOT NULL AND created_by LIKE '%@%';

-- ad_hoc_requests
UPDATE ad_hoc_requests
SET converted_by_user_id = (SELECT id FROM users WHERE email = ad_hoc_requests.converted_by)
WHERE converted_by IS NOT NULL AND converted_by LIKE '%@%';

-- client_activities (may be 'system' or email)
UPDATE client_activities
SET created_by_user_id = (
  SELECT id FROM users
  WHERE email = client_activities.created_by
     OR (client_activities.created_by = 'system' AND email = 'system@nobhad.codes')
)
WHERE created_by IS NOT NULL;

-- ===============================================
-- NOTES FOR APPLICATION CODE UPDATES
-- ===============================================
--
-- 1. NEW TABLE: users
--    - Use for all team member references
--    - System user (id=1) for automated actions
--    - Admin user (id=2) for primary admin
--
-- 2. TRANSITION PERIOD:
--    - Write to BOTH old TEXT column AND new user_id column
--    - Read preferentially from user_id, fall back to TEXT
--    - After 30 days, remove TEXT columns in future migration
--
-- 3. QUERY PATTERN:
--    -- Old
--    SELECT assigned_to FROM project_tasks
--
--    -- New (with JOIN)
--    SELECT u.email, u.display_name
--    FROM project_tasks pt
--    LEFT JOIN users u ON pt.assigned_to_user_id = u.id
--
-- 4. INSERT PATTERN:
--    -- Old
--    INSERT INTO project_tasks (assigned_to) VALUES ('email@example.com')
--
--    -- New
--    INSERT INTO project_tasks (assigned_to, assigned_to_user_id)
--    VALUES ('email@example.com', (SELECT id FROM users WHERE email = 'email@example.com'))
