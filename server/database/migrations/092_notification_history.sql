-- ===============================================
-- NOTIFICATION HISTORY TABLE
-- ===============================================
-- Migration: 092_notification_history.sql
-- Description: Create notification_history table for storing notification history
-- Created: 2026-02-27
--
-- Purpose:
-- - Store notification history for both admin and client users
-- - Support the notification bell feature in admin portal
-- - Track read/unread status and notification metadata

-- Create notification_history table
CREATE TABLE IF NOT EXISTS notification_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL CHECK(user_type IN ('admin', 'client')),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data TEXT, -- JSON data for additional notification metadata
  is_read INTEGER DEFAULT 0,
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_history_user
  ON notification_history(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_notification_history_unread
  ON notification_history(user_id, user_type, is_read);
CREATE INDEX IF NOT EXISTS idx_notification_history_created
  ON notification_history(created_at DESC);
