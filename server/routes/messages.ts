import crypto from 'crypto';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { getDatabase } from '../database/init.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { emailService } from '../services/email-service.js';
import { cache, invalidateCache } from '../middleware/cache.js';
import { getUploadsSubdir, UPLOAD_DIRS } from '../config/uploads.js';
import { getString, getNumber } from '../database/row-helpers.js';
import { messageService } from '../services/message-service.js';
import { errorResponse, sendSuccess, sendCreated } from '../utils/api-response.js';
import { logger } from '../services/logger.js';
import { validateRequest, ValidationSchemas } from '../middleware/validation.js';

// Explicit column lists for SELECT queries (avoid SELECT *)
const MESSAGE_THREAD_COLUMNS = `
  id, project_id, client_id, subject, thread_type, status, priority,
  last_message_at, last_message_by, participant_count, created_at, updated_at,
  pinned_count, archived_at, archived_by
`.replace(/\s+/g, ' ').trim();

const MESSAGE_COLUMNS = `
  id, project_id, client_id, thread_id, context_type, sender_type, sender_name,
  subject, message, message_type, priority, read_at, attachments,
  parent_message_id, is_internal, edited_at, deleted_at, deleted_by,
  reaction_count, reply_count, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const NOTIFICATION_PREF_COLUMNS = `
  id, client_id, email_enabled, sms_enabled, push_enabled,
  new_message_notifications, project_updates_notifications,
  invoice_notifications, marketing_notifications,
  quiet_hours_start, quiet_hours_end, timezone, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const router = express.Router();

async function canAccessMessage(req: AuthenticatedRequest, messageId: number): Promise<boolean> {
  if (req.user?.type === 'admin') {
    return true;
  }

  const db = getDatabase();
  const row = await db.get(
    `SELECT 1
     FROM active_messages m
     JOIN active_message_threads mt ON m.thread_id = mt.id
     WHERE m.id = ? AND mt.client_id = ?`,
    [messageId, req.user?.id]
  );

  return !!row;
}

async function canAccessProject(req: AuthenticatedRequest, projectId: number): Promise<boolean> {
  if (req.user?.type === 'admin') {
    return true;
  }

  const db = getDatabase();
  const row = await db.get('SELECT 1 FROM active_projects WHERE id = ? AND client_id = ?', [
    projectId,
    req.user?.id
  ]);

  return !!row;
}

// Configure multer for file attachments using centralized config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadsSubdir(UPLOAD_DIRS.MESSAGES));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// MIME type to extension mapping for validation
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/plain': ['txt'],
  'application/zip': ['zip']
};

// Allowed extensions whitelist
const ALLOWED_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'txt',
  'zip'
]);

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for message attachments
    files: 5 // Max 5 files per message
  },
  fileFilter: (req, file, cb) => {
    const fileName = file.originalname.toLowerCase();
    const fileExt = path.extname(fileName).slice(1); // Remove leading dot

    // Check for double extensions (e.g., file.jpg.exe)
    const parts = fileName.split('.');
    if (parts.length > 2) {
      const dangerousExts = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js', 'msi', 'dll'];
      for (let i = 1; i < parts.length - 1; i++) {
        if (dangerousExts.includes(parts[i])) {
          return cb(new Error('Suspicious file extension detected'));
        }
      }
    }

    // Check if extension is allowed
    if (!ALLOWED_EXTENSIONS.has(fileExt)) {
      return cb(new Error(`File type not allowed: .${fileExt}`));
    }

    // Verify MIME type matches the extension
    const allowedExtensions = MIME_TO_EXTENSIONS[file.mimetype];
    if (!allowedExtensions) {
      return cb(new Error(`Unsupported MIME type: ${file.mimetype}`));
    }

    if (!allowedExtensions.includes(fileExt)) {
      return cb(new Error(`MIME type ${file.mimetype} does not match extension .${fileExt}`));
    }

    cb(null, true);
  }
});

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
        return errorResponse(res, 'Project not found or access denied', 404, 'PROJECT_NOT_FOUND');
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
      return errorResponse(res, 'Invalid thread ID', 400, 'VALIDATION_ERROR');
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
      return errorResponse(res, 'Message thread not found', 404, 'THREAD_NOT_FOUND');
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
      return errorResponse(res, 'Message content is required', 400, 'MESSAGE_REQUIRED');
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
      return errorResponse(res, 'Invalid thread ID', 400, 'VALIDATION_ERROR');
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
      return errorResponse(res, 'Message thread not found', 404, 'THREAD_NOT_FOUND');
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
      return errorResponse(res, 'Invalid thread ID', 400, 'VALIDATION_ERROR');
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
      return errorResponse(res, 'Message thread not found', 404, 'THREAD_NOT_FOUND');
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
      return errorResponse(res, 'Subject and message are required', 400, 'MISSING_REQUIRED_FIELDS');
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
      return errorResponse(res, 'No valid fields to update', 400, 'NO_UPDATES');
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

// ===================================
// ENHANCED MESSAGING ENDPOINTS
// ===================================

// ---------------
// MENTIONS
// ---------------

/**
 * @swagger
 * /api/messages/messages/{messageId}/mentions:
 *   get:
 *     tags: [Messages]
 *     summary: Get mentions in a message
 *     description: Get mentions in a message.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/messages/:messageId/mentions',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const messageId = parseInt(req.params.messageId, 10);
    if (isNaN(messageId) || messageId <= 0) {
      return errorResponse(res, 'Invalid message ID', 400, 'VALIDATION_ERROR');
    }

    if (!(await canAccessMessage(req, messageId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const mentions = await messageService.getMentions(messageId);
    sendSuccess(res, { mentions });
  })
);

/**
 * @swagger
 * /api/messages/mentions/me:
 *   get:
 *     tags: [Messages]
 *     summary: Get my mentions (messages where I'm mentioned)
 *     description: Get my mentions (messages where I'm mentioned).
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/mentions/me',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const userEmail = req.user!.email;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string) : 50;
    // Validate and bound limit
    const limit = isNaN(limitParam) || limitParam < 1 ? 50 : Math.min(limitParam, 500);
    const mentions = await messageService.getMyMentions(userEmail, limit);
    sendSuccess(res, { mentions });
  })
);

// ---------------
// REACTIONS
// ---------------

/**
 * @swagger
 * /api/messages/messages/{messageId}/reactions:
 *   get:
 *     tags: [Messages]
 *     summary: Get reactions for a message
 *     description: Get reactions for a message.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/messages/:messageId/reactions',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const messageId = parseInt(req.params.messageId, 10);
    if (isNaN(messageId) || messageId <= 0) {
      return errorResponse(res, 'Invalid message ID', 400, 'VALIDATION_ERROR');
    }

    if (!(await canAccessMessage(req, messageId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const reactions = await messageService.getReactions(messageId);
    sendSuccess(res, { reactions });
  })
);

/**
 * @swagger
 * /api/messages/messages/{messageId}/reactions:
 *   post:
 *     tags: [Messages]
 *     summary: Add reaction to a message
 *     description: Add reaction to a message.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/messages/:messageId/reactions',
  authenticateToken,
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const messageId = parseInt(req.params.messageId, 10);
    const { reaction } = req.body;

    if (isNaN(messageId) || messageId <= 0) {
      return errorResponse(res, 'Invalid message ID', 400, 'VALIDATION_ERROR');
    }

    if (!(await canAccessMessage(req, messageId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    if (!reaction) {
      return errorResponse(res, 'Reaction is required', 400, 'MISSING_REACTION');
    }

    const reactionData = await messageService.addReaction(
      messageId,
      req.user!.email,
      req.user!.type,
      reaction
    );
    sendCreated(res, { reaction: reactionData });
  })
);

/**
 * @swagger
 * /api/messages/messages/{messageId}/reactions/{reaction}:
 *   delete:
 *     tags: [Messages]
 *     summary: Remove reaction from a message
 *     description: Remove reaction from a message.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: reaction
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/messages/:messageId/reactions/:reaction',
  authenticateToken,
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const messageId = parseInt(req.params.messageId, 10);
    const reaction = decodeURIComponent(req.params.reaction);

    if (isNaN(messageId) || messageId <= 0) {
      return errorResponse(res, 'Invalid message ID', 400, 'VALIDATION_ERROR');
    }

    if (!(await canAccessMessage(req, messageId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    await messageService.removeReaction(messageId, req.user!.email, reaction);
    sendSuccess(res, undefined, 'Reaction removed');
  })
);

// ---------------
// SUBSCRIPTIONS
// ---------------

/**
 * @swagger
 * /api/messages/projects/{projectId}/subscription:
 *   get:
 *     tags: [Messages]
 *     summary: Get subscription for a project
 *     description: Get subscription for a project.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/projects/:projectId/subscription',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, 'VALIDATION_ERROR');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const subscription = await messageService.getSubscription(projectId, req.user!.email);
    sendSuccess(res, { subscription });
  })
);

/**
 * @swagger
 * /api/messages/projects/{projectId}/subscription:
 *   put:
 *     tags: [Messages]
 *     summary: Update subscription preferences
 *     description: Update subscription preferences.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/projects/:projectId/subscription',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId, 10);
    const { notify_all, notify_mentions, notify_replies } = req.body;

    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, 'VALIDATION_ERROR');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const subscription = await messageService.updateSubscription(projectId, req.user!.email, {
      notifyAll: notify_all,
      notifyMentions: notify_mentions,
      notifyReplies: notify_replies
    });
    sendSuccess(res, { subscription });
  })
);

/**
 * @swagger
 * /api/messages/projects/{projectId}/mute:
 *   post:
 *     tags: [Messages]
 *     summary: Mute a project
 *     description: Mute a project.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/projects/:projectId/mute',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId, 10);
    const { until } = req.body; // Optional: datetime to mute until

    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, 'VALIDATION_ERROR');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const subscription = await messageService.muteProject(
      projectId,
      req.user!.email,
      req.user!.type,
      until
    );
    sendSuccess(res, { subscription }, 'Project muted');
  })
);

/**
 * @swagger
 * /api/messages/projects/{projectId}/unmute:
 *   post:
 *     tags: [Messages]
 *     summary: Unmute a project
 *     description: Unmute a project.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/projects/:projectId/unmute',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, 'VALIDATION_ERROR');
    }

    const subscription = await messageService.unmuteProject(projectId, req.user!.email);
    sendSuccess(res, { subscription }, 'Project unmuted');
  })
);

// ---------------
// READ RECEIPTS
// ---------------

/**
 * @swagger
 * /api/messages/messages/{messageId}/read:
 *   post:
 *     tags: [Messages]
 *     summary: Mark message as read (with receipt tracking)
 *     description: Mark message as read (with receipt tracking).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/messages/:messageId/read',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const messageId = parseInt(req.params.messageId, 10);

    if (isNaN(messageId) || messageId <= 0) {
      return errorResponse(res, 'Invalid message ID', 400, 'VALIDATION_ERROR');
    }

    await messageService.markAsRead(messageId, req.user!.email, req.user!.type);
    sendSuccess(res, undefined, 'Marked as read');
  })
);

/**
 * @swagger
 * /api/messages/messages/read-bulk:
 *   post:
 *     tags: [Messages]
 *     summary: Mark multiple messages as read
 *     description: Mark multiple messages as read.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/messages/read-bulk',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { message_ids } = req.body;

    if (!message_ids || !Array.isArray(message_ids)) {
      return errorResponse(res, 'message_ids array is required', 400, 'MISSING_MESSAGE_IDS');
    }

    await messageService.markMultipleAsRead(message_ids, req.user!.email, req.user!.type);
    sendSuccess(res, { count: message_ids.length }, 'Messages marked as read');
  })
);

/**
 * @swagger
 * /api/messages/messages/{messageId}/read-receipts:
 *   get:
 *     tags: [Messages]
 *     summary: Get read receipts for a message (admin only)
 *     description: Get read receipts for a message (admin only).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/messages/:messageId/read-receipts',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const messageId = parseInt(req.params.messageId, 10);

    if (isNaN(messageId) || messageId <= 0) {
      return errorResponse(res, 'Invalid message ID', 400, 'VALIDATION_ERROR');
    }

    const receipts = await messageService.getReadReceipts(messageId);
    sendSuccess(res, { receipts });
  })
);

/**
 * @swagger
 * /api/messages/unread-count:
 *   get:
 *     tags: [Messages]
 *     summary: Get unread count for user
 *     description: Get unread count for user.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/unread-count',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const count = await messageService.getUnreadCount(req.user!.email, req.user!.type);
    sendSuccess(res, { unread_count: count });
  })
);

/**
 * @swagger
 * /api/messages/threads/{threadId}/unread-count:
 *   get:
 *     tags: [Messages]
 *     summary: Get unread count for a specific thread
 *     description: Get unread count for a specific thread.
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
  '/threads/:threadId/unread-count',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const threadId = parseInt(req.params.threadId, 10);

    if (isNaN(threadId) || threadId <= 0) {
      return errorResponse(res, 'Invalid thread ID', 400, 'VALIDATION_ERROR');
    }

    const count = await messageService.getThreadUnreadCount(threadId, req.user!.email);
    sendSuccess(res, { unread_count: count });
  })
);

// ---------------
// PINNED MESSAGES
// ---------------

/**
 * @swagger
 * /api/messages/threads/{threadId}/pinned:
 *   get:
 *     tags: [Messages]
 *     summary: Get pinned messages in a thread
 *     description: Get pinned messages in a thread.
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
  '/threads/:threadId/pinned',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const threadId = parseInt(req.params.threadId, 10);

    if (isNaN(threadId) || threadId <= 0) {
      return errorResponse(res, 'Invalid thread ID', 400, 'VALIDATION_ERROR');
    }

    const pinnedMessages = await messageService.getPinnedMessages(threadId);
    sendSuccess(res, { pinned_messages: pinnedMessages });
  })
);

/**
 * @swagger
 * /api/messages/messages/{messageId}/pin:
 *   post:
 *     tags: [Messages]
 *     summary: Pin a message (admin only)
 *     description: Pin a message (admin only).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/messages/:messageId/pin',
  authenticateToken,
  requireAdmin,
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const messageId = parseInt(req.params.messageId, 10);

    if (isNaN(messageId) || messageId <= 0) {
      return errorResponse(res, 'Invalid message ID', 400, 'VALIDATION_ERROR');
    }

    const { thread_id } = req.body;

    if (!thread_id) {
      return errorResponse(res, 'thread_id is required', 400, 'MISSING_THREAD_ID');
    }

    await messageService.pinMessage(thread_id, messageId, req.user!.email);
    sendSuccess(res, undefined, 'Message pinned');
  })
);

/**
 * @swagger
 * /api/messages/messages/{messageId}/pin:
 *   delete:
 *     tags: [Messages]
 *     summary: Unpin a message (admin only)
 *     description: Unpin a message (admin only).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/messages/:messageId/pin',
  authenticateToken,
  requireAdmin,
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const messageId = parseInt(req.params.messageId, 10);

    if (isNaN(messageId) || messageId <= 0) {
      return errorResponse(res, 'Invalid message ID', 400, 'VALIDATION_ERROR');
    }

    const threadId = parseInt(req.query.thread_id as string);

    if (!threadId) {
      return errorResponse(res, 'thread_id query parameter is required', 400, 'MISSING_THREAD_ID');
    }

    await messageService.unpinMessage(threadId, messageId);
    sendSuccess(res, undefined, 'Message unpinned');
  })
);

// ---------------
// MESSAGE EDITING/DELETION
// ---------------

/**
 * @swagger
 * /api/messages/messages/{messageId}:
 *   put:
 *     tags: [Messages]
 *     summary: Edit a message
 *     description: Edit a message.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/messages/:messageId',
  authenticateToken,
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const messageId = parseInt(req.params.messageId, 10);

    if (isNaN(messageId) || messageId <= 0) {
      return errorResponse(res, 'Invalid message ID', 400, 'VALIDATION_ERROR');
    }

    const { message: content } = req.body;

    if (!content || content.trim().length === 0) {
      return errorResponse(res, 'Message content is required', 400, 'MISSING_MESSAGE');
    }

    await messageService.editMessage(messageId, content.trim());
    const updatedMessage = { id: messageId, message: content.trim() };

    if (!updatedMessage) {
      return errorResponse(res, 'Cannot edit this message', 403, 'EDIT_FORBIDDEN');
    }

    sendSuccess(res, { message: updatedMessage });
  })
);

/**
 * @swagger
 * /api/messages/messages/{messageId}:
 *   delete:
 *     tags: [Messages]
 *     summary: Soft delete a message
 *     description: Soft delete a message.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/messages/:messageId',
  authenticateToken,
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const messageId = parseInt(req.params.messageId, 10);

    if (isNaN(messageId) || messageId <= 0) {
      return errorResponse(res, 'Invalid message ID', 400, 'VALIDATION_ERROR');
    }

    await messageService.deleteMessage(messageId, req.user!.email);
    const success = true;

    if (!success) {
      return errorResponse(res, 'Cannot delete this message', 403, 'DELETE_FORBIDDEN');
    }

    sendSuccess(res, undefined, 'Message deleted');
  })
);

// ---------------
// THREAD ARCHIVING
// ---------------

/**
 * @swagger
 * /api/messages/threads/{threadId}/archive:
 *   post:
 *     tags: [Messages]
 *     summary: Archive a thread (admin only)
 *     description: Archive a thread (admin only).
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
  '/threads/:threadId/archive',
  authenticateToken,
  requireAdmin,
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const threadId = parseInt(req.params.threadId, 10);

    if (isNaN(threadId) || threadId <= 0) {
      return errorResponse(res, 'Invalid thread ID', 400, 'VALIDATION_ERROR');
    }

    await messageService.archiveThread(threadId, req.user!.email);
    sendSuccess(res, undefined, 'Thread archived');
  })
);

/**
 * @swagger
 * /api/messages/threads/{threadId}/unarchive:
 *   post:
 *     tags: [Messages]
 *     summary: Unarchive a thread (admin only)
 *     description: Unarchive a thread (admin only).
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
  '/threads/:threadId/unarchive',
  authenticateToken,
  requireAdmin,
  invalidateCache(['messages']),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const threadId = parseInt(req.params.threadId, 10);

    if (isNaN(threadId) || threadId <= 0) {
      return errorResponse(res, 'Invalid thread ID', 400, 'VALIDATION_ERROR');
    }

    await messageService.unarchiveThread(threadId);
    sendSuccess(res, undefined, 'Thread unarchived');
  })
);

/**
 * @swagger
 * /api/messages/threads/archived:
 *   get:
 *     tags: [Messages]
 *     summary: Get archived threads (admin only)
 *     description: Get archived threads (admin only).
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/threads/archived',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const threads = await messageService.getArchivedThreads();
    sendSuccess(res, { threads });
  })
);

// ---------------
// SEARCH
// ---------------

/**
 * @swagger
 * /api/messages/search:
 *   get:
 *     tags: [Messages]
 *     summary: Search messages
 *     description: Search messages.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/search',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const query = req.query.q as string;
    const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : undefined;
    const threadId = req.query.thread_id ? parseInt(req.query.thread_id as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    if (!query || query.trim().length === 0) {
      return errorResponse(res, 'Search query is required', 400, 'MISSING_QUERY');
    }

    const results = await messageService.searchMessages(query.trim(), {
      projectId,
      threadId,
      limit,
      userEmail: req.user!.type === 'client' ? req.user!.email : undefined,
      includeInternal: req.user!.type === 'admin'
    });

    sendSuccess(res, { results, count: results.length });
  })
);

// ---------------
// INTERNAL MESSAGES (Admin Only)
// ---------------

/**
 * @swagger
 * /api/messages/threads/{threadId}/internal:
 *   post:
 *     tags: [Messages]
 *     summary: Send internal message (admin-only, not visible to clients)
 *     description: Send internal message (admin-only, not visible to clients).
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
  '/threads/:threadId/internal',
  authenticateToken,
  requireAdmin,
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const threadId = parseInt(req.params.threadId, 10);

    if (isNaN(threadId) || threadId <= 0) {
      return errorResponse(res, 'Invalid thread ID', 400, 'VALIDATION_ERROR');
    }

    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return errorResponse(res, 'Message content is required', 400, 'MISSING_MESSAGE');
    }

    const db = getDatabase();

    // Verify thread exists
    const thread = await db.get(`SELECT ${MESSAGE_THREAD_COLUMNS} FROM active_message_threads WHERE id = ?`, [threadId]);
    if (!thread) {
      return errorResponse(res, 'Thread not found', 404, 'THREAD_NOT_FOUND');
    }

    const result = await db.run(
      `
      INSERT INTO messages (
        context_type, client_id, sender_type, sender_name, subject, message,
        thread_id, is_internal
      )
      VALUES ('general', ?, 'admin', ?, ?, ?, ?, TRUE)
      `,
      [thread.client_id, req.user!.email, thread.subject, message.trim(), threadId]
    );

    // Process mentions in the internal message
    await messageService.processMentions(result.lastID!, message.trim());

    const newMessage = await db.get(`SELECT ${MESSAGE_COLUMNS} FROM active_messages WHERE id = ?`, [result.lastID]);

    sendCreated(res, { messageData: newMessage }, 'Internal message sent');
  })
);

/**
 * @swagger
 * /api/messages/threads/{threadId}/internal:
 *   get:
 *     tags: [Messages]
 *     summary: Get internal messages for a thread (admin only)
 *     description: Get internal messages for a thread (admin only).
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
  '/threads/:threadId/internal',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const threadId = parseInt(req.params.threadId, 10);

    if (isNaN(threadId) || threadId <= 0) {
      return errorResponse(res, 'Invalid thread ID', 400, 'VALIDATION_ERROR');
    }

    const db = getDatabase();

    const messages = await db.all(
      `SELECT ${MESSAGE_COLUMNS} FROM active_messages
      WHERE thread_id = ? AND is_internal = TRUE AND context_type = 'general'
      ORDER BY created_at ASC`,
      [threadId]
    );

    sendSuccess(res, { messages });
  })
);

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
      return errorResponse(res, 'Invalid filename', 400, 'INVALID_FILENAME');
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
      return errorResponse(res, 'File not found', 404, 'FILE_NOT_FOUND');
    }

    const filePath = path.join(getUploadsSubdir(UPLOAD_DIRS.MESSAGES), filename);

    // Check if file exists
    const fs = await import('fs/promises');
    try {
      await fs.access(filePath);
    } catch {
      return errorResponse(res, 'File not found', 404, 'FILE_NOT_FOUND');
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

export { router as messagesRouter };
export default router;
