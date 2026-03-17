/**
 * ===============================================
 * CUSTOM AUTOMATIONS ROUTES — Barrel
 * ===============================================
 * @file server/routes/automations/index.ts
 */

import { Router } from 'express';
import adminRouter from './admin.js';

const router = Router();

router.use(adminRouter);

export default router;
