/**
 * ===============================================
 * LEAD ROUTES — BARREL
 * ===============================================
 * Composes sub-routers for all lead management endpoints.
 *
 * Sub-modules:
 *   leads/core.ts       — CRUD, contact submissions, invitations, activation
 *   leads/scoring.ts    — Scoring rules CRUD, calculate, recalculate
 *   leads/pipeline.ts   — Pipeline stages, kanban view, stats, stage moves
 *   leads/tasks.ts      — Task CRUD, complete, overdue, upcoming
 *   leads/notes.ts      — Notes CRUD, pin toggle
 *   leads/operations.ts — Sources, assignment, duplicates, bulk ops, analytics
 */

import express from 'express';
import coreRouter from './leads/core.js';
import scoringRouter from './leads/scoring.js';
import pipelineRouter from './leads/pipeline.js';
import tasksRouter from './leads/tasks.js';
import notesRouter from './leads/notes.js';
import operationsRouter from './leads/operations.js';

const router = express.Router();

router.use(coreRouter);
router.use(scoringRouter);
router.use(pipelineRouter);
router.use(tasksRouter);
router.use(notesRouter);
router.use(operationsRouter);

export default router;
