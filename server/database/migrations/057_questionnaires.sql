-- UP
-- Migration: Questionnaires System
-- Tier 3: Admin can create questionnaires and send to clients
-- Created: 2026-02-10

-- =====================================================
-- QUESTIONNAIRES
-- =====================================================
-- Define questionnaire templates with configurable questions
CREATE TABLE IF NOT EXISTS questionnaires (
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
);

-- =====================================================
-- QUESTIONNAIRE RESPONSES
-- =====================================================
-- Track client responses to questionnaires
CREATE TABLE IF NOT EXISTS questionnaire_responses (
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
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_questionnaires_project_type ON questionnaires(project_type);
CREATE INDEX IF NOT EXISTS idx_questionnaires_active ON questionnaires(is_active);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_questionnaire ON questionnaire_responses(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_client ON questionnaire_responses(client_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_project ON questionnaire_responses(project_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_status ON questionnaire_responses(status);

-- =====================================================
-- SEED DEFAULT QUESTIONNAIRES
-- =====================================================
INSERT OR IGNORE INTO questionnaires (name, description, project_type, questions, is_active, auto_send_on_project_create, display_order, created_by) VALUES
(
  'website_discovery',
  'Help us understand your website project goals and requirements',
  'website',
  '[
    {"id": "q1", "type": "text", "question": "What is the primary goal of your website?", "required": true},
    {"id": "q2", "type": "textarea", "question": "Describe your target audience.", "required": true},
    {"id": "q3", "type": "select", "question": "How many pages do you estimate needing?", "options": ["1-5", "6-10", "11-20", "20+"], "required": true},
    {"id": "q4", "type": "multiselect", "question": "Which features are important?", "options": ["Contact Form", "Blog", "E-commerce", "Portfolio Gallery", "User Accounts", "Newsletter Signup"], "required": false},
    {"id": "q5", "type": "textarea", "question": "List 3 websites you like and explain why.", "required": false}
  ]',
  1,
  1,
  1,
  'system'
),
(
  'branding_discovery',
  'Help us understand your brand identity and design preferences',
  'branding',
  '[
    {"id": "q1", "type": "textarea", "question": "Describe your business in 2-3 sentences.", "required": true},
    {"id": "q2", "type": "text", "question": "What are your brand values? (e.g., innovative, trustworthy, fun)", "required": true},
    {"id": "q3", "type": "multiselect", "question": "What emotions should your brand evoke?", "options": ["Professional", "Friendly", "Luxurious", "Playful", "Modern", "Traditional", "Bold", "Subtle"], "required": true},
    {"id": "q4", "type": "textarea", "question": "Who are your main competitors?", "required": false},
    {"id": "q5", "type": "textarea", "question": "Any colors or styles you want to avoid?", "required": false}
  ]',
  1,
  1,
  2,
  'system'
),
(
  'project_kickoff',
  'General project kickoff questions to get us started',
  NULL,
  '[
    {"id": "q1", "type": "text", "question": "What is your preferred timeline for this project?", "required": true},
    {"id": "q2", "type": "select", "question": "How would you rate project urgency?", "options": ["Low - Flexible timeline", "Medium - Prefer on schedule", "High - Time sensitive", "Critical - ASAP"], "required": true},
    {"id": "q3", "type": "textarea", "question": "What does success look like for this project?", "required": true},
    {"id": "q4", "type": "multiselect", "question": "How do you prefer to communicate?", "options": ["Email", "Phone", "Video Call", "Portal Messages", "Slack/Teams"], "required": false},
    {"id": "q5", "type": "textarea", "question": "Any additional notes or concerns?", "required": false}
  ]',
  1,
  0,
  3,
  'system'
);

-- DOWN
DROP INDEX IF EXISTS idx_questionnaire_responses_status;
DROP INDEX IF EXISTS idx_questionnaire_responses_project;
DROP INDEX IF EXISTS idx_questionnaire_responses_client;
DROP INDEX IF EXISTS idx_questionnaire_responses_questionnaire;
DROP INDEX IF EXISTS idx_questionnaires_active;
DROP INDEX IF EXISTS idx_questionnaires_project_type;

DROP TABLE IF EXISTS questionnaire_responses;
DROP TABLE IF EXISTS questionnaires;
