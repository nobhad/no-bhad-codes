/**
 * ===============================================
 * AUTHENTICATION ROUTES — BARREL
 * ===============================================
 * Composes sub-routers for login, password, session, account, and 2FA.
 *
 * Sub-modules:
 *   auth/login.ts    — /login, /admin/login, /portal-login, /magic-link, /verify-magic-link
 *   auth/password.ts — /forgot-password, /reset-password, /set-password, /verify-invitation
 *   auth/session.ts  — /refresh, /logout, /validate
 *   auth/account.ts  — /profile, /verify-email/:token, /resend-verification
 *   two-factor.ts    — /2fa/*
 */

import express from 'express';
import { loginRouter } from './auth/login.js';
import { passwordRouter } from './auth/password.js';
import { sessionRouter } from './auth/session.js';
import { accountRouter } from './auth/account.js';
import { twoFactorRouter } from './two-factor.js';

const router = express.Router();

router.use(loginRouter);
router.use(passwordRouter);
router.use(sessionRouter);
router.use(accountRouter);
router.use('/2fa', twoFactorRouter);

export { router as authRouter };
export default router;
