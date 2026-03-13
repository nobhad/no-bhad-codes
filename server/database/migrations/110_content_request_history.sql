-- Audit history for content request items
-- Follows the same pattern as document_request_history

CREATE TABLE IF NOT EXISTS content_request_history (
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

CREATE INDEX IF NOT EXISTS idx_content_history_item ON content_request_history(item_id);
CREATE INDEX IF NOT EXISTS idx_content_history_action ON content_request_history(action);

-- DOWN
DROP INDEX IF EXISTS idx_content_history_action;
DROP INDEX IF EXISTS idx_content_history_item;
DROP TABLE IF EXISTS content_request_history;
