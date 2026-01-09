-- Migration: Create uploaded_files table
-- Created: 2026-01-09
-- Required for file upload functionality in api.ts

-- UP
CREATE TABLE IF NOT EXISTS uploaded_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_uploaded_files_filename ON uploaded_files(filename);

-- DOWN
DROP INDEX IF EXISTS idx_uploaded_files_filename;
DROP TABLE IF EXISTS uploaded_files;
