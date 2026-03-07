import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessFile } from '../../middleware/access-control.js';
import { fileService } from '../../services/file-service.js';
import { upload } from './uploads.js';
import { errorResponse, sendSuccess, sendCreated } from '../../utils/api-response.js';

const router = express.Router();

// Get versions of a file
router.get(
  '/files/:fileId/versions',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const versions = await fileService.getVersions(fileId);
    sendSuccess(res, { versions });
  })
);

// Upload new version
router.post(
  '/files/:fileId/versions',
  authenticateToken,
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    const file = req.file;

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    if (!file) {
      return errorResponse(res, 'No file uploaded', 400, 'NO_FILE');
    }

    const { comment } = req.body;
    const version = await fileService.uploadNewVersion(fileId, {
      filename: file.filename,
      original_filename: file.originalname,
      file_path: file.path,
      file_size: file.size,
      mime_type: file.mimetype,
      uploaded_by: req.user!.email,
      comment
    });

    sendCreated(res, { version });
  })
);

// Restore a previous version
router.post(
  '/files/:fileId/versions/:versionId/restore',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    const versionId = parseInt(req.params.versionId, 10);
    if (isNaN(fileId) || fileId <= 0 || isNaN(versionId) || versionId <= 0) {
      return errorResponse(res, 'Invalid file or version ID', 400, 'VALIDATION_ERROR');
    }
    const version = await fileService.restoreVersion(fileId, versionId);
    sendSuccess(res, { version }, 'Version restored');
  })
);

export { router as fileVersionsRouter };
export default router;
