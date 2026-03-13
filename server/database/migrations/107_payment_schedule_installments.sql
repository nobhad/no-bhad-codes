-- Payment schedule installments for tracking per-project payment plans
-- Supports flexible splits (50/50, quarterly, custom)

CREATE TABLE IF NOT EXISTS payment_schedule_installments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  contract_id INTEGER,
  installment_number INTEGER NOT NULL,
  label TEXT,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  paid_date DATE,
  paid_amount DECIMAL(10,2),
  payment_method TEXT,
  payment_reference TEXT,
  invoice_id INTEGER,
  notes TEXT,
  reminder_sent_at DATETIME,
  reminder_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_installments_project ON payment_schedule_installments(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_installments_client ON payment_schedule_installments(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_installments_status ON payment_schedule_installments(status);
CREATE INDEX IF NOT EXISTS idx_payment_installments_due_date ON payment_schedule_installments(due_date);

-- DOWN
DROP INDEX IF EXISTS idx_payment_installments_due_date;
DROP INDEX IF EXISTS idx_payment_installments_status;
DROP INDEX IF EXISTS idx_payment_installments_client;
DROP INDEX IF EXISTS idx_payment_installments_project;
DROP TABLE IF EXISTS payment_schedule_installments;
