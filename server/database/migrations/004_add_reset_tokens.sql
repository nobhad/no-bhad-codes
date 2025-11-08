-- UP
-- Migration: Add password reset token fields to clients table
-- Created: 2025-09-02T00:00:00.000Z
-- Renumbered from 002 to 004 to resolve migration conflicts

-- Add reset token columns to clients table
ALTER TABLE clients ADD COLUMN reset_token TEXT;
ALTER TABLE clients ADD COLUMN reset_token_expiry DATETIME;

-- Create index for reset token lookups
CREATE INDEX IF NOT EXISTS idx_clients_reset_token ON clients(reset_token);

-- DOWN
-- Rollback: Remove reset token fields

DROP INDEX IF EXISTS idx_clients_reset_token;
ALTER TABLE clients DROP COLUMN reset_token_expiry;
ALTER TABLE clients DROP COLUMN reset_token;