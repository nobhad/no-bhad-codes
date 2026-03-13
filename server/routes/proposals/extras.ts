/**
 * ===============================================
 * PROPOSAL EXTRAS ROUTES
 * ===============================================
 * @file server/routes/proposals/extras.ts
 *
 * Comments, activity, custom items, discounts,
 * expiration, send, and client-facing endpoints.
 */

import express, { Request, Response } from 'express';
import {
  asyncHandler,
  authenticateToken,
  requireAdmin,
  canAccessProposal,
  proposalService,
  signatureRateLimiter,
  ErrorCodes,
  errorResponse,
  sendSuccess,
  sendCreated
} from './helpers.js';
import type { AuthenticatedRequest } from './helpers.js';

const router = express.Router();

// ===================================
// COMMENT ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/{id}/comments:
 *   get:
 *     tags: [Proposals]
 *     summary: Get comments for a proposal
 *     description: Get comments for a proposal.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/:id/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Authorization check for non-admin users
    if (req.user?.type !== 'admin' && !(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const includeInternal = req.user!.type === 'admin' && req.query.includeInternal === 'true';
    const comments = await proposalService.getComments(proposalId, includeInternal);
    sendSuccess(res, { comments });
  })
);

/**
 * @swagger
 * /api/proposals/{id}/comments:
 *   post:
 *     tags: [Proposals]
 *     summary: Add comment
 *     description: Add comment.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/:id/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Authorization check for non-admin users
    if (req.user?.type !== 'admin' && !(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { content, isInternal, parentCommentId } = req.body;
    if (!content) {
      return errorResponse(res, 'Comment content is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const comment = await proposalService.addComment(
      proposalId,
      req.user!.type === 'admin' ? 'admin' : 'client',
      req.user!.email,
      content,
      req.user!.email,
      isInternal && req.user!.type === 'admin',
      parentCommentId
    );
    sendCreated(res, { comment }, 'Comment added successfully');
  })
);

/**
 * @swagger
 * /api/proposals/comments/{commentId}:
 *   delete:
 *     tags: [Proposals]
 *     summary: Delete comment
 *     description: Delete comment.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/comments/:commentId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const commentId = parseInt(req.params.commentId, 10);

    if (isNaN(commentId) || commentId <= 0) {
      return errorResponse(res, 'Invalid comment ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await proposalService.deleteComment(commentId);
    sendSuccess(res, undefined, 'Comment deleted successfully');
  })
);

// ===================================
// ACTIVITY ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/{id}/activities:
 *   get:
 *     tags: [Proposals]
 *     summary: Get activities for a proposal
 *     description: Get activities for a proposal.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/:id/activities',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const activities = await proposalService.getActivities(proposalId, limit);
    sendSuccess(res, { activities });
  })
);

/**
 * @swagger
 * /api/proposals/{id}/track-view:
 *   post:
 *     tags: [Proposals]
 *     summary: Track view (public with rate limiting)
 *     description: Track view (public with rate limiting).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/:id/track-view',
  signatureRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    // Validate proposal ID
    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Truncate user agent to prevent log bloat
    const userAgent = req.get('User-Agent') || '';
    await proposalService.trackView(proposalId, req.ip, userAgent.substring(0, 500));
    sendSuccess(res, undefined, 'View tracked');
  })
);

// ===================================
// CUSTOM ITEMS ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/{id}/custom-items:
 *   get:
 *     tags: [Proposals]
 *     summary: Get custom items for a proposal
 *     description: Get custom items for a proposal.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/:id/custom-items',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Authorization check for non-admin users
    if (req.user?.type !== 'admin' && !(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const items = await proposalService.getCustomItems(proposalId);
    sendSuccess(res, { items });
  })
);

/**
 * @swagger
 * /api/proposals/{id}/custom-items:
 *   post:
 *     tags: [Proposals]
 *     summary: Add custom item
 *     description: Add custom item.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/:id/custom-items',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { description, unitPrice } = req.body;
    if (!description || unitPrice === undefined) {
      return errorResponse(res, 'description and unitPrice are required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const item = await proposalService.addCustomItem(proposalId, req.body);
    sendCreated(res, { item }, 'Custom item added successfully');
  })
);

/**
 * @swagger
 * /api/proposals/custom-items/{itemId}:
 *   put:
 *     tags: [Proposals]
 *     summary: Update custom item
 *     description: Update custom item.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/custom-items/:itemId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const itemId = parseInt(req.params.itemId, 10);

    if (isNaN(itemId) || itemId <= 0) {
      return errorResponse(res, 'Invalid item ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const item = await proposalService.updateCustomItem(itemId, req.body);
    sendSuccess(res, { item }, 'Custom item updated successfully');
  })
);

/**
 * @swagger
 * /api/proposals/custom-items/{itemId}:
 *   delete:
 *     tags: [Proposals]
 *     summary: Delete custom item
 *     description: Delete custom item.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/custom-items/:itemId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const itemId = parseInt(req.params.itemId, 10);

    if (isNaN(itemId) || itemId <= 0) {
      return errorResponse(res, 'Invalid item ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await proposalService.deleteCustomItem(itemId);
    sendSuccess(res, undefined, 'Custom item deleted successfully');
  })
);

// ===================================
// DISCOUNT ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/{id}/discount:
 *   post:
 *     tags: [Proposals]
 *     summary: Apply discount
 *     description: Apply discount.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/:id/discount',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { type, value, reason } = req.body;
    if (!type || value === undefined) {
      return errorResponse(res, 'type and value are required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (!['percentage', 'fixed'].includes(type)) {
      return errorResponse(res, 'type must be percentage or fixed', 400, ErrorCodes.VALIDATION_ERROR);
    }
    await proposalService.applyDiscount(proposalId, type, value, reason);
    sendSuccess(res, undefined, 'Discount applied successfully');
  })
);

/**
 * @swagger
 * /api/proposals/{id}/discount:
 *   delete:
 *     tags: [Proposals]
 *     summary: Remove discount
 *     description: Remove discount.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/:id/discount',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await proposalService.removeDiscount(proposalId);
    sendSuccess(res, undefined, 'Discount removed successfully');
  })
);

// ===================================
// EXPIRATION & SEND ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/{id}/expiration:
 *   put:
 *     tags: [Proposals]
 *     summary: Set expiration date
 *     description: Set expiration date.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/:id/expiration',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { expirationDate } = req.body;
    if (!expirationDate) {
      return errorResponse(res, 'expirationDate is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    await proposalService.setExpiration(proposalId, expirationDate);
    sendSuccess(res, undefined, 'Expiration date set successfully');
  })
);

/**
 * @swagger
 * /api/proposals/{id}/send:
 *   post:
 *     tags: [Proposals]
 *     summary: Mark proposal as sent
 *     description: Mark proposal as sent.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/:id/send',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await proposalService.markProposalSent(proposalId, req.user!.email);
    sendSuccess(res, undefined, 'Proposal marked as sent');
  })
);

/**
 * @swagger
 * /api/proposals/{id}/access-token:
 *   post:
 *     tags: [Proposals]
 *     summary: Generate access token for client viewing
 *     description: Generate access token for client viewing.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/:id/access-token',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const token = await proposalService.generateAccessToken(proposalId);
    sendSuccess(res, { accessToken: token });
  })
);

/**
 * @swagger
 * /api/proposals/view/{token}:
 *   get:
 *     tags: [Proposals]
 *     summary: Get proposal by access token (public)
 *     description: Get proposal by access token (public).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/view/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const proposalId = await proposalService.getProposalByAccessToken(token);
    if (!proposalId) {
      return errorResponse(res, 'Invalid access token', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    // Track view (truncate User-Agent to prevent log bloat)
    const userAgent = (req.get('User-Agent') || '').substring(0, 500);
    await proposalService.trackView(proposalId, req.ip, userAgent);
    sendSuccess(res, { proposalId });
  })
);

/**
 * @swagger
 * /api/proposals/process-expired:
 *   post:
 *     tags: [Proposals]
 *     summary: Process expired proposals (admin or scheduler)
 *     description: Process expired proposals (admin or scheduler).
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/process-expired',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const count = await proposalService.processExpiredProposals();
    sendSuccess(res, { count }, `Processed ${count} expired proposal(s)`);
  })
);

/**
 * @swagger
 * /api/proposals/due-for-reminder:
 *   get:
 *     tags: [Proposals]
 *     summary: Get proposals due for reminder
 *     description: Get proposals due for reminder.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/due-for-reminder',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const daysOldParam = req.query.daysOld ? parseInt(req.query.daysOld as string, 10) : 7;
    const daysOld = isNaN(daysOldParam) || daysOldParam < 1 || daysOldParam > 365 ? 7 : daysOldParam;
    const proposalIds = await proposalService.getProposalsDueForReminder(daysOld);
    sendSuccess(res, { proposalIds });
  })
);

/**
 * @swagger
 * /api/proposals/{id}/reminder-sent:
 *   post:
 *     tags: [Proposals]
 *     summary: Mark reminder sent
 *     description: Mark reminder sent.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/:id/reminder-sent',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await proposalService.markReminderSent(proposalId);
    sendSuccess(res, undefined, 'Reminder marked as sent');
  })
);

// ===================================
// CLIENT-FACING PROPOSALS
// ===================================

/**
 * @swagger
 * /api/proposals/my:
 *   get:
 *     tags: [Proposals]
 *     summary: GET /api/proposals/my - Get proposals for the authenticated client
 *     description: GET /api/proposals/my - Get proposals for the authenticated client.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/my',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clientId = req.user?.id;

    if (!clientId || req.user?.type === 'admin') {
      return sendSuccess(res, { proposals: [] });
    }

    const proposals = await proposalService.getClientProposalsList(clientId);

    sendSuccess(res, { proposals });
  })
);

export { router as extrasRouter };
