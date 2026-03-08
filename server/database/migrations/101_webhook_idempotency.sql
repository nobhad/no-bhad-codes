-- Migration 101: Webhook event idempotency table
-- Persists processed webhook event IDs to prevent duplicate processing across server restarts

-- UP
CREATE TABLE IF NOT EXISTS webhook_processed_events (
    event_id TEXT PRIMARY KEY NOT NULL,
    source TEXT NOT NULL DEFAULT 'stripe',
    processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_processed_events_processed_at
    ON webhook_processed_events(processed_at);

-- DOWN
DROP TABLE IF EXISTS webhook_processed_events;
