/**
 * Sentry Instrumentation
 * MUST be imported before any other modules
 */
import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';

// Load env vars first
dotenv.config();

const dsn = process.env.SENTRY_DSN;

if (dsn && !dsn.includes('your-sentry') && !dsn.includes('placeholder') && dsn.startsWith('https://')) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
  console.log(`✅ Sentry instrumentation loaded for ${process.env.NODE_ENV || 'development'}`);
} else {
  console.warn('⚠️ Sentry DSN not configured. Error tracking disabled.');
}

export { Sentry };
