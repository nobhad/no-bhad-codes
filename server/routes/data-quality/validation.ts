/**
 * ===============================================
 * DATA QUALITY — VALIDATION
 * ===============================================
 * Input validation, sanitization, and security
 * threat detection endpoints.
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { getDatabase } from '../../database/init.js';
import {
  validateEmail,
  validatePhone,
  validateUrl,
  validateFile,
  validateObject,
  sanitizeInput,
  detectXSS,
  detectSQLInjection
} from '../../services/validation-service.js';
import { errorResponseWithPayload, sendSuccess, sanitizeErrorMessage, ErrorCodes } from '../../utils/api-response.js';

const router = Router();

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
      errorResponseWithPayload(res, 'Validation error', 400, ErrorCodes.VALIDATION_ERROR, {
        message: 'Email is required'
      });
      return;
    }

    const result = validateEmail(email);
    sendSuccess(res, result);
  } catch (error) {
    errorResponseWithPayload(res, 'Validation failed', 500, ErrorCodes.INTERNAL_ERROR, {
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
    errorResponseWithPayload(res, 'Validation failed', 500, ErrorCodes.INTERNAL_ERROR, {
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
    errorResponseWithPayload(res, 'Validation failed', 500, ErrorCodes.INTERNAL_ERROR, {
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
      errorResponseWithPayload(res, 'Validation error', 400, ErrorCodes.VALIDATION_ERROR, {
        message: 'filename, mimeType, and sizeBytes are required'
      });
      return;
    }

    const result = validateFile(filename, mimeType, sizeBytes, allowedCategories);
    sendSuccess(res, result);
  } catch (error) {
    errorResponseWithPayload(res, 'Validation failed', 500, ErrorCodes.INTERNAL_ERROR, {
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
      errorResponseWithPayload(res, 'Validation error', 400, ErrorCodes.VALIDATION_ERROR, {
        message: 'data and schema are required'
      });
      return;
    }

    const result = validateObject(data, schema);
    sendSuccess(res, result);
  } catch (error) {
    errorResponseWithPayload(res, 'Validation failed', 500, ErrorCodes.INTERNAL_ERROR, {
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
      errorResponseWithPayload(res, 'Validation error', 400, ErrorCodes.VALIDATION_ERROR, {
        message: 'input is required'
      });
      return;
    }

    const result = sanitizeInput(input, options || {});
    sendSuccess(res, result);
  } catch (error) {
    errorResponseWithPayload(res, 'Sanitization failed', 500, ErrorCodes.INTERNAL_ERROR, {
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
router.post('/security/check', asyncHandler(async (req: Request, res: Response) => {
  const { input } = req.body;

  if (!input) {
    errorResponseWithPayload(res, 'Validation error', 400, ErrorCodes.VALIDATION_ERROR, {
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
}));

export default router;
