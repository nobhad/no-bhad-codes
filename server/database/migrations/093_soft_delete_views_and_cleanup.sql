-- UP

-- Phase 1.1: Clean up duplicate empty message threads (3,4,5,6 are duplicates of thread 2)
DELETE FROM message_threads WHERE id IN (3, 4, 5, 6);

-- Phase 2.1: Add deleted_at/deleted_by to tables missing soft-delete columns
ALTER TABLE message_threads ADD COLUMN deleted_at DATETIME;
ALTER TABLE message_threads ADD COLUMN deleted_by TEXT;

ALTER TABLE document_requests ADD COLUMN deleted_at DATETIME;
ALTER TABLE document_requests ADD COLUMN deleted_by TEXT;

ALTER TABLE contracts ADD COLUMN deleted_at DATETIME;
ALTER TABLE contracts ADD COLUMN deleted_by TEXT;

ALTER TABLE deliverables ADD COLUMN deleted_at DATETIME;
ALTER TABLE deliverables ADD COLUMN deleted_by TEXT;

-- Add indexes on deleted_at for efficient filtering
CREATE INDEX IF NOT EXISTS idx_message_threads_deleted_at ON message_threads(deleted_at);
CREATE INDEX IF NOT EXISTS idx_document_requests_deleted_at ON document_requests(deleted_at);
CREATE INDEX IF NOT EXISTS idx_contracts_deleted_at ON contracts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_deliverables_deleted_at ON deliverables(deleted_at);

-- Phase 2.2: Create active views for automatic soft-delete filtering
-- Services use FROM active_* for reads; writes stay on base tables.
CREATE VIEW IF NOT EXISTS active_clients AS SELECT * FROM clients WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS active_projects AS SELECT * FROM projects WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS active_invoices AS SELECT * FROM invoices WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS active_messages AS SELECT * FROM messages WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS active_message_threads AS SELECT * FROM message_threads WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS active_document_requests AS SELECT * FROM document_requests WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS active_contracts AS SELECT * FROM contracts WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS active_deliverables AS SELECT * FROM deliverables WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS active_ad_hoc_requests AS SELECT * FROM ad_hoc_requests WHERE deleted_at IS NULL;

-- Phase 2.3: Drop deprecated tables from earlier migrations
DROP TABLE IF EXISTS _messages_deprecated_085;
DROP TABLE IF EXISTS _general_messages_deprecated_085;
DROP TABLE IF EXISTS _client_intakes_archived_086;

-- DOWN

-- Drop active views
DROP VIEW IF EXISTS active_ad_hoc_requests;
DROP VIEW IF EXISTS active_deliverables;
DROP VIEW IF EXISTS active_contracts;
DROP VIEW IF EXISTS active_document_requests;
DROP VIEW IF EXISTS active_message_threads;
DROP VIEW IF EXISTS active_messages;
DROP VIEW IF EXISTS active_invoices;
DROP VIEW IF EXISTS active_projects;
DROP VIEW IF EXISTS active_clients;

-- Drop indexes
DROP INDEX IF EXISTS idx_message_threads_deleted_at;
DROP INDEX IF EXISTS idx_document_requests_deleted_at;
DROP INDEX IF EXISTS idx_contracts_deleted_at;
DROP INDEX IF EXISTS idx_deliverables_deleted_at;

-- Note: SQLite does not support DROP COLUMN; rolling back column additions
-- requires recreating tables. The deleted_at/deleted_by columns are harmless
-- if left in place, so we skip table recreation on rollback.
