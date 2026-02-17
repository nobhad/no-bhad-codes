-- Migration 089: Additional Performance Indexes
-- Created: 2026-02-15
-- Description: Adds missing indexes for tables commonly queried by FK and status

-- Ad Hoc Requests: Filter by client/project and status
CREATE INDEX IF NOT EXISTS idx_ad_hoc_requests_client_status
ON ad_hoc_requests(client_id, status);

CREATE INDEX IF NOT EXISTS idx_ad_hoc_requests_project_status
ON ad_hoc_requests(project_id, status);

-- Document Requests: Filter by client and status (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_document_requests_client_status
ON document_requests(client_id, status);

CREATE INDEX IF NOT EXISTS idx_document_requests_project
ON document_requests(project_id);

-- Client Onboarding Progress: Filter by client and status
-- CREATE INDEX IF NOT EXISTS idx_client_onboarding_progress_client_status
-- ON client_onboarding_progress(client_id, status);

-- Project Tasks: Filter by project and status (task board queries)
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_status
ON project_tasks(project_id, status);

-- Deliverables: Filter by project and status/approval_status
CREATE INDEX IF NOT EXISTS idx_deliverables_project_status
ON deliverables(project_id, status);

CREATE INDEX IF NOT EXISTS idx_deliverables_project_approval
ON deliverables(project_id, approval_status);

-- Proposal Requests: Filter by client/project and status
CREATE INDEX IF NOT EXISTS idx_proposal_requests_client_status
ON proposal_requests(client_id, status);

CREATE INDEX IF NOT EXISTS idx_proposal_requests_project
ON proposal_requests(project_id);

-- Contract Reminders: Filter by project and status
CREATE INDEX IF NOT EXISTS idx_contract_reminders_project_status
ON contract_reminders(project_id, status);

-- Email Log: Filter by status and created_at (for queue processing)
-- CREATE INDEX IF NOT EXISTS idx_email_log_status_created
-- ON email_log(status, created_at);

-- Milestones: Filter by project and status (project detail view)
CREATE INDEX IF NOT EXISTS idx_milestones_project_status
ON milestones(project_id, status);
