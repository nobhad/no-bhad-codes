import express, { Response } from 'express';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { escalateTaskPriorities, previewEscalation, getEscalationSummary } from '../../services/priority-escalation-service.js';
import { errorResponse } from '../../utils/api-response.js';

const router = express.Router();

// ===================================
// TASK PRIORITY ESCALATION
// ===================================

/**
 * Escalate task priorities based on due date proximity
 * POST /api/projects/:id/tasks/escalate-priorities
 * Admin only - escalates priorities for tasks in a specific project
 */
router.post(
  '/:id/tasks/escalate-priorities',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const preview = req.query.preview === 'true';

    // Verify project exists
    const db = getDatabase();
    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (preview) {
      // Preview mode - show what would be escalated
      const result = await previewEscalation(projectId);
      return res.json({
        preview: true,
        ...result
      });
    }

    // Execute escalation
    const result = await escalateTaskPriorities(projectId);

    res.json({
      success: true,
      message: `Escalated ${result.updatedCount} task(s)`,
      ...result
    });
  })
);

/**
 * Get escalation summary for a project
 * GET /api/projects/:id/tasks/escalation-summary
 * Admin only - shows task distribution and what would be escalated
 */
router.get(
  '/:id/tasks/escalation-summary',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);

    // Verify project exists
    const db = getDatabase();
    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const summary = await getEscalationSummary(projectId);

    res.json({
      projectId,
      ...summary
    });
  })
);

export default router;
