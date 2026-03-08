/**
 * ===============================================
 * MESSAGE ROUTES
 * ===============================================
 * @file server/routes/messages.ts
 *
 * Message management endpoints coordinator.
 * Routes are split into sub-modules:
 *   - core.ts: Thread CRUD, send/get messages, mark read
 *   - quick.ts: Quick inquiries, notification preferences
 *   - enhanced.ts: Mentions, reactions, subscriptions, pins, search, internal messages
 *   - admin.ts: Analytics, attachment downloads
 */

import express from 'express';
import { coreRouter } from './messages/core.js';
import { quickRouter } from './messages/quick.js';
import { enhancedRouter } from './messages/enhanced.js';
import { adminRouter } from './messages/admin.js';

const router = express.Router();

router.use(coreRouter);
router.use(quickRouter);
router.use(enhancedRouter);
router.use(adminRouter);

export { router as messagesRouter };
export default router;
