-- UP
-- Link ad hoc requests to invoices for billing analytics
CREATE TABLE IF NOT EXISTS ad_hoc_request_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  invoice_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES ad_hoc_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ad_hoc_request_invoices_request ON ad_hoc_request_invoices(request_id);
CREATE INDEX IF NOT EXISTS idx_ad_hoc_request_invoices_invoice ON ad_hoc_request_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ad_hoc_request_invoices_created ON ad_hoc_request_invoices(created_at);

-- DOWN
DROP INDEX IF EXISTS idx_ad_hoc_request_invoices_created;
DROP INDEX IF EXISTS idx_ad_hoc_request_invoices_invoice;
DROP INDEX IF EXISTS idx_ad_hoc_request_invoices_request;
DROP TABLE IF EXISTS ad_hoc_request_invoices;
