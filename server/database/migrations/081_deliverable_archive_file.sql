-- Migration: Deliverable to Files Archive Integration
-- Adds archived_file_id to link approved/locked deliverables to files table
-- When a deliverable is approved and locked, its file is archived to the Files tab

-- UP

-- Add archived_file_id column - references the file record created in the Files tab
ALTER TABLE deliverables ADD COLUMN archived_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL;

-- Index for efficient lookups of deliverables by archived file
CREATE INDEX IF NOT EXISTS idx_deliverables_archived_file ON deliverables(archived_file_id);

-- DOWN

DROP INDEX IF EXISTS idx_deliverables_archived_file;

-- Note: SQLite doesn't support DROP COLUMN
-- archived_file_id column would remain but be unused
