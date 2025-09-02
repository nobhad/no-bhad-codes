/**
 * ===============================================
 * API ROUTES
 * ===============================================
 * @file server/routes/api.ts
 * 
 * Main API routes with comprehensive validation and security.
 */

import { Router } from 'express';
import { validateRequest, ValidationSchemas } from '../middleware/validation.js';
import { rateLimit, csrfProtection, requestSizeLimit, suspiciousActivityDetector } from '../middleware/security.js';
import { logger } from '../services/logger.js';

const router = Router();

// Global API middleware
router.use(requestSizeLimit({
  maxBodySize: 10 * 1024 * 1024, // 10MB
  maxUrlLength: 2048,
  maxHeaderSize: 8192
}));

router.use(suspiciousActivityDetector({
  maxPathTraversal: 3,
  maxSqlInjectionAttempts: 3,
  maxXssAttempts: 3,
  blockDuration: 24 * 60 * 60 * 1000
}));

// General rate limiting for all API routes
router.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many API requests'
}));

/**
 * Contact form submission
 */
router.post('/contact',
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
      const { name, email, subject, message } = req.body;
      const requestId = req.headers['x-request-id'] as string || 'unknown';

      await logger.info('Contact form submission received');

      // TODO: Implement actual email sending
      // For now, just simulate processing
      await new Promise(resolve => setTimeout(resolve, 100));

      await logger.info('Contact form processed successfully');

      res.json({
        success: true,
        message: 'Your message has been sent successfully',
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });

    } catch (error) {
      const err = error as Error;
      await logger.error('Contact form processing error');

      res.status(500).json({
        success: false,
        error: 'Failed to process contact form',
        code: 'CONTACT_PROCESSING_ERROR'
      });
    }
  }
);

/**
 * Client intake form submission
 */
router.post('/intake',
  // Rate limiting for intake forms
  rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 3,
    keyGenerator: (req) => req.body.email || req.ip,
    message: 'Too many intake form submissions'
  }),

  // Validate intake form data
  validateRequest(ValidationSchemas.clientIntake, {
    validateBody: true,
    stripUnknownFields: true
  }),

  async (req, res) => {
    try {
      const intakeData = req.body;
      const requestId = req.headers['x-request-id'] as string || 'unknown';

      await logger.info('Client intake form received');

      // Process intake form data
      const { getDatabase } = await import('../database/init.js');
      const db = getDatabase();
      
      // Generate unique intake ID
      const intakeId = `INT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      // Insert intake form data into database
      const result = await db.run(`
        INSERT INTO client_intakes (
          intake_id, company_name, first_name, last_name, email, phone,
          project_type, budget_range, timeline, project_description,
          additional_info, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
      `, [
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
        intakeData.additionalInfo || intakeData['additional-info'] || null
      ]);

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
          timeline: intakeData.timeline || 'Not specified'
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
          estimatedResponseTime: '24-48 hours'
        });
      } catch (emailError) {
        await logger.error('Failed to send client confirmation email');
      }

      await logger.info('Client intake processed successfully');

      res.json({
        success: true,
        message: 'Your intake form has been submitted successfully. We will review your project requirements and get back to you within 24-48 hours.',
        intakeId,
        estimatedResponseTime: '24-48 hours'
      });

    } catch (error) {
      const err = error as Error;
      await logger.error('Intake form processing error');

      res.status(500).json({
        success: false,
        error: 'Failed to process intake form. Please try again or contact support.',
        code: 'INTAKE_PROCESSING_ERROR'
      });
    }
  }
);

/**
 * File upload endpoint
 */
router.post('/upload',
  // File upload rate limiting
  rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 10,
    message: 'Too many file uploads'
  }),

  // TODO: Add multer middleware for file handling
  // validateRequest for file metadata

  async (req, res) => {
    try {
      // TODO: Implement file upload handling
      res.json({
        success: true,
        message: 'File upload endpoint - not implemented yet',
        code: 'UPLOAD_NOT_IMPLEMENTED'
      });

    } catch (error) {
      const err = error as Error;
      await logger.error('File upload error');

      res.status(500).json({
        success: false,
        error: 'File upload failed',
        code: 'UPLOAD_ERROR'
      });
    }
  }
);

/**
 * Health check endpoint
 */
router.get('/health',
  // Lighter rate limiting for health checks
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 20,
    message: 'Too many health check requests'
  }),

  async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
      };

      res.json({
        success: true,
        data: health
      });

    } catch (error) {
      const err = error as Error;
      await logger.error('Health check error');

      res.status(500).json({
        success: false,
        error: 'Health check failed',
        code: 'HEALTH_CHECK_ERROR'
      });
    }
  }
);

/**
 * User registration endpoint
 */
router.post('/auth/register',
  // Registration rate limiting
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    keyGenerator: (req) => req.ip || 'unknown',
    message: 'Too many registration attempts'
  }),

  // Validate user registration data
  validateRequest(ValidationSchemas.user, {
    validateBody: true,
    stripUnknownFields: true
  }),

  async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const requestId = req.headers['x-request-id'] as string || 'unknown';

      // TODO: Check if user already exists
      // TODO: Hash password
      // TODO: Save to database
      // TODO: Send welcome email

      await logger.info('User registration attempt');

      res.json({
        success: true,
        message: 'Registration successful',
        userId: `user_${Date.now()}` // TODO: Replace with actual user ID
      });

    } catch (error) {
      const err = error as Error;
      await logger.error('User registration error');

      res.status(500).json({
        success: false,
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    }
  }
);

/**
 * Data query endpoint with pagination
 */
router.get('/data',
  validateRequest(ValidationSchemas.pagination, {
    validateQuery: true,
    stripUnknownFields: false
  }),

  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search
      } = req.query;

      await logger.info('Data query request');

      // TODO: Implement actual data querying
      const mockData = {
        data: [],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: 0,
          totalPages: 0
        },
        meta: {
          sortBy,
          sortOrder,
          search: search || null
        }
      };

      res.json({
        success: true,
        ...mockData
      });

    } catch (error) {
      const err = error as Error;
      await logger.error('Data query error');

      res.status(500).json({
        success: false,
        error: 'Data query failed',
        code: 'DATA_QUERY_ERROR'
      });
    }
  }
);

/**
 * API status and metrics endpoint
 */
router.get('/status',
  rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10
  }),

  async (req, res) => {
    try {
      // TODO: Gather actual metrics
      const status = {
        api: 'online',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
        requests: {
          total: 0, // TODO: Track actual requests
          rateLimit: {
            remaining: res.get('X-RateLimit-Remaining'),
            reset: res.get('X-RateLimit-Reset')
          }
        }
      };

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      const err = error as Error;
      await logger.error('API status error');

      res.status(500).json({
        success: false,
        error: 'Status check failed',
        code: 'STATUS_ERROR'
      });
    }
  }
);

// Handle 404 for unmatched API routes
router.use('*', async (req, res) => {
  await logger.error('API route not found');

  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.path
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
    requestId: req.headers['x-request-id']
  });
});

export default router;