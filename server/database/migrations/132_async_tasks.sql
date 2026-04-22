-- Migration 132: Durable async task outbox
-- Replaces fire-and-forget setTimeout() patterns so follow-up work
-- (notifications, lead scoring, file generation) can be retried
-- instead of silently lost when a worker crashes mid-flight.

CREATE TABLE IF NOT EXISTS async_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_async_tasks_ready
  ON async_tasks(status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_async_tasks_type
  ON async_tasks(task_type, status);
