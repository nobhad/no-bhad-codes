/**
 * ===============================================
 * CONTRACT ROUTES — BARREL
 * ===============================================
 * @file server/routes/contracts/index.ts
 *
 * Combines all contract sub-routers into a single Express router.
 * Sub-routers are mounted so their routes appear on the combined router.
 */

import express from 'express';
import { crudRouter } from './crud.js';
import { distributionRouter } from './distribution.js';
import { clientRouter } from './client.js';
import { templatesRouter } from './templates.js';

const router = express.Router();

// Mount sub-routers — order matters for route matching
// Specific literal paths before parameterised ones
router.use('/templates', templatesRouter);
router.use(distributionRouter);
router.use(clientRouter);
router.use(crudRouter);

export default router;
