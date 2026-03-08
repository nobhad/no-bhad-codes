/**
 * ===============================================
 * ANALYTICS REPORTS & SCHEDULES ROUTES
 * ===============================================
 * @file server/routes/analytics/reports.ts
 *
 * Saved reports CRUD and report schedule management endpoints.
 *
 * ENDPOINTS:
 * - GET    /reports                         - List saved reports
 * - POST   /reports                         - Create saved report
 * - GET    /reports/:id                     - Get saved report
 * - PUT    /reports/:id                     - Update saved report
 * - DELETE /reports/:id                     - Delete saved report
 * - POST   /reports/:id/favorite            - Toggle report favorite
 * - POST   /reports/:id/run                 - Run a saved report
 * - GET    /reports/:reportId/schedules     - List schedules for report
 * - POST   /reports/:reportId/schedules     - Create schedule for report
 * - PUT    /schedules/:id                   - Update schedule
 * - DELETE /schedules/:id                   - Delete schedule
 * - POST   /schedules/process               - Process due schedules
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { analyticsService } from '../../services/analytics-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { asyncHandler } from './helpers.js';

const router = Router();

// =====================================================
// SAVED REPORTS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/reports:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/reports
 *     description: GET /api/analytics/reports.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/reports',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { type, favorites } = req.query;
    const reports = await analyticsService.getSavedReports(
      type as string | undefined,
      favorites === 'true'
    );
    sendSuccess(res, { reports });
  })
);

/**
 * @swagger
 * /api/analytics/reports:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/reports
 *     description: POST /api/analytics/reports.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/reports',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
    const report = await analyticsService.createSavedReport({
      ...req.body,
      createdBy: userEmail
    });
    sendCreated(res, { report });
  })
);

/**
 * @swagger
 * /api/analytics/reports/{id}:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/reports/:id
 *     description: GET /api/analytics/reports/:id.
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
  '/reports/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId) || reportId <= 0) {
      errorResponse(res, 'Invalid report ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }
    const report = await analyticsService.getSavedReport(reportId);
    if (!report) {
      errorResponse(res, 'Report not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }
    sendSuccess(res, { report });
  })
);

/**
 * @swagger
 * /api/analytics/reports/{id}:
 *   put:
 *     tags: [Analytics]
 *     summary: PUT /api/analytics/reports/:id
 *     description: PUT /api/analytics/reports/:id.
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
  '/reports/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId) || reportId <= 0) {
      errorResponse(res, 'Invalid report ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }
    const report = await analyticsService.updateSavedReport(reportId, req.body);
    sendSuccess(res, { report });
  })
);

/**
 * @swagger
 * /api/analytics/reports/{id}:
 *   delete:
 *     tags: [Analytics]
 *     summary: DELETE /api/analytics/reports/:id
 *     description: DELETE /api/analytics/reports/:id.
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
 *         description: Deleted successfully
 */
router.delete(
  '/reports/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId) || reportId <= 0) {
      errorResponse(res, 'Invalid report ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }
    await analyticsService.deleteSavedReport(reportId);
    sendSuccess(res, undefined);
  })
);

/**
 * @swagger
 * /api/analytics/reports/{id}/favorite:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/reports/:id/favorite
 *     description: POST /api/analytics/reports/:id/favorite.
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
  '/reports/:id/favorite',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId) || reportId <= 0) {
      errorResponse(res, 'Invalid report ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }
    const report = await analyticsService.toggleReportFavorite(reportId);
    sendSuccess(res, { report });
  })
);

/**
 * @swagger
 * /api/analytics/reports/{id}/run:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/reports/:id/run
 *     description: POST /api/analytics/reports/:id/run.
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
  '/reports/:id/run',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId) || reportId <= 0) {
      errorResponse(res, 'Invalid report ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }
    const result = await analyticsService.runReport(reportId);
    sendSuccess(res, result);
  })
);

// =====================================================
// REPORT SCHEDULES ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/reports/{reportId}/schedules:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/reports/:reportId/schedules
 *     description: GET /api/analytics/reports/:reportId/schedules.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/reports/:reportId/schedules',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.reportId, 10);
    if (isNaN(reportId) || reportId <= 0) {
      errorResponse(res, 'Invalid report ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }
    const schedules = await analyticsService.getReportSchedules(reportId);
    sendSuccess(res, { schedules });
  })
);

/**
 * @swagger
 * /api/analytics/reports/{reportId}/schedules:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/reports/:reportId/schedules
 *     description: POST /api/analytics/reports/:reportId/schedules.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/reports/:reportId/schedules',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.reportId, 10);
    if (isNaN(reportId) || reportId <= 0) {
      errorResponse(res, 'Invalid report ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }
    const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
    const schedule = await analyticsService.createReportSchedule({
      ...req.body,
      reportId,
      createdBy: userEmail
    });
    sendCreated(res, { schedule });
  })
);

/**
 * @swagger
 * /api/analytics/schedules/{id}:
 *   put:
 *     tags: [Analytics]
 *     summary: PUT /api/analytics/schedules/:id
 *     description: PUT /api/analytics/schedules/:id.
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
  '/schedules/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const scheduleId = parseInt(req.params.id, 10);
    if (isNaN(scheduleId) || scheduleId <= 0) {
      errorResponse(res, 'Invalid schedule ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }
    const schedule = await analyticsService.updateReportSchedule(scheduleId, req.body);
    sendSuccess(res, { schedule });
  })
);

/**
 * @swagger
 * /api/analytics/schedules/{id}:
 *   delete:
 *     tags: [Analytics]
 *     summary: DELETE /api/analytics/schedules/:id
 *     description: DELETE /api/analytics/schedules/:id.
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
 *         description: Deleted successfully
 */
router.delete(
  '/schedules/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const scheduleId = parseInt(req.params.id, 10);
    if (isNaN(scheduleId) || scheduleId <= 0) {
      errorResponse(res, 'Invalid schedule ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }
    await analyticsService.deleteReportSchedule(scheduleId);
    sendSuccess(res, undefined);
  })
);

/**
 * @swagger
 * /api/analytics/schedules/process:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/schedules/process
 *     description: POST /api/analytics/schedules/process.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/schedules/process',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const processed = await analyticsService.processDueSchedules();
    sendSuccess(res, { processed });
  })
);

export { router as reportsRouter };
export default router;
