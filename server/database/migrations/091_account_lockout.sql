-- ===============================================
-- ACCOUNT LOCKOUT SECURITY
-- ===============================================
-- Migration: 090_account_lockout.sql
-- Description: Add account lockout functionality to prevent brute force attacks
--
-- Adds columns to track failed login attempts and lockout status:
-- - failed_login_attempts: Count of consecutive failed login attempts
-- - locked_until: Timestamp when the account lockout expires
--
-- Security Policy:
-- - Account locks for 15 minutes after 5 failed attempts
-- - Counter resets on successful login
-- - Lockout expires automatically after 15 minutes

-- Add failed_login_attempts column
ALTER TABLE clients ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;

-- Add locked_until column (DATETIME for when lockout expires)
ALTER TABLE clients ADD COLUMN locked_until DATETIME DEFAULT NULL;

-- Create index for efficient lockout checking during login
CREATE INDEX IF NOT EXISTS idx_clients_lockout ON clients(email, locked_until);
