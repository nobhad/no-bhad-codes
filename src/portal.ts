/**
 * ===============================================
 * CLIENT PORTAL ENTRY POINT
 * ===============================================
 * @file src/portal.ts
 *
 * Entry point for the client portal.
 * Loads unified portal CSS bundle (shared with admin).
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
  (window as any).NBW_APP = app;
}
