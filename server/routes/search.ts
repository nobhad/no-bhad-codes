/**
 * ===============================================
 * GLOBAL SEARCH ROUTES
 * ===============================================
 * @file server/routes/search.ts
 *
 * Unified search endpoint that queries across
 * projects, clients, messages, and invoices.
 * Used by the command palette for entity search.
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, errorResponse, ErrorCodes } from '../utils/api-response.js';
import { searchService } from '../services/search-service.js';

const router = express.Router();

// ============================================
// CONSTANTS
// ============================================

const MIN_QUERY_LENGTH = 2;

// ============================================
// GLOBAL SEARCH
// ============================================

/**
 * GET /api/search?q=<query>
 * Searches across projects, clients, messages, and invoices.
 * Results are permission-scoped.
 */
router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const query = (req.query.q as string || '').trim();

    if (query.length < MIN_QUERY_LENGTH) {
      return errorResponse(res, `Query must be at least ${MIN_QUERY_LENGTH} characters`, 400, ErrorCodes.VALIDATION_ERROR);
    }

    const user = req.user!;
    const results = await searchService.globalSearch(query, { id: user.id, type: user.type });

    sendSuccess(res, { results, query });
  })
);

export { router as searchRouter };
export default router;
