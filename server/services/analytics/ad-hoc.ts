/**
 * ===============================================
 * ANALYTICS — AD-HOC QUERY EXECUTION & SAVED QUERIES
 * ===============================================
 * Service methods for running custom analytics queries and
 * managing saved query definitions.
 */

import { getDatabase } from '../../database/init.js';

// ============================================
// Types
// ============================================

export interface SavedAnalyticsQuery {
  id: number;
  name: string;
  description: string | null;
  query: string;
  lastRun: string | null;
  createdAt: string;
}

export interface QueryExecutionResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
}

interface QuerySafetyResult {
  safe: boolean;
  reason?: string;
}

// ============================================
// Constants
// ============================================

const DEFAULT_ROW_LIMIT = 1000;

const DANGEROUS_KEYWORDS = [
  'insert', 'update', 'delete', 'drop', 'truncate', 'alter',
  'create', 'replace', 'grant', 'revoke', 'exec', 'execute',
  'attach', 'detach', 'pragma', 'vacuum'
];

// ============================================
// Helpers
// ============================================

/**
 * Validate that a query is safe (SELECT only, no dangerous keywords).
 */
export function isQuerySafe(query: string): QuerySafetyResult {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery.startsWith('select')) {
    return { safe: false, reason: 'Only SELECT queries are allowed' };
  }

  for (const keyword of DANGEROUS_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(query)) {
      return { safe: false, reason: `Query contains forbidden keyword: ${keyword}` };
    }
  }

  if (query.includes(';') && query.indexOf(';') < query.length - 1) {
    return { safe: false, reason: 'Multiple queries not allowed' };
  }

  return { safe: true };
}

// ============================================
// Service Methods
// ============================================

/**
 * Ensure the saved_analytics_queries table exists, then return all saved queries.
 */
export async function getSavedQueries(): Promise<SavedAnalyticsQuery[]> {
  const db = getDatabase();

  const tableExists = await db.get(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='saved_analytics_queries'
  `);

  if (!tableExists) {
    await db.run(`
      CREATE TABLE IF NOT EXISTS saved_analytics_queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        query TEXT NOT NULL,
        last_run_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  const queries = await db.all<SavedAnalyticsQuery>(`
    SELECT
      id,
      name,
      description,
      query,
      last_run_at as lastRun,
      created_at as createdAt
    FROM saved_analytics_queries
    ORDER BY created_at DESC
  `);

  return queries;
}

/**
 * Execute a user-supplied SELECT query with an automatic row limit.
 */
export async function executeQuery(query: string): Promise<QueryExecutionResult> {
  const db = getDatabase();
  const startTime = Date.now();

  let safeQuery = query.trim();
  if (!safeQuery.toLowerCase().includes('limit')) {
    safeQuery = `${safeQuery.replace(/;?\s*$/, '')} LIMIT ${DEFAULT_ROW_LIMIT}`;
  }

  const rows = await db.all<Record<string, unknown>>(safeQuery);
  const executionTime = Date.now() - startTime;
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return { columns, rows, rowCount: rows.length, executionTime };
}

/**
 * Save a new analytics query and return the persisted record.
 */
export async function saveQuery(
  name: string,
  query: string,
  description?: string | null
): Promise<SavedAnalyticsQuery> {
  const db = getDatabase();

  const result = await db.run(`
    INSERT INTO saved_analytics_queries (name, description, query)
    VALUES (?, ?, ?)
  `, [name.trim(), description?.trim() || null, query.trim()]);

  const savedQuery = await db.get<SavedAnalyticsQuery>(`
    SELECT
      id,
      name,
      description,
      query,
      created_at as createdAt
    FROM saved_analytics_queries
    WHERE id = ?
  `, [result.lastID]);

  return savedQuery!;
}

/**
 * Delete a saved query by ID. Returns true if it existed and was deleted.
 */
export async function deleteQuery(queryId: number): Promise<boolean> {
  const db = getDatabase();

  const existing = await db.get<{ id: number }>(
    'SELECT id FROM saved_analytics_queries WHERE id = ?',
    [queryId]
  );

  if (!existing) {
    return false;
  }

  await db.run('DELETE FROM saved_analytics_queries WHERE id = ?', [queryId]);
  return true;
}
