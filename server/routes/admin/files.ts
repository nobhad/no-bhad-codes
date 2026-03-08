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
import { getDatabase } from '../../database/init.js';
import { softDeleteService } from '../../services/soft-delete-service.js';

const FILE_COLUMNS = `
  id, project_id, filename, original_filename, file_path, file_size, mime_type,
  file_type, description, uploaded_by, created_at, folder_id, category
`.replace(/\s+/g, ' ').trim();

const router = express.Router();

/**
 * GET /api/admin/files - List all files
 */
router.get(
  '/files',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();
    const { projectId, type } = req.query;

    let query = `
      SELECT
        f.id,
        f.filename,
        f.original_filename as originalFilename,
        f.file_path as filePath,
        f.file_size as fileSize,
        f.mime_type as mimeType,
        f.file_type as fileType,
        f.description,
        f.uploaded_by as uploadedBy,
        f.project_id as projectId,
        f.created_at as createdAt,
        f.shared_with_client as sharedWithClient,
        f.shared_at as sharedAt,
        f.shared_by as sharedBy,
        p.project_name as projectName,
        p.client_id as clientId,
        c.company_name as clientName
      FROM files f
      LEFT JOIN projects p ON f.project_id = p.id
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE f.deleted_at IS NULL
    `;
    const params: (string | number)[] = [];

    if (projectId) {
      query += ' AND f.project_id = ?';
      params.push(parseInt(projectId as string, 10));
    }
    if (type) {
      query += ' AND f.file_type = ?';
      params.push(type as string);
    }

    query += ' ORDER BY f.created_at DESC';

    const files = await db.all(query, params);

    const stats = {
      total: files.length,
      totalSize: files.reduce((sum: number, f: { fileSize: number }) => sum + (f.fileSize || 0), 0)
    };

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

    const db = getDatabase();

    const file = await db.get(`SELECT ${FILE_COLUMNS} FROM files WHERE id = ? AND deleted_at IS NULL`, [fileId]);
    if (!file) {
      return errorResponse(res, 'File not found', 404, ErrorCodes.NOT_FOUND);
    }

    const adminEmail = req.user?.email || 'admin';
    await softDeleteService.softDelete('file', fileId, adminEmail);

    sendSuccess(res, undefined, 'File deleted');
  })
);

export default router;
