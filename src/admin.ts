/**
 * ===============================================
 * ADMIN DASHBOARD ENTRY POINT
 * ===============================================
 * @file src/admin.ts
 *
 * Entry point for the admin dashboard.
 */

// CRITICAL: Register React components BEFORE app initialization
// This must be the FIRST import to prevent race conditions
import './react/admin-entry';

// Import admin CSS bundle
import './styles/bundles/admin.css';

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
