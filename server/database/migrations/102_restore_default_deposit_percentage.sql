-- Migration 102: Restore default_deposit_percentage column to projects
-- Reason: Migration 049 recreated the projects table from migrations 001-031
--         but omitted default_deposit_percentage (added in migration 027),
--         silently dropping the column. This restores it.

ALTER TABLE projects ADD COLUMN default_deposit_percentage DECIMAL(5, 2) DEFAULT 50;
