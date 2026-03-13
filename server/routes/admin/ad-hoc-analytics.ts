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
import { analyticsService } from '../../services/analytics-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
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
    const queries = await analyticsService.getSavedAnalyticsQueries();
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
      return errorResponse(res, 'Query is required', 400, ErrorCodes.MISSING_QUERY);
    }

    // Validate query safety
    const validation = isQuerySafe(query);
    if (!validation.safe) {
      return errorResponse(res, validation.reason || 'Invalid query', 400, ErrorCodes.INVALID_QUERY);
    }

    try {
      const result = await analyticsService.runAdHocQuery(query);

      logger.info('[Ad-hoc Analytics] Query executed', {
        metadata: {
          queryLength: query.length,
          rowCount: result.rowCount,
          executionTime: result.executionTime,
          user: req.user?.email
        }
      });

      sendSuccess(res, { result });
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
        ErrorCodes.QUERY_ERROR
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
      return errorResponse(res, 'Query name is required', 400, ErrorCodes.MISSING_NAME);
    }

    if (!query || query.trim().length === 0) {
      return errorResponse(res, 'Query is required', 400, ErrorCodes.MISSING_QUERY);
    }

    // Validate query safety
    const validation = isQuerySafe(query);
    if (!validation.safe) {
      return errorResponse(res, validation.reason || 'Invalid query', 400, ErrorCodes.INVALID_QUERY);
    }

    const savedQuery = await analyticsService.saveAnalyticsQuery({
      name,
      description: description?.trim() || null,
      query
    });

    sendCreated(res, { query: savedQuery }, 'Query saved');
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

    if (isNaN(queryId) || queryId <= 0) {
      return errorResponse(res, 'Invalid query ID', 400, ErrorCodes.INVALID_ID);
    }

    const deleted = await analyticsService.deleteAnalyticsQuery(queryId);

    if (!deleted) {
      return errorResponse(res, 'Query not found', 404, ErrorCodes.NOT_FOUND);
    }

    sendSuccess(res);
  })
);

export default router;
