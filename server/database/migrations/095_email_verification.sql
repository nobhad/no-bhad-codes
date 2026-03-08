-- UP
-- Migration: Add email verification columns to clients table
-- Created: 2026-03-07

ALTER TABLE clients ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN email_verification_token TEXT;
ALTER TABLE clients ADD COLUMN email_verification_sent_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_clients_email_verification_token ON clients(email_verification_token);

-- DOWN
DROP INDEX IF EXISTS idx_clients_email_verification_token;
-- SQLite does not support DROP COLUMN; columns are harmless if left in place.
