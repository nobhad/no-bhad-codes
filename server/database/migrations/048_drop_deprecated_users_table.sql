-- Migration: Drop deprecated users table
-- Created: 2026-02-06
-- Reason: The 'users' table was abandoned - all user management uses 'clients' table exclusively.
--         The /auth/register endpoint that referenced 'users' has been removed.
--         All authentication (client portal + admin) uses 'clients' with is_admin flag.

-- UP
-- First drop the indexes
DROP INDEX IF EXISTS idx_users_status;
DROP INDEX IF EXISTS idx_users_email;

-- Then drop the table
DROP TABLE IF EXISTS users;

-- DOWN
-- Recreate the table if needed (from migration 017)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  type TEXT DEFAULT 'client' CHECK (type IN ('client', 'admin')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
