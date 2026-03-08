/**
 * ===============================================
 * ANALYTICS ROUTES
 * ===============================================
 * @file server/routes/analytics.ts
 *
 * Visitor tracking and analytics API endpoints.
 * Routes are split into sub-modules under ./analytics/:
 *
 * - core.ts       — Event tracking, pageviews, summary, realtime, sessions, export
 * - reports.ts    — Saved reports CRUD, report schedules
 * - dashboards.ts — Dashboard widgets, KPI snapshots, metric alerts
 * - insights.ts   — Quick analytics, BI, client insights, operational reports
 *
 * ENDPOINTS:
 * - POST /api/analytics/track                      - Receive tracking events (public)
 * - GET  /api/analytics/summary                    - Get analytics summary (admin)
 * - GET  /api/analytics/realtime                   - Get realtime visitor data (admin)
 * - GET  /api/analytics/sessions                   - List visitor sessions (admin)
 * - GET  /api/analytics/sessions/:sessionId        - Get session details (admin)
 * - GET  /api/analytics/export                     - Export analytics data (admin)
 * - DELETE /api/analytics/data                     - Clear old analytics data (admin)
 * - GET/POST/PUT/DELETE /api/analytics/reports/*    - Saved reports
 * - GET/POST/PUT/DELETE /api/analytics/schedules/*  - Report schedules
 * - GET/POST/PUT/DELETE /api/analytics/widgets/*    - Dashboard widgets
 * - POST /api/analytics/kpis/snapshot              - Capture KPI snapshot
 * - GET  /api/analytics/kpis/latest                - Get latest KPIs
 * - GET  /api/analytics/kpis/:type/trend           - Get KPI trend
 * - GET/POST/PUT/DELETE /api/analytics/alerts/*     - Metric alerts
 * - GET  /api/analytics/quick/*                    - Quick analytics
 * - GET  /api/analytics/report-runs                - Report run history
 * - GET  /api/analytics/bi/*                       - Business intelligence
 * - GET  /api/analytics/clients/*                  - Client insights
 * - GET  /api/analytics/reports/overdue-invoices   - Overdue invoices report
 * - GET  /api/analytics/reports/pending-approvals  - Pending approvals report
 * - GET  /api/analytics/reports/document-requests  - Document requests report
 * - GET  /api/analytics/reports/project-health     - Project health summary
 *
 * TABLES USED:
 * - visitor_sessions    - Session data with device/browser info
 * - page_views          - Individual page view events
 * - interaction_events  - User interaction events
 *
 * RATE LIMITS:
 * - Tracking endpoint: 100 requests/minute per IP
 * - Admin endpoints: 30 requests/minute per IP
 */

import { Router } from 'express';
import { coreRouter } from './analytics/core.js';
import { reportsRouter } from './analytics/reports.js';
import { dashboardsRouter } from './analytics/dashboards.js';
import { insightsRouter } from './analytics/insights.js';

const router = Router();

// Mount sub-routers (order matters for route matching)
// insights.ts registers /reports/overdue-invoices etc. which must match
// before reports.ts matches /reports/:id — so insights goes first
router.use(insightsRouter);
router.use(reportsRouter);
router.use(coreRouter);
router.use(dashboardsRouter);

export default router;
