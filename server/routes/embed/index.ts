/**
 * ===============================================
 * EMBED ROUTES — Barrel
 * ===============================================
 * @file server/routes/embed/index.ts
 */

import { Router } from 'express';
import adminRouter from './admin.js';
import publicRouter from './public.js';

const router = Router();

router.use(adminRouter);
router.use(publicRouter);

export default router;
