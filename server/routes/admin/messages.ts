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
import { messageService } from '../../services/message-service.js';
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
    const conversations = await messageService.getAdminConversations();
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

    const conversation = await messageService.getAdminConversation(conversationId);

    if (!conversation) {
      return errorResponse(res, 'Conversation not found', 404, ErrorCodes.NOT_FOUND);
    }

    const messages = await messageService.getAdminConversationMessages(conversationId);

    sendSuccess(res, { conversation, messages });
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

    await messageService.markAdminConversationRead(conversationId);

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

    const message = await messageService.sendAdminMessage({
      conversationId,
      adminUserId: req.user?.id || 0,
      content,
      attachments
    });

    if (!message) {
      return errorResponse(res, 'Conversation not found', 404, ErrorCodes.NOT_FOUND);
    }

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

    await messageService.toggleConversationStar(conversationId, starred);

    sendSuccess(res, { starred });
  })
);

export default router;
