-- Migration: Create meeting_requests table for client meeting scheduling
-- Created: 2026-03-17
-- Required for: Phase 2B - Meeting Request System

-- UP

-- =====================================================
-- MEETING REQUESTS TABLE
-- =====================================================
-- Stores client-submitted meeting requests with preferred time slots,
-- admin confirmation workflow, and calendar integration support.
CREATE TABLE IF NOT EXISTS meeting_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  project_id INTEGER,
  meeting_type TEXT NOT NULL DEFAULT 'consultation'
    CHECK (meeting_type IN ('discovery_call', 'consultation', 'project_kickoff', 'check_in', 'review', 'other')),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'confirmed', 'declined', 'rescheduled', 'completed', 'cancelled')),
  preferred_slot_1 TEXT,
  preferred_slot_2 TEXT,
  preferred_slot_3 TEXT,
  confirmed_datetime TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  location_type TEXT DEFAULT 'zoom'
    CHECK (location_type IN ('zoom', 'google_meet', 'phone', 'in_person', 'other')),
  location_details TEXT,
  client_notes TEXT,
  admin_notes TEXT,
  decline_reason TEXT,
  calendar_event_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  confirmed_at TEXT,
  completed_at TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_meeting_requests_client ON meeting_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_status ON meeting_requests(status);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_confirmed_datetime ON meeting_requests(confirmed_datetime);

-- DOWN
DROP INDEX IF EXISTS idx_meeting_requests_confirmed_datetime;
DROP INDEX IF EXISTS idx_meeting_requests_status;
DROP INDEX IF EXISTS idx_meeting_requests_client;
DROP TABLE IF EXISTS meeting_requests;
