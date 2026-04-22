/**
 * ===============================================
 * ADMIN — ASYNC TASK OUTBOX
 * ===============================================
 * @file server/routes/admin/async-tasks.ts
 *
 * Read-only visibility into the async_tasks queue. A non-zero `dead`
 * count means follow-up work (intake notifications, lead scoring)
 * failed every retry and needs human attention.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import {
  getAsyncTaskCounts,
  listAsyncTasks,
  type AsyncTaskStatus
} from '../../services/async-task-service.js';

const router = express.Router();

const ALLOWED_STATUSES = new Set([
  'pending',
  'running',
  'completed',
  'failed',
  'dead'
]);

/**
 * @swagger
 * /api/admin/async-tasks:
 *   get:
 *     tags: [Admin]
 *     summary: Async task queue health
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, running, completed, failed, dead]
 *         description: When set, also returns the recent tasks in that state.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Counts by status, plus optional task list.
 */
router.get(
  '/async-tasks',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const counts = await getAsyncTaskCounts();

    const statusParam = typeof req.query.status === 'string' ? req.query.status : null;
    if (statusParam && !ALLOWED_STATUSES.has(statusParam)) {
      return errorResponse(
        res,
        `Invalid status. Allowed: ${[...ALLOWED_STATUSES].join(', ')}`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const limit = Number.parseInt(
      typeof req.query.limit === 'string' ? req.query.limit : '',
      10
    );

    const tasks = statusParam
      ? await listAsyncTasks(statusParam as AsyncTaskStatus, Number.isFinite(limit) ? limit : 50)
      : [];

    sendSuccess(res, {
      counts,
      tasks
    });
  })
);

export default router;
