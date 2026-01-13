-- Migration: Add client_type column to distinguish personal vs business clients
-- Created: 2026-01-13

-- Add client_type column with constraint
ALTER TABLE clients ADD COLUMN client_type TEXT DEFAULT 'business'
  CHECK (client_type IN ('personal', 'business'));

-- Create index for filtering by client type
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(client_type);

-- Backfill existing data based on company_name
-- Clients with "Personal Project" as company_name are personal clients
UPDATE clients
SET client_type = 'personal'
WHERE company_name = 'Personal Project';

-- All other clients with company names are business clients (already defaulted)
-- Clear the "Personal Project" placeholder for personal clients
UPDATE clients
SET company_name = NULL
WHERE client_type = 'personal' AND company_name = 'Personal Project';
