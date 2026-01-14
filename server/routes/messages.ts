/**
 * ===============================================
 * MESSAGING ROUTES
 * ===============================================
 * Enhanced messaging system with threads, general messages, and notifications
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { getDatabase } from '../database/init.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { emailService } from '../services/email-service.js';
import { cache, invalidateCache } from '../middleware/cache.js';
import { auditLogger } from '../services/audit-logger.js';
import { getUploadsSubdir, UPLOAD_DIRS } from '../config/uploads.js';

const router = express.Router();

// Configure multer for file attachments using centralized config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadsSubdir(UPLOAD_DIRS.MESSAGES));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for message attachments
    files: 3, // Max 3 files per message
  },
  fileFilter: (req, file, cb) => {
    // Allow common attachment types
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|txt|zip/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid attachment type'));
  },
});

// ===================================
// GENERAL MESSAGE ENDPOINTS
// ===================================

// Get all message threads for client
router.get(
  '/threads',
  authenticateToken,
  cache({ ttl: 60, tags: ['messages'] }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();
    let query = '';
    let params: any[] = [];

    if (req.user!.type === 'admin') {
      // Admin can see all threads
      query = `
      SELECT 
        mt.*,
        c.company_name,
        c.contact_name,
        c.email as client_email,
        p.project_name,
        COUNT(gm.id) as message_count,
        COUNT(CASE WHEN gm.is_read = 0 AND gm.sender_type != 'admin' THEN 1 END) as unread_count
      FROM message_threads mt
      JOIN clients c ON mt.client_id = c.id
      LEFT JOIN projects p ON mt.project_id = p.id
      LEFT JOIN general_messages gm ON mt.id = gm.thread_id
      GROUP BY mt.id
      ORDER BY mt.last_message_at DESC
    `;
    } else {
      // Client can only see their own threads
      query = `
      SELECT 
        mt.*,
        p.project_name,
        COUNT(gm.id) as message_count,
        COUNT(CASE WHEN gm.is_read = 0 AND gm.sender_type != 'client' THEN 1 END) as unread_count
      FROM message_threads mt
      LEFT JOIN projects p ON mt.project_id = p.id
      LEFT JOIN general_messages gm ON mt.id = gm.thread_id
      WHERE mt.client_id = ?
      GROUP BY mt.id
      ORDER BY mt.last_message_at DESC
    `;
      params = [req.user!.id];
    }

    const threads = await db.all(query, params);

    res.json({ threads });
  })
);

// Create new message thread
router.post(
  '/threads',
  authenticateToken,
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { subject, thread_type = 'general', priority = 'normal', project_id } = req.body;

    if (!subject || subject.trim().length === 0) {
      return res.status(400).json({
        error: 'Subject is required',
        code: 'MISSING_SUBJECT',
      });
    }

    const db = getDatabase();

    // If project_id provided, verify project access
    if (project_id) {
      let project;
      if (req.user!.type === 'admin') {
        project = await db.get('SELECT id FROM projects WHERE id = ?', [project_id]);
      } else {
        project = await db.get('SELECT id FROM projects WHERE id = ? AND client_id = ?', [
          project_id,
          req.user!.id,
        ]);
      }

      if (!project) {
        return res.status(404).json({
          error: 'Project not found or access denied',
          code: 'PROJECT_NOT_FOUND',
        });
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
      `
    SELECT * FROM message_threads WHERE id = ?
  `,
      [result.lastID]
    );

    res.status(201).json({
      message: 'Message thread created successfully',
      thread: newThread,
    });
  })
);

// Send message in thread
router.post(
  '/threads/:threadId/messages',
  authenticateToken,
  upload.array('attachments', 3),
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const threadId = parseInt(req.params.threadId);
    const { message, priority = 'normal', reply_to } = req.body;
    const attachments = req.files as Express.Multer.File[];

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message content is required',
        code: 'MISSING_MESSAGE',
      });
    }

    const db = getDatabase();

    // Verify thread access
    let thread;
    if (req.user!.type === 'admin') {
      thread = await db.get('SELECT * FROM message_threads WHERE id = ?', [threadId]);
    } else {
      thread = await db.get('SELECT * FROM message_threads WHERE id = ? AND client_id = ?', [
        threadId,
        req.user!.id,
      ]);
    }

    if (!thread) {
      return res.status(404).json({
        error: 'Message thread not found',
        code: 'THREAD_NOT_FOUND',
      });
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
          mimeType: file.mimetype,
        }))
      );
    }

    const sender_name = req.user!.type === 'admin' ? 'Admin' : req.user!.email;

    const result = await db.run(
      `
    INSERT INTO general_messages (
      client_id, sender_type, sender_name, subject, message, priority, 
      reply_to, attachments, thread_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        threadId,
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
      `
    SELECT * FROM general_messages WHERE id = ?
  `,
      [result.lastID]
    );

    // Send email notification
    try {
      const recipientType = req.user!.type === 'admin' ? 'client' : 'admin';

      if (recipientType === 'client') {
        // Notify client
        const client = await db.get('SELECT email, contact_name FROM clients WHERE id = ?', [
          thread.client_id,
        ]);

        if (client) {
          await emailService.sendMessageNotification(client.email, {
            recipientName: client.contact_name || 'Client',
            senderName: sender_name,
            subject: thread.subject,
            message: message.trim(),
            threadId: threadId,
            portalUrl: `${process.env.CLIENT_PORTAL_URL || 'https://nobhad.codes/client/portal.html'}?thread=${threadId}`,
            hasAttachments: attachments && attachments.length > 0,
          });
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
            hasAttachments: attachments && attachments.length > 0,
          },
          timestamp: new Date(),
        });
      }
    } catch (emailError) {
      console.error('Failed to send message notification:', emailError);
      // Continue - don't fail message sending due to email issues
    }

    res.status(201).json({
      message: 'Message sent successfully',
      messageData: newMessage,
    });
  })
);

// Get messages in thread
router.get(
  '/threads/:threadId/messages',
  authenticateToken,
  cache({ ttl: 30, tags: ['messages'] }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const threadId = parseInt(req.params.threadId);
    const db = getDatabase();

    // Verify thread access
    let thread;
    if (req.user!.type === 'admin') {
      thread = await db.get('SELECT * FROM message_threads WHERE id = ?', [threadId]);
    } else {
      thread = await db.get('SELECT * FROM message_threads WHERE id = ? AND client_id = ?', [
        threadId,
        req.user!.id,
      ]);
    }

    if (!thread) {
      return res.status(404).json({
        error: 'Message thread not found',
        code: 'THREAD_NOT_FOUND',
      });
    }

    const messages = await db.all(
      `
    SELECT 
      id, sender_type, sender_name, message, priority, reply_to,
      attachments, is_read, read_at, created_at, updated_at
    FROM general_messages 
    WHERE thread_id = ?
    ORDER BY created_at ASC
  `,
      [threadId]
    );

    // Parse attachments JSON
    messages.forEach((msg) => {
      if (msg.attachments) {
        try {
          msg.attachments = JSON.parse(msg.attachments);
        } catch (e) {
          msg.attachments = [];
        }
      } else {
        msg.attachments = [];
      }
    });

    res.json({
      thread,
      messages,
    });
  })
);

// Mark thread messages as read
router.put(
  '/threads/:threadId/read',
  authenticateToken,
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const threadId = parseInt(req.params.threadId);
    const db = getDatabase();

    // Verify thread access
    let thread;
    if (req.user!.type === 'admin') {
      thread = await db.get('SELECT * FROM message_threads WHERE id = ?', [threadId]);
    } else {
      thread = await db.get('SELECT * FROM message_threads WHERE id = ? AND client_id = ?', [
        threadId,
        req.user!.id,
      ]);
    }

    if (!thread) {
      return res.status(404).json({
        error: 'Message thread not found',
        code: 'THREAD_NOT_FOUND',
      });
    }

    // Mark messages as read (except own messages)
    await db.run(
      `
    UPDATE general_messages 
    SET is_read = 1, read_at = CURRENT_TIMESTAMP
    WHERE thread_id = ? AND sender_type != ?
  `,
      [threadId, req.user!.type]
    );

    res.json({
      message: 'Messages marked as read',
    });
  })
);

// ===================================
// QUICK MESSAGE ENDPOINTS
// ===================================

// Send quick inquiry (creates thread automatically)
router.post(
  '/inquiry',
  authenticateToken,
  upload.array('attachments', 3),
  invalidateCache(['messages']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { subject, message, priority = 'normal', message_type = 'inquiry' } = req.body;
    const attachments = req.files as Express.Multer.File[];

    if (!subject || !message) {
      return res.status(400).json({
        error: 'Subject and message are required',
        code: 'MISSING_REQUIRED_FIELDS',
      });
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
          mimeType: file.mimetype,
        }))
      );
    }

    // Send message
    await db.run(
      `
    INSERT INTO general_messages (
      client_id, sender_type, sender_name, subject, message, 
      message_type, priority, attachments, thread_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
      [
        req.user!.id,
        req.user!.type,
        req.user!.email,
        subject.trim(),
        message.trim(),
        message_type,
        priority,
        attachmentData,
        threadId,
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
          hasAttachments: attachments && attachments.length > 0,
        },
        timestamp: new Date(),
      });
    } catch (emailError) {
      console.error('Failed to send admin notification:', emailError);
    }

    res.status(201).json({
      message: 'Inquiry sent successfully',
      threadId: threadId,
    });
  })
);

// ===================================
// NOTIFICATION PREFERENCES
// ===================================

// Get notification preferences
router.get(
  '/preferences',
  authenticateToken,
  cache({ ttl: 300, tags: ['preferences'] }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    let preferences = await db.get('SELECT * FROM notification_preferences WHERE client_id = ?', [
      req.user!.id,
    ]);

    if (!preferences) {
      // Create default preferences
      const result = await db.run(
        `
      INSERT INTO notification_preferences (client_id)
      VALUES (?)
    `,
        [req.user!.id]
      );

      preferences = await db.get('SELECT * FROM notification_preferences WHERE id = ?', [
        result.lastID,
      ]);
    }

    res.json({ preferences });
  })
);

// Update notification preferences
router.put(
  '/preferences',
  authenticateToken,
  invalidateCache(['preferences']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const {
      email_notifications,
      project_updates,
      new_messages,
      milestone_updates,
      invoice_notifications,
      marketing_emails,
      notification_frequency,
    } = req.body;

    const db = getDatabase();

    const updates: string[] = [];
    const values: any[] = [];
    const allowedFields = [
      'email_notifications',
      'project_updates',
      'new_messages',
      'milestone_updates',
      'invoice_notifications',
      'marketing_emails',
      'notification_frequency',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update',
        code: 'NO_UPDATES',
      });
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
      'SELECT * FROM notification_preferences WHERE client_id = ?',
      [req.user!.id]
    );

    res.json({
      message: 'Notification preferences updated successfully',
      preferences: updatedPreferences,
    });
  })
);

// ===================================
// ADMIN ENDPOINTS
// ===================================

// Get message analytics (admin only)
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
      COUNT(gm.id) as total_messages,
      COUNT(CASE WHEN gm.is_read = 0 THEN gm.id END) as unread_messages,
      COUNT(CASE WHEN gm.sender_type = 'client' THEN gm.id END) as client_messages,
      COUNT(CASE WHEN gm.sender_type = 'admin' THEN gm.id END) as admin_messages,
      COUNT(CASE WHEN gm.message_type = 'inquiry' THEN gm.id END) as inquiries,
      COUNT(CASE WHEN gm.priority = 'urgent' THEN gm.id END) as urgent_messages
    FROM message_threads mt
    LEFT JOIN general_messages gm ON mt.id = gm.thread_id
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
    FROM message_threads mt
    JOIN clients c ON mt.client_id = c.id
    ORDER BY mt.last_message_at DESC
    LIMIT 10
  `);

    res.json({
      analytics,
      recentActivity,
    });
  })
);

export { router as messagesRouter };
export default router;
