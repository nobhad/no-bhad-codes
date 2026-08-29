/**
 * ===============================================
 * STATIC PAGE ENTRY
 * ===============================================
 * @file src/static-page.ts
 *
 * Entry for the standalone pages that sit outside the SPA — the 404 shell
 * Vercel serves for unmatched routes, and the generated design-system
 * reference.
 *
 * These pages carry the site's real header and footer markup, so they pull
 * in the same stylesheet the site does rather than restating its values.
 * Anything that changes in the token files or in nav-base.css / footer.css
 * reaches these pages the same way it reaches every other page.
 *
 * Only the two modules the chrome actually needs are booted. The full site
 * entry would drag in the intro animation, the scroll map and the page
 * transitions, none of which have anything to drive on a flat document.
 */

import './styles/bundles/site.css';
import { createLogger } from './utils/logger';

const logger = createLogger('StaticPage');

async function boot(): Promise<void> {
  // Theme first: it owns the header toggle and the data-theme attribute the
  // rest of the stylesheet keys off.
  try {
    const { ThemeModule } = await import('./modules/utilities/theme');
    await new ThemeModule().init();
  } catch (error) {
    logger.error('Theme module failed to start:', error);
  }

  // The header's portal button opens a login dropdown. Its panel markup is
  // carried on these pages too, so the same initialiser the site uses drives
  // it — otherwise the button is a control that does nothing.
  try {
    const { initPortalDropdown } = await import('./features/main-site/portal-dropdown');
    initPortalDropdown();
  } catch (error) {
    logger.error('Portal dropdown failed to start:', error);
  }

  // These pages carry the site's header, so the menu button needs the module
  // that drives the overlay it opens.
  try {
    const { NavigationModule } = await import('./modules/ui/navigation');
    await new NavigationModule().init();
  } catch (error) {
    logger.error('Navigation module failed to start:', error);
  }

  // FooterCurtainModule is deliberately not started here. It stages the band
  // hidden and reveals it by sliding a fixed page up off it — a map-camera
  // move these pages do not make. The curtain sits in the document's flow
  // instead (see the standalone rules in components/footer.css), so running
  // the module would only leave its inner content staged at opacity 0 with
  // nothing to animate it back.
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void boot(), { once: true });
} else {
  void boot();
}
