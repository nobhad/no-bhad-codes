/**
 * ===============================================
 * QUESTIONNAIRE ROUTES — BARREL
 * ===============================================
 * @file server/routes/questionnaires.ts
 *
 * Composes sub-routers for questionnaire endpoints:
 *   - client.ts  — Client-facing response endpoints
 *   - admin.ts   — Admin CRUD + response management
 *   - export.ts  — PDF and data export
 */

import express from 'express';
import clientRouter from './questionnaires/client.js';
import adminRouter from './questionnaires/admin.js';
import exportRouter from './questionnaires/export.js';

const router = express.Router();

// Client endpoints (mounted first — specific paths like /my-responses before /:id)
router.use(clientRouter);

// Export endpoints (mounted before admin — /responses/:id/pdf before admin's /responses/:id)
router.use(exportRouter);

// Admin endpoints (contains catch-all /:id patterns)
router.use(adminRouter);

export { router as questionnairesRouter };
export default router;
