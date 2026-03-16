/**
 * Auth Page Routes
 *
 * Server-side rendered routes for unauthenticated auth pages.
 * Uses the auth.ejs layout with EJS content partials.
 *
 * Routes:
 *   GET /set-password      → Set password (invitation flow)
 *   GET /forgot-password   → Request password reset
 *   GET /reset-password    → Reset password (from email link)
 *   GET /intake            → Project intake form (React mount)
 */

import { Router, Request, Response } from 'express';
import { BUSINESS_INFO } from '../config/business.js';

const router = Router();

const isDev = process.env.NODE_ENV !== 'production';
const META_THEME_COLOR = process.env.META_THEME_COLOR || '#e0e0e0';

/**
 * Minimal config object for the head.ejs partial (login portalType).
 * Auth pages only need title and themeColor.
 */
function authConfig(title: string) {
  return {
    title,
    themeColor: META_THEME_COLOR,
    // Satisfy head.ejs requirements
    dashboardId: '',
    pageTitleId: '',
    features: { subtabs: false, notificationBell: false, mobileMenuToggle: false }
  };
}

/**
 * Render an auth page using the auth.ejs layout with the given content partial.
 */
function renderAuthPage(
  res: Response,
  partial: string,
  options: {
    title: string;
    bodyPage: string;
    bodyView: string;
    entryScript: string;
    initModule?: string;
    initFunction?: string;
    cssBundle?: string;
  }
) {
  // Render the content partial first, then inject into the auth layout
  res.render(`pages/auth/${partial}`, {}, (err: Error | null, content: string) => {
    if (err) {
      return res.status(500).send('Render error');
    }

    res.render('layouts/auth', {
      config: authConfig(options.title),
      content,
      bodyPage: options.bodyPage,
      bodyView: options.bodyView,
      entryScript: options.entryScript,
      initModule: options.initModule,
      initFunction: options.initFunction,
      cssBundle: options.cssBundle,
      isDev,
      businessName: BUSINESS_INFO.name
    });
  });
}

// --- Routes ---

router.get('/set-password', (req: Request, res: Response) => {
  renderAuthPage(res, 'set-password', {
    title: `Set Your Password - ${BUSINESS_INFO.name} Client Portal`,
    bodyPage: 'client',
    bodyView: 'set-password',
    entryScript: '/src/portal.ts',
    initModule: '/src/features/auth/set-password-handler.ts',
    initFunction: 'initSetPasswordPage'
  });
});

router.get('/forgot-password', (req: Request, res: Response) => {
  renderAuthPage(res, 'forgot-password', {
    title: `Forgot Password - ${BUSINESS_INFO.name} Client Portal`,
    bodyPage: 'client',
    bodyView: 'forgot-password',
    entryScript: '/src/portal.ts',
    initModule: '/src/features/auth/forgot-password-handler.ts',
    initFunction: 'initForgotPasswordPage'
  });
});

router.get('/reset-password', (req: Request, res: Response) => {
  renderAuthPage(res, 'reset-password', {
    title: `Reset Password - ${BUSINESS_INFO.name} Client Portal`,
    bodyPage: 'client',
    bodyView: 'reset-password',
    entryScript: '/src/portal.ts',
    initModule: '/src/features/auth/reset-password-handler.ts',
    initFunction: 'initResetPasswordPage'
  });
});

router.get('/intake', (req: Request, res: Response) => {
  renderAuthPage(res, 'intake', {
    title: `Project Intake - ${BUSINESS_INFO.name}`,
    bodyPage: 'client-intake',
    bodyView: 'intake',
    entryScript: '/src/main-site.ts'
  });
});

export { router as authPageRoutes };
