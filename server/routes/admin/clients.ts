/**
 * ===============================================
 * ADMIN CLIENTS ROUTES
 * ===============================================
 * @file server/routes/admin/clients.ts
 *
 * Admin client listing endpoint.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/api-response.js';
import { clientService } from '../../services/client-service.js';

const router = express.Router();

/**
 * GET /api/admin/clients - List all clients
 */
router.get(
  '/clients',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const { clients, stats } = await clientService.getAdminClientListing();
    sendSuccess(res, { clients, stats });
  })
);

export default router;
