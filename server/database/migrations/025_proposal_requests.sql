-- UP
-- Create proposal_requests table for storing client proposal selections
CREATE TABLE IF NOT EXISTS proposal_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  project_type TEXT NOT NULL,
  selected_tier TEXT NOT NULL CHECK (selected_tier IN ('good', 'better', 'best')),
  base_price INTEGER NOT NULL,
  final_price INTEGER NOT NULL,
  maintenance_option TEXT CHECK (maintenance_option IN ('diy', 'essential', 'standard', 'premium')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected', 'converted')),
  client_notes TEXT,
  admin_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  reviewed_by TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Create proposal_feature_selections table for tracking feature selections
CREATE TABLE IF NOT EXISTS proposal_feature_selections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_request_id INTEGER NOT NULL,
  feature_id TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  feature_price INTEGER NOT NULL DEFAULT 0,
  feature_category TEXT,
  is_included_in_tier BOOLEAN DEFAULT 1,
  is_addon BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_request_id) REFERENCES proposal_requests(id) ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_proposal_requests_project ON proposal_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_proposal_requests_client ON proposal_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_proposal_requests_status ON proposal_requests(status);
CREATE INDEX IF NOT EXISTS idx_proposal_requests_created_at ON proposal_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_proposal_feature_selections_proposal ON proposal_feature_selections(proposal_request_id);

-- DOWN
-- Rollback: Drop tables and indexes
DROP INDEX IF EXISTS idx_proposal_feature_selections_proposal;
DROP INDEX IF EXISTS idx_proposal_requests_created_at;
DROP INDEX IF EXISTS idx_proposal_requests_status;
DROP INDEX IF EXISTS idx_proposal_requests_client;
DROP INDEX IF EXISTS idx_proposal_requests_project;
DROP TABLE IF EXISTS proposal_feature_selections;
DROP TABLE IF EXISTS proposal_requests;
