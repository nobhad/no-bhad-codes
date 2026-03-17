/**
 * ===============================================
 * PAYMENTS ROUTES — Barrel
 * ===============================================
 * @file server/routes/payments/index.ts
 *
 * Re-exports a single Router that merges payment sub-routers.
 */

import { Router } from 'express';
import clientPaymentRouter from './client.js';
import webhookRouter from './webhook.js';

const router = Router();

router.use(clientPaymentRouter);
router.use(webhookRouter);

export default router;
