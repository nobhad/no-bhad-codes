-- Migration 131: Add Netlify and Umami credential fields to projects
-- Stores login info for client hosting/analytics dashboards

ALTER TABLE projects ADD COLUMN netlify_url TEXT;
ALTER TABLE projects ADD COLUMN netlify_email TEXT;
ALTER TABLE projects ADD COLUMN netlify_password TEXT;
ALTER TABLE projects ADD COLUMN umami_url TEXT;
ALTER TABLE projects ADD COLUMN umami_email TEXT;
ALTER TABLE projects ADD COLUMN umami_password TEXT;
