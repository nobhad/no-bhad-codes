/**
 * ===============================================
 * DELIVERABLE ROUTES — BARREL
 * ===============================================
 * Composes sub-routers for deliverable endpoints.
 *
 * Sub-modules:
 *   deliverables/shared.ts    — Validation schemas, constants, helper functions
 *   deliverables/crud.ts      — Client list, CRUD, lock, revision, delete
 *   deliverables/versions.ts  — Upload, list, get latest version
 *   deliverables/comments.ts  — Add, list, resolve, delete comments
 *   deliverables/elements.ts  — Create, list, update approval of design elements
 *   deliverables/reviews.ts   — Create, list reviews
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import crudRouter from './deliverables/crud.js';
import versionsRouter from './deliverables/versions.js';
import commentsRouter from './deliverables/comments.js';
import elementsRouter from './deliverables/elements.js';
import reviewsRouter from './deliverables/reviews.js';

const router = Router();

// All deliverable routes require authentication
router.use(authenticateToken);

router.use(crudRouter);
router.use(versionsRouter);
router.use(commentsRouter);
router.use(elementsRouter);
router.use(reviewsRouter);

export default router;
