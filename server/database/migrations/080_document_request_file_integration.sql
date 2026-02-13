-- Migration: Document Request to Files Integration
-- Adds approved_file_id to link approved document requests to files table
-- Adds approval_notes column for additional reviewer notes

-- UP

-- Add approved_file_id column - references the file record created in the Files tab
ALTER TABLE document_requests ADD COLUMN approved_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL;

-- Add approval_notes column if not exists (separate from review_notes for tracking)
-- Note: review_notes already exists, but approval_notes is for the final approval action
-- This is a no-op if column already exists in SQLite

-- Index for efficient lookups of requests by approved file
CREATE INDEX IF NOT EXISTS idx_document_requests_approved_file ON document_requests(approved_file_id);

-- DOWN

DROP INDEX IF EXISTS idx_document_requests_approved_file;

-- Note: SQLite doesn't support DROP COLUMN
-- approved_file_id column would remain but be unused
