/**
 * ===============================================
 * PROJECT ROUTES INDEX
 * ===============================================
 * @file server/routes/projects/index.ts
 *
 * Router mounting for project sub-modules.
 */

import express from 'express';
import coreRouter from './core.js';
import milestonesRouter from './milestones.js';
import activityRouter from './activity.js';
import filesRouter from './files.js';
import fileVersionsRouter from './file-versions.js';
import fileFoldersRouter from './file-folders.js';
import fileCommentsRouter from './file-comments.js';
import tasksRouter from './tasks.js';
import contractsRouter from './contracts.js';
import intakeRouter from './intake.js';
import templatesRouter from './templates.js';
import healthRouter from './health.js';
import tagsRouter from './tags.js';
import archiveRouter from './archive.js';
import escalationRouter from './escalation.js';
import timeTrackingRouter from './time-tracking.js';
import messagesRouter from './messages.js';

const router = express.Router();
router.use(coreRouter);
router.use(milestonesRouter);
router.use(activityRouter);
router.use(filesRouter);
router.use(fileVersionsRouter);
router.use(fileFoldersRouter);
router.use(fileCommentsRouter);
router.use(tasksRouter);
router.use(contractsRouter);
router.use(intakeRouter);
router.use(templatesRouter);
router.use(healthRouter);
router.use(tagsRouter);
router.use(archiveRouter);
router.use(escalationRouter);
router.use(timeTrackingRouter);
router.use(messagesRouter);

export { router as projectsRouter };
export default router;
