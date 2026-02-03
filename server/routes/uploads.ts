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
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getDatabase } from '../database/init.js';
import { getUploadsDir, getUploadsSubdir, UPLOAD_DIRS, sanitizeFilename } from '../config/uploads.js';
import { getString, getNumber } from '../database/row-helpers.js';

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
  const isAllowed = Object.values(allowedTypes).some((regex) => regex.test(fileName));

  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${extname(file.originalname)}`));
  }
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
      return res.status(400).json({
        error: 'No file uploaded',
        code: 'NO_FILE'
      });
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

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      file: fileInfo
    });
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
      return res.status(400).json({
        error: 'No files uploaded',
        code: 'NO_FILES'
      });
    }

    const files = (req.files as Express.Multer.File[]).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      url: `/uploads/${file.filename}`,
      uploadedBy: req.user?.id,
      uploadedAt: new Date().toISOString()
    }));

    res.status(201).json({
      success: true,
      message: `${files.length} files uploaded successfully`,
      files
    });
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
      return res.status(400).json({
        error: 'No avatar file uploaded',
        code: 'NO_AVATAR'
      });
    }

    // Validate that it's an image
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        error: 'Avatar must be an image file',
        code: 'INVALID_AVATAR_TYPE'
      });
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

    // Update user avatar URL in database
    if (req.user?.id) {
      try {
        const db = await getDatabase();
        await db.run(
          'UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [avatarInfo.url, req.user.id]
        );
      } catch (dbError) {
        console.error('Failed to update avatar in database:', dbError);
        // Non-blocking - file is already uploaded
      }
    }

    res.status(201).json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar: avatarInfo
    });
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
      return res.status(400).json({
        error: 'Invalid project ID',
        code: 'INVALID_PROJECT_ID'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No project file uploaded',
        code: 'NO_PROJECT_FILE'
      });
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
      console.error('Failed to save file info to database:', dbError);
      // Non-blocking - file is already uploaded
    }

    res.status(201).json({
      success: true,
      message: 'Project file uploaded successfully',
      file: { ...projectFile, id: fileId ?? projectFile.id }
    });
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
      return res.status(400).json({
        error: 'Invalid project ID',
        code: 'INVALID_PROJECT_ID'
      });
    }

    try {
      const db = await getDatabase();
      const files = await db.all(
        `SELECT id, project_id, filename, original_filename, mime_type, file_size, file_path, uploaded_by, created_at, description
         FROM files
         WHERE project_id = ?
         ORDER BY created_at DESC`,
        [projectId]
      );

      res.json({
        success: true,
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
          description: file.description
        }))
      });
    } catch (dbError) {
      console.error('Failed to fetch files:', dbError);
      return res.status(500).json({
        error: 'Failed to fetch files',
        code: 'DB_ERROR'
      });
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
      return res.status(401).json({
        error: 'Not authenticated',
        code: 'NOT_AUTHENTICATED'
      });
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
      let query = `
        SELECT f.id, f.project_id, f.filename, f.original_filename, f.mime_type, f.file_size,
               f.file_path, f.uploaded_by, f.created_at, f.file_type, f.category,
               p.name as project_name
        FROM files f
        LEFT JOIN projects p ON f.project_id = p.id
        WHERE (p.client_id = ? OR f.uploaded_by = ?)
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
        `SELECT DISTINCT p.id, p.name
         FROM projects p
         WHERE p.client_id = ?
         ORDER BY p.name`,
        [clientId]
      );

      res.json({
        success: true,
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
          category: file.category
        })),
        projects: projects.map((p: any) => ({
          id: p.id,
          name: p.name
        }))
      });
    } catch (dbError) {
      console.error('Failed to fetch client files:', dbError);
      return res.status(500).json({
        error: 'Failed to fetch files',
        code: 'DB_ERROR'
      });
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
      return res.status(400).json({
        error: 'Invalid file ID',
        code: 'INVALID_FILE_ID'
      });
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
        return res.status(404).json({
          error: 'File not found',
          code: 'FILE_NOT_FOUND'
        });
      }

      // Check access: admin, client owns the project, or uploaded the file
      const userId = req.user?.id;
      const isAdmin = req.user?.type === 'admin';
      const isOwner = file.client_id === userId;
      const isUploader = file.uploaded_by === userId || file.uploaded_by === String(userId);

      if (!isAdmin && !isOwner && !isUploader) {
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      // Validate path to prevent path traversal attacks
      const filePathStr = getString(file, 'file_path');
      if (!isPathSafe(filePathStr)) {
        console.error('Path traversal attempt detected:', filePathStr);
        return res.status(403).json({
          error: 'Invalid file path',
          code: 'PATH_TRAVERSAL_DETECTED'
        });
      }

      // Construct the full file path using centralized uploads directory
      const filePath = resolveFilePath(filePathStr);

      if (!existsSync(filePath)) {
        return res.status(404).json({
          error: 'File not found on disk',
          code: 'FILE_MISSING'
        });
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
      return res.status(500).json({
        error: 'Failed to fetch file',
        code: 'DB_ERROR'
      });
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
      return res.status(400).json({
        error: 'Invalid file ID',
        code: 'INVALID_FILE_ID'
      });
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
        return res.status(404).json({
          error: 'File not found',
          code: 'FILE_NOT_FOUND'
        });
      }

      // Check access: admin or uploader can delete
      const userId = req.user?.id;
      const isAdmin = req.user?.type === 'admin';
      const isUploader = file.uploaded_by === userId || file.uploaded_by === String(userId);

      if (!isAdmin && !isUploader) {
        return res.status(403).json({
          error: 'Access denied - only admin or the uploader can delete this file',
          code: 'ACCESS_DENIED'
        });
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
        console.error('Path traversal attempt detected during delete:', file.file_path);
      }

      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (dbError) {
      console.error('Failed to delete file:', dbError);
      return res.status(500).json({
        error: 'Failed to delete file',
        code: 'DB_ERROR'
      });
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
  res.json({
    success: true,
    message: 'Upload system is operational',
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
  });
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
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const deliverables = await fileService.getProjectDeliverables(projectId, status);
    const stats = await fileService.getDeliverableStats(projectId);

    res.json({ deliverables, stats });
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
      return res.status(403).json({ error: 'Admin access required' });
    }

    const deliverables = await fileService.getPendingReviewDeliverables();
    res.json({ deliverables });
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
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const workflow = await fileService.getDeliverableWorkflow(fileId);
    const comments = await fileService.getReviewComments(fileId);
    const history = await fileService.getDeliverableHistory(fileId);

    res.json({ workflow, comments, history });
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
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const submittedBy = req.user?.email || 'unknown';
    const workflow = await fileService.submitForReview(fileId, submittedBy, notes);

    res.json({
      success: true,
      message: 'Deliverable submitted for review',
      workflow
    });
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
      return res.status(403).json({ error: 'Admin access required' });
    }

    const fileId = parseInt(req.params.fileId);

    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const reviewerEmail = req.user?.email || 'admin';
    const workflow = await fileService.startReview(fileId, reviewerEmail);

    res.json({
      success: true,
      message: 'Review started',
      workflow
    });
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
      return res.status(403).json({ error: 'Admin access required' });
    }

    const fileId = parseInt(req.params.fileId);
    const { feedback } = req.body;

    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    if (!feedback) {
      return res.status(400).json({ error: 'Feedback is required when requesting changes' });
    }

    const reviewerEmail = req.user?.email || 'admin';
    const workflow = await fileService.requestChanges(fileId, reviewerEmail, feedback);

    res.json({
      success: true,
      message: 'Changes requested',
      workflow
    });
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
      return res.status(403).json({ error: 'Admin access required' });
    }

    const fileId = parseInt(req.params.fileId);
    const { comment } = req.body;

    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const approverEmail = req.user?.email || 'admin';
    const workflow = await fileService.approveDeliverable(fileId, approverEmail, comment);

    res.json({
      success: true,
      message: 'Deliverable approved',
      workflow
    });
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
      return res.status(403).json({ error: 'Admin access required' });
    }

    const fileId = parseInt(req.params.fileId);
    const { reason } = req.body;

    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Reason is required when rejecting' });
    }

    const reviewerEmail = req.user?.email || 'admin';
    const workflow = await fileService.rejectDeliverable(fileId, reviewerEmail, reason);

    res.json({
      success: true,
      message: 'Deliverable rejected',
      workflow
    });
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
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const submittedBy = req.user?.email || 'unknown';
    const workflow = await fileService.resubmitDeliverable(fileId, submittedBy, notes);

    res.json({
      success: true,
      message: 'Deliverable resubmitted for review',
      workflow
    });
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
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const workflow = await fileService.getDeliverableWorkflow(fileId);
    if (!workflow) {
      return res.status(404).json({ error: 'Deliverable workflow not found' });
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

    res.json({
      success: true,
      message: 'Comment added',
      comment: newComment
    });
  })
);

// Error handler for multer
router.use(
  (error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large',
          code: 'FILE_TOO_LARGE',
          message: 'File size cannot exceed 10MB'
        });
      }

      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          error: 'Too many files',
          code: 'TOO_MANY_FILES',
          message: 'Cannot upload more than 5 files at once'
        });
      }

      return res.status(400).json({
        error: 'Upload error',
        code: 'UPLOAD_ERROR',
        message: error.message
      });
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('File type not allowed')) {
      return res.status(400).json({
        error: 'File type not allowed',
        code: 'INVALID_FILE_TYPE',
        message: errorMessage
      });
    }

    next(error);
  }
);

export { router as uploadsRouter };
export default router;
