/**
 * Portal Routes
 *
 * Server-side rendering routes for admin and client portals.
 * Uses EJS templates for the shell, with client-side TypeScript for interactivity.
 *
 * Note: /client/intake and /client/set-password remain as static Vite pages
 * and are not handled here.
 */

import { Router, Request, Response } from 'express';
import { getPortalConfig, ADMIN_TAB_IDS, ICONS } from '../config/navigation.js';

const router = Router();

// Check if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Admin Portal Route
 * Renders the admin dashboard shell via EJS
 */
router.get('/admin', (_req: Request, res: Response) => {
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
    isDev
  });
});

/**
 * Client Portal Route
 * Renders the client portal shell via EJS
 */
router.get('/client', (_req: Request, res: Response) => {
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
    isDev
  });
});

export { router as portalRoutes };
