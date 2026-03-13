/**
 * ===============================================
 * AD HOC REQUEST ROUTES — BARREL
 * ===============================================
 * Composes sub-routers for ad hoc request endpoints.
 *
 * Sub-modules:
 *   ad-hoc-requests/shared.ts — Validation schemas, constants, helper functions
 *   ad-hoc-requests/client.ts — Client-facing: list, submit, approve, decline
 *   ad-hoc-requests/admin.ts  — Admin: CRUD, time, invoicing, quotes, task conversion
 */

import express from 'express';
import clientRouter from './ad-hoc-requests/client.js';
import adminRouter from './ad-hoc-requests/admin.js';

const router = express.Router();

router.use(clientRouter);
router.use(adminRouter);

export default router;
