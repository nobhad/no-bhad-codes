-- UP
-- Create ad_hoc_requests table for custom client requests
CREATE TABLE IF NOT EXISTS ad_hoc_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'reviewing', 'quoted', 'approved', 'in_progress', 'completed', 'declined'
  )),
  request_type TEXT NOT NULL CHECK (request_type IN (
    'feature', 'change', 'bug_fix', 'enhancement', 'support'
  )),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('normal', 'priority', 'urgent', 'emergency')),
  estimated_hours REAL,
  flat_rate REAL,
  hourly_rate REAL,
  quoted_price REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deleted_by TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ad_hoc_requests_project ON ad_hoc_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_ad_hoc_requests_client ON ad_hoc_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_hoc_requests_status ON ad_hoc_requests(status);
CREATE INDEX IF NOT EXISTS idx_ad_hoc_requests_type ON ad_hoc_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_ad_hoc_requests_created_at ON ad_hoc_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_ad_hoc_requests_deleted ON ad_hoc_requests(deleted_at);

-- DOWN
DROP INDEX IF EXISTS idx_ad_hoc_requests_deleted;
DROP INDEX IF EXISTS idx_ad_hoc_requests_created_at;
DROP INDEX IF EXISTS idx_ad_hoc_requests_type;
DROP INDEX IF EXISTS idx_ad_hoc_requests_status;
DROP INDEX IF EXISTS idx_ad_hoc_requests_client;
DROP INDEX IF EXISTS idx_ad_hoc_requests_project;
DROP TABLE IF EXISTS ad_hoc_requests;
