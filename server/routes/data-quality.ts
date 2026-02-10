/**
 * ===============================================
 * DATA QUALITY API ROUTES
 * ===============================================
 * @file server/routes/data-quality.ts
 *
 * API endpoints for duplicate detection, validation,
 * and data quality management.
 */

import express, { Request, Response } from 'express';
import { getDatabase } from '../database/init.js';
import {
  checkForDuplicates,
  mergeDuplicates,
  getDuplicateStats,
  DuplicateMatch,
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
import {
  blockIP,
  unblockIP,
  getRateLimitStats
} from '../middleware/rate-limiter.js';
import { userService } from '../services/user-service.js';

const router = express.Router();

// =====================================================
// DUPLICATE DETECTION ENDPOINTS
// =====================================================

/**
 * POST /api/data-quality/duplicates/scan
 * Scan for duplicates across entities
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

    res.json({
      success: true,
      data: {
        duplicates: results,
        count: results.length,
        scanDuration: duration
      }
    });
  } catch (error) {
    console.error('Duplicate scan error:', error);
    res.status(500).json({
      error: 'Failed to scan for duplicates',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/data-quality/duplicates/check
 * Check a single record for duplicates (used during intake)
 */
router.post('/duplicates/check', async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, company, phone, website } = req.body;

    if (!email && !firstName && !lastName) {
      res.status(400).json({
        error: 'Validation error',
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

    res.json({
      success: true,
      data: {
        hasDuplicates: results.length > 0,
        duplicates: results,
        count: results.length,
        scanDuration: duration
      }
    });
  } catch (error) {
    console.error('Duplicate check error:', error);
    res.status(500).json({
      error: 'Failed to check for duplicates',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/data-quality/duplicates/merge
 * Merge duplicate records
 */
router.post('/duplicates/merge', async (req: Request, res: Response) => {
  try {
    const {
      keepId,
      keepType,
      mergeIds,
      fieldSelections
    } = req.body;

    if (!keepId || !keepType || !mergeIds || !Array.isArray(mergeIds)) {
      res.status(400).json({
        error: 'Validation error',
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

    res.json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error('Duplicate merge error:', error);
    res.status(500).json({
      error: 'Failed to merge records',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/data-quality/duplicates/dismiss
 * Dismiss a duplicate match (mark as not duplicate)
 */
router.post('/duplicates/dismiss', async (req: Request, res: Response) => {
  try {
    const {
      primaryId,
      primaryType,
      dismissedId,
      dismissedType,
      adminEmail,
      notes
    } = req.body;

    const db = getDatabase();
    const resolvedBy = adminEmail || 'admin';
    // Look up user ID for resolved_by during transition period
    const resolvedByUserId = await userService.getUserIdByEmail(resolvedBy);
    await db.run(
      `INSERT INTO duplicate_resolution_log (primary_record_id, primary_record_type, merged_record_id, merged_record_type, resolution_type, resolved_by, resolved_by_user_id, notes)
       VALUES (?, ?, ?, ?, 'mark_not_duplicate', ?, ?, ?)`,
      [primaryId, primaryType, dismissedId, dismissedType, resolvedBy, resolvedByUserId, notes || null]
    );

    res.json({
      success: true,
      message: 'Duplicate dismissed successfully'
    });
  } catch (error) {
    console.error('Duplicate dismiss error:', error);
    res.status(500).json({
      error: 'Failed to dismiss duplicate',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/data-quality/duplicates/history
 * Get duplicate detection/resolution history
 */
router.get('/duplicates/history', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();

    const [detectionLogs, resolutionLogs] = await Promise.all([
      db.all(
        `SELECT * FROM duplicate_detection_log ORDER BY created_at DESC LIMIT 100`
      ),
      db.all(
        `SELECT * FROM duplicate_resolution_log ORDER BY created_at DESC LIMIT 100`
      )
    ]);

    res.json({
      success: true,
      data: {
        detectionLogs,
        resolutionLogs
      }
    });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =====================================================
// VALIDATION ENDPOINTS
// =====================================================

/**
 * POST /api/data-quality/validate/email
 * Validate an email address
 */
router.post('/validate/email', (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Email is required'
      });
      return;
    }

    const result = validateEmail(email);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/data-quality/validate/phone
 * Validate a phone number
 */
router.post('/validate/phone', (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    const result = validatePhone(phone || '');
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/data-quality/validate/url
 * Validate a URL
 */
router.post('/validate/url', (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    const result = validateUrl(url || '');
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/data-quality/validate/file
 * Validate file metadata
 */
router.post('/validate/file', (req: Request, res: Response) => {
  try {
    const { filename, mimeType, sizeBytes, allowedCategories } = req.body;

    if (!filename || !mimeType || sizeBytes === undefined) {
      res.status(400).json({
        error: 'Validation error',
        message: 'filename, mimeType, and sizeBytes are required'
      });
      return;
    }

    const result = validateFile(filename, mimeType, sizeBytes, allowedCategories);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/data-quality/validate/object
 * Validate an entire object against a schema
 */
router.post('/validate/object', (req: Request, res: Response) => {
  try {
    const { data, schema } = req.body;

    if (!data || !schema) {
      res.status(400).json({
        error: 'Validation error',
        message: 'data and schema are required'
      });
      return;
    }

    const result = validateObject(data, schema);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/data-quality/sanitize
 * Sanitize input text
 */
router.post('/sanitize', (req: Request, res: Response) => {
  try {
    const { input, options } = req.body;

    if (input === undefined) {
      res.status(400).json({
        error: 'Validation error',
        message: 'input is required'
      });
      return;
    }

    const result = sanitizeInput(input, options || {});
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      error: 'Sanitization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/data-quality/security/check
 * Check input for security threats (XSS, SQL injection)
 */
router.post('/security/check', async (req: Request, res: Response) => {
  try {
    const { input } = req.body;

    if (!input) {
      res.status(400).json({
        error: 'Validation error',
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

    res.json({
      success: true,
      data: {
        safe: !xssResult.detected && !sqlResult.detected,
        xss: xssResult,
        sqlInjection: sqlResult
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Security check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =====================================================
// DATA QUALITY METRICS ENDPOINTS
// =====================================================

/**
 * GET /api/data-quality/metrics
 * Get data quality metrics
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await getDuplicateStats();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Metrics fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/data-quality/metrics/calculate
 * Trigger data quality calculation and store results
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

    res.json({
      success: true,
      message: 'Data quality metrics calculated and stored',
      data: metrics
    });
  } catch (error) {
    console.error('Metrics calculation error:', error);
    res.status(500).json({
      error: 'Failed to calculate metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/data-quality/metrics/history
 * Get historical data quality metrics
 */
router.get('/metrics/history', async (req: Request, res: Response) => {
  try {
    const daysParam = req.query.days;
    const days = typeof daysParam === 'string' ? Number(daysParam) : 30;
    const db = getDatabase();

    const history = await db.all(
      `SELECT * FROM data_quality_metrics
       WHERE metric_date > date('now', '-' || ? || ' days')
       ORDER BY metric_date DESC, entity_type`,
      [Number(days)]
    );

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =====================================================
// RATE LIMITING ADMIN ENDPOINTS
// =====================================================

/**
 * GET /api/data-quality/rate-limits/stats
 * Get rate limiting statistics
 */
router.get('/rate-limits/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getRateLimitStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Rate limit stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch rate limit stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/data-quality/rate-limits/block
 * Block an IP address
 */
router.post('/rate-limits/block', async (req: Request, res: Response) => {
  try {
    const { ip, reason, expiresAt, adminEmail } = req.body;

    if (!ip || !reason) {
      res.status(400).json({
        error: 'Validation error',
        message: 'ip and reason are required'
      });
      return;
    }

    await blockIP(ip, reason, adminEmail || 'admin', expiresAt ? new Date(expiresAt) : undefined);

    res.json({
      success: true,
      message: `IP ${ip} has been blocked`
    });
  } catch (error) {
    console.error('IP block error:', error);
    res.status(500).json({
      error: 'Failed to block IP',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/data-quality/rate-limits/unblock
 * Unblock an IP address
 */
router.post('/rate-limits/unblock', async (req: Request, res: Response) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      res.status(400).json({
        error: 'Validation error',
        message: 'ip is required'
      });
      return;
    }

    await unblockIP(ip);

    res.json({
      success: true,
      message: `IP ${ip} has been unblocked`
    });
  } catch (error) {
    console.error('IP unblock error:', error);
    res.status(500).json({
      error: 'Failed to unblock IP',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/data-quality/validation-errors
 * Get validation error logs
 */
router.get('/validation-errors', async (req: Request, res: Response) => {
  try {
    const limitParam = req.query.limit;
    const errorTypeParam = req.query.errorType;
    const db = getDatabase();

    let query = `SELECT * FROM validation_error_log`;
    const params: (string | number)[] = [];

    if (errorTypeParam && typeof errorTypeParam === 'string') {
      query += ` WHERE error_type = ?`;
      params.push(errorTypeParam);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(typeof limitParam === 'string' ? Number(limitParam) : 100);

    const errors = await db.all(query, params);

    res.json({
      success: true,
      data: errors
    });
  } catch (error) {
    console.error('Validation errors fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch validation errors',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
