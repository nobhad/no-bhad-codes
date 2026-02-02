-- UP
-- Migration: Proposal System Enhancement
-- Phase 3: Templates, versioning, e-signatures, collaboration, activity tracking
-- Created: 2026-02-01

-- =====================================================
-- PROPOSAL TEMPLATES
-- =====================================================
-- Reusable proposal templates for different project types
CREATE TABLE IF NOT EXISTS proposal_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT,
  tier_structure JSON,          -- Custom tier definitions
  default_line_items JSON,      -- Default items/services
  terms_and_conditions TEXT,
  validity_days INTEGER DEFAULT 30,  -- How long proposals are valid
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PROPOSAL VERSIONS
-- =====================================================
-- Track versions for A/B testing and history
CREATE TABLE IF NOT EXISTS proposal_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  tier_data JSON,               -- Tier selection at this version
  features_data JSON,           -- Features at this version
  pricing_data JSON,            -- Pricing at this version
  notes TEXT,                   -- Version notes
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id) ON DELETE CASCADE,
  UNIQUE(proposal_id, version_number)
);

-- =====================================================
-- E-SIGNATURE TRACKING
-- =====================================================
-- Track digital signatures on proposals
CREATE TABLE IF NOT EXISTS proposal_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_title TEXT,
  signer_company TEXT,
  signature_method TEXT,        -- 'drawn', 'typed', 'uploaded'
  signature_data TEXT,          -- Base64 signature image or typed name
  ip_address TEXT,
  user_agent TEXT,
  signed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id) ON DELETE CASCADE
);

-- =====================================================
-- PROPOSAL COMMENTS/COLLABORATION
-- =====================================================
-- Comments on proposals for collaboration
CREATE TABLE IF NOT EXISTS proposal_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  author_type TEXT NOT NULL,    -- 'admin', 'client'
  author_name TEXT NOT NULL,
  author_email TEXT,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,  -- Admin-only comments
  parent_comment_id INTEGER,    -- For threaded replies
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_comment_id) REFERENCES proposal_comments(id) ON DELETE CASCADE
);

-- =====================================================
-- PROPOSAL ACTIVITY TRACKING
-- =====================================================
-- Track all activities on proposals
CREATE TABLE IF NOT EXISTS proposal_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL,  -- 'viewed', 'downloaded', 'commented', 'signed', 'status_changed', 'version_created', 'sent', 'reminder_sent'
  actor TEXT,                   -- Who performed the action
  actor_type TEXT,              -- 'admin', 'client', 'system'
  metadata JSON,                -- Additional structured data
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id) ON DELETE CASCADE
);

-- =====================================================
-- CUSTOM LINE ITEMS
-- =====================================================
-- Custom line items beyond feature selections
CREATE TABLE IF NOT EXISTS proposal_custom_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  item_type TEXT DEFAULT 'service',  -- 'service', 'product', 'discount', 'fee', 'hourly'
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  unit_label TEXT,              -- 'hour', 'item', 'page', etc.
  category TEXT,
  is_taxable BOOLEAN DEFAULT TRUE,
  is_optional BOOLEAN DEFAULT FALSE,  -- Client can opt out
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id) ON DELETE CASCADE
);

-- =====================================================
-- SIGNATURE REQUESTS
-- =====================================================
-- Track signature request status
CREATE TABLE IF NOT EXISTS signature_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  signer_email TEXT NOT NULL,
  signer_name TEXT,
  request_token TEXT UNIQUE,    -- Unique token for signing link
  status TEXT DEFAULT 'pending',  -- 'pending', 'viewed', 'signed', 'declined', 'expired'
  sent_at DATETIME,
  viewed_at DATETIME,
  signed_at DATETIME,
  declined_at DATETIME,
  decline_reason TEXT,
  expires_at DATETIME,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id) ON DELETE CASCADE
);

-- =====================================================
-- UPDATE PROPOSAL_REQUESTS TABLE
-- =====================================================
ALTER TABLE proposal_requests ADD COLUMN template_id INTEGER REFERENCES proposal_templates(id);
ALTER TABLE proposal_requests ADD COLUMN expiration_date DATE;
ALTER TABLE proposal_requests ADD COLUMN reminder_sent_at DATETIME;
ALTER TABLE proposal_requests ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE proposal_requests ADD COLUMN last_viewed_at DATETIME;
ALTER TABLE proposal_requests ADD COLUMN signed_at DATETIME;
ALTER TABLE proposal_requests ADD COLUMN version_number INTEGER DEFAULT 1;
ALTER TABLE proposal_requests ADD COLUMN discount_type TEXT;  -- 'percentage', 'fixed'
ALTER TABLE proposal_requests ADD COLUMN discount_value DECIMAL(10,2) DEFAULT 0;
ALTER TABLE proposal_requests ADD COLUMN discount_reason TEXT;
ALTER TABLE proposal_requests ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0;
ALTER TABLE proposal_requests ADD COLUMN subtotal DECIMAL(10,2);
ALTER TABLE proposal_requests ADD COLUMN tax_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE proposal_requests ADD COLUMN sent_at DATETIME;
ALTER TABLE proposal_requests ADD COLUMN sent_by TEXT;
ALTER TABLE proposal_requests ADD COLUMN accepted_at DATETIME;
ALTER TABLE proposal_requests ADD COLUMN rejected_at DATETIME;
ALTER TABLE proposal_requests ADD COLUMN rejection_reason TEXT;
ALTER TABLE proposal_requests ADD COLUMN validity_days INTEGER DEFAULT 30;
ALTER TABLE proposal_requests ADD COLUMN requires_signature BOOLEAN DEFAULT FALSE;
ALTER TABLE proposal_requests ADD COLUMN access_token TEXT;  -- For client viewing without login

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_proposal_templates_type ON proposal_templates(project_type);
CREATE INDEX IF NOT EXISTS idx_proposal_templates_active ON proposal_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_proposal_versions_proposal ON proposal_versions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_versions_number ON proposal_versions(proposal_id, version_number);

CREATE INDEX IF NOT EXISTS idx_proposal_signatures_proposal ON proposal_signatures(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_signatures_email ON proposal_signatures(signer_email);

CREATE INDEX IF NOT EXISTS idx_proposal_comments_proposal ON proposal_comments(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_comments_parent ON proposal_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_proposal_comments_internal ON proposal_comments(is_internal);

CREATE INDEX IF NOT EXISTS idx_proposal_activities_proposal ON proposal_activities(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_activities_type ON proposal_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_proposal_activities_created ON proposal_activities(created_at);

CREATE INDEX IF NOT EXISTS idx_proposal_custom_items_proposal ON proposal_custom_items(proposal_id);

CREATE INDEX IF NOT EXISTS idx_signature_requests_proposal ON signature_requests(proposal_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_token ON signature_requests(request_token);
CREATE INDEX IF NOT EXISTS idx_signature_requests_status ON signature_requests(status);
CREATE INDEX IF NOT EXISTS idx_signature_requests_email ON signature_requests(signer_email);

CREATE INDEX IF NOT EXISTS idx_proposals_template ON proposal_requests(template_id);
CREATE INDEX IF NOT EXISTS idx_proposals_expiration ON proposal_requests(expiration_date);
CREATE INDEX IF NOT EXISTS idx_proposals_access_token ON proposal_requests(access_token);

-- =====================================================
-- SEED DEFAULT PROPOSAL TEMPLATES
-- =====================================================
INSERT OR IGNORE INTO proposal_templates (name, description, project_type, tier_structure, default_line_items, terms_and_conditions, validity_days) VALUES
(
  'Simple Website Proposal',
  'Standard proposal template for simple websites (3-5 pages)',
  'simple-site',
  '{"tiers":[{"id":"good","name":"Starter","description":"Essential website with core features"},{"id":"better","name":"Professional","description":"Enhanced website with additional features"},{"id":"best","name":"Premium","description":"Full-featured website with advanced capabilities"}]}',
  '[{"description":"Website Design & Development","unit_price":0,"category":"development"},{"description":"Domain Registration (1 year)","unit_price":20,"category":"hosting"},{"description":"Hosting Setup","unit_price":50,"category":"hosting"}]',
  'This proposal is valid for 30 days from the date of issue. A 50% deposit is required to begin work. The remaining balance is due upon project completion. All prices are in USD.',
  30
),
(
  'Business Website Proposal',
  'Comprehensive proposal for business websites (8-12 pages)',
  'business-site',
  '{"tiers":[{"id":"good","name":"Essential","description":"Professional business presence online"},{"id":"better","name":"Growth","description":"Enhanced features for growing businesses"},{"id":"best","name":"Enterprise","description":"Complete solution with all premium features"}]}',
  '[{"description":"Website Design & Development","unit_price":0,"category":"development"},{"description":"SEO Setup","unit_price":200,"category":"marketing"},{"description":"Analytics Integration","unit_price":100,"category":"tracking"},{"description":"Contact Form Integration","unit_price":50,"category":"functionality"}]',
  'This proposal is valid for 30 days from the date of issue. A 50% deposit is required to begin work, with a 25% milestone payment, and final 25% upon completion. All prices are in USD. Maintenance packages available separately.',
  30
),
(
  'E-commerce Store Proposal',
  'Full e-commerce proposal with product catalog and checkout',
  'e-commerce',
  '{"tiers":[{"id":"good","name":"Starter Store","description":"Basic e-commerce with essential features"},{"id":"better","name":"Professional Store","description":"Full-featured online store"},{"id":"best","name":"Enterprise Store","description":"Complete e-commerce solution with advanced features"}]}',
  '[{"description":"E-commerce Platform Setup","unit_price":0,"category":"development"},{"description":"Payment Gateway Integration","unit_price":150,"category":"payments"},{"description":"Shipping Integration","unit_price":100,"category":"shipping"},{"description":"Product Import Setup","unit_price":200,"category":"data"}]',
  'This proposal is valid for 30 days. Payment schedule: 30% deposit, 30% at design approval, 40% at launch. Ongoing maintenance and support packages available. Transaction fees from payment processors are the responsibility of the client.',
  30
);

-- DOWN
-- Rollback: Drop all new tables and columns

DROP INDEX IF EXISTS idx_proposals_access_token;
DROP INDEX IF EXISTS idx_proposals_expiration;
DROP INDEX IF EXISTS idx_proposals_template;
DROP INDEX IF EXISTS idx_signature_requests_email;
DROP INDEX IF EXISTS idx_signature_requests_status;
DROP INDEX IF EXISTS idx_signature_requests_token;
DROP INDEX IF EXISTS idx_signature_requests_proposal;
DROP INDEX IF EXISTS idx_proposal_custom_items_proposal;
DROP INDEX IF EXISTS idx_proposal_activities_created;
DROP INDEX IF EXISTS idx_proposal_activities_type;
DROP INDEX IF EXISTS idx_proposal_activities_proposal;
DROP INDEX IF EXISTS idx_proposal_comments_internal;
DROP INDEX IF EXISTS idx_proposal_comments_parent;
DROP INDEX IF EXISTS idx_proposal_comments_proposal;
DROP INDEX IF EXISTS idx_proposal_signatures_email;
DROP INDEX IF EXISTS idx_proposal_signatures_proposal;
DROP INDEX IF EXISTS idx_proposal_versions_number;
DROP INDEX IF EXISTS idx_proposal_versions_proposal;
DROP INDEX IF EXISTS idx_proposal_templates_active;
DROP INDEX IF EXISTS idx_proposal_templates_type;

DROP TABLE IF EXISTS signature_requests;
DROP TABLE IF EXISTS proposal_custom_items;
DROP TABLE IF EXISTS proposal_activities;
DROP TABLE IF EXISTS proposal_comments;
DROP TABLE IF EXISTS proposal_signatures;
DROP TABLE IF EXISTS proposal_versions;
DROP TABLE IF EXISTS proposal_templates;

-- Note: SQLite doesn't support DROP COLUMN, so proposal_requests columns would remain
