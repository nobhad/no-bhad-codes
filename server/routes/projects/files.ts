import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject, canAccessFile } from '../../utils/access-control.js';
import { fileService } from '../../services/file-service.js';
import { projectService } from '../../services/project-service.js';
import { upload } from './uploads.js';
import { invalidateCache } from '../../middleware/cache.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';

const router = express.Router();

// Get files for a project
router.get(
  '/:id/files',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const project = await projectService.getProjectByIdAdmin(projectId);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const files = await fileService.getProjectFilesList(projectId);

    sendSuccess(res, {
      files: files.map((f: Record<string, unknown>) => ({
        id: f.id,
        project_id: projectId,
        filename: f.filename,
        original_name: f.original_filename,
        file_type: f.mime_type || f.file_type || '',
        file_size: f.file_size,
        category: f.category || null,
        is_shared: !!f.shared_with_client,
        uploaded_by: f.uploaded_by,
        created_at: f.created_at,
        download_url: `/api/uploads/file/${f.id}`
      }))
    });
  })
);

// Upload files to project
router.post(
  '/:id/files',
  authenticateToken,
  upload.array('files', 5),
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return errorResponse(res, 'No files uploaded', 400, ErrorCodes.NO_FILES);
    }

    const project = await projectService.getProjectByIdAdmin(projectId);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const uploadedFiles = [];
    const label = req.body.label || null;

    for (const file of files) {
      // Always use email for uploaded_by for consistency and audit trails
      const newId = await fileService.insertProjectFile({
        projectId,
        filename: file.filename,
        originalFilename: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: req.user!.email || req.user!.type,
        description: label
      });

      uploadedFiles.push({
        id: newId,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        description: label
      });
    }

    sendCreated(res, { files: uploadedFiles }, `${files.length} file(s) uploaded successfully`);
  })
);

// Get tags for a file
router.get(
  '/files/:fileId/tags',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const tags = await fileService.getFileTags(fileId);
    sendSuccess(res, { tags });
  })
);

// Add tag to a file
router.post(
  '/files/:fileId/tags/:tagId',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    const tagId = parseInt(req.params.tagId, 10);
    if (isNaN(fileId) || fileId <= 0 || isNaN(tagId) || tagId <= 0) {
      return errorResponse(res, 'Invalid file or tag ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    await fileService.addTag(fileId, tagId);
    sendCreated(res, undefined, 'Tag added');
  })
);

// Remove tag from a file
router.delete(
  '/files/:fileId/tags/:tagId',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    const tagId = parseInt(req.params.tagId, 10);
    if (isNaN(fileId) || fileId <= 0 || isNaN(tagId) || tagId <= 0) {
      return errorResponse(res, 'Invalid file or tag ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    await fileService.removeTag(fileId, tagId);
    sendSuccess(res, undefined, 'Tag removed');
  })
);

// Get files by tag
router.get(
  '/:id/files/by-tag/:tagId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    const tagId = parseInt(req.params.tagId, 10);
    if (isNaN(projectId) || projectId <= 0 || isNaN(tagId) || tagId <= 0) {
      return errorResponse(res, 'Invalid project or tag ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const files = await fileService.getFilesByTag(projectId, tagId);
    sendSuccess(res, { files });
  })
);

// Log file access (called when file is viewed/downloaded)
router.post(
  '/files/:fileId/access',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    const { access_type } = req.body;

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    if (!access_type || !['view', 'download', 'preview'].includes(access_type)) {
      return errorResponse(res, 'Invalid access type', 400, ErrorCodes.INVALID_ACCESS_TYPE);
    }

    await fileService.logAccess(
      fileId,
      req.user!.email,
      req.user!.type as 'admin' | 'client',
      access_type,
      req.ip,
      (req.get('User-Agent') || '').substring(0, 500)
    );
    sendSuccess(res, undefined, 'Access logged');
  })
);

// Get access log for a file (admin only)
router.get(
  '/files/:fileId/access-log',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const log = await fileService.getAccessLog(fileId, limit);
    sendSuccess(res, { access_log: log });
  })
);

// Get access stats for a file
router.get(
  '/files/:fileId/access-stats',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const stats = await fileService.getAccessStats(fileId);
    sendSuccess(res, { stats });
  })
);

// Archive a file
router.post(
  '/files/:fileId/archive',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    await fileService.archiveFile(fileId, req.user!.email);
    sendSuccess(res, undefined, 'File archived');
  })
);

// Restore a file from archive
router.post(
  '/files/:fileId/restore',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    await fileService.restoreFile(fileId);
    sendSuccess(res, undefined, 'File restored');
  })
);

// Get archived files for a project
router.get(
  '/:id/files/archived',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const files = await fileService.getArchivedFiles(projectId);
    sendSuccess(res, { files });
  })
);

// Set file expiration
router.put(
  '/files/:fileId/expiration',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { expires_at } = req.body;
    await fileService.setExpiration(fileId, expires_at || null);
    sendSuccess(res, undefined, 'Expiration set');
  })
);

// Get files expiring soon
router.get(
  '/files/expiring-soon',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const daysAhead = req.query.days ? parseInt(req.query.days as string) : 7;
    const files = await fileService.getExpiringFiles(daysAhead);
    sendSuccess(res, { files });
  })
);

// Process expired files (admin batch operation)
router.post(
  '/files/process-expired',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const count = await fileService.processExpiredFiles();
    sendSuccess(res, { count }, `Processed ${count} expired files`);
  })
);

// Lock a file
router.post(
  '/files/:fileId/lock',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    await fileService.lockFile(fileId, req.user!.email);
    sendSuccess(res, undefined, 'File locked');
  })
);

// Unlock a file
router.post(
  '/files/:fileId/unlock',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    const isAdmin = req.user!.type === 'admin';
    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    await fileService.unlockFile(fileId, req.user!.email, isAdmin);
    sendSuccess(res, undefined, 'File unlocked');
  })
);

// Set file category
router.put(
  '/files/:fileId/category',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    const { category } = req.body;

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const validCategories = [
      'general',
      'deliverable',
      'source',
      'asset',
      'document',
      'contract',
      'invoice'
    ];
    if (!category || !validCategories.includes(category)) {
      return errorResponse(res, 'Invalid category', 400, ErrorCodes.INVALID_CATEGORY);
    }

    await fileService.setCategory(fileId, category);
    sendSuccess(res, undefined, 'Category set');
  })
);

// Get files by category
router.get(
  '/:id/files/by-category/:category',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    const category = req.params.category as
      | 'general'
      | 'deliverable'
      | 'source'
      | 'asset'
      | 'document'
      | 'contract'
      | 'invoice';
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const files = await fileService.getFilesByCategory(projectId, category);
    sendSuccess(res, { files });
  })
);

// Get file statistics for a project
router.get(
  '/:id/files/stats',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const stats = await fileService.getFileStats(projectId);
    sendSuccess(res, { stats });
  })
);

// Search files
router.get(
  '/:id/files/search',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    const query = req.query.q as string;

    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    if (!query || query.trim().length === 0) {
      return errorResponse(res, 'Search query is required', 400, ErrorCodes.MISSING_QUERY);
    }

    const files = await fileService.searchFiles(projectId, query.trim(), {
      folder_id: req.query.folder_id ? parseInt(req.query.folder_id as string) : undefined,
      category: req.query.category as 'general' | 'deliverable' | 'source' | 'asset' | 'document' | 'contract' | 'invoice' | undefined,
      include_archived: req.query.include_archived === 'true',
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50
    });

    sendSuccess(res, { files, count: files.length });
  })
);

export { router as filesRouter };
export default router;
