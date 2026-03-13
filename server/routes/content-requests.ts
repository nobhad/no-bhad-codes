/**
 * ===============================================
 * CONTENT REQUEST ROUTES - BARREL
 * ===============================================
 * @file server/routes/content-requests.ts
 *
 * Barrel file that composes all content request sub-routers.
 */

import express from 'express';
import clientRouter from './content-requests/client.js';
import adminRouter from './content-requests/admin.js';

const router = express.Router();

// Mount sub-routers (client routes first: /my before /:id)
router.use(clientRouter);
router.use(adminRouter);

export { router as contentRequestsRouter };
export default router;
