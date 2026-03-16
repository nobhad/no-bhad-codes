import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import {
  canAccessProject,
  canAccessFolder,
  canAccessFile
} from '../../utils/access-control.js';
import { fileService } from '../../services/file-service.js';
import { errorResponse, sendSuccess, sendCreated, messageResponse, ErrorCodes } from '../../utils/api-response.js';
import { invalidateCache } from '../../middleware/cache.js';

const router = express.Router();

// Get folders for a project
router.get(
  '/:id/folders',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    const parentId = req.query.parent_id ? parseInt(req.query.parent_id as string) : undefined;
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const folders = await fileService.getFolders(projectId, parentId);
    sendSuccess(res, { folders });
  })
);

// Create a folder
router.post(
  '/:id/folders',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    const { name, description, parent_folder_id, color, icon } = req.body;

    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    if (!name || name.trim().length === 0) {
      return errorResponse(res, 'Folder name is required', 400, ErrorCodes.MISSING_NAME);
    }

    const folder = await fileService.createFolder(projectId, {
      name: name.trim(),
      description,
      parent_folder_id,
      color,
      icon,
      created_by: req.user!.email
    });

    sendCreated(res, { folder });
  })
);

// Update a folder
router.put(
  '/folders/:folderId',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const folderId = parseInt(req.params.folderId, 10);
    const { name, description, color, icon, sort_order } = req.body;
    if (isNaN(folderId) || folderId <= 0) {
      return errorResponse(res, 'Invalid folder ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFolder(req, folderId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const folder = await fileService.updateFolder(folderId, {
      name,
      description,
      color,
      icon,
      sort_order
    });
    sendSuccess(res, { folder });
  })
);

// Delete a folder
router.delete(
  '/folders/:folderId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const folderId = parseInt(req.params.folderId, 10);
    if (isNaN(folderId) || folderId <= 0) {
      return errorResponse(res, 'Invalid folder ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const moveFilesTo = req.query.move_files_to
      ? parseInt(req.query.move_files_to as string, 10)
      : undefined;
    await fileService.deleteFolder(folderId, moveFilesTo);
    messageResponse(res, 'Folder deleted');
  })
);

// Move a file to a folder
router.post(
  '/files/:fileId/move',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    const { folder_id } = req.body;
    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    await fileService.moveFile(fileId, folder_id || null);
    messageResponse(res, 'File moved');
  })
);

// Move a folder
router.post(
  '/folders/:folderId/move',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const folderId = parseInt(req.params.folderId, 10);
    const { parent_folder_id } = req.body;
    if (isNaN(folderId) || folderId <= 0) {
      return errorResponse(res, 'Invalid folder ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFolder(req, folderId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    await fileService.moveFolder(folderId, parent_folder_id || null);
    messageResponse(res, 'Folder moved');
  })
);

export { router as fileFoldersRouter };
export default router;
