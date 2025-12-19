/**
 * ===============================================
 * API ROUTES
 * ===============================================
 * @file server/routes/api.ts
 *
 * Main API routes with comprehensive validation and security.
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import multer from 'multer';
import { resolve, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { validateRequest, ValidationSchemas } from '../middleware/validation.js';
import {
  rateLimit,
  csrfProtection,
  requestSizeLimit,
  suspiciousActivityDetector,
} from '../middleware/security.js';
import { logger } from '../services/logger.js';
import { getDatabase } from '../database/init.js';
import { emailService } from '../services/email-service.js';

const router = Router();

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
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
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
  },
});

// Global API middleware
router.use(
  requestSizeLimit({
    maxBodySize: 10 * 1024 * 1024, // 10MB
    maxUrlLength: 2048,
    maxHeaderSize: 8192,
  })
);

router.use(
  suspiciousActivityDetector({
    maxPathTraversal: 3,
    maxSqlInjectionAttempts: 3,
    maxXssAttempts: 3,
    blockDuration: 24 * 60 * 60 * 1000,
  })
);

// General rate limiting for all API routes
router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many API requests',
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
    message: 'Too many contact form submissions',
  }),

  // Validate contact form data
  validateRequest(ValidationSchemas.contact, {
    validateBody: true,
    stripUnknownFields: true,
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
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store in database
      const db = getDatabase();
      try {
        await db.run(
          `INSERT INTO contact_submissions (name, email, subject, message, ip_address, user_agent, message_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            email,
            subjectLine,
            message,
            req.ip || 'unknown',
            req.get('User-Agent') || 'unknown',
            messageId,
          ]
        );
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
      <td style="padding: 8px;">${name}</td>
    </tr>
    <tr>
      <td style="padding: 8px; background: #f5f5f5; font-weight: bold;">Email:</td>
      <td style="padding: 8px;"><a href="mailto:${email}">${email}</a></td>
    </tr>
    ${companyName ? `<tr>
      <td style="padding: 8px; background: #f5f5f5; font-weight: bold;">Company:</td>
      <td style="padding: 8px;">${companyName}</td>
    </tr>` : ''}
    <tr>
      <td style="padding: 8px; background: #f5f5f5; font-weight: bold;">Subject:</td>
      <td style="padding: 8px;">${subjectLine}</td>
    </tr>
  </table>

  <h3 style="color: #333; margin-top: 20px;">Message:</h3>
  <div style="padding: 15px; background: #f9f9f9; border-left: 4px solid #0066cc;">
    ${message.replace(/\n/g, '<br>')}
  </div>

  <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
  <p style="font-size: 12px; color: #999;">
    Message ID: ${messageId}<br>
    Request ID: ${requestId}<br>
    Received: ${new Date().toLocaleString()}
  </p>
</div>
          `.trim(),
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

      await logger.info(
        `Contact form processed successfully - messageId: ${messageId}, from: ${email}`
      );

      res.json({
        success: true,
        message: 'Message received, thanks!',
        messageId,
      });
    } catch (error) {
      const err = error as Error;
      await logger.error('Contact form processing error');

      res.status(500).json({
        success: false,
        error: 'Failed to process contact form',
        code: 'CONTACT_PROCESSING_ERROR',
      });
    }
  }
);

/**
 * Client intake form submission
 */
router.post(
  '/intake',
  // Rate limiting for intake forms
  rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 3,
    keyGenerator: (req) => req.body.email || req.ip,
    message: 'Too many intake form submissions',
  }),

  // Validate intake form data
  validateRequest(ValidationSchemas.clientIntake, {
    validateBody: true,
    stripUnknownFields: true,
  }),

  async (req, res) => {
    try {
      const intakeData = req.body;
      const requestId = (req.headers['x-request-id'] as string) || 'unknown';

      await logger.info('Client intake form received');

      // Process intake form data
      const { getDatabase } = await import('../database/init.js');
      const db = getDatabase();

      // Generate unique intake ID
      const intakeId = `INT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Insert intake form data into database
      const result = await db.run(
        `
        INSERT INTO client_intakes (
          intake_id, company_name, first_name, last_name, email, phone,
          project_type, budget_range, timeline, project_description,
          additional_info, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
      `,
        [
          intakeId,
          intakeData.companyName || intakeData['company-name'],
          intakeData.firstName || intakeData['first-name'],
          intakeData.lastName || intakeData['last-name'],
          intakeData.email,
          intakeData.phone || null,
          intakeData.projectType || intakeData['project-type'],
          intakeData.budget || null,
          intakeData.timeline || null,
          intakeData.projectDescription || intakeData['project-description'],
          intakeData.additionalInfo || intakeData['additional-info'] || null,
        ]
      );

      // Send notification email to admin
      try {
        const { emailService } = await import('../services/email-service.js');
        await emailService.sendAdminNotification({
          subject: `New Client Intake: ${intakeData.companyName || intakeData['company-name']}`,
          intakeId,
          clientName: `${intakeData.firstName || intakeData['first-name']} ${intakeData.lastName || intakeData['last-name']}`,
          companyName: intakeData.companyName || intakeData['company-name'],
          projectType: intakeData.projectType || intakeData['project-type'],
          budget: intakeData.budget || 'Not specified',
          timeline: intakeData.timeline || 'Not specified',
        });
      } catch (emailError) {
        await logger.error('Failed to send admin notification email');
      }

      // Send confirmation email to client
      try {
        const { emailService } = await import('../services/email-service.js');
        await emailService.sendIntakeConfirmation({
          to: intakeData.email,
          name: intakeData.firstName || intakeData['first-name'],
          intakeId,
          estimatedResponseTime: '24-48 hours',
        });
      } catch (emailError) {
        await logger.error('Failed to send client confirmation email');
      }

      await logger.info('Client intake processed successfully');

      res.json({
        success: true,
        message:
          'Your intake form has been submitted successfully. We will review your project requirements and get back to you within 24-48 hours.',
        intakeId,
        estimatedResponseTime: '24-48 hours',
      });
    } catch (error) {
      const err = error as Error;
      await logger.error('Intake form processing error');

      res.status(500).json({
        success: false,
        error: 'Failed to process intake form. Please try again or contact support.',
        code: 'INTAKE_PROCESSING_ERROR',
      });
    }
  }
);

/**
 * File upload endpoint
 */
router.post(
  '/upload',
  // File upload rate limiting
  rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 10,
    message: 'Too many file uploads',
  }),

  // Add multer middleware for file handling
  upload.single('file'),

  async (req, res) => {
    try {
      // Implement file upload handling
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
          code: 'NO_FILE',
        });
      }

      const fileInfo = {
        id: Date.now().toString(),
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/general/${req.file.filename}`,
        uploadedAt: new Date().toISOString(),
      };

      // Save file metadata to database (optional)
      const db = getDatabase();
      let fileId = 0;
      try {
        const result = await db.run(
          `INSERT INTO uploaded_files (filename, original_filename, file_path, file_size, mime_type, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          [fileInfo.filename, fileInfo.originalName, fileInfo.url, fileInfo.size, fileInfo.mimetype]
        );
        fileId = result.lastID || 0;
      } catch (err) {
        console.error('Failed to save file metadata:', err);
        // Don't fail - file is already uploaded
      }

      await logger.info(
        `File uploaded successfully - filename: ${fileInfo.filename}, fileId: ${fileId}`
      );

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        file: { ...fileInfo, id: fileId > 0 ? fileId : fileInfo.id },
      });
    } catch (error) {
      const err = error as Error;
      await logger.error('File upload error');

      res.status(500).json({
        success: false,
        error: 'File upload failed',
        code: 'UPLOAD_ERROR',
      });
    }
  }
);

/**
 * Health check endpoint
 */
router.get(
  '/health',
  // Lighter rate limiting for health checks
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 20,
    message: 'Too many health check requests',
  }),

  async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
      };

      res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      const err = error as Error;
      await logger.error('Health check error');

      res.status(500).json({
        success: false,
        error: 'Health check failed',
        code: 'HEALTH_CHECK_ERROR',
      });
    }
  }
);

/**
 * User registration endpoint
 */
router.post(
  '/auth/register',
  // Registration rate limiting
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    keyGenerator: (req) => req.ip || 'unknown',
    message: 'Too many registration attempts',
  }),

  // Validate user registration data
  validateRequest(ValidationSchemas.user, {
    validateBody: true,
    stripUnknownFields: true,
  }),

  async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const requestId = (req.headers['x-request-id'] as string) || 'unknown';

      await logger.info(`User registration attempt - email: ${email}, requestId: ${requestId}`);

      // Check if user already exists
      const db = getDatabase();
      const existingUser = await db.get('SELECT id, email FROM users WHERE email = ?', [email]);

      if (existingUser) {
        await logger.warn(
          `Registration attempt with existing email - email: ${email}, requestId: ${requestId}`
        );
        return res.status(409).json({
          success: false,
          error: 'User already exists',
          code: 'USER_EXISTS',
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Save to database
      const result = await db.run(
        `INSERT INTO users (email, password, name, type, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [email, hashedPassword, name, 'client', 'active']
      );

      const userId = result.lastID!;

      // Generate access token for client portal
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }

      const accessToken = jwt.sign({ id: userId, email, type: 'client' }, jwtSecret, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      } as SignOptions);

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(email, name, accessToken);
        await logger.info(
          `Welcome email sent - email: ${email}, userId: ${userId}, requestId: ${requestId}`
        );
      } catch (emailError) {
        // Log error but don't fail registration
        await logger.error(
          `Failed to send welcome email - email: ${email}, userId: ${userId}, error: ${emailError}, requestId: ${requestId}`
        );
      }

      await logger.info(
        `User registration successful - email: ${email}, userId: ${userId}, requestId: ${requestId}`
      );

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        userId,
        token: accessToken,
      });
    } catch (error) {
      const err = error as Error;
      await logger.error(`User registration error - error: ${err.message}`);

      res.status(500).json({
        success: false,
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR',
      });
    }
  }
);

/**
 * Data query endpoint with pagination
 */
router.get(
  '/data',
  validateRequest(ValidationSchemas.pagination, {
    validateQuery: true,
    stripUnknownFields: false,
  }),

  async (req, res) => {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', search } = req.query;

      await logger.info('Data query request');

      // Implement actual data querying from projects table
      const db = getDatabase();
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build query with search
      let query = 'SELECT * FROM projects';
      let countQuery = 'SELECT COUNT(*) as count FROM projects';
      const params: any[] = [];

      if (search) {
        query += ' WHERE project_name LIKE ? OR description LIKE ?';
        countQuery += ' WHERE project_name LIKE ? OR description LIKE ?';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern);
      }

      // Add sorting
      const validSortFields = ['id', 'project_name', 'status', 'created_at', 'updated_at'];
      const sortField = validSortFields.includes(String(sortBy)) ? sortBy : 'created_at';
      const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
      query += ` ORDER BY ${sortField} ${order}`;

      // Add pagination
      query += ' LIMIT ? OFFSET ?';
      params.push(limitNum, offset);

      // Get total count
      const countParams = search ? [`%${search}%`, `%${search}%`] : [];
      const countRow = await db.get(countQuery, countParams);
      const total = countRow?.count || 0;

      // Get data
      const data = await db.all(query, params);

      const totalPages = Math.ceil(total / limitNum);

      const result = {
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
        meta: {
          sortBy: sortField,
          sortOrder: order,
          search: search || null,
        },
      };

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      const err = error as Error;
      await logger.error('Data query error');

      res.status(500).json({
        success: false,
        error: 'Data query failed',
        code: 'DATA_QUERY_ERROR',
      });
    }
  }
);

/**
 * API status and metrics endpoint
 */
router.get(
  '/status',
  rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10,
  }),

  async (req, res) => {
    try {
      // Gather actual metrics from database
      const db = getDatabase();

      let totalUsers = 0,
        activeUsers = 0,
        totalProjects = 0,
        activeProjects = 0,
        totalInvoices = 0;

      try {
        const [usersRow, activeUsersRow, projectsRow, activeProjectsRow, invoicesRow] =
          await Promise.all([
            db.get('SELECT COUNT(*) as count FROM users'),
            db.get("SELECT COUNT(*) as count FROM users WHERE status = 'active'"),
            db.get('SELECT COUNT(*) as count FROM projects'),
            db.get(
              "SELECT COUNT(*) as count FROM projects WHERE status IN ('in-progress', 'pending')"
            ),
            db.get('SELECT COUNT(*) as count FROM invoices'),
          ]);

        totalUsers = usersRow?.count || 0;
        activeUsers = activeUsersRow?.count || 0;
        totalProjects = projectsRow?.count || 0;
        activeProjects = activeProjectsRow?.count || 0;
        totalInvoices = invoicesRow?.count || 0;
      } catch (err) {
        console.error('Failed to gather metrics:', err);
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
            total: totalUsers,
            active: activeUsers,
          },
          projects: {
            total: totalProjects,
            active: activeProjects,
          },
          invoices: {
            total: totalInvoices,
          },
        },
        requests: {
          rateLimit: {
            remaining: res.get('X-RateLimit-Remaining'),
            reset: res.get('X-RateLimit-Reset'),
          },
        },
      };

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      const err = error as Error;
      await logger.error('API status error');

      res.status(500).json({
        success: false,
        error: 'Status check failed',
        code: 'STATUS_ERROR',
      });
    }
  }
);

// Handle 404 for unmatched API routes
router.use(async (req, res) => {
  await logger.error('API route not found');

  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.path,
  });
});

// Error handler for API routes
router.use(async (error: any, req: any, res: any, next: any) => {
  const err = error as Error;
  await logger.error('API route error');

  if (res.headersSent) {
    return next(error);
  }

  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_ERROR',
    requestId: req.headers['x-request-id'],
  });
});

export default router;
