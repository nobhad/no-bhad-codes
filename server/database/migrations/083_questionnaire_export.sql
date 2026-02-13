-- UP
-- Migration: Questionnaire Export to Files
-- Add exported_file_id column to questionnaire_responses table
-- Created: 2026-02-11

-- Track exported PDF file for questionnaire responses
ALTER TABLE questionnaire_responses ADD COLUMN exported_file_id INTEGER REFERENCES files(id);

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_exported_file ON questionnaire_responses(exported_file_id);

-- DOWN
DROP INDEX IF EXISTS idx_questionnaire_responses_exported_file;
-- Note: SQLite doesn't support DROP COLUMN directly
-- ALTER TABLE questionnaire_responses DROP COLUMN exported_file_id;
