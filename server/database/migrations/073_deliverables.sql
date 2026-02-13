-- Migration: Deliverables System
-- Creates tables for deliverable management, versioning, comments, and review workflow

-- UP

-- Main deliverables table
CREATE TABLE IF NOT EXISTS deliverables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'design',
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  round_number INTEGER NOT NULL DEFAULT 1,
  created_by_id INTEGER NOT NULL,
  reviewed_by_id INTEGER,
  review_deadline DATETIME,
  approved_at DATETIME,
  locked INTEGER NOT NULL DEFAULT 0,
  tags TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Deliverable versions table (file uploads per version)
CREATE TABLE IF NOT EXISTS deliverable_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deliverable_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by_id INTEGER NOT NULL,
  change_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE,
  UNIQUE(deliverable_id, version_number)
);

-- Deliverable comments and annotations table
CREATE TABLE IF NOT EXISTS deliverable_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deliverable_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  comment_text TEXT NOT NULL,
  x_position INTEGER,
  y_position INTEGER,
  annotation_type TEXT DEFAULT 'text',
  element_id TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE
);

-- Design elements table (logo, homepage, inner_pages, etc)
CREATE TABLE IF NOT EXISTS design_elements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deliverable_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  revision_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE,
  UNIQUE(deliverable_id, name)
);

-- Deliverable reviews table
CREATE TABLE IF NOT EXISTS deliverable_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deliverable_id INTEGER NOT NULL,
  reviewer_id INTEGER NOT NULL,
  decision TEXT NOT NULL,
  feedback TEXT,
  design_elements_reviewed TEXT DEFAULT '[]',
  review_duration_minutes INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deliverables_project_id ON deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_status ON deliverables(status);
CREATE INDEX IF NOT EXISTS idx_deliverables_approval_status ON deliverables(approval_status);
CREATE INDEX IF NOT EXISTS idx_deliverable_versions_deliverable_id ON deliverable_versions(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_comments_deliverable_id ON deliverable_comments(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_design_elements_deliverable_id ON design_elements(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_reviews_deliverable_id ON deliverable_reviews(deliverable_id);

-- DOWN

DROP INDEX IF EXISTS idx_deliverable_reviews_deliverable_id;
DROP INDEX IF EXISTS idx_design_elements_deliverable_id;
DROP INDEX IF EXISTS idx_deliverable_comments_deliverable_id;
DROP INDEX IF EXISTS idx_deliverable_versions_deliverable_id;
DROP INDEX IF EXISTS idx_deliverables_approval_status;
DROP INDEX IF EXISTS idx_deliverables_status;
DROP INDEX IF EXISTS idx_deliverables_project_id;

DROP TABLE IF EXISTS deliverable_reviews;
DROP TABLE IF EXISTS design_elements;
DROP TABLE IF EXISTS deliverable_comments;
DROP TABLE IF EXISTS deliverable_versions;
DROP TABLE IF EXISTS deliverables;
