/**
 * ===============================================
 * CLIENT ROUTES
 * ===============================================
 * @file server/routes/clients.ts
 *
 * Client management endpoints coordinator.
 * Mounts sub-route modules in the correct order.
 *
 * Sub-route modules:
 *   - me.ts     — Current client /me endpoints + /me/contacts
 *   - core.ts   — Admin client list, tags & segmentation, single client CRUD
 *   - crm.ts    — Admin contacts, activity timeline, notes
 *   - fields.ts — Custom fields, tag assignments, CRM fields
 *   - health.ts — Health scoring, notifications, timeline
 */

import express from 'express';
import { meRouter } from './clients/me.js';
import { coreRouter } from './clients/core.js';
import { crmRouter } from './clients/crm.js';
import { fieldsRouter } from './clients/fields.js';
import { healthRouter } from './clients/health.js';

const router = express.Router();

// Mount order matters: /me/* and other static routes must be
// registered before /:id parameterised routes.
//
// 1. meRouter     — /me, /me/password, /me/billing, /me/dashboard, /me/contacts, etc.
// 2. healthRouter — /me/timeline, /me/notifications, /at-risk, /:id/health, /:id/stats
// 3. fieldsRouter — /custom-fields, /follow-up, /:id/custom-fields, /:id/tags, /:id/crm
// 4. crmRouter    — /contacts/:contactId, /notes/:noteId, /activities/recent,
//                   /:id/contacts, /:id/activities, /:id/notes
// 5. coreRouter   — /, /tags, /by-tag/:tagId, /:id, /:id/projects, /:id/send-invite

router.use(meRouter);
router.use(healthRouter);
router.use(fieldsRouter);
router.use(crmRouter);
router.use(coreRouter);

export { router as clientsRouter };
export default router;
