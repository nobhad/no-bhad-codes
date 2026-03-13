/**
 * ===============================================
 * DATA QUALITY — ERRORS
 * ===============================================
 * Validation error log retrieval.
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { getDatabase } from '../../database/init.js';
import { sendSuccess } from '../../utils/api-response.js';
import { VALIDATION_ERROR_LOG_COLUMNS } from './shared.js';

const router = Router();

/**
 * @swagger
 * /api/data-quality/validation-errors:
 *   get:
 *     tags:
 *       - Data Quality
 *     summary: Get validation error logs
 *     description: Retrieve validation error log entries. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: errorType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Validation error logs
 */
router.get('/validation-errors', asyncHandler(async (req: Request, res: Response) => {
  const limitParam = req.query.limit;
  const errorTypeParam = req.query.errorType;
  const db = getDatabase();

  let query = `SELECT ${VALIDATION_ERROR_LOG_COLUMNS} FROM validation_error_log`;
  const params: (string | number)[] = [];

  if (errorTypeParam && typeof errorTypeParam === 'string') {
    query += ' WHERE error_type = ?';
    params.push(errorTypeParam);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(typeof limitParam === 'string' ? Number(limitParam) : 100);

  const errors = await db.all(query, params);

  sendSuccess(res, { errors });
}));

export default router;
