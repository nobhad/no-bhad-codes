/**
 * ===============================================
 * DATA QUALITY ROUTES — BARREL
 * ===============================================
 * Composes sub-routers for data quality endpoints.
 *
 * All routes require admin authentication.
 *
 * Sub-modules:
 *   data-quality/shared.ts      — Column constants shared across sub-routers
 *   data-quality/duplicates.ts  — Scan, check, merge, dismiss, history
 *   data-quality/validation.ts  — Email, phone, URL, file, object validation; sanitize; security check
 *   data-quality/metrics.ts     — Get, calculate, history of quality metrics
 *   data-quality/rate-limits.ts — Stats, block, unblock IP addresses
 *   data-quality/errors.ts      — Validation error log retrieval
 */

import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import duplicatesRouter from './data-quality/duplicates.js';
import validationRouter from './data-quality/validation.js';
import metricsRouter from './data-quality/metrics.js';
import rateLimitsRouter from './data-quality/rate-limits.js';
import errorsRouter from './data-quality/errors.js';

const router = Router();

// All data-quality routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

router.use(duplicatesRouter);
router.use(validationRouter);
router.use(metricsRouter);
router.use(rateLimitsRouter);
router.use(errorsRouter);

export default router;
