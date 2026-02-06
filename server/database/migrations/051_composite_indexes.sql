-- Migration: 051_composite_indexes.sql
-- Purpose: Add composite indexes for common multi-column query patterns
-- Date: 2026-02-06

-- Projects: Filter by client and status (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_projects_client_status
ON projects(client_id, status);

-- Time Entries: Filter by project and date (timesheet queries)
CREATE INDEX IF NOT EXISTS idx_time_entries_project_date
ON time_entries(project_id, date);

-- Time Entries: Filter by user and date (user timesheet view)
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date
ON time_entries(user_name, date);

-- Client Activities: Filter by client and date (activity timeline)
CREATE INDEX IF NOT EXISTS idx_client_activities_client_date
ON client_activities(client_id, created_at);

-- Audit Logs: Filter by entity type/id and date (audit trail queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_date
ON audit_logs(entity_type, entity_id, created_at);

-- Invoices: Filter by client and status (client invoice list)
CREATE INDEX IF NOT EXISTS idx_invoices_client_status
ON invoices(client_id, status);

-- Invoices: Filter by project and status
CREATE INDEX IF NOT EXISTS idx_invoices_project_status
ON invoices(project_id, status);

-- Messages: Filter by thread and date (conversation view)
CREATE INDEX IF NOT EXISTS idx_general_messages_thread_date
ON general_messages(thread_id, created_at);

-- Page Views: Filter by date for analytics queries and cleanup
CREATE INDEX IF NOT EXISTS idx_page_views_created
ON page_views(created_at);

-- Interaction Events: Filter by date for analytics queries and cleanup
CREATE INDEX IF NOT EXISTS idx_interaction_events_created
ON interaction_events(created_at);
