/**
 * ===============================================
 * MESSAGE ADMIN & ATTACHMENT ROUTES
 * ===============================================
 * @file server/routes/messages/admin.ts
 *
 * Admin-specific endpoints (analytics) and attachment download
 */

import express from 'express';
import path from 'path';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { cache } from '../../middleware/cache.js';
import { messageService } from '../../services/message-service.js';
import { getUploadsSubdir, UPLOAD_DIRS } from '../../config/uploads.js';
import { ErrorCodes, errorResponse, sendSuccess } from '../../utils/api-response.js';

const router = express.Router();

// ===================================
// ADMIN ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/messages/analytics:
 *   get:
 *     tags: [Messages]
 *     summary: Get message analytics (admin only)
 *     description: Get message analytics (admin only).
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/analytics',
  authenticateToken,
  requireAdmin,
  cache({ ttl: 300, tags: ['analytics'] }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const analytics = await messageService.getMessageAnalytics();
    const recentActivity = await messageService.getRecentMessageActivity();

    sendSuccess(res, { analytics, recentActivity });
  })
);

// ===================================
// ATTACHMENT DOWNLOAD
// ===================================

/**
 * @swagger
 * /api/messages/attachments/{filename}/download:
 *   get:
 *     tags: [Messages]
 *     summary: Download a message attachment
 *     description: Download a message attachment.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/attachments/:filename/download',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { filename } = req.params;

    // Security: Validate filename to prevent path traversal
    // Check for encoded path traversal attempts as well
    const decodedFilename = decodeURIComponent(filename);
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      decodedFilename.includes('..') ||
      decodedFilename.includes('/') ||
      decodedFilename.includes('\\')
    ) {
      return errorResponse(res, 'Invalid filename', 400, ErrorCodes.INVALID_FILENAME);
    }

    // Escape special characters in filename for LIKE pattern to prevent SQL injection
    // LIKE special chars: % (wildcard), _ (single char), \ (escape), " (JSON delimiter)
    const escapedFilename = filename
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/%/g, '\\%')    // Escape percent
      .replace(/_/g, '\\_')    // Escape underscore
      .replace(/"/g, '\\"');   // Escape quotes for JSON matching

    // First, find the message containing this attachment and verify access
    // Use exact JSON match to prevent substring attacks
    const message = await messageService.findMessageByAttachmentFilename(
      escapedFilename,
      req.user!.type as 'admin' | 'client',
      req.user!.id
    );

    if (!message) {
      // Return 404 for both "not found" and "no access" to prevent enumeration
      return errorResponse(res, 'File not found', 404, ErrorCodes.FILE_NOT_FOUND);
    }

    const filePath = path.join(getUploadsSubdir(UPLOAD_DIRS.MESSAGES), filename);

    // Check if file exists
    const fs = await import('fs/promises');
    try {
      await fs.access(filePath);
    } catch {
      return errorResponse(res, 'File not found', 404, ErrorCodes.FILE_NOT_FOUND);
    }

    let originalName = filename;
    if (message.attachments) {
      try {
        const attachments = JSON.parse(message.attachments as string);
        const attachment = attachments.find((a: { filename: string }) => a.filename === filename);
        if (attachment?.originalName) {
          originalName = attachment.originalName;
        }
      } catch {
        // Use filename as fallback
      }
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    res.sendFile(filePath);
  })
);

export { router as adminRouter };
export default router;
