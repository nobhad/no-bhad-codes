-- Migration: 012_audit_logs
-- Description: Create audit_logs table for tracking user actions

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- User who performed the action
    user_id INTEGER,
    user_email TEXT,
    user_type TEXT CHECK(user_type IN ('admin', 'client', 'system')) DEFAULT 'client',

    -- Action details
    action TEXT NOT NULL,

    -- Entity being acted upon
    entity_type TEXT NOT NULL,
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
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_type ON audit_logs(user_type);

-- Composite index for filtering by user and date
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date ON audit_logs(user_id, created_at);

-- Composite index for filtering by entity
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
