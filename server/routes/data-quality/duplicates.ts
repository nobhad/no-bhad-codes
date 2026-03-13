/**
 * ===============================================
 * DATA QUALITY — DUPLICATES
 * ===============================================
 * Duplicate detection, checking, merging, dismissal,
 * and history retrieval.
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { getDatabase } from '../../database/init.js';
import {
  checkForDuplicates,
  mergeDuplicates,
  DuplicateCheckRequest,
  MergeRequest
} from '../../services/duplicate-detection-service.js';
import { userService } from '../../services/user-service.js';
import { errorResponseWithPayload, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { DUPLICATE_DETECTION_LOG_COLUMNS, DUPLICATE_RESOLUTION_LOG_COLUMNS } from './shared.js';

const router = Router();

/**
 * @swagger
 * /api/data-quality/duplicates/scan:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Scan for duplicate records
 *     description: Scan for duplicates across clients and leads. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               company:
 *                 type: string
 *               phone:
 *                 type: string
 *               website:
 *                 type: string
 *     responses:
 *       200:
 *         description: Duplicate scan results
 *       500:
 *         description: Scan failed
 */
router.post('/duplicates/scan', asyncHandler(async (req: Request, res: Response) => {
  const { email, firstName, lastName, company, phone, website } = req.body;

  const startTime = Date.now();
  const checkData: DuplicateCheckRequest = {
    email,
    firstName,
    lastName,
    company,
    phone,
    website
  };
  const results = await checkForDuplicates(checkData);
  const duration = Date.now() - startTime;

  sendSuccess(res, {
    duplicates: results,
    count: results.length,
    scanDuration: duration
  });
}));

/**
 * @swagger
 * /api/data-quality/duplicates/check:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Check record for duplicates
 *     description: Check a single record for duplicates during intake. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Duplicate check results
 *       400:
 *         description: At least email or name required
 */
router.post('/duplicates/check', asyncHandler(async (req: Request, res: Response) => {
  const { email, firstName, lastName, company, phone, website } = req.body;

  if (!email && !firstName && !lastName) {
    errorResponseWithPayload(res, 'Validation error', 400, ErrorCodes.VALIDATION_ERROR, {
      message: 'At least email or name is required'
    });
    return;
  }

  const startTime = Date.now();
  const checkData: DuplicateCheckRequest = {
    email,
    firstName,
    lastName,
    company,
    phone,
    website
  };
  const results = await checkForDuplicates(checkData);
  const duration = Date.now() - startTime;

  sendSuccess(res, {
    hasDuplicates: results.length > 0,
    duplicates: results,
    count: results.length,
    scanDuration: duration
  });
}));

/**
 * @swagger
 * /api/data-quality/duplicates/merge:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Merge duplicate records
 *     description: Merge identified duplicate records into a primary record. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keepId
 *               - keepType
 *               - mergeIds
 *             properties:
 *               keepId:
 *                 type: integer
 *               keepType:
 *                 type: string
 *               mergeIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               fieldSelections:
 *                 type: object
 *     responses:
 *       200:
 *         description: Records merged
 *       400:
 *         description: Validation error
 */
router.post('/duplicates/merge', asyncHandler(async (req: Request, res: Response) => {
  const { keepId, keepType, mergeIds, fieldSelections } = req.body;

  if (!keepId || !keepType || !mergeIds || !Array.isArray(mergeIds)) {
    errorResponseWithPayload(res, 'Validation error', 400, ErrorCodes.VALIDATION_ERROR, {
      message: 'keepId, keepType, and mergeIds array are required'
    });
    return;
  }

  const mergeRequest: MergeRequest = {
    keepId,
    keepType,
    mergeIds,
    fieldSelections
  };

  const result = await mergeDuplicates(mergeRequest);

  sendSuccess(res, undefined, result.message);
}));

/**
 * @swagger
 * /api/data-quality/duplicates/dismiss:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Dismiss a duplicate match
 *     description: Mark a duplicate match as not a duplicate. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               primaryId:
 *                 type: integer
 *               primaryType:
 *                 type: string
 *               dismissedId:
 *                 type: integer
 *               dismissedType:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Duplicate dismissed
 */
router.post('/duplicates/dismiss', asyncHandler(async (req: Request, res: Response) => {
  const { primaryId, primaryType, dismissedId, dismissedType, adminEmail, notes } = req.body;

  const db = getDatabase();
  const resolvedBy = adminEmail || 'admin';
  // Look up user ID for resolved_by during transition period
  const resolvedByUserId = await userService.getUserIdByEmail(resolvedBy);
  await db.run(
    `INSERT INTO duplicate_resolution_log (primary_record_id, primary_record_type, merged_record_id, merged_record_type, resolution_type, resolved_by, resolved_by_user_id, notes)
     VALUES (?, ?, ?, ?, 'mark_not_duplicate', ?, ?, ?)`,
    [
      primaryId,
      primaryType,
      dismissedId,
      dismissedType,
      resolvedBy,
      resolvedByUserId,
      notes || null
    ]
  );

  sendSuccess(res, undefined, 'Duplicate dismissed successfully');
}));

/**
 * @swagger
 * /api/data-quality/duplicates/history:
 *   get:
 *     tags:
 *       - Data Quality
 *     summary: Get duplicate detection history
 *     description: Retrieve duplicate detection and resolution history. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Detection and resolution logs
 */
router.get('/duplicates/history', asyncHandler(async (_req: Request, res: Response) => {
  const db = getDatabase();

  const [detectionLogs, resolutionLogs] = await Promise.all([
    db.all(`SELECT ${DUPLICATE_DETECTION_LOG_COLUMNS} FROM duplicate_detection_log ORDER BY created_at DESC LIMIT 100`),
    db.all(`SELECT ${DUPLICATE_RESOLUTION_LOG_COLUMNS} FROM duplicate_resolution_log ORDER BY created_at DESC LIMIT 100`)
  ]);

  sendSuccess(res, {
    detectionLogs,
    resolutionLogs
  });
}));

export default router;
