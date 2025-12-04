-- Migration: Add magic link (passwordless login) fields to clients
-- Created: 2025-12-04

-- UP
-- Add magic link columns to clients table for passwordless authentication
ALTER TABLE clients ADD COLUMN magic_link_token TEXT;
ALTER TABLE clients ADD COLUMN magic_link_expires_at DATETIME;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_clients_magic_link_token ON clients(magic_link_token);

-- DOWN
-- Rollback: Remove magic link fields
DROP INDEX IF EXISTS idx_clients_magic_link_token;
ALTER TABLE clients DROP COLUMN magic_link_expires_at;
ALTER TABLE clients DROP COLUMN magic_link_token;
