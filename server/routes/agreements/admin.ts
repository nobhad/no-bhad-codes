/**
 * ===============================================
 * AGREEMENT ADMIN ROUTES
 * ===============================================
 * @file server/routes/agreements/admin.ts
 *
 * Admin endpoints for managing project agreements.
 *
 * GET    /                     — List all agreements (optionally by projectId)
 * POST   /                     — Create agreement with custom steps
 * POST   /from-template        — Create agreement from template
 * POST   /:id/send             — Send agreement to client
 * POST   /:id/cancel           — Cancel agreement
 */

import { Router, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { agreementService } from '../../services/agreement-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';

const router = Router();

/**
 * GET /api/agreements
 * List agreements (admin). Optionally filter by ?projectId=
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const agreements = await agreementService.getAgreements(projectId);
    sendSuccess(res, { agreements });
  })
);

/**
 * POST /api/agreements
 * Create a new agreement with custom steps.
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const { projectId, clientId, name, proposalId, contractId, questionnaireId, welcomeMessage, steps } = req.body;

    if (!projectId || !clientId || !steps || !Array.isArray(steps) || steps.length === 0) {
      errorResponse(res, 'projectId, clientId, and steps are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const agreementId = await agreementService.createAgreement({
      projectId,
      clientId,
      name,
      proposalId,
      contractId,
      questionnaireId,
      welcomeMessage,
      steps
    });

    sendCreated(res, { agreementId }, 'Agreement created');
  })
);

/**
 * POST /api/agreements/from-template
 * Create an agreement from a template (auto-detects project entities).
 */
router.post(
  '/from-template',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const { projectId, clientId, templateType } = req.body;

    if (!projectId || !clientId) {
      errorResponse(res, 'projectId and clientId are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const agreementId = await agreementService.createFromTemplate({
      projectId,
      clientId,
      templateType
    });

    sendCreated(res, { agreementId }, 'Agreement created from template');
  })
);

/**
 * POST /api/agreements/:id/send
 * Send agreement to client.
 */
router.post(
  '/:id/send',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const agreementId = Number(req.params.id);
    await agreementService.sendAgreement(agreementId);
    sendSuccess(res, undefined, 'Agreement sent');
  })
);

/**
 * POST /api/agreements/:id/cancel
 * Cancel an agreement.
 */
router.post(
  '/:id/cancel',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const agreementId = Number(req.params.id);
    await agreementService.cancelAgreement(agreementId);
    sendSuccess(res, undefined, 'Agreement cancelled');
  })
);

export default router;
