/**
 * ===============================================
 * MESSAGE CORE ROUTES
 * ===============================================
 * @file server/routes/messages/core.ts
 *
 * Core message CRUD: threads, send/get messages, mark read/unread
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { emailService } from '../../services/email-service.js';
import { cache, invalidateCache } from '../../middleware/cache.js';
import { getString, getNumber } from '../../database/row-helpers.js';
import { ErrorCodes, errorResponse, sendSuccess, sendCreated } from '../../utils/api-response.js';
import { logger } from '../../services/logger.js';
import { validateRequest, ValidationSchemas } from '../../middleware/validation.js';
import { MESSAGE_THREAD_COLUMNS, MESSAGE_COLUMNS, upload } from './helpers.js';
import { BUSINESS_INFO } from '../../config/business.js';
import { sseManager } from '../../services/sse-manager.js';
import { messageService } from '../../services/message-service.js';

const router = express.Router();

// ===================================
// GENERAL MESSAGE ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/messages/threads:
 *   get:
 *     tags: [Messages]
 *     summary: Get all message threads for client
 *     description: Get all message threads for client.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/threads',
  authenticateToken,
  cache({ ttl: 60, tags: ['messages'] }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const threads = await messageService.getThreads(
      req.user!.type as 'admin' | 'client',
      String(req.user!.id)
    );

    sendSuccess(res, { threads });
  })
);

/**
 * @swagger
 * /api/messages/threads:
 *   post:
 *     tags: [Messages]
 *     summary: Create new message thread
 *     description: Create new message thread.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/threads',
  authenticateToken,
  validateRequest(ValidationSchemas.messageThread),
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { subject, thread_type = 'general', priority = 'normal', project_id } = req.body;

    // If project_id provided, verify project access
    if (project_id) {
      const project = await messageService.verifyProjectAccess(
        project_id,
        req.user!.type as 'admin' | 'client',
        String(req.user!.id)
      );

      if (!project) {
        return errorResponse(res, 'Project not found or access denied', 404, ErrorCodes.PROJECT_NOT_FOUND);
      }
    }

    const client_id = req.user!.type === 'admin' ? req.body.client_id : req.user!.id;

    const newThread = await messageService.createThread(
      {
        clientId: client_id,
        projectId: project_id || null,
        subject: subject.trim(),
        threadType: thread_type,
        priority
      },
      MESSAGE_THREAD_COLUMNS
    );

    sendCreated(res, { thread: newThread }, 'Message thread created successfully');
  })
);

/**
 * @swagger
 * /api/messages/threads/{threadId}/messages:
 *   post:
 *     tags: [Messages]
 *     summary: Send message in thread
 *     description: Send message in thread.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/threads/:threadId/messages',
  authenticateToken,
  upload.array('attachments', 5),
  validateRequest(ValidationSchemas.message),
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const threadId = parseInt(req.params.threadId, 10);

    if (isNaN(threadId) || threadId <= 0) {
      return errorResponse(res, 'Invalid thread ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { message, priority = 'normal', reply_to } = req.body;
    const attachments = req.files as Express.Multer.File[];

    // Debug: log request details
    logger.info('Send message request', {
      category: 'messages',
      metadata: {
        threadId,
        hasMessage: !!message,
        messageLength: message?.length,
        priority,
        hasAttachments: attachments?.length > 0,
        userType: req.user?.type,
        userId: req.user?.id
      }
    });

    // Verify thread access
    const thread = await messageService.findThreadById(
      threadId,
      req.user!.type as 'admin' | 'client',
      String(req.user!.id),
      MESSAGE_THREAD_COLUMNS
    );

    if (!thread) {
      return errorResponse(res, 'Message thread not found', 404, ErrorCodes.THREAD_NOT_FOUND);
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
    const senderClient = await messageService.getClientContactInfo(String(req.user!.id));
    const sender_name: string =
      senderClient?.contact_name || senderClient?.email || req.user!.email;

    // Safety check for message (validation should catch this, but just in case)
    if (!message || typeof message !== 'string') {
      logger.error('Message validation failed', { category: 'messages', metadata: { message, type: typeof message } });
      return errorResponse(res, 'Message content is required', 400, ErrorCodes.MESSAGE_REQUIRED);
    }

    const newMessage = await messageService.insertMessage(
      {
        clientId: thread.client_id as string | number,
        senderType: req.user!.type,
        senderName: sender_name,
        subject: thread.subject as string,
        message: message.trim(),
        priority,
        replyTo: reply_to || null,
        attachments: attachmentData,
        threadId
      },
      MESSAGE_COLUMNS
    );

    // Update thread last message timestamp
    await messageService.updateThreadLastMessage(threadId, sender_name);

    // Send email notification
    try {
      const recipientType = req.user!.type === 'admin' ? 'client' : 'admin';

      if (recipientType === 'client') {
        // Notify client
        const clientId = getNumber(thread, 'client_id');
        const client = await messageService.getClientById(clientId);

        if (client) {
          const clientEmail = getString(client, 'email');
          const clientContactName = getString(client, 'contact_name');

          // Validate email format before sending
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!clientEmail || !emailRegex.test(clientEmail)) {
            logger.warn('Invalid client email, skipping notification', {
              category: 'email',
              metadata: { clientId, threadId }
            });
          } else {
            await emailService.sendMessageNotification(clientEmail, {
              recipientName: clientContactName || 'Client',
              senderName: sender_name,
              subject: thread.subject as string,
              message: message.trim(),
              threadId: threadId,
              portalUrl: `${process.env.CLIENT_PORTAL_URL || `https://${BUSINESS_INFO.website}/client/portal.html`}?thread=${threadId}`,
              hasAttachments: attachments && attachments.length > 0
            });
          }
        }
      } else {
        // Notify admin
        await emailService.sendAdminNotification('New Client Message', {
          type: 'new-client',
          message: `New message from client in thread: ${thread.subject}`,
          details: {
            threadId: threadId,
            subject: thread.subject,
            clientId: thread.client_id,
            message: message.trim(),
            hasAttachments: attachments && attachments.length > 0
          },
          timestamp: new Date()
        });
      }
    } catch (emailError) {
      logger.error('Failed to send message notification', {
        category: 'email',
        metadata: { error: emailError, threadId, subject: thread.subject }
      });
      // Continue - don't fail message sending due to email issues
    }

    // Broadcast new message via SSE to relevant users
    const sseEvent = {
      type: 'message:new',
      data: {
        threadId,
        message: newMessage,
        senderType: req.user!.type
      }
    };

    if (req.user!.type === 'client') {
      // Client sent — notify admins
      sseManager.sendToAdmins(sseEvent);
    } else {
      // Admin sent — notify the thread's client
      const clientId = getNumber(thread, 'client_id');
      if (clientId) {
        sseManager.sendToUser(clientId, 'client', sseEvent);
      }
    }

    sendCreated(res, { messageData: newMessage }, 'Message sent successfully');
  })
);

/**
 * @swagger
 * /api/messages/threads/{threadId}/messages:
 *   get:
 *     tags: [Messages]
 *     summary: Get messages in thread
 *     description: Get messages in thread.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/threads/:threadId/messages',
  authenticateToken,
  cache({ ttl: 30, tags: ['messages'] }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const threadId = parseInt(req.params.threadId, 10);

    if (isNaN(threadId) || threadId <= 0) {
      return errorResponse(res, 'Invalid thread ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify thread access
    const thread = await messageService.findThreadById(
      threadId,
      req.user!.type as 'admin' | 'client',
      String(req.user!.id),
      MESSAGE_THREAD_COLUMNS
    );

    if (!thread) {
      return errorResponse(res, 'Message thread not found', 404, ErrorCodes.THREAD_NOT_FOUND);
    }

    const messages = await messageService.getThreadMessages(threadId);

    // Batch fetch all reactions for all messages in this thread (fixes N+1 query)
    const messageIds = messages.map((m) => m.id as number);
    const reactionsMap = await messageService.getReactionsByMessageIds(messageIds);

    // Parse attachments JSON and assign reactions for each message
    for (const msg of messages) {
      const attachmentsStr = getString(msg, 'attachments');
      if (attachmentsStr) {
        try {
          msg.attachments = JSON.parse(attachmentsStr);
        } catch (_e) {
          logger.debug('[Messages] Failed to parse attachments JSON', {
            error: _e instanceof Error ? _e : undefined
          });
          msg.attachments = [];
        }
      } else {
        msg.attachments = [];
      }

      // Assign reactions from batch fetch
      msg.reactions = reactionsMap.get(msg.id as number) || [];
    }

    sendSuccess(res, { thread, messages });
  })
);

/**
 * @swagger
 * /api/messages/threads/{threadId}/read:
 *   put:
 *     tags: [Messages]
 *     summary: Mark thread messages as read
 *     description: Mark thread messages as read.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/threads/:threadId/read',
  authenticateToken,
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const threadId = parseInt(req.params.threadId, 10);

    if (isNaN(threadId) || threadId <= 0) {
      return errorResponse(res, 'Invalid thread ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify thread access
    const thread = await messageService.findThreadById(
      threadId,
      req.user!.type as 'admin' | 'client',
      String(req.user!.id),
      MESSAGE_THREAD_COLUMNS
    );

    if (!thread) {
      return errorResponse(res, 'Message thread not found', 404, ErrorCodes.THREAD_NOT_FOUND);
    }

    // Mark messages as read (except own messages)
    await messageService.markThreadMessagesAsRead(threadId, req.user!.type);

    sendSuccess(res, undefined, 'Messages marked as read');
  })
);

export { router as coreRouter };
export default router;
