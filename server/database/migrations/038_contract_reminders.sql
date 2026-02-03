-- =====================================================
-- Migration 038: Contract Reminder System
-- =====================================================
-- Adds table for tracking contract signing reminders
-- =====================================================

-- ===============================================
-- CONTRACT REMINDERS TABLE
-- ===============================================
-- Tracks scheduled and sent contract signing reminders
CREATE TABLE IF NOT EXISTS contract_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  reminder_type TEXT NOT NULL,  -- 'initial', 'followup_3', 'followup_7', 'final_14'
  scheduled_date DATE NOT NULL,
  sent_at DATETIME,
  status TEXT DEFAULT 'pending',  -- 'pending', 'sent', 'skipped', 'failed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ===============================================
-- PERFORMANCE INDEXES
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_contract_reminders_project ON contract_reminders(project_id);
CREATE INDEX IF NOT EXISTS idx_contract_reminders_status ON contract_reminders(status, scheduled_date);

-- ===============================================
-- ADD REMINDER CONFIG TO PROJECTS
-- ===============================================
-- Track if reminders are enabled for this project
ALTER TABLE projects ADD COLUMN contract_reminders_enabled BOOLEAN DEFAULT TRUE;
