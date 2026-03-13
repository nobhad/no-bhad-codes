/**
 * ===============================================
 * PAYMENT SCHEDULE ROUTES - CLIENT
 * ===============================================
 * @file server/routes/payment-schedules/client.ts
 *
 * Client-facing read-only endpoints for viewing payment schedules.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { paymentScheduleService } from '../../services/payment-schedule-service.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';

const router = express.Router();

// =====================================================
// CLIENT ENDPOINTS
// =====================================================

/**
 * GET /api/payment-schedules/my
 * Get all installments for the authenticated client
 */
router.get(
  '/my',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    if (!clientId) {
      errorResponse(res, 'Client authentication required', 401, ErrorCodes.UNAUTHORIZED);
      return;
    }

    const installments = await paymentScheduleService.getByClient(clientId);
    sendSuccess(res, { installments });
  })
);

/**
 * GET /api/payment-schedules/my/summary
 * Get payment summary for the authenticated client
 */
router.get(
  '/my/summary',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    if (!clientId) {
      errorResponse(res, 'Client authentication required', 401, ErrorCodes.UNAUTHORIZED);
      return;
    }

    const summary = await paymentScheduleService.getClientSummary(clientId);
    sendSuccess(res, { summary });
  })
);

export default router;
