-- =====================================================
-- DATA QUALITY & CLEANUP INFRASTRUCTURE
-- =====================================================
-- Migration: 066_data_quality.sql
-- Description: Tables for duplicate detection, validation logging,
--              and data quality tracking
-- =====================================================

-- Duplicate Detection Log
-- Records all duplicate detection scans and their results
CREATE TABLE IF NOT EXISTS duplicate_detection_log (
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

-- Duplicate Resolution Log
-- Records how duplicates were resolved (merged, dismissed, etc.)
CREATE TABLE IF NOT EXISTS duplicate_resolution_log (
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
);

-- Validation Error Log
-- Records validation errors for auditing and improvement
CREATE TABLE IF NOT EXISTS validation_error_log (
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

-- Data Quality Metrics
-- Tracks overall data quality scores over time
CREATE TABLE IF NOT EXISTS data_quality_metrics (
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

-- Rate Limiting Table
-- Tracks API requests for rate limiting
CREATE TABLE IF NOT EXISTS rate_limit_log (
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

-- Blocked IPs
-- Persistent IP blocking for repeat offenders
CREATE TABLE IF NOT EXISTS blocked_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    blocked_by TEXT, -- 'system' or admin email
    blocked_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT, -- NULL for permanent
    is_active INTEGER DEFAULT 1
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_duplicate_detection_log_scan_type ON duplicate_detection_log(scan_type);
CREATE INDEX IF NOT EXISTS idx_duplicate_detection_log_created_at ON duplicate_detection_log(created_at);
CREATE INDEX IF NOT EXISTS idx_duplicate_resolution_log_detection_id ON duplicate_resolution_log(detection_log_id);
CREATE INDEX IF NOT EXISTS idx_validation_error_log_entity ON validation_error_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_validation_error_log_error_type ON validation_error_log(error_type);
CREATE INDEX IF NOT EXISTS idx_validation_error_log_created_at ON validation_error_log(created_at);
CREATE INDEX IF NOT EXISTS idx_data_quality_metrics_date ON data_quality_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_ip ON rate_limit_log(ip_address, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_window ON rate_limit_log(window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_active ON blocked_ips(ip_address, is_active);
