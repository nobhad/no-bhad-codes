/**
 * ===============================================
 * ANALYTICS INSIGHTS ROUTES
 * ===============================================
 * @file server/routes/analytics/insights.ts
 *
 * Quick analytics, business intelligence, client insights,
 * and operational report endpoints.
 *
 * ENDPOINTS:
 * - GET  /quick/revenue                   - Revenue analytics
 * - GET  /quick/pipeline                  - Pipeline analytics
 * - GET  /quick/projects                  - Project analytics
 * - GET  /quick/clients                   - Client analytics
 * - GET  /quick/team                      - Team analytics
 * - GET  /report-runs                     - List report runs
 * - GET  /bi/revenue/:period              - Revenue by period (BI)
 * - GET  /bi/pipeline                     - Pipeline value (BI)
 * - GET  /bi/funnel                       - Acquisition funnel (BI)
 * - GET  /bi/project-stats                - Project statistics (BI)
 * - GET  /clients/ltv                     - Client lifetime value
 * - GET  /clients/activity-scores         - Client activity scores
 * - GET  /clients/upsell                  - Upsell opportunities
 * - GET  /reports/overdue-invoices        - Overdue invoices report
 * - GET  /reports/pending-approvals       - Pending approvals report
 * - GET  /reports/document-requests       - Document requests report
 * - GET  /reports/project-health          - Project health summary
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { analyticsService } from '../../services/analytics-service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from './helpers.js';

const router = Router();

// =====================================================
// QUICK ANALYTICS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/quick/revenue:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/quick/revenue
 *     description: GET /api/analytics/quick/revenue.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/quick/revenue',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { days = '30' } = req.query;
    const analytics = await analyticsService.getRevenueAnalytics(parseInt(days as string, 10));
    sendSuccess(res, analytics);
  })
);

/**
 * @swagger
 * /api/analytics/quick/pipeline:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/quick/pipeline
 *     description: GET /api/analytics/quick/pipeline.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/quick/pipeline',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const analytics = await analyticsService.getPipelineAnalytics();
    sendSuccess(res, analytics);
  })
);

/**
 * @swagger
 * /api/analytics/quick/projects:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/quick/projects
 *     description: GET /api/analytics/quick/projects.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/quick/projects',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { days = '30' } = req.query;
    const analytics = await analyticsService.getProjectAnalytics(parseInt(days as string, 10));
    sendSuccess(res, analytics);
  })
);

/**
 * @swagger
 * /api/analytics/quick/clients:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/quick/clients
 *     description: GET /api/analytics/quick/clients.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/quick/clients',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const analytics = await analyticsService.getClientAnalytics();
    sendSuccess(res, analytics);
  })
);

/**
 * @swagger
 * /api/analytics/quick/team:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/quick/team
 *     description: GET /api/analytics/quick/team.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/quick/team',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { days = '30' } = req.query;
    const analytics = await analyticsService.getTeamAnalytics(parseInt(days as string, 10));
    sendSuccess(res, analytics);
  })
);

/**
 * @swagger
 * /api/analytics/report-runs:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/report-runs
 *     description: GET /api/analytics/report-runs.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/report-runs',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { reportId, limit = '50' } = req.query;
    const runs = await analyticsService.getReportRuns(
      reportId ? parseInt(reportId as string, 10) : undefined,
      parseInt(limit as string, 10)
    );
    sendSuccess(res, { runs });
  })
);

// =====================================================
// SECTION 8.1: BUSINESS INTELLIGENCE ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/bi/revenue/{period}:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/bi/revenue/:period
 *     description: GET /api/analytics/bi/revenue/:period.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: period
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/bi/revenue/:period',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const period = req.params.period as 'month' | 'quarter' | 'year';
    const { startDate, endDate } = req.query;
    const data = await analyticsService.getRevenueByPeriod(
      period,
      startDate as string | undefined,
      endDate as string | undefined
    );
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/bi/pipeline:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/bi/pipeline
 *     description: GET /api/analytics/bi/pipeline.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/bi/pipeline',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getProjectPipelineValue();
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/bi/funnel:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/bi/funnel
 *     description: GET /api/analytics/bi/funnel.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/bi/funnel',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    const data = await analyticsService.getAcquisitionFunnel(
      startDate as string | undefined,
      endDate as string | undefined
    );
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/bi/project-stats:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/bi/project-stats
 *     description: GET /api/analytics/bi/project-stats.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/bi/project-stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getProjectStatistics();
    sendSuccess(res, { data });
  })
);

// =====================================================
// SECTION 8.2: CLIENT INSIGHTS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/clients/ltv:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/clients/ltv
 *     description: GET /api/analytics/clients/ltv.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/clients/ltv',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit = '20' } = req.query;
    const data = await analyticsService.getClientLifetimeValue(parseInt(limit as string, 10));
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/clients/activity-scores:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/clients/activity-scores
 *     description: GET /api/analytics/clients/activity-scores.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/clients/activity-scores',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit = '20' } = req.query;
    const data = await analyticsService.getClientActivityScores(parseInt(limit as string, 10));
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/clients/upsell:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/clients/upsell
 *     description: GET /api/analytics/clients/upsell.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/clients/upsell',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getUpsellOpportunities();
    sendSuccess(res, { data });
  })
);

// =====================================================
// SECTION 8.3: OPERATIONAL REPORTS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/reports/overdue-invoices:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/reports/overdue-invoices
 *     description: GET /api/analytics/reports/overdue-invoices.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/reports/overdue-invoices',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getOverdueInvoicesReport();
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/reports/pending-approvals:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/reports/pending-approvals
 *     description: GET /api/analytics/reports/pending-approvals.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/reports/pending-approvals',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getPendingApprovalsReport();
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/reports/document-requests:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/reports/document-requests
 *     description: GET /api/analytics/reports/document-requests.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/reports/document-requests',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getDocumentRequestsStatusReport();
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/reports/project-health:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/reports/project-health
 *     description: GET /api/analytics/reports/project-health.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/reports/project-health',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getProjectHealthSummary();
    sendSuccess(res, { data });
  })
);

export { router as insightsRouter };
export default router;
