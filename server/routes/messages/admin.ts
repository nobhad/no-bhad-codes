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
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { cache } from '../../middleware/cache.js';
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
    const db = getDatabase();

    const analytics = await db.get(`
    SELECT
      COUNT(DISTINCT mt.id) as total_threads,
      COUNT(DISTINCT CASE WHEN mt.status = 'active' THEN mt.id END) as active_threads,
      COUNT(m.id) as total_messages,
      COUNT(CASE WHEN m.read_at IS NULL THEN m.id END) as unread_messages,
      COUNT(CASE WHEN m.sender_type = 'client' THEN m.id END) as client_messages,
      COUNT(CASE WHEN m.sender_type = 'admin' THEN m.id END) as admin_messages,
      COUNT(CASE WHEN m.message_type = 'inquiry' THEN m.id END) as inquiries,
      COUNT(CASE WHEN m.priority = 'urgent' THEN m.id END) as urgent_messages
    FROM active_message_threads mt
    LEFT JOIN active_messages m ON mt.id = m.thread_id AND m.context_type = 'general'
  `);

    const recentActivity = await db.all(`
    SELECT
      mt.subject,
      mt.thread_type,
      mt.priority,
      mt.last_message_at,
      mt.last_message_by,
      c.company_name,
      c.contact_name
    FROM active_message_threads mt
    JOIN active_clients c ON mt.client_id = c.id
    ORDER BY mt.last_message_at DESC
    LIMIT 10
  `);

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

    const db = getDatabase();

    // Escape special characters in filename for LIKE pattern to prevent SQL injection
    // LIKE special chars: % (wildcard), _ (single char), \ (escape), " (JSON delimiter)
    const escapedFilename = filename
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/%/g, '\\%')    // Escape percent
      .replace(/_/g, '\\_')    // Escape underscore
      .replace(/"/g, '\\"');   // Escape quotes for JSON matching

    // First, find the message containing this attachment and verify access
    // Use exact JSON match to prevent substring attacks
    const messageQuery = req.user!.type === 'admin'
      ? 'SELECT m.id, m.attachments, m.thread_id FROM active_messages m WHERE m.attachments LIKE ? ESCAPE \'\\\''
      : `SELECT m.id, m.attachments, m.thread_id FROM active_messages m
         JOIN active_message_threads mt ON m.thread_id = mt.id
         WHERE m.attachments LIKE ? ESCAPE '\\' AND mt.client_id = ?`;

    const params = req.user!.type === 'admin'
      ? [`%"filename":"${escapedFilename}"%`]
      : [`%"filename":"${escapedFilename}"%`, req.user!.id];

    const message = await db.get(messageQuery, params);

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
