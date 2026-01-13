-- Migration: Add price column to projects table
-- Created: 2026-01-13

-- Up
ALTER TABLE projects ADD COLUMN price TEXT;

-- Down
-- SQLite doesn't support DROP COLUMN easily
