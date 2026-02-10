-- UP
-- Link ad hoc requests to project tasks
ALTER TABLE ad_hoc_requests ADD COLUMN task_id INTEGER;
ALTER TABLE ad_hoc_requests ADD COLUMN converted_at DATETIME;
ALTER TABLE ad_hoc_requests ADD COLUMN converted_by TEXT;

CREATE INDEX IF NOT EXISTS idx_ad_hoc_requests_task_id ON ad_hoc_requests(task_id);

-- DOWN
DROP INDEX IF EXISTS idx_ad_hoc_requests_task_id;
-- SQLite does not support dropping columns without table rebuild
