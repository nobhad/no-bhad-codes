/**
 * ===============================================
 * RETAINER PORTAL ROUTES
 * ===============================================
 * @file server/routes/retainers/portal.ts
 *
 * Client-facing endpoints for viewing retainer data.
 *
 * GET    /my           — Client's active retainers
 * GET    /my/:id       — Single retainer with current period
 */

import { Router, Response } from 'express';
import { authenticateToken, requireClient } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { retainerService } from '../../services/retainer-service.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';

const router = Router();

/**
 * GET /api/retainers/my
 * Get all active retainers for the authenticated client.
 */
router.get(
  '/my',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const clientId = req.user!.id;
    const retainers = await retainerService.getByClient(clientId);
    sendSuccess(res, { retainers });
  })
);

/**
 * GET /api/retainers/my/:id
 * Get a single retainer with current period (client can only see their own).
 */
router.get(
  '/my/:id',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const clientId = req.user!.id;
    const retainer = await retainerService.getById(Number(req.params.id));

    if (!retainer || retainer.client_id !== clientId) {
      errorResponse(res, 'Retainer not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    sendSuccess(res, { retainer });
  })
);

export default router;
