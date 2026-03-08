-- ===============================================
-- EXPAND SOFT DELETE SYSTEM
-- ===============================================
-- Adds deleted_at / deleted_by columns to additional
-- business-critical tables for 30-day recovery support.
-- Tables: project_tasks, milestones, files, time_entries, client_contacts
-- (deliverables already covered in migration 093)

-- project_tasks
ALTER TABLE project_tasks ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE project_tasks ADD COLUMN deleted_by TEXT DEFAULT NULL;

-- milestones
ALTER TABLE milestones ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE milestones ADD COLUMN deleted_by TEXT DEFAULT NULL;

-- files
ALTER TABLE files ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE files ADD COLUMN deleted_by TEXT DEFAULT NULL;

-- time_entries
ALTER TABLE time_entries ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE time_entries ADD COLUMN deleted_by TEXT DEFAULT NULL;

-- client_contacts
ALTER TABLE client_contacts ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE client_contacts ADD COLUMN deleted_by TEXT DEFAULT NULL;

-- Performance indexes for filtering out deleted records
CREATE INDEX IF NOT EXISTS idx_project_tasks_deleted ON project_tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_milestones_deleted ON milestones(deleted_at);
CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(deleted_at);
CREATE INDEX IF NOT EXISTS idx_time_entries_deleted ON time_entries(deleted_at);
CREATE INDEX IF NOT EXISTS idx_client_contacts_deleted ON client_contacts(deleted_at);
