-- ===============================================
-- SOFT DELETE SYSTEM MIGRATION
-- ===============================================
-- Adds soft delete support (deleted_at, deleted_by) to main entities
-- for 30-day recovery window before permanent deletion.
-- Pattern follows existing general_messages table.

-- Add soft delete columns to clients table
ALTER TABLE clients ADD COLUMN deleted_at DATETIME;
ALTER TABLE clients ADD COLUMN deleted_by TEXT;

-- Add soft delete columns to projects table
ALTER TABLE projects ADD COLUMN deleted_at DATETIME;
ALTER TABLE projects ADD COLUMN deleted_by TEXT;

-- Add soft delete columns to invoices table
ALTER TABLE invoices ADD COLUMN deleted_at DATETIME;
ALTER TABLE invoices ADD COLUMN deleted_by TEXT;

-- Add soft delete columns to client_intakes (leads) table
ALTER TABLE client_intakes ADD COLUMN deleted_at DATETIME;
ALTER TABLE client_intakes ADD COLUMN deleted_by TEXT;

-- Add soft delete columns to proposal_requests table
ALTER TABLE proposal_requests ADD COLUMN deleted_at DATETIME;
ALTER TABLE proposal_requests ADD COLUMN deleted_by TEXT;

-- Performance indexes for filtering out deleted items
CREATE INDEX idx_clients_deleted ON clients(deleted_at);
CREATE INDEX idx_projects_deleted ON projects(deleted_at);
CREATE INDEX idx_invoices_deleted ON invoices(deleted_at);
CREATE INDEX idx_client_intakes_deleted ON client_intakes(deleted_at);
CREATE INDEX idx_proposal_requests_deleted ON proposal_requests(deleted_at);
