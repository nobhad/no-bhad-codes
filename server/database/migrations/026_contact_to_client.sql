-- Migration: 026_contact_to_client.sql
-- Description: Add client_id column to contact_submissions for tracking converted contacts
-- Date: 2026-01-30

-- Add client_id column to link converted contacts to clients
ALTER TABLE contact_submissions ADD COLUMN client_id INTEGER REFERENCES clients(id);

-- Add converted_at timestamp to track when conversion happened
ALTER TABLE contact_submissions ADD COLUMN converted_at DATETIME;

-- Create index for efficient lookup of converted contacts
CREATE INDEX IF NOT EXISTS idx_contact_submissions_client_id ON contact_submissions(client_id);
