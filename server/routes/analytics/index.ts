/**
 * ===============================================
 * ANALYTICS ROUTES INDEX
 * ===============================================
 * @file server/routes/analytics/index.ts
 *
 * Re-exports from analytics sub-modules.
 */

// Export sub-routers
export { coreRouter } from './core.js';
export { reportsRouter } from './reports.js';
export { dashboardsRouter } from './dashboards.js';
export { insightsRouter } from './insights.js';

// Export shared helpers and types
export {
  asyncHandler,
  getDateThreshold,
  trackingRateLimit,
  adminRateLimit,
  VISITOR_SESSION_COLUMNS,
  PAGE_VIEW_COLUMNS,
  INTERACTION_EVENT_COLUMNS
} from './helpers.js';
export type { TrackingPayload } from './helpers.js';
