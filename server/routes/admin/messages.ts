/**
 * ===============================================
 * ADMIN MESSAGES ROUTES
 * ===============================================
 * @file server/routes/admin/messages.ts
 *
 * Admin-specific messaging endpoints for the MessagingPanel.
 * These wrap the message service to provide a conversations-based API.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { getDatabase } from '../../database/init.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';

const router = express.Router();

/**
 * GET /api/admin/messages/conversations - Get all conversations for admin
 * Returns conversations with client info and unread counts
 */
router.get(
  '/messages/conversations',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    // Get all threads with client info and message stats
    const conversations = await db.all(`
      SELECT
        mt.id,
        mt.subject,
        mt.thread_type as type,
        mt.status,
        mt.priority,
        mt.last_message_at as lastMessageAt,
        mt.created_at as createdAt,
        c.id as clientId,
        COALESCE(c.company_name, c.contact_name) as clientName,
        c.email as clientEmail,
        p.id as projectId,
        p.project_name as projectName,
        (SELECT COUNT(*) FROM messages m WHERE m.thread_id = mt.id AND m.context_type = 'general') as messageCount,
        (SELECT COUNT(*) FROM messages m
         WHERE m.thread_id = mt.id
         AND m.context_type = 'general'
         AND m.read_at IS NULL
         AND m.sender_type != 'admin'
         AND (m.is_internal IS NULL OR m.is_internal = 0)) as unreadCount,
        (SELECT m.message FROM messages m
         WHERE m.thread_id = mt.id
         AND m.context_type = 'general'
         AND (m.is_internal IS NULL OR m.is_internal = 0)
         ORDER BY m.created_at DESC LIMIT 1) as lastMessage
      FROM message_threads mt
      JOIN clients c ON mt.client_id = c.id
      LEFT JOIN projects p ON mt.project_id = p.id
      WHERE c.deleted_at IS NULL
      ORDER BY mt.last_message_at DESC
    `);

    sendSuccess(res, { conversations });
  })
);

/**
 * GET /api/admin/messages/conversations/:conversationId - Get messages for a conversation
 */
router.get(
  '/messages/conversations/:conversationId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const conversationId = parseInt(req.params.conversationId, 10);

    if (isNaN(conversationId) || conversationId <= 0) {
      return errorResponse(res, 'Invalid conversation ID', 400, ErrorCodes.INVALID_ID);
    }

    const db = getDatabase();

    // Get conversation details
    const conversation = await db.get(`
      SELECT
        mt.*,
        c.company_name,
        c.contact_name,
        c.email as client_email
      FROM message_threads mt
      JOIN clients c ON mt.client_id = c.id
      WHERE mt.id = ?
    `, [conversationId]);

    if (!conversation) {
      return errorResponse(res, 'Conversation not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Get all messages in the conversation (including internal for admin view)
    const messages = await db.all(`
      SELECT
        m.id,
        m.message as content,
        m.sender_type as senderType,
        m.sender_name as senderName,
        m.attachments,
        m.is_internal as isInternal,
        CASE WHEN m.read_at IS NOT NULL THEN 1 ELSE 0 END as isRead,
        m.read_at as readAt,
        m.created_at as createdAt
      FROM messages m
      WHERE m.thread_id = ?
        AND m.context_type = 'general'
      ORDER BY m.created_at ASC
    `, [conversationId]);

    sendSuccess(res, {
      conversation,
      messages
    });
  })
);

/**
 * POST /api/admin/messages/conversations/:conversationId/read - Mark conversation as read
 */
router.post(
  '/messages/conversations/:conversationId/read',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const conversationId = parseInt(req.params.conversationId, 10);

    if (isNaN(conversationId) || conversationId <= 0) {
      return errorResponse(res, 'Invalid conversation ID', 400, ErrorCodes.INVALID_ID);
    }

    const db = getDatabase();

    // Mark all unread messages from clients as read
    await db.run(`
      UPDATE messages
      SET read_at = CURRENT_TIMESTAMP
      WHERE thread_id = ?
      AND sender_type != 'admin'
      AND read_at IS NULL
    `, [conversationId]);

    sendSuccess(res);
  })
);

/**
 * POST /api/admin/messages/conversations/:conversationId/messages - Send a message
 */
router.post(
  '/messages/conversations/:conversationId/messages',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const conversationId = parseInt(req.params.conversationId, 10);
    const { content, attachments } = req.body;

    if (isNaN(conversationId) || conversationId <= 0) {
      return errorResponse(res, 'Invalid conversation ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!content || content.trim().length === 0) {
      return errorResponse(res, 'Message content is required', 400, ErrorCodes.MISSING_CONTENT);
    }

    const db = getDatabase();

    // Get thread info
    const thread = await db.get('SELECT client_id, project_id FROM message_threads WHERE id = ?', [conversationId]);
    if (!thread) {
      return errorResponse(res, 'Conversation not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Resolve admin display name from users table (fallback to 'Admin')
    const adminUser = await db.get(
      'SELECT display_name FROM users WHERE id = ?',
      [req.user?.id]
    );
    const senderName = adminUser?.display_name || 'Admin';

    // Insert the message
    const result = await db.run(`
      INSERT INTO messages (
        thread_id,
        client_id,
        project_id,
        context_type,
        sender_type,
        sender_name,
        message,
        attachments,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'general', 'admin', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      conversationId,
      thread.client_id,
      thread.project_id,
      senderName,
      content.trim(),
      attachments ? JSON.stringify(attachments) : null
    ]);

    // Update thread's last_message_at
    await db.run(`
      UPDATE message_threads
      SET last_message_at = CURRENT_TIMESTAMP, last_message_by = 'admin'
      WHERE id = ?
    `, [conversationId]);

    // Get the created message
    const message = await db.get(`
      SELECT
        id,
        message as content,
        sender_type as senderType,
        sender_name as senderName,
        attachments,
        created_at as createdAt
      FROM messages
      WHERE id = ?
    `, [result.lastID]);

    sendSuccess(res, { message });
  })
);

/**
 * POST /api/admin/messages/conversations/:conversationId/star - Toggle star on conversation
 */
router.post(
  '/messages/conversations/:conversationId/star',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const conversationId = parseInt(req.params.conversationId, 10);
    const { starred } = req.body;

    if (isNaN(conversationId) || conversationId <= 0) {
      return errorResponse(res, 'Invalid conversation ID', 400, ErrorCodes.INVALID_ID);
    }

    const db = getDatabase();

    // Update the pinned status (using pinned_count as a flag for admin starring)
    await db.run(`
      UPDATE message_threads
      SET pinned_count = ?
      WHERE id = ?
    `, [starred ? 1 : 0, conversationId]);

    sendSuccess(res, { starred });
  })
);

export default router;
