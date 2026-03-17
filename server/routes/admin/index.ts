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
import notificationsRouter from './notifications.js';
import cacheRouter from './cache.js';
import activityRouter from './activity.js';
import messagesRouter from './messages.js';
import adHocAnalyticsRouter from './ad-hoc-analytics.js';
import designReviewsRouter from './design-reviews.js';
import timeEntriesRouter from './time-entries.js';
import proposalsRouter from './proposals.js';
import emailTemplatesRouter from './email-templates.js';
import performanceRouter from './performance.js';

// Split from misc.ts into dedicated route files
import analyticsRouter from './analytics.js';
import clientsRouter from './clients.js';
import contactsRouter from './contacts.js';
import deletedItemsRouter from './deleted-items.js';
import deliverablesRouter from './deliverables.js';
import emailRouter from './email.js';
import filesRouter from './files.js';
import tasksRouter from './tasks.js';
import configRouter from './config.js';
import invoicesRouter from './invoices.js';
import aiRouter from './ai.js';

const router = express.Router();
router.use(dashboardRouter);
router.use(leadsRouter);
router.use(projectsRouter);
router.use(kpiRouter);
router.use(workflowsRouter);
router.use('/notifications', notificationsRouter);
router.use(cacheRouter);
router.use(activityRouter);
router.use(messagesRouter);
router.use(adHocAnalyticsRouter);
router.use(designReviewsRouter);
router.use(timeEntriesRouter);
router.use(proposalsRouter);
router.use(emailTemplatesRouter);
router.use(performanceRouter);

// Dedicated route modules (formerly misc.ts)
router.use(analyticsRouter);
router.use(clientsRouter);
router.use(contactsRouter);
router.use(deletedItemsRouter);
router.use(deliverablesRouter);
router.use(emailRouter);
router.use(filesRouter);
router.use(tasksRouter);
router.use(configRouter);
router.use(invoicesRouter);
router.use(aiRouter);
export { router as adminRouter };
export default router;
