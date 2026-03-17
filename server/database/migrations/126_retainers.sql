-- Migration: Create retainers and retainer_periods tables
-- Created: 2026-03-17
-- Required for: Phase 4B - Retainer and Recurring Project Management

-- UP

-- =====================================================
-- RETAINERS TABLE
-- =====================================================
-- Store retainer agreements linking clients to projects
-- with billing configuration and rollover settings

CREATE TABLE IF NOT EXISTS retainers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  retainer_type TEXT NOT NULL DEFAULT 'hourly' CHECK(retainer_type IN ('hourly', 'fixed_scope')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'cancelled', 'expired')),
  monthly_hours REAL,
  monthly_amount REAL NOT NULL,
  rollover_enabled INTEGER NOT NULL DEFAULT 0,
  max_rollover_hours REAL DEFAULT 0,
  start_date TEXT NOT NULL,
  end_date TEXT,
  billing_day INTEGER NOT NULL DEFAULT 1,
  auto_invoice INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- =====================================================
-- RETAINER PERIODS TABLE
-- =====================================================
-- Track monthly billing periods with hour allocations,
-- rollover hours, and invoice linkage

CREATE TABLE IF NOT EXISTS retainer_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  retainer_id INTEGER NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  allocated_hours REAL,
  used_hours REAL NOT NULL DEFAULT 0,
  rollover_hours REAL NOT NULL DEFAULT 0,
  total_available REAL,
  invoice_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'closed', 'invoiced')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (retainer_id) REFERENCES retainers(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_retainers_client_status ON retainers(client_id, status);
CREATE INDEX IF NOT EXISTS idx_retainer_periods_retainer_status ON retainer_periods(retainer_id, status);

-- DOWN
DROP INDEX IF EXISTS idx_retainer_periods_retainer_status;
DROP INDEX IF EXISTS idx_retainers_client_status;
DROP TABLE IF EXISTS retainer_periods;
DROP TABLE IF EXISTS retainers;
