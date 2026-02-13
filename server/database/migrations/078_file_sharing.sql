-- Migration: Add file sharing columns for client portal access
-- Allows admin to share specific files with clients

-- Add sharing columns to files table
ALTER TABLE files ADD COLUMN shared_with_client BOOLEAN DEFAULT FALSE;
ALTER TABLE files ADD COLUMN shared_at DATETIME;
ALTER TABLE files ADD COLUMN shared_by TEXT;

-- Index for efficient client portal file queries
CREATE INDEX IF NOT EXISTS idx_files_shared_with_client
  ON files(shared_with_client) WHERE shared_with_client = TRUE;
