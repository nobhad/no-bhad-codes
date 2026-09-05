-- Migration 143: audit_logs accepts every action and entity the code records
--
-- Migration 012 gave audit_logs CHECK constraints listing fifteen actions and
-- nine entity types. The application has since grown to log about forty
-- actions (client_invited, account_activated, client_deleted, signed,
-- setting_updated, magic_link_requested, ...) and entity types such as
-- proposal, lead, system_settings and email. Every one of those inserts has
-- been failing the CHECK, and because auditLogger.log throws on failure
-- (compliance-critical by design) the routes awaiting it answered 500 AFTER
-- doing their work: inviting a client, activating an account from the
-- set-password link and deleting a client all returned an internal error to
-- the caller with the change already applied — and none of them left an
-- audit row. Found by exercising the portal end to end on 2026-09-05.
--
-- SQLite cannot drop a CHECK in place, so the table is rebuilt: same columns
-- in the same order (including the 135 hash-chain columns), same indexes,
-- every row copied with its id so the hash chain is untouched. user_type
-- keeps its CHECK — the code only ever writes admin/client/system. The
-- action vocabulary is the application's to manage; the column stays indexed
-- so reporting by action is unchanged. No table references audit_logs, so
-- the rename has nothing to repoint.

-- UP
CREATE TABLE audit_logs_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_email TEXT,
    user_type TEXT CHECK(user_type IN ('admin', 'client', 'system')) DEFAULT 'client',
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    entity_name TEXT,
    old_value TEXT,
    new_value TEXT,
    changes TEXT,
    ip_address TEXT,
    user_agent TEXT,
    request_path TEXT,
    request_method TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    prev_hash TEXT,
    hash TEXT
);

INSERT INTO audit_logs_new (
    id, user_id, user_email, user_type, action, entity_type, entity_id, entity_name,
    old_value, new_value, changes, ip_address, user_agent, request_path, request_method,
    metadata, created_at, prev_hash, hash
)
SELECT
    id, user_id, user_email, user_type, action, entity_type, entity_id, entity_name,
    old_value, new_value, changes, ip_address, user_agent, request_path, request_method,
    metadata, created_at, prev_hash, hash
FROM audit_logs;

DROP TABLE audit_logs;
ALTER TABLE audit_logs_new RENAME TO audit_logs;

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_type ON audit_logs(user_type);
CREATE INDEX idx_audit_logs_user_date ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_entity_date ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_logs_hash ON audit_logs(hash);

-- DOWN
-- Restores the 012 vocabulary. Rows outside it cannot be kept under the old
-- CHECK, so only rows the old constraints accept are copied back.
CREATE TABLE audit_logs_old (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_email TEXT,
    user_type TEXT CHECK(user_type IN ('admin', 'client', 'system')) DEFAULT 'client',
    action TEXT NOT NULL CHECK(action IN (
        'create', 'update', 'delete',
        'login', 'logout', 'login_failed',
        'view', 'export', 'import',
        'upload', 'download',
        'send_message', 'send_email',
        'status_change', 'password_reset'
    )),
    entity_type TEXT NOT NULL CHECK(entity_type IN (
        'client', 'project', 'invoice', 'message', 'file',
        'intake', 'contact_submission', 'session', 'settings'
    )),
    entity_id TEXT,
    entity_name TEXT,
    old_value TEXT,
    new_value TEXT,
    changes TEXT,
    ip_address TEXT,
    user_agent TEXT,
    request_path TEXT,
    request_method TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    prev_hash TEXT,
    hash TEXT
);

INSERT INTO audit_logs_old
SELECT * FROM audit_logs
WHERE action IN ('create', 'update', 'delete', 'login', 'logout', 'login_failed', 'view',
                 'export', 'import', 'upload', 'download', 'send_message', 'send_email',
                 'status_change', 'password_reset')
  AND entity_type IN ('client', 'project', 'invoice', 'message', 'file', 'intake',
                      'contact_submission', 'session', 'settings');

DROP TABLE audit_logs;
ALTER TABLE audit_logs_old RENAME TO audit_logs;

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_type ON audit_logs(user_type);
CREATE INDEX idx_audit_logs_user_date ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_entity_date ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_logs_hash ON audit_logs(hash);
