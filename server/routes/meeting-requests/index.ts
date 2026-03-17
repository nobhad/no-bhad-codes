/**
 * ===============================================
 * MEETING REQUESTS ROUTES -- Barrel
 * ===============================================
 * @file server/routes/meeting-requests/index.ts
 */

import { Router } from 'express';
import adminRouter from './admin.js';
import portalRouter from './portal.js';

const router = Router();

router.use(adminRouter);
router.use(portalRouter);

export default router;
