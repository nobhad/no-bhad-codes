/**
 * ===============================================
 * ADMIN ROUTES INDEX
 * ===============================================
 * @file server/routes/admin/index.ts
 *
 * Router mounting for admin sub-modules.
 */

import express from 'express';
import dashboardRouter from './dashboard.js';
import leadsRouter from './leads.js';
import projectsRouter from './projects.js';
import kpiRouter from './kpi.js';
import workflowsRouter from './workflows.js';
import settingsRouter from './settings.js';
import notificationsRouter from './notifications.js';
import tagsRouter from './tags.js';
import cacheRouter from './cache.js';
import activityRouter from './activity.js';
import miscRouter from './misc.js';
import messagesRouter from './messages.js';
import adHocAnalyticsRouter from './ad-hoc-analytics.js';
import designReviewsRouter from './design-reviews.js';
import timeEntriesRouter from './time-entries.js';
import proposalsRouter from './proposals.js';
import emailTemplatesRouter from './email-templates.js';

const router = express.Router();
router.use(dashboardRouter);
router.use(leadsRouter);
router.use(projectsRouter);
router.use(kpiRouter);
router.use(workflowsRouter);
router.use(settingsRouter);
router.use('/notifications', notificationsRouter);
router.use(tagsRouter);
router.use(cacheRouter);
router.use(activityRouter);
router.use(miscRouter);
router.use(messagesRouter);
router.use(adHocAnalyticsRouter);
router.use(designReviewsRouter);
router.use(timeEntriesRouter);
router.use(proposalsRouter);
router.use(emailTemplatesRouter);

export { router as adminRouter };
export default router;
