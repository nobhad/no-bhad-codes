/**
 * ===============================================
 * ONBOARDING CHECKLIST ROUTES — Barrel
 * ===============================================
 * @file server/routes/onboarding-checklist/index.ts
 */

import { Router } from 'express';
import portalRouter from './portal.js';
import adminRouter from './admin.js';

const router = Router();

router.use(portalRouter);
router.use(adminRouter);

export default router;
