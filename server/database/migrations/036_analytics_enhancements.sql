-- UP
-- Migration: Analytics & Reporting Enhancement
-- Phase 7: Saved reports, scheduling, dashboards, KPIs
-- Created: 2026-02-01

-- =====================================================
-- SAVED REPORTS
-- =====================================================
-- Store report configurations for reuse
CREATE TABLE IF NOT EXISTS saved_reports (
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
);

-- =====================================================
-- REPORT SCHEDULES
-- =====================================================
-- Schedule automatic report generation and delivery
CREATE TABLE IF NOT EXISTS report_schedules (
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

-- =====================================================
-- DASHBOARD WIDGETS
-- =====================================================
-- Customizable dashboard widget configurations
CREATE TABLE IF NOT EXISTS dashboard_widgets (
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

-- =====================================================
-- KPI SNAPSHOTS
-- =====================================================
-- Historical tracking of key performance indicators
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date DATE NOT NULL,
  kpi_type TEXT NOT NULL,          -- 'revenue', 'pipeline_value', 'client_count', 'project_count', 'conversion_rate', etc.
  value DECIMAL(15,2),
  previous_value DECIMAL(15,2),
  change_percent DECIMAL(5,2),
  metadata JSON,                   -- Additional context
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- REPORT RUNS
-- =====================================================
-- Track report execution history
CREATE TABLE IF NOT EXISTS report_runs (
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

-- =====================================================
-- DASHBOARD PRESETS
-- =====================================================
-- Pre-configured dashboard layouts
CREATE TABLE IF NOT EXISTS dashboard_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  widgets JSON,                    -- Array of widget configurations
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- METRIC ALERTS
-- =====================================================
-- Threshold-based alerts for KPIs
CREATE TABLE IF NOT EXISTS metric_alerts (
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

-- =====================================================
-- SEED DEFAULT DASHBOARD PRESETS
-- =====================================================
INSERT INTO dashboard_presets (name, description, widgets, is_default) VALUES
('Executive Overview', 'High-level business metrics for executives', '[
  {"type": "metric", "title": "Total Revenue", "data_source": "revenue", "x": 0, "y": 0, "w": 1, "h": 1},
  {"type": "metric", "title": "Active Projects", "data_source": "projects", "x": 1, "y": 0, "w": 1, "h": 1},
  {"type": "metric", "title": "Total Clients", "data_source": "clients", "x": 2, "y": 0, "w": 1, "h": 1},
  {"type": "metric", "title": "Pipeline Value", "data_source": "leads", "x": 3, "y": 0, "w": 1, "h": 1},
  {"type": "chart", "title": "Revenue Trend", "data_source": "revenue", "config": {"chart_type": "line"}, "x": 0, "y": 1, "w": 2, "h": 2},
  {"type": "chart", "title": "Project Status", "data_source": "projects", "config": {"chart_type": "pie"}, "x": 2, "y": 1, "w": 2, "h": 2}
]', TRUE),
('Sales Dashboard', 'Pipeline and lead tracking', '[
  {"type": "metric", "title": "New Leads", "data_source": "leads", "x": 0, "y": 0, "w": 1, "h": 1},
  {"type": "metric", "title": "Qualified Leads", "data_source": "leads", "x": 1, "y": 0, "w": 1, "h": 1},
  {"type": "metric", "title": "Conversion Rate", "data_source": "leads", "x": 2, "y": 0, "w": 1, "h": 1},
  {"type": "metric", "title": "Won This Month", "data_source": "leads", "x": 3, "y": 0, "w": 1, "h": 1},
  {"type": "chart", "title": "Pipeline Funnel", "data_source": "leads", "config": {"chart_type": "bar"}, "x": 0, "y": 1, "w": 2, "h": 2},
  {"type": "list", "title": "Recent Leads", "data_source": "leads", "x": 2, "y": 1, "w": 2, "h": 2}
]', FALSE),
('Project Manager', 'Project and task tracking', '[
  {"type": "metric", "title": "Active Projects", "data_source": "projects", "x": 0, "y": 0, "w": 1, "h": 1},
  {"type": "metric", "title": "Due This Week", "data_source": "tasks", "x": 1, "y": 0, "w": 1, "h": 1},
  {"type": "metric", "title": "Overdue Tasks", "data_source": "tasks", "x": 2, "y": 0, "w": 1, "h": 1},
  {"type": "metric", "title": "Hours This Week", "data_source": "time", "x": 3, "y": 0, "w": 1, "h": 1},
  {"type": "chart", "title": "Project Health", "data_source": "projects", "config": {"chart_type": "bar"}, "x": 0, "y": 1, "w": 2, "h": 2},
  {"type": "list", "title": "Upcoming Milestones", "data_source": "milestones", "x": 2, "y": 1, "w": 2, "h": 2}
]', FALSE);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_saved_reports_type ON saved_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_saved_reports_user ON saved_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_saved_reports_favorite ON saved_reports(is_favorite);

CREATE INDEX IF NOT EXISTS idx_report_schedules_report ON report_schedules(report_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next ON report_schedules(next_send_at);
CREATE INDEX IF NOT EXISTS idx_report_schedules_active ON report_schedules(is_active);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_user ON dashboard_widgets(user_email);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_type ON dashboard_widgets(widget_type);

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_date ON kpi_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_type ON kpi_snapshots(kpi_type);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_date_type ON kpi_snapshots(snapshot_date, kpi_type);

CREATE INDEX IF NOT EXISTS idx_report_runs_report ON report_runs(report_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_schedule ON report_runs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_status ON report_runs(status);

CREATE INDEX IF NOT EXISTS idx_metric_alerts_type ON metric_alerts(kpi_type);
CREATE INDEX IF NOT EXISTS idx_metric_alerts_active ON metric_alerts(is_active);

-- DOWN
-- Rollback: Drop all tables and indexes

DROP INDEX IF EXISTS idx_metric_alerts_active;
DROP INDEX IF EXISTS idx_metric_alerts_type;

DROP INDEX IF EXISTS idx_report_runs_status;
DROP INDEX IF EXISTS idx_report_runs_schedule;
DROP INDEX IF EXISTS idx_report_runs_report;

DROP INDEX IF EXISTS idx_kpi_snapshots_date_type;
DROP INDEX IF EXISTS idx_kpi_snapshots_type;
DROP INDEX IF EXISTS idx_kpi_snapshots_date;

DROP INDEX IF EXISTS idx_dashboard_widgets_type;
DROP INDEX IF EXISTS idx_dashboard_widgets_user;

DROP INDEX IF EXISTS idx_report_schedules_active;
DROP INDEX IF EXISTS idx_report_schedules_next;
DROP INDEX IF EXISTS idx_report_schedules_report;

DROP INDEX IF EXISTS idx_saved_reports_favorite;
DROP INDEX IF EXISTS idx_saved_reports_user;
DROP INDEX IF EXISTS idx_saved_reports_type;

DROP TABLE IF EXISTS metric_alerts;
DROP TABLE IF EXISTS dashboard_presets;
DROP TABLE IF EXISTS report_runs;
DROP TABLE IF EXISTS kpi_snapshots;
DROP TABLE IF EXISTS dashboard_widgets;
DROP TABLE IF EXISTS report_schedules;
DROP TABLE IF EXISTS saved_reports;
