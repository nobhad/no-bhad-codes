/**
 * ===============================================
 * DOCUMENT REQUEST ROUTES - BARREL
 * ===============================================
 * @file server/routes/document-requests.ts
 *
 * Barrel file that composes all document request sub-routers
 */

import express from 'express';
import clientRouter from './document-requests/client.js';
import adminRouter from './document-requests/admin.js';
import templatesRouter from './document-requests/templates.js';

const router = express.Router();

// Mount sub-routers (order matters: specific paths before parameterized ones)
router.use(clientRouter);
router.use(templatesRouter);
router.use(adminRouter);

export { router as documentRequestsRouter };
export default router;
