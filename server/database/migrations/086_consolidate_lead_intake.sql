-- =====================================================
-- Migration 086: Consolidate Lead/Intake Tables
-- =====================================================
-- Phase 4 of Backend Cleanup
--
-- Current State:
--   - `client_intakes` table exists but is ORPHANED
--   - Intake submissions now go directly to `projects` table
--   - Some services still reference `client_intakes` (need updates)
--
-- Target State:
--   - `projects` table is single source for leads/intakes
--   - Add `source_type` to track how project was created
--   - Archive `client_intakes` table (keep for historical reference)
--
-- Date: 2026-02-12
-- =====================================================

-- UP

-- =====================================================
-- SECTION 1: Add source_type column to projects
-- =====================================================
-- Tracks where the project/lead originated from

ALTER TABLE projects ADD COLUMN source_type TEXT DEFAULT 'direct'
  CHECK (source_type IN ('direct', 'intake_form', 'referral', 'import', 'other'));

-- =====================================================
-- SECTION 2: Add intake_id for historical reference
-- =====================================================
-- Links to legacy client_intakes record if one exists

ALTER TABLE projects ADD COLUMN intake_id INTEGER REFERENCES client_intakes(id);

-- =====================================================
-- SECTION 3: Create index for source_type queries
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_projects_source_type ON projects(source_type);

-- =====================================================
-- SECTION 4: Update existing intake-sourced projects
-- =====================================================
-- Mark projects that were created via intake form submission
-- (projects created from intake have notes with "Features:" or similar)

UPDATE projects
SET source_type = 'intake_form'
WHERE status IN ('pending', 'new')
  AND (
    notes LIKE '%Features:%'
    OR notes LIKE '%Tech comfort:%'
    OR notes LIKE '%Design level:%'
    OR description IS NOT NULL
  )
  AND source_type = 'direct';

-- =====================================================
-- SECTION 5: Archive client_intakes table
-- =====================================================
-- Rename to indicate it's deprecated and for historical reference only

ALTER TABLE client_intakes RENAME TO _client_intakes_archived_086;

-- =====================================================
-- SECTION 6: Create view for backward compatibility
-- =====================================================
-- Services that query client_intakes can use this view until updated

CREATE VIEW client_intakes AS
SELECT
  p.id,
  COALESCE(c.company_name, c.contact_name, '') as company_name,
  COALESCE(c.contact_name, '') as contact_name,
  '' as first_name,
  '' as last_name,
  COALESCE(c.email, '') as email,
  COALESCE(c.phone, '') as phone,
  p.project_type,
  p.budget_range,
  p.timeline,
  p.description as project_description,
  p.notes as additional_info,
  CASE
    WHEN p.status = 'pending' THEN 'pending'
    WHEN p.status = 'new' THEN 'pending'
    WHEN p.status IN ('in-progress', 'in-review') THEN 'accepted'
    WHEN p.status = 'completed' THEN 'converted'
    WHEN p.status = 'cancelled' THEN 'rejected'
    ELSE 'pending'
  END as status,
  NULL as reviewed_by,
  NULL as reviewed_at,
  p.client_id,
  p.id as project_id,
  p.notes,
  p.created_at,
  p.updated_at,
  p.deleted_at,
  p.deleted_by
FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
WHERE p.source_type = 'intake_form'
  OR p.status IN ('pending', 'new');

-- =====================================================
-- Migration Notes
-- =====================================================
--
-- After this migration:
-- 1. Use `projects` table for all lead/intake queries
-- 2. Filter by `source_type = 'intake_form'` for intake-sourced leads
-- 3. The `client_intakes` view provides backward compatibility
-- 4. Original table archived as `_client_intakes_archived_086`
--
-- Code changes needed:
-- 1. soft-delete-service.ts: Update lead queries to use projects
-- 2. duplicate-detection-service.ts: Update to use projects
-- 3. analytics-service.ts: Update intake counts to use projects
-- 4. Update intake.ts to set source_type='intake_form' on new projects
--
-- Drop the view after all services updated:
-- DROP VIEW IF EXISTS client_intakes;
-- =====================================================

-- DOWN

-- Restore original table
ALTER TABLE _client_intakes_archived_086 RENAME TO client_intakes;

-- Drop backward compatibility view
DROP VIEW IF EXISTS client_intakes;

-- Remove new columns (SQLite doesn't support DROP COLUMN easily)
-- Would need to recreate projects table to fully reverse
