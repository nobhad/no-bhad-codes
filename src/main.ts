/**
 * ===============================================
 * MAIN APPLICATION ENTRY POINT
 * ===============================================
 * @file src/main.ts
 *
 * Main entry point for the NO BHAD WORKS application.
 * Initializes the application with the new architecture.
 */

// Import new modular CSS architecture
import './styles/main-new.css';

// Vercel Analytics (privacy-focused, no cookies)
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

// Initialize analytics in production
if (import.meta.env?.PROD) {
  inject();
  injectSpeedInsights();
}

// Failsafe: Ensure page content is visible after 3 seconds
// This catches cases where intro animation fails or takes too long
if (typeof window !== 'undefined') {
  setTimeout(() => {
    const html = document.documentElement;
    if (html.classList.contains('intro-loading')) {
      console.warn('[Failsafe] Forcing intro-loading removal after timeout');
      html.classList.remove('intro-loading');
      html.classList.add('intro-complete', 'intro-finished');
    }
  }, 3000);
}

// Import and initialize application
import { app } from './core/app';

// Export for debugging
export { app };

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).NBW_APP = app;
}
