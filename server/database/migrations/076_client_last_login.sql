-- UP
-- Add last_login column to clients table for tracking login history
-- Used to determine first login vs returning user for portal greeting

ALTER TABLE clients ADD COLUMN last_login DATETIME DEFAULT NULL;

-- Create index for potential queries filtering by last login
CREATE INDEX IF NOT EXISTS idx_clients_last_login ON clients(last_login);

-- DOWN
DROP INDEX IF EXISTS idx_clients_last_login;
-- SQLite doesn't support DROP COLUMN directly, would need table recreation
