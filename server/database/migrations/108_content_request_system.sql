-- Content request system for gathering client assets (bios, photos, brand files, copy)
-- Two-level structure: checklists → items for per-project content tracking

CREATE TABLE IF NOT EXISTS content_request_checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_request_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_required BOOLEAN DEFAULT TRUE,
  due_date DATE,
  status TEXT DEFAULT 'pending',
  sort_order INTEGER DEFAULT 0,
  text_content TEXT,
  file_id INTEGER,
  structured_data JSON,
  admin_notes TEXT,
  reviewed_at DATETIME,
  submitted_at DATETIME,
  reminder_sent_at DATETIME,
  reminder_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (checklist_id) REFERENCES content_request_checklists(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS content_request_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  items JSON NOT NULL,
  project_type TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_checklists_project ON content_request_checklists(project_id);
CREATE INDEX IF NOT EXISTS idx_content_checklists_client ON content_request_checklists(client_id);
CREATE INDEX IF NOT EXISTS idx_content_checklists_status ON content_request_checklists(status);
CREATE INDEX IF NOT EXISTS idx_content_items_checklist ON content_request_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_request_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_request_items(content_type);

-- Seed: Website Build content request template
INSERT INTO content_request_templates (name, description, items, project_type, is_active) VALUES (
  'Website Build Content Package',
  'Standard content checklist for custom website projects',
  '[
    {"title":"Business Bio / About Us","content_type":"text","category":"copy","is_required":true,"description":"Updated bios for all team members and company overview"},
    {"title":"Service Descriptions","content_type":"text","category":"copy","is_required":true,"description":"Written descriptions for each service offering"},
    {"title":"Logo Files (PNG + SVG)","content_type":"file","category":"brand_asset","is_required":true,"description":"High-resolution logo in PNG and vector SVG formats"},
    {"title":"Brand Colors & Fonts","content_type":"structured","category":"brand_asset","is_required":true,"description":"Primary/secondary colors (hex codes) and font names"},
    {"title":"High-Resolution Photos","content_type":"file","category":"photo","is_required":false,"description":"Portfolio/gallery images, team headshots, hero images"},
    {"title":"Website Inspiration Links","content_type":"url","category":"reference","is_required":false,"description":"Links to sites you love the look/feel of"},
    {"title":"Domain Registrar Info","content_type":"structured","category":"credentials","is_required":true,"description":"Where your domain is registered and login access"},
    {"title":"Team Member Info","content_type":"structured","category":"copy","is_required":false,"description":"Name, role, bio, photo for each team member"},
    {"title":"Billing Address","content_type":"structured","category":"other","is_required":true,"description":"Legal business name and billing address for invoices"},
    {"title":"Testimonials","content_type":"text","category":"copy","is_required":false,"description":"Client testimonials or reviews to feature on the site"}
  ]',
  'business-site',
  TRUE
);

-- DOWN
DROP INDEX IF EXISTS idx_content_items_type;
DROP INDEX IF EXISTS idx_content_items_status;
DROP INDEX IF EXISTS idx_content_items_checklist;
DROP INDEX IF EXISTS idx_content_checklists_status;
DROP INDEX IF EXISTS idx_content_checklists_client;
DROP INDEX IF EXISTS idx_content_checklists_project;
DROP TABLE IF EXISTS content_request_items;
DROP TABLE IF EXISTS content_request_checklists;
DROP TABLE IF EXISTS content_request_templates;
