/**
 * ===============================================
 * EXPRESS SERVER APPLICATION
 * ===============================================
 * @file server/app.ts
 *
 * Main server application with middleware, routes, and error handling.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';
import { errorTracker } from './services/error-tracking.js';
import { emailService } from './services/email-service.js';
import { cacheService } from './services/cache-service.js';
import { initializeDatabase } from './database/init.js';
import authRouter from './routes/auth.js';
import clientsRouter from './routes/clients.js';
import projectsRouter from './routes/projects.js';
import adminRouter from './routes/admin.js';
import messagesRouter from './routes/messages.js';
import invoicesRouter from './routes/invoices.js';
import uploadsRouter from './routes/uploads.js';
// import { setupSwagger } from './config/swagger.js';
import { logger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Sentry for error tracking
// errorTracker.init({
//   dsn: process.env.SENTRY_DSN,
//   environment: process.env.NODE_ENV || 'development',
//   release: process.env.npm_package_version,
//   enableProfiling: process.env.NODE_ENV === 'production',
//   sampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0.1,
//   tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0
// });

// Request logging and error tracking
// app.use(logger);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.sentry.io"],
      fontSrc: ["'self'"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
app.use('/uploads', express.static(resolve(__dirname, '../uploads')));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'No Bhad Codes API Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      documentation: '/api-docs',
      invoices: '/api/invoices',
      uploads: '/api/uploads'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Setup API documentation
// setupSwagger(app);

// API routes
app.use('/api/auth', authRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/uploads', uploadsRouter);

// 404 handler
app.use('*', (req, res) => {
  errorTracker.captureMessage(`404 - Route not found: ${req.method} ${req.originalUrl}`, 'warning', {
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers as Record<string, string>
    }
  });
  
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Sentry error handler (must be before other error handlers)
app.use(errorTracker.errorHandler());

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

    // Initialize email service
    const emailConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      },
      from: process.env.SMTP_FROM || 'noreply@nobhadcodes.com',
      replyTo: process.env.SMTP_REPLY_TO
    };

    try {
      await emailService.init(emailConfig);
      console.log('✅ Email service initialized');
    } catch (emailError) {
      console.warn('⚠️  Email service initialization failed:', emailError);
      console.log('📧 Server will continue without email functionality');
    }

    // Initialize cache service
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
      
      // Close server
      server.close(async () => {
        console.log('✅ HTTP server closed');
        
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