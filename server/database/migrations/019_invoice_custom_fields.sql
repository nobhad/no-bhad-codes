-- Migration: Add custom fields to invoices for full editing support
-- Created: 2026-01-13

-- Business info fields (with defaults)
ALTER TABLE invoices ADD COLUMN business_name TEXT DEFAULT 'No Bhad Codes';
ALTER TABLE invoices ADD COLUMN business_contact TEXT DEFAULT 'Noelle Bhaduri';
ALTER TABLE invoices ADD COLUMN business_email TEXT DEFAULT 'nobhaduri@gmail.com';
ALTER TABLE invoices ADD COLUMN business_website TEXT DEFAULT 'nobhad.codes';

-- Payment method fields
ALTER TABLE invoices ADD COLUMN venmo_handle TEXT DEFAULT '@nobhad';
ALTER TABLE invoices ADD COLUMN paypal_email TEXT DEFAULT 'nobhaduri@gmail.com';

-- Services/project description fields
ALTER TABLE invoices ADD COLUMN services_title TEXT;
ALTER TABLE invoices ADD COLUMN services_description TEXT;
ALTER TABLE invoices ADD COLUMN deliverables TEXT; -- JSON array of bullet points
ALTER TABLE invoices ADD COLUMN features TEXT; -- Comma-separated or JSON array

-- Bill To override fields (if different from client record)
ALTER TABLE invoices ADD COLUMN bill_to_name TEXT;
ALTER TABLE invoices ADD COLUMN bill_to_email TEXT;
