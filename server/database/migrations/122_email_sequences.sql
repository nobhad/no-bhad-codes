-- Migration 122: Email Drip Sequences
-- Created: 2026-03-17
-- Phase 2A: Automated email drip sequence system for lead nurturing and follow-ups

-- UP

-- =====================================================
-- EMAIL SEQUENCES TABLE
-- =====================================================
-- Defines a sequence of automated emails triggered by events
CREATE TABLE IF NOT EXISTS email_sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  trigger_conditions TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================
-- SEQUENCE STEPS TABLE
-- =====================================================
-- Individual emails within a sequence, executed in order
CREATE TABLE IF NOT EXISTS sequence_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_id INTEGER NOT NULL,
  step_order INTEGER NOT NULL,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  email_template_id INTEGER,
  subject_override TEXT,
  body_override TEXT,
  stop_conditions TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sequence_id) REFERENCES email_sequences(id) ON DELETE CASCADE,
  FOREIGN KEY (email_template_id) REFERENCES email_templates(id) ON DELETE SET NULL
);

-- =====================================================
-- SEQUENCE ENROLLMENTS TABLE
-- =====================================================
-- Tracks entities enrolled in a sequence and their progress
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  entity_email TEXT NOT NULL,
  entity_name TEXT,
  current_step_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'stopped', 'paused')),
  next_send_at TEXT,
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  stopped_at TEXT,
  stopped_reason TEXT,
  FOREIGN KEY (sequence_id) REFERENCES email_sequences(id) ON DELETE CASCADE
);

-- =====================================================
-- SEQUENCE SEND LOGS TABLE
-- =====================================================
-- Logs each email sent as part of a sequence
CREATE TABLE IF NOT EXISTS sequence_send_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL,
  step_id INTEGER NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  email_status TEXT NOT NULL DEFAULT 'sent' CHECK (email_status IN ('sent', 'failed', 'bounced', 'opened', 'clicked')),
  error_message TEXT,
  FOREIGN KEY (enrollment_id) REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES sequence_steps(id) ON DELETE CASCADE
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence_order ON sequence_steps(sequence_id, step_order);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status_next_send ON sequence_enrollments(status, next_send_at);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_entity ON sequence_enrollments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence ON sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_send_logs_enrollment ON sequence_send_logs(enrollment_id);

-- =====================================================
-- SEED DATA: Default Sequences
-- =====================================================

-- Sequence 1: New Lead Welcome
INSERT INTO email_sequences (name, description, trigger_event, trigger_conditions, is_active)
VALUES (
  'New Lead Welcome',
  'Welcome sequence for new leads. Introduces services and encourages consultation booking.',
  'lead.created',
  '{}',
  1
);

INSERT INTO sequence_steps (sequence_id, step_order, delay_hours, subject_override, body_override)
VALUES
  ((SELECT id FROM email_sequences WHERE name = 'New Lead Welcome'), 1, 0,
   'Welcome! Let''s Talk About Your Project',
   'Hi {{entity.name}}, thank you for reaching out. We received your inquiry and would love to learn more about your project. Let''s schedule a quick consultation to discuss your goals.'),
  ((SELECT id FROM email_sequences WHERE name = 'New Lead Welcome'), 2, 48,
   'A Few Things We Can Help With',
   'Hi {{entity.name}}, just wanted to share some of the ways we help clients like you. From web design to full-stack development, we tailor every project to your specific needs.'),
  ((SELECT id FROM email_sequences WHERE name = 'New Lead Welcome'), 3, 120,
   'Still Interested? Let''s Connect',
   'Hi {{entity.name}}, we haven''t heard back yet and wanted to check in. If you''re still considering your project, we''d love to chat. No pressure — just here to help when you''re ready.');

-- Sequence 2: Proposal Follow-Up
INSERT INTO email_sequences (name, description, trigger_event, trigger_conditions, is_active)
VALUES (
  'Proposal Follow-Up',
  'Follow-up sequence after a proposal is sent. Encourages review and signing.',
  'proposal.sent',
  '{}',
  1
);

INSERT INTO sequence_steps (sequence_id, step_order, delay_hours, subject_override, body_override)
VALUES
  ((SELECT id FROM email_sequences WHERE name = 'Proposal Follow-Up'), 1, 72,
   'Checking In On Your Proposal',
   'Hi {{entity.name}}, just a friendly reminder that your proposal is ready for review. Take a look when you get a chance and let us know if you have any questions.'),
  ((SELECT id FROM email_sequences WHERE name = 'Proposal Follow-Up'), 2, 168,
   'Any Questions About Your Proposal?',
   'Hi {{entity.name}}, we noticed you haven''t had a chance to review your proposal yet. We''re happy to walk through it with you or make adjustments if needed.'),
  ((SELECT id FROM email_sequences WHERE name = 'Proposal Follow-Up'), 3, 336,
   'Your Proposal Is Still Available',
   'Hi {{entity.name}}, your proposal is still available for review. If your plans have changed, no worries at all. Otherwise, we''re here whenever you''re ready to move forward.');

-- Sequence 3: Post-Consultation
INSERT INTO email_sequences (name, description, trigger_event, trigger_conditions, is_active)
VALUES (
  'Post-Consultation',
  'Follow-up sequence after a lead is qualified from consultation.',
  'lead.stage_changed',
  '{"new_stage": "qualified"}',
  1
);

INSERT INTO sequence_steps (sequence_id, step_order, delay_hours, subject_override, body_override)
VALUES
  ((SELECT id FROM email_sequences WHERE name = 'Post-Consultation'), 1, 24,
   'Great Talking With You!',
   'Hi {{entity.name}}, it was great chatting about your project. Based on our conversation, we''re putting together a proposal tailored to your needs. You''ll hear from us soon.'),
  ((SELECT id FROM email_sequences WHERE name = 'Post-Consultation'), 2, 96,
   'Your Proposal Is On the Way',
   'Hi {{entity.name}}, just a quick update — we''re finalizing the details of your proposal. We want to make sure everything aligns with what we discussed. Stay tuned!');

-- DOWN
DROP INDEX IF EXISTS idx_sequence_send_logs_enrollment;
DROP INDEX IF EXISTS idx_sequence_enrollments_sequence;
DROP INDEX IF EXISTS idx_sequence_enrollments_entity;
DROP INDEX IF EXISTS idx_sequence_enrollments_status_next_send;
DROP INDEX IF EXISTS idx_sequence_steps_sequence_order;
DROP TABLE IF EXISTS sequence_send_logs;
DROP TABLE IF EXISTS sequence_enrollments;
DROP TABLE IF EXISTS sequence_steps;
DROP TABLE IF EXISTS email_sequences;
