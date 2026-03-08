/**
 * ===============================================
 * ENHANCED MESSAGING ROUTES
 * ===============================================
 * @file server/routes/messages/enhanced.ts
 *
 * Enhanced messaging features: mentions, reactions, subscriptions,
 * read receipts, pins, editing/deletion, archiving, search, internal messages
 */

import express from 'express';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { invalidateCache } from '../../middleware/cache.js';
import { messageService } from '../../services/message-service.js';
import { ErrorCodes, errorResponse, sendSuccess, sendCreated } from '../../utils/api-response.js';
import { MESSAGE_THREAD_COLUMNS, MESSAGE_COLUMNS, canAccessMessage, canAccessProject } from './helpers.js';

const router = express.Router();

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
      return errorResponse(res, 'Invalid message ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!(await canAccessMessage(req, messageId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
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
      return errorResponse(res, 'Invalid message ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!(await canAccessMessage(req, messageId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
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
      return errorResponse(res, 'Invalid message ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!(await canAccessMessage(req, messageId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    if (!reaction) {
      return errorResponse(res, 'Reaction is required', 400, ErrorCodes.MISSING_REACTION);
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
      return errorResponse(res, 'Invalid message ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!(await canAccessMessage(req, messageId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
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
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
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
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
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
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
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
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'Invalid message ID', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'message_ids array is required', 400, ErrorCodes.MISSING_MESSAGE_IDS);
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
      return errorResponse(res, 'Invalid message ID', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'Invalid thread ID', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'Invalid thread ID', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'Invalid message ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { thread_id } = req.body;

    if (!thread_id) {
      return errorResponse(res, 'thread_id is required', 400, ErrorCodes.MISSING_THREAD_ID);
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
      return errorResponse(res, 'Invalid message ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const threadId = parseInt(req.query.thread_id as string);

    if (!threadId) {
      return errorResponse(res, 'thread_id query parameter is required', 400, ErrorCodes.MISSING_THREAD_ID);
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
      return errorResponse(res, 'Invalid message ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { message: content } = req.body;

    if (!content || content.trim().length === 0) {
      return errorResponse(res, 'Message content is required', 400, ErrorCodes.MISSING_MESSAGE);
    }

    await messageService.editMessage(messageId, content.trim());
    const updatedMessage = { id: messageId, message: content.trim() };

    if (!updatedMessage) {
      return errorResponse(res, 'Cannot edit this message', 403, ErrorCodes.EDIT_FORBIDDEN);
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
      return errorResponse(res, 'Invalid message ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await messageService.deleteMessage(messageId, req.user!.email);
    const success = true;

    if (!success) {
      return errorResponse(res, 'Cannot delete this message', 403, ErrorCodes.DELETE_FORBIDDEN);
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
      return errorResponse(res, 'Invalid thread ID', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'Invalid thread ID', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'Search query is required', 400, ErrorCodes.MISSING_QUERY);
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
      return errorResponse(res, 'Invalid thread ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return errorResponse(res, 'Message content is required', 400, ErrorCodes.MISSING_MESSAGE);
    }

    const db = getDatabase();

    // Verify thread exists
    const thread = await db.get(`SELECT ${MESSAGE_THREAD_COLUMNS} FROM active_message_threads WHERE id = ?`, [threadId]);
    if (!thread) {
      return errorResponse(res, 'Thread not found', 404, ErrorCodes.THREAD_NOT_FOUND);
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
      return errorResponse(res, 'Invalid thread ID', 400, ErrorCodes.VALIDATION_ERROR);
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

export { router as enhancedRouter };
export default router;
