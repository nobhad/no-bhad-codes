-- Migration: Add additional project fields
-- Created: 2026-01-13

-- Up
ALTER TABLE projects ADD COLUMN notes TEXT;
ALTER TABLE projects ADD COLUMN repository_url TEXT;
ALTER TABLE projects ADD COLUMN staging_url TEXT;
ALTER TABLE projects ADD COLUMN production_url TEXT;
ALTER TABLE projects ADD COLUMN deposit_amount TEXT;
ALTER TABLE projects ADD COLUMN contract_signed_at DATETIME;

-- Down
-- SQLite doesn't support DROP COLUMN easily
