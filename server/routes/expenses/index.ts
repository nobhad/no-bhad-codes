/**
 * ===============================================
 * EXPENSES ROUTES — Barrel
 * ===============================================
 * @file server/routes/expenses/index.ts
 */

import { Router } from 'express';
import adminRouter from './admin.js';

const router = Router();

router.use(adminRouter);

export default router;
