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

const router = express.Router();
router.use(dashboardRouter);
router.use(leadsRouter);
router.use(projectsRouter);
router.use(kpiRouter);
router.use(workflowsRouter);
router.use(settingsRouter);
router.use(notificationsRouter);
router.use(tagsRouter);
router.use(cacheRouter);
router.use(activityRouter);
router.use(miscRouter);

export { router as adminRouter };
export default router;
