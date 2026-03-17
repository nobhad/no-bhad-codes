-- =============================================
-- MAINTENANCE TIER ACTIVATION
-- =============================================
-- Adds maintenance tracking columns to projects table.
-- maintenance_option is copied from proposal on acceptance.
-- maintenance_status is activated on project completion.
-- recurring_invoice_id links to the auto-created recurring invoice.

ALTER TABLE projects ADD COLUMN maintenance_tier TEXT
  CHECK(maintenance_tier IN ('diy', 'essential', 'standard', 'premium'));

ALTER TABLE projects ADD COLUMN maintenance_status TEXT DEFAULT 'inactive'
  CHECK(maintenance_status IN ('inactive', 'pending', 'active', 'paused', 'cancelled'));

ALTER TABLE projects ADD COLUMN maintenance_start_date TEXT;

ALTER TABLE projects ADD COLUMN maintenance_recurring_invoice_id INTEGER
  REFERENCES recurring_invoices(id);

ALTER TABLE projects ADD COLUMN maintenance_included_months INTEGER DEFAULT 0;

ALTER TABLE projects ADD COLUMN maintenance_included_until TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_maintenance
  ON projects(maintenance_status, maintenance_tier);
