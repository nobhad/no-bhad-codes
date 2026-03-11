-- Migration 103: Fix foreign keys on message sub-tables
-- Reason: Migration 085 created message_mentions, message_reactions,
--         message_read_receipts, and pinned_messages with FKs referencing
--         "_general_messages_deprecated_085" (the old general_messages table).
--         Migration 093 dropped that deprecated table, leaving dangling FKs.
--         PRAGMA foreign_keys = ON causes all INSERTs to these tables to fail
--         with "no such table: main._general_messages_deprecated_085".
--         This migration rebuilds those tables with FK → messages.

PRAGMA foreign_keys = OFF;

-- --------------------------------------------------------
-- message_mentions
-- --------------------------------------------------------
CREATE TABLE message_mentions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  mentioned_type TEXT NOT NULL,
  mentioned_id TEXT,
  notified BOOLEAN DEFAULT FALSE,
  notified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
INSERT INTO message_mentions_new SELECT * FROM message_mentions;
DROP TABLE message_mentions;
ALTER TABLE message_mentions_new RENAME TO message_mentions;
CREATE INDEX IF NOT EXISTS idx_message_mentions_message ON message_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_user ON message_mentions(mentioned_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_type ON message_mentions(mentioned_type);

-- --------------------------------------------------------
-- message_reactions
-- --------------------------------------------------------
CREATE TABLE message_reactions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,
  reaction TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_email, reaction)
);
INSERT INTO message_reactions_new SELECT * FROM message_reactions;
DROP TABLE message_reactions;
ALTER TABLE message_reactions_new RENAME TO message_reactions;
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_email);

-- --------------------------------------------------------
-- message_read_receipts
-- --------------------------------------------------------
CREATE TABLE message_read_receipts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_email)
);
INSERT INTO message_read_receipts_new SELECT * FROM message_read_receipts;
DROP TABLE message_read_receipts;
ALTER TABLE message_read_receipts_new RENAME TO message_read_receipts;
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_message ON message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_user ON message_read_receipts(user_email);

-- --------------------------------------------------------
-- pinned_messages
-- --------------------------------------------------------
CREATE TABLE pinned_messages_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  pinned_by TEXT NOT NULL,
  pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  UNIQUE(thread_id, message_id)
);
INSERT INTO pinned_messages_new SELECT * FROM pinned_messages;
DROP TABLE pinned_messages;
ALTER TABLE pinned_messages_new RENAME TO pinned_messages;
CREATE INDEX IF NOT EXISTS idx_pinned_messages_thread ON pinned_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_message ON pinned_messages(message_id);

PRAGMA foreign_keys = ON;
