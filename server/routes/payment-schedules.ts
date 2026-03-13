/**
 * ===============================================
 * PAYMENT SCHEDULE ROUTES - BARREL
 * ===============================================
 * @file server/routes/payment-schedules.ts
 *
 * Barrel file that composes all payment schedule sub-routers.
 */

import express from 'express';
import clientRouter from './payment-schedules/client.js';
import adminRouter from './payment-schedules/admin.js';

const router = express.Router();

// Mount sub-routers (client routes first: /my before /:id)
router.use(clientRouter);
router.use(adminRouter);

export { router as paymentSchedulesRouter };
export default router;
