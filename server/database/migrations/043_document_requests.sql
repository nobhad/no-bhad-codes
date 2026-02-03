-- UP
-- Migration: Document Requests
-- Tier 3: Admin can request specific documents from clients
-- Created: 2026-02-02

-- =====================================================
-- DOCUMENT REQUESTS
-- =====================================================
-- Track document requests from admin to clients
CREATE TABLE IF NOT EXISTS document_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  project_id INTEGER,                           -- Optional project association
  requested_by TEXT NOT NULL,                   -- Admin email who requested
  title TEXT NOT NULL,                          -- Brief title of request
  description TEXT,                             -- Detailed description of what's needed
  document_type TEXT DEFAULT 'general',         -- 'general', 'contract', 'invoice', 'asset', 'source', 'deliverable', 'identification', 'other'
  priority TEXT DEFAULT 'normal',               -- 'low', 'normal', 'high', 'urgent'
  status TEXT DEFAULT 'requested',              -- 'requested', 'viewed', 'uploaded', 'under_review', 'approved', 'rejected'
  due_date DATE,                                -- Optional due date
  file_id INTEGER,                              -- Linked file once uploaded
  uploaded_by TEXT,                             -- Client email who uploaded
  uploaded_at DATETIME,
  reviewed_by TEXT,                             -- Admin who reviewed
  reviewed_at DATETIME,
  review_notes TEXT,                            -- Notes from review
  rejection_reason TEXT,                        -- Reason if rejected
  is_required BOOLEAN DEFAULT TRUE,             -- Whether this is a required document
  reminder_sent_at DATETIME,                    -- When last reminder was sent
  reminder_count INTEGER DEFAULT 0,             -- Number of reminders sent
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);

-- =====================================================
-- DOCUMENT REQUEST TEMPLATES
-- =====================================================
-- Pre-defined templates for common document requests
CREATE TABLE IF NOT EXISTS document_request_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT DEFAULT 'general',
  is_required BOOLEAN DEFAULT TRUE,
  days_until_due INTEGER DEFAULT 7,             -- Default days until due from creation
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- DOCUMENT REQUEST HISTORY
-- =====================================================
-- Track status changes and actions on document requests
CREATE TABLE IF NOT EXISTS document_request_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  action TEXT NOT NULL,                         -- 'created', 'viewed', 'uploaded', 'approved', 'rejected', 'reminder_sent', 'due_date_changed'
  old_status TEXT,
  new_status TEXT,
  actor_email TEXT NOT NULL,
  actor_type TEXT NOT NULL,                     -- 'admin', 'client', 'system'
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES document_requests(id) ON DELETE CASCADE
);

-- =====================================================
-- SEED DEFAULT TEMPLATES
-- =====================================================
INSERT OR IGNORE INTO document_request_templates (name, title, description, document_type, is_required, days_until_due) VALUES
('brand_assets', 'Brand Assets', 'Please provide your brand assets including logo files (PNG, SVG), color codes, and any brand guidelines.', 'asset', true, 7),
('content_copy', 'Website Content', 'Please provide the written content for your website pages (About, Services, Contact, etc.).', 'general', true, 14),
('photo_gallery', 'Photo Gallery', 'Please upload high-resolution photos for use on your website.', 'asset', false, 10),
('business_license', 'Business License', 'Please provide a copy of your current business license.', 'identification', true, 7),
('signed_contract', 'Signed Contract', 'Please upload the signed contract document.', 'contract', true, 3),
('domain_info', 'Domain Information', 'Please provide domain registrar login details or transfer authorization code.', 'general', true, 5),
('hosting_access', 'Hosting Access', 'Please provide hosting account login credentials or access details.', 'general', false, 5);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_document_requests_client ON document_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_project ON document_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_status ON document_requests(status);
CREATE INDEX IF NOT EXISTS idx_document_requests_due ON document_requests(due_date);
CREATE INDEX IF NOT EXISTS idx_document_request_history_request ON document_request_history(request_id);

-- DOWN
DROP INDEX IF EXISTS idx_document_request_history_request;
DROP INDEX IF EXISTS idx_document_requests_due;
DROP INDEX IF EXISTS idx_document_requests_status;
DROP INDEX IF EXISTS idx_document_requests_project;
DROP INDEX IF EXISTS idx_document_requests_client;

DROP TABLE IF EXISTS document_request_history;
DROP TABLE IF EXISTS document_request_templates;
DROP TABLE IF EXISTS document_requests;
