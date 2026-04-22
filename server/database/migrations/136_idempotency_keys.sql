-- Migration 136: Idempotency key cache for client-facing POSTs
--
-- Implements the Stripe-style idempotency contract: a client POST
-- carrying an `Idempotency-Key: <uuid>` header reliably produces the
-- same side effect at most once. A network retry with the same key
-- returns the cached response verbatim instead of re-executing the
-- handler.
--
-- Scope: a key is keyed on (key, user_scope, method, path) so an
-- admin and a client can't collide by picking the same uuid on
-- different endpoints, and the same key on two different paths
-- doesn't return stale data.
--
-- Retention: rows are cheap to keep for the retry window a client
-- might use (the Stripe recommendation is 24h). The scheduler purges
-- rows older than 7 days.

CREATE TABLE IF NOT EXISTS idempotency_keys (
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

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
  ON idempotency_keys(created_at);
