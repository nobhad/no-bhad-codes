-- Migration: 014_visitor_tracking
-- Description: Create visitor tracking tables for analytics

-- Visitor sessions table
CREATE TABLE IF NOT EXISTS visitor_sessions (
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

-- Page views table
CREATE TABLE IF NOT EXISTS page_views (
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

-- Interaction events table
CREATE TABLE IF NOT EXISTS interaction_events (
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

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor_id ON visitor_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_start_time ON visitor_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_activity ON visitor_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_timestamp ON page_views(timestamp);
CREATE INDEX IF NOT EXISTS idx_page_views_url ON page_views(url);
CREATE INDEX IF NOT EXISTS idx_interaction_events_session_id ON interaction_events(session_id);
CREATE INDEX IF NOT EXISTS idx_interaction_events_event_type ON interaction_events(event_type);
CREATE INDEX IF NOT EXISTS idx_interaction_events_timestamp ON interaction_events(timestamp);

-- Daily analytics summary table (for fast dashboard queries)
CREATE TABLE IF NOT EXISTS analytics_daily_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    total_sessions INTEGER DEFAULT 0,
    total_page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    total_time_on_site INTEGER DEFAULT 0,
    bounce_count INTEGER DEFAULT 0,
    avg_session_duration INTEGER DEFAULT 0,
    avg_pages_per_session REAL DEFAULT 0,
    top_pages TEXT,
    top_referrers TEXT,
    device_breakdown TEXT,
    browser_breakdown TEXT,
    country_breakdown TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_summary_date ON analytics_daily_summary(date);
