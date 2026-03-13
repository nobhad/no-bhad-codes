/**
 * ===============================================
 * INTEGRATIONS API ROUTES — Barrel
 * ===============================================
 * @file server/routes/integrations.ts
 *
 * Re-exports a single Router that merges all integration sub-routers:
 *   - status        GET /status, GET /health
 *   - zapier        GET|POST /zapier/*
 *   - notifications GET|POST|DELETE /notifications/*
 *   - stripe        GET|POST|DELETE /stripe/*
 *   - calendar      GET|POST|PUT /calendar/*
 */

import { Router } from 'express';
import statusRouter from './integrations/status.js';
import zapierRouter from './integrations/zapier.js';
import notificationsRouter from './integrations/notifications.js';
import stripeRouter from './integrations/stripe.js';
import calendarRouter from './integrations/calendar.js';

const router = Router();

router.use(statusRouter);
router.use(zapierRouter);
router.use(notificationsRouter);
router.use(stripeRouter);
router.use(calendarRouter);

export default router;
