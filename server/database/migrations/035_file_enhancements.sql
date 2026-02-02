-- UP
-- Migration: File Management Enhancement
-- Phase 6: Versioning, folders, tags, expiration, archiving
-- Created: 2026-02-01

-- =====================================================
-- FILE VERSIONS
-- =====================================================
-- Track file versions for document management
CREATE TABLE IF NOT EXISTS file_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT,
  comment TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE(file_id, version_number)
);

-- =====================================================
-- FILE FOLDERS
-- =====================================================
-- Organize files into folders within projects
CREATE TABLE IF NOT EXISTS file_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_folder_id INTEGER,
  color TEXT DEFAULT '#6b7280',
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_folder_id) REFERENCES file_folders(id) ON DELETE CASCADE,
  UNIQUE(project_id, parent_folder_id, name)
);

-- =====================================================
-- FILE TAGS
-- =====================================================
-- Junction table for file tagging (uses existing tags table)
CREATE TABLE IF NOT EXISTS file_tags (
  file_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (file_id, tag_id),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- =====================================================
-- FILE ACCESS LOG
-- =====================================================
-- Track file views and downloads
CREATE TABLE IF NOT EXISTS file_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,       -- 'admin', 'client'
  access_type TEXT NOT NULL,     -- 'view', 'download', 'preview'
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- =====================================================
-- FILE COMMENTS
-- =====================================================
-- Comments on files for collaboration
CREATE TABLE IF NOT EXISTS file_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  author_email TEXT NOT NULL,
  author_type TEXT NOT NULL,     -- 'admin', 'client'
  author_name TEXT,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  parent_comment_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_comment_id) REFERENCES file_comments(id) ON DELETE CASCADE
);

-- =====================================================
-- UPDATE FILES TABLE
-- =====================================================
-- Add new columns for enhanced file management
ALTER TABLE files ADD COLUMN folder_id INTEGER REFERENCES file_folders(id) ON DELETE SET NULL;
ALTER TABLE files ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE files ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE files ADD COLUMN archived_at DATETIME;
ALTER TABLE files ADD COLUMN archived_by TEXT;
ALTER TABLE files ADD COLUMN expires_at DATETIME;
ALTER TABLE files ADD COLUMN access_count INTEGER DEFAULT 0;
ALTER TABLE files ADD COLUMN last_accessed_at DATETIME;
ALTER TABLE files ADD COLUMN download_count INTEGER DEFAULT 0;
ALTER TABLE files ADD COLUMN checksum TEXT;
ALTER TABLE files ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE files ADD COLUMN locked_by TEXT;
ALTER TABLE files ADD COLUMN locked_at DATETIME;
ALTER TABLE files ADD COLUMN category TEXT DEFAULT 'general';  -- 'general', 'deliverable', 'source', 'asset', 'document', 'contract', 'invoice'

-- =====================================================
-- SEED DEFAULT FILE TAGS
-- =====================================================
-- Insert file-specific tags (reuse existing tags table)
INSERT OR IGNORE INTO tags (name, color) VALUES
('Final', '#10B981'),
('Draft', '#F59E0B'),
('Review', '#3B82F6'),
('Approved', '#10B981'),
('Revision', '#EF4444'),
('Archive', '#6B7280'),
('Confidential', '#7C3AED'),
('Client Provided', '#EC4899');

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_file_versions_file ON file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_current ON file_versions(file_id, is_current);

CREATE INDEX IF NOT EXISTS idx_file_folders_project ON file_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_file_folders_parent ON file_folders(parent_folder_id);

CREATE INDEX IF NOT EXISTS idx_file_tags_file ON file_tags(file_id);
CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_file_access_log_file ON file_access_log(file_id);
CREATE INDEX IF NOT EXISTS idx_file_access_log_user ON file_access_log(user_email);
CREATE INDEX IF NOT EXISTS idx_file_access_log_date ON file_access_log(created_at);

CREATE INDEX IF NOT EXISTS idx_file_comments_file ON file_comments(file_id);
CREATE INDEX IF NOT EXISTS idx_file_comments_author ON file_comments(author_email);

CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_archived ON files(is_archived);
CREATE INDEX IF NOT EXISTS idx_files_expires ON files(expires_at);
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
CREATE INDEX IF NOT EXISTS idx_files_locked ON files(is_locked);

-- DOWN
-- Rollback: Drop all new tables and indexes

DROP INDEX IF EXISTS idx_files_locked;
DROP INDEX IF EXISTS idx_files_category;
DROP INDEX IF EXISTS idx_files_expires;
DROP INDEX IF EXISTS idx_files_archived;
DROP INDEX IF EXISTS idx_files_folder;

DROP INDEX IF EXISTS idx_file_comments_author;
DROP INDEX IF EXISTS idx_file_comments_file;

DROP INDEX IF EXISTS idx_file_access_log_date;
DROP INDEX IF EXISTS idx_file_access_log_user;
DROP INDEX IF EXISTS idx_file_access_log_file;

DROP INDEX IF EXISTS idx_file_tags_tag;
DROP INDEX IF EXISTS idx_file_tags_file;

DROP INDEX IF EXISTS idx_file_folders_parent;
DROP INDEX IF EXISTS idx_file_folders_project;

DROP INDEX IF EXISTS idx_file_versions_current;
DROP INDEX IF EXISTS idx_file_versions_file;

DROP TABLE IF EXISTS file_comments;
DROP TABLE IF EXISTS file_access_log;
DROP TABLE IF EXISTS file_tags;
DROP TABLE IF EXISTS file_folders;
DROP TABLE IF EXISTS file_versions;

-- Note: SQLite doesn't support DROP COLUMN, so files table columns would remain
