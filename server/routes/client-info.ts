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
import { errorResponse, sendSuccess } from '../utils/api-response.js';

const router = express.Router();

// =====================================================
// CLIENT ENDPOINTS
// =====================================================

/**
 * Get the authenticated client's info status
 */
router.get(
  '/my-status',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    const status = await clientInfoService.getClientInfoStatus(clientId);

    if (!status) {
      return errorResponse(res, 'Client not found', 404);
    }

    sendSuccess(res, { status });
  })
);

/**
 * Get missing items for the authenticated client
 */
router.get(
  '/my-missing-items',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    const items = await clientInfoService.getMissingItems(clientId);

    sendSuccess(res, { items });
  })
);

/**
 * Get onboarding progress for the authenticated client
 */
router.get(
  '/onboarding',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    const progress = await clientInfoService.getOnboardingProgress(clientId);

    sendSuccess(res, { progress });
  })
);

/**
 * Save onboarding progress
 */
router.post(
  '/onboarding/save',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    const { step, stepData, projectId } = req.body;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    if (typeof step !== 'number' || step < 1 || step > 5) {
      return errorResponse(res, 'step must be a number between 1 and 5', 400);
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
 * Complete onboarding
 */
router.post(
  '/onboarding/complete',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    const { finalData } = req.body;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    const progress = await clientInfoService.completeOnboarding(clientId, finalData);

    sendSuccess(res, { progress }, 'Onboarding completed');
  })
);

// =====================================================
// ADMIN ENDPOINTS
// =====================================================

/**
 * Get info status for all clients (admin dashboard)
 */
router.get(
  '/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const minCompleteness = req.query.min_completeness
      ? parseInt(req.query.min_completeness as string)
      : undefined;
    const maxCompleteness = req.query.max_completeness
      ? parseInt(req.query.max_completeness as string)
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
 * Get info status for a specific client (admin)
 */
router.get(
  '/status/:clientId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId);

    if (isNaN(clientId)) {
      return errorResponse(res, 'Invalid client ID', 400);
    }

    const status = await clientInfoService.getClientInfoStatus(clientId);

    if (!status) {
      return errorResponse(res, 'Client not found', 404);
    }

    sendSuccess(res, { status });
  })
);

/**
 * Get missing items for a specific client (admin)
 */
router.get(
  '/missing-items/:clientId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId);

    if (isNaN(clientId)) {
      return errorResponse(res, 'Invalid client ID', 400);
    }

    const items = await clientInfoService.getMissingItems(clientId);

    sendSuccess(res, { items });
  })
);

/**
 * Recalculate completeness for a client (admin)
 */
router.post(
  '/recalculate/:clientId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId);

    if (isNaN(clientId)) {
      return errorResponse(res, 'Invalid client ID', 400);
    }

    const completeness = await clientInfoService.calculateCompleteness(clientId);

    sendSuccess(res, { completeness }, 'Completeness recalculated');
  })
);

/**
 * Get onboarding progress for a specific client (admin)
 */
router.get(
  '/onboarding/:clientId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId);

    if (isNaN(clientId)) {
      return errorResponse(res, 'Invalid client ID', 400);
    }

    const progress = await clientInfoService.getOnboardingProgress(clientId);

    sendSuccess(res, { progress });
  })
);

/**
 * Reset onboarding for a client (admin)
 */
router.delete(
  '/onboarding/:clientId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId);

    if (isNaN(clientId)) {
      return errorResponse(res, 'Invalid client ID', 400);
    }

    await clientInfoService.resetOnboarding(clientId);

    sendSuccess(res, undefined, 'Onboarding reset');
  })
);

export { router as clientInfoRouter };
export default router;
