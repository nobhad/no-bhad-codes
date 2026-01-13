-- Migration: Add price column to projects table
-- Created: 2026-01-13

ALTER TABLE projects ADD COLUMN price TEXT;
