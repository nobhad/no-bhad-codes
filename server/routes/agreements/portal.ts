/**
 * ===============================================
 * AGREEMENT PORTAL ROUTES
 * ===============================================
 * @file server/routes/agreements/portal.ts
 *
 * Client-facing endpoints for the unified agreement flow.
 *
 * GET    /my                    — Get client's agreements
 * GET    /:id                   — Get enriched agreement with steps
 * POST   /:id/view              — Record client view
 * POST   /steps/:stepId/complete — Complete a step
 */

import { Router, Response } from 'express';
import { authenticateToken, requireClient } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { agreementService } from '../../services/agreement-service.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';

const router = Router();

/**
 * GET /api/agreements/my
 * Get all agreements for the authenticated client.
 */
router.get(
  '/my',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const clientId = req.user!.id;
    const agreements = await agreementService.getClientAgreements(clientId);
    sendSuccess(res, { agreements });
  })
);

/**
 * GET /api/agreements/:id
 * Get enriched agreement with step details.
 * Client can only see their own agreements.
 */
router.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const agreementId = Number(req.params.id);
    const isClient = req.user!.type === 'client';
    const clientId = isClient ? req.user!.id : undefined;

    const agreement = await agreementService.getEnrichedAgreement(agreementId, clientId);
    if (!agreement) {
      errorResponse(res, 'Agreement not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    sendSuccess(res, { agreement });
  })
);

/**
 * POST /api/agreements/:id/view
 * Record that the client viewed the agreement.
 */
router.post(
  '/:id/view',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const agreementId = Number(req.params.id);
    const clientId = req.user!.id;
    await agreementService.recordView(agreementId, clientId);
    sendSuccess(res, undefined, 'View recorded');
  })
);

/**
 * POST /api/agreements/steps/:stepId/complete
 * Complete an agreement step (client-facing).
 */
router.post(
  '/steps/:stepId/complete',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const stepId = Number(req.params.stepId);
    const clientId = req.user!.id;
    const { agreementId } = req.body;

    if (!agreementId) {
      errorResponse(res, 'agreementId is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    await agreementService.completeStep(Number(agreementId), stepId, clientId);
    sendSuccess(res, undefined, 'Step completed');
  })
);

export default router;
