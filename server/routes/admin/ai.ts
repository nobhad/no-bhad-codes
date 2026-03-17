/**
 * ===============================================
 * AI ADMIN ROUTES
 * ===============================================
 * @file server/routes/admin/ai.ts
 *
 * Admin endpoints for AI-powered features.
 *
 * POST   /ai/draft-proposal  — Draft proposal scope with AI
 * POST   /ai/draft-email     — Draft email with AI
 * GET    /ai/usage           — Current month usage summary
 * GET    /ai/usage/history   — Monthly usage history
 * GET    /ai/status          — Check AI availability
 */

import { Router, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { aiService } from '../../services/ai-service.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';

const router = Router();

/**
 * POST /api/admin/ai/draft-proposal
 * Generate AI-drafted proposal scope from project context.
 */
router.post(
  '/ai/draft-proposal',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    if (!aiService.isAvailable()) {
      errorResponse(res, 'AI features are not available', 503, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const {
      projectId, projectName, projectType, tier,
      features, budget, timeline, clientName,
      questionnaireInsights, tone
    } = req.body;

    if (!projectId) {
      errorResponse(res, 'projectId is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    try {
      const result = await aiService.draftProposalScope({
        projectId,
        projectName,
        projectType,
        tier,
        features,
        budget,
        timeline,
        clientName,
        questionnaireInsights,
        tone
      });

      sendSuccess(res, { draft: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI draft failed';
      errorResponse(res, message, 422, ErrorCodes.VALIDATION_ERROR);
    }
  })
);

/**
 * POST /api/admin/ai/draft-email
 * Generate AI-drafted email from context.
 */
router.post(
  '/ai/draft-email',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    if (!aiService.isAvailable()) {
      errorResponse(res, 'AI features are not available', 503, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const { purpose, threadId, projectId, clientName, customPrompt, tone } = req.body;

    if (!purpose) {
      errorResponse(res, 'purpose is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    try {
      const result = await aiService.draftEmail({
        purpose,
        threadId,
        projectId,
        clientName,
        customPrompt,
        tone
      });

      sendSuccess(res, { draft: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI draft failed';
      errorResponse(res, message, 422, ErrorCodes.VALIDATION_ERROR);
    }
  })
);

/**
 * GET /api/admin/ai/usage
 * Get current month AI usage summary.
 */
router.get(
  '/ai/usage',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: JWTAuthRequest, res: Response) => {
    const usage = await aiService.getUsageSummary();
    sendSuccess(res, { usage });
  })
);

/**
 * GET /api/admin/ai/usage/history
 * Get monthly AI usage history.
 */
router.get(
  '/ai/usage/history',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: JWTAuthRequest, res: Response) => {
    const history = await aiService.getUsageHistory();
    sendSuccess(res, { history });
  })
);

/**
 * GET /api/admin/ai/status
 * Check if AI features are available.
 */
router.get(
  '/ai/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: JWTAuthRequest, res: Response) => {
    sendSuccess(res, {
      available: aiService.isAvailable(),
      model: process.env.AI_MODEL || 'claude-sonnet-4-5-20250514'
    });
  })
);

export default router;
