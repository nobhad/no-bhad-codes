/**
 * ===============================================
 * ANALYTICS DASHBOARDS, KPIS & ALERTS ROUTES
 * ===============================================
 * @file server/routes/analytics/dashboards.ts
 *
 * Dashboard widget management, KPI snapshots, and metric alert endpoints.
 *
 * ENDPOINTS:
 * - GET    /widgets                       - List dashboard widgets
 * - POST   /widgets                       - Create widget
 * - PUT    /widgets/:id                   - Update widget
 * - DELETE /widgets/:id                   - Delete widget
 * - PUT    /widgets/layout                - Update widget layout
 * - GET    /widgets/presets               - List widget presets
 * - POST   /widgets/presets/:id/apply     - Apply a preset
 * - POST   /kpis/snapshot                 - Capture KPI snapshot
 * - GET    /kpis/latest                   - Get latest KPIs
 * - GET    /kpis/:type/trend              - Get KPI trend
 * - GET    /alerts                        - List metric alerts
 * - POST   /alerts                        - Create alert
 * - PUT    /alerts/:id                    - Update alert
 * - DELETE /alerts/:id                    - Delete alert
 * - POST   /alerts/check                  - Check alert triggers
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { analyticsService } from '../../services/analytics-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { asyncHandler } from './helpers.js';

const router = Router();

// =====================================================
// DASHBOARD WIDGETS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/widgets:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/widgets
 *     description: GET /api/analytics/widgets.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/widgets',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
    const widgets = await analyticsService.getDashboardWidgets(userEmail);
    sendSuccess(res, { widgets });
  })
);

/**
 * @swagger
 * /api/analytics/widgets:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/widgets
 *     description: POST /api/analytics/widgets.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/widgets',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
    const widget = await analyticsService.createDashboardWidget({
      ...req.body,
      userEmail
    });
    sendCreated(res, { widget });
  })
);

/**
 * @swagger
 * /api/analytics/widgets/{id}:
 *   put:
 *     tags: [Analytics]
 *     summary: PUT /api/analytics/widgets/:id
 *     description: PUT /api/analytics/widgets/:id.
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
  '/widgets/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const widgetId = parseInt(req.params.id, 10);
    if (isNaN(widgetId) || widgetId <= 0) {
      errorResponse(res, 'Invalid widget ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }
    const widget = await analyticsService.updateDashboardWidget(widgetId, req.body);
    sendSuccess(res, { widget });
  })
);

/**
 * @swagger
 * /api/analytics/widgets/{id}:
 *   delete:
 *     tags: [Analytics]
 *     summary: DELETE /api/analytics/widgets/:id
 *     description: DELETE /api/analytics/widgets/:id.
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
  '/widgets/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const widgetId = parseInt(req.params.id, 10);
    if (isNaN(widgetId) || widgetId <= 0) {
      errorResponse(res, 'Invalid widget ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }
    await analyticsService.deleteDashboardWidget(widgetId);
    sendSuccess(res, undefined);
  })
);

/**
 * @swagger
 * /api/analytics/widgets/layout:
 *   put:
 *     tags: [Analytics]
 *     summary: PUT /api/analytics/widgets/layout
 *     description: PUT /api/analytics/widgets/layout.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/widgets/layout',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
    const { widgets } = req.body;
    await analyticsService.updateWidgetLayout(userEmail, widgets);
    sendSuccess(res, undefined);
  })
);

/**
 * @swagger
 * /api/analytics/widgets/presets:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/widgets/presets
 *     description: GET /api/analytics/widgets/presets.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/widgets/presets',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const presets = await analyticsService.getDashboardPresets();
    sendSuccess(res, { presets });
  })
);

/**
 * @swagger
 * /api/analytics/widgets/presets/{id}/apply:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/widgets/presets/:id/apply
 *     description: POST /api/analytics/widgets/presets/:id/apply.
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
  '/widgets/presets/:id/apply',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const presetId = parseInt(req.params.id, 10);
    if (isNaN(presetId) || presetId <= 0) {
      errorResponse(res, 'Invalid preset ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }
    const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
    const widgets = await analyticsService.applyDashboardPreset(userEmail, presetId);
    sendSuccess(res, { widgets });
  })
);

// =====================================================
// KPI SNAPSHOTS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/kpis/snapshot:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/kpis/snapshot
 *     description: POST /api/analytics/kpis/snapshot.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/kpis/snapshot',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    await analyticsService.captureKPISnapshot();
    sendSuccess(res, undefined);
  })
);

/**
 * @swagger
 * /api/analytics/kpis/latest:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/kpis/latest
 *     description: GET /api/analytics/kpis/latest.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/kpis/latest',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const kpis = await analyticsService.getLatestKPIs();
    sendSuccess(res, { kpis });
  })
);

/**
 * @swagger
 * /api/analytics/kpis/{type}/trend:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/kpis/:type/trend
 *     description: GET /api/analytics/kpis/:type/trend.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/kpis/:type/trend',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { days = '30' } = req.query;
    const daysParam = parseInt(days as string, 10);
    const daysNum = isNaN(daysParam) || daysParam < 1 || daysParam > 365 ? 30 : daysParam;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const trend = await analyticsService.getKPITrend(req.params.type, {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    });
    sendSuccess(res, { trend });
  })
);

// =====================================================
// METRIC ALERTS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/alerts:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/alerts
 *     description: GET /api/analytics/alerts.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/alerts',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const alerts = await analyticsService.getMetricAlerts();
    sendSuccess(res, { alerts });
  })
);

/**
 * @swagger
 * /api/analytics/alerts:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/alerts
 *     description: POST /api/analytics/alerts.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/alerts',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
    const alert = await analyticsService.createMetricAlert({
      ...req.body,
      createdBy: userEmail
    });
    sendCreated(res, { alert });
  })
);

/**
 * @swagger
 * /api/analytics/alerts/{id}:
 *   put:
 *     tags: [Analytics]
 *     summary: PUT /api/analytics/alerts/:id
 *     description: PUT /api/analytics/alerts/:id.
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
  '/alerts/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const alertId = parseInt(req.params.id, 10);
    if (isNaN(alertId) || alertId <= 0) {
      errorResponse(res, 'Invalid alert ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }
    const alert = await analyticsService.updateMetricAlert(alertId, req.body);
    sendSuccess(res, { alert });
  })
);

/**
 * @swagger
 * /api/analytics/alerts/{id}:
 *   delete:
 *     tags: [Analytics]
 *     summary: DELETE /api/analytics/alerts/:id
 *     description: DELETE /api/analytics/alerts/:id.
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
  '/alerts/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const alertId = parseInt(req.params.id, 10);
    if (isNaN(alertId) || alertId <= 0) {
      errorResponse(res, 'Invalid alert ID', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }
    await analyticsService.deleteMetricAlert(alertId);
    sendSuccess(res, undefined);
  })
);

/**
 * @swagger
 * /api/analytics/alerts/check:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/alerts/check
 *     description: POST /api/analytics/alerts/check.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/alerts/check',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const triggered = await analyticsService.checkAlertTriggers();
    sendSuccess(res, { triggered });
  })
);

export { router as dashboardsRouter };
export default router;
