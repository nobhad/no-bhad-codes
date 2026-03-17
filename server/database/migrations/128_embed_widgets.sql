-- Migration: Create embed_configurations and project_status_tokens tables
-- Created: 2026-03-17
-- Required for: Phase 5B - Embeddable Widgets

-- UP

-- =====================================================
-- EMBED CONFIGURATIONS TABLE
-- =====================================================
-- Widget configuration storage for admin-managed embeddable
-- widgets (contact form, testimonial carousel, status badge).
-- Each configuration gets a unique token for public access.

CREATE TABLE IF NOT EXISTS embed_configurations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  widget_type TEXT NOT NULL CHECK(widget_type IN ('contact_form', 'testimonials', 'status_badge')),
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  config TEXT NOT NULL DEFAULT '{}',
  allowed_domains TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================
-- PROJECT STATUS TOKENS TABLE
-- =====================================================
-- Public tokens for individual project status badges.
-- Allows external sites to display project progress.

CREATE TABLE IF NOT EXISTS project_status_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_embed_configurations_token ON embed_configurations(token);
CREATE INDEX IF NOT EXISTS idx_embed_configurations_type ON embed_configurations(widget_type, is_active);
CREATE INDEX IF NOT EXISTS idx_project_status_tokens_token ON project_status_tokens(token);

-- DOWN
DROP INDEX IF EXISTS idx_project_status_tokens_token;
DROP INDEX IF EXISTS idx_embed_configurations_type;
DROP INDEX IF EXISTS idx_embed_configurations_token;
DROP TABLE IF EXISTS project_status_tokens;
DROP TABLE IF EXISTS embed_configurations;
