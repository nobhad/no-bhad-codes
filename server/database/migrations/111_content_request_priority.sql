-- Add priority field to content request items
-- Uses shared PRIORITY_LEVELS from constants.ts

ALTER TABLE content_request_items ADD COLUMN priority TEXT DEFAULT 'normal';

-- DOWN
-- SQLite doesn't support DROP COLUMN; column is nullable so can be ignored
