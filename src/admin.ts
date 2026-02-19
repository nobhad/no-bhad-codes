/**
 * ===============================================
 * ADMIN DASHBOARD ENTRY POINT
 * ===============================================
 * @file src/admin.ts
 *
 * Entry point for the admin dashboard.
 * Loads unified portal CSS bundle (shared with client portal).
 */

// Import unified portal CSS bundle (covers both admin + client)
import './styles/bundles/unified-portal.css';

// Vercel Analytics (privacy-focused, no cookies)
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

// Initialize analytics in production
if (import.meta.env?.PROD) {
  inject();
  injectSpeedInsights();
}

// Import and initialize application
import { app } from './core/app';

// Export for debugging
export { app };

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).NBW_APP = app;
}
