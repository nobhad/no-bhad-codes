/**
 * ===============================================
 * GLOBAL ERROR HANDLER
 * ===============================================
 * @file src/portal-global-error-handler.ts
 *
 * Catches uncaught errors and unhandled promise rejections.
 * Must be imported early in the application lifecycle.
 */

import { createLogger } from './utils/logger';

const logger = createLogger('GlobalError');

let isInitialized = false;

/**
 * Initialize global error handlers
 * Should be called once at application startup
 */
export function initGlobalErrorHandler(): void {
  if (isInitialized) return;
  isInitialized = true;

  // Handle uncaught synchronous errors
  window.onerror = (message, source, lineno, colno, error): boolean => {
    logger.error('Uncaught error:', {
      message,
      source,
      line: lineno,
      column: colno,
      stack: error?.stack
    });
    // Return false to allow default browser error handling
    return false;
  };

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    logger.error('Unhandled promise rejection:', {
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined
    });
  });

  logger.info('Global error handler initialized');
}
