-- Migration 133: Email dedupe store for outbox retries
-- Lets async_tasks handlers skip already-sent notifications when a task
-- retries after a crash between "send succeeded" and "task marked completed".

CREATE TABLE IF NOT EXISTS email_dedupe (
  dedupe_key TEXT PRIMARY KEY NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_dedupe_sent_at
  ON email_dedupe(sent_at);
