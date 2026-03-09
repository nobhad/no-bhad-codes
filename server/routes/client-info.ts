/**
 * ===============================================
 * CLIENT INFO ROUTES
 * ===============================================
 * @file server/routes/client-info.ts
 *
 * API endpoints for client information status,
 * completeness tracking, and onboarding progress.
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { clientInfoService, OnboardingStatus } from '../services/client-info-service.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../utils/api-response.js';

const router = express.Router();

// =====================================================
// CLIENT ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/client-info/my-status:
 *   get:
 *     tags: [Clients]
 *     summary: Get client info status
 *     description: Returns the info completeness status for the authenticated client.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Client info status
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Client not found
 */
router.get(
  '/my-status',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.NOT_AUTHENTICATED);
    }

    const status = await clientInfoService.getClientInfoStatus(clientId);

    if (!status) {
      return errorResponse(res, 'Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    sendSuccess(res, { status });
  })
);

/**
 * @swagger
 * /api/client-info/my-missing-items:
 *   get:
 *     tags: [Clients]
 *     summary: Get missing items for client
 *     description: Returns a list of missing information items for the authenticated client.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of missing items
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/my-missing-items',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.NOT_AUTHENTICATED);
    }

    const items = await clientInfoService.getMissingItems(clientId);

    sendSuccess(res, { items });
  })
);

/**
 * @swagger
 * /api/client-info/onboarding:
 *   get:
 *     tags: [Clients]
 *     summary: Get onboarding progress
 *     description: Returns the onboarding progress for the authenticated client.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding progress
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/onboarding',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.NOT_AUTHENTICATED);
    }

    const progress = await clientInfoService.getOnboardingProgress(clientId);

    sendSuccess(res, { progress });
  })
);

/**
 * @swagger
 * /api/client-info/onboarding/save:
 *   post:
 *     tags: [Clients]
 *     summary: Save onboarding progress
 *     description: Saves the current onboarding step progress for the authenticated client.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [step]
 *             properties:
 *               step:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               stepData:
 *                 type: object
 *               projectId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Progress saved
 *       400:
 *         description: Invalid step number
 */
router.post(
  '/onboarding/save',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    const { step, stepData, projectId } = req.body;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.NOT_AUTHENTICATED);
    }

    if (typeof step !== 'number' || step < 1 || step > 5) {
      return errorResponse(res, 'step must be a number between 1 and 5', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const progress = await clientInfoService.saveOnboardingProgress(
      clientId,
      step,
      stepData || {},
      projectId
    );

    sendSuccess(res, { progress }, 'Progress saved');
  })
);

/**
 * @swagger
 * /api/client-info/onboarding/complete:
 *   post:
 *     tags: [Clients]
 *     summary: Complete onboarding
 *     description: Marks the onboarding process as complete for the authenticated client.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               finalData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Onboarding completed
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/onboarding/complete',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    const { finalData } = req.body;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.NOT_AUTHENTICATED);
    }

    const progress = await clientInfoService.completeOnboarding(clientId, finalData);

    sendSuccess(res, { progress }, 'Onboarding completed');
  })
);

// =====================================================
// ADMIN ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/client-info/status:
 *   get:
 *     tags: [Clients]
 *     summary: Get info status for all clients
 *     description: Returns info completeness status for all clients with optional filtering.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: min_completeness
 *         schema:
 *           type: integer
 *       - in: query
 *         name: max_completeness
 *         schema:
 *           type: integer
 *       - in: query
 *         name: onboarding_status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of client info statuses
 */
router.get(
  '/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const minCompleteness = req.query.min_completeness
      ? parseInt(req.query.min_completeness as string, 10)
      : undefined;
    const maxCompleteness = req.query.max_completeness
      ? parseInt(req.query.max_completeness as string, 10)
      : undefined;
    const onboardingStatus = req.query.onboarding_status as OnboardingStatus | undefined;

    const statuses = await clientInfoService.getAllClientsInfoStatus({
      minCompleteness,
      maxCompleteness,
      onboardingStatus
    });

    sendSuccess(res, { statuses });
  })
);

/**
 * @swagger
 * /api/client-info/status/{clientId}:
 *   get:
 *     tags: [Clients]
 *     summary: Get info status for a specific client
 *     description: Returns info completeness status for a specific client.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Client info status
 *       404:
 *         description: Client not found
 */
router.get(
  '/status/:clientId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const status = await clientInfoService.getClientInfoStatus(clientId);

    if (!status) {
      return errorResponse(res, 'Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    sendSuccess(res, { status });
  })
);

/**
 * @swagger
 * /api/client-info/missing-items/{clientId}:
 *   get:
 *     tags: [Clients]
 *     summary: Get missing items for a specific client
 *     description: Returns a list of missing information items for a specific client.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of missing items
 */
router.get(
  '/missing-items/:clientId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const items = await clientInfoService.getMissingItems(clientId);

    sendSuccess(res, { items });
  })
);

/**
 * @swagger
 * /api/client-info/recalculate/{clientId}:
 *   post:
 *     tags: [Clients]
 *     summary: Recalculate completeness for a client
 *     description: Recalculates the information completeness score for a specific client.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Completeness recalculated
 */
router.post(
  '/recalculate/:clientId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const completeness = await clientInfoService.calculateCompleteness(clientId);

    sendSuccess(res, { completeness }, 'Completeness recalculated');
  })
);

/**
 * @swagger
 * /api/client-info/onboarding/{clientId}:
 *   get:
 *     tags: [Clients]
 *     summary: Get onboarding progress for a specific client
 *     description: Returns the onboarding progress for a specific client.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Onboarding progress
 */
router.get(
  '/onboarding/:clientId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const progress = await clientInfoService.getOnboardingProgress(clientId);

    sendSuccess(res, { progress });
  })
);

/**
 * @swagger
 * /api/client-info/onboarding/{clientId}:
 *   delete:
 *     tags: [Clients]
 *     summary: Reset onboarding for a client
 *     description: Resets the onboarding progress for a specific client.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Onboarding reset
 */
router.delete(
  '/onboarding/:clientId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await clientInfoService.resetOnboarding(clientId);

    sendSuccess(res, undefined, 'Onboarding reset');
  })
);

export { router as clientInfoRouter };
export default router;
