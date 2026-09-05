/**
 * ===============================================
 * MAIN SITE ENTRY POINT
 * ===============================================
 * @file src/main-site.ts
 *
 * Entry point for the main marketing site (index.html).
 * Loads site-specific CSS bundle (no admin/portal styles).
 */

// Import site-specific CSS bundle
import './styles/bundles/site.css';

// Vercel Analytics (privacy-focused, no cookies)
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

import { createLogger } from './utils/logger';

const logger = createLogger('MainSite');

// Initialize analytics in production
if (import.meta.env?.PROD) {
  inject();
  injectSpeedInsights();
}

// Service worker (production only). public/sw.js is network-first for
// /api and /data JSON, cache-first for hashed static assets, and serves
// /offline.html when a navigation fails. The portal shell served from the
// API host registers the same file (server/views/partials/head.ejs), so
// registering it here too means every visitor gets the same behaviour
// rather than only those who have opened the portal.
if (import.meta.env?.PROD && 'serviceWorker' in navigator && location.hostname !== 'localhost') {
  window.addEventListener(
    'load',
    () => {
      navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        logger.warn('Service worker registration failed', error);
      });
    },
    { once: true }
  );
}

// Failsafe: Ensure page content is visible after 10 seconds
// This catches cases where intro animation fails or takes too long
if (typeof window !== 'undefined') {
  setTimeout(() => {
    const html = document.documentElement;
    if (html.classList.contains('intro-loading')) {
      logger.warn('Forcing intro-loading removal after timeout');
      html.classList.remove('intro-loading');
      html.classList.add('intro-complete', 'intro-finished');
    }
  }, 10000);
}

// Import and initialize application
import { app } from './core/app';

// A projects deep link needs two lazy chunks the app only asks for once it has
// booted: the transition module and the TV. Start them now, in parallel with
// boot, so the cabinet is not waiting on a chain of round trips. Vite serves
// the same chunk to this import and to the app's later one.
const initialPage = document.documentElement.getAttribute('data-initial-page');
if (initialPage === 'projects' || initialPage === 'project-detail') {
  void import('./modules/animation/page-transition');
  void import('./modules/ui/projects');
}
import { initPortalDropdown } from './features/main-site/portal-dropdown';
import { PortalLoginOnMainSite } from './features/main-site/portal-login';

// Export for debugging
export { app };

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.NBW_APP = app;
}

// Portal login wiring (dropdown + #/portal hash page)
function initMainSiteAuth(): void {
  initPortalDropdown();
  new PortalLoginOnMainSite().init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMainSiteAuth, { once: true });
} else {
  initMainSiteAuth();
}
