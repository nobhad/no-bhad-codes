/**
 * ===============================================
 * ADMIN NOTIFICATION ROUTES
 * ===============================================
 * @file server/routes/admin/notifications.ts
 *
 * Admin notification endpoints for notification bell in admin portal.
 * Mirrors client notification routes but for admin users.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { getDatabase } from '../../database/init.js';
import { authenticateToken, requireAdmin, type AuthenticatedRequest } from '../../middleware/auth.js';

const router = express.Router();

/**
 * GET /notifications/history - Get notification history for admin
 */
router.get(
  '/history',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    if (isNaN(limit) || limit < 0) {
      return errorResponse(res, 'Invalid limit parameter', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const db = getDatabase();
    const notifications = await db.all(
      `SELECT id, type, title, message, is_read, created_at, data
       FROM notification_history
       WHERE user_id = ? AND user_type = 'admin'
       ORDER BY created_at DESC
       LIMIT ?`,
      [req.user!.id, limit]
    );

    sendSuccess(res, { notifications });
  })
);

/**
 * PUT /notifications/:id/read - Mark a single notification as read
 */
router.put(
  '/:id/read',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const notificationId = parseInt(req.params.id, 10);
    if (isNaN(notificationId) || notificationId <= 0) {
      return errorResponse(res, 'Invalid notification ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const db = getDatabase();
    const result = await db.run(
      `UPDATE notification_history
       SET is_read = 1, read_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND user_type = 'admin'`,
      [notificationId, req.user!.id]
    );

    if (result.changes === 0) {
      return errorResponse(res, 'Notification not found', 404, ErrorCodes.NOT_FOUND);
    }

    sendSuccess(res, undefined, 'Notification marked as read');
  })
);

/**
 * PUT /notifications/mark-all-read - Mark all notifications as read
 */
router.put(
  '/mark-all-read',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    await db.run(
      `UPDATE notification_history
       SET is_read = 1, read_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND user_type = 'admin' AND is_read = 0`,
      [req.user!.id]
    );

    sendSuccess(res, undefined, 'All notifications marked as read');
  })
);

export default router;
