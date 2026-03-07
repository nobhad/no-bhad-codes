/**
 * ===============================================
 * ADMIN AD-HOC ANALYTICS ROUTES
 * ===============================================
 * @file server/routes/admin/ad-hoc-analytics.ts
 *
 * Provides endpoints for running custom analytics queries.
 * Security: Only SELECT queries are allowed, no modifications.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { getDatabase } from '../../database/init.js';
import { errorResponse, sendSuccess } from '../../utils/api-response.js';
import { logger } from '../../services/logger.js';

const router = express.Router();

// Validate query is safe (SELECT only, no dangerous keywords)
function isQuerySafe(query: string): { safe: boolean; reason?: string } {
  const normalizedQuery = query.trim().toLowerCase();

  // Must start with SELECT
  if (!normalizedQuery.startsWith('select')) {
    return { safe: false, reason: 'Only SELECT queries are allowed' };
  }

  // Block dangerous keywords
  const dangerousKeywords = [
    'insert', 'update', 'delete', 'drop', 'truncate', 'alter',
    'create', 'replace', 'grant', 'revoke', 'exec', 'execute',
    'attach', 'detach', 'pragma', 'vacuum'
  ];

  for (const keyword of dangerousKeywords) {
    // Check for keyword as a word boundary
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(query)) {
      return { safe: false, reason: `Query contains forbidden keyword: ${keyword}` };
    }
  }

  // Block semicolons (prevent query chaining)
  if (query.includes(';') && query.indexOf(';') < query.length - 1) {
    return { safe: false, reason: 'Multiple queries not allowed' };
  }

  return { safe: true };
}

/**
 * GET /api/admin/ad-hoc-analytics/queries - Get saved queries
 */
router.get(
  '/ad-hoc-analytics/queries',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    // Check if saved_queries table exists
    const tableExists = await db.get(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='saved_analytics_queries'
    `);

    if (!tableExists) {
      // Create the table if it doesn't exist
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

    const queries = await db.all(`
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

    sendSuccess(res, { queries });
  })
);

/**
 * POST /api/admin/ad-hoc-analytics/run - Execute a query
 */
router.post(
  '/ad-hoc-analytics/run',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { query } = req.body;

    if (!query || query.trim().length === 0) {
      return errorResponse(res, 'Query is required', 400, 'MISSING_QUERY');
    }

    // Validate query safety
    const validation = isQuerySafe(query);
    if (!validation.safe) {
      return errorResponse(res, validation.reason || 'Invalid query', 400, 'INVALID_QUERY');
    }

    const db = getDatabase();
    const startTime = Date.now();

    try {
      // Execute the query with a LIMIT to prevent huge result sets
      let safeQuery = query.trim();
      if (!safeQuery.toLowerCase().includes('limit')) {
        safeQuery = `${safeQuery.replace(/;?\s*$/, '')  } LIMIT 1000`;
      }

      const rows = await db.all(safeQuery);
      const executionTime = Date.now() - startTime;

      // Extract column names from first row
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      logger.info('[Ad-hoc Analytics] Query executed', {
        metadata: {
          queryLength: query.length,
          rowCount: rows.length,
          executionTime,
          user: req.user?.email
        }
      });

      sendSuccess(res, {
        result: {
          columns,
          rows,
          rowCount: rows.length,
          executionTime
        }
      });
    } catch (err) {
      logger.error('[Ad-hoc Analytics] Query failed', {
        error: err instanceof Error ? err : new Error(String(err)),
        metadata: {
          user: req.user?.email
        }
      });

      return errorResponse(
        res,
        err instanceof Error ? err.message : 'Query execution failed',
        400,
        'QUERY_ERROR'
      );
    }
  })
);

/**
 * POST /api/admin/ad-hoc-analytics/queries - Save a query
 */
router.post(
  '/ad-hoc-analytics/queries',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, description, query } = req.body;

    if (!name || name.trim().length === 0) {
      return errorResponse(res, 'Query name is required', 400, 'MISSING_NAME');
    }

    if (!query || query.trim().length === 0) {
      return errorResponse(res, 'Query is required', 400, 'MISSING_QUERY');
    }

    // Validate query safety
    const validation = isQuerySafe(query);
    if (!validation.safe) {
      return errorResponse(res, validation.reason || 'Invalid query', 400, 'INVALID_QUERY');
    }

    const db = getDatabase();

    const result = await db.run(`
      INSERT INTO saved_analytics_queries (name, description, query)
      VALUES (?, ?, ?)
    `, [name.trim(), description?.trim() || null, query.trim()]);

    const savedQuery = await db.get(`
      SELECT
        id,
        name,
        description,
        query,
        created_at as createdAt
      FROM saved_analytics_queries
      WHERE id = ?
    `, [result.lastID]);

    sendSuccess(res, { query: savedQuery });
  })
);

/**
 * DELETE /api/admin/ad-hoc-analytics/queries/:queryId - Delete a saved query
 */
router.delete(
  '/ad-hoc-analytics/queries/:queryId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const queryId = parseInt(req.params.queryId, 10);

    if (isNaN(queryId)) {
      return errorResponse(res, 'Invalid query ID', 400, 'INVALID_ID');
    }

    const db = getDatabase();

    const existing = await db.get(
      'SELECT id FROM saved_analytics_queries WHERE id = ?',
      [queryId]
    );

    if (!existing) {
      return errorResponse(res, 'Query not found', 404, 'NOT_FOUND');
    }

    await db.run('DELETE FROM saved_analytics_queries WHERE id = ?', [queryId]);

    sendSuccess(res);
  })
);

export default router;
