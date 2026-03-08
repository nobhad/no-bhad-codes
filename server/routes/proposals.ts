/**
 * ===============================================
 * PROPOSAL ROUTES
 * ===============================================
 * @file server/routes/proposals.ts
 *
 * API endpoints for proposal builder functionality.
 * Handles tier configurations, proposal submissions, and admin management.
 *
 * Routes are organized into sub-modules:
 * - core.ts      — Config, CRUD, admin management
 * - pdf.ts       — PDF generation endpoint
 * - templates.ts  — Template CRUD endpoints
 * - versions.ts   — Version CRUD endpoints
 * - signing.ts    — E-signature flow endpoints
 * - extras.ts     — Comments, activity, custom items, discounts, expiration, client-facing
 */

import express from 'express';
import { coreRouter } from './proposals/core.js';
import { pdfRouter } from './proposals/pdf.js';
import { templatesRouter } from './proposals/templates.js';
import { versionsRouter } from './proposals/versions.js';
import { signingRouter } from './proposals/signing.js';
import { extrasRouter } from './proposals/extras.js';

const router = express.Router();

router.use(coreRouter);
router.use(pdfRouter);
router.use(templatesRouter);
router.use(versionsRouter);
router.use(signingRouter);
router.use(extrasRouter);

export default router;
