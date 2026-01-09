-- Migration: Add is_admin column to clients table
-- Created: 2026-01-09
-- Required for login auth to properly identify admin users

-- UP
-- Add is_admin column to clients table (defaults to 0/false)
ALTER TABLE clients ADD COLUMN is_admin INTEGER DEFAULT 0;

-- Create index for faster admin lookups
CREATE INDEX IF NOT EXISTS idx_clients_is_admin ON clients(is_admin);

-- DOWN
DROP INDEX IF EXISTS idx_clients_is_admin;
