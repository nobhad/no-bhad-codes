/**
 * ===============================================
 * CONTRACT ROUTES
 * ===============================================
 * @file server/routes/contracts.ts
 *
 * API endpoints for contract management.
 * Barrel file that composes sub-routers.
 */

import express from 'express';
import { crudRouter } from './contracts/crud.js';
import { clientRouter } from './contracts/client.js';
import { distributionRouter } from './contracts/distribution.js';
import { templatesRouter } from './contracts/templates.js';

const router = express.Router();

router.use(crudRouter);
router.use(clientRouter);
router.use(distributionRouter);
router.use(templatesRouter);

export { router as contractsRouter };
export default router;
