import express, { Response } from 'express';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject, canAccessFile } from '../../middleware/access-control.js';
import { fileService } from '../../services/file-service.js';
import { upload } from './uploads.js';
import { errorResponse, sendSuccess, sendCreated } from '../../utils/api-response.js';

const router = express.Router();

// Get files for a project
router.get(
  '/:id/files',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const files = await db.all(
      `
    SELECT id, filename, original_filename, file_size, mime_type, file_type,
           file_path, description, uploaded_by, created_at
    FROM files
    WHERE project_id = ?
    ORDER BY created_at DESC
  `,
      [projectId]
    );

    // Map to consistent field names
    sendSuccess(res, {
      files: files.map((f: any) => ({
        ...f,
        size: f.file_size
      }))
    });
  })
);

// Upload files to project
router.post(
  '/:id/files',
  authenticateToken,
  upload.array('files', 5),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return errorResponse(res, 'No files uploaded', 400, 'NO_FILES');
    }

    const db = getDatabase();

    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const uploadedFiles = [];
    const label = req.body.label || null;

    for (const file of files) {
      const result = await db.run(
        `
      INSERT INTO files (project_id, filename, original_filename, file_path, file_size, mime_type, uploaded_by, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
        [
          projectId,
          file.filename,
          file.originalname,
          file.path,
          file.size,
          file.mimetype,
          req.user!.type,
          label
        ]
      );

      uploadedFiles.push({
        id: result.lastID,
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
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const tags = await fileService.getFileTags(fileId);
    sendSuccess(res, { tags });
  })
);

// Add tag to a file
router.post(
  '/files/:fileId/tags/:tagId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const tagId = parseInt(req.params.tagId);
    if (isNaN(fileId) || isNaN(tagId)) {
      return errorResponse(res, 'Invalid file or tag ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    await fileService.addTag(fileId, tagId);
    sendSuccess(res, undefined, 'Tag added');
  })
);

// Remove tag from a file
router.delete(
  '/files/:fileId/tags/:tagId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const tagId = parseInt(req.params.tagId);
    if (isNaN(fileId) || isNaN(tagId)) {
      return errorResponse(res, 'Invalid file or tag ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
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
    const projectId = parseInt(req.params.id);
    const tagId = parseInt(req.params.tagId);
    if (isNaN(projectId) || isNaN(tagId)) {
      return errorResponse(res, 'Invalid project or tag ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const files = await fileService.getFilesByTag(projectId, tagId);
    sendSuccess(res, { files });
  })
);

// Log file access (called when file is viewed/downloaded)
router.post(
  '/files/:fileId/access',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const { access_type } = req.body;

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    if (!access_type || !['view', 'download', 'preview'].includes(access_type)) {
      return errorResponse(res, 'Invalid access type', 400, 'INVALID_ACCESS_TYPE');
    }

    await fileService.logAccess(
      fileId,
      req.user!.email,
      req.user!.type as 'admin' | 'client',
      access_type,
      req.ip,
      req.get('User-Agent')
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
    const fileId = parseInt(req.params.fileId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const log = await fileService.getAccessLog(fileId, limit);
    sendSuccess(res, { access_log: log });
  })
);

// Get access stats for a file
router.get(
  '/files/:fileId/access-stats',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const stats = await fileService.getAccessStats(fileId);
    sendSuccess(res, { stats });
  })
);

// Archive a file
router.post(
  '/files/:fileId/archive',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    await fileService.archiveFile(fileId, req.user!.email);
    sendSuccess(res, undefined, 'File archived');
  })
);

// Restore a file from archive
router.post(
  '/files/:fileId/restore',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
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
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
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
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
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
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const count = await fileService.processExpiredFiles();
    sendSuccess(res, { count }, `Processed ${count} expired files`);
  })
);

// Lock a file
router.post(
  '/files/:fileId/lock',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    await fileService.lockFile(fileId, req.user!.email);
    sendSuccess(res, undefined, 'File locked');
  })
);

// Unlock a file
router.post(
  '/files/:fileId/unlock',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const isAdmin = req.user!.type === 'admin';
    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    await fileService.unlockFile(fileId, req.user!.email, isAdmin);
    sendSuccess(res, undefined, 'File unlocked');
  })
);

// Set file category
router.put(
  '/files/:fileId/category',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const { category } = req.body;

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const validCategories = ['general', 'deliverable', 'source', 'asset', 'document', 'contract', 'invoice'];
    if (!category || !validCategories.includes(category)) {
      return errorResponse(res, 'Invalid category', 400, 'INVALID_CATEGORY');
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
    const projectId = parseInt(req.params.id);
    const category = req.params.category as 'general' | 'deliverable' | 'source' | 'asset' | 'document' | 'contract' | 'invoice';
    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
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
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
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
    const projectId = parseInt(req.params.id);
    const query = req.query.q as string;

    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    if (!query || query.trim().length === 0) {
      return errorResponse(res, 'Search query is required', 400, 'MISSING_QUERY');
    }

    const files = await fileService.searchFiles(projectId, query.trim(), {
      folder_id: req.query.folder_id ? parseInt(req.query.folder_id as string) : undefined,
      category: req.query.category as any,
      include_archived: req.query.include_archived === 'true',
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50
    });

    sendSuccess(res, { files, count: files.length });
  })
);

export { router as filesRouter };
export default router;
