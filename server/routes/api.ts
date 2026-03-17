/**
 * ===============================================
 * API ROUTES
 * ===============================================
 * @file server/routes/api.ts
 *
 * Main API routes with comprehensive validation and security.
 */

import crypto from 'crypto';
import express, { Router } from 'express';
import multer from 'multer';
import { resolve, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { validateRequest, ValidationSchemas } from '../middleware/validation.js';
import { rateLimit, requestSizeLimit, suspiciousActivityDetector } from '../middleware/security.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../services/logger.js';
import { emailService } from '../services/email-service.js';
import { getSchedulerService } from '../services/scheduler-service.js';
import { contactService } from '../services/contact-service.js';
import { generalUploadService } from '../services/general-upload-service.js';
import { dataQueryService } from '../services/data-query-service.js';
import { metricsService } from '../services/metrics-service.js';
import { errorResponse, errorResponseWithPayload, sanitizeErrorMessage, sendSuccess, sendCreated, ErrorCodes } from '../utils/api-response.js';
import { BUSINESS_INFO } from '../config/business.js';

const router = Router();

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Configure multer for file uploads
const uploadDir = resolve(process.cwd(), 'uploads', 'general');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar/;
    const extName = allowedTypes.test(extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);

    if (extName && mimeType) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, documents, and archives are allowed.'));
    }
  }
});

// Global API middleware
router.use(
  requestSizeLimit({
    maxBodySize: 10 * 1024 * 1024, // 10MB
    maxUrlLength: 2048,
    maxHeaderSize: 8192
  })
);

router.use(
  suspiciousActivityDetector({
    maxPathTraversal: 3,
    maxSqlInjectionAttempts: 3,
    maxXssAttempts: 3,
    blockDuration: 24 * 60 * 60 * 1000
  })
);

// General rate limiting for all API routes
// Configurable global API rate limit. Can be relaxed in development via env vars.
const apiWindowMs = Number(process.env.API_RATE_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes
const apiMaxRequests = Number(process.env.API_RATE_MAX_REQUESTS) || 100;
router.use(
  rateLimit({
    windowMs: apiWindowMs,
    maxRequests: apiMaxRequests,
    skipIf: () => process.env.NODE_ENV === 'development',
    message: 'Too many API requests'
  })
);

/**
 * Contact form submission
 */
router.post(
  '/contact',
  // Stricter rate limiting for contact forms
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    keyGenerator: (req) => req.ip || 'unknown',
    message: 'Too many contact form submissions'
  }),

  // Validate contact form data
  validateRequest(ValidationSchemas.contact, {
    validateBody: true,
    stripUnknownFields: true
  }),

  async (req, res) => {
    try {
      const { firstName, lastName, email, subject, inquiryType, companyName, message } = req.body;
      // Support both name field and firstName/lastName
      const name = req.body.name || `${firstName || ''} ${lastName || ''}`.trim();
      const subjectLine = subject || inquiryType || 'Contact Form Submission';
      const requestId = (req.headers['x-request-id'] as string) || 'unknown';

      await logger.info(
        `Contact form submission received - from: ${email}, subject: ${subjectLine}, requestId: ${requestId}`
      );

      // Send email notification to admin
      const messageId = `msg_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

      // Store in database
      try {
        await contactService.saveContactSubmission({
          name,
          email,
          subject: subjectLine,
          message,
          ipAddress: req.ip || 'unknown',
          userAgent: (req.get('User-Agent') || 'unknown').substring(0, 500),
          messageId
        });
        await logger.info(`Contact form saved to database - messageId: ${messageId}`);
      } catch (dbError) {
        // Log but don't fail - email will still be sent
        await logger.error(`Failed to save contact form to database: ${dbError}`);
      }

      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        await logger.warn('ADMIN_EMAIL not configured - skipping contact form email notification');
      } else {
        try {
          await emailService.sendEmail({
            to: adminEmail,
            subject: 'NEW: Contact Form Submission',
            text: `
New contact form submission:

From: ${name} (${email})
${companyName ? `Company: ${companyName}\n` : ''}Subject: ${subjectLine}
Message:
${message}

---
Message ID: ${messageId}
Request ID: ${requestId}
Received: ${new Date().toISOString()}
          `.trim(),
            html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0;">
  <h2 style="color: #333;">New Contact Form Submission</h2>

  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px; background: #f5f5f5; font-weight: bold;">From:</td>
      <td style="padding: 8px;">${escapeHtml(name)}</td>
    </tr>
    <tr>
      <td style="padding: 8px; background: #f5f5f5; font-weight: bold;">Email:</td>
      <td style="padding: 8px;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
    </tr>
    ${
  companyName
    ? `<tr>
      <td style="padding: 8px; background: #f5f5f5; font-weight: bold;">Company:</td>
      <td style="padding: 8px;">${escapeHtml(companyName)}</td>
    </tr>`
    : ''
}
    <tr>
      <td style="padding: 8px; background: #f5f5f5; font-weight: bold;">Subject:</td>
      <td style="padding: 8px;">${escapeHtml(subjectLine)}</td>
    </tr>
  </table>

  <h3 style="color: #333; margin-top: 20px;">Message:</h3>
  <div style="padding: 15px; background: #f9f9f9; border-left: 4px solid #0066cc;">
    ${escapeHtml(message).replace(/\n/g, '<br>')}
  </div>

  <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
  <p style="font-size: 12px; color: #999;">
    Message ID: ${messageId}<br>
    Request ID: ${requestId}<br>
    Received: ${new Date().toLocaleString()}
  </p>
</div>
          `.trim()
          });

          await logger.info(
            `Contact form email sent to admin - messageId: ${messageId}, from: ${email}`
          );
        } catch (emailError) {
          // Log error but don't fail the request - form submission still recorded
          await logger.error(
            `Failed to send contact form email - messageId: ${messageId}, error: ${emailError}`
          );
        }
      }

      // Send confirmation auto-reply to submitter
      try {
        await emailService.sendEmail({
          to: email,
          subject: `We received your message - ${BUSINESS_INFO.name}`,
          text: `Hi ${name},\n\nThank you for reaching out! We've received your message and will get back to you within 1-2 business days.\n\nIn the meantime, feel free to browse our portfolio at ${BUSINESS_INFO.website}.\n\nBest,\n${BUSINESS_INFO.owner}\n${BUSINESS_INFO.name}`,
          html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Thank you for reaching out!</h2>
          <p>Hi ${escapeHtml(name)},</p>
          <p>We've received your message and will get back to you within <strong>1-2 business days</strong>.</p>
          <p>In the meantime, feel free to browse our work at <a href="https://${BUSINESS_INFO.website}">${BUSINESS_INFO.website}</a>.</p>
          <p style="margin-top: 30px;">Best,<br>${escapeHtml(BUSINESS_INFO.owner)}<br><em>${escapeHtml(BUSINESS_INFO.name)}</em></p>
        </div>`
        });

        await logger.info(
          `Contact form auto-reply sent - messageId: ${messageId}, to: ${email}`
        );
      } catch (autoReplyError) {
        await logger.error('[Contact] Failed to send auto-reply:', {
          error: autoReplyError instanceof Error ? autoReplyError : undefined
        });
        // Non-critical — form submission still recorded
      }

      await logger.info(
        `Contact form processed successfully - messageId: ${messageId}, from: ${email}`
      );

      sendSuccess(res, { messageId }, 'Message received, thanks!');
    } catch (_error) {
      await logger.error('Contact form processing error');
      errorResponse(res, 'Failed to process contact form', 500, ErrorCodes.CONTACT_PROCESSING_ERROR);
    }
  }
);

/**
 * File upload endpoint (authenticated)
 * NOTE: Client intake form is handled by /routes/intake.ts (mounted at /api/intake)
 */
router.post(
  '/upload',
  // Require authentication
  authenticateToken,

  // File upload rate limiting
  rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 10,
    message: 'Too many file uploads'
  }),

  // Add multer middleware for file handling
  upload.single('file'),

  async (req: AuthenticatedRequest, res) => {
    try {
      // Implement file upload handling
      if (!req.file) {
        return errorResponse(res, 'No file uploaded', 400, ErrorCodes.NO_FILE);
      }

      const fileInfo = {
        id: Date.now().toString(),
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/general/${req.file.filename}`,
        uploadedAt: new Date().toISOString()
      };

      // Save file metadata to database (optional)
      let fileId = 0;
      try {
        fileId = await generalUploadService.saveUploadMetadata({
          filename: fileInfo.filename,
          originalFilename: fileInfo.originalName,
          filePath: fileInfo.url,
          fileSize: fileInfo.size,
          mimeType: fileInfo.mimetype
        });
      } catch (err) {
        await logger.error('Failed to save file metadata:', {
          error: err instanceof Error ? err : undefined,
          category: 'UPLOAD'
        });
        // Don't fail - file is already uploaded
      }

      await logger.info(
        `File uploaded successfully - filename: ${fileInfo.filename}, fileId: ${fileId}`
      );

      sendCreated(res, { file: { ...fileInfo, id: fileId > 0 ? fileId : fileInfo.id } }, 'File uploaded successfully');
    } catch (_error) {
      await logger.error('File upload error');
      errorResponse(res, 'File upload failed', 500, ErrorCodes.UPLOAD_ERROR);
    }
  }
);

/**
 * Health check endpoint
 */
router.get(
  '/health',
  // Relaxed rate limiting for health checks
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 120, // Allow frequent health checks
    blockDuration: 30 * 1000, // Only block for 30 seconds
    message: 'Too many health check requests'
  }),

  async (req, res) => {
    try {
      // Get scheduler status
      const schedulerService = getSchedulerService();
      const schedulerStatus = schedulerService.getStatus();

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        scheduler: {
          enabled: process.env.SCHEDULER_ENABLED !== 'false',
          isRunning: schedulerStatus.isRunning,
          jobs: schedulerStatus.jobs
        }
      };

      sendSuccess(res, health);
    } catch (_error) {
      await logger.error('Health check error');
      errorResponse(res, 'Health check failed', 500, ErrorCodes.HEALTH_CHECK_ERROR);
    }
  }
);

// NOTE: User registration is handled via client invitations through /api/auth/set-password
// The deprecated /auth/register endpoint has been removed as it used the abandoned 'users' table.
// All user management now goes through the 'clients' table exclusively.

/**
 * Data query endpoint with pagination (admin only)
 */
router.get(
  '/data',
  authenticateToken,

  validateRequest(ValidationSchemas.pagination, {
    validateQuery: true,
    stripUnknownFields: false
  }),

  async (req: AuthenticatedRequest, res) => {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', search } = req.query;

      await logger.info('Data query request');

      const result = await dataQueryService.queryProjects({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        sortBy: String(sortBy),
        sortOrder: String(sortOrder),
        search: search ? String(search) : undefined
      });

      sendSuccess(res, result);
    } catch (_error) {
      await logger.error('Data query error');
      errorResponse(res, 'Data query failed', 500, ErrorCodes.DATA_QUERY_ERROR);
    }
  }
);

/**
 * API status and metrics endpoint (admin only)
 */
router.get(
  '/status',
  authenticateToken,

  rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10
  }),

  async (req: AuthenticatedRequest, res) => {
    try {
      let metrics = { totalUsers: 0, activeUsers: 0, totalProjects: 0, activeProjects: 0, totalInvoices: 0 };

      try {
        metrics = await metricsService.getDatabaseMetrics();
      } catch (err) {
        await logger.error('Failed to gather metrics:', {
          error: err instanceof Error ? err : undefined,
          category: 'METRICS'
        });
        // Use default values of 0
      }

      const status = {
        api: 'online',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
        database: {
          users: {
            total: metrics.totalUsers,
            active: metrics.activeUsers
          },
          projects: {
            total: metrics.totalProjects,
            active: metrics.activeProjects
          },
          invoices: {
            total: metrics.totalInvoices
          }
        },
        requests: {
          rateLimit: {
            remaining: res.get('X-RateLimit-Remaining'),
            reset: res.get('X-RateLimit-Reset')
          }
        }
      };

      sendSuccess(res, status);
    } catch (_error) {
      await logger.error('API status error');
      errorResponse(res, 'Status check failed', 500, ErrorCodes.STATUS_ERROR);
    }
  }
);

// Error handler for API routes
router.use(
  async (
    error: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    await logger.error('API route error');

    if (res.headersSent) {
      return next(error as Error);
    }

    const status = (error as { status?: number })?.status ?? 500;
    const message = sanitizeErrorMessage(error, 'Internal server error');
    const code = (error as { code?: string })?.code ?? ErrorCodes.INTERNAL_ERROR;
    errorResponseWithPayload(res, message, status, code, {
      requestId: req.headers['x-request-id']
    });
  }
);

export default router;
