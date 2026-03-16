-- Add billing phone and email columns to clients table
ALTER TABLE clients ADD COLUMN billing_phone TEXT;
ALTER TABLE clients ADD COLUMN billing_email TEXT;
