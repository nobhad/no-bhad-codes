/**
 * ===============================================
 * CLIENT HEALTH & NOTIFICATION ROUTES
 * ===============================================
 * @file server/routes/clients/health.ts
 *
 * Health scoring, at-risk clients, client stats,
 * timeline, and notification preferences & history.
 */

import {
  express,
  authenticateToken,
  requireAdmin,
  requireClient,
  type AuthenticatedRequest,
  asyncHandler,
  errorResponse,
  sendSuccess,
  sendPaginated,
  parsePaginationQuery,
  ErrorCodes,
  invalidateCache,
  notificationPreferencesService,
  clientService,
  timelineService
} from './helpers.js';

const router = express.Router();

// =====================================================
// HEALTH SCORING
// =====================================================

/**
 * @swagger
 * /api/clients/{id}/health:
 *   get:
 *     tags: [Clients]
 *     summary: GET /clients/:id/health - Get health score for a client
 *     description: GET /clients/:id/health - Get health score for a client.
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
  '/:id/health',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    try {
      const health = await clientService.calculateHealthScore(clientId);
      sendSuccess(res, { health });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Client not found') {
        return errorResponse(res, 'Client not found', 404, ErrorCodes.NOT_FOUND);
      }
      throw err;
    }
  })
);

/**
 * @swagger
 * /api/clients/{id}/health/recalculate:
 *   post:
 *     tags: [Clients]
 *     summary: POST /clients/:id/health/recalculate - Recalculate health score for a client
 *     description: POST /clients/:id/health/recalculate - Recalculate health score for a client.
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
  '/:id/health/recalculate',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const health = await clientService.updateHealthStatus(clientId);
    sendSuccess(res, { health });
  })
);

/**
 * @swagger
 * /api/clients/at-risk:
 *   get:
 *     tags: [Clients]
 *     summary: GET /clients/at-risk - Get all at-risk clients
 *     description: GET /clients/at-risk - Get all at-risk clients.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/at-risk',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clients = await clientService.getAtRiskClients();
    sendSuccess(res, { clients });
  })
);

/**
 * @swagger
 * /api/clients/{id}/stats:
 *   get:
 *     tags: [Clients]
 *     summary: GET /clients/:id/stats - Get comprehensive stats for a client
 *     description: GET /clients/:id/stats - Get comprehensive stats for a client.
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
  '/:id/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const stats = await clientService.getClientStats(clientId);
    sendSuccess(res, { stats });
  })
);

// =====================================================
// NOTIFICATION PREFERENCES & TIMELINE
// =====================================================

/**
 * @swagger
 * /api/clients/me/timeline:
 *   get:
 *     tags: [Clients]
 *     summary: GET /me/timeline - Get current client's activity timeline
 *     description: GET /me/timeline - Get current client's activity timeline.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/me/timeline',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const projectId = req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined;

    if (projectId !== undefined && isNaN(projectId)) {
      return errorResponse(res, 'Invalid query parameters', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { page, perPage, limit, offset } = parsePaginationQuery(
      req.query as Record<string, unknown>
    );

    const { events, total } = await timelineService.getClientTimeline(req.user!.id, {
      projectId,
      limit,
      offset
    });

    sendPaginated(res, events, { page, perPage, total });
  })
);

/**
 * @swagger
 * /api/clients/me/timeline/summary:
 *   get:
 *     tags: [Clients]
 *     summary: GET /me/timeline/summary - Get recent activity summary for dashboard
 *     description: GET /me/timeline/summary - Get recent activity summary for dashboard.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/me/timeline/summary',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    if (isNaN(days) || days <= 0) {
      return errorResponse(res, 'Invalid days parameter', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const summary = await timelineService.getRecentActivitySummary(req.user!.id, days);

    sendSuccess(res, summary);
  })
);

/**
 * @swagger
 * /api/clients/me/notifications:
 *   get:
 *     tags: [Clients]
 *     summary: GET /me/notifications - Get current client's notification preferences
 *     description: GET /me/notifications - Get current client's notification preferences.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/me/notifications',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const preferences = await notificationPreferencesService.getPreferences(req.user!.id, 'client');
    sendSuccess(res, { preferences });
  })
);

/**
 * @swagger
 * /api/clients/me/notifications:
 *   put:
 *     tags: [Clients]
 *     summary: PUT /me/notifications - Update current client's notification preferences
 *     description: PUT /me/notifications - Update current client's notification preferences.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/me/notifications',
  authenticateToken,
  invalidateCache(['notifications']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const preferences = await notificationPreferencesService.updatePreferences(
      req.user!.id,
      'client',
      req.body
    );

    sendSuccess(res, { preferences }, 'Notification preferences updated');
  })
);

/**
 * @swagger
 * /api/clients/me/notifications/history:
 *   get:
 *     tags: [Clients]
 *     summary: GET /me/notifications/history - Get notification history for current client
 *     description: GET /me/notifications/history - Get notification history for current client.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/me/notifications/history',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    if (isNaN(limit) || limit < 0) {
      return errorResponse(res, 'Invalid limit parameter', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const notifications = await clientService.getClientNotificationHistory(req.user!.id, limit);

    sendSuccess(res, { notifications });
  })
);

/**
 * @swagger
 * /api/clients/me/notifications/{id}/read:
 *   put:
 *     tags: [Clients]
 *     summary: PUT /me/notifications/:id/read - Mark a single notification as read
 *     description: PUT /me/notifications/:id/read - Mark a single notification as read.
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
  '/me/notifications/:id/read',
  authenticateToken,
  requireClient,
  invalidateCache(['notifications']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const notificationId = parseInt(req.params.id, 10);
    if (isNaN(notificationId) || notificationId <= 0) {
      return errorResponse(res, 'Invalid notification ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const changes = await clientService.markClientNotificationRead(notificationId, req.user!.id);

    if (changes === 0) {
      return errorResponse(res, 'Notification not found', 404, ErrorCodes.NOT_FOUND);
    }

    sendSuccess(res, undefined, 'Notification marked as read');
  })
);

/**
 * @swagger
 * /api/clients/me/notifications/mark-all-read:
 *   put:
 *     tags: [Clients]
 *     summary: PUT /me/notifications/mark-all-read - Mark all notifications as read
 *     description: PUT /me/notifications/mark-all-read - Mark all notifications as read.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/me/notifications/mark-all-read',
  authenticateToken,
  requireClient,
  invalidateCache(['notifications']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    await clientService.markAllClientNotificationsRead(req.user!.id);

    sendSuccess(res, undefined, 'All notifications marked as read');
  })
);

export { router as healthRouter };
export default router;
