-- Migration 088: Create client_onboarding_progress table for index
-- Created: 2026-02-15
-- Minimal schema to unblock migration 089

CREATE TABLE IF NOT EXISTS client_onboarding_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  status TEXT DEFAULT 'not_started'
);

-- DOWN
DROP TABLE IF EXISTS client_onboarding_progress;
