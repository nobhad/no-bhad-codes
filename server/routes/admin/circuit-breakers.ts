/**
 * ===============================================
 * ADMIN — CIRCUIT BREAKER STATE
 * ===============================================
 * @file server/routes/admin/circuit-breakers.ts
 *
 * GET /api/admin/circuit-breakers
 *
 * Lists every registered CircuitBreaker with its current state,
 * failure counts, and last success/failure timestamps. Use this to
 * answer "is the Stripe outage currently tripping our breaker?"
 * without tailing logs.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/api-response.js';
import { listCircuitBreakers } from '../../utils/circuit-breaker.js';

const router = express.Router();

router.get(
  '/circuit-breakers',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    sendSuccess(res, { breakers: listCircuitBreakers() });
  })
);

export default router;
