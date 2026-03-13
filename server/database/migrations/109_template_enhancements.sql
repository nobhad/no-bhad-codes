-- Enhance project templates with content requests, payment schedules, tiers, and contract linking

ALTER TABLE project_templates ADD COLUMN default_content_requests JSON;
ALTER TABLE project_templates ADD COLUMN default_payment_schedule JSON;
ALTER TABLE project_templates ADD COLUMN contract_template_id INTEGER REFERENCES contract_templates(id);
ALTER TABLE project_templates ADD COLUMN tier_definitions JSON;

-- DOWN
-- SQLite doesn't support DROP COLUMN, but these columns are nullable JSON
-- so they can be ignored if rollback is needed
