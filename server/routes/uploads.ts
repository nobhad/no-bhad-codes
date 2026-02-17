import { logger } from '../services/logger.js';
/**
 * ===============================================
 * FILE UPLOAD ROUTES
 * ===============================================
 * @file server/routes/uploads.ts
 *
 * Handles file uploads with secure storage and validation
 */

import express from 'express';
import multer from 'multer';
import { resolve, extname, normalize } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getDatabase } from '../database/init.js';
import { getUploadsDir, getUploadsSubdir, UPLOAD_DIRS, sanitizeFilename } from '../config/uploads.js';
import { getString, getNumber } from '../database/row-helpers.js';
import { errorResponse, errorResponseWithPayload, sendSuccess, sendCreated } from '../utils/api-response.js';

const router = express.Router();

// Get uploads directory from centralized config (uses persistent storage on Railway)
const uploadDir = getUploadsDir();

/**
 * Validate file path to prevent path traversal attacks
 * Ensures the resolved path is within the uploads directory
 */
function isPathSafe(filePath: string): boolean {
  // Handle both relative paths (uploads/...) and paths that might already be absolute
  const cleanPath = filePath.replace(/^\//, '').replace(/^uploads\//, '');
  const resolvedPath = resolve(uploadDir, cleanPath);
  const normalizedPath = normalize(resolvedPath);
  // Ensure the path is within the uploads directory
  return normalizedPath.startsWith(normalize(uploadDir));
}

/**
 * Resolve a database file_path to the actual filesystem path
 * Handles the uploads/ prefix and uses the correct base directory
 */
function resolveFilePath(dbFilePath: string): string {
  // Remove leading slash and 'uploads/' prefix since uploadDir already points to uploads
  const cleanPath = dbFilePath.replace(/^\//, '').replace(/^uploads\//, '');
  return resolve(uploadDir, cleanPath);
}
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

async function canAccessProject(req: AuthenticatedRequest, projectId: number): Promise<boolean> {
  if (req.user?.type === 'admin') {
    return true;
  }

  const db = getDatabase();
  const row = await db.get('SELECT 1 FROM projects WHERE id = ? AND client_id = ?', [
    projectId,
    req.user?.id
  ]);

  return !!row;
}

async function canAccessFile(req: AuthenticatedRequest, fileId: number): Promise<boolean> {
  if (req.user?.type === 'admin') {
    return true;
  }

  const db = getDatabase();
  const row = await db.get(
    `SELECT 1
     FROM files f
     JOIN projects p ON f.project_id = p.id
     WHERE f.id = ? AND p.client_id = ?`,
    [fileId, req.user?.id]
  );

  return !!row;
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create subdirectories based on file type using centralized config
    let subDir: string = UPLOAD_DIRS.GENERAL;

    if (file.fieldname === 'avatar') {
      subDir = UPLOAD_DIRS.AVATARS;
    } else if (file.fieldname === 'project_file') {
      subDir = UPLOAD_DIRS.PROJECTS;
    } else if (file.fieldname === 'invoice_attachment') {
      subDir = UPLOAD_DIRS.INVOICES;
    } else if (file.fieldname === 'message_attachment') {
      subDir = UPLOAD_DIRS.MESSAGES;
    }

    // getUploadsSubdir creates the directory if it doesn't exist
    const targetDir = getUploadsSubdir(subDir);
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    // Generate descriptive filename with sanitized original name and timestamp
    const filename = sanitizeFilename(file.originalname);
    cb(null, filename);
  }
});

// MIME type to extension mapping for validation
// Ensures the claimed MIME type matches allowed extensions
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  // Images
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'image/svg+xml': ['svg'],
  // Documents
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'text/plain': ['txt', 'md'],
  'application/rtf': ['rtf'],
  // Spreadsheets
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/csv': ['csv'],
  // Presentations
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  // Archives
  'application/zip': ['zip'],
  'application/x-rar-compressed': ['rar'],
  'application/x-tar': ['tar'],
  'application/gzip': ['gz'],
  'application/x-7z-compressed': ['7z'],
  // Data
  'application/json': ['json'],
  'text/xml': ['xml'],
  'application/xml': ['xml']
};

// File filter for security
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Define allowed file types
  // SECURITY: JS/TS/HTML/CSS removed to prevent stored XSS if files are served
  // JSON/XML allowed as they're served with safe content-type via authenticated endpoint
  const allowedTypes = {
    images: /\.(jpg|jpeg|png|gif|webp|svg)$/i,
    documents: /\.(pdf|doc|docx|txt|md|rtf)$/i,
    spreadsheets: /\.(xls|xlsx|csv)$/i,
    presentations: /\.(ppt|pptx)$/i,
    archives: /\.(zip|rar|tar|gz|7z)$/i,
    data: /\.(json|xml)$/i
  };

  const fileName = file.originalname.toLowerCase();
  const fileExt = extname(fileName).slice(1); // Remove the leading dot
  const isAllowed = Object.values(allowedTypes).some((regex) => regex.test(fileName));

  if (!isAllowed) {
    return cb(new Error(`File type not allowed: ${extname(file.originalname)}`));
  }

  // SECURITY: Verify MIME type matches the extension
  // This prevents attacks where a malicious file is renamed to an allowed extension
  const allowedExtensions = MIME_TO_EXTENSIONS[file.mimetype];
  if (!allowedExtensions) {
    return cb(new Error(`Unsupported MIME type: ${file.mimetype}`));
  }

  if (!allowedExtensions.includes(fileExt)) {
    return cb(new Error(`MIME type ${file.mimetype} does not match extension .${fileExt}`));
  }

  cb(null, true);
};

// Configure multer with limits and validation
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  }
});

/**
 * @swagger
 * /api/uploads/single:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: Upload a single file
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *                 enum: [general, avatar, project_file, invoice_attachment, message_attachment]
 */
router.post(
  '/single',
  authenticateToken,
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (!req.file) {
      return errorResponse(res, 'No file uploaded', 400, 'NO_FILE');
    }

    const fileInfo = {
      id: Date.now().toString(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      url: `/uploads/${req.file.filename}`,
      uploadedBy: req.user?.id,
      uploadedAt: new Date().toISOString()
    };

    sendCreated(res, { file: fileInfo }, 'File uploaded successfully');
  })
);

/**
 * @swagger
 * /api/uploads/multiple:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: Upload multiple files
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 */
router.post(
  '/multiple',
  authenticateToken,
  upload.array('files', 5),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return errorResponse(res, 'No files uploaded', 400, 'NO_FILES');
    }

    const db = getDatabase();
    const uploadedFiles = [];

    // Get client's first project for linking files (or null if none)
    let defaultProjectId: number | null = null;
    if (req.user?.type !== 'admin') {
      const project = await db.get(
        'SELECT id FROM projects WHERE client_id = ? ORDER BY created_at DESC LIMIT 1',
        [req.user?.id]
      ) as { id: number } | undefined;
      defaultProjectId = project?.id ?? null;
    }

    for (const file of req.files as Express.Multer.File[]) {
      // Determine the subdirectory the file was saved to
      const subDir = file.destination.includes('projects') ? 'projects' :
        file.destination.includes('avatars') ? 'avatars' :
          file.destination.includes('invoices') ? 'invoices' :
            file.destination.includes('messages') ? 'messages' : 'general';
      const filePath = `uploads/${subDir}/${file.filename}`;

      // Save to database
      const result = await db.run(
        `INSERT INTO files (project_id, filename, original_filename, mime_type, file_size, file_path, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          defaultProjectId,
          file.filename,
          file.originalname,
          file.mimetype,
          file.size,
          filePath,
          req.user?.id
        ]
      );

      uploadedFiles.push({
        id: result.lastID,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        url: `/${filePath}`,
        uploadedBy: req.user?.id,
        uploadedAt: new Date().toISOString()
      });
    }

    sendCreated(res, { files: uploadedFiles }, `${uploadedFiles.length} files uploaded successfully`);
  })
);

/**
 * @swagger
 * /api/uploads/avatar:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: Upload user avatar
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 */
router.post(
  '/avatar',
  authenticateToken,
  upload.single('avatar'),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (!req.file) {
      return errorResponse(res, 'No avatar file uploaded', 400, 'NO_AVATAR');
    }

    // Validate that it's an image
    if (!req.file.mimetype.startsWith('image/')) {
      return errorResponse(res, 'Avatar must be an image file', 400, 'INVALID_AVATAR_TYPE');
    }

    const avatarInfo = {
      id: Date.now().toString(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/avatars/${req.file.filename}`,
      uploadedBy: req.user?.id,
      uploadedAt: new Date().toISOString()
    };

    // Update client avatar URL in database
    if (req.user?.id) {
      try {
        const db = await getDatabase();
        await db.run(
          'UPDATE clients SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [avatarInfo.url, req.user.id]
        );
      } catch (dbError) {
        await logger.error('Failed to update avatar in database:', { error: dbError instanceof Error ? dbError : undefined, category: 'UPLOAD' });
        // Non-blocking - file is already uploaded
      }
    }

    sendCreated(res, { avatar: avatarInfo }, 'Avatar uploaded successfully');
  })
);

/**
 * @swagger
 * /api/uploads/project/{projectId}:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: Upload files for a specific project
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               project_file:
 *                 type: string
 *                 format: binary
 */
router.post(
  '/project/:projectId',
  authenticateToken,
  upload.single('project_file'),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_PROJECT_ID');
    }

    if (!req.file) {
      return errorResponse(res, 'No project file uploaded', 400, 'NO_PROJECT_FILE');
    }

    const projectFile = {
      id: Date.now().toString(),
      projectId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/projects/${req.file.filename}`,
      uploadedBy: req.user?.id,
      uploadedAt: new Date().toISOString()
    };

    // Save project file info to database
    let fileId: number | undefined;
    try {
      const db = await getDatabase();
      const result = await db.run(
        `INSERT INTO files (project_id, filename, original_filename, mime_type, file_size, file_path, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          projectId,
          req.file.filename,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          projectFile.url,
          req.user?.id
        ]
      );
      fileId = result.lastID;
    } catch (dbError) {
      await logger.error('Failed to save file info to database:', { error: dbError instanceof Error ? dbError : undefined, category: 'UPLOAD' });
      // Non-blocking - file is already uploaded
    }

    sendCreated(res, { file: { ...projectFile, id: fileId ?? projectFile.id } }, 'Project file uploaded successfully');
  })
);

/**
 * @swagger
 * /api/uploads/project/{projectId}:
 *   get:
 *     tags:
 *       - Uploads
 *     summary: Get all files for a project
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 */
router.get(
  '/project/:projectId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_PROJECT_ID');
    }

    try {
      const db = await getDatabase();
      const files = await db.all(
        `SELECT id, project_id, filename, original_filename, mime_type, file_size, file_path, uploaded_by, created_at, description, shared_with_client, shared_at, shared_by
         FROM files
         WHERE project_id = ?
         ORDER BY created_at DESC`,
        [projectId]
      );

      sendSuccess(res, {
        files: files.map((file: any) => ({
          id: file.id,
          projectId: file.project_id,
          filename: file.filename,
          originalName: file.original_filename,
          mimetype: file.mime_type,
          size: file.file_size,
          url: file.file_path,
          uploadedBy: file.uploaded_by,
          uploadedAt: file.created_at,
          description: file.description,
          sharedWithClient: !!file.shared_with_client,
          sharedAt: file.shared_at,
          sharedBy: file.shared_by
        }))
      });
    } catch (dbError) {
      await logger.error('Failed to fetch files:', { error: dbError instanceof Error ? dbError : undefined, category: 'UPLOAD' });
      return errorResponse(res, 'Failed to fetch files', 500, 'DB_ERROR');
    }
  })
);

/**
 * @swagger
 * /api/uploads/client:
 *   get:
 *     tags:
 *       - Uploads
 *     summary: Get all files for the authenticated client
 *     security:
 *       - BearerAuth: []
 */
router.get(
  '/client',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, 'NOT_AUTHENTICATED');
    }

    // Filter query params
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
    const fileType = req.query.fileType as string | undefined;
    const category = req.query.category as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    try {
      const db = await getDatabase();

      // Build dynamic query with filters
      // Clients can see files they uploaded OR files explicitly shared with them
      let query = `
        SELECT f.id, f.project_id, f.filename, f.original_filename, f.mime_type, f.file_size,
               f.file_path, f.uploaded_by, f.created_at, f.file_type, f.category,
               f.shared_with_client, f.shared_at,
               p.project_name as project_name
        FROM files f
        LEFT JOIN projects p ON f.project_id = p.id
        WHERE (f.uploaded_by = ? OR (p.client_id = ? AND f.shared_with_client = TRUE))
      `;
      const params: (string | number)[] = [clientId, clientId];

      if (projectId) {
        query += ' AND f.project_id = ?';
        params.push(projectId);
      }

      if (fileType && fileType !== 'all') {
        query += ' AND f.file_type = ?';
        params.push(fileType);
      }

      if (category && category !== 'all') {
        query += ' AND f.category = ?';
        params.push(category);
      }

      if (dateFrom) {
        query += ' AND date(f.created_at) >= date(?)';
        params.push(dateFrom);
      }

      if (dateTo) {
        query += ' AND date(f.created_at) <= date(?)';
        params.push(dateTo);
      }

      query += ' ORDER BY f.created_at DESC';

      const files = await db.all(query, params);

      // Also get projects list for the filter dropdown
      const projects = await db.all(
        `SELECT DISTINCT p.id, p.project_name
         FROM projects p
         WHERE p.client_id = ?
         ORDER BY p.project_name`,
        [clientId]
      );

      sendSuccess(res, {
        files: files.map((file: any) => ({
          id: file.id,
          projectId: file.project_id,
          projectName: file.project_name,
          filename: file.filename,
          originalName: file.original_filename,
          mimetype: file.mime_type,
          size: file.file_size,
          url: file.file_path,
          uploadedBy: file.uploaded_by,
          uploadedAt: file.created_at,
          fileType: file.file_type,
          category: file.category,
          sharedWithClient: file.shared_with_client,
          sharedAt: file.shared_at
        })),
        projects: projects.map((p: any) => ({
          id: p.id,
          name: p.project_name
        }))
      });
    } catch (dbError) {
      console.error('Failed to fetch client files:', dbError);
      return errorResponse(res, 'Failed to fetch files', 500, 'DB_ERROR');
    }
  })
);

/**
 * @swagger
 * /api/uploads/file/{fileId}:
 *   get:
 *     tags:
 *       - Uploads
 *     summary: Download/preview a specific file
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: integer
 */
router.get(
  '/file/:fileId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.fileId);

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_FILE_ID');
    }

    try {
      const db = await getDatabase();
      const file = await db.get(
        `SELECT f.*, p.client_id
         FROM files f
         LEFT JOIN projects p ON f.project_id = p.id
         WHERE f.id = ?`,
        [fileId]
      );

      if (!file) {
        return errorResponse(res, 'File not found', 404, 'FILE_NOT_FOUND');
      }

      // Check access: admin, client owns the project, or uploaded the file
      const userId = req.user?.id;
      const isAdmin = req.user?.type === 'admin';
      const isOwner = file.client_id === userId;
      const isUploader = file.uploaded_by === userId || file.uploaded_by === String(userId);

      if (!isAdmin && !isOwner && !isUploader) {
        return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
      }

      // Validate path to prevent path traversal attacks
      const filePathStr = getString(file, 'file_path');
      if (!isPathSafe(filePathStr)) {
        await logger.error('Path traversal attempt detected:', { error: new Error('Path traversal'), category: 'UPLOAD', metadata: { filePath: filePathStr } });
        return errorResponse(res, 'Invalid file path', 403, 'PATH_TRAVERSAL_DETECTED');
      }

      // Construct the full file path using centralized uploads directory
      const filePath = resolveFilePath(filePathStr);

      if (!existsSync(filePath)) {
        return errorResponse(res, 'File not found on disk', 404, 'FILE_MISSING');
      }

      // Set content disposition based on query param
      const download = req.query.download === 'true';
      if (download) {
        res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${file.original_filename}"`);
      }

      const mimeType = getString(file, 'mime_type');
      res.setHeader('Content-Type', mimeType || 'application/octet-stream');
      res.sendFile(filePath);
    } catch (dbError) {
      console.error('Failed to fetch file:', dbError);
      return errorResponse(res, 'Failed to fetch file', 500, 'DB_ERROR');
    }
  })
);

/**
 * @swagger
 * /api/uploads/file/{fileId}:
 *   delete:
 *     tags:
 *       - Uploads
 *     summary: Delete a file
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: integer
 */
router.delete(
  '/file/:fileId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.fileId);

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_FILE_ID');
    }

    try {
      const db = await getDatabase();
      const file = await db.get(
        `SELECT f.*, p.client_id
         FROM files f
         LEFT JOIN projects p ON f.project_id = p.id
         WHERE f.id = ?`,
        [fileId]
      );

      if (!file) {
        return errorResponse(res, 'File not found', 404, 'FILE_NOT_FOUND');
      }

      // Check access: admin or uploader can delete
      const userId = req.user?.id;
      const isAdmin = req.user?.type === 'admin';
      const isUploader = file.uploaded_by === userId || file.uploaded_by === String(userId);
      const isOwner = file.client_id === userId;

      if (!isAdmin && file.client_id && !isOwner) {
        return errorResponse(res, 'Access denied - this file belongs to another client', 403, 'ACCESS_DENIED');
      }

      if (!isAdmin && !isOwner && !isUploader) {
        return errorResponse(
          res,
          'Access denied - only admin or the uploader can delete this file',
          403,
          'ACCESS_DENIED'
        );
      }

      // Delete from database
      await db.run('DELETE FROM files WHERE id = ?', [fileId]);

      // Validate path before deletion to prevent path traversal attacks
      const deleteFilePathStr = getString(file, 'file_path');
      if (isPathSafe(deleteFilePathStr)) {
        // Try to delete the physical file - use resolveFilePath for consistency
        const filePath = resolveFilePath(deleteFilePathStr);
        if (existsSync(filePath)) {
          const fs = await import('fs/promises');
          await fs.unlink(filePath);
        }
      } else {
        await logger.error('Path traversal attempt detected during delete:', { error: new Error('Path traversal'), category: 'UPLOAD', metadata: { filePath: file.file_path } });
      }

      sendSuccess(res, undefined, 'File deleted successfully');
    } catch (dbError) {
      await logger.error('Failed to delete file:', { error: dbError instanceof Error ? dbError : undefined, category: 'UPLOAD' });
      return errorResponse(res, 'Failed to delete file', 500, 'DB_ERROR');
    }
  })
);

/**
 * @swagger
 * /api/uploads/test:
 *   get:
 *     tags:
 *       - Uploads
 *     summary: Test upload system
 *     responses:
 *       200:
 *         description: Upload system is working
 */
router.get('/test', (req: express.Request, res: express.Response) => {
  sendSuccess(res, {
    timestamp: new Date().toISOString(),
    uploadDir: uploadDir,
    limits: {
      fileSize: '10MB',
      maxFiles: 5
    },
    allowedTypes: [
      'Images: jpg, jpeg, png, gif, webp',
      'Documents: pdf, doc, docx, txt, md',
      'Spreadsheets: xls, xlsx, csv',
      'Presentations: ppt, pptx',
      'Archives: zip, rar, tar, gz',
      'Code: js, ts, html, css, json, xml'
    ]
  }, 'Upload system is operational');
});

// =====================================================
// DELIVERABLE WORKFLOW ENDPOINTS
// =====================================================

import { fileService } from '../services/file-service.js';

/**
 * @swagger
 * /api/uploads/deliverables/project/{projectId}:
 *   get:
 *     tags:
 *       - Deliverables
 *     summary: Get all deliverables for a project with workflow status
 */
router.get(
  '/deliverables/project/:projectId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId);
    const status = req.query.status as string | undefined;

    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_PROJECT_ID');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const deliverables = await fileService.getProjectDeliverables(projectId, status);
    const stats = await fileService.getDeliverableStats(projectId);

    sendSuccess(res, { deliverables, stats });
  })
);

/**
 * @swagger
 * /api/uploads/deliverables/pending:
 *   get:
 *     tags:
 *       - Deliverables
 *     summary: Get all deliverables pending review (admin)
 */
router.get(
  '/deliverables/pending',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user?.type !== 'admin') {
      return errorResponse(res, 'Admin access required', 403, 'ACCESS_DENIED');
    }

    const deliverables = await fileService.getPendingReviewDeliverables();
    sendSuccess(res, { deliverables });
  })
);

/**
 * @swagger
 * /api/uploads/deliverables/{fileId}/workflow:
 *   get:
 *     tags:
 *       - Deliverables
 *     summary: Get workflow status for a deliverable
 */
router.get(
  '/deliverables/:fileId/workflow',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.fileId);

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_FILE_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const workflow = await fileService.getDeliverableWorkflow(fileId);
    const comments = await fileService.getReviewComments(fileId);
    const history = await fileService.getDeliverableHistory(fileId);

    sendSuccess(res, { workflow, comments, history });
  })
);

/**
 * @swagger
 * /api/uploads/deliverables/{fileId}/submit:
 *   post:
 *     tags:
 *       - Deliverables
 *     summary: Submit deliverable for review
 */
router.post(
  '/deliverables/:fileId/submit',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.fileId);
    const { notes } = req.body;

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_FILE_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const submittedBy = req.user?.email || 'unknown';
    const workflow = await fileService.submitForReview(fileId, submittedBy, notes);

    sendSuccess(res, { workflow }, 'Deliverable submitted for review');
  })
);

/**
 * @swagger
 * /api/uploads/deliverables/{fileId}/start-review:
 *   post:
 *     tags:
 *       - Deliverables
 *     summary: Start reviewing a deliverable (admin)
 */
router.post(
  '/deliverables/:fileId/start-review',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user?.type !== 'admin') {
      return errorResponse(res, 'Admin access required', 403, 'ACCESS_DENIED');
    }

    const fileId = parseInt(req.params.fileId);

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_FILE_ID');
    }

    const reviewerEmail = req.user?.email || 'admin';
    const workflow = await fileService.startReview(fileId, reviewerEmail);

    sendSuccess(res, { workflow }, 'Review started');
  })
);

/**
 * @swagger
 * /api/uploads/deliverables/{fileId}/request-changes:
 *   post:
 *     tags:
 *       - Deliverables
 *     summary: Request changes to a deliverable (admin)
 */
router.post(
  '/deliverables/:fileId/request-changes',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user?.type !== 'admin') {
      return errorResponse(res, 'Admin access required', 403, 'ACCESS_DENIED');
    }

    const fileId = parseInt(req.params.fileId);
    const { feedback } = req.body;

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_FILE_ID');
    }

    if (!feedback) {
      return errorResponse(res, 'Feedback is required when requesting changes', 400, 'VALIDATION_ERROR');
    }

    const reviewerEmail = req.user?.email || 'admin';
    const workflow = await fileService.requestChanges(fileId, reviewerEmail, feedback);

    sendSuccess(res, { workflow }, 'Changes requested');
  })
);

/**
 * @swagger
 * /api/uploads/deliverables/{fileId}/approve:
 *   post:
 *     tags:
 *       - Deliverables
 *     summary: Approve a deliverable (admin)
 */
router.post(
  '/deliverables/:fileId/approve',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user?.type !== 'admin') {
      return errorResponse(res, 'Admin access required', 403, 'ACCESS_DENIED');
    }

    const fileId = parseInt(req.params.fileId);
    const { comment } = req.body;

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_FILE_ID');
    }

    const approverEmail = req.user?.email || 'admin';
    const workflow = await fileService.approveDeliverable(fileId, approverEmail, comment);

    sendSuccess(res, { workflow }, 'Deliverable approved');
  })
);

/**
 * @swagger
 * /api/uploads/deliverables/{fileId}/reject:
 *   post:
 *     tags:
 *       - Deliverables
 *     summary: Reject a deliverable (admin)
 */
router.post(
  '/deliverables/:fileId/reject',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user?.type !== 'admin') {
      return errorResponse(res, 'Admin access required', 403, 'ACCESS_DENIED');
    }

    const fileId = parseInt(req.params.fileId);
    const { reason } = req.body;

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_FILE_ID');
    }

    if (!reason) {
      return errorResponse(res, 'Reason is required when rejecting', 400, 'VALIDATION_ERROR');
    }

    const reviewerEmail = req.user?.email || 'admin';
    const workflow = await fileService.rejectDeliverable(fileId, reviewerEmail, reason);

    sendSuccess(res, { workflow }, 'Deliverable rejected');
  })
);

/**
 * @swagger
 * /api/uploads/deliverables/{fileId}/resubmit:
 *   post:
 *     tags:
 *       - Deliverables
 *     summary: Resubmit deliverable after changes
 */
router.post(
  '/deliverables/:fileId/resubmit',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.fileId);
    const { notes } = req.body;

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_FILE_ID');
    }

    const submittedBy = req.user?.email || 'unknown';
    const workflow = await fileService.resubmitDeliverable(fileId, submittedBy, notes);

    sendSuccess(res, { workflow }, 'Deliverable resubmitted for review');
  })
);

/**
 * @swagger
 * /api/uploads/deliverables/{fileId}/comments:
 *   post:
 *     tags:
 *       - Deliverables
 *     summary: Add a comment to deliverable review
 */
router.post(
  '/deliverables/:fileId/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.fileId);
    const { comment } = req.body;

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_FILE_ID');
    }

    if (!comment) {
      return errorResponse(res, 'Comment is required', 400, 'VALIDATION_ERROR');
    }

    const workflow = await fileService.getDeliverableWorkflow(fileId);
    if (!workflow) {
      return errorResponse(res, 'Deliverable workflow not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const authorEmail = req.user?.email || 'unknown';
    const authorType = req.user?.type === 'admin' ? 'admin' : 'client';
    const newComment = await fileService.addReviewComment(
      workflow.id,
      authorEmail,
      authorType as 'admin' | 'client',
      comment,
      'feedback'
    );

    sendSuccess(res, { comment: newComment }, 'Comment added');
  })
);

// ===================================
// FILE SHARING ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/uploads/{id}/share:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: Share a file with the client (admin only)
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/:id/share',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.id);

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_FILE_ID');
    }

    const db = getDatabase();

    // Verify file exists
    const file = await db.get('SELECT id, project_id FROM files WHERE id = ?', [fileId]);
    if (!file) {
      return errorResponse(res, 'File not found', 404, 'FILE_NOT_FOUND');
    }

    // Share the file with the client
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

/**
 * @swagger
 * /api/uploads/{id}/unshare:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: Revoke client access to a file (admin only)
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/:id/unshare',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.id);

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_FILE_ID');
    }

    const db = getDatabase();

    // Verify file exists
    const file = await db.get('SELECT id FROM files WHERE id = ?', [fileId]);
    if (!file) {
      return errorResponse(res, 'File not found', 404, 'FILE_NOT_FOUND');
    }

    // Revoke client access
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

// Error handler for multer
router.use(
  (error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return errorResponseWithPayload(
          res,
          'File too large',
          400,
          'FILE_TOO_LARGE',
          { message: 'File size cannot exceed 10MB' }
        );
      }

      if (error.code === 'LIMIT_FILE_COUNT') {
        return errorResponseWithPayload(
          res,
          'Too many files',
          400,
          'TOO_MANY_FILES',
          { message: 'Cannot upload more than 5 files at once' }
        );
      }

      return errorResponseWithPayload(
        res,
        'Upload error',
        400,
        'UPLOAD_ERROR',
        { message: error.message }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('File type not allowed')) {
      return errorResponseWithPayload(
        res,
        'File type not allowed',
        400,
        'INVALID_FILE_TYPE',
        { message: errorMessage }
      );
    }

    next(error);
  }
);

export { router as uploadsRouter };
export default router;
