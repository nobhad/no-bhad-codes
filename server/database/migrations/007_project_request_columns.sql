-- Migration: Add project request columns to projects table
-- Version: 007
-- Date: December 1, 2025

-- UP
-- Add columns for project requests from clients
ALTER TABLE projects ADD COLUMN project_type TEXT;
ALTER TABLE projects ADD COLUMN budget_range TEXT;
ALTER TABLE projects ADD COLUMN timeline TEXT;
ALTER TABLE projects ADD COLUMN preview_url TEXT;

-- DOWN
-- SQLite doesn't support DROP COLUMN in older versions
-- To rollback, would need to recreate the table without these columns
