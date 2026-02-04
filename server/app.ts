/**
 * ===============================================
 * EXPRESS SERVER APPLICATION
 * ===============================================
 * @file server/app.ts
 *
 * Main server application with middleware, routes, and error handling.
 */

// IMPORTANT: Sentry must be imported FIRST before any other modules
import { Sentry } from './instrument.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';
import { errorTracker } from './services/error-tracking.js';
import { emailService } from './services/email-service.js';
import { cacheService } from './services/cache-service.js';
import { getSchedulerService } from './services/scheduler-service.js';
import { initializeDatabase, getDatabase, closeDatabase } from './database/init.js';
import { MigrationManager } from './database/migrations.js';
import sqlite3 from 'sqlite3';
import authRouter from './routes/auth.js';
import clientsRouter from './routes/clients.js';
import projectsRouter from './routes/projects.js';
import adminRouter from './routes/admin.js';
import messagesRouter from './routes/messages.js';
import invoicesRouter from './routes/invoices.js';
import uploadsRouter from './routes/uploads.js';
import intakeRouter from './routes/intake.js';
import proposalsRouter from './routes/proposals.js';
import apiRouter from './routes/api.js';
import analyticsRouter from './routes/analytics.js';
import approvalsRouter from './routes/approvals.js';
import triggersRouter from './routes/triggers.js';
import documentRequestsRouter from './routes/document-requests.js';
import knowledgeBaseRouter from './routes/knowledge-base.js';
import { setupSwagger } from './config/swagger.js';
import { logger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { sanitizeInputs } from './middleware/sanitization.js';
import { auditMiddleware } from './middleware/audit.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4001;

// Initialize Sentry for error tracking
errorTracker.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version,
  enableProfiling: process.env.NODE_ENV === 'production',
  sampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0.1,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0
});

// Request ID for tracing (must be early for logging)
app.use(requestIdMiddleware);

// Request logging and error tracking
app.use(logger);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ['\'self\''],
        scriptSrc: ['\'self\'', '\'unsafe-inline\'', '\'unsafe-eval\''], // unsafe-eval needed for GSAP
        styleSrc: ['\'self\'', '\'unsafe-inline\''],
        imgSrc: ['\'self\'', 'data:', 'https:', 'blob:'],
        connectSrc: ['\'self\'', 'https://api.sentry.io'],
        fontSrc: ['\'self\''],
        mediaSrc: ['\'self\''],
        objectSrc: ['\'none\''],
        frameSrc: ['\'none\''],
        baseUri: ['\'self\''],
        formAction: ['\'self\'']
      }
    },
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Hide X-Powered-By header
    hidePoweredBy: true,
    // Prevent MIME type sniffing
    noSniff: true,
    // XSS filter (legacy browsers)
    xssFilter: true,
    // Referrer policy - don't leak referrer to external sites
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID']
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing middleware (for HttpOnly auth cookies)
app.use(cookieParser());

// Global input sanitization - sanitize all request body, query, and params
// to prevent XSS and script injection attacks
app.use(
  sanitizeInputs({
    sanitizeBody: true,
    sanitizeQuery: true,
    sanitizeParams: true,
    skipPaths: ['/uploads'] // Skip file upload paths
  })
);

// Audit logging middleware - logs all POST, PUT, DELETE operations
app.use(auditMiddleware());

// Static file serving
app.use('/uploads', express.static(resolve(__dirname, '../uploads')));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'No Bhad Codes API Server',
    version: '1.0.0',
    apiVersion: 'v1',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      documentation: '/api-docs',
      // Canonical v1 endpoints (recommended)
      v1: {
        auth: '/api/v1/auth',
        admin: '/api/v1/admin',
        clients: '/api/v1/clients',
        projects: '/api/v1/projects',
        messages: '/api/v1/messages',
        invoices: '/api/v1/invoices',
        uploads: '/api/v1/uploads',
        intake: '/api/v1/intake',
        proposals: '/api/v1/proposals',
        analytics: '/api/v1/analytics',
        approvals: '/api/v1/approvals',
        triggers: '/api/v1/triggers',
        documentRequests: '/api/v1/document-requests',
        knowledgeBase: '/api/v1/kb',
        contact: '/api/v1/contact'
      },
      // Legacy endpoints (still supported)
      legacy: {
        auth: '/api/auth',
        admin: '/api/admin',
        clients: '/api/clients',
        projects: '/api/projects',
        messages: '/api/messages',
        invoices: '/api/invoices',
        uploads: '/api/uploads',
        intake: '/api/intake',
        proposals: '/api/proposals',
        analytics: '/api/analytics',
        approvals: '/api/approvals',
        triggers: '/api/triggers',
        documentRequests: '/api/document-requests',
        knowledgeBase: '/api/kb',
        contact: '/api/contact'
      }
    }
  });
});

// Health check endpoint (includes DB ping for depth)
app.get('/health', async (_req, res) => {
  const health: Record<string, unknown> = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime()
  };

  // Check database
  try {
    const db = getDatabase();
    await db.get('SELECT 1');
    health.database = { status: 'connected' };
  } catch (err) {
    health.status = 'degraded';
    health.database = { status: 'error', error: (err as Error).message };
  }

  // Check email service
  try {
    const emailStatus = emailService.getStatus();
    health.email = emailStatus.initialized ? 'configured' : 'not_configured';
    health.services = { email: emailStatus.initialized };
  } catch {
    health.email = 'unknown';
  }

  // Check scheduler service
  try {
    const scheduler = getSchedulerService();
    const schedulerStatus = scheduler.getStatus();
    health.scheduler = schedulerStatus.isRunning ? 'Running' : 'Stopped';
  } catch {
    health.scheduler = 'unknown';
  }

  const statusCode = (health.status as string) === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Setup API documentation
setupSwagger(app);

// API routes - mount at both /api and /api/v1 for versioning
const apiRouters = [
  { path: '/auth', router: authRouter },
  { path: '/clients', router: clientsRouter },
  { path: '/projects', router: projectsRouter },
  { path: '/admin', router: adminRouter },
  { path: '/messages', router: messagesRouter },
  { path: '/invoices', router: invoicesRouter },
  { path: '/uploads', router: uploadsRouter },
  { path: '/intake', router: intakeRouter },
  { path: '/proposals', router: proposalsRouter },
  { path: '/analytics', router: analyticsRouter },
  { path: '/approvals', router: approvalsRouter },
  { path: '/triggers', router: triggersRouter },
  { path: '/document-requests', router: documentRequestsRouter },
  { path: '/kb', router: knowledgeBaseRouter }
];

// Mount all routers at both /api and /api/v1
apiRouters.forEach(({ path, router }) => {
  app.use(`/api${path}`, router);
  app.use(`/api/v1${path}`, router);
});

// General API routes (contact, etc.) - also dual mount
app.use('/api', apiRouter);
app.use('/api/v1', apiRouter);

// 404 handler
// Note: Express 5 doesn't support app.use('*') - use regular middleware instead
app.use((req, res) => {
  errorTracker.captureMessage(
    `404 - Route not found: ${req.method} ${req.originalUrl}`,
    'warning',
    {
      request: {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers as Record<string, string>
      }
    }
  );

  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Sentry error handler (must be before other error handlers)
Sentry.setupExpressErrorHandler(app);

// Global error handler
app.use(errorHandler);

/**
 * Start the server
 */
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Run database migrations
    const dbPath = process.env.DATABASE_PATH || './data/client_portal.db';
    const db = new sqlite3.Database(dbPath);
    const migrator = new MigrationManager(db);

    try {
      await migrator.migrate();
      console.log('✅ Database migrations complete');
    } catch (migrationError) {
      console.error('❌ Migration failed:', migrationError);
      throw migrationError;
    } finally {
      db.close();
    }

    // Initialize email service
    const emailConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      },
      from: process.env.SMTP_FROM || 'nobhaduri@gmail.com',
      replyTo: process.env.SMTP_REPLY_TO
    };

    try {
      await emailService.init(emailConfig);
      console.log('✅ Email service initialized');
    } catch (emailError) {
      console.warn('⚠️  Email service initialization failed:', emailError);
      console.log('📧 Server will continue without email functionality');
    }

    // Initialize cache service (only if Redis is enabled)
    if (process.env.REDIS_ENABLED === 'true') {
      const cacheConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'nbc:',
        lazyConnect: true
      };

      try {
        await cacheService.init(cacheConfig);
        console.log('✅ Cache service initialized');
      } catch (cacheError) {
        console.warn('⚠️  Cache service initialization failed:', cacheError);
        console.log('🚀 Server will continue without caching functionality');
      }
    } else {
      console.log('ℹ️  Redis caching disabled (set REDIS_ENABLED=true to enable)');
    }

    // Initialize scheduler service for invoice reminders and recurring invoices
    if (process.env.SCHEDULER_ENABLED !== 'false') {
      try {
        const scheduler = getSchedulerService({
          enableReminders: process.env.SCHEDULER_REMINDERS !== 'false',
          enableScheduledInvoices: process.env.SCHEDULER_SCHEDULED !== 'false',
          enableRecurringInvoices: process.env.SCHEDULER_RECURRING !== 'false'
        });
        scheduler.start();
        console.log('✅ Scheduler service initialized');
      } catch (schedulerError) {
        console.warn('⚠️  Scheduler service initialization failed:', schedulerError);
        console.log('📅 Server will continue without scheduling functionality');
      }
    } else {
      console.log('ℹ️  Scheduler disabled (set SCHEDULER_ENABLED=true to enable)');
    }

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);

      errorTracker.captureMessage(`Server started on port ${PORT}`, 'info', {
        tags: { component: 'server' },
        extra: { port: PORT, environment: process.env.NODE_ENV }
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n🔄 ${signal} received. Shutting down gracefully...`);

      // Stop scheduler service
      try {
        const scheduler = getSchedulerService();
        scheduler.stop();
        console.log('✅ Scheduler service stopped');
      } catch (error) {
        console.error('❌ Error stopping scheduler:', error);
      }

      // Close server
      server.close(async () => {
        console.log('✅ HTTP server closed');

        // Close database pool
        try {
          await closeDatabase();
        } catch (dbErr) {
          console.error('❌ Error closing database:', dbErr);
        }

        // Flush Sentry events
        try {
          await errorTracker.flush(2000);
          await errorTracker.close(1000);
          console.log('✅ Error tracking closed');
        } catch (error) {
          console.error('❌ Error closing error tracking:', error);
        }

        console.log('👋 Server shut down complete');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    errorTracker.captureException(error as Error, {
      tags: { component: 'server', phase: 'startup' }
    });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  errorTracker.captureException(error, {
    tags: { type: 'uncaughtException' }
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  errorTracker.captureException(new Error(`Unhandled Rejection: ${reason}`), {
    tags: { type: 'unhandledRejection' },
    extra: { promise: promise.toString(), reason }
  });
  process.exit(1);
});

// Start the server
startServer();

export { app };
