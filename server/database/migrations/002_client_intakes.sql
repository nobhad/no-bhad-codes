-- UP
-- Create client_intakes table for storing intake form submissions
CREATE TABLE IF NOT EXISTS client_intakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intake_id TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  project_type TEXT NOT NULL,
  budget_range TEXT,
  timeline TEXT,
  project_description TEXT NOT NULL,
  additional_info TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'accepted', 'rejected', 'converted')),
  reviewed_by TEXT,
  reviewed_at DATETIME,
  client_id INTEGER, -- Link to clients table after conversion
  project_id INTEGER, -- Link to projects table after conversion
  notes TEXT, -- Internal notes about the intake
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Create indexes for common queries
CREATE INDEX idx_client_intakes_email ON client_intakes(email);
CREATE INDEX idx_client_intakes_status ON client_intakes(status);
CREATE INDEX idx_client_intakes_created_at ON client_intakes(created_at);

-- Create invoices table for tracking project invoices
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  amount_total DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled')),
  due_date DATE,
  issued_date DATE,
  paid_date DATE,
  payment_method TEXT,
  payment_reference TEXT,
  line_items TEXT, -- JSON array of line items
  notes TEXT,
  terms TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Create indexes for invoice queries
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_project ON invoices(project_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- DOWN
-- Rollback: Drop tables and indexes
DROP INDEX IF EXISTS idx_invoices_due_date;
DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_invoices_project;
DROP INDEX IF EXISTS idx_invoices_client;
DROP TABLE IF EXISTS invoices;

DROP INDEX IF EXISTS idx_client_intakes_created_at;
DROP INDEX IF EXISTS idx_client_intakes_status;
DROP INDEX IF EXISTS idx_client_intakes_email;
DROP TABLE IF EXISTS client_intakes;