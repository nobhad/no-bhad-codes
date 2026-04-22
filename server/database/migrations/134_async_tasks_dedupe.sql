-- Migration 134: Task-level dedupe for the async_tasks outbox
--
-- Prevents duplicate *active* tasks with the same semantic key (e.g.
-- "intake-admin-notification:42") from being enqueued. Paired with the
-- email-level dedupe in migration 133, the layered protection is:
--   * enqueue time — no second row lands if an equivalent one is still
--     pending/running (this migration)
--   * execute time — already-sent emails short-circuit on retry
--     (migration 133)
--
-- The uniqueness is scoped to active states only. Once a task reaches
-- completed/failed/dead, the same dedupe_key can be re-used so genuinely
-- new work isn't blocked by historical rows.

ALTER TABLE async_tasks ADD COLUMN dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_async_tasks_dedupe_active
  ON async_tasks(dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('pending', 'running');
