/**
 * ===============================================
 * SCHEMA DRIFT DETECTION
 * ===============================================
 * @file server/database/schema-drift.ts
 *
 * Catches the class of production bug where the live DB schema no
 * longer matches what the applied migration sequence should have
 * produced — someone ran an ad-hoc ALTER TABLE in prod, a migration
 * crashed mid-way, a hot-fix was applied by hand and never codified,
 * a schema change from a feature branch leaked into a shared env.
 *
 * How:
 *   - At startup, after migrations finish, capture a snapshot of every
 *     user-defined object from `sqlite_master` (tables, indexes,
 *     triggers, views) and hash it.
 *   - Compare to the snapshot recorded on the previous successful
 *     boot (stored in system_settings under `schema.snapshot`).
 *   - If they match: silently record the new baseline.
 *   - If they differ: this is drift — report the added / removed /
 *     modified objects and let the caller decide what to do.
 *
 * The snapshot is stored as the full JSON object list (not just a
 * hash) so the diff can show WHICH objects changed, not just that
 * something did.
 *
 * Indexes / tables auto-created by SQLite itself (prefixed `sqlite_`)
 * are filtered out — their SQL is either null or opaque.
 */

import crypto from 'node:crypto';
import type { Database } from './init.js';

export interface SchemaObject {
  type: string;
  name: string;
  sql: string;
}

export interface SchemaDriftObject {
  type: string;
  name: string;
}

export interface SchemaDriftModifiedObject extends SchemaDriftObject {
  expectedSql: string;
  actualSql: string;
}

export interface SchemaDriftReport {
  /** True when current and stored snapshots match (or there's no stored baseline yet). */
  ok: boolean;
  /** SHA-256 over the sorted-and-serialised current snapshot. */
  currentFingerprint: string;
  /** SHA-256 of the stored baseline; null on first-ever boot. */
  storedFingerprint: string | null;
  /** Objects present now but not in the baseline. */
  added: SchemaDriftObject[];
  /** Objects present in the baseline but missing now. */
  removed: SchemaDriftObject[];
  /** Objects present in both but with different CREATE SQL. */
  modified: SchemaDriftModifiedObject[];
  /**
   * True when there's no stored baseline yet — this is the first boot
   * of schema-drift detection, so the caller should record the current
   * snapshot as the baseline without treating the state as drift.
   */
  firstBoot: boolean;
}

const SETTING_KEY = 'schema.snapshot';

/**
 * Read every user-defined object currently in the DB schema.
 * Sorted by (type, name) so the fingerprint is deterministic.
 */
export async function captureSchemaSnapshot(db: Database): Promise<SchemaObject[]> {
  const rows = await db.all<{ type: string; name: string; sql: string | null }>(
    `SELECT type, name, sql
       FROM sqlite_master
      WHERE sql IS NOT NULL
        AND name NOT LIKE 'sqlite_%'
      ORDER BY type ASC, name ASC`
  );
  return rows
    .filter((r): r is { type: string; name: string; sql: string } => typeof r.sql === 'string')
    .map((r) => ({ type: r.type, name: r.name, sql: normaliseSql(r.sql) }));
}

/**
 * Normalise whitespace in a CREATE statement so formatting-only edits
 * don't register as drift. Collapse runs of whitespace, trim. We keep
 * semantic content (identifiers, keywords, clauses) intact.
 */
function normaliseSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

export function fingerprintSnapshot(snapshot: SchemaObject[]): string {
  const payload = snapshot.map((o) => `${o.type}\x1f${o.name}\x1f${o.sql}`).join('\x1e');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function getStoredSnapshot(db: Database): Promise<SchemaObject[] | null> {
  const row = await db.get<{ setting_value: string }>(
    'SELECT setting_value FROM system_settings WHERE setting_key = ?',
    [SETTING_KEY]
  );
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.setting_value) as SchemaObject[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function recordSchemaBaseline(
  db: Database,
  snapshot: SchemaObject[]
): Promise<void> {
  const value = JSON.stringify(snapshot);
  await db.run(
    `INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
     VALUES (?, ?, 'string', 'Schema snapshot recorded after last successful startup')
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
    [SETTING_KEY, value]
  );
}

function diffSnapshots(
  stored: SchemaObject[],
  current: SchemaObject[]
): Pick<SchemaDriftReport, 'added' | 'removed' | 'modified'> {
  const key = (o: SchemaObject) => `${o.type}:${o.name}`;
  const storedMap = new Map(stored.map((o) => [key(o), o]));
  const currentMap = new Map(current.map((o) => [key(o), o]));

  const added: SchemaDriftObject[] = [];
  const removed: SchemaDriftObject[] = [];
  const modified: SchemaDriftModifiedObject[] = [];

  for (const [k, obj] of currentMap) {
    const prior = storedMap.get(k);
    if (!prior) {
      added.push({ type: obj.type, name: obj.name });
    } else if (prior.sql !== obj.sql) {
      modified.push({
        type: obj.type,
        name: obj.name,
        expectedSql: prior.sql,
        actualSql: obj.sql
      });
    }
  }
  for (const [k, obj] of storedMap) {
    if (!currentMap.has(k)) {
      removed.push({ type: obj.type, name: obj.name });
    }
  }

  return { added, removed, modified };
}

/**
 * Run the full drift detection: capture current snapshot, compare to
 * the stored baseline, produce a structured report. Does NOT mutate
 * the stored baseline — caller decides whether to record or bail.
 */
export async function detectSchemaDrift(db: Database): Promise<SchemaDriftReport> {
  const current = await captureSchemaSnapshot(db);
  const currentFingerprint = fingerprintSnapshot(current);

  const stored = await getStoredSnapshot(db);
  if (!stored) {
    return {
      ok: true,
      currentFingerprint,
      storedFingerprint: null,
      added: [],
      removed: [],
      modified: [],
      firstBoot: true
    };
  }

  const storedFingerprint = fingerprintSnapshot(stored);
  if (storedFingerprint === currentFingerprint) {
    return {
      ok: true,
      currentFingerprint,
      storedFingerprint,
      added: [],
      removed: [],
      modified: [],
      firstBoot: false
    };
  }

  const { added, removed, modified } = diffSnapshots(stored, current);

  return {
    ok: false,
    currentFingerprint,
    storedFingerprint,
    added,
    removed,
    modified,
    firstBoot: false
  };
}
