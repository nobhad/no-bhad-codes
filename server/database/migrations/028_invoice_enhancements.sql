-- ===============================================
-- INVOICE SYSTEM ENHANCEMENTS
-- ===============================================
-- Migration 028: Add payment plans, reminders, scheduling, and recurring invoices
-- Created: 2026-02-01

-- ===============================================
-- PAYMENT PLAN TEMPLATES
-- ===============================================
-- Stores reusable payment plan templates (e.g., 50/50, 30/30/40)
CREATE TABLE IF NOT EXISTS payment_plan_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  payments JSON NOT NULL,  -- [{percentage: 50, trigger: 'upfront'}, {percentage: 50, trigger: 'completion'}]
  is_default BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- INVOICE REMINDERS
-- ===============================================
-- Tracks scheduled and sent payment reminders for invoices
CREATE TABLE IF NOT EXISTS invoice_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  reminder_type TEXT NOT NULL,  -- 'upcoming', 'due', 'overdue_3', 'overdue_7', 'overdue_14', 'overdue_30'
  scheduled_date DATE NOT NULL,
  sent_at DATETIME,
  status TEXT DEFAULT 'pending',  -- 'pending', 'sent', 'skipped', 'failed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- ===============================================
-- SCHEDULED INVOICES
-- ===============================================
-- Invoices scheduled for future generation (date or milestone-triggered)
CREATE TABLE IF NOT EXISTS scheduled_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  trigger_type TEXT,  -- 'date', 'milestone_complete'
  trigger_milestone_id INTEGER,
  line_items JSON NOT NULL,
  notes TEXT,
  terms TEXT,
  status TEXT DEFAULT 'pending',  -- 'pending', 'generated', 'cancelled'
  generated_invoice_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (trigger_milestone_id) REFERENCES milestones(id) ON DELETE SET NULL,
  FOREIGN KEY (generated_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);

-- ===============================================
-- RECURRING INVOICES
-- ===============================================
-- Patterns for automatically generating recurring invoices
CREATE TABLE IF NOT EXISTS recurring_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  frequency TEXT NOT NULL,  -- 'weekly', 'monthly', 'quarterly'
  day_of_month INTEGER,  -- 1-28 for monthly/quarterly
  day_of_week INTEGER,  -- 0-6 for weekly (0 = Sunday)
  line_items JSON NOT NULL,
  notes TEXT,
  terms TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  next_generation_date DATE NOT NULL,
  last_generated_at DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- ===============================================
-- SCHEMA UPDATES TO INVOICES TABLE
-- ===============================================
-- Add milestone linking to invoices
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a try/catch approach
-- The migration runner will handle errors gracefully

-- Add milestone_id column for linking invoices to milestones
ALTER TABLE invoices ADD COLUMN milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL;

-- Add payment_plan_id column for tracking which plan generated this invoice
ALTER TABLE invoices ADD COLUMN payment_plan_id INTEGER REFERENCES payment_plan_templates(id) ON DELETE SET NULL;

-- ===============================================
-- PERFORMANCE INDEXES
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice ON invoice_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_status ON invoice_reminders(status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_invoices_date ON scheduled_invoices(scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_next ON recurring_invoices(next_generation_date, is_active);
CREATE INDEX IF NOT EXISTS idx_invoices_milestone ON invoices(milestone_id);

-- ===============================================
-- SEED DEFAULT PAYMENT PLAN TEMPLATES
-- ===============================================
INSERT OR IGNORE INTO payment_plan_templates (id, name, description, payments, is_default) VALUES
(1, '50/50 Split', '50% upfront deposit, 50% on project completion',
  '[{"percentage": 50, "trigger": "upfront", "label": "Deposit"}, {"percentage": 50, "trigger": "completion", "label": "Final Payment"}]',
  TRUE),
(2, '30/30/40 Split', '30% upfront, 30% at midpoint, 40% on completion',
  '[{"percentage": 30, "trigger": "upfront", "label": "Deposit"}, {"percentage": 30, "trigger": "midpoint", "label": "Progress Payment"}, {"percentage": 40, "trigger": "completion", "label": "Final Payment"}]',
  FALSE),
(3, 'Quarterly Milestones', '25% at each project quarter',
  '[{"percentage": 25, "trigger": "upfront", "label": "Q1 Payment"}, {"percentage": 25, "trigger": "milestone", "milestoneIndex": 1, "label": "Q2 Payment"}, {"percentage": 25, "trigger": "milestone", "milestoneIndex": 2, "label": "Q3 Payment"}, {"percentage": 25, "trigger": "completion", "label": "Final Payment"}]',
  FALSE),
(4, '100% Upfront', 'Full payment before project starts',
  '[{"percentage": 100, "trigger": "upfront", "label": "Full Payment"}]',
  FALSE),
(5, '100% On Completion', 'Full payment after project completion',
  '[{"percentage": 100, "trigger": "completion", "label": "Full Payment"}]',
  FALSE);
