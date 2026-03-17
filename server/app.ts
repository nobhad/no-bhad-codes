/**
 * ===============================================
 * EXPRESS SERVER APPLICATION
 * ===============================================
 * @file server/app.ts
 *
 * Main server application with middleware, routes, and error handling.
 */

// IMPORTANT: Instrumentation must be imported FIRST before any other modules
import { Sentry, shutdownOpenTelemetry } from './instrument.js';

// Import observability utilities after instrumentation
import {
  initMetrics,
  registerDbStatsCallback
} from './observability/metrics.js';

import express from 'express';
import { i18nMiddleware } from './middleware/i18n-middleware.js';
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
import { registerWorkflowAutomations } from './services/workflow-automations.js';
import {
  initializeDatabase,
  closeDatabase,
  getDatabaseStats
} from './database/init.js';
import { MigrationManager } from './database/migrations.js';
import sqlite3 from 'sqlite3';
import authRouter from './routes/auth.js';
import clientsRouter from './routes/clients.js';
import projectsRouter from './routes/projects/index.js';
import adminRouter from './routes/admin/index.js';
import messagesRouter from './routes/messages.js';
import { invoicesRouter } from './routes/invoices/index.js';
import uploadsRouter from './routes/uploads.js';
import intakeRouter from './routes/intake.js';
import proposalsRouter from './routes/proposals.js';
import contractsRouter from './routes/contracts.js';
import adHocRequestsRouter from './routes/ad-hoc-requests.js';
import apiRouter from './routes/api.js';
import analyticsRouter from './routes/analytics.js';
import approvalsRouter from './routes/approvals.js';
import triggersRouter from './routes/triggers.js';
import documentRequestsRouter from './routes/document-requests.js';
import knowledgeBaseRouter from './routes/knowledge-base.js';
import questionnairesRouter from './routes/questionnaires.js';
import clientInfoRouter from './routes/client-info.js';
import emailTemplatesRouter from './routes/email-templates.js';
import webhooksRouter from './routes/webhooks.js';
import deliverablesRouter from './routes/deliverables.js';
import integrationsRouter from './routes/integrations.js';
import dataQualityRouter from './routes/data-quality.js';
import paymentSchedulesRouter from './routes/payment-schedules.js';
import contentRequestsRouter from './routes/content-requests.js';
import settingsRouter from './routes/settings.js';
import receiptsRouter from './routes/receipts.js';
import paymentsRouter from './routes/payments/index.js';
import agreementsRouter from './routes/agreements/index.js';
import onboardingChecklistRouter from './routes/onboarding-checklist/index.js';
import sequencesRouter from './routes/sequences/index.js';
import meetingRequestsRouter from './routes/meeting-requests/index.js';
import automationsRouter from './routes/automations/index.js';
import expensesRouter from './routes/expenses/index.js';
import retainersRouter from './routes/retainers/index.js';
import { eventsRouter } from './routes/events.js';
import { searchRouter } from './routes/search.js';
import healthRouter from './routes/health.js';
import { portalRoutes } from './routes/portal.js';
import { authPageRoutes } from './routes/auth-pages.js';
import { errorResponseWithPayload } from './utils/api-response.js';
import { setupSwagger } from './config/swagger.js';
import { BUSINESS_INFO } from './config/business.js';
import { logger as requestLoggerMiddleware } from './middleware/logger.js';
import { logger } from './services/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { sanitizeInputs } from './middleware/sanitization.js';
import { auditMiddleware } from './middleware/audit.js';
import { rateLimiters } from './middleware/rate-limiter.js';
import { csrfProtection } from './middleware/security.js';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Trust proxy when behind reverse proxy (Railway, Nginx, CloudFlare, etc.)
// Required for accurate req.ip in rate limiting, CSRF, audit logging
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

app.use(i18nMiddleware);
const PORT = process.env.PORT || 4001;

// Configure EJS view engine for server-side rendered portal shells
app.set('view engine', 'ejs');
app.set('views', resolve(__dirname, 'views'));

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
app.use(requestLoggerMiddleware);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ['\'self\''],
        scriptSrc: ['\'self\'', '\'unsafe-inline\'', 'https://js.stripe.com'], // GSAP does not require unsafe-eval; Stripe Elements SDK
        styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com'],
        imgSrc: ['\'self\'', 'data:', 'https:', 'blob:'],
        connectSrc: [
          '\'self\'',
          'https://api.sentry.io',
          'https://api.stripe.com',
          // Allow localhost API connections in development (Vite on 4000 -> Express on 4001)
          ...(process.env.NODE_ENV !== 'production'
            ? ['http://localhost:4001', 'ws://localhost:4001']
            : [])
        ],
        fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
        mediaSrc: ['\'self\''],
        objectSrc: ['\'none\''],
        frameSrc: ['\'self\'', 'https://js.stripe.com'],
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
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // HTTP Strict Transport Security - prevent SSL downgrade attacks
    // Only enabled in production where HTTPS is enforced
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
      'x-csrf-token'
    ]
  })
);

// Body parsing middleware
// Skip JSON parsing for Stripe webhook (needs raw body for signature verification)
app.use((req, res, next) => {
  if (
    req.path === '/api/integrations/stripe/webhook' ||
    req.path === '/api/v1/integrations/stripe/webhook' ||
    req.path === '/api/payments/webhook' ||
    req.path === '/api/v1/payments/webhook'
  ) {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing middleware (for HttpOnly auth cookies)
app.use(cookieParser());

// CSRF token cookie - set on every request if not present
// This cookie is readable by JavaScript so the client can send it in headers
app.use((req, res, next) => {
  if (!req.cookies['csrf-token']) {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('csrf-token', csrfToken, {
      httpOnly: false, // Must be readable by JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days - matches longest session duration
    });
  }
  next();
});

// Global input sanitization - sanitize all request body, query, and params
// to prevent XSS and script injection attacks
app.use(
  sanitizeInputs({
    sanitizeBody: true,
    sanitizeQuery: true,
    sanitizeParams: true,
    skipPaths: ['/uploads', '/webhooks', '/integrations/stripe/webhook']
  })
);

// Audit logging middleware - logs all POST, PUT, DELETE operations
app.use(auditMiddleware());

// Static file serving
app.use('/uploads', express.static(resolve(__dirname, '../uploads')));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: `${BUSINESS_INFO.name} API Server`,
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
        contracts: '/api/v1/contracts',
        adHocRequests: '/api/v1/ad-hoc-requests',
        analytics: '/api/v1/analytics',
        approvals: '/api/v1/approvals',
        triggers: '/api/v1/triggers',
        documentRequests: '/api/v1/document-requests',
        knowledgeBase: '/api/v1/kb',
        webhooks: '/api/v1/webhooks',
        dataQuality: '/api/v1/data-quality',
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
        contracts: '/api/contracts',
        adHocRequests: '/api/ad-hoc-requests',
        analytics: '/api/analytics',
        approvals: '/api/approvals',
        triggers: '/api/triggers',
        documentRequests: '/api/document-requests',
        knowledgeBase: '/api/kb',
        webhooks: '/api/webhooks',
        dataQuality: '/api/data-quality',
        contact: '/api/contact'
      }
    }
  });
});

// Health check endpoints with comprehensive diagnostics
// Provides: GET /health, /health/live, /health/ready, /health/db
app.use('/health', healthRouter);

// Setup API documentation
setupSwagger(app);

// Rate limiting for API routes
// IMPORTANT: More specific routes must come BEFORE general routes in Express
// Rate limiters must be registered BEFORE route handlers to take effect

// Higher rate limit for admin routes (authenticated dashboard users)
// Authenticated rate limit: 120 requests per minute
app.use('/api/admin', rateLimiters.authenticated);

// Standard rate limit for other API routes: 60 requests per minute
app.use('/api', rateLimiters.standard);

// Auth page routes (EJS server-rendered: set-password, forgot-password, reset-password, intake)
app.use(authPageRoutes);

// Portal routes (EJS server-rendered shells)
// These render the admin and client portal HTML shells
app.use(portalRoutes);

// CSRF protection for state-changing API requests
// Validates that x-csrf-token header matches csrf-token cookie
app.use(
  '/api',
  csrfProtection({
    headerName: 'x-csrf-token',
    cookieName: 'csrf-token',
    skipIf: (req) => {
      // Skip CSRF for webhook endpoints (they use signature verification)
      if (req.path.includes('/webhooks/')) return true;
      // Skip CSRF for payment webhooks (Stripe signature verification)
      if (req.path.includes('/payments/webhook')) return true;
      // Skip CSRF for file uploads (may use FormData without custom headers)
      if (req.path.includes('/uploads') && req.method === 'POST') return true;
      // Skip CSRF for intake form (public endpoint)
      if (req.path.includes('/intake')) return true;
      // Skip CSRF for auth endpoints (login, register, password reset)
      // These endpoints have their own rate limiting and validation
      if (req.path.includes('/auth/')) return true;
      // Skip CSRF for public proposal signature endpoints
      if (req.path.match(/\/proposals\/\d+\/sign/) || req.path.match(/\/proposals\/sign\//)) return true;
      // Skip CSRF for analytics tracking (public endpoint, uses rate limiting)
      if (req.path.includes('/analytics/track')) return true;
      return false;
    }
  })
);

// Stricter rate limiting for sensitive endpoints
// Sensitive rate limit: 10 requests per hour for payment operations
app.use('/api/invoices/:id/pay', rateLimiters.sensitive);
app.use('/api/v1/invoices/:id/pay', rateLimiters.sensitive);
app.use('/api/webhooks/stripe', rateLimiters.sensitive);
app.use('/api/v1/webhooks/stripe', rateLimiters.sensitive);

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
  { path: '/contracts', router: contractsRouter },
  { path: '/ad-hoc-requests', router: adHocRequestsRouter },
  { path: '/analytics', router: analyticsRouter },
  { path: '/approvals', router: approvalsRouter },
  { path: '/triggers', router: triggersRouter },
  { path: '/document-requests', router: documentRequestsRouter },
  { path: '/kb', router: knowledgeBaseRouter },
  { path: '/questionnaires', router: questionnairesRouter },
  { path: '/client-info', router: clientInfoRouter },
  { path: '/email-templates', router: emailTemplatesRouter },
  { path: '/webhooks', router: webhooksRouter },
  { path: '/deliverables', router: deliverablesRouter },
  { path: '/integrations', router: integrationsRouter },
  { path: '/data-quality', router: dataQualityRouter },
  { path: '/settings', router: settingsRouter },
  { path: '/receipts', router: receiptsRouter },
  { path: '/events', router: eventsRouter },
  { path: '/search', router: searchRouter },
  { path: '/payment-schedules', router: paymentSchedulesRouter },
  { path: '/content-requests', router: contentRequestsRouter },
  { path: '/payments', router: paymentsRouter },
  { path: '/agreements', router: agreementsRouter },
  { path: '/onboarding-checklist', router: onboardingChecklistRouter },
  { path: '/sequences', router: sequencesRouter },
  { path: '/meeting-requests', router: meetingRequestsRouter },
  { path: '/automations', router: automationsRouter },
  { path: '/expenses', router: expensesRouter },
  { path: '/retainers', router: retainersRouter }
];

// Mount all routers at both /api and /api/v1
apiRouters.forEach(({ path, router }) => {
  app.use(`/api${path}`, router);
  app.use(`/api/v1${path}`, router);
});

// Portal route aliases - for frontend consistency
app.use('/api/portal/projects', projectsRouter);
app.use('/api/v1/portal/projects', projectsRouter);

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
        headers: Object.fromEntries(
          Object.entries(req.headers).filter(
            ([key]) => !['authorization', 'cookie', 'x-api-key', 'x-csrf-token', 'x-auth-token'].includes(key.toLowerCase())
          )
        ) as Record<string, string>
      }
    }
  );

  errorResponseWithPayload(res, 'Route not found', 404, 'RESOURCE_NOT_FOUND', {
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
    logger.info('Database initialized');

    // Initialize observability metrics and register database stats callback
    initMetrics();
    registerDbStatsCallback(() => {
      const stats = getDatabaseStats();
      return stats
        ? {
          active: stats.activeConnections,
          idle: stats.idleConnections,
          queued: stats.queuedRequests
        }
        : { active: 0, idle: 0, queued: 0 };
    });
    logger.info('Observability metrics initialized');

    // Run database migrations
    const dbPath = process.env.DATABASE_PATH || './data/client_portal.db';
    const db = new sqlite3.Database(dbPath);
    const migrator = new MigrationManager(db);

    try {
      await migrator.migrate();
      logger.info('Database migrations complete');
    } catch (migrationError) {
      logger.error('Migration failed:', {
        error: migrationError instanceof Error ? migrationError : undefined
      });
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
      from: process.env.SMTP_FROM || BUSINESS_INFO.email,
      replyTo: process.env.SMTP_REPLY_TO
    };

    try {
      await emailService.init(emailConfig);
      logger.info('Email service initialized');
    } catch (emailError) {
      logger.warn('Email service initialization failed:', {
        error: emailError instanceof Error ? emailError : undefined
      });
      logger.info('Server will continue without email functionality');
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
        logger.info('Cache service initialized');
      } catch (cacheError) {
        logger.warn('Cache service initialization failed:', {
          error: cacheError instanceof Error ? cacheError : undefined
        });
        logger.info('Server will continue without caching functionality');
      }
    } else {
      logger.info('Redis caching disabled (set REDIS_ENABLED=true to enable)');
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
        logger.info('Scheduler service initialized');
      } catch (schedulerError) {
        logger.warn('Scheduler service initialization failed:', {
          error: schedulerError instanceof Error ? schedulerError : undefined
        });
        logger.info('Server will continue without scheduling functionality');
      }
    } else {
      logger.info('Scheduler disabled (set SCHEDULER_ENABLED=true to enable)');
    }

    // Register workflow automations
    try {
      registerWorkflowAutomations();
      logger.info('Workflow automations registered');
    } catch (workflowError) {
      logger.warn('Workflow automations registration failed:', {
        error: workflowError instanceof Error ? workflowError : undefined
      });
      logger.info('Server will continue without workflow automations');
    }

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);

      errorTracker.captureMessage(`Server started on port ${PORT}`, 'info', {
        tags: { component: 'server' },
        extra: { port: PORT, environment: process.env.NODE_ENV }
      });
    });

    // Set server timeouts to prevent hanging connections
    const SERVER_TIMEOUT_MS = 30_000;
    const HEADERS_TIMEOUT_MS = 60_000;
    server.setTimeout(SERVER_TIMEOUT_MS);
    server.headersTimeout = HEADERS_TIMEOUT_MS;

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`);

      // Stop scheduler service
      try {
        const scheduler = getSchedulerService();
        scheduler.stop();
        logger.info('Scheduler service stopped');
      } catch (error) {
        logger.error('Error stopping scheduler:', {
          error: error instanceof Error ? error : undefined
        });
      }

      // Close server
      server.close(async () => {
        logger.info('HTTP server closed');

        // Close database pool
        try {
          await closeDatabase();
        } catch (dbErr) {
          logger.error('Error closing database:', {
            error: dbErr instanceof Error ? dbErr : undefined
          });
        }

        // Flush Sentry events
        try {
          await errorTracker.flush(2000);
          await errorTracker.close(1000);
          logger.info('Error tracking closed');
        } catch (error) {
          logger.error('Error closing error tracking:', {
            error: error instanceof Error ? error : undefined
          });
        }

        // Shutdown OpenTelemetry
        try {
          await shutdownOpenTelemetry();
          logger.info('OpenTelemetry shutdown complete');
        } catch (error) {
          logger.error('Error shutting down OpenTelemetry:', {
            error: error instanceof Error ? error : undefined
          });
        }

        logger.info('Server shut down complete');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', { error: error instanceof Error ? error : undefined });
    errorTracker.captureException(error as Error, {
      tags: { component: 'server', phase: 'startup' }
    });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
  errorTracker.captureException(error, {
    tags: { type: 'uncaughtException' }
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { metadata: { promise: promise.toString(), reason } });
  errorTracker.captureException(new Error(`Unhandled Rejection: ${reason}`), {
    tags: { type: 'unhandledRejection' },
    extra: { promise: promise.toString(), reason }
  });
  process.exit(1);
});

// Start the server
startServer();

export { app };
