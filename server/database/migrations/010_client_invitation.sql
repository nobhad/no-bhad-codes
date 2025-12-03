-- Migration: Add invitation fields to clients
-- Created: 2025-12-03

-- Up
ALTER TABLE clients ADD COLUMN invitation_token TEXT;
ALTER TABLE clients ADD COLUMN invitation_expires_at DATETIME;
ALTER TABLE clients ADD COLUMN invitation_sent_at DATETIME;
ALTER TABLE clients ADD COLUMN last_login_at DATETIME;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_clients_invitation_token ON clients(invitation_token);

-- Down
-- SQLite doesn't support DROP COLUMN in older versions
-- To rollback, would need to recreate the table without these columns
