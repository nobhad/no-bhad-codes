/**
 * Portal Routes
 *
 * Server-side rendering routes for admin and client portals.
 * Uses EJS templates for the shell, with client-side TypeScript for interactivity.
 *
 * Note: /client/intake and /client/set-password remain as static Vite pages
 * and are not handled here.
 */

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getPortalConfig, ADMIN_TAB_IDS, ICONS } from '../config/navigation.js';
import { COOKIE_CONFIG } from '../utils/auth-constants.js';

const router = Router();

/**
 * Portal authentication middleware
 * Redirects to login page if not authenticated
 */
const requirePortalAuth = (portalType: 'admin' | 'client') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1];
    const cookieToken = req.cookies?.[COOKIE_CONFIG.AUTH_TOKEN_NAME];
    const token = headerToken || cookieToken;

    if (!token) {
      const loginPath = portalType === 'admin' ? '/admin/login' : '/client/index.html';
      return res.redirect(loginPath);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).send('Server configuration error');
    }

    try {
      const decoded = jwt.verify(token, secret) as { type: string };

      // Verify user type matches portal type
      if (decoded.type !== portalType) {
        const loginPath = portalType === 'admin' ? '/admin/login' : '/client/index.html';
        return res.redirect(loginPath);
      }

      next();
    } catch {
      const loginPath = portalType === 'admin' ? '/admin/login' : '/client/index.html';
      return res.redirect(loginPath);
    }
  };
};

// Check if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Admin Portal Route
 * Renders the admin dashboard shell via EJS
 * Requires authenticated admin user
 */
router.get('/admin', requirePortalAuth('admin'), (_req: Request, res: Response) => {
  const config = getPortalConfig('admin');

  res.render('layouts/portal', {
    portalType: 'admin',
    config,
    icons: ICONS,
    tabIds: ADMIN_TAB_IDS,
    entryScript: '/src/admin.ts',
    cssBundle: '/src/styles/bundles/admin.css',
    bodyClass: 'admin',
    bodyPage: 'admin',
    isDev,
  });
});

/**
 * Client Portal Route
 * Renders the client portal shell via EJS
 * Requires authenticated client user
 */
router.get('/client', requirePortalAuth('client'), (_req: Request, res: Response) => {
  const config = getPortalConfig('client');

  res.render('layouts/portal', {
    portalType: 'client',
    config,
    icons: ICONS,
    tabIds: [], // Client portal uses dynamic view rendering
    entryScript: '/src/portal.ts',
    cssBundle: '/src/styles/bundles/portal.css',
    bodyClass: 'client-portal',
    bodyPage: 'client-portal',
    isDev,
  });
});

export { router as portalRoutes };
