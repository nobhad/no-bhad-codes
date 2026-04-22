-- Migration 135: Tamper-evident hash chain on audit_logs
--
-- Each audit row now carries two new columns:
--   prev_hash  — the hash of the previous chronologically-inserted row
--   hash       — SHA-256 over this row's canonical content + prev_hash
--
-- Properties this gives us:
--   * Edit any row → its own hash no longer matches its contents
--   * Edit and re-hash a row → the next row's prev_hash no longer matches
--     (so the chain is broken from the edit forward)
--   * Delete a row → the gap is detectable because the surviving rows'
--     prev_hash entries no longer form an unbroken sequence
--
-- Historical rows (inserted before this migration) will have NULL
-- prev_hash/hash. The verifier treats the chain as starting at the
-- first row WITH a non-null hash, so retrofitting isn't necessary.

ALTER TABLE audit_logs ADD COLUMN prev_hash TEXT;
ALTER TABLE audit_logs ADD COLUMN hash TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_hash ON audit_logs(hash);
