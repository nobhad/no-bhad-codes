/**
 * ===============================================
 * ADMIN FILES ROUTES
 * ===============================================
 * @file server/routes/admin/files.ts
 *
 * Admin file management endpoints.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { fileService } from '../../services/file-service.js';
import { softDeleteService } from '../../services/soft-delete-service.js';

const router = express.Router();

/**
 * GET /api/admin/files - List all files
 */
router.get(
  '/files',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, type } = req.query;

    const { files, stats } = await fileService.listAdminFilesWithDetails({
      projectId: projectId ? parseInt(projectId as string, 10) : undefined,
      type: type as string | undefined
    });

    sendSuccess(res, { files, stats });
  })
);

/**
 * DELETE /api/admin/files/:fileId - Delete a file
 */
router.delete(
  '/files/:fileId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.fileId, 10);

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_ID);
    }

    const exists = await fileService.adminFileExists(fileId);
    if (!exists) {
      return errorResponse(res, 'File not found', 404, ErrorCodes.NOT_FOUND);
    }

    const adminEmail = req.user?.email || 'admin';
    await softDeleteService.softDelete('file', fileId, adminEmail);

    sendSuccess(res, undefined, 'File deleted');
  })
);

export default router;
