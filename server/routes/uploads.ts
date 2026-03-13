/**
 * ===============================================
 * UPLOAD ROUTES — BARREL
 * ===============================================
 * Composes sub-routers for file upload endpoints.
 *
 * Sub-modules:
 *   uploads/shared.ts               — Types, validation schemas, multer config, helpers
 *   uploads/core.ts                 — Upload, retrieval, download, delete, test
 *   uploads/deliverable-workflow.ts — Deliverable review workflow
 *   uploads/sharing.ts              — Admin file sharing with clients
 */

import express from 'express';
import multer from 'multer';
import {
  errorResponseWithPayload,
  sanitizeErrorMessage,
  ErrorCodes
} from '../utils/api-response.js';
import coreRouter from './uploads/core.js';
import deliverableWorkflowRouter from './uploads/deliverable-workflow.js';
import sharingRouter from './uploads/sharing.js';

const router = express.Router();

router.use(coreRouter);
router.use(deliverableWorkflowRouter);
router.use(sharingRouter);

// Multer error handler (must be after all sub-routers that use multer)
router.use(
  (error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      const multerError = error as multer.MulterError;
      if (multerError.code === 'LIMIT_FILE_SIZE') {
        return errorResponseWithPayload(res, 'File too large', 400, ErrorCodes.FILE_TOO_LARGE, {
          message: 'File size cannot exceed 10MB'
        });
      }

      if (multerError.code === 'LIMIT_FILE_COUNT') {
        return errorResponseWithPayload(res, 'Too many files', 400, ErrorCodes.TOO_MANY_FILES, {
          message: 'Cannot upload more than 5 files at once'
        });
      }

      return errorResponseWithPayload(res, 'Upload error', 400, ErrorCodes.UPLOAD_ERROR, {
        message: multerError.message
      });
    }

    const rawMessage = error instanceof Error ? error.message : '';
    if (rawMessage.includes('File type not allowed')) {
      return errorResponseWithPayload(res, 'File type not allowed', 400, ErrorCodes.INVALID_FILE_TYPE, {
        message: sanitizeErrorMessage(error, 'File type not allowed')
      });
    }

    next(error);
  }
);

export { router as uploadsRouter };
export default router;
