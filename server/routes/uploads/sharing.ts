/**
 * ===============================================
 * UPLOAD ROUTES — FILE SHARING
 * ===============================================
 * Admin endpoints for sharing/unsharing files with clients.
 */

import express, { Router } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { getDatabase } from '../../database/init.js';
import {
  errorResponse,
  sendSuccess,
  ErrorCodes
} from '../../utils/api-response.js';

const router = Router();

router.post(
  '/:id/share',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.id, 10);

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_FILE_ID);
    }

    const db = getDatabase();

    const file = await db.get('SELECT id, project_id FROM files WHERE id = ? AND deleted_at IS NULL', [fileId]);
    if (!file) {
      return errorResponse(res, 'File not found', 404, ErrorCodes.FILE_NOT_FOUND);
    }

    await db.run(
      `UPDATE files
       SET shared_with_client = TRUE,
           shared_at = datetime('now'),
           shared_by = ?
       WHERE id = ?`,
      [req.user?.email || 'admin', fileId]
    );

    sendSuccess(res, undefined, 'File shared with client successfully');
  })
);

router.post(
  '/:id/unshare',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.id, 10);

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_FILE_ID);
    }

    const db = getDatabase();

    const file = await db.get('SELECT id FROM files WHERE id = ? AND deleted_at IS NULL', [fileId]);
    if (!file) {
      return errorResponse(res, 'File not found', 404, ErrorCodes.FILE_NOT_FOUND);
    }

    await db.run(
      `UPDATE files
       SET shared_with_client = FALSE,
           shared_at = NULL,
           shared_by = NULL
       WHERE id = ?`,
      [fileId]
    );

    sendSuccess(res, undefined, 'File access revoked successfully');
  })
);

export default router;
