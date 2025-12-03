-- Migration: Add intake form columns to projects table
-- Created: 2025-12-03

-- Up
ALTER TABLE projects ADD COLUMN features TEXT;
ALTER TABLE projects ADD COLUMN design_level TEXT;
ALTER TABLE projects ADD COLUMN content_status TEXT;
ALTER TABLE projects ADD COLUMN tech_comfort TEXT;
ALTER TABLE projects ADD COLUMN hosting_preference TEXT;
ALTER TABLE projects ADD COLUMN page_count TEXT;
ALTER TABLE projects ADD COLUMN integrations TEXT;
ALTER TABLE projects ADD COLUMN brand_assets TEXT;
ALTER TABLE projects ADD COLUMN inspiration TEXT;
ALTER TABLE projects ADD COLUMN current_site TEXT;
ALTER TABLE projects ADD COLUMN challenges TEXT;
ALTER TABLE projects ADD COLUMN additional_info TEXT;
ALTER TABLE projects ADD COLUMN addons TEXT;
ALTER TABLE projects ADD COLUMN referral_source TEXT;

-- Down
-- SQLite doesn't support DROP COLUMN in older versions
-- To rollback, would need to recreate the table without these columns
