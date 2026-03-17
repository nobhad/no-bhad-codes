-- Migration: Add project_code to projects + update client_type values
-- Created: 2026-03-16
--
-- 1. Add project_code column (unique identifier like NBC-2026-001-hedgewitch)
-- 2. Update client_type from 'personal'/'business' to 'individual'/'company'

-- =====================================================
-- PART 1: Add project_code to projects
-- =====================================================

ALTER TABLE projects ADD COLUMN project_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_code ON projects(project_code);

-- =====================================================
-- PART 2: Update client_type values
-- =====================================================

-- Map legacy values to new naming convention
UPDATE clients SET client_type = 'individual' WHERE client_type = 'personal';
UPDATE clients SET client_type = 'company' WHERE client_type = 'business';
-- Catch any NULLs
UPDATE clients SET client_type = 'company' WHERE client_type IS NULL;
