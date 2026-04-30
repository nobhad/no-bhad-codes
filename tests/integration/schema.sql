CREATE TABLE migrations (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          filename TEXT NOT NULL,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(id, name)
        );
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  file_type TEXT DEFAULT 'document' CHECK (file_type IN ('document', 'image', 'video', 'archive', 'other')),
  description TEXT,
  uploaded_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, folder_id INTEGER REFERENCES file_folders(id) ON DELETE SET NULL, version INTEGER DEFAULT 1, is_archived BOOLEAN DEFAULT FALSE, archived_at DATETIME, archived_by TEXT, expires_at DATETIME, access_count INTEGER DEFAULT 0, last_accessed_at DATETIME, download_count INTEGER DEFAULT 0, checksum TEXT, is_locked BOOLEAN DEFAULT FALSE, locked_by TEXT, locked_at DATETIME, category TEXT DEFAULT 'general', uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, shared_with_client BOOLEAN DEFAULT FALSE, shared_at DATETIME, shared_by TEXT, deleted_at DATETIME DEFAULT NULL, deleted_by TEXT DEFAULT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  completed_date DATE,
  is_completed BOOLEAN DEFAULT FALSE,
  deliverables TEXT, -- JSON array of deliverables
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, sort_order INTEGER DEFAULT 0, estimated_hours DECIMAL(5,2), actual_hours DECIMAL(5,2), status TEXT DEFAULT 'pending', deleted_at DATETIME DEFAULT NULL, deleted_by TEXT DEFAULT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX idx_files_project_id ON files(project_id);
CREATE INDEX idx_milestones_project_id ON milestones(project_id);
CREATE TABLE message_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER DEFAULT NULL, -- NULL for general threads
  client_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  thread_type TEXT DEFAULT 'general' CHECK (thread_type IN ('general', 'project', 'support', 'quote')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_message_by TEXT DEFAULT NULL,
  participant_count INTEGER DEFAULT 2, -- client + admin
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, pinned_count INTEGER DEFAULT 0, archived_at DATETIME, archived_by TEXT, deleted_at DATETIME, deleted_by TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX idx_message_threads_client_id ON message_threads(client_id);
CREATE INDEX idx_message_threads_project_id ON message_threads(project_id);
CREATE INDEX idx_message_threads_status ON message_threads(status);
CREATE INDEX idx_message_threads_last_message_at ON message_threads(last_message_at);
CREATE TABLE contact_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
  ip_address TEXT,
  user_agent TEXT,
  message_id TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME,
  replied_at DATETIME
, client_id INTEGER REFERENCES clients(id), converted_at DATETIME);
CREATE INDEX idx_contact_submissions_email ON contact_submissions(email);
CREATE INDEX idx_contact_submissions_status ON contact_submissions(status);
CREATE INDEX idx_contact_submissions_created_at ON contact_submissions(created_at);
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- User who performed the action
    user_id INTEGER,
    user_email TEXT,
    user_type TEXT CHECK(user_type IN ('admin', 'client', 'system')) DEFAULT 'client',

    -- Action details
    action TEXT NOT NULL CHECK(action IN (
        'create', 'update', 'delete',
        'login', 'logout', 'login_failed',
        'view', 'export', 'import',
        'upload', 'download',
        'send_message', 'send_email',
        'status_change', 'password_reset'
    )),

    -- Entity being acted upon
    entity_type TEXT NOT NULL CHECK(entity_type IN (
        'client', 'project', 'invoice', 'message', 'file',
        'intake', 'contact_submission', 'session', 'settings'
    )),
    entity_id TEXT,
    entity_name TEXT,

    -- Change tracking
    old_value TEXT,  -- JSON stringified
    new_value TEXT,  -- JSON stringified
    changes TEXT,    -- JSON stringified diff

    -- Request context
    ip_address TEXT,
    user_agent TEXT,
    request_path TEXT,
    request_method TEXT,

    -- Additional metadata
    metadata TEXT,   -- JSON stringified

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
, prev_hash TEXT, hash TEXT);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_type ON audit_logs(user_type);
CREATE INDEX idx_audit_logs_user_date ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE TABLE visitor_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    visitor_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    last_activity TEXT NOT NULL,
    page_views INTEGER DEFAULT 1,
    total_time_on_site INTEGER DEFAULT 0,
    bounced INTEGER DEFAULT 1,
    referrer TEXT,
    user_agent TEXT,
    screen_resolution TEXT,
    language TEXT,
    timezone TEXT,
    ip_address TEXT,
    country TEXT,
    city TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    timestamp TEXT NOT NULL,
    time_on_page INTEGER DEFAULT 0,
    scroll_depth INTEGER DEFAULT 0,
    interactions INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES visitor_sessions(session_id) ON DELETE CASCADE
);
CREATE TABLE interaction_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    element TEXT,
    timestamp TEXT NOT NULL,
    url TEXT,
    data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES visitor_sessions(session_id) ON DELETE CASCADE
);
CREATE INDEX idx_visitor_sessions_visitor_id ON visitor_sessions(visitor_id);
CREATE INDEX idx_visitor_sessions_start_time ON visitor_sessions(start_time);
CREATE INDEX idx_visitor_sessions_last_activity ON visitor_sessions(last_activity);
CREATE INDEX idx_page_views_session_id ON page_views(session_id);
CREATE INDEX idx_page_views_timestamp ON page_views(timestamp);
CREATE INDEX idx_page_views_url ON page_views(url);
CREATE INDEX idx_interaction_events_session_id ON interaction_events(session_id);
CREATE INDEX idx_interaction_events_event_type ON interaction_events(event_type);
CREATE INDEX idx_interaction_events_timestamp ON interaction_events(timestamp);
CREATE TABLE uploaded_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_uploaded_files_filename ON uploaded_files(filename);
CREATE INDEX idx_contact_submissions_client_id ON contact_submissions(client_id);
CREATE TABLE invoice_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  deposit_invoice_id INTEGER NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  applied_by TEXT,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (deposit_invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
CREATE INDEX idx_invoice_credits_invoice ON invoice_credits(invoice_id);
CREATE INDEX idx_invoice_credits_deposit ON invoice_credits(deposit_invoice_id);
CREATE TABLE contract_signature_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'requested', 'viewed', 'signed', 'expired', 'reminder_sent'
  actor_email TEXT,
  actor_ip TEXT,
  actor_user_agent TEXT,
  details TEXT, -- JSON for additional context
  created_at TEXT DEFAULT (datetime('now'))
, contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL);
CREATE INDEX idx_contract_signature_log_project
ON contract_signature_log(project_id);
CREATE INDEX idx_contract_signature_log_action
ON contract_signature_log(action);
CREATE TABLE payment_plan_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  payments JSON NOT NULL,  -- [{percentage: 50, trigger: 'upfront'}, {percentage: 50, trigger: 'completion'}]
  is_default BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE invoice_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  reminder_type TEXT NOT NULL,  -- 'upcoming', 'due', 'overdue_3', 'overdue_7', 'overdue_14', 'overdue_30'
  scheduled_date DATE NOT NULL,
  sent_at DATETIME,
  status TEXT DEFAULT 'pending',  -- 'pending', 'sent', 'skipped', 'failed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
CREATE TABLE scheduled_invoices (
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
CREATE TABLE recurring_invoices (
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
CREATE INDEX idx_invoice_reminders_invoice ON invoice_reminders(invoice_id);
CREATE INDEX idx_invoice_reminders_status ON invoice_reminders(status, scheduled_date);
CREATE INDEX idx_scheduled_invoices_date ON scheduled_invoices(scheduled_date, status);
CREATE INDEX idx_recurring_invoices_next ON recurring_invoices(next_generation_date, is_active);
CREATE TABLE invoice_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,  -- 'venmo', 'paypal', 'bank_transfer', 'check', 'cash', 'credit_card', 'other'
  payment_reference TEXT,
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
CREATE TABLE payment_terms_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  days_until_due INTEGER NOT NULL,
  description TEXT,
  late_fee_rate DECIMAL(5,2),  -- Percentage late fee (e.g., 1.5 for 1.5%)
  late_fee_type TEXT DEFAULT 'none',  -- 'none', 'flat', 'percentage', 'daily_percentage'
  late_fee_flat_amount DECIMAL(10,2),  -- For flat late fees
  grace_period_days INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_date ON invoice_payments(payment_date);
CREATE TABLE client_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,              -- Job title
  department TEXT,
  role TEXT DEFAULT 'general',  -- 'primary', 'billing', 'technical', 'decision_maker', 'general'
  is_primary BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, deleted_at DATETIME DEFAULT NULL, deleted_by TEXT DEFAULT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE TABLE client_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL,  -- 'note', 'call', 'email', 'meeting', 'status_change', 'invoice_sent', 'payment_received', 'project_created', 'proposal_sent'
  title TEXT NOT NULL,
  description TEXT,
  metadata JSON,           -- Additional structured data (e.g., { "invoice_id": 123, "amount": 500 })
  created_by TEXT,         -- 'admin', 'system', 'client', or specific user email
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE TABLE client_custom_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  field_name TEXT NOT NULL UNIQUE,      -- Internal identifier (snake_case)
  field_label TEXT NOT NULL,             -- Display label
  field_type TEXT NOT NULL,              -- 'text', 'number', 'date', 'select', 'multiselect', 'boolean', 'url', 'email', 'phone'
  options JSON,                          -- For select/multiselect: ["Option 1", "Option 2"]
  is_required BOOLEAN DEFAULT FALSE,
  placeholder TEXT,                      -- Placeholder text for input
  default_value TEXT,                    -- Default value for new clients
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE client_custom_field_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  field_id INTEGER NOT NULL,
  field_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (field_id) REFERENCES client_custom_fields(id) ON DELETE CASCADE,
  UNIQUE(client_id, field_id)
);
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6b7280',       -- Hex color for visual identification
  description TEXT,
  tag_type TEXT DEFAULT 'client',     -- 'client', 'project', 'lead', 'general'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE client_tags (
  client_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, tag_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
CREATE INDEX idx_client_contacts_client ON client_contacts(client_id);
CREATE INDEX idx_client_contacts_email ON client_contacts(email);
CREATE INDEX idx_client_contacts_role ON client_contacts(role);
CREATE INDEX idx_client_activities_client ON client_activities(client_id);
CREATE INDEX idx_client_activities_type ON client_activities(activity_type);
CREATE INDEX idx_client_activities_created ON client_activities(created_at);
CREATE INDEX idx_client_custom_fields_active ON client_custom_fields(is_active);
CREATE INDEX idx_client_custom_field_values_client ON client_custom_field_values(client_id);
CREATE INDEX idx_client_custom_field_values_field ON client_custom_field_values(field_id);
CREATE INDEX idx_tags_type ON tags(tag_type);
CREATE INDEX idx_client_tags_client ON client_tags(client_id);
CREATE INDEX idx_client_tags_tag ON client_tags(tag_id);
CREATE TABLE task_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  depends_on_task_id INTEGER NOT NULL,
  dependency_type TEXT DEFAULT 'finish_to_start', -- 'finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES project_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_task_id) REFERENCES project_tasks(id) ON DELETE CASCADE,
  UNIQUE(task_id, depends_on_task_id)
);
CREATE TABLE project_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT,
  default_milestones JSON,        -- [{name, description, deliverables, order, estimated_days}]
  default_tasks JSON,             -- [{title, description, estimated_hours, milestone_index, priority}]
  estimated_duration_days INTEGER,
  default_hourly_rate DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, default_content_requests JSON, default_payment_schedule JSON, contract_template_id INTEGER REFERENCES contract_templates(id), tier_definitions JSON);
CREATE TABLE project_tags (
  project_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, tag_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
CREATE TABLE task_checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at DATETIME,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES project_tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_task_dependencies_task ON task_dependencies(task_id);
CREATE INDEX idx_task_dependencies_depends ON task_dependencies(depends_on_task_id);
CREATE INDEX idx_project_templates_type ON project_templates(project_type);
CREATE INDEX idx_project_templates_active ON project_templates(is_active);
CREATE INDEX idx_project_tags_project ON project_tags(project_id);
CREATE INDEX idx_project_tags_tag ON project_tags(tag_id);
CREATE INDEX idx_task_checklist_task ON task_checklist_items(task_id);
CREATE TABLE proposal_requests (
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
  reviewed_by TEXT, deleted_at DATETIME, deleted_by TEXT, contract_terms TEXT, is_legally_binding BOOLEAN DEFAULT FALSE, terms_accepted_at DATETIME, terms_version TEXT, reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE TABLE proposal_feature_selections (
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
CREATE INDEX idx_proposal_requests_project ON proposal_requests(project_id);
CREATE INDEX idx_proposal_requests_client ON proposal_requests(client_id);
CREATE INDEX idx_proposal_requests_status ON proposal_requests(status);
CREATE INDEX idx_proposal_requests_created_at ON proposal_requests(created_at);
CREATE INDEX idx_proposal_feature_selections_proposal ON proposal_feature_selections(proposal_request_id);
CREATE TABLE lead_scoring_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  field_name TEXT NOT NULL,         -- Field to evaluate (budget_range, project_type, timeline, etc.)
  operator TEXT NOT NULL,           -- 'equals', 'contains', 'greater_than', 'less_than', 'in', 'not_empty'
  threshold_value TEXT NOT NULL,    -- Value to compare against
  points INTEGER NOT NULL,          -- Points to add (positive) or subtract (negative)
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE pipeline_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6b7280',
  sort_order INTEGER DEFAULT 0,
  win_probability DECIMAL(3,2) DEFAULT 0,  -- 0.00 to 1.00
  is_won BOOLEAN DEFAULT FALSE,
  is_lost BOOLEAN DEFAULT FALSE,
  auto_convert_to_project BOOLEAN DEFAULT FALSE,  -- Auto-convert when moved here
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE lead_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE lead_duplicates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id_1 INTEGER NOT NULL,
  lead_id_2 INTEGER NOT NULL,
  similarity_score DECIMAL(3,2),    -- 0.00 to 1.00
  match_fields JSON,                -- Which fields matched
  status TEXT DEFAULT 'pending',    -- 'pending', 'merged', 'not_duplicate', 'dismissed'
  resolved_at DATETIME,
  resolved_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, resolved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (lead_id_1) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id_2) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX idx_lead_scoring_rules_active ON lead_scoring_rules(is_active);
CREATE INDEX idx_lead_scoring_rules_field ON lead_scoring_rules(field_name);
CREATE INDEX idx_pipeline_stages_order ON pipeline_stages(sort_order);
CREATE INDEX idx_lead_sources_active ON lead_sources(is_active);
CREATE INDEX idx_lead_duplicates_status ON lead_duplicates(status);
CREATE INDEX idx_lead_duplicates_leads ON lead_duplicates(lead_id_1, lead_id_2);
CREATE TABLE message_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,         -- 'admin', 'client'
  notify_all BOOLEAN DEFAULT TRUE,
  notify_mentions BOOLEAN DEFAULT TRUE,
  notify_replies BOOLEAN DEFAULT TRUE,
  muted_until DATETIME,            -- Temporary mute
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, user_email)
);
CREATE INDEX idx_message_subscriptions_project ON message_subscriptions(project_id);
CREATE INDEX idx_message_subscriptions_user ON message_subscriptions(user_email);
CREATE INDEX idx_threads_archived ON message_threads(archived_at);
CREATE TABLE file_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT,
  comment TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE(file_id, version_number)
);
CREATE TABLE file_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_folder_id INTEGER,
  color TEXT DEFAULT '#6b7280',
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_folder_id) REFERENCES file_folders(id) ON DELETE CASCADE,
  UNIQUE(project_id, parent_folder_id, name)
);
CREATE TABLE file_tags (
  file_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (file_id, tag_id),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
CREATE TABLE file_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,       -- 'admin', 'client'
  access_type TEXT NOT NULL,     -- 'view', 'download', 'preview'
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);
CREATE TABLE file_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  author_email TEXT NOT NULL,
  author_type TEXT NOT NULL,     -- 'admin', 'client'
  author_name TEXT,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  parent_comment_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_comment_id) REFERENCES file_comments(id) ON DELETE CASCADE
);
CREATE INDEX idx_file_versions_file ON file_versions(file_id);
CREATE INDEX idx_file_versions_current ON file_versions(file_id, is_current);
CREATE INDEX idx_file_folders_project ON file_folders(project_id);
CREATE INDEX idx_file_folders_parent ON file_folders(parent_folder_id);
CREATE INDEX idx_file_tags_file ON file_tags(file_id);
CREATE INDEX idx_file_tags_tag ON file_tags(tag_id);
CREATE INDEX idx_file_access_log_file ON file_access_log(file_id);
CREATE INDEX idx_file_access_log_user ON file_access_log(user_email);
CREATE INDEX idx_file_access_log_date ON file_access_log(created_at);
CREATE INDEX idx_file_comments_file ON file_comments(file_id);
CREATE INDEX idx_file_comments_author ON file_comments(author_email);
CREATE INDEX idx_files_folder ON files(folder_id);
CREATE INDEX idx_files_archived ON files(is_archived);
CREATE INDEX idx_files_expires ON files(expires_at);
CREATE INDEX idx_files_category ON files(category);
CREATE INDEX idx_files_locked ON files(is_locked);
CREATE TABLE saved_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,       -- 'revenue', 'pipeline', 'project', 'client', 'team', 'lead', 'invoice'
  filters JSON,                    -- Report filter configuration
  columns JSON,                    -- Visible columns configuration
  sort_by TEXT,
  sort_order TEXT DEFAULT 'DESC',
  chart_type TEXT,                 -- 'bar', 'line', 'pie', 'area', 'table'
  is_favorite BOOLEAN DEFAULT FALSE,
  is_shared BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE report_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  name TEXT,
  frequency TEXT NOT NULL,         -- 'daily', 'weekly', 'monthly', 'quarterly'
  day_of_week INTEGER,             -- 0-6 for weekly
  day_of_month INTEGER,            -- 1-31 for monthly
  time_of_day TEXT DEFAULT '09:00',
  timezone TEXT DEFAULT 'America/New_York',
  recipients JSON,                 -- [{email, name}]
  format TEXT DEFAULT 'pdf',       -- 'pdf', 'csv', 'excel'
  include_charts BOOLEAN DEFAULT TRUE,
  last_sent_at DATETIME,
  next_send_at DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES saved_reports(id) ON DELETE CASCADE
);
CREATE TABLE dashboard_widgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  widget_type TEXT NOT NULL,       -- 'metric', 'chart', 'list', 'table', 'progress', 'calendar'
  title TEXT,
  data_source TEXT NOT NULL,       -- 'revenue', 'projects', 'clients', 'leads', 'invoices', 'tasks'
  config JSON,                     -- Widget-specific configuration
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 1,         -- Grid units
  height INTEGER DEFAULT 1,        -- Grid units
  refresh_interval INTEGER,        -- Seconds, null for no auto-refresh
  is_visible BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE kpi_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date DATE NOT NULL,
  kpi_type TEXT NOT NULL,          -- 'revenue', 'pipeline_value', 'client_count', 'project_count', 'conversion_rate', etc.
  value DECIMAL(15,2),
  previous_value DECIMAL(15,2),
  change_percent DECIMAL(5,2),
  metadata JSON,                   -- Additional context
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE report_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER,
  schedule_id INTEGER,
  run_type TEXT NOT NULL,          -- 'manual', 'scheduled'
  status TEXT DEFAULT 'pending',   -- 'pending', 'running', 'completed', 'failed'
  started_at DATETIME,
  completed_at DATETIME,
  row_count INTEGER,
  file_path TEXT,
  error_message TEXT,
  run_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES saved_reports(id) ON DELETE SET NULL,
  FOREIGN KEY (schedule_id) REFERENCES report_schedules(id) ON DELETE SET NULL
);
CREATE TABLE dashboard_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  widgets JSON,                    -- Array of widget configurations
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE metric_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kpi_type TEXT NOT NULL,
  condition TEXT NOT NULL,         -- 'above', 'below', 'equals', 'change_above', 'change_below'
  threshold_value DECIMAL(15,2) NOT NULL,
  notification_emails JSON,
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at DATETIME,
  trigger_count INTEGER DEFAULT 0,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_saved_reports_type ON saved_reports(report_type);
CREATE INDEX idx_saved_reports_user ON saved_reports(created_by);
CREATE INDEX idx_saved_reports_favorite ON saved_reports(is_favorite);
CREATE INDEX idx_report_schedules_report ON report_schedules(report_id);
CREATE INDEX idx_report_schedules_next ON report_schedules(next_send_at);
CREATE INDEX idx_report_schedules_active ON report_schedules(is_active);
CREATE INDEX idx_dashboard_widgets_user ON dashboard_widgets(user_email);
CREATE INDEX idx_dashboard_widgets_type ON dashboard_widgets(widget_type);
CREATE INDEX idx_kpi_snapshots_date ON kpi_snapshots(snapshot_date);
CREATE INDEX idx_kpi_snapshots_type ON kpi_snapshots(kpi_type);
CREATE INDEX idx_kpi_snapshots_date_type ON kpi_snapshots(snapshot_date, kpi_type);
CREATE INDEX idx_report_runs_report ON report_runs(report_id);
CREATE INDEX idx_report_runs_schedule ON report_runs(schedule_id);
CREATE INDEX idx_report_runs_status ON report_runs(status);
CREATE INDEX idx_metric_alerts_type ON metric_alerts(kpi_type);
CREATE INDEX idx_metric_alerts_active ON metric_alerts(is_active);
CREATE TABLE contract_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  reminder_type TEXT NOT NULL,  -- 'initial', 'followup_3', 'followup_7', 'final_14'
  scheduled_date DATE NOT NULL,
  sent_at DATETIME,
  status TEXT DEFAULT 'pending',  -- 'pending', 'sent', 'skipped', 'failed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX idx_contract_reminders_project ON contract_reminders(project_id);
CREATE INDEX idx_contract_reminders_status ON contract_reminders(status, scheduled_date);
CREATE TABLE deliverable_workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  status TEXT DEFAULT 'draft',  -- 'draft', 'pending_review', 'in_review', 'changes_requested', 'approved', 'rejected'
  version INTEGER DEFAULT 1,
  submitted_at DATETIME,
  submitted_by TEXT,
  reviewed_at DATETIME,
  reviewed_by TEXT,
  approved_at DATETIME,
  approved_by TEXT,
  rejection_reason TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, submitted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE deliverable_review_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL,
  author_email TEXT NOT NULL,
  author_name TEXT,
  author_type TEXT NOT NULL,  -- 'admin', 'client'
  comment TEXT NOT NULL,
  comment_type TEXT DEFAULT 'feedback',  -- 'feedback', 'approval', 'rejection', 'revision_request'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (workflow_id) REFERENCES deliverable_workflows(id) ON DELETE CASCADE
);
CREATE TABLE deliverable_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES deliverable_workflows(id) ON DELETE CASCADE
);
CREATE INDEX idx_deliverable_workflows_file ON deliverable_workflows(file_id);
CREATE INDEX idx_deliverable_workflows_project ON deliverable_workflows(project_id);
CREATE INDEX idx_deliverable_workflows_status ON deliverable_workflows(status);
CREATE INDEX idx_deliverable_review_comments_workflow ON deliverable_review_comments(workflow_id);
CREATE INDEX idx_deliverable_history_workflow ON deliverable_history(workflow_id);
CREATE TABLE approval_workflow_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL,  -- 'proposal', 'invoice', 'contract', 'deliverable', 'project'
  workflow_type TEXT DEFAULT 'sequential',  -- 'sequential', 'parallel', 'any_one'
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE approval_workflow_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_definition_id INTEGER NOT NULL,
  step_order INTEGER NOT NULL,
  approver_type TEXT NOT NULL,  -- 'user', 'role', 'client'
  approver_value TEXT NOT NULL,  -- email, role name, or 'owner'
  is_optional BOOLEAN DEFAULT FALSE,
  auto_approve_after_hours INTEGER,  -- Auto-approve if no response
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_definition_id) REFERENCES approval_workflow_definitions(id) ON DELETE CASCADE,
  UNIQUE(workflow_definition_id, step_order)
);
CREATE TABLE approval_workflow_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_definition_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',  -- 'pending', 'in_progress', 'approved', 'rejected', 'cancelled'
  current_step INTEGER DEFAULT 1,
  initiated_by TEXT NOT NULL,
  initiated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  notes TEXT,
  FOREIGN KEY (workflow_definition_id) REFERENCES approval_workflow_definitions(id) ON DELETE CASCADE
);
CREATE TABLE approval_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_instance_id INTEGER NOT NULL,
  step_id INTEGER NOT NULL,
  approver_email TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'skipped'
  decision_at DATETIME,
  decision_comment TEXT,
  reminder_sent_at DATETIME,
  reminder_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_instance_id) REFERENCES approval_workflow_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES approval_workflow_steps(id) ON DELETE CASCADE
);
CREATE TABLE approval_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_instance_id INTEGER NOT NULL,
  action TEXT NOT NULL,  -- 'initiated', 'approved', 'rejected', 'skipped', 'cancelled', 'auto_approved'
  actor_email TEXT NOT NULL,
  step_id INTEGER,
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_instance_id) REFERENCES approval_workflow_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES approval_workflow_steps(id) ON DELETE SET NULL
);
CREATE INDEX idx_approval_definitions_entity ON approval_workflow_definitions(entity_type);
CREATE INDEX idx_approval_definitions_active ON approval_workflow_definitions(is_active);
CREATE INDEX idx_approval_steps_definition ON approval_workflow_steps(workflow_definition_id);
CREATE INDEX idx_approval_instances_entity ON approval_workflow_instances(entity_type, entity_id);
CREATE INDEX idx_approval_instances_status ON approval_workflow_instances(status);
CREATE INDEX idx_approval_requests_instance ON approval_requests(workflow_instance_id);
CREATE INDEX idx_approval_requests_approver ON approval_requests(approver_email, status);
CREATE INDEX idx_approval_history_instance ON approval_history(workflow_instance_id);
CREATE TABLE workflow_triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL,  -- 'invoice.created', 'contract.signed', 'project.status_changed', etc.
  conditions JSON,           -- Optional conditions: {"status": "approved", "amount_gt": 1000}
  action_type TEXT NOT NULL, -- 'send_email', 'create_task', 'update_status', 'webhook', 'notify'
  action_config JSON NOT NULL, -- Action-specific config
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0, -- Higher = runs first
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE workflow_trigger_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSON,
  action_result TEXT,  -- 'success', 'failed', 'skipped'
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trigger_id) REFERENCES workflow_triggers(id) ON DELETE CASCADE
);
CREATE TABLE system_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  entity_type TEXT,       -- 'invoice', 'project', 'client', 'contract', etc.
  entity_id INTEGER,
  event_data JSON,
  triggered_by TEXT,      -- User email or 'system'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_workflow_triggers_event ON workflow_triggers(event_type, is_active);
CREATE INDEX idx_workflow_trigger_logs_trigger ON workflow_trigger_logs(trigger_id);
CREATE INDEX idx_workflow_trigger_logs_date ON workflow_trigger_logs(created_at);
CREATE INDEX idx_system_events_type ON system_events(event_type);
CREATE INDEX idx_system_events_entity ON system_events(entity_type, entity_id);
CREATE INDEX idx_system_events_date ON system_events(created_at);
CREATE TABLE document_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  project_id INTEGER,                           -- Optional project association
  requested_by TEXT NOT NULL,                   -- Admin email who requested
  title TEXT NOT NULL,                          -- Brief title of request
  description TEXT,                             -- Detailed description of what's needed
  document_type TEXT DEFAULT 'general',         -- 'general', 'contract', 'invoice', 'asset', 'source', 'deliverable', 'identification', 'other'
  priority TEXT DEFAULT 'normal',               -- 'low', 'normal', 'high', 'urgent'
  status TEXT DEFAULT 'requested',              -- 'requested', 'viewed', 'uploaded', 'under_review', 'approved', 'rejected'
  due_date DATE,                                -- Optional due date
  file_id INTEGER,                              -- Linked file once uploaded
  uploaded_by TEXT,                             -- Client email who uploaded
  uploaded_at DATETIME,
  reviewed_by TEXT,                             -- Admin who reviewed
  reviewed_at DATETIME,
  review_notes TEXT,                            -- Notes from review
  rejection_reason TEXT,                        -- Reason if rejected
  is_required BOOLEAN DEFAULT TRUE,             -- Whether this is a required document
  reminder_sent_at DATETIME,                    -- When last reminder was sent
  reminder_count INTEGER DEFAULT 0,             -- Number of reminders sent
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, approved_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL, deleted_at DATETIME, deleted_by TEXT,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);
CREATE TABLE document_request_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT DEFAULT 'general',
  is_required BOOLEAN DEFAULT TRUE,
  days_until_due INTEGER DEFAULT 7,             -- Default days until due from creation
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, category TEXT DEFAULT 'general', project_type TEXT);
CREATE TABLE document_request_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  action TEXT NOT NULL,                         -- 'created', 'viewed', 'uploaded', 'approved', 'rejected', 'reminder_sent', 'due_date_changed'
  old_status TEXT,
  new_status TEXT,
  actor_email TEXT NOT NULL,
  actor_type TEXT NOT NULL,                     -- 'admin', 'client', 'system'
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES document_requests(id) ON DELETE CASCADE
);
CREATE INDEX idx_document_requests_client ON document_requests(client_id);
CREATE INDEX idx_document_requests_project ON document_requests(project_id);
CREATE INDEX idx_document_requests_status ON document_requests(status);
CREATE INDEX idx_document_requests_due ON document_requests(due_date);
CREATE INDEX idx_document_request_history_request ON document_request_history(request_id);
CREATE TABLE notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'client',           -- 'client', 'admin'

  -- Email notification settings
  email_enabled BOOLEAN DEFAULT TRUE,                 -- Master switch for emails
  email_frequency TEXT DEFAULT 'immediate',           -- 'immediate', 'daily_digest', 'weekly_digest', 'none'
  digest_time TEXT DEFAULT '09:00',                   -- Preferred time for digest emails (HH:MM)
  digest_day TEXT DEFAULT 'monday',                   -- Preferred day for weekly digest

  -- Event-specific preferences (1 = enabled, 0 = disabled)
  notify_new_message BOOLEAN DEFAULT TRUE,            -- New message received
  notify_message_reply BOOLEAN DEFAULT TRUE,          -- Reply to your message
  notify_invoice_created BOOLEAN DEFAULT TRUE,        -- New invoice created
  notify_invoice_reminder BOOLEAN DEFAULT TRUE,       -- Invoice payment reminder
  notify_invoice_paid BOOLEAN DEFAULT FALSE,          -- Payment confirmation
  notify_project_update BOOLEAN DEFAULT TRUE,         -- Project status change
  notify_project_milestone BOOLEAN DEFAULT TRUE,      -- Milestone completed
  notify_document_request BOOLEAN DEFAULT TRUE,       -- New document request
  notify_document_approved BOOLEAN DEFAULT TRUE,      -- Document approved
  notify_document_rejected BOOLEAN DEFAULT TRUE,      -- Document rejected (always want to know)
  notify_deliverable_ready BOOLEAN DEFAULT TRUE,      -- Deliverable ready for review
  notify_proposal_created BOOLEAN DEFAULT TRUE,       -- New proposal sent
  notify_contract_ready BOOLEAN DEFAULT TRUE,         -- Contract ready for signature
  notify_file_uploaded BOOLEAN DEFAULT FALSE,         -- New file uploaded to project

  -- Quiet hours (don't send notifications during these times)
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TEXT DEFAULT '22:00',             -- Start of quiet hours (HH:MM)
  quiet_hours_end TEXT DEFAULT '08:00',               -- End of quiet hours (HH:MM)

  -- Communication preferences
  marketing_emails BOOLEAN DEFAULT TRUE,              -- Marketing/promotional emails
  newsletter_emails BOOLEAN DEFAULT TRUE,             -- Newsletter subscription
  product_updates BOOLEAN DEFAULT TRUE,               -- Product update announcements

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, user_type)
);
CREATE TABLE notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,
  notification_type TEXT NOT NULL,                    -- Type of notification sent
  channel TEXT NOT NULL DEFAULT 'email',              -- 'email', 'push', 'in_app'
  subject TEXT,
  message_preview TEXT,
  status TEXT DEFAULT 'pending',                      -- 'pending', 'sent', 'delivered', 'failed', 'bounced'
  error_message TEXT,
  sent_at DATETIME,
  delivered_at DATETIME,
  read_at DATETIME,
  metadata JSON,                                      -- Additional data (entity_id, entity_type, etc.)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE notification_digest_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  entity_type TEXT,                                   -- 'message', 'invoice', 'project', etc.
  entity_id INTEGER,
  priority INTEGER DEFAULT 0,                         -- Higher = more important
  processed BOOLEAN DEFAULT FALSE,
  processed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id, user_type);
CREATE INDEX idx_notification_log_user ON notification_log(user_id, user_type);
CREATE INDEX idx_notification_log_type ON notification_log(notification_type);
CREATE INDEX idx_notification_log_status ON notification_log(status);
CREATE INDEX idx_notification_digest_queue_user ON notification_digest_queue(user_id, user_type);
CREATE INDEX idx_notification_digest_queue_processed ON notification_digest_queue(processed);
CREATE TABLE kb_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,               -- URL-friendly name
  description TEXT,
  icon TEXT DEFAULT 'book',                -- Icon name for display
  color TEXT DEFAULT '#6b7280',            -- Category color
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE kb_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,                      -- URL-friendly title
  summary TEXT,                            -- Brief description for list view
  content TEXT NOT NULL,                   -- Full article content (markdown supported)
  keywords TEXT,                           -- Search keywords (comma-separated)
  is_featured BOOLEAN DEFAULT FALSE,       -- Show on main KB page
  is_published BOOLEAN DEFAULT TRUE,       -- Draft vs published
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,         -- "Was this helpful?" yes count
  not_helpful_count INTEGER DEFAULT 0,     -- "Was this helpful?" no count
  sort_order INTEGER DEFAULT 0,
  author_email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME, author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE CASCADE,
  UNIQUE(category_id, slug)
);
CREATE TABLE kb_article_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  user_id INTEGER,
  user_type TEXT,                          -- 'client', 'admin', 'anonymous'
  is_helpful BOOLEAN NOT NULL,
  comment TEXT,                            -- Optional feedback comment
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE
);
CREATE TABLE kb_search_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  user_id INTEGER,
  user_type TEXT,
  clicked_article_id INTEGER,              -- Which article they clicked (if any)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_kb_categories_slug ON kb_categories(slug);
CREATE INDEX idx_kb_categories_active ON kb_categories(is_active);
CREATE INDEX idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX idx_kb_articles_slug ON kb_articles(slug);
CREATE INDEX idx_kb_articles_published ON kb_articles(is_published);
CREATE INDEX idx_kb_articles_featured ON kb_articles(is_featured);
CREATE INDEX idx_kb_feedback_article ON kb_article_feedback(article_id);
CREATE INDEX idx_kb_search_log_query ON kb_search_log(query);
CREATE TABLE IF NOT EXISTS "projects" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  project_name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'in-progress', 'in-review', 'completed', 'on-hold', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  start_date DATE,
  estimated_end_date DATE,
  actual_end_date DATE,
  budget_range TEXT,
  project_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- From 007_project_request_columns
  timeline TEXT,
  preview_url TEXT,
  -- From 020_project_price
  price TEXT,
  -- From 021_project_additional_fields
  notes TEXT,
  repository_url TEXT,
  staging_url TEXT,
  production_url TEXT,
  deposit_amount TEXT,
  contract_signed_at DATETIME,
  -- From 025_fix_project_status_constraint
  cancelled_by TEXT,
  cancellation_reason TEXT,
  -- From 031_project_enhancements
  hourly_rate DECIMAL(10,2),
  estimated_hours DECIMAL(6,2),
  actual_hours DECIMAL(6,2),
  template_id INTEGER REFERENCES project_templates(id),
  archived_at DATETIME,
  project_health TEXT DEFAULT 'on_track',
  health_notes TEXT, deleted_at DATETIME, deleted_by TEXT, expected_value DECIMAL(10,2), contract_countersigned_at DATETIME, contract_countersigner_name TEXT, contract_countersigner_email TEXT, contract_countersigner_ip TEXT, contract_countersigner_user_agent TEXT, contract_countersignature_data TEXT, contract_signed_pdf_path TEXT, lead_score INTEGER DEFAULT 0, lead_score_breakdown JSON, pipeline_stage_id INTEGER REFERENCES pipeline_stages(id), lead_source_id INTEGER REFERENCES lead_sources(id), assigned_to TEXT, expected_close_date DATE, lost_reason TEXT, lost_at DATETIME, won_at DATETIME, competitor TEXT, last_activity_at DATETIME, next_follow_up_at DATETIME, source_type TEXT DEFAULT 'direct'
  CHECK (source_type IN ('direct', 'intake_form', 'referral', 'import', 'other')), intake_id INTEGER REFERENCES "_client_intakes_archived_086"(id), contract_signature_token TEXT, contract_signature_requested_at TEXT, contract_signature_expires_at TEXT, contract_signer_name TEXT, contract_signer_email TEXT, contract_signer_ip TEXT, contract_signer_user_agent TEXT, contract_signature_data TEXT, contract_reminders_enabled BOOLEAN DEFAULT TRUE, version INTEGER NOT NULL DEFAULT 1, features TEXT, design_level TEXT, content_status TEXT, tech_comfort TEXT, hosting_preference TEXT, page_count TEXT, integrations TEXT, brand_assets TEXT, inspiration TEXT, current_site TEXT, challenges TEXT, additional_info TEXT, addons TEXT, referral_source TEXT, default_deposit_percentage DECIMAL(5, 2) DEFAULT 50, project_code TEXT, maintenance_tier TEXT
  CHECK(maintenance_tier IN ('diy', 'essential', 'standard', 'premium')), maintenance_status TEXT DEFAULT 'inactive'
  CHECK(maintenance_status IN ('inactive', 'pending', 'active', 'paused', 'cancelled')), maintenance_start_date TEXT, maintenance_recurring_invoice_id INTEGER
  REFERENCES recurring_invoices(id), maintenance_included_months INTEGER DEFAULT 0, maintenance_included_until TEXT, netlify_url TEXT, netlify_email TEXT, netlify_password TEXT, umami_url TEXT, umami_email TEXT, umami_password TEXT,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_template ON projects(template_id);
CREATE INDEX idx_projects_health ON projects(project_health);
CREATE INDEX idx_projects_archived ON projects(archived_at);
CREATE INDEX idx_projects_deleted ON projects(deleted_at);
CREATE INDEX idx_proposal_requests_deleted ON proposal_requests(deleted_at);
CREATE INDEX idx_projects_client_status
ON projects(client_id, status);
CREATE INDEX idx_client_activities_client_date
ON client_activities(client_id, created_at);
CREATE INDEX idx_audit_logs_entity_date
ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX idx_page_views_created
ON page_views(created_at);
CREATE INDEX idx_interaction_events_created
ON interaction_events(created_at);
CREATE TABLE contract_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'standard', 'custom', 'amendment', 'nda', 'maintenance'
  content TEXT NOT NULL,
  variables JSON, -- JSON array of allowed variables
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER REFERENCES contract_templates(id),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'viewed', 'signed', 'expired', 'cancelled'
  variables JSON, -- JSON snapshot of resolved variables
  sent_at DATETIME,
  signed_at DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, signer_name TEXT, signer_email TEXT, signer_ip TEXT, signer_user_agent TEXT, signature_data TEXT, countersigned_at DATETIME, countersigner_name TEXT, countersigner_email TEXT, countersigner_ip TEXT, countersigner_user_agent TEXT, countersignature_data TEXT, signed_pdf_path TEXT, parent_contract_id INTEGER REFERENCES contracts(id), renewal_at DATETIME, renewal_reminder_sent_at DATETIME, last_reminder_at DATETIME, reminder_count INTEGER DEFAULT 0, signature_token TEXT, signature_requested_at DATETIME, signature_expires_at DATETIME, deleted_at DATETIME, deleted_by TEXT, version INTEGER NOT NULL DEFAULT 1);
CREATE INDEX idx_contract_templates_type ON contract_templates(type);
CREATE INDEX idx_contract_templates_active ON contract_templates(is_active);
CREATE INDEX idx_contracts_project ON contracts(project_id);
CREATE INDEX idx_contracts_client ON contracts(client_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_parent ON contracts(parent_contract_id);
CREATE INDEX idx_contracts_renewal_at ON contracts(renewal_at);
CREATE TABLE questionnaires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                              -- Internal name for reference
  description TEXT,                                -- Description shown to client
  project_type TEXT,                               -- Optional: 'website', 'branding', 'ecommerce', etc.
  questions JSON NOT NULL,                         -- Array of question objects
  is_active BOOLEAN DEFAULT TRUE,                  -- Whether available for sending
  auto_send_on_project_create BOOLEAN DEFAULT FALSE, -- Auto-send when project created
  display_order INTEGER DEFAULT 0,                 -- Order in admin list
  created_by TEXT,                                 -- Admin who created
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE questionnaire_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  questionnaire_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  project_id INTEGER,                              -- Optional project association
  answers JSON NOT NULL DEFAULT '{}',              -- Client's answers
  status TEXT DEFAULT 'pending',                   -- 'pending', 'in_progress', 'completed'
  started_at DATETIME,                             -- When client first opened
  completed_at DATETIME,                           -- When client submitted
  due_date DATE,                                   -- Optional due date
  reminder_count INTEGER DEFAULT 0,                -- Number of reminders sent
  reminder_sent_at DATETIME,                       -- When last reminder was sent
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, exported_file_id INTEGER REFERENCES files(id),
  FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);
CREATE INDEX idx_questionnaires_project_type ON questionnaires(project_type);
CREATE INDEX idx_questionnaires_active ON questionnaires(is_active);
CREATE INDEX idx_questionnaire_responses_questionnaire ON questionnaire_responses(questionnaire_id);
CREATE INDEX idx_questionnaire_responses_client ON questionnaire_responses(client_id);
CREATE INDEX idx_questionnaire_responses_project ON questionnaire_responses(project_id);
CREATE INDEX idx_questionnaire_responses_status ON questionnaire_responses(status);
CREATE TABLE client_onboarding (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,               -- One record per client
  project_id INTEGER,                              -- Associated project if any
  current_step INTEGER DEFAULT 1,                  -- Current step (1-5)
  step_data JSON DEFAULT '{}',                     -- Data collected at each step
  status TEXT DEFAULT 'not_started',               -- 'not_started', 'in_progress', 'completed'
  completed_at DATETIME,                           -- When onboarding finished
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);
CREATE TABLE client_info_completeness (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,               -- One record per client
  overall_percentage INTEGER DEFAULT 0,            -- 0-100 percentage complete
  profile_complete BOOLEAN DEFAULT FALSE,          -- Basic profile filled
  documents_pending INTEGER DEFAULT 0,             -- Count of pending doc requests
  documents_approved INTEGER DEFAULT 0,            -- Count of approved doc requests
  documents_total INTEGER DEFAULT 0,               -- Total doc requests
  questionnaires_pending INTEGER DEFAULT 0,        -- Count of pending questionnaires
  questionnaires_completed INTEGER DEFAULT 0,      -- Count of completed questionnaires
  questionnaires_total INTEGER DEFAULT 0,          -- Total questionnaires
  onboarding_complete BOOLEAN DEFAULT FALSE,       -- Onboarding wizard done
  last_calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX idx_client_onboarding_client ON client_onboarding(client_id);
CREATE INDEX idx_client_onboarding_status ON client_onboarding(status);
CREATE INDEX idx_client_info_completeness_client ON client_info_completeness(client_id);
CREATE INDEX idx_client_info_completeness_percentage ON client_info_completeness(overall_percentage);
CREATE INDEX idx_document_request_templates_category ON document_request_templates(category);
CREATE INDEX idx_document_request_templates_project_type ON document_request_templates(project_type);
CREATE TABLE ad_hoc_requests (
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
  deleted_by TEXT, attachment_file_id INTEGER, task_id INTEGER, converted_at DATETIME, converted_by TEXT, converted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX idx_ad_hoc_requests_project ON ad_hoc_requests(project_id);
CREATE INDEX idx_ad_hoc_requests_client ON ad_hoc_requests(client_id);
CREATE INDEX idx_ad_hoc_requests_status ON ad_hoc_requests(status);
CREATE INDEX idx_ad_hoc_requests_type ON ad_hoc_requests(request_type);
CREATE INDEX idx_ad_hoc_requests_created_at ON ad_hoc_requests(created_at);
CREATE INDEX idx_ad_hoc_requests_deleted ON ad_hoc_requests(deleted_at);
CREATE INDEX idx_ad_hoc_requests_attachment ON ad_hoc_requests(attachment_file_id);
CREATE INDEX idx_ad_hoc_requests_task_id ON ad_hoc_requests(task_id);
CREATE TABLE ad_hoc_request_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  invoice_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES ad_hoc_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
CREATE INDEX idx_ad_hoc_request_invoices_request ON ad_hoc_request_invoices(request_id);
CREATE INDEX idx_ad_hoc_request_invoices_invoice ON ad_hoc_request_invoices(invoice_id);
CREATE INDEX idx_ad_hoc_request_invoices_created ON ad_hoc_request_invoices(created_at);
CREATE TABLE email_templates (
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
CREATE TABLE email_template_versions (
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
CREATE TABLE email_send_logs (
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
CREATE INDEX idx_email_templates_category ON email_templates(category);
CREATE INDEX idx_email_templates_name ON email_templates(name);
CREATE INDEX idx_email_template_versions_template ON email_template_versions(template_id);
CREATE INDEX idx_email_send_logs_template ON email_send_logs(template_id);
CREATE INDEX idx_email_send_logs_recipient ON email_send_logs(recipient_email);
CREATE INDEX idx_email_send_logs_status ON email_send_logs(status);
CREATE INDEX idx_email_send_logs_date ON email_send_logs(created_at);
CREATE TABLE invoice_payment_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE calendar_sync_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  calendar_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER NOT NULL,
  sync_milestones BOOLEAN DEFAULT TRUE,
  sync_tasks BOOLEAN DEFAULT TRUE,
  sync_invoice_due_dates BOOLEAN DEFAULT FALSE,
  last_sync_at DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_calendar_sync_user ON calendar_sync_configs(user_id);
CREATE TABLE integration_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  integration_type TEXT NOT NULL CHECK (integration_type IN ('stripe', 'google_calendar', 'slack', 'discord', 'zapier')),
  is_configured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  configuration TEXT, -- JSON with non-sensitive config
  last_activity_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_integration_status_type ON integration_status(integration_type);
CREATE TABLE notification_integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('slack', 'discord')),
  webhook_url TEXT NOT NULL,
  channel TEXT,
  events TEXT NOT NULL, -- Comma-separated event types
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE duplicate_detection_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_type TEXT NOT NULL CHECK (scan_type IN ('manual', 'automatic', 'intake_submission')),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'lead', 'intake', 'all')),
    source_id INTEGER,
    source_type TEXT CHECK (source_type IN ('client', 'lead', 'intake')),
    duplicates_found INTEGER DEFAULT 0,
    matches_json TEXT, -- JSON array of DuplicateMatch objects
    threshold_used REAL DEFAULT 0.7,
    scanned_by TEXT, -- 'system' or admin email
    scan_duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE duplicate_resolution_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    detection_log_id INTEGER REFERENCES duplicate_detection_log(id),
    primary_record_id INTEGER NOT NULL,
    primary_record_type TEXT NOT NULL CHECK (primary_record_type IN ('client', 'lead', 'intake')),
    merged_record_id INTEGER NOT NULL,
    merged_record_type TEXT NOT NULL CHECK (merged_record_type IN ('client', 'lead', 'intake')),
    resolution_type TEXT NOT NULL CHECK (resolution_type IN ('merge', 'dismiss', 'mark_not_duplicate')),
    fields_merged TEXT, -- JSON array of field names that were merged
    resolved_by TEXT NOT NULL, -- admin email
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
, resolved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE validation_error_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- 'intake', 'client', 'lead', 'invoice', etc.
    entity_id INTEGER,
    field_name TEXT NOT NULL,
    field_value TEXT,
    error_type TEXT NOT NULL CHECK (error_type IN ('format', 'xss', 'sql_injection', 'length', 'required', 'pattern', 'file')),
    error_message TEXT NOT NULL,
    was_sanitized INTEGER DEFAULT 0,
    sanitized_value TEXT,
    source_ip TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE data_quality_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_date TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'lead', 'intake', 'invoice', 'project')),
    total_records INTEGER NOT NULL,
    valid_emails INTEGER DEFAULT 0,
    valid_phones INTEGER DEFAULT 0,
    complete_records INTEGER DEFAULT 0, -- Records with all required fields
    duplicate_count INTEGER DEFAULT 0,
    quality_score REAL, -- 0-100 percentage
    details_json TEXT, -- Additional breakdown details
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(metric_date, entity_type)
);
CREATE TABLE rate_limit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    is_blocked INTEGER DEFAULT 0,
    blocked_until TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE blocked_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    blocked_by TEXT, -- 'system' or admin email
    blocked_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT, -- NULL for permanent
    is_active INTEGER DEFAULT 1
, blocked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL);
CREATE INDEX idx_duplicate_detection_log_scan_type ON duplicate_detection_log(scan_type);
CREATE INDEX idx_duplicate_detection_log_created_at ON duplicate_detection_log(created_at);
CREATE INDEX idx_duplicate_resolution_log_detection_id ON duplicate_resolution_log(detection_log_id);
CREATE INDEX idx_validation_error_log_entity ON validation_error_log(entity_type, entity_id);
CREATE INDEX idx_validation_error_log_error_type ON validation_error_log(error_type);
CREATE INDEX idx_validation_error_log_created_at ON validation_error_log(created_at);
CREATE INDEX idx_data_quality_metrics_date ON data_quality_metrics(metric_date);
CREATE INDEX idx_rate_limit_log_ip ON rate_limit_log(ip_address, endpoint);
CREATE INDEX idx_rate_limit_log_window ON rate_limit_log(window_start, window_end);
CREATE INDEX idx_blocked_ips_active ON blocked_ips(ip_address, is_active);
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT DEFAULT 'team_member' CHECK (role IN ('admin', 'team_member', 'contractor', 'system')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_active_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_files_uploaded_by_user ON files(uploaded_by_user_id);
CREATE INDEX idx_doc_requests_requested_by ON document_requests(requested_by_user_id);
CREATE INDEX idx_doc_requests_uploaded_by ON document_requests(uploaded_by_user_id);
CREATE INDEX idx_doc_requests_reviewed_by ON document_requests(reviewed_by_user_id);
CREATE INDEX idx_kb_articles_author ON kb_articles(author_user_id);
CREATE INDEX idx_questionnaires_created_by ON questionnaires(created_by_user_id);
CREATE INDEX idx_proposal_requests_reviewed_by ON proposal_requests(reviewed_by_user_id);
CREATE INDEX idx_deliverable_submitted ON deliverable_workflows(submitted_by_user_id);
CREATE INDEX idx_deliverable_reviewed ON deliverable_workflows(reviewed_by_user_id);
CREATE INDEX idx_deliverable_approved ON deliverable_workflows(approved_by_user_id);
CREATE INDEX idx_deliverable_comments_author ON deliverable_review_comments(author_user_id);
CREATE INDEX idx_dup_resolution_user ON duplicate_resolution_log(resolved_by_user_id);
CREATE INDEX idx_lead_dup_resolved ON lead_duplicates(resolved_by_user_id);
CREATE INDEX idx_blocked_ips_user ON blocked_ips(blocked_by_user_id);
CREATE INDEX idx_adhoc_converted_by ON ad_hoc_requests(converted_by_user_id);
CREATE INDEX idx_client_activities_user ON client_activities(created_by_user_id);
CREATE INDEX idx_projects_pipeline ON projects(pipeline_stage_id);
CREATE INDEX idx_projects_lead_score ON projects(lead_score);
CREATE INDEX idx_projects_assigned ON projects(assigned_to);
CREATE INDEX idx_projects_lead_source ON projects(lead_source_id);
CREATE INDEX idx_projects_expected_close ON projects(expected_close_date);
CREATE TABLE IF NOT EXISTS "clients" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  company_name TEXT,
  contact_name TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reset_token TEXT,
  reset_token_expiry DATETIME,
  billing_company TEXT,
  billing_address TEXT,
  billing_address2 TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_zip TEXT,
  billing_country TEXT,
  is_admin INTEGER DEFAULT 0,
  invitation_token TEXT,
  invitation_expires_at DATETIME,
  invitation_sent_at DATETIME,
  last_login_at DATETIME,
  magic_link_token TEXT,
  magic_link_expires_at DATETIME,
  client_type TEXT DEFAULT 'business',
  health_score INTEGER DEFAULT 100,
  health_status TEXT DEFAULT 'healthy',
  lifetime_value DECIMAL(10,2) DEFAULT 0,
  acquisition_source TEXT,
  industry TEXT,
  company_size TEXT,
  website TEXT,
  last_contact_date DATE,
  next_follow_up_date DATE,
  notes TEXT,
  preferred_contact_method TEXT,
  welcome_sequence_started_at DATETIME,
  welcome_sequence_completed BOOLEAN DEFAULT FALSE,
  deleted_at DATETIME,
  deleted_by TEXT
, last_login DATETIME DEFAULT NULL, billing_name TEXT, failed_login_attempts INTEGER DEFAULT 0, locked_until DATETIME DEFAULT NULL, email_verified INTEGER DEFAULT 0, email_verification_token TEXT, email_verification_sent_at DATETIME, billing_phone TEXT, billing_email TEXT, stripe_customer_id TEXT, auto_pay_enabled INTEGER NOT NULL DEFAULT 0, auto_pay_default_method_id INTEGER REFERENCES client_payment_methods(id));
CREATE UNIQUE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_company ON clients(company_name);
CREATE INDEX idx_clients_health ON clients(health_score);
CREATE INDEX idx_clients_deleted ON clients(deleted_at);
CREATE TABLE IF NOT EXISTS "project_updates" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  update_type TEXT DEFAULT 'general',
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_project_updates_project ON project_updates(project_id);
CREATE INDEX idx_project_updates_author ON project_updates(author_user_id);
CREATE TABLE IF NOT EXISTS "task_comments" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_task_comments_author ON task_comments(author_user_id);
CREATE TABLE IF NOT EXISTS "client_notes" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_client_notes_client ON client_notes(client_id);
CREATE INDEX idx_client_notes_author ON client_notes(author_user_id);
CREATE INDEX idx_client_notes_pinned ON client_notes(is_pinned);
CREATE TABLE IF NOT EXISTS "lead_notes" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lead_notes_project ON lead_notes(project_id);
CREATE INDEX idx_lead_notes_author ON lead_notes(author_user_id);
CREATE INDEX idx_lead_notes_pinned ON lead_notes(is_pinned);
CREATE TABLE IF NOT EXISTS "time_entries" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES project_tasks(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  description TEXT,
  hours DECIMAL(5,2) NOT NULL,
  date DATE NOT NULL,
  billable BOOLEAN DEFAULT TRUE,
  hourly_rate DECIMAL(10,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, deleted_at DATETIME DEFAULT NULL, deleted_by TEXT DEFAULT NULL);
CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_task ON time_entries(task_id);
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_date ON time_entries(date);
CREATE INDEX idx_time_entries_project_date ON time_entries(project_id, date);
CREATE TABLE IF NOT EXISTS "project_tasks" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  sort_order INTEGER DEFAULT 0,
  parent_task_id INTEGER REFERENCES project_tasks(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
, deleted_at DATETIME DEFAULT NULL, deleted_by TEXT DEFAULT NULL);
CREATE INDEX idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_milestone ON project_tasks(milestone_id);
CREATE INDEX idx_project_tasks_status ON project_tasks(status);
CREATE INDEX idx_project_tasks_assigned ON project_tasks(assigned_to_user_id);
CREATE INDEX idx_project_tasks_due ON project_tasks(due_date);
CREATE INDEX idx_project_tasks_parent ON project_tasks(parent_task_id);
CREATE TABLE IF NOT EXISTS "lead_tasks" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'follow_up',
  due_date DATE,
  due_time TIME,
  status TEXT DEFAULT 'pending',
  assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'medium',
  reminder_at DATETIME,
  completed_at DATETIME,
  completed_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lead_tasks_project ON lead_tasks(project_id);
CREATE INDEX idx_lead_tasks_status ON lead_tasks(status);
CREATE INDEX idx_lead_tasks_assigned ON lead_tasks(assigned_to_user_id);
CREATE INDEX idx_lead_tasks_due ON lead_tasks(due_date, status);
CREATE TABLE system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type TEXT DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
  description TEXT,
  is_sensitive BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_system_settings_key ON system_settings(setting_key);
CREATE TABLE invoice_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  -- Tax support (per-line)
  tax_rate DECIMAL(5,2),
  tax_amount DECIMAL(10,2),
  -- Discount support (per-line)
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  -- Ordering
  sort_order INTEGER DEFAULT 0,
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Foreign key
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_order ON invoice_line_items(invoice_id, sort_order);
CREATE INDEX idx_contracts_signature_token
ON contracts(signature_token) WHERE signature_token IS NOT NULL;
CREATE INDEX idx_contract_signature_log_contract
ON contract_signature_log(contract_id);
CREATE INDEX idx_clients_last_login ON clients(last_login);
CREATE INDEX idx_files_shared_with_client
  ON files(shared_with_client) WHERE shared_with_client = TRUE;
CREATE INDEX idx_invoice_reminders_status_date
  ON invoice_reminders(status, scheduled_date);
CREATE INDEX idx_recurring_invoices_active_next
  ON recurring_invoices(is_active, next_generation_date);
CREATE INDEX idx_document_requests_approved_file ON document_requests(approved_file_id);
CREATE TABLE deliverables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'design',
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  round_number INTEGER NOT NULL DEFAULT 1,
  created_by_id INTEGER NOT NULL,
  reviewed_by_id INTEGER,
  review_deadline DATETIME,
  approved_at DATETIME,
  locked INTEGER NOT NULL DEFAULT 0,
  tags TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, archived_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL, deleted_at DATETIME, deleted_by TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE deliverable_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deliverable_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by_id INTEGER NOT NULL,
  change_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE,
  UNIQUE(deliverable_id, version_number)
);
CREATE TABLE deliverable_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deliverable_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  comment_text TEXT NOT NULL,
  x_position INTEGER,
  y_position INTEGER,
  annotation_type TEXT DEFAULT 'text',
  element_id TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE
);
CREATE TABLE design_elements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deliverable_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  revision_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE,
  UNIQUE(deliverable_id, name)
);
CREATE TABLE deliverable_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deliverable_id INTEGER NOT NULL,
  reviewer_id INTEGER NOT NULL,
  decision TEXT NOT NULL,
  feedback TEXT,
  design_elements_reviewed TEXT DEFAULT '[]',
  review_duration_minutes INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE
);
CREATE INDEX idx_deliverables_project_id ON deliverables(project_id);
CREATE INDEX idx_deliverables_status ON deliverables(status);
CREATE INDEX idx_deliverables_approval_status ON deliverables(approval_status);
CREATE INDEX idx_deliverable_versions_deliverable_id ON deliverable_versions(deliverable_id);
CREATE INDEX idx_deliverable_comments_deliverable_id ON deliverable_comments(deliverable_id);
CREATE INDEX idx_design_elements_deliverable_id ON design_elements(deliverable_id);
CREATE INDEX idx_deliverable_reviews_deliverable_id ON deliverable_reviews(deliverable_id);
CREATE INDEX idx_deliverables_archived_file ON deliverables(archived_file_id);
CREATE INDEX idx_scheduled_invoices_status_trigger_date 
ON scheduled_invoices(status, trigger_type, scheduled_date);
CREATE INDEX idx_invoice_reminders_invoice_id 
ON invoice_reminders(invoice_id);
CREATE INDEX idx_questionnaire_responses_exported_file ON questionnaire_responses(exported_file_id);
CREATE TABLE receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_number TEXT NOT NULL UNIQUE,
  invoice_id INTEGER NOT NULL,
  payment_id INTEGER,
  amount REAL NOT NULL,
  file_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES invoice_payments(id) ON DELETE SET NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);
CREATE INDEX idx_receipts_invoice ON receipts(invoice_id);
CREATE INDEX idx_receipts_payment ON receipts(payment_id);
CREATE INDEX idx_receipts_number ON receipts(receipt_number);
CREATE INDEX idx_receipts_created ON receipts(created_at);
CREATE TABLE IF NOT EXISTS "invoices" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  -- Amounts
  subtotal DECIMAL(10,2),
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_type TEXT,
  discount_value DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  amount_total DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  -- Status and dates
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled')),
  due_date DATE,
  issued_date DATE,
  paid_date DATE,
  -- Payment info
  payment_method TEXT,
  payment_reference TEXT,
  payment_terms_id INTEGER REFERENCES payment_terms_presets(id),
  -- Late fees
  late_fee_rate DECIMAL(5,2) DEFAULT 0,
  late_fee_type TEXT DEFAULT 'none',
  late_fee_amount DECIMAL(10,2) DEFAULT 0,
  late_fee_applied_at DATETIME,
  -- Notes
  notes TEXT,
  terms TEXT,
  internal_notes TEXT,
  -- Invoice numbering
  invoice_prefix TEXT,
  invoice_sequence INTEGER,
  -- Invoice type (standard/deposit)
  invoice_type TEXT DEFAULT 'standard' CHECK (invoice_type IN ('standard', 'deposit')),
  deposit_for_project_id INTEGER,
  deposit_percentage DECIMAL(5,2),
  -- Links
  milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
  payment_plan_id INTEGER REFERENCES payment_plan_templates(id) ON DELETE SET NULL,
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, deleted_at DATETIME, deleted_by TEXT, version INTEGER NOT NULL DEFAULT 1,
  -- Foreign keys
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_project ON invoices(project_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_type ON invoices(invoice_type);
CREATE INDEX idx_invoices_deposit_project ON invoices(deposit_for_project_id);
CREATE INDEX idx_invoices_late_fee ON invoices(late_fee_applied_at);
CREATE INDEX idx_invoices_payment_terms ON invoices(payment_terms_id);
CREATE INDEX idx_invoices_milestone ON invoices(milestone_id);
CREATE TABLE IF NOT EXISTS "messages" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Context differentiation
  context_type TEXT NOT NULL DEFAULT 'project' CHECK (context_type IN ('project', 'general')),
  -- Foreign keys
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  thread_id INTEGER REFERENCES message_threads(id) ON DELETE CASCADE,
  -- Sender info (normalize to 'admin' instead of 'developer')
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'admin', 'system')),
  sender_name TEXT,
  -- Content
  subject TEXT,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'file', 'update', 'inquiry', 'quote_request', 'support', 'feedback')),
  -- Priority and status
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'closed')),
  -- Threading
  reply_to INTEGER,
  parent_message_id INTEGER,
  -- Attachments
  attachments TEXT,
  -- Internal messages (admin-only visibility)
  is_internal BOOLEAN DEFAULT FALSE,
  -- Timestamps
  read_at DATETIME,
  edited_at DATETIME,
  deleted_at DATETIME,
  deleted_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Denormalized counts for performance
  reaction_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  mention_count INTEGER DEFAULT 0
);
CREATE INDEX idx_messages_context ON messages(context_type);
CREATE INDEX idx_messages_client ON messages(client_id);
CREATE INDEX idx_messages_sender_type ON messages(sender_type);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_messages_deleted ON messages(deleted_at);
CREATE INDEX idx_messages_internal ON messages(is_internal);
CREATE INDEX idx_messages_context_project ON messages(context_type, project_id);
CREATE INDEX idx_messages_context_thread ON messages(context_type, thread_id);
CREATE INDEX idx_projects_source_type ON projects(source_type);
CREATE VIEW client_intakes AS
SELECT
  p.id,
  COALESCE(c.company_name, c.contact_name, '') as company_name,
  COALESCE(c.contact_name, '') as contact_name,
  '' as first_name,
  '' as last_name,
  COALESCE(c.email, '') as email,
  COALESCE(c.phone, '') as phone,
  p.project_type,
  p.budget_range,
  p.timeline,
  p.description as project_description,
  p.notes as additional_info,
  CASE
    WHEN p.status = 'pending' THEN 'pending'
    WHEN p.status = 'new' THEN 'pending'
    WHEN p.status IN ('in-progress', 'in-review') THEN 'accepted'
    WHEN p.status = 'completed' THEN 'converted'
    WHEN p.status = 'cancelled' THEN 'rejected'
    ELSE 'pending'
  END as status,
  NULL as reviewed_by,
  NULL as reviewed_at,
  p.client_id,
  p.id as project_id,
  p.notes,
  p.created_at,
  p.updated_at,
  p.deleted_at,
  p.deleted_by
FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
WHERE p.source_type = 'intake_form'
  OR p.status IN ('pending', 'new')
/* client_intakes(id,company_name,contact_name,first_name,last_name,email,phone,project_type,budget_range,timeline,project_description,additional_info,status,reviewed_by,reviewed_at,client_id,project_id,notes,created_at,updated_at,deleted_at,deleted_by) */;
CREATE INDEX idx_projects_contract_signature_token
ON projects(contract_signature_token) WHERE contract_signature_token IS NOT NULL;
CREATE INDEX idx_ad_hoc_requests_client_status
ON ad_hoc_requests(client_id, status);
CREATE INDEX idx_ad_hoc_requests_project_status
ON ad_hoc_requests(project_id, status);
CREATE INDEX idx_document_requests_client_status
ON document_requests(client_id, status);
CREATE INDEX idx_project_tasks_project_status
ON project_tasks(project_id, status);
CREATE INDEX idx_deliverables_project_status
ON deliverables(project_id, status);
CREATE INDEX idx_deliverables_project_approval
ON deliverables(project_id, approval_status);
CREATE INDEX idx_proposal_requests_client_status
ON proposal_requests(client_id, status);
CREATE INDEX idx_contract_reminders_project_status
ON contract_reminders(project_id, status);
CREATE INDEX idx_milestones_project_status
ON milestones(project_id, status);
CREATE INDEX idx_clients_lockout ON clients(email, locked_until);
CREATE TABLE notification_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL CHECK(user_type IN ('admin', 'client')),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data TEXT, -- JSON data for additional notification metadata
  is_read INTEGER DEFAULT 0,
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notification_history_user
  ON notification_history(user_id, user_type);
CREATE INDEX idx_notification_history_unread
  ON notification_history(user_id, user_type, is_read);
CREATE INDEX idx_notification_history_created
  ON notification_history(created_at DESC);
CREATE INDEX idx_message_threads_deleted_at ON message_threads(deleted_at);
CREATE INDEX idx_document_requests_deleted_at ON document_requests(deleted_at);
CREATE INDEX idx_contracts_deleted_at ON contracts(deleted_at);
CREATE INDEX idx_deliverables_deleted_at ON deliverables(deleted_at);
CREATE VIEW active_clients AS SELECT * FROM clients WHERE deleted_at IS NULL
/* active_clients(id,email,password_hash,company_name,contact_name,phone,status,created_at,updated_at,reset_token,reset_token_expiry,billing_company,billing_address,billing_address2,billing_city,billing_state,billing_zip,billing_country,is_admin,invitation_token,invitation_expires_at,invitation_sent_at,last_login_at,magic_link_token,magic_link_expires_at,client_type,health_score,health_status,lifetime_value,acquisition_source,industry,company_size,website,last_contact_date,next_follow_up_date,notes,preferred_contact_method,welcome_sequence_started_at,welcome_sequence_completed,deleted_at,deleted_by,last_login,billing_name,failed_login_attempts,locked_until,email_verified,email_verification_token,email_verification_sent_at,billing_phone,billing_email,stripe_customer_id,auto_pay_enabled,auto_pay_default_method_id) */;
CREATE VIEW active_projects AS SELECT * FROM projects WHERE deleted_at IS NULL
/* active_projects(id,client_id,project_name,description,status,priority,progress,start_date,estimated_end_date,actual_end_date,budget_range,project_type,created_at,updated_at,timeline,preview_url,price,notes,repository_url,staging_url,production_url,deposit_amount,contract_signed_at,cancelled_by,cancellation_reason,hourly_rate,estimated_hours,actual_hours,template_id,archived_at,project_health,health_notes,deleted_at,deleted_by,expected_value,contract_countersigned_at,contract_countersigner_name,contract_countersigner_email,contract_countersigner_ip,contract_countersigner_user_agent,contract_countersignature_data,contract_signed_pdf_path,lead_score,lead_score_breakdown,pipeline_stage_id,lead_source_id,assigned_to,expected_close_date,lost_reason,lost_at,won_at,competitor,last_activity_at,next_follow_up_at,source_type,intake_id,contract_signature_token,contract_signature_requested_at,contract_signature_expires_at,contract_signer_name,contract_signer_email,contract_signer_ip,contract_signer_user_agent,contract_signature_data,contract_reminders_enabled,version,features,design_level,content_status,tech_comfort,hosting_preference,page_count,integrations,brand_assets,inspiration,current_site,challenges,additional_info,addons,referral_source,default_deposit_percentage,project_code,maintenance_tier,maintenance_status,maintenance_start_date,maintenance_recurring_invoice_id,maintenance_included_months,maintenance_included_until,netlify_url,netlify_email,netlify_password,umami_url,umami_email,umami_password) */;
CREATE VIEW active_invoices AS SELECT * FROM invoices WHERE deleted_at IS NULL
/* active_invoices(id,invoice_number,project_id,client_id,subtotal,tax_rate,tax_amount,discount_type,discount_value,discount_amount,amount_total,amount_paid,currency,status,due_date,issued_date,paid_date,payment_method,payment_reference,payment_terms_id,late_fee_rate,late_fee_type,late_fee_amount,late_fee_applied_at,notes,terms,internal_notes,invoice_prefix,invoice_sequence,invoice_type,deposit_for_project_id,deposit_percentage,milestone_id,payment_plan_id,created_at,updated_at,deleted_at,deleted_by,version) */;
CREATE VIEW active_messages AS SELECT * FROM messages WHERE deleted_at IS NULL
/* active_messages(id,context_type,project_id,client_id,thread_id,sender_type,sender_name,subject,message,message_type,priority,status,reply_to,parent_message_id,attachments,is_internal,read_at,edited_at,deleted_at,deleted_by,created_at,updated_at,reaction_count,reply_count,mention_count) */;
CREATE VIEW active_message_threads AS SELECT * FROM message_threads WHERE deleted_at IS NULL
/* active_message_threads(id,project_id,client_id,subject,thread_type,status,priority,last_message_at,last_message_by,participant_count,created_at,updated_at,pinned_count,archived_at,archived_by,deleted_at,deleted_by) */;
CREATE VIEW active_document_requests AS SELECT * FROM document_requests WHERE deleted_at IS NULL
/* active_document_requests(id,client_id,project_id,requested_by,title,description,document_type,priority,status,due_date,file_id,uploaded_by,uploaded_at,reviewed_by,reviewed_at,review_notes,rejection_reason,is_required,reminder_sent_at,reminder_count,created_at,updated_at,requested_by_user_id,uploaded_by_user_id,reviewed_by_user_id,approved_file_id,deleted_at,deleted_by) */;
CREATE VIEW active_contracts AS SELECT * FROM contracts WHERE deleted_at IS NULL
/* active_contracts(id,template_id,project_id,client_id,content,status,variables,sent_at,signed_at,expires_at,created_at,updated_at,signer_name,signer_email,signer_ip,signer_user_agent,signature_data,countersigned_at,countersigner_name,countersigner_email,countersigner_ip,countersigner_user_agent,countersignature_data,signed_pdf_path,parent_contract_id,renewal_at,renewal_reminder_sent_at,last_reminder_at,reminder_count,signature_token,signature_requested_at,signature_expires_at,deleted_at,deleted_by,version) */;
CREATE VIEW active_deliverables AS SELECT * FROM deliverables WHERE deleted_at IS NULL
/* active_deliverables(id,project_id,type,title,description,status,approval_status,round_number,created_by_id,reviewed_by_id,review_deadline,approved_at,locked,tags,created_at,updated_at,archived_file_id,deleted_at,deleted_by) */;
CREATE VIEW active_ad_hoc_requests AS SELECT * FROM ad_hoc_requests WHERE deleted_at IS NULL
/* active_ad_hoc_requests(id,project_id,client_id,title,description,status,request_type,priority,urgency,estimated_hours,flat_rate,hourly_rate,quoted_price,created_at,updated_at,deleted_at,deleted_by,attachment_file_id,task_id,converted_at,converted_by,converted_by_user_id) */;
CREATE INDEX idx_invoices_deleted_at ON invoices(deleted_at);
CREATE INDEX idx_clients_email_verification_token ON clients(email_verification_token);
CREATE INDEX idx_scheduled_invoices_project
  ON scheduled_invoices(project_id);
CREATE INDEX idx_scheduled_invoices_client
  ON scheduled_invoices(client_id);
CREATE INDEX idx_recurring_invoices_project
  ON recurring_invoices(project_id);
CREATE INDEX idx_recurring_invoices_client
  ON recurring_invoices(client_id);
CREATE INDEX idx_contracts_template
  ON contracts(template_id);
CREATE INDEX idx_receipts_file
  ON receipts(file_id);
CREATE INDEX idx_client_onboarding_project
  ON client_onboarding(project_id);
CREATE INDEX idx_approval_instances_definition
  ON approval_workflow_instances(workflow_definition_id);
CREATE INDEX idx_approval_requests_step
  ON approval_requests(step_id);
CREATE INDEX idx_approval_history_step
  ON approval_history(step_id);
CREATE INDEX idx_document_requests_file
  ON document_requests(file_id);
CREATE INDEX idx_invoices_payment_plan
  ON invoices(payment_plan_id);
CREATE INDEX idx_notification_log_created
  ON notification_log(created_at);
CREATE INDEX idx_notification_digest_queue_created
  ON notification_digest_queue(created_at);
CREATE INDEX idx_workflow_trigger_logs_result
  ON workflow_trigger_logs(action_result);
CREATE INDEX idx_notification_history_type
  ON notification_history(type);
CREATE INDEX idx_client_contacts_client_primary
  ON client_contacts(client_id, is_primary);
CREATE INDEX idx_project_tasks_project_due
  ON project_tasks(project_id, due_date);
CREATE INDEX idx_lead_tasks_project_status
  ON lead_tasks(project_id, status);
CREATE INDEX idx_dup_resolution_primary
  ON duplicate_resolution_log(primary_record_id, primary_record_type);
CREATE INDEX idx_dup_resolution_merged
  ON duplicate_resolution_log(merged_record_id, merged_record_type);
CREATE INDEX idx_questionnaire_responses_client_status
  ON questionnaire_responses(client_id, status);
CREATE INDEX idx_client_notes_created
  ON client_notes(created_at);
CREATE INDEX idx_lead_notes_created
  ON lead_notes(created_at);
CREATE INDEX idx_deliverables_created
  ON deliverables(created_at);
CREATE INDEX idx_contracts_created
  ON contracts(created_at);
CREATE INDEX idx_ad_hoc_requests_client_created
  ON ad_hoc_requests(client_id, created_at);
CREATE INDEX idx_invoices_status_due
  ON invoices(status, due_date);
CREATE INDEX idx_projects_created
  ON projects(created_at);
CREATE INDEX idx_clients_created
  ON clients(created_at);
CREATE INDEX idx_project_tasks_deleted ON project_tasks(deleted_at);
CREATE INDEX idx_milestones_deleted ON milestones(deleted_at);
CREATE INDEX idx_files_deleted ON files(deleted_at);
CREATE INDEX idx_time_entries_deleted ON time_entries(deleted_at);
CREATE INDEX idx_client_contacts_deleted ON client_contacts(deleted_at);
CREATE TABLE webhook_processed_events (
    event_id TEXT PRIMARY KEY NOT NULL,
    source TEXT NOT NULL DEFAULT 'stripe',
    processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_webhook_processed_events_processed_at
    ON webhook_processed_events(processed_at);
CREATE TABLE IF NOT EXISTS "message_mentions" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  mentioned_type TEXT NOT NULL,
  mentioned_id TEXT,
  notified BOOLEAN DEFAULT FALSE,
  notified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
CREATE INDEX idx_message_mentions_message ON message_mentions(message_id);
CREATE INDEX idx_message_mentions_user ON message_mentions(mentioned_id);
CREATE INDEX idx_message_mentions_type ON message_mentions(mentioned_type);
CREATE TABLE IF NOT EXISTS "message_reactions" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,
  reaction TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_email, reaction)
);
CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user ON message_reactions(user_email);
CREATE TABLE IF NOT EXISTS "message_read_receipts" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_email)
);
CREATE INDEX idx_message_read_receipts_message ON message_read_receipts(message_id);
CREATE INDEX idx_message_read_receipts_user ON message_read_receipts(user_email);
CREATE TABLE IF NOT EXISTS "pinned_messages" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  pinned_by TEXT NOT NULL,
  pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  UNIQUE(thread_id, message_id)
);
CREATE INDEX idx_pinned_messages_thread ON pinned_messages(thread_id);
CREATE INDEX idx_pinned_messages_message ON pinned_messages(message_id);
CREATE TABLE payment_schedule_installments (
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
CREATE INDEX idx_payment_installments_project ON payment_schedule_installments(project_id);
CREATE INDEX idx_payment_installments_client ON payment_schedule_installments(client_id);
CREATE INDEX idx_payment_installments_status ON payment_schedule_installments(status);
CREATE INDEX idx_payment_installments_due_date ON payment_schedule_installments(due_date);
CREATE TABLE content_request_checklists (
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
CREATE TABLE content_request_items (
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
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, priority TEXT DEFAULT 'normal',
  FOREIGN KEY (checklist_id) REFERENCES content_request_checklists(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);
CREATE TABLE content_request_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  items JSON NOT NULL,
  project_type TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_content_checklists_project ON content_request_checklists(project_id);
CREATE INDEX idx_content_checklists_client ON content_request_checklists(client_id);
CREATE INDEX idx_content_checklists_status ON content_request_checklists(status);
CREATE INDEX idx_content_items_checklist ON content_request_items(checklist_id);
CREATE INDEX idx_content_items_status ON content_request_items(status);
CREATE INDEX idx_content_items_type ON content_request_items(content_type);
CREATE TABLE content_request_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  actor_email TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'admin',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES content_request_items(id) ON DELETE CASCADE
);
CREATE INDEX idx_content_history_item ON content_request_history(item_id);
CREATE INDEX idx_content_history_action ON content_request_history(action);
CREATE TABLE proposal_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT,
  tier_structure JSON,
  default_line_items JSON,
  terms_and_conditions TEXT,
  validity_days INTEGER DEFAULT 30,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE proposal_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  tier_data JSON,
  features_data JSON,
  pricing_data JSON,
  notes TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id) ON DELETE CASCADE,
  UNIQUE(proposal_id, version_number)
);
CREATE TABLE proposal_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_title TEXT,
  signer_company TEXT,
  signature_method TEXT,
  signature_data TEXT,
  ip_address TEXT,
  user_agent TEXT,
  signed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id) ON DELETE CASCADE
);
CREATE TABLE proposal_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  author_type TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  parent_comment_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_comment_id) REFERENCES proposal_comments(id) ON DELETE CASCADE
);
CREATE TABLE proposal_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL,
  actor TEXT,
  actor_type TEXT,
  metadata JSON,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id) ON DELETE CASCADE
);
CREATE TABLE proposal_custom_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  item_type TEXT DEFAULT 'service',
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  unit_label TEXT,
  category TEXT,
  is_taxable BOOLEAN DEFAULT TRUE,
  is_optional BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id) ON DELETE CASCADE
);
CREATE TABLE signature_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  signer_email TEXT NOT NULL,
  signer_name TEXT,
  request_token TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  sent_at DATETIME,
  viewed_at DATETIME,
  signed_at DATETIME,
  declined_at DATETIME,
  decline_reason TEXT,
  expires_at DATETIME,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id) ON DELETE CASCADE
);
CREATE INDEX idx_proposal_templates_type ON proposal_templates(project_type);
CREATE INDEX idx_proposal_templates_active ON proposal_templates(is_active);
CREATE INDEX idx_proposal_versions_proposal ON proposal_versions(proposal_id);
CREATE INDEX idx_proposal_versions_number ON proposal_versions(proposal_id, version_number);
CREATE INDEX idx_proposal_signatures_proposal ON proposal_signatures(proposal_id);
CREATE INDEX idx_proposal_signatures_email ON proposal_signatures(signer_email);
CREATE INDEX idx_proposal_comments_proposal ON proposal_comments(proposal_id);
CREATE INDEX idx_proposal_comments_parent ON proposal_comments(parent_comment_id);
CREATE INDEX idx_proposal_comments_internal ON proposal_comments(is_internal);
CREATE INDEX idx_proposal_activities_proposal ON proposal_activities(proposal_id);
CREATE INDEX idx_proposal_activities_type ON proposal_activities(activity_type);
CREATE INDEX idx_proposal_activities_created ON proposal_activities(created_at);
CREATE INDEX idx_proposal_custom_items_proposal ON proposal_custom_items(proposal_id);
CREATE INDEX idx_signature_requests_proposal ON signature_requests(proposal_id);
CREATE INDEX idx_signature_requests_token ON signature_requests(request_token);
CREATE INDEX idx_signature_requests_status ON signature_requests(status);
CREATE INDEX idx_signature_requests_email ON signature_requests(signer_email);
CREATE INDEX idx_projects_deleted_at
  ON projects(deleted_at);
CREATE INDEX idx_messages_created_at
  ON messages(created_at);
CREATE UNIQUE INDEX idx_projects_project_code ON projects(project_code);
CREATE INDEX idx_projects_maintenance
  ON projects(maintenance_status, maintenance_tier);
CREATE TABLE client_payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  stripe_payment_method_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'card',
  brand TEXT,
  last_four TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX idx_client_payment_methods_client ON client_payment_methods(client_id);
CREATE TABLE stripe_payment_intents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_intent_id TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL,
  invoice_id INTEGER,
  installment_id INTEGER,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'requires_payment_method',
  payment_method_id INTEGER,
  failure_reason TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (payment_method_id) REFERENCES client_payment_methods(id) ON DELETE SET NULL
);
CREATE INDEX idx_stripe_payment_intents_client ON stripe_payment_intents(client_id);
CREATE INDEX idx_stripe_payment_intents_invoice ON stripe_payment_intents(invoice_id);
CREATE INDEX idx_stripe_payment_intents_stripe_id ON stripe_payment_intents(stripe_intent_id);
CREATE INDEX idx_stripe_payment_intents_status ON stripe_payment_intents(status);
CREATE TABLE project_agreements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT 'Project Agreement',
  status TEXT NOT NULL DEFAULT 'draft',
  proposal_id INTEGER,
  contract_id INTEGER,
  questionnaire_id INTEGER,
  steps_config TEXT,
  welcome_message TEXT,
  current_step INTEGER DEFAULT 0,
  sent_at TEXT,
  viewed_at TEXT,
  completed_at TEXT,
  expires_at TEXT,
  reminder_sent_3d INTEGER NOT NULL DEFAULT 0,
  reminder_sent_7d INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id) ON DELETE SET NULL,
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL
);
CREATE INDEX idx_project_agreements_project ON project_agreements(project_id);
CREATE INDEX idx_project_agreements_client ON project_agreements(client_id);
CREATE INDEX idx_project_agreements_status ON project_agreements(status);
CREATE TABLE agreement_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agreement_id INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  entity_id INTEGER,
  custom_title TEXT,
  custom_content TEXT,
  started_at TEXT,
  completed_at TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agreement_id) REFERENCES project_agreements(id) ON DELETE CASCADE
);
CREATE INDEX idx_agreement_steps_agreement ON agreement_steps(agreement_id);
CREATE INDEX idx_agreement_steps_type ON agreement_steps(step_type);
CREATE INDEX idx_agreement_steps_status ON agreement_steps(status);
CREATE TABLE onboarding_checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  welcome_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  dismissed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX idx_onboarding_checklists_project ON onboarding_checklists(project_id);
CREATE INDEX idx_onboarding_checklists_client ON onboarding_checklists(client_id);
CREATE INDEX idx_onboarding_checklists_status ON onboarding_checklists(status);
CREATE TABLE onboarding_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  step_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  entity_type TEXT,
  entity_id INTEGER,
  auto_detect INTEGER NOT NULL DEFAULT 0,
  navigate_tab TEXT,
  navigate_entity_id INTEGER,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (checklist_id) REFERENCES onboarding_checklists(id) ON DELETE CASCADE
);
CREATE INDEX idx_onboarding_steps_checklist ON onboarding_steps(checklist_id);
CREATE INDEX idx_onboarding_steps_status ON onboarding_steps(status);
CREATE INDEX idx_onboarding_steps_entity ON onboarding_steps(entity_type, entity_id);
CREATE TABLE onboarding_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  project_type TEXT,
  steps_config TEXT NOT NULL DEFAULT '[]',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE email_sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  trigger_conditions TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE sequence_steps (
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
CREATE TABLE sequence_enrollments (
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
CREATE TABLE sequence_send_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL,
  step_id INTEGER NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  email_status TEXT NOT NULL DEFAULT 'sent' CHECK (email_status IN ('sent', 'failed', 'bounced', 'opened', 'clicked')),
  error_message TEXT,
  FOREIGN KEY (enrollment_id) REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES sequence_steps(id) ON DELETE CASCADE
);
CREATE INDEX idx_sequence_steps_sequence_order ON sequence_steps(sequence_id, step_order);
CREATE INDEX idx_sequence_enrollments_status_next_send ON sequence_enrollments(status, next_send_at);
CREATE INDEX idx_sequence_enrollments_entity ON sequence_enrollments(entity_type, entity_id);
CREATE INDEX idx_sequence_enrollments_sequence ON sequence_enrollments(sequence_id);
CREATE INDEX idx_sequence_send_logs_enrollment ON sequence_send_logs(enrollment_id);
CREATE TABLE meeting_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  project_id INTEGER,
  meeting_type TEXT NOT NULL DEFAULT 'consultation'
    CHECK (meeting_type IN ('discovery_call', 'consultation', 'project_kickoff', 'check_in', 'review', 'other')),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'confirmed', 'declined', 'rescheduled', 'completed', 'cancelled')),
  preferred_slot_1 TEXT,
  preferred_slot_2 TEXT,
  preferred_slot_3 TEXT,
  confirmed_datetime TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  location_type TEXT DEFAULT 'zoom'
    CHECK (location_type IN ('zoom', 'google_meet', 'phone', 'in_person', 'other')),
  location_details TEXT,
  client_notes TEXT,
  admin_notes TEXT,
  decline_reason TEXT,
  calendar_event_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  confirmed_at TEXT,
  completed_at TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);
CREATE INDEX idx_meeting_requests_client ON meeting_requests(client_id);
CREATE INDEX idx_meeting_requests_status ON meeting_requests(status);
CREATE INDEX idx_meeting_requests_confirmed_datetime ON meeting_requests(confirmed_datetime);
CREATE TABLE custom_automations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  trigger_event TEXT NOT NULL,
  trigger_conditions TEXT DEFAULT '{}',
  stop_on_error INTEGER NOT NULL DEFAULT 0,
  max_runs_per_entity INTEGER DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_custom_automations_event ON custom_automations(trigger_event, is_active);
CREATE TABLE automation_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id INTEGER NOT NULL,
  action_order INTEGER NOT NULL,
  action_type TEXT NOT NULL CHECK(action_type IN (
    'send_email', 'create_task', 'update_status', 'send_notification',
    'wait', 'enroll_sequence', 'create_invoice', 'assign_questionnaire',
    'webhook', 'add_tag', 'add_note'
  )),
  action_config TEXT NOT NULL DEFAULT '{}',
  condition TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (automation_id) REFERENCES custom_automations(id) ON DELETE CASCADE
);
CREATE INDEX idx_automation_actions_automation ON automation_actions(automation_id, action_order);
CREATE TABLE automation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id INTEGER NOT NULL,
  trigger_event TEXT NOT NULL,
  trigger_entity_type TEXT,
  trigger_entity_id INTEGER,
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed', 'waiting')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  error_message TEXT,
  FOREIGN KEY (automation_id) REFERENCES custom_automations(id)
);
CREATE INDEX idx_automation_runs_automation ON automation_runs(automation_id);
CREATE INDEX idx_automation_runs_status ON automation_runs(status);
CREATE TABLE automation_action_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  action_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'executed', 'failed', 'skipped', 'waiting')),
  executed_at TEXT,
  result TEXT,
  error_message TEXT,
  FOREIGN KEY (run_id) REFERENCES automation_runs(id),
  FOREIGN KEY (action_id) REFERENCES automation_actions(id)
);
CREATE TABLE automation_scheduled_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  action_id INTEGER NOT NULL,
  execute_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'executed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES automation_runs(id),
  FOREIGN KEY (action_id) REFERENCES automation_actions(id)
);
CREATE INDEX idx_scheduled_actions_execute ON automation_scheduled_actions(status, execute_at);
CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  category TEXT NOT NULL DEFAULT 'other' CHECK(category IN (
    'software', 'hosting', 'domain', 'stock_assets', 'subcontractor',
    'hardware', 'travel', 'marketing', 'office', 'professional_services',
    'subscription', 'other'
  )),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  vendor_name TEXT,
  expense_date TEXT NOT NULL,
  is_billable INTEGER NOT NULL DEFAULT 0,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurring_interval TEXT CHECK(recurring_interval IN ('weekly', 'monthly', 'quarterly', 'annual')),
  receipt_file_id INTEGER,
  tax_deductible INTEGER NOT NULL DEFAULT 1,
  tax_category TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (receipt_file_id) REFERENCES files(id)
);
CREATE INDEX idx_expenses_project_id ON expenses(project_id);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_deleted_at ON expenses(deleted_at);
CREATE TABLE retainers (
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
CREATE TABLE retainer_periods (
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
CREATE INDEX idx_retainers_client_status ON retainers(client_id, status);
CREATE INDEX idx_retainer_periods_retainer_status ON retainer_periods(retainer_id, status);
CREATE TABLE feedback_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  client_id INTEGER NOT NULL,
  survey_type TEXT NOT NULL DEFAULT 'project_completion' CHECK(survey_type IN ('project_completion', 'milestone_check_in', 'nps_quarterly')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'completed', 'expired')),
  token TEXT NOT NULL UNIQUE,
  sent_at TEXT,
  completed_at TEXT,
  expires_at TEXT,
  reminder_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
CREATE TABLE feedback_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL UNIQUE,
  overall_rating INTEGER CHECK(overall_rating BETWEEN 1 AND 5),
  nps_score INTEGER CHECK(nps_score BETWEEN 0 AND 10),
  communication_rating INTEGER CHECK(communication_rating BETWEEN 1 AND 5),
  quality_rating INTEGER CHECK(quality_rating BETWEEN 1 AND 5),
  timeliness_rating INTEGER CHECK(timeliness_rating BETWEEN 1 AND 5),
  highlights TEXT,
  improvements TEXT,
  testimonial_text TEXT,
  testimonial_approved INTEGER NOT NULL DEFAULT 0,
  allow_name_use INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (survey_id) REFERENCES feedback_surveys(id)
);
CREATE TABLE testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_response_id INTEGER,
  client_id INTEGER NOT NULL,
  project_id INTEGER,
  text TEXT NOT NULL,
  client_name TEXT NOT NULL,
  company_name TEXT,
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review', 'approved', 'published', 'rejected')),
  featured INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (feedback_response_id) REFERENCES feedback_responses(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE INDEX idx_feedback_surveys_client ON feedback_surveys(client_id);
CREATE INDEX idx_feedback_surveys_token ON feedback_surveys(token);
CREATE INDEX idx_feedback_surveys_status ON feedback_surveys(status);
CREATE INDEX idx_testimonials_status ON testimonials(status);
CREATE INDEX idx_testimonials_featured ON testimonials(featured, status);
CREATE TABLE embed_configurations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  widget_type TEXT NOT NULL CHECK(widget_type IN ('contact_form', 'testimonials', 'status_badge')),
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  config TEXT NOT NULL DEFAULT '{}',
  allowed_domains TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE project_status_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE INDEX idx_embed_configurations_token ON embed_configurations(token);
CREATE INDEX idx_embed_configurations_type ON embed_configurations(widget_type, is_active);
CREATE INDEX idx_project_status_tokens_token ON project_status_tokens(token);
CREATE TABLE ai_usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_type TEXT NOT NULL CHECK(request_type IN ('draft_proposal', 'draft_email', 'search')),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_cents REAL NOT NULL,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  entity_type TEXT,
  entity_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ai_response_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  context_hash TEXT NOT NULL UNIQUE,
  request_type TEXT NOT NULL,
  response_json TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_ai_usage_date ON ai_usage_log(created_at);
CREATE INDEX idx_ai_usage_type ON ai_usage_log(request_type);
CREATE INDEX idx_ai_cache_hash ON ai_response_cache(context_hash);
CREATE INDEX idx_ai_cache_expires ON ai_response_cache(expires_at);
CREATE TABLE auto_pay_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  payment_method_id INTEGER NOT NULL REFERENCES client_payment_methods(id),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'exhausted')),
  stripe_intent_id TEXT,
  failure_reason TEXT,
  next_retry_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_auto_pay_attempts_client ON auto_pay_attempts(client_id);
CREATE INDEX idx_auto_pay_attempts_invoice ON auto_pay_attempts(invoice_id);
CREATE INDEX idx_auto_pay_attempts_status ON auto_pay_attempts(status);
CREATE INDEX idx_auto_pay_attempts_next_retry ON auto_pay_attempts(next_retry_at);
CREATE TABLE async_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
, dedupe_key TEXT);
CREATE INDEX idx_async_tasks_ready
  ON async_tasks(status, next_attempt_at);
CREATE INDEX idx_async_tasks_type
  ON async_tasks(task_type, status);
CREATE TABLE email_dedupe (
  dedupe_key TEXT PRIMARY KEY NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_email_dedupe_sent_at
  ON email_dedupe(sent_at);
CREATE UNIQUE INDEX idx_async_tasks_dedupe_active
  ON async_tasks(dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('pending', 'running');
CREATE INDEX idx_audit_logs_hash ON audit_logs(hash);
CREATE TABLE idempotency_keys (
  key            TEXT NOT NULL,
  user_scope     TEXT NOT NULL, -- e.g. 'admin', 'client:42', 'anon'
  method         TEXT NOT NULL,
  path           TEXT NOT NULL,
  request_hash   TEXT NOT NULL, -- SHA-256 of canonical body+query
  response_status INTEGER,
  response_body  TEXT,
  status         TEXT NOT NULL DEFAULT 'in_flight'
                 CHECK (status IN ('in_flight', 'completed')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at   TEXT,
  PRIMARY KEY (key, user_scope, method, path)
);
CREATE INDEX idx_idempotency_keys_created_at
  ON idempotency_keys(created_at);
