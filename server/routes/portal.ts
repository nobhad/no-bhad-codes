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
import { sendUnauthorized, sendNotFound, sendServerError, ErrorCodes } from '../utils/api-response.js';
import { logger } from '../services/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { BUSINESS_INFO } from '../config/business.js';

// Rate limiter for tab data endpoint: 30 req/min per authenticated user
const TAB_DATA_MAX_REQUESTS = 30;
const TAB_DATA_WINDOW_MS = 60 * 1000;
const TAB_DATA_BLOCK_DURATION_MS = 60 * 1000;

const tabDataRateLimiter = createRateLimiter({
  windowMs: TAB_DATA_WINDOW_MS,
  maxRequests: TAB_DATA_MAX_REQUESTS,
  blockDurationMs: TAB_DATA_BLOCK_DURATION_MS,
  keyGenerator: (req) => {
    // Key by IP + userId from JWT for per-user limiting
    const token = req.cookies?.auth_token;
    const ip = req.ip || 'unknown';
    return `tab-data:${ip}:${token ? token.slice(-16) : 'anon'}`;
  }
});

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
    bodyClass: 'client-portal',
    bodyPage: 'client-portal',
    isDev,
    businessName: BUSINESS_INFO.name
  });
});

// ============================================
// Tab Data Route (EJS hybrid tables)
// ============================================

/**
 * GET /dashboard/tab/:tabId
 * Returns an HTML fragment for a specific tab's table.
 * Used by the client-side TableManager to lazy-load tab content.
 */
router.get('/dashboard/tab/:tabId', tabDataRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const decoded = decodePortalJwt(req);

  if (!decoded) {
    return sendUnauthorized(res, 'Authentication required', ErrorCodes.UNAUTHORIZED);
  }

  const { tabId } = req.params;

  try {
    // Dynamic import to avoid circular dependencies at startup
    const { fetchTabData, hasTabDataFetcher, getServerTableDef } = await import('../services/tab-data-service.js');

    // Extract and validate user ID from JWT (admin uses 'id', client uses 'clientId')
    const decodedPayload = decoded as Record<string, unknown>;
    const userId = (decodedPayload.id as number) ?? (decodedPayload.clientId as number);

    if (!userId || typeof userId !== 'number' || userId <= 0) {
      return sendUnauthorized(res, 'Invalid token: missing user ID', ErrorCodes.INVALID_TOKEN);
    }

    // Validate tab exists, has a table definition for this portal, and user role matches.
    // All checks return the same generic "not found" to prevent tab enumeration.
    const tableDef = getServerTableDef(tabId);
    if (!hasTabDataFetcher(tabId) || !tableDef || tableDef.portal !== decoded.type) {
      return sendNotFound(res, 'Tab not found', ErrorCodes.NOT_FOUND);
    }

    const data = await fetchTabData(tabId, decoded.type as 'admin' | 'client', userId);

    if (!data) {
      return sendServerError(res, 'Failed to fetch tab data', ErrorCodes.INTERNAL_ERROR);
    }

    // Render the table partial as an HTML fragment
    res.render('partials/table/table', {
      tableDef,
      rows: data.rows,
      stats: data.stats,
      icons: ICONS
    }, (err: Error | null, html: string) => {
      if (err) {
        logger.error('EJS render error:', { error: err });
        return sendServerError(res, 'Render failed', ErrorCodes.INTERNAL_ERROR);
      }
      res.type('html').send(html);
    });
  } catch (error) {
    logger.error(`Tab data error for ${tabId}:`, {
      error: error instanceof Error ? error : new Error(String(error))
    });
    return sendServerError(res);
  }
}));

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
