/**
 * Portal Routes
 *
 * Server-side rendering routes for admin and client portals.
 * Uses EJS templates for the shell, with client-side TypeScript for interactivity.
 *
 * Architecture:
 *   /portal       → unified login page (no auth required)
 *   /dashboard    → role-based dashboard (requires valid JWT)
 *   /admin/login  → 301 redirect to /portal
 *   /client/login → 301 redirect to /portal
 *   /admin        → 301 redirect to /dashboard
 *   /client       → 301 redirect to /dashboard
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getPortalConfig, ADMIN_TAB_IDS, CLIENT_TAB_IDS, ICONS } from '../config/navigation.js';
import { COOKIE_CONFIG } from '../utils/auth-constants.js';

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
      isDev
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
    cssBundle: '/src/styles/bundles/portal.css',
    bodyClass: 'client-portal',
    bodyPage: 'client-portal',
    isDev
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
router.get('/dashboard/tab/:tabId', async (req: Request, res: Response) => {
  const decoded = decodePortalJwt(req);

  if (!decoded) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { tabId } = req.params;

  try {
    // Dynamic import to avoid circular dependencies at startup
    const { fetchTabData, hasTabDataFetcher, getServerTableDef } = await import('../services/tab-data-service.js');

    if (!hasTabDataFetcher(tabId)) {
      return res.status(404).json({ error: `Unknown tab: ${tabId}` });
    }

    const tableDef = getServerTableDef(tabId);
    if (!tableDef) {
      return res.status(404).json({ error: `No table definition for: ${tabId}` });
    }

    // Extract user ID from JWT (admin uses 'id', client uses 'clientId')
    const userId = (decoded as Record<string, unknown>).id as number
      ?? (decoded as Record<string, unknown>).clientId as number
      ?? 0;

    const data = await fetchTabData(tabId, decoded.type as 'admin' | 'client', userId);

    if (!data) {
      return res.status(500).json({ error: 'Failed to fetch tab data' });
    }

    // Render the table partial as an HTML fragment
    res.render('partials/table/table', {
      tableDef,
      rows: data.rows,
      stats: data.stats,
      icons: ICONS
    }, (err: Error | null, html: string) => {
      if (err) {
        console.error('EJS render error:', err);
        return res.status(500).json({ error: 'Render failed' });
      }
      res.type('html').send(html);
    });
  } catch (error) {
    console.error(`Tab data error for ${tabId}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
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

export { router as portalRoutes };
