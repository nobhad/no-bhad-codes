/**
 * ===============================================
 * UPLOAD ROUTES — CORE
 * ===============================================
 * File upload, retrieval, download, delete, and test endpoints.
 */

import express, { Router } from 'express';
import { existsSync } from 'fs';
import { logger } from '../../services/logger.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { getString } from '../../database/row-helpers.js';
import {
  errorResponse,
  sendSuccess,
  sendCreated,
  ErrorCodes
} from '../../utils/api-response.js';
import { softDeleteService } from '../../services/soft-delete-service.js';
import { uploadService } from '../../services/upload-service.js';
import {
  FileRow,
  ProjectRow,
  upload,
  uploadDir,
  isPathSafe,
  resolveFilePath
} from './shared.js';

const router = Router();

// ============================================
// Upload Endpoints
// ============================================

router.post(
  '/single',
  authenticateToken,
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (!req.file) {
      return errorResponse(res, 'No file uploaded', 400, ErrorCodes.NO_FILE);
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

router.post(
  '/multiple',
  authenticateToken,
  upload.array('files', 5),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return errorResponse(res, 'No files uploaded', 400, ErrorCodes.NO_FILES);
    }

    const uploadedFiles = [];

    let defaultProjectId: number | null = null;
    if (req.user?.type !== 'admin' && req.user?.id) {
      defaultProjectId = await uploadService.findDefaultProjectForClient(req.user.id);
    }

    for (const file of req.files as Express.Multer.File[]) {
      const subDir = file.destination.includes('projects')
        ? 'projects'
        : file.destination.includes('avatars')
          ? 'avatars'
          : file.destination.includes('invoices')
            ? 'invoices'
            : file.destination.includes('messages')
              ? 'messages'
              : 'general';
      const filePath = `uploads/${subDir}/${file.filename}`;

      const fileId = await uploadService.insertFileRecord({
        projectId: defaultProjectId,
        filename: file.filename,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath,
        uploadedBy: req.user?.email || `${req.user?.type || 'unknown'}`
      });

      uploadedFiles.push({
        id: fileId,
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

    sendCreated(
      res,
      { files: uploadedFiles },
      `${uploadedFiles.length} files uploaded successfully`
    );
  })
);

router.post(
  '/avatar',
  authenticateToken,
  upload.single('avatar'),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (!req.file) {
      return errorResponse(res, 'No avatar file uploaded', 400, ErrorCodes.NO_AVATAR);
    }

    if (!req.file.mimetype.startsWith('image/')) {
      return errorResponse(res, 'Avatar must be an image file', 400, ErrorCodes.INVALID_AVATAR_TYPE);
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

    if (req.user?.id) {
      try {
        await uploadService.updateClientAvatar(req.user.id, avatarInfo.url);
      } catch (dbError) {
        await logger.error('Failed to update avatar in database:', {
          error: dbError instanceof Error ? dbError : undefined,
          category: 'UPLOAD'
        });
      }
    }

    sendCreated(res, { avatar: avatarInfo }, 'Avatar uploaded successfully');
  })
);

router.post(
  '/project/:projectId',
  authenticateToken,
  upload.single('project_file'),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_PROJECT_ID);
    }

    if (!req.file) {
      return errorResponse(res, 'No project file uploaded', 400, ErrorCodes.NO_PROJECT_FILE);
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

    let fileId: number | undefined;
    try {
      fileId = await uploadService.insertFileRecord({
        projectId,
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: projectFile.url,
        uploadedBy: req.user?.email || `${req.user?.type || 'unknown'}`
      });
    } catch (dbError) {
      await logger.error('Failed to save file info to database:', {
        error: dbError instanceof Error ? dbError : undefined,
        category: 'UPLOAD'
      });
    }

    sendCreated(
      res,
      { file: { ...projectFile, id: fileId ?? projectFile.id } },
      'Project file uploaded successfully'
    );
  })
);

// ============================================
// Retrieval Endpoints
// ============================================

router.get(
  '/project/:projectId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_PROJECT_ID);
    }

    try {
      const files = await uploadService.getFilesByProject(projectId);

      sendSuccess(res, {
        files: files.map((file) => ({
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
      await logger.error('Failed to fetch files:', {
        error: dbError instanceof Error ? dbError : undefined,
        category: 'UPLOAD'
      });
      return errorResponse(res, 'Failed to fetch files', 500, ErrorCodes.DB_ERROR);
    }
  })
);

router.get(
  '/client',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.NOT_AUTHENTICATED);
    }

    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
    const fileType = req.query.fileType as string | undefined;
    const category = req.query.category as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    try {
      const { files, projects } = await uploadService.getClientFiles(clientId, {
        projectId,
        fileType,
        category,
        dateFrom,
        dateTo
      });

      sendSuccess(res, {
        files: (files as FileRow[]).map((file) => ({
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
        projects: (projects as ProjectRow[]).map((p) => ({
          id: p.id,
          name: p.project_name
        }))
      });
    } catch (dbError) {
      await logger.error('Failed to fetch client files:', {
        error: dbError instanceof Error ? dbError : undefined,
        category: 'UPLOAD'
      });
      return errorResponse(res, 'Failed to fetch files', 500, ErrorCodes.DB_ERROR);
    }
  })
);

router.get(
  '/file/:fileId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.fileId, 10);

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_FILE_ID);
    }

    try {
      const file = await uploadService.getFileWithClient(fileId);

      if (!file) {
        return errorResponse(res, 'File not found', 404, ErrorCodes.FILE_NOT_FOUND);
      }

      const userId = req.user?.id;
      const userEmail = req.user?.email;
      const isAdmin = req.user?.type === 'admin';
      const isUploader = file.uploaded_by === userEmail || file.uploaded_by === String(userId);
      const isSharedWithClient = file.client_id === userId && file.shared_with_client === 1;

      if (!isAdmin && !isUploader && !isSharedWithClient) {
        return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
      }

      // Intake files: redirect to PDF generation endpoint
      if (getString(file, 'category') === 'intake' && file.project_id) {
        return res.redirect(`/api/projects/${file.project_id}/intake/pdf`);
      }

      const filePathStr = getString(file, 'file_path');
      if (!isPathSafe(filePathStr)) {
        await logger.error('Path traversal attempt detected:', {
          error: new Error('Path traversal'),
          category: 'UPLOAD',
          metadata: { filePath: filePathStr }
        });
        return errorResponse(res, 'Invalid file path', 403, ErrorCodes.PATH_TRAVERSAL_DETECTED);
      }

      const filePath = resolveFilePath(filePathStr);

      if (!existsSync(filePath)) {
        return errorResponse(res, 'File not found on disk', 404, ErrorCodes.FILE_MISSING);
      }

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
      await logger.error('Failed to fetch file:', {
        error: dbError instanceof Error ? dbError : undefined,
        category: 'UPLOAD'
      });
      return errorResponse(res, 'Failed to fetch file', 500, ErrorCodes.DB_ERROR);
    }
  })
);

// ============================================
// Delete Endpoint
// ============================================

router.delete(
  '/file/:fileId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.fileId, 10);

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_FILE_ID);
    }

    try {
      const file = await uploadService.getFileWithClient(fileId);

      if (!file) {
        return errorResponse(res, 'File not found', 404, ErrorCodes.FILE_NOT_FOUND);
      }

      const userId = req.user?.id;
      const userEmail = req.user?.email;
      const isAdmin = req.user?.type === 'admin';
      const isUploader = file.uploaded_by === userEmail || file.uploaded_by === String(userId);
      const isOwner = file.client_id === userId;

      if (!isAdmin && file.client_id && !isOwner) {
        return errorResponse(
          res,
          'Access denied - this file belongs to another client',
          403,
          ErrorCodes.ACCESS_DENIED
        );
      }

      if (!isAdmin && !isOwner && !isUploader) {
        return errorResponse(
          res,
          'Access denied - only admin or the uploader can delete this file',
          403,
          ErrorCodes.ACCESS_DENIED
        );
      }

      const deletedBy = userEmail || 'unknown';
      await softDeleteService.softDelete('file', fileId, deletedBy);

      sendSuccess(res, undefined, 'File deleted successfully');
    } catch (dbError) {
      await logger.error('Failed to delete file:', {
        error: dbError instanceof Error ? dbError : undefined,
        category: 'UPLOAD'
      });
      return errorResponse(res, 'Failed to delete file', 500, ErrorCodes.DB_ERROR);
    }
  })
);

// ============================================
// Test Endpoint
// ============================================

router.get('/test', (req: express.Request, res: express.Response) => {
  sendSuccess(
    res,
    {
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
    },
    'Upload system is operational'
  );
});

export default router;
