/**
 * Portal Routes
 *
 * Server-side rendering routes for admin and client portals.
 * Uses EJS templates for the shell, with client-side TypeScript for interactivity.
 *
 * Architecture:
 *   /portal          → unified login page (no auth required)
 *   /client/portal   → client entry point (auth-gated → /dashboard or /#/portal)
 *   /dashboard       → role-based dashboard (requires valid JWT)
 *   /admin/login     → 301 redirect to /portal
 *   /client/login    → 301 redirect to /portal
 *   /admin           → 301 redirect to /dashboard
 *   /client          → 301 redirect to /dashboard
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getPortalConfig, ADMIN_TAB_IDS, CLIENT_TAB_IDS, ICONS } from '../config/navigation.js';
import { COOKIE_CONFIG } from '../utils/auth-constants.js';

import { BUSINESS_INFO } from '../config/business.js';

const router = Router();

// Check if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Decode and verify JWT from request cookies.
 * Returns the decoded payload or null if invalid/missing.
 */
function decodePortalJwt(req: Request): { type: string } | null {
  const token = req.cookies?.[COOKIE_CONFIG.AUTH_TOKEN_NAME];
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    return jwt.verify(token, secret) as { type: string };
  } catch {
    return null;
  }
}

/**
 * Portal Login - Redirect to hash page on main site.
 * The login form lives at /#/portal on the main site.
 * Redirects to /dashboard if user already has a valid session.
 */
router.get('/portal', (req: Request, res: Response) => {
  const decoded = decodePortalJwt(req);
  if (decoded) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/#/portal');
});

/**
 * Unified Dashboard
 * Reads the JWT from the cookie, determines the user's role, and renders
 * the appropriate portal template (admin or client).
 * Redirects to /portal if the user has no valid session.
 */
router.get('/dashboard', (req: Request, res: Response) => {
  const decoded = decodePortalJwt(req);

  if (!decoded) {
    return res.redirect('/#/portal');
  }

  if (decoded.type === 'admin') {
    const config = getPortalConfig('admin');
    return res.render('layouts/portal', {
      portalType: 'admin',
      config,
      icons: ICONS,
      tabIds: ADMIN_TAB_IDS,
      entryScript: '/src/admin.ts',
      cssBundle: '/src/styles/bundles/admin.css',
      bodyClass: 'admin',
      bodyPage: 'admin',
      isDev,
      businessName: BUSINESS_INFO.name
    });
  }

  // Client (or any non-admin role)
  const config = getPortalConfig('client');
  return res.render('layouts/portal', {
    portalType: 'client',
    config,
    icons: ICONS,
    tabIds: CLIENT_TAB_IDS,
    entryScript: '/src/portal.ts',
    cssBundle: '/src/styles/bundles/client.css',
    bodyClass: 'client',
    bodyPage: 'client',
    isDev,
    businessName: BUSINESS_INFO.name
  });
});

// ============================================
// Client Portal Entry Point
// ============================================

/**
 * GET /client/portal
 * Primary entry point used by main site login buttons, email links,
 * password-set flow, and email verification redirects.
 * Redirects to /dashboard if authenticated, or /#/portal (login) if not.
 */
router.get('/client/portal', (req: Request, res: Response) => {
  const decoded = decodePortalJwt(req);
  if (decoded) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/#/portal');
});

/**
 * GET /client/portal.html
 * Legacy .html variant used in some email templates.
 */
router.get('/client/portal.html', (req: Request, res: Response) => {
  const decoded = decodePortalJwt(req);
  if (decoded) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/#/portal');
});

// ============================================
// Legacy Route Redirects (301 Permanent)
// ============================================

router.get('/admin/login', (_req: Request, res: Response) => {
  res.redirect(301, '/#/portal');
});

router.get('/client/login', (_req: Request, res: Response) => {
  res.redirect(301, '/#/portal');
});

router.get('/client/index.html', (_req: Request, res: Response) => {
  res.redirect(301, '/#/portal');
});

router.get('/admin', (_req: Request, res: Response) => {
  res.redirect(301, '/dashboard');
});

router.get('/client', (_req: Request, res: Response) => {
  res.redirect(301, '/dashboard');
});

// ============================================
// Legacy Auth Page Redirects (301 Permanent)
// Preserves query params (?token=, ?email=)
// ============================================

const LEGACY_AUTH_REDIRECTS: Record<string, string> = {
  '/client/set-password.html': '/set-password',
  '/client/set-password': '/set-password',
  '/client/forgot-password.html': '/forgot-password',
  '/client/forgot-password': '/forgot-password',
  '/client/reset-password.html': '/reset-password',
  '/client/reset-password': '/reset-password',
  '/client/intake.html': '/intake',
  '/client/intake': '/intake'
};

Object.entries(LEGACY_AUTH_REDIRECTS).forEach(([oldPath, newPath]) => {
  router.get(oldPath, (req: Request, res: Response) => {
    const query = req.url.split('?')[1];
    const destination = query ? `${newPath}?${query}` : newPath;
    res.redirect(301, destination);
  });
});

export { router as portalRoutes };
