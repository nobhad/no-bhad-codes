-- =====================================================
-- Migration 064: Email Templates
-- =====================================================
-- Enables admin management of email templates via UI
-- Stores customized versions, allows variable preview,
-- and supports test email sending
-- =====================================================

-- ===============================================
-- EMAIL TEMPLATES
-- ===============================================
-- Stores editable email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,         -- Template identifier (e.g., 'welcome', 'invoice_reminder')
  description TEXT,                   -- Admin-friendly description
  category TEXT NOT NULL DEFAULT 'general', -- 'notification', 'invoice', 'contract', 'project', 'reminder', 'general'
  subject TEXT NOT NULL,              -- Email subject with {{variables}}
  body_html TEXT NOT NULL,            -- HTML body with {{variables}}
  body_text TEXT,                     -- Plain text fallback (optional)
  variables JSON,                     -- Available variables: [{"name": "client.name", "description": "Client name"}]
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,    -- System templates cannot be deleted
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- EMAIL TEMPLATE VERSIONS
-- ===============================================
-- Version history for templates
CREATE TABLE IF NOT EXISTS email_template_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  changed_by TEXT,                    -- Admin who made the change
  change_reason TEXT,                 -- Optional note about the change
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE CASCADE
);

-- ===============================================
-- EMAIL SEND LOGS
-- ===============================================
-- Track sent emails for debugging and analytics
CREATE TABLE IF NOT EXISTS email_send_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER,                -- NULL for non-template emails
  template_name TEXT,                 -- Denormalized for deleted templates
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'bounced'
  error_message TEXT,
  metadata JSON,                      -- Additional context (project_id, client_id, etc.)
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL
);

-- ===============================================
-- PERFORMANCE INDEXES
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(name);
CREATE INDEX IF NOT EXISTS idx_email_template_versions_template ON email_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_template ON email_send_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_recipient ON email_send_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_status ON email_send_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_date ON email_send_logs(created_at);

-- ===============================================
-- SEED DEFAULT EMAIL TEMPLATES
-- ===============================================
INSERT OR IGNORE INTO email_templates (id, name, description, category, subject, body_html, body_text, variables, is_system) VALUES
-- Welcome email
(1, 'welcome', 'Welcome email for new clients', 'notification',
 'Welcome to {{company.name}}!',
 '<h1>Welcome, {{client.name}}!</h1><p>Thank you for choosing {{company.name}}. We''re excited to work with you.</p><p>You can access your client portal at: <a href="{{portal.url}}">{{portal.url}}</a></p><p>Best regards,<br>{{company.name}} Team</p>',
 'Welcome, {{client.name}}!\n\nThank you for choosing {{company.name}}. We''re excited to work with you.\n\nYou can access your client portal at: {{portal.url}}\n\nBest regards,\n{{company.name}} Team',
 '[{"name": "client.name", "description": "Client name"}, {"name": "company.name", "description": "Company name"}, {"name": "portal.url", "description": "Client portal URL"}]',
 TRUE),

-- Invoice reminder
(2, 'invoice_reminder', 'Reminder for unpaid invoices', 'invoice',
 'Invoice #{{invoice.number}} - Payment Reminder',
 '<h1>Payment Reminder</h1><p>Dear {{client.name}},</p><p>This is a friendly reminder that invoice <strong>#{{invoice.number}}</strong> for <strong>{{invoice.amount}}</strong> is due on <strong>{{invoice.due_date}}</strong>.</p><p>Please arrange payment at your earliest convenience.</p><p>Best regards,<br>{{company.name}}</p>',
 'Payment Reminder\n\nDear {{client.name}},\n\nThis is a friendly reminder that invoice #{{invoice.number}} for {{invoice.amount}} is due on {{invoice.due_date}}.\n\nPlease arrange payment at your earliest convenience.\n\nBest regards,\n{{company.name}}',
 '[{"name": "client.name", "description": "Client name"}, {"name": "invoice.number", "description": "Invoice number"}, {"name": "invoice.amount", "description": "Formatted invoice amount"}, {"name": "invoice.due_date", "description": "Invoice due date"}, {"name": "company.name", "description": "Company name"}]',
 TRUE),

-- Contract sent
(3, 'contract_sent', 'Notification when contract is sent for signature', 'contract',
 'Contract Ready for Signature - {{project.name}}',
 '<h1>Contract Ready</h1><p>Dear {{client.name}},</p><p>Your contract for <strong>{{project.name}}</strong> is ready for your review and signature.</p><p><a href="{{contract.sign_url}}" style="background: #00aff0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Review & Sign Contract</a></p><p>This link will expire on {{contract.expires_date}}.</p><p>Best regards,<br>{{company.name}}</p>',
 'Contract Ready\n\nDear {{client.name}},\n\nYour contract for {{project.name}} is ready for your review and signature.\n\nSign here: {{contract.sign_url}}\n\nThis link will expire on {{contract.expires_date}}.\n\nBest regards,\n{{company.name}}',
 '[{"name": "client.name", "description": "Client name"}, {"name": "project.name", "description": "Project name"}, {"name": "contract.sign_url", "description": "Contract signing URL"}, {"name": "contract.expires_date", "description": "Contract expiration date"}, {"name": "company.name", "description": "Company name"}]',
 TRUE),

-- Approval request
(4, 'approval_request', 'Request for client approval on a deliverable', 'project',
 'Approval Required: {{deliverable.name}}',
 '<h1>Approval Required</h1><p>Dear {{client.name}},</p><p>We have completed <strong>{{deliverable.name}}</strong> for your project <strong>{{project.name}}</strong> and it is ready for your review.</p><p><a href="{{approval.url}}" style="background: #00aff0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Review & Approve</a></p><p>Please review at your earliest convenience so we can proceed with the next phase.</p><p>Best regards,<br>{{company.name}}</p>',
 'Approval Required\n\nDear {{client.name}},\n\nWe have completed {{deliverable.name}} for your project {{project.name}} and it is ready for your review.\n\nReview here: {{approval.url}}\n\nPlease review at your earliest convenience so we can proceed with the next phase.\n\nBest regards,\n{{company.name}}',
 '[{"name": "client.name", "description": "Client name"}, {"name": "project.name", "description": "Project name"}, {"name": "deliverable.name", "description": "Deliverable name"}, {"name": "approval.url", "description": "Approval URL"}, {"name": "company.name", "description": "Company name"}]',
 TRUE),

-- Project update
(5, 'project_update', 'Status update on project progress', 'project',
 'Project Update: {{project.name}}',
 '<h1>Project Update</h1><p>Dear {{client.name}},</p><p>Here is the latest update on your project <strong>{{project.name}}</strong>:</p><div style="background: #f5f5f5; padding: 16px; border-radius: 4px;">{{update.message}}</div><p>Current Status: <strong>{{project.status}}</strong></p><p>If you have any questions, please don''t hesitate to reach out.</p><p>Best regards,<br>{{company.name}}</p>',
 'Project Update\n\nDear {{client.name}},\n\nHere is the latest update on your project {{project.name}}:\n\n{{update.message}}\n\nCurrent Status: {{project.status}}\n\nIf you have any questions, please don''t hesitate to reach out.\n\nBest regards,\n{{company.name}}',
 '[{"name": "client.name", "description": "Client name"}, {"name": "project.name", "description": "Project name"}, {"name": "update.message", "description": "Update message"}, {"name": "project.status", "description": "Project status"}, {"name": "company.name", "description": "Company name"}]',
 TRUE),

-- Password reset
(6, 'password_reset', 'Password reset request', 'notification',
 'Reset Your Password',
 '<h1>Password Reset</h1><p>We received a request to reset your password.</p><p><a href="{{reset.url}}" style="background: #00aff0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Reset Password</a></p><p>This link will expire in {{reset.expires_hours}} hours.</p><p>If you did not request this reset, please ignore this email.</p><p>Best regards,<br>{{company.name}}</p>',
 'Password Reset\n\nWe received a request to reset your password.\n\nReset here: {{reset.url}}\n\nThis link will expire in {{reset.expires_hours}} hours.\n\nIf you did not request this reset, please ignore this email.\n\nBest regards,\n{{company.name}}',
 '[{"name": "reset.url", "description": "Password reset URL"}, {"name": "reset.expires_hours", "description": "Hours until link expires"}, {"name": "company.name", "description": "Company name"}]',
 TRUE);
