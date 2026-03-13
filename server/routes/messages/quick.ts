/**
 * ===============================================
 * QUICK MESSAGE & NOTIFICATION ROUTES
 * ===============================================
 * @file server/routes/messages/quick.ts
 *
 * Quick messaging (inquiries) and notification preference endpoints
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { emailService } from '../../services/email-service.js';
import { messageService } from '../../services/message-service.js';
import { cache, invalidateCache } from '../../middleware/cache.js';
import { ErrorCodes, errorResponse, sendSuccess, sendCreated } from '../../utils/api-response.js';
import { logger } from '../../services/logger.js';
import { upload } from './helpers.js';

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
    const inquirySenderName = await messageService.getClientSenderName(req.user!.id);

    // Create thread and send message
    const threadId = await messageService.createInquiryThread({
      clientId: req.user!.id,
      subject: subject.trim(),
      message: message.trim(),
      senderType: req.user!.type,
      senderName: inquirySenderName || req.user!.email,
      messageType: message_type,
      priority,
      attachmentData
    });

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
    const preferences = await messageService.getNotificationPreferences(req.user!.id);

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
    const updatedPreferences = await messageService.updateNotificationPreferences(
      req.user!.id,
      req.body
    );

    if (!updatedPreferences) {
      return errorResponse(res, 'No valid fields to update', 400, ErrorCodes.NO_UPDATES);
    }

    sendSuccess(
      res,
      { preferences: updatedPreferences },
      'Notification preferences updated successfully'
    );
  })
);

export { router as quickRouter };
export default router;
