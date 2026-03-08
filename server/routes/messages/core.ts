/**
 * ===============================================
 * MESSAGE CORE ROUTES
 * ===============================================
 * @file server/routes/messages/core.ts
 *
 * Core message CRUD: threads, send/get messages, mark read/unread
 */

import express from 'express';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { emailService } from '../../services/email-service.js';
import { cache, invalidateCache } from '../../middleware/cache.js';
import { getString, getNumber } from '../../database/row-helpers.js';
import { ErrorCodes, errorResponse, sendSuccess, sendCreated } from '../../utils/api-response.js';
import { logger } from '../../services/logger.js';
import { validateRequest, ValidationSchemas } from '../../middleware/validation.js';
import { MESSAGE_THREAD_COLUMNS, MESSAGE_COLUMNS, upload } from './helpers.js';

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
    const db = getDatabase();
    let query = '';
    let params: (string | number | null)[] = [];

    if (req.user!.type === 'admin') {
      // Admin can see all threads - internal messages visible to admin only
      query = `
      SELECT
        mt.*,
        c.company_name,
        c.contact_name,
        c.email as client_email,
        p.project_name,
        COUNT(m.id) as message_count,
        COUNT(CASE WHEN m.read_at IS NULL AND m.sender_type != 'admin' AND (m.is_internal IS NULL OR m.is_internal = 0) THEN 1 END) as unread_count
      FROM active_message_threads mt
      JOIN active_clients c ON mt.client_id = c.id
      LEFT JOIN active_projects p ON mt.project_id = p.id
      LEFT JOIN active_messages m ON mt.id = m.thread_id AND m.context_type = 'general'
      GROUP BY mt.id
      ORDER BY mt.last_message_at DESC
    `;
    } else {
      // Client can only see their own threads - exclude internal messages
      query = `
      SELECT
        mt.*,
        p.project_name,
        COUNT(CASE WHEN m.is_internal IS NULL OR m.is_internal = 0 THEN 1 END) as message_count,
        COUNT(CASE WHEN m.read_at IS NULL AND m.sender_type != 'client' AND (m.is_internal IS NULL OR m.is_internal = 0) THEN 1 END) as unread_count
      FROM active_message_threads mt
      LEFT JOIN active_projects p ON mt.project_id = p.id
      LEFT JOIN active_messages m ON mt.id = m.thread_id AND m.context_type = 'general'
      WHERE mt.client_id = ?
      GROUP BY mt.id
      ORDER BY mt.last_message_at DESC
    `;
      params = [req.user!.id];
    }

    const threads = await db.all(query, params);

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

    const db = getDatabase();

    // If project_id provided, verify project access
    if (project_id) {
      let project;
      if (req.user!.type === 'admin') {
        project = await db.get('SELECT id FROM active_projects WHERE id = ?', [project_id]);
      } else {
        project = await db.get('SELECT id FROM active_projects WHERE id = ? AND client_id = ?', [
          project_id,
          req.user!.id
        ]);
      }

      if (!project) {
        return errorResponse(res, 'Project not found or access denied', 404, ErrorCodes.PROJECT_NOT_FOUND);
      }
    }

    const client_id = req.user!.type === 'admin' ? req.body.client_id : req.user!.id;

    const result = await db.run(
      `
    INSERT INTO message_threads (client_id, project_id, subject, thread_type, priority)
    VALUES (?, ?, ?, ?, ?)
  `,
      [client_id, project_id || null, subject.trim(), thread_type, priority]
    );

    const newThread = await db.get(
      `SELECT ${MESSAGE_THREAD_COLUMNS} FROM active_message_threads WHERE id = ?`,
      [result.lastID]
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

    const db = getDatabase();

    // Verify thread access
    let thread;
    if (req.user!.type === 'admin') {
      thread = await db.get(`SELECT ${MESSAGE_THREAD_COLUMNS} FROM active_message_threads WHERE id = ?`, [threadId]);
    } else {
      thread = await db.get(`SELECT ${MESSAGE_THREAD_COLUMNS} FROM active_message_threads WHERE id = ? AND client_id = ?`, [
        threadId,
        req.user!.id
      ]);
    }

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
    const senderClient = (await db.get('SELECT contact_name, email FROM active_clients WHERE id = ?', [
      req.user!.id
    ])) as { contact_name: string | null; email: string } | undefined;
    const sender_name: string =
      senderClient?.contact_name || senderClient?.email || req.user!.email;

    // Safety check for message (validation should catch this, but just in case)
    if (!message || typeof message !== 'string') {
      logger.error('Message validation failed', { category: 'messages', metadata: { message, type: typeof message } });
      return errorResponse(res, 'Message content is required', 400, ErrorCodes.MESSAGE_REQUIRED);
    }

    const result = await db.run(
      `
    INSERT INTO messages (
      context_type, client_id, sender_type, sender_name, subject, message, priority,
      reply_to, attachments, thread_id
    )
    VALUES ('general', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
      [
        thread.client_id,
        req.user!.type,
        sender_name,
        thread.subject,
        message.trim(),
        priority,
        reply_to || null,
        attachmentData,
        threadId
      ]
    );

    // Update thread last message timestamp
    await db.run(
      `
    UPDATE message_threads
    SET last_message_at = CURRENT_TIMESTAMP, last_message_by = ?
    WHERE id = ?
  `,
      [sender_name, threadId]
    );

    const newMessage = await db.get(
      `SELECT ${MESSAGE_COLUMNS} FROM active_messages WHERE id = ?`,
      [result.lastID]
    );

    // Send email notification
    try {
      const recipientType = req.user!.type === 'admin' ? 'client' : 'admin';

      if (recipientType === 'client') {
        // Notify client
        const clientId = getNumber(thread, 'client_id');
        const client = await db.get('SELECT email, contact_name FROM active_clients WHERE id = ?', [
          clientId
        ]);

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
              subject: thread.subject,
              message: message.trim(),
              threadId: threadId,
              portalUrl: `${process.env.CLIENT_PORTAL_URL || 'https://nobhad.codes/client/portal.html'}?thread=${threadId}`,
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

    const db = getDatabase();

    // Verify thread access
    let thread;
    if (req.user!.type === 'admin') {
      thread = await db.get(`SELECT ${MESSAGE_THREAD_COLUMNS} FROM active_message_threads WHERE id = ?`, [threadId]);
    } else {
      thread = await db.get(`SELECT ${MESSAGE_THREAD_COLUMNS} FROM active_message_threads WHERE id = ? AND client_id = ?`, [
        threadId,
        req.user!.id
      ]);
    }

    if (!thread) {
      return errorResponse(res, 'Message thread not found', 404, ErrorCodes.THREAD_NOT_FOUND);
    }

    const messages = await db.all(
      `
    SELECT
      m.id, m.sender_type, m.sender_name, m.message, m.priority, m.reply_to,
      m.attachments, m.read_at, m.created_at, m.updated_at,
      CASE WHEN pm.id IS NOT NULL THEN 1 ELSE 0 END as is_pinned
    FROM active_messages m
    LEFT JOIN pinned_messages pm ON m.id = pm.message_id AND pm.thread_id = ?
    WHERE m.thread_id = ?
      AND m.context_type = 'general'
      AND (m.is_internal IS NULL OR m.is_internal = 0)
    ORDER BY m.created_at ASC
  `,
      [threadId, threadId]
    );

    // Batch fetch all reactions for all messages in this thread (fixes N+1 query)
    const messageIds = messages.map((m) => m.id as number);
    const reactionsMap: Map<number, Array<Record<string, unknown>>> = new Map();

    if (messageIds.length > 0) {
      const placeholders = messageIds.map(() => '?').join(',');
      const allReactions = await db.all(
        `SELECT id, message_id, reaction, user_email, created_at
         FROM message_reactions
         WHERE message_id IN (${placeholders})`,
        messageIds
      );

      // Group reactions by message_id
      for (const reaction of allReactions) {
        const msgId = reaction.message_id as number;
        if (!reactionsMap.has(msgId)) {
          reactionsMap.set(msgId, []);
        }
        reactionsMap.get(msgId)!.push(reaction);
      }
    }

    // Parse attachments JSON and assign reactions for each message
    for (const msg of messages) {
      const attachmentsStr = getString(msg, 'attachments');
      if (attachmentsStr) {
        try {
          msg.attachments = JSON.parse(attachmentsStr);
        } catch (_e) {
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

    const db = getDatabase();

    // Verify thread access
    let thread;
    if (req.user!.type === 'admin') {
      thread = await db.get(`SELECT ${MESSAGE_THREAD_COLUMNS} FROM active_message_threads WHERE id = ?`, [threadId]);
    } else {
      thread = await db.get(`SELECT ${MESSAGE_THREAD_COLUMNS} FROM active_message_threads WHERE id = ? AND client_id = ?`, [
        threadId,
        req.user!.id
      ]);
    }

    if (!thread) {
      return errorResponse(res, 'Message thread not found', 404, ErrorCodes.THREAD_NOT_FOUND);
    }

    // Mark messages as read (except own messages)
    await db.run(
      `
    UPDATE messages
    SET read_at = CURRENT_TIMESTAMP
    WHERE thread_id = ? AND sender_type != ? AND context_type = 'general'
  `,
      [threadId, req.user!.type]
    );

    sendSuccess(res, undefined, 'Messages marked as read');
  })
);

export { router as coreRouter };
export default router;
