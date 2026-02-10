-- UP
-- Migration: Client Onboarding Progress
-- Tracks client onboarding wizard progress and info completeness
-- Created: 2026-02-10

-- =====================================================
-- CLIENT ONBOARDING
-- =====================================================
-- Track progress through onboarding wizard
CREATE TABLE IF NOT EXISTS client_onboarding (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,               -- One record per client
  project_id INTEGER,                              -- Associated project if any
  current_step INTEGER DEFAULT 1,                  -- Current step (1-5)
  step_data JSON DEFAULT '{}',                     -- Data collected at each step
  status TEXT DEFAULT 'not_started',               -- 'not_started', 'in_progress', 'completed'
  completed_at DATETIME,                           -- When onboarding finished
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- =====================================================
-- CLIENT INFO COMPLETENESS
-- =====================================================
-- Cached completeness calculations for dashboard
CREATE TABLE IF NOT EXISTS client_info_completeness (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,               -- One record per client
  overall_percentage INTEGER DEFAULT 0,            -- 0-100 percentage complete
  profile_complete BOOLEAN DEFAULT FALSE,          -- Basic profile filled
  documents_pending INTEGER DEFAULT 0,             -- Count of pending doc requests
  documents_approved INTEGER DEFAULT 0,            -- Count of approved doc requests
  documents_total INTEGER DEFAULT 0,               -- Total doc requests
  questionnaires_pending INTEGER DEFAULT 0,        -- Count of pending questionnaires
  questionnaires_completed INTEGER DEFAULT 0,      -- Count of completed questionnaires
  questionnaires_total INTEGER DEFAULT 0,          -- Total questionnaires
  onboarding_complete BOOLEAN DEFAULT FALSE,       -- Onboarding wizard done
  last_calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_client_onboarding_client ON client_onboarding(client_id);
CREATE INDEX IF NOT EXISTS idx_client_onboarding_status ON client_onboarding(status);
CREATE INDEX IF NOT EXISTS idx_client_info_completeness_client ON client_info_completeness(client_id);
CREATE INDEX IF NOT EXISTS idx_client_info_completeness_percentage ON client_info_completeness(overall_percentage);

-- DOWN
DROP INDEX IF EXISTS idx_client_info_completeness_percentage;
DROP INDEX IF EXISTS idx_client_info_completeness_client;
DROP INDEX IF EXISTS idx_client_onboarding_status;
DROP INDEX IF EXISTS idx_client_onboarding_client;

DROP TABLE IF EXISTS client_info_completeness;
DROP TABLE IF EXISTS client_onboarding;
