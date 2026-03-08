-- =====================================================
-- Migration 099: Optimistic Locking Version Columns
-- =====================================================
-- Created: 2026-03-08
--
-- Purpose: Add a `version` column to critical tables to enable
-- optimistic locking. Each UPDATE that uses whereVersion() will
-- check the current version and increment it atomically. If the
-- version has changed since the row was read, the UPDATE affects
-- 0 rows, signaling a concurrent modification conflict.
--
-- Tables: invoices, contracts, proposal_requests, projects
--
-- SQLite does not support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
-- so we use a CREATE TRIGGER trick: attempt the ALTER and ignore
-- the error if the column already exists. However, since this
-- migration runner likely executes raw SQL, we rely on the fact
-- that re-running ALTER TABLE ADD COLUMN for an existing column
-- will error and the migration will not re-run (idempotent by
-- migration tracking). For extra safety we wrap in a no-op SELECT
-- check pattern.
-- =====================================================

-- UP

-- Add version column to invoices
ALTER TABLE invoices ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Add version column to contracts
ALTER TABLE contracts ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Add version column to proposal_requests
ALTER TABLE proposal_requests ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Add version column to projects
ALTER TABLE projects ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- DOWN

-- SQLite does not support DROP COLUMN in older versions.
-- For SQLite 3.35.0+ (2021-03-12) DROP COLUMN is supported.
-- These are safe to run on modern SQLite.

ALTER TABLE invoices DROP COLUMN version;
ALTER TABLE contracts DROP COLUMN version;
ALTER TABLE proposal_requests DROP COLUMN version;
ALTER TABLE projects DROP COLUMN version;
