-- Migration: Create ai_usage_log and ai_response_cache tables
-- Created: 2026-03-17
-- Required for: Phase 6 - AI-Powered Features

-- UP

-- =====================================================
-- AI USAGE LOG TABLE
-- =====================================================
-- Tracks every AI API call for billing, analytics,
-- and budget enforcement.

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_type TEXT NOT NULL CHECK(request_type IN ('draft_proposal', 'draft_email', 'search')),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_cents REAL NOT NULL,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  entity_type TEXT,
  entity_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================
-- AI RESPONSE CACHE TABLE
-- =====================================================
-- Caches AI responses keyed by input hash to avoid
-- redundant API calls for identical contexts.

CREATE TABLE IF NOT EXISTS ai_response_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  context_hash TEXT NOT NULL UNIQUE,
  request_type TEXT NOT NULL,
  response_json TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_type ON ai_usage_log(request_type);
CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON ai_response_cache(context_hash);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_response_cache(expires_at);

-- DOWN
DROP INDEX IF EXISTS idx_ai_cache_expires;
DROP INDEX IF EXISTS idx_ai_cache_hash;
DROP INDEX IF EXISTS idx_ai_usage_type;
DROP INDEX IF EXISTS idx_ai_usage_date;
DROP TABLE IF EXISTS ai_response_cache;
DROP TABLE IF EXISTS ai_usage_log;
