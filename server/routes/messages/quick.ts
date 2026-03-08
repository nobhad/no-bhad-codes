/**
 * ===============================================
 * QUICK MESSAGE & NOTIFICATION ROUTES
 * ===============================================
 * @file server/routes/messages/quick.ts
 *
 * Quick messaging (inquiries) and notification preference endpoints
 */

import express from 'express';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { emailService } from '../../services/email-service.js';
import { cache, invalidateCache } from '../../middleware/cache.js';
import { ErrorCodes, errorResponse, sendSuccess, sendCreated } from '../../utils/api-response.js';
import { logger } from '../../services/logger.js';
import { NOTIFICATION_PREF_COLUMNS, upload } from './helpers.js';

const router = express.Router();

// ===================================
// QUICK MESSAGE ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/messages/inquiry:
 *   post:
 *     tags: [Messages]
 *     summary: Send quick inquiry (creates thread automatically)
 *     description: Send quick inquiry (creates thread automatically).
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/inquiry',
  authenticateToken,
  upload.array('attachments', 5),
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { subject, message, priority = 'normal', message_type = 'inquiry' } = req.body;
    const attachments = req.files as Express.Multer.File[];

    if (!subject || !message) {
      return errorResponse(res, 'Subject and message are required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const db = getDatabase();

    // Create thread first
    const threadResult = await db.run(
      `
    INSERT INTO message_threads (client_id, subject, thread_type, priority)
    VALUES (?, ?, ?, ?)
  `,
      [req.user!.id, subject.trim(), 'general', priority]
    );

    const threadId = threadResult.lastID;

    // Process attachments
    let attachmentData = null;
    if (attachments && attachments.length > 0) {
      attachmentData = JSON.stringify(
        attachments.map((file) => ({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
          mimeType: file.mimetype
        }))
      );
    }

    // Get the actual sender name from the clients table
    const inquirySender = await db.get('SELECT contact_name, email FROM active_clients WHERE id = ?', [
      req.user!.id
    ]);
    const inquirySenderName =
      inquirySender?.contact_name || inquirySender?.email || req.user!.email;

    // Send message
    await db.run(
      `
    INSERT INTO messages (
      context_type, client_id, sender_type, sender_name, subject, message,
      message_type, priority, attachments, thread_id
    )
    VALUES ('general', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
      [
        req.user!.id,
        req.user!.type,
        inquirySenderName,
        subject.trim(),
        message.trim(),
        message_type,
        priority,
        attachmentData,
        threadId
      ]
    );

    // Send admin notification
    try {
      await emailService.sendAdminNotification('New Client Inquiry', {
        type: 'new-client',
        message: `New ${message_type} received from client`,
        details: {
          subject: subject.trim(),
          message: message.trim(),
          clientId: req.user!.id,
          threadId: threadId,
          priority: priority,
          hasAttachments: attachments && attachments.length > 0
        },
        timestamp: new Date()
      });
    } catch (emailError) {
      await logger.error('Failed to send admin notification:', {
        error: emailError instanceof Error ? emailError : undefined,
        category: 'MESSAGES'
      });
    }

    sendCreated(res, { threadId }, 'Inquiry sent successfully');
  })
);

// ===================================
// NOTIFICATION PREFERENCES
// ===================================

/**
 * @swagger
 * /api/messages/preferences:
 *   get:
 *     tags: [Messages]
 *     summary: Get notification preferences
 *     description: Get notification preferences.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/preferences',
  authenticateToken,
  cache({ ttl: 300, tags: ['preferences'] }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    let preferences = await db.get(`SELECT ${NOTIFICATION_PREF_COLUMNS} FROM notification_preferences WHERE client_id = ?`, [
      req.user!.id
    ]);

    if (!preferences) {
      // Create default preferences
      const result = await db.run(
        'INSERT INTO notification_preferences (client_id) VALUES (?)',
        [req.user!.id]
      );

      preferences = await db.get(`SELECT ${NOTIFICATION_PREF_COLUMNS} FROM notification_preferences WHERE id = ?`, [
        result.lastID
      ]);
    }

    sendSuccess(res, { preferences });
  })
);

/**
 * @swagger
 * /api/messages/preferences:
 *   put:
 *     tags: [Messages]
 *     summary: Update notification preferences
 *     description: Update notification preferences.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/preferences',
  authenticateToken,
  invalidateCache(['preferences']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    const updates: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    const allowedFields = [
      'email_notifications',
      'project_updates',
      'new_messages',
      'milestone_updates',
      'invoice_notifications',
      'marketing_emails',
      'notification_frequency'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return errorResponse(res, 'No valid fields to update', 400, ErrorCodes.NO_UPDATES);
    }

    values.push(req.user!.id);

    await db.run(
      `
    UPDATE notification_preferences
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE client_id = ?
  `,
      values
    );

    const updatedPreferences = await db.get(
      `SELECT ${NOTIFICATION_PREF_COLUMNS} FROM notification_preferences WHERE client_id = ?`,
      [req.user!.id]
    );

    sendSuccess(
      res,
      { preferences: updatedPreferences },
      'Notification preferences updated successfully'
    );
  })
);

export { router as quickRouter };
export default router;
