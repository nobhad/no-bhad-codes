/**
 * ===============================================
 * UPLOAD ROUTES — FILE SHARING
 * ===============================================
 * Admin endpoints for sharing/unsharing files with clients.
 */

import express, { Router } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { uploadService } from '../../services/upload-service.js';
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

    const file = await uploadService.findActiveFileById(fileId);
    if (!file) {
      return errorResponse(res, 'File not found', 404, ErrorCodes.FILE_NOT_FOUND);
    }

    await uploadService.shareFileWithClient(fileId, req.user?.email || 'admin');
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

    const file = await uploadService.findActiveFileById(fileId);
    if (!file) {
      return errorResponse(res, 'File not found', 404, ErrorCodes.FILE_NOT_FOUND);
    }

    await uploadService.unshareFileWithClient(fileId);
    sendSuccess(res, undefined, 'File access revoked successfully');
  })
);

export default router;
