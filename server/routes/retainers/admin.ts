/**
 * ===============================================
 * RETAINER ADMIN ROUTES
 * ===============================================
 * @file server/routes/retainers/admin.ts
 *
 * Admin endpoints for managing retainer agreements.
 *
 * GET    /                — List all retainers
 * POST   /                — Create retainer
 * GET    /summary         — Summary stats
 * GET    /:id             — Single retainer with current period
 * PUT    /:id             — Update retainer
 * DELETE /:id             — Cancel retainer
 * GET    /:id/periods     — Period history
 * POST   /:id/close-period — Close current + create next
 * POST   /:id/pause       — Pause retainer
 * POST   /:id/resume      — Resume retainer
 */

import { Router, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { retainerService } from '../../services/retainer-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';

const router = Router();

/**
 * GET /api/retainers
 * List all retainers. Optionally filter by ?status= or ?clientId=
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const status = req.query.status as string | undefined;
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    const retainers = await retainerService.list({ status, clientId });
    sendSuccess(res, { retainers });
  })
);

/**
 * POST /api/retainers
 * Create a new retainer.
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const {
      clientId,
      projectId,
      retainerType,
      monthlyHours,
      monthlyAmount,
      rolloverEnabled,
      maxRolloverHours,
      startDate,
      endDate,
      billingDay,
      autoInvoice,
      notes
    } = req.body;

    if (!clientId || !projectId || !monthlyAmount || !startDate) {
      errorResponse(res, 'clientId, projectId, monthlyAmount, and startDate are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const retainerId = await retainerService.create({
      clientId,
      projectId,
      retainerType: retainerType || 'hourly',
      monthlyHours,
      monthlyAmount,
      rolloverEnabled,
      maxRolloverHours,
      startDate,
      endDate,
      billingDay,
      autoInvoice,
      notes
    });

    sendCreated(res, { retainerId }, 'Retainer created');
  })
);

/**
 * GET /api/retainers/summary
 * Aggregate retainer stats.
 */
router.get(
  '/summary',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: JWTAuthRequest, res: Response) => {
    const summary = await retainerService.getSummary();
    sendSuccess(res, { summary });
  })
);

/**
 * GET /api/retainers/:id
 * Single retainer with current period details.
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const retainer = await retainerService.getById(Number(req.params.id));
    if (!retainer) {
      errorResponse(res, 'Retainer not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }
    sendSuccess(res, { retainer });
  })
);

/**
 * PUT /api/retainers/:id
 * Update a retainer.
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const id = Number(req.params.id);
    await retainerService.update(id, req.body);
    const retainer = await retainerService.getById(id);
    sendSuccess(res, { retainer }, 'Retainer updated');
  })
);

/**
 * DELETE /api/retainers/:id
 * Cancel a retainer (soft-cancel, sets status to cancelled).
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    await retainerService.cancel(Number(req.params.id));
    sendSuccess(res, undefined, 'Retainer cancelled');
  })
);

/**
 * GET /api/retainers/:id/periods
 * Get all billing periods for a retainer.
 */
router.get(
  '/:id/periods',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const periods = await retainerService.getPeriods(Number(req.params.id));
    sendSuccess(res, { periods });
  })
);

/**
 * POST /api/retainers/:id/close-period
 * Close current period and create the next one.
 */
router.post(
  '/:id/close-period',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    await retainerService.closePeriod(Number(req.params.id));
    sendSuccess(res, undefined, 'Period closed and next period created');
  })
);

/**
 * POST /api/retainers/:id/pause
 * Pause a retainer.
 */
router.post(
  '/:id/pause',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    await retainerService.pause(Number(req.params.id));
    sendSuccess(res, undefined, 'Retainer paused');
  })
);

/**
 * POST /api/retainers/:id/resume
 * Resume a paused retainer.
 */
router.post(
  '/:id/resume',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    await retainerService.resume(Number(req.params.id));
    sendSuccess(res, undefined, 'Retainer resumed');
  })
);

export default router;
