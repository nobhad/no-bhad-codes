-- =====================================================
-- Migration 098: Comprehensive Missing Indexes
-- =====================================================
-- Created: 2026-03-07
--
-- Purpose: Add missing indexes on foreign key columns and frequently
-- filtered/sorted columns to bring database performance to A grade.
--
-- Analysis method:
--   1. Reviewed all CREATE TABLE migrations for FOREIGN KEY declarations
--   2. Cross-referenced against all CREATE INDEX statements in migrations
--      001, 005, 012, 014, 028, 029, 030, 031, 032, 033, 034, 035,
--      036, 037, 038, 039, 040, 041, 042, 043, 044, 045, 046, 047,
--      050, 051, 052, 056, 057, 058, 063, 064, 065, 066, 068, 072,
--      073, 074, 078, 079, 082, 084, 085, 089, 091, 092, 093, 095
--   3. Reviewed server/services/ and server/routes/ for common WHERE,
--      ORDER BY, and JOIN patterns on unindexed columns
--
-- All statements use IF NOT EXISTS for idempotency.
-- =====================================================

-- UP

-- =====================================================
-- SECTION 1: Missing FK indexes on scheduled_invoices
-- =====================================================
-- scheduled_invoices has FKs: project_id, client_id, trigger_milestone_id, generated_invoice_id
-- Existing: idx_scheduled_invoices_date (scheduled_date, status) from 028
--           idx_scheduled_invoices_status_trigger_date (status, trigger_type, scheduled_date) from 082
-- Missing: project_id, client_id

CREATE INDEX IF NOT EXISTS idx_scheduled_invoices_project
  ON scheduled_invoices(project_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_invoices_client
  ON scheduled_invoices(client_id);

-- =====================================================
-- SECTION 2: Missing FK indexes on recurring_invoices
-- =====================================================
-- recurring_invoices has FKs: project_id, client_id
-- Existing: idx_recurring_invoices_next (next_generation_date, is_active) from 028
--           idx_recurring_invoices_active_next (is_active, next_generation_date) from 079
-- Missing: project_id, client_id

CREATE INDEX IF NOT EXISTS idx_recurring_invoices_project
  ON recurring_invoices(project_id);

CREATE INDEX IF NOT EXISTS idx_recurring_invoices_client
  ON recurring_invoices(client_id);

-- =====================================================
-- SECTION 3: Missing FK index on contracts.template_id
-- =====================================================
-- contracts has FKs: template_id, project_id, client_id
-- Existing: idx_contracts_project, idx_contracts_client, idx_contracts_status from 052
-- Missing: template_id

CREATE INDEX IF NOT EXISTS idx_contracts_template
  ON contracts(template_id);

-- =====================================================
-- SECTION 4: Missing FK index on receipts.file_id
-- =====================================================
-- receipts has FKs: invoice_id, payment_id, file_id
-- Existing: idx_receipts_invoice, idx_receipts_payment from 084
-- Missing: file_id

CREATE INDEX IF NOT EXISTS idx_receipts_file
  ON receipts(file_id);

-- =====================================================
-- SECTION 5: Missing FK indexes on client_onboarding
-- =====================================================
-- client_onboarding has FKs: client_id (UNIQUE), project_id
-- Existing: idx_client_onboarding_client, idx_client_onboarding_status from 058
-- Missing: project_id

CREATE INDEX IF NOT EXISTS idx_client_onboarding_project
  ON client_onboarding(project_id);

-- =====================================================
-- SECTION 6: Missing FK indexes on approval tables
-- =====================================================
-- approval_workflow_instances has FK: workflow_definition_id
-- Existing: idx_approval_instances_entity, idx_approval_instances_status from 041
-- Missing: workflow_definition_id (standalone index for JOIN lookups)

CREATE INDEX IF NOT EXISTS idx_approval_instances_definition
  ON approval_workflow_instances(workflow_definition_id);

-- approval_requests has FKs: workflow_instance_id, step_id
-- Existing: idx_approval_requests_instance, idx_approval_requests_approver from 041
-- Missing: step_id

CREATE INDEX IF NOT EXISTS idx_approval_requests_step
  ON approval_requests(step_id);

-- approval_history has FKs: workflow_instance_id, step_id
-- Existing: idx_approval_history_instance from 041
-- Missing: step_id

CREATE INDEX IF NOT EXISTS idx_approval_history_step
  ON approval_history(step_id);

-- =====================================================
-- SECTION 7: Missing FK index on document_requests.file_id
-- =====================================================
-- document_requests has FKs: client_id, project_id, file_id
-- Existing: idx_document_requests_client, idx_document_requests_project,
--           idx_document_requests_status from 043
-- Missing: file_id (used when file is uploaded and linked)

CREATE INDEX IF NOT EXISTS idx_document_requests_file
  ON document_requests(file_id);

-- =====================================================
-- SECTION 8: Missing FK index on invoices columns
-- =====================================================
-- invoices has FKs: milestone_id, payment_plan_id, payment_terms_id
-- Existing: idx_invoices_milestone from 028, idx_invoices_payment_terms from 029
-- Missing: payment_plan_id

CREATE INDEX IF NOT EXISTS idx_invoices_payment_plan
  ON invoices(payment_plan_id);

-- =====================================================
-- SECTION 9: Missing FK index on files.client_id
-- =====================================================
-- files table gained a client_id FK via 067_database_normalization
-- It is queried heavily via WHERE client_id = ? in file-service.ts
-- Existing: idx_files_project_id from 001
-- Missing: client_id (if column exists from normalization)

CREATE INDEX IF NOT EXISTS idx_files_client
  ON files(client_id);

-- =====================================================
-- SECTION 10: Missing composite indexes for common query patterns
-- =====================================================

-- notification_log: Frequently queried by created_at for cleanup/pagination
-- Existing: idx_notification_log_user, idx_notification_log_type, idx_notification_log_status from 044
-- Missing: created_at (used in ORDER BY for log queries)

CREATE INDEX IF NOT EXISTS idx_notification_log_created
  ON notification_log(created_at);

-- notification_digest_queue: created_at for queue ordering
-- Existing: idx_notification_digest_queue_user, idx_notification_digest_queue_processed from 044
-- Missing: created_at

CREATE INDEX IF NOT EXISTS idx_notification_digest_queue_created
  ON notification_digest_queue(created_at);

-- email_send_logs: Composite for recipient + status lookups
-- Existing: idx_email_send_logs_template, idx_email_send_logs_recipient,
--           idx_email_send_logs_status, idx_email_send_logs_date from 064
-- This section is covered.

-- =====================================================
-- SECTION 11: Missing FK indexes on messaging tables
-- =====================================================
-- message_subscriptions has FK: project_id
-- Existing: idx_message_subscriptions_project, idx_message_subscriptions_user from 034
-- This is covered.

-- pinned_messages has FKs: thread_id, message_id
-- Existing: idx_pinned_messages_thread, idx_pinned_messages_message from 034
-- This is covered.

-- =====================================================
-- SECTION 12: Missing indexes on workflow_trigger_logs
-- =====================================================
-- workflow_trigger_logs has FK: trigger_id
-- Existing: idx_workflow_trigger_logs_trigger, idx_workflow_trigger_logs_date from 042
-- Missing: action_result (used to filter by success/failure)

CREATE INDEX IF NOT EXISTS idx_workflow_trigger_logs_result
  ON workflow_trigger_logs(action_result);

-- =====================================================
-- SECTION 13: Frequently filtered status + created_at composites
-- =====================================================
-- These composite indexes support common dashboard and list queries
-- that filter by status AND sort by created_at.

-- notification_history: Filtered by type + unread status (common bell query)
-- Existing: idx_notification_history_user, idx_notification_history_unread,
--           idx_notification_history_created from 092
-- Missing: type-based filtering

CREATE INDEX IF NOT EXISTS idx_notification_history_type
  ON notification_history(type);

-- client_contacts: Composite for client + primary lookup (common detail page query)
-- Existing: idx_client_contacts_client, idx_client_contacts_email, idx_client_contacts_role from 030
-- Missing: client_id + is_primary composite (used in tab-data-service)

CREATE INDEX IF NOT EXISTS idx_client_contacts_client_primary
  ON client_contacts(client_id, is_primary);

-- project_tasks: Composite for project + due_date (upcoming tasks query)
-- Existing: idx_project_tasks_project, idx_project_tasks_due from 031
-- Missing: composite project_id + due_date for scoped task deadline queries

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_due
  ON project_tasks(project_id, due_date);

-- lead_tasks: project_id + status composite (lead detail page)
-- Existing: idx_lead_tasks_project, idx_lead_tasks_status from 033
-- Missing: composite for filtered lead task queries

CREATE INDEX IF NOT EXISTS idx_lead_tasks_project_status
  ON lead_tasks(project_id, status);

-- =====================================================
-- SECTION 14: Missing FK indexes on duplicate tracking
-- =====================================================
-- duplicate_resolution_log has FK: detection_log_id
-- Existing: idx_duplicate_resolution_log_detection_id from 066
-- Missing: primary_record and merged_record lookups

CREATE INDEX IF NOT EXISTS idx_dup_resolution_primary
  ON duplicate_resolution_log(primary_record_id, primary_record_type);

CREATE INDEX IF NOT EXISTS idx_dup_resolution_merged
  ON duplicate_resolution_log(merged_record_id, merged_record_type);

-- =====================================================
-- SECTION 15: Missing FK index on questionnaire_responses
-- =====================================================
-- questionnaire_responses: Composite client_id + status for portal queries
-- Existing: idx_questionnaire_responses_client, idx_questionnaire_responses_status from 057
-- Missing: composite for portal dashboard filtering

CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_client_status
  ON questionnaire_responses(client_id, status);

-- =====================================================
-- SECTION 16: Missing created_at indexes on high-volume tables
-- =====================================================
-- These tables are frequently queried with ORDER BY created_at
-- but lack a standalone created_at index.

-- client_notes: Queried by created_at DESC in detail tabs
-- Existing: idx_client_notes_client, idx_client_notes_pinned from 046
-- Missing: created_at for sorting

CREATE INDEX IF NOT EXISTS idx_client_notes_created
  ON client_notes(created_at);

-- lead_notes: Queried by created_at DESC in lead detail
-- Existing: idx_lead_notes_project, idx_lead_notes_pinned from 033
-- Missing: created_at for sorting

CREATE INDEX IF NOT EXISTS idx_lead_notes_created
  ON lead_notes(created_at);

-- deliverables: created_at for list sorting in project detail
-- Existing: idx_deliverables_project_id, idx_deliverables_status from 073
-- Missing: created_at

CREATE INDEX IF NOT EXISTS idx_deliverables_created
  ON deliverables(created_at);

-- contracts: created_at for list sorting
-- Existing: idx_contracts_project, idx_contracts_client, idx_contracts_status from 052
-- Missing: created_at

CREATE INDEX IF NOT EXISTS idx_contracts_created
  ON contracts(created_at);

-- ad_hoc_requests: Composite client_id + created_at for portal list
-- Existing: idx_ad_hoc_requests_client, idx_ad_hoc_requests_created_at from 056
-- Missing: composite for portal filtering

CREATE INDEX IF NOT EXISTS idx_ad_hoc_requests_client_created
  ON ad_hoc_requests(client_id, created_at);

-- =====================================================
-- SECTION 17: Missing indexes on invoices.due_date
-- =====================================================
-- Invoices are frequently filtered/sorted by due_date (overdue queries,
-- dashboard widgets, reminder scheduling)
-- Existing: various status/client composites from 051
-- Missing: due_date standalone and status + due_date composite

CREATE INDEX IF NOT EXISTS idx_invoices_due_date
  ON invoices(due_date);

CREATE INDEX IF NOT EXISTS idx_invoices_status_due
  ON invoices(status, due_date);

-- =====================================================
-- SECTION 18: Missing index on projects.created_at
-- =====================================================
-- Projects are frequently sorted by created_at in admin lists
-- Existing: idx_projects_client_id, idx_projects_status from 001
-- Missing: created_at

CREATE INDEX IF NOT EXISTS idx_projects_created
  ON projects(created_at);

-- =====================================================
-- SECTION 19: Missing index on clients.created_at
-- =====================================================
-- Clients are sorted by created_at in admin lists and dashboard
-- Existing: idx_clients_email, idx_clients_status from 001
-- Missing: created_at

CREATE INDEX IF NOT EXISTS idx_clients_created
  ON clients(created_at);

-- DOWN

DROP INDEX IF EXISTS idx_clients_created;
DROP INDEX IF EXISTS idx_projects_created;
DROP INDEX IF EXISTS idx_invoices_status_due;
DROP INDEX IF EXISTS idx_invoices_due_date;
DROP INDEX IF EXISTS idx_ad_hoc_requests_client_created;
DROP INDEX IF EXISTS idx_contracts_created;
DROP INDEX IF EXISTS idx_deliverables_created;
DROP INDEX IF EXISTS idx_lead_notes_created;
DROP INDEX IF EXISTS idx_client_notes_created;
DROP INDEX IF EXISTS idx_questionnaire_responses_client_status;
DROP INDEX IF EXISTS idx_dup_resolution_merged;
DROP INDEX IF EXISTS idx_dup_resolution_primary;
DROP INDEX IF EXISTS idx_lead_tasks_project_status;
DROP INDEX IF EXISTS idx_project_tasks_project_due;
DROP INDEX IF EXISTS idx_client_contacts_client_primary;
DROP INDEX IF EXISTS idx_notification_history_type;
DROP INDEX IF EXISTS idx_workflow_trigger_logs_result;
DROP INDEX IF EXISTS idx_notification_digest_queue_created;
DROP INDEX IF EXISTS idx_notification_log_created;
DROP INDEX IF EXISTS idx_files_client;
DROP INDEX IF EXISTS idx_invoices_payment_plan;
DROP INDEX IF EXISTS idx_document_requests_file;
DROP INDEX IF EXISTS idx_approval_history_step;
DROP INDEX IF EXISTS idx_approval_requests_step;
DROP INDEX IF EXISTS idx_approval_instances_definition;
DROP INDEX IF EXISTS idx_client_onboarding_project;
DROP INDEX IF EXISTS idx_receipts_file;
DROP INDEX IF EXISTS idx_contracts_template;
DROP INDEX IF EXISTS idx_recurring_invoices_client;
DROP INDEX IF EXISTS idx_recurring_invoices_project;
DROP INDEX IF EXISTS idx_scheduled_invoices_client;
DROP INDEX IF EXISTS idx_scheduled_invoices_project;
