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

  // The curtain is revealed by the page sliding up off it, which needs a
  // scrollable page behind it. A short document has nothing to slide, so the
  // module is only worth booting once the content actually overflows.
  const overflows = document.documentElement.scrollHeight > window.innerHeight + 1;
  if (!overflows) {
    document.documentElement.setAttribute('data-curtain', 'static');
    return;
  }

  try {
    const { FooterCurtainModule } = await import('./modules/ui/footer-curtain');
    await new FooterCurtainModule().init();
  } catch (error) {
    logger.error('Footer curtain failed to start:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void boot(), { once: true });
} else {
  void boot();
}
