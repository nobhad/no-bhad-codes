/**
 * ===============================================
 * CLIENT PORTAL ENTRY POINT
 * ===============================================
 * @file src/portal.ts
 *
 * Entry point for the client portal.
 */

// CRITICAL: Register React components BEFORE app initialization
// This must be the FIRST import to prevent race conditions
import './react/portal-entry';

// Import client portal CSS bundle
import './styles/bundles/portal.css';

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

// Import password toggle component
import { initAllPasswordToggles } from './components/password-toggle';

// Initialize password toggles when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initAllPasswordToggles();
});

// Export for debugging
export { app };

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.NBW_APP = app;
}
