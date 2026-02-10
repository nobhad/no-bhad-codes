-- UP
-- Add attachment support for ad hoc requests
ALTER TABLE ad_hoc_requests ADD COLUMN attachment_file_id INTEGER;

-- Index for attachment lookups
CREATE INDEX IF NOT EXISTS idx_ad_hoc_requests_attachment ON ad_hoc_requests(attachment_file_id);

-- DOWN
DROP INDEX IF EXISTS idx_ad_hoc_requests_attachment;
-- SQLite does not support dropping columns without table rebuild
