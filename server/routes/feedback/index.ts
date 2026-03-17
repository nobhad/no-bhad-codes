/**
 * ===============================================
 * FEEDBACK ROUTES — Barrel
 * ===============================================
 * @file server/routes/feedback/index.ts
 */

import { Router } from 'express';
import adminRouter from './admin.js';
import portalRouter from './portal.js';
import publicRouter from './public.js';

const router = Router();

router.use(adminRouter);
router.use(portalRouter);
router.use(publicRouter);

export default router;
