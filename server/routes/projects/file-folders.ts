import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject, canAccessFolder, canAccessFile } from '../../middleware/access-control.js';
import { fileService } from '../../services/file-service.js';
import { errorResponse } from '../../utils/api-response.js';

const router = express.Router();

// Get folders for a project
router.get(
  '/:id/folders',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const parentId = req.query.parent_id ? parseInt(req.query.parent_id as string) : undefined;
    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const folders = await fileService.getFolders(projectId, parentId);
    res.json({ folders });
  })
);

// Create a folder
router.post(
  '/:id/folders',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const { name, description, parent_folder_id, color, icon } = req.body;

    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    if (!name || name.trim().length === 0) {
      return errorResponse(res, 'Folder name is required', 400, 'MISSING_NAME');
    }

    const folder = await fileService.createFolder(projectId, {
      name: name.trim(),
      description,
      parent_folder_id,
      color,
      icon,
      created_by: req.user!.email
    });

    res.status(201).json({ folder });
  })
);

// Update a folder
router.put(
  '/folders/:folderId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const folderId = parseInt(req.params.folderId);
    const { name, description, color, icon, sort_order } = req.body;
    if (isNaN(folderId)) {
      return errorResponse(res, 'Invalid folder ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFolder(req, folderId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const folder = await fileService.updateFolder(folderId, { name, description, color, icon, sort_order });
    res.json({ folder });
  })
);

// Delete a folder
router.delete(
  '/folders/:folderId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const folderId = parseInt(req.params.folderId);
    const moveFilesTo = req.query.move_files_to ? parseInt(req.query.move_files_to as string) : undefined;
    await fileService.deleteFolder(folderId, moveFilesTo);
    res.json({ message: 'Folder deleted' });
  })
);

// Move a file to a folder
router.post(
  '/files/:fileId/move',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const { folder_id } = req.body;
    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    await fileService.moveFile(fileId, folder_id || null);
    res.json({ message: 'File moved' });
  })
);

// Move a folder
router.post(
  '/folders/:folderId/move',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const folderId = parseInt(req.params.folderId);
    const { parent_folder_id } = req.body;
    if (isNaN(folderId)) {
      return errorResponse(res, 'Invalid folder ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFolder(req, folderId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    await fileService.moveFolder(folderId, parent_folder_id || null);
    res.json({ message: 'Folder moved' });
  })
);

export { router as fileFoldersRouter };
export default router;
