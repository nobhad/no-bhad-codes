-- UP
-- Migration: Knowledge Base
-- Tier 2: FAQ/Knowledge Base for clients
-- Created: 2026-02-02

-- =====================================================
-- KNOWLEDGE BASE CATEGORIES
-- =====================================================
CREATE TABLE IF NOT EXISTS kb_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,               -- URL-friendly name
  description TEXT,
  icon TEXT DEFAULT 'book',                -- Icon name for display
  color TEXT DEFAULT '#6b7280',            -- Category color
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- KNOWLEDGE BASE ARTICLES
-- =====================================================
CREATE TABLE IF NOT EXISTS kb_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,                      -- URL-friendly title
  summary TEXT,                            -- Brief description for list view
  content TEXT NOT NULL,                   -- Full article content (markdown supported)
  keywords TEXT,                           -- Search keywords (comma-separated)
  is_featured BOOLEAN DEFAULT FALSE,       -- Show on main KB page
  is_published BOOLEAN DEFAULT TRUE,       -- Draft vs published
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,         -- "Was this helpful?" yes count
  not_helpful_count INTEGER DEFAULT 0,     -- "Was this helpful?" no count
  sort_order INTEGER DEFAULT 0,
  author_email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME,
  FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE CASCADE,
  UNIQUE(category_id, slug)
);

-- =====================================================
-- ARTICLE FEEDBACK
-- =====================================================
-- Track user feedback on articles
CREATE TABLE IF NOT EXISTS kb_article_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  user_id INTEGER,
  user_type TEXT,                          -- 'client', 'admin', 'anonymous'
  is_helpful BOOLEAN NOT NULL,
  comment TEXT,                            -- Optional feedback comment
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE
);

-- =====================================================
-- SEARCH LOG
-- =====================================================
-- Track searches for analytics and improvement
CREATE TABLE IF NOT EXISTS kb_search_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  user_id INTEGER,
  user_type TEXT,
  clicked_article_id INTEGER,              -- Which article they clicked (if any)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SEED DEFAULT CATEGORIES
-- =====================================================
INSERT OR IGNORE INTO kb_categories (name, slug, description, icon, sort_order) VALUES
('Getting Started', 'getting-started', 'Essential guides to help you get up and running', 'rocket', 1),
('Account & Billing', 'account-billing', 'Managing your account, payments, and billing information', 'credit-card', 2),
('Projects', 'projects', 'Understanding project workflows, timelines, and deliverables', 'folder', 3),
('Files & Documents', 'files-documents', 'Uploading, downloading, and managing your files', 'file', 4),
('Communication', 'communication', 'Messaging, notifications, and staying in touch', 'message-circle', 5),
('FAQ', 'faq', 'Frequently asked questions and common issues', 'help-circle', 6);

-- =====================================================
-- SEED SAMPLE ARTICLES
-- =====================================================
INSERT OR IGNORE INTO kb_articles (category_id, title, slug, summary, content, keywords, is_featured) VALUES
(1, 'Welcome to Your Client Portal', 'welcome-portal',
 'Learn how to navigate your client portal and access all features.',
 '# Welcome to Your Client Portal

Your client portal is your central hub for managing your project with us. Here''s what you can do:

## Dashboard
View your project status, recent activity, and quick stats at a glance.

## Messages
Communicate directly with our team. All conversations are saved for easy reference.

## Files
Upload and download project files securely. You can organize files and track versions.

## Invoices
View and pay invoices, track payment history, and download receipts.

## Settings
Update your profile, change password, and configure notifications.',
 'portal, dashboard, welcome, getting started', 1),

(1, 'Uploading Files to Your Project', 'uploading-files',
 'Step-by-step guide to uploading files and documents.',
 '# Uploading Files

## How to Upload
1. Navigate to the **Files** tab
2. Drag and drop files into the upload area, or click **Browse Files**
3. Select the files you want to upload
4. Wait for the upload to complete

## Supported File Types
- Images: JPG, PNG, GIF, WebP
- Documents: PDF, DOC, DOCX, TXT
- Archives: ZIP, RAR

## File Size Limits
Maximum file size is 10MB per file. You can upload up to 5 files at once.',
 'upload, files, documents, drag drop', 0),

(2, 'Understanding Your Invoice', 'understanding-invoice',
 'How to read your invoice and what each section means.',
 '# Understanding Your Invoice

## Invoice Sections

### Header
Contains the invoice number, date, and due date.

### Line Items
Detailed breakdown of services and their costs.

### Subtotal & Total
- **Subtotal**: Sum of all line items
- **Tax**: Applicable taxes (if any)
- **Total**: Final amount due

## Payment Options
You can pay invoices directly through the portal using credit card or bank transfer.',
 'invoice, billing, payment, charges', 1),

(3, 'Project Status Explained', 'project-status',
 'Understanding what each project status means.',
 '# Project Status Guide

## Status Types

### Discovery
We''re gathering requirements and understanding your needs.

### Planning
Creating the project plan, timeline, and milestones.

### In Progress
Active development and design work is underway.

### Review
Work is ready for your review and feedback.

### Revisions
Making changes based on your feedback.

### Completed
Project is finished and delivered.

### On Hold
Project is temporarily paused (typically waiting for client input).',
 'status, project, progress, workflow', 0),

(6, 'How do I reset my password?', 'reset-password',
 'Steps to reset your portal password.',
 '# Resetting Your Password

## From Login Page
1. Click **Forgot Password** on the login page
2. Enter your email address
3. Check your email for the reset link
4. Click the link and create a new password

## From Settings (when logged in)
1. Go to **Settings**
2. Find the **Change Password** section
3. Enter your current password
4. Enter and confirm your new password
5. Click **Update Password**',
 'password, reset, forgot, login', 1);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_kb_categories_slug ON kb_categories(slug);
CREATE INDEX IF NOT EXISTS idx_kb_categories_active ON kb_categories(is_active);

CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_slug ON kb_articles(slug);
CREATE INDEX IF NOT EXISTS idx_kb_articles_published ON kb_articles(is_published);
CREATE INDEX IF NOT EXISTS idx_kb_articles_featured ON kb_articles(is_featured);

CREATE INDEX IF NOT EXISTS idx_kb_feedback_article ON kb_article_feedback(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_search_log_query ON kb_search_log(query);

-- Full-text search for articles (if SQLite FTS5 is available)
-- CREATE VIRTUAL TABLE IF NOT EXISTS kb_articles_fts USING fts5(title, summary, content, keywords);

-- DOWN
DROP INDEX IF EXISTS idx_kb_search_log_query;
DROP INDEX IF EXISTS idx_kb_feedback_article;
DROP INDEX IF EXISTS idx_kb_articles_featured;
DROP INDEX IF EXISTS idx_kb_articles_published;
DROP INDEX IF EXISTS idx_kb_articles_slug;
DROP INDEX IF EXISTS idx_kb_articles_category;
DROP INDEX IF EXISTS idx_kb_categories_active;
DROP INDEX IF EXISTS idx_kb_categories_slug;

DROP TABLE IF EXISTS kb_search_log;
DROP TABLE IF EXISTS kb_article_feedback;
DROP TABLE IF EXISTS kb_articles;
DROP TABLE IF EXISTS kb_categories;
