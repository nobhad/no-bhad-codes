-- Migration: Add notification and billing columns to clients table
-- Version: 006
-- Date: December 1, 2025

-- UP
-- Add notification preference columns to clients table
ALTER TABLE clients ADD COLUMN notification_messages INTEGER DEFAULT 1;
ALTER TABLE clients ADD COLUMN notification_status INTEGER DEFAULT 1;
ALTER TABLE clients ADD COLUMN notification_invoices INTEGER DEFAULT 1;
ALTER TABLE clients ADD COLUMN notification_weekly INTEGER DEFAULT 0;

-- Add billing information columns to clients table
ALTER TABLE clients ADD COLUMN billing_company TEXT;
ALTER TABLE clients ADD COLUMN billing_address TEXT;
ALTER TABLE clients ADD COLUMN billing_address2 TEXT;
ALTER TABLE clients ADD COLUMN billing_city TEXT;
ALTER TABLE clients ADD COLUMN billing_state TEXT;
ALTER TABLE clients ADD COLUMN billing_zip TEXT;
ALTER TABLE clients ADD COLUMN billing_country TEXT;

-- DOWN
-- SQLite doesn't support DROP COLUMN in older versions
-- To rollback, would need to recreate the table without these columns
