/**
 * ===============================================
 * LEGACY PROJECT MESSAGES ROUTES (DEPRECATED)
 * ===============================================
 * @file server/routes/projects/messages.ts
 *
 * These routes are deprecated in favor of the thread-based
 * messaging system. Returns 410 Gone for all endpoints.
 */

import express, { Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';

const router = express.Router();

const GONE_MESSAGE = 'This endpoint is deprecated. Use the thread-based messaging API instead.';

router.get('/:id/messages', authenticateToken, (_req: AuthenticatedRequest, res: Response) => {
  res.status(410).json({ success: false, error: GONE_MESSAGE });
});

router.post('/:id/messages', authenticateToken, (_req: AuthenticatedRequest, res: Response) => {
  res.status(410).json({ success: false, error: GONE_MESSAGE });
});

router.put('/:id/messages/read', authenticateToken, (_req: AuthenticatedRequest, res: Response) => {
  res.status(410).json({ success: false, error: GONE_MESSAGE });
});

export default router;
