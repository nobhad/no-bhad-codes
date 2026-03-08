/**
 * ===============================================
 * MAIN APPLICATION ENTRY POINT
 * ===============================================
 * @file src/main.ts
 *
 * Main entry point for the NO BHAD WORKS application.
 * Initializes the application with the new architecture.
 */

// Import main CSS
import './styles/main.css';

// Vercel Analytics (privacy-focused, no cookies)
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { createLogger } from './utils/logger';
import { TIMING } from './constants/timing';

const logger = createLogger('Main');

// Initialize analytics in production
if (import.meta.env?.PROD) {
  inject();
  injectSpeedInsights();
}

// Failsafe: Ensure page content is visible after timeout
// This catches cases where intro animation fails or takes too long
if (typeof window !== 'undefined') {
  setTimeout(() => {
    const html = document.documentElement;
    if (html.classList.contains('intro-loading')) {
      logger.warn('Forcing intro-loading removal after timeout');
      html.classList.remove('intro-loading');
      html.classList.add('intro-complete', 'intro-finished');
    }
  }, TIMING.INTRO_LOADING_FAILSAFE);
}

// Import and initialize application
import { app } from './core/app';

// Export for debugging
export { app };

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.NBW_APP = app;
}
