-- Migration: Create feedback_surveys, feedback_responses, and testimonials tables
-- Created: 2026-03-17
-- Required for: Phase 5A - Feedback Surveys and Testimonial Collection

-- UP

-- =====================================================
-- FEEDBACK SURVEYS TABLE
-- =====================================================
-- Survey instances sent to clients after project completion,
-- milestones, or quarterly NPS checks. Each survey gets a
-- unique token for unauthenticated email-link access.

CREATE TABLE IF NOT EXISTS feedback_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  client_id INTEGER NOT NULL,
  survey_type TEXT NOT NULL DEFAULT 'project_completion' CHECK(survey_type IN ('project_completion', 'milestone_check_in', 'nps_quarterly')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'completed', 'expired')),
  token TEXT NOT NULL UNIQUE,
  sent_at TEXT,
  completed_at TEXT,
  expires_at TEXT,
  reminder_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- =====================================================
-- FEEDBACK RESPONSES TABLE
-- =====================================================
-- One response per survey (1:1 via UNIQUE constraint).
-- Captures star ratings, NPS score, and optional testimonial.

CREATE TABLE IF NOT EXISTS feedback_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL UNIQUE,
  overall_rating INTEGER CHECK(overall_rating BETWEEN 1 AND 5),
  nps_score INTEGER CHECK(nps_score BETWEEN 0 AND 10),
  communication_rating INTEGER CHECK(communication_rating BETWEEN 1 AND 5),
  quality_rating INTEGER CHECK(quality_rating BETWEEN 1 AND 5),
  timeliness_rating INTEGER CHECK(timeliness_rating BETWEEN 1 AND 5),
  highlights TEXT,
  improvements TEXT,
  testimonial_text TEXT,
  testimonial_approved INTEGER NOT NULL DEFAULT 0,
  allow_name_use INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (survey_id) REFERENCES feedback_surveys(id)
);

-- =====================================================
-- TESTIMONIALS TABLE
-- =====================================================
-- Curated testimonials from survey responses or manually
-- created by admin. Supports approval workflow and
-- featured flagging for public display.

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_response_id INTEGER,
  client_id INTEGER NOT NULL,
  project_id INTEGER,
  text TEXT NOT NULL,
  client_name TEXT NOT NULL,
  company_name TEXT,
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review', 'approved', 'published', 'rejected')),
  featured INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (feedback_response_id) REFERENCES feedback_responses(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_feedback_surveys_client ON feedback_surveys(client_id);
CREATE INDEX IF NOT EXISTS idx_feedback_surveys_token ON feedback_surveys(token);
CREATE INDEX IF NOT EXISTS idx_feedback_surveys_status ON feedback_surveys(status);
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials(status);
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON testimonials(featured, status);

-- DOWN
DROP INDEX IF EXISTS idx_testimonials_featured;
DROP INDEX IF EXISTS idx_testimonials_status;
DROP INDEX IF EXISTS idx_feedback_surveys_status;
DROP INDEX IF EXISTS idx_feedback_surveys_token;
DROP INDEX IF EXISTS idx_feedback_surveys_client;
DROP TABLE IF EXISTS testimonials;
DROP TABLE IF EXISTS feedback_responses;
DROP TABLE IF EXISTS feedback_surveys;
