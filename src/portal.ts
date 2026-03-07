/**
 * ===============================================
 * CLIENT PORTAL ENTRY POINT
 * ===============================================
 * @file src/portal.ts
 *
 * Entry point for the client portal.
 */

// Import Tailwind CSS for React portal components
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

// Import and initialize application (React SPA mounts via ReactPortalModule)
import { app } from './core/app';

// Export for debugging
export { app };

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.NBW_APP = app;
}
