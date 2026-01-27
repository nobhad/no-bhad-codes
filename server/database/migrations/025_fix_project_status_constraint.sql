-- UP
-- Migration: Add cancelled_by column to projects table
-- Tracks who initiated a project cancellation (admin or client)
-- Created: 2026-01-27

-- Add cancelled_by column (who initiated: 'admin' or 'client')
ALTER TABLE projects ADD COLUMN cancelled_by TEXT;

-- Add cancellation_reason column (free text explanation)
ALTER TABLE projects ADD COLUMN cancellation_reason TEXT;

-- Note: The CHECK constraint on status column in 001_initial_schema.sql
-- only allows: 'pending', 'in-progress', 'in-review', 'completed', 'on-hold'
-- The API also uses 'active' and 'cancelled' which may require recreating
-- the table in a future migration if CHECK constraints are enforced.
-- For now, SQLite may ignore the CHECK constraint for new values.

-- DOWN
-- ALTER TABLE projects DROP COLUMN cancelled_by;
-- (Note: SQLite doesn't support DROP COLUMN in older versions)
