-- UP
-- Add billing_name column to clients table for invoices
-- Separate from contact_name which is for general correspondence

ALTER TABLE clients ADD COLUMN billing_name TEXT;

-- DOWN
-- SQLite doesn't support DROP COLUMN directly
