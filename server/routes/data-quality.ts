import { logger } from '../services/logger.js';
/**
 * ===============================================
 * DATA QUALITY API ROUTES
 * ===============================================
 * @file server/routes/data-quality.ts
 *
 * API endpoints for duplicate detection, validation,
 * and data quality management.
 *
 * All routes require admin authentication.
 */

import express, { Request, Response } from 'express';
import { getDatabase } from '../database/init.js';
import {
  checkForDuplicates,
  mergeDuplicates,
  getDuplicateStats,
  DuplicateCheckRequest,
  MergeRequest
} from '../services/duplicate-detection-service.js';
import {
  validateEmail,
  validatePhone,
  validateUrl,
  validateFile,
  validateObject,
  sanitizeInput,
  detectXSS,
  detectSQLInjection
} from '../services/validation-service.js';
import { blockIP, unblockIP, getRateLimitStats } from '../middleware/rate-limiter.js';
import { userService } from '../services/user-service.js';
import { errorResponseWithPayload, sendSuccess, sanitizeErrorMessage } from '../utils/api-response.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// Explicit column lists for SELECT queries (avoid SELECT *)
const DUPLICATE_DETECTION_LOG_COLUMNS = `
  id, scan_type, entity_type, source_id, source_type, duplicates_found,
  matches_json, threshold_used, scanned_by, scan_duration_ms, created_at
`.replace(/\s+/g, ' ').trim();

const DUPLICATE_RESOLUTION_LOG_COLUMNS = `
  id, detection_log_id, primary_record_id, primary_record_type, merged_record_id,
  merged_record_type, resolution_type, fields_merged, resolved_by, notes, created_at
`.replace(/\s+/g, ' ').trim();

const DATA_QUALITY_METRICS_COLUMNS = `
  id, metric_date, entity_type, total_records, valid_emails, valid_phones,
  complete_records, duplicate_count, quality_score, details_json, created_at
`.replace(/\s+/g, ' ').trim();

const VALIDATION_ERROR_LOG_COLUMNS = `
  id, entity_type, entity_id, field_name, field_value, error_type,
  error_message, was_sanitized, sanitized_value, source_ip, user_agent, created_at
`.replace(/\s+/g, ' ').trim();

const router = express.Router();

// Apply authentication to all data-quality routes
router.use(authenticateToken);
router.use(requireAdmin);

// =====================================================
// DUPLICATE DETECTION ENDPOINTS
// =====================================================

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
router.post('/duplicates/scan', async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    await logger.error('Duplicate scan error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to scan for duplicates', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Failed to scan for duplicate records')
    });
  }
});

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
router.post('/duplicates/check', async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, company, phone, website } = req.body;

    if (!email && !firstName && !lastName) {
      errorResponseWithPayload(res, 'Validation error', 400, 'VALIDATION_ERROR', {
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
  } catch (error) {
    await logger.error('Duplicate check error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to check for duplicates', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Failed to check for duplicate records')
    });
  }
});

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
router.post('/duplicates/merge', async (req: Request, res: Response) => {
  try {
    const { keepId, keepType, mergeIds, fieldSelections } = req.body;

    if (!keepId || !keepType || !mergeIds || !Array.isArray(mergeIds)) {
      errorResponseWithPayload(res, 'Validation error', 400, 'VALIDATION_ERROR', {
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
  } catch (error) {
    await logger.error('Duplicate merge error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to merge records', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Failed to merge duplicate records')
    });
  }
});

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
router.post('/duplicates/dismiss', async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    await logger.error('Duplicate dismiss error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to dismiss duplicate', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Failed to dismiss duplicate record')
    });
  }
});

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
router.get('/duplicates/history', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();

    const [detectionLogs, resolutionLogs] = await Promise.all([
      db.all(`SELECT ${DUPLICATE_DETECTION_LOG_COLUMNS} FROM duplicate_detection_log ORDER BY created_at DESC LIMIT 100`),
      db.all(`SELECT ${DUPLICATE_RESOLUTION_LOG_COLUMNS} FROM duplicate_resolution_log ORDER BY created_at DESC LIMIT 100`)
    ]);

    sendSuccess(res, {
      detectionLogs,
      resolutionLogs
    });
  } catch (error) {
    await logger.error('History fetch error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to fetch history', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Failed to fetch duplicate detection history')
    });
  }
});

// =====================================================
// VALIDATION ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/data-quality/validate/email:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Validate an email address
 *     description: Validate email format and check for common issues. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Validation result
 *       400:
 *         description: Email is required
 */
router.post('/validate/email', (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      errorResponseWithPayload(res, 'Validation error', 400, 'VALIDATION_ERROR', {
        message: 'Email is required'
      });
      return;
    }

    const result = validateEmail(email);
    sendSuccess(res, result);
  } catch (error) {
    errorResponseWithPayload(res, 'Validation failed', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Data validation operation failed')
    });
  }
});

/**
 * @swagger
 * /api/data-quality/validate/phone:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Validate a phone number
 *     description: Validate phone number format. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Validation result
 */
router.post('/validate/phone', (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    const result = validatePhone(phone || '');
    sendSuccess(res, result);
  } catch (error) {
    errorResponseWithPayload(res, 'Validation failed', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Data validation operation failed')
    });
  }
});

/**
 * @swagger
 * /api/data-quality/validate/url:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Validate a URL
 *     description: Validate URL format. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Validation result
 */
router.post('/validate/url', (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    const result = validateUrl(url || '');
    sendSuccess(res, result);
  } catch (error) {
    errorResponseWithPayload(res, 'Validation failed', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Data validation operation failed')
    });
  }
});

/**
 * @swagger
 * /api/data-quality/validate/file:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Validate file metadata
 *     description: Validate file name, type, and size against allowed categories. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - filename
 *               - mimeType
 *               - sizeBytes
 *             properties:
 *               filename:
 *                 type: string
 *               mimeType:
 *                 type: string
 *               sizeBytes:
 *                 type: integer
 *               allowedCategories:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Validation result
 *       400:
 *         description: Missing required fields
 */
router.post('/validate/file', (req: Request, res: Response) => {
  try {
    const { filename, mimeType, sizeBytes, allowedCategories } = req.body;

    if (!filename || !mimeType || sizeBytes === undefined) {
      errorResponseWithPayload(res, 'Validation error', 400, 'VALIDATION_ERROR', {
        message: 'filename, mimeType, and sizeBytes are required'
      });
      return;
    }

    const result = validateFile(filename, mimeType, sizeBytes, allowedCategories);
    sendSuccess(res, result);
  } catch (error) {
    errorResponseWithPayload(res, 'Validation failed', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Data validation operation failed')
    });
  }
});

/**
 * @swagger
 * /api/data-quality/validate/object:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Validate object against schema
 *     description: Validate an entire data object against a schema definition. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *               - schema
 *             properties:
 *               data:
 *                 type: object
 *               schema:
 *                 type: object
 *     responses:
 *       200:
 *         description: Validation result
 *       400:
 *         description: data and schema are required
 */
router.post('/validate/object', (req: Request, res: Response) => {
  try {
    const { data, schema } = req.body;

    if (!data || !schema) {
      errorResponseWithPayload(res, 'Validation error', 400, 'VALIDATION_ERROR', {
        message: 'data and schema are required'
      });
      return;
    }

    const result = validateObject(data, schema);
    sendSuccess(res, result);
  } catch (error) {
    errorResponseWithPayload(res, 'Validation failed', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Data validation operation failed')
    });
  }
});

/**
 * @swagger
 * /api/data-quality/sanitize:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Sanitize input text
 *     description: Sanitize input text by removing potentially dangerous content. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - input
 *             properties:
 *               input:
 *                 type: string
 *               options:
 *                 type: object
 *     responses:
 *       200:
 *         description: Sanitized result
 *       400:
 *         description: Input is required
 */
router.post('/sanitize', (req: Request, res: Response) => {
  try {
    const { input, options } = req.body;

    if (input === undefined) {
      errorResponseWithPayload(res, 'Validation error', 400, 'VALIDATION_ERROR', {
        message: 'input is required'
      });
      return;
    }

    const result = sanitizeInput(input, options || {});
    sendSuccess(res, result);
  } catch (error) {
    errorResponseWithPayload(res, 'Sanitization failed', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Input sanitization failed')
    });
  }
});

/**
 * @swagger
 * /api/data-quality/security/check:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Check for security threats
 *     description: Detect XSS and SQL injection patterns in input. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - input
 *             properties:
 *               input:
 *                 type: string
 *     responses:
 *       200:
 *         description: Security check results
 *       400:
 *         description: Input is required
 */
router.post('/security/check', async (req: Request, res: Response) => {
  try {
    const { input } = req.body;

    if (!input) {
      errorResponseWithPayload(res, 'Validation error', 400, 'VALIDATION_ERROR', {
        message: 'input is required'
      });
      return;
    }

    const xssResult = detectXSS(input);
    const sqlResult = detectSQLInjection(input);

    // Log if threats detected
    if (xssResult.detected || sqlResult.detected) {
      const db = getDatabase();
      await db.run(
        `INSERT INTO validation_error_log (entity_type, field_name, field_value, error_type, error_message, source_ip, user_agent)
         VALUES ('security_check', 'input', ?, ?, ?, ?, ?)`,
        [
          input.substring(0, 500),
          xssResult.detected ? 'xss' : 'sql_injection',
          xssResult.detected ? 'XSS patterns detected' : 'SQL injection patterns detected',
          req.ip,
          req.headers['user-agent'] || ''
        ]
      );
    }

    sendSuccess(res, {
      safe: !xssResult.detected && !sqlResult.detected,
      xss: xssResult,
      sqlInjection: sqlResult
    });
  } catch (error) {
    errorResponseWithPayload(res, 'Security check failed', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Security threat detection failed')
    });
  }
});

// =====================================================
// DATA QUALITY METRICS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/data-quality/metrics:
 *   get:
 *     tags:
 *       - Data Quality
 *     summary: Get data quality metrics
 *     description: Retrieve current data quality statistics. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Quality metrics
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await getDuplicateStats();
    sendSuccess(res, metrics);
  } catch (error) {
    await logger.error('Metrics fetch error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to fetch metrics', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Failed to fetch data quality metrics')
    });
  }
});

/**
 * @swagger
 * /api/data-quality/metrics/calculate:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Calculate and store quality metrics
 *     description: Trigger data quality calculation and persist results. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics calculated and stored
 */
router.post('/metrics/calculate', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const metrics = await getDuplicateStats();
    const today = new Date().toISOString().split('T')[0];

    // Store metrics
    await db.run(
      `INSERT OR REPLACE INTO data_quality_metrics (metric_date, entity_type, total_records, duplicate_count, quality_score, details_json)
       VALUES (?, 'duplicates', ?, ?, ?, ?)`,
      [
        today,
        metrics.totalChecks,
        metrics.duplicatesFound,
        metrics.averageMatchScore * 100,
        JSON.stringify(metrics)
      ]
    );

    sendSuccess(res, metrics, 'Data quality metrics calculated and stored');
  } catch (error) {
    await logger.error('Metrics calculation error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to calculate metrics', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Failed to calculate data quality metrics')
    });
  }
});

/**
 * @swagger
 * /api/data-quality/metrics/history:
 *   get:
 *     tags:
 *       - Data Quality
 *     summary: Get quality metrics history
 *     description: Retrieve historical data quality metrics. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Metrics history
 */
router.get('/metrics/history', async (req: Request, res: Response) => {
  try {
    const daysParam = req.query.days;
    const days = typeof daysParam === 'string' ? Number(daysParam) : 30;
    const db = getDatabase();

    const history = await db.all(
      `SELECT ${DATA_QUALITY_METRICS_COLUMNS} FROM data_quality_metrics
       WHERE metric_date > date('now', '-' || ? || ' days')
       ORDER BY metric_date DESC, entity_type
       LIMIT 1000`,
      [Number(days)]
    );

    sendSuccess(res, { history });
  } catch (error) {
    await logger.error('History fetch error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to fetch history', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Failed to fetch metrics history')
    });
  }
});

// =====================================================
// RATE LIMITING ADMIN ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/data-quality/rate-limits/stats:
 *   get:
 *     tags:
 *       - Data Quality
 *     summary: Get rate limit statistics
 *     description: Retrieve rate limiting statistics and blocked IPs. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Rate limit stats
 */
router.get('/rate-limits/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getRateLimitStats();
    sendSuccess(res, stats);
  } catch (error) {
    await logger.error('Rate limit stats error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to fetch rate limit stats', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Failed to fetch rate limit statistics')
    });
  }
});

/**
 * @swagger
 * /api/data-quality/rate-limits/block:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Block an IP address
 *     description: Manually block an IP address from accessing the API. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ip
 *               - reason
 *             properties:
 *               ip:
 *                 type: string
 *               reason:
 *                 type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: IP blocked
 *       400:
 *         description: ip and reason required
 */
router.post('/rate-limits/block', async (req: Request, res: Response) => {
  try {
    const { ip, reason, expiresAt, adminEmail } = req.body;

    if (!ip || !reason) {
      errorResponseWithPayload(res, 'Validation error', 400, 'VALIDATION_ERROR', {
        message: 'ip and reason are required'
      });
      return;
    }

    await blockIP(ip, reason, adminEmail || 'admin', expiresAt ? new Date(expiresAt) : undefined);

    sendSuccess(res, undefined, `IP ${ip} has been blocked`);
  } catch (error) {
    await logger.error('IP block error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to block IP', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Failed to block IP address')
    });
  }
});

/**
 * @swagger
 * /api/data-quality/rate-limits/unblock:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Unblock an IP address
 *     description: Remove an IP block. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ip
 *             properties:
 *               ip:
 *                 type: string
 *     responses:
 *       200:
 *         description: IP unblocked
 *       400:
 *         description: ip is required
 */
router.post('/rate-limits/unblock', async (req: Request, res: Response) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      errorResponseWithPayload(res, 'Validation error', 400, 'VALIDATION_ERROR', {
        message: 'ip is required'
      });
      return;
    }

    await unblockIP(ip);

    sendSuccess(res, undefined, `IP ${ip} has been unblocked`);
  } catch (error) {
    await logger.error('IP unblock error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to unblock IP', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Failed to unblock IP address')
    });
  }
});

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
router.get('/validation-errors', async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    await logger.error('Validation errors fetch error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to fetch validation errors', 500, 'INTERNAL_ERROR', {
      message: sanitizeErrorMessage(error, 'Failed to fetch validation error logs')
    });
  }
});

export default router;
