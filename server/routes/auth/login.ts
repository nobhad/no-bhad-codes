/**
 * ===============================================
 * LOGIN ROUTES
 * ===============================================
 * Client login, admin login, portal login, magic link
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { emailService } from '../../services/email-service.js';
import { rateLimit } from '../../middleware/security.js';
import { auditLogger } from '../../services/audit-logger.js';
import { logger } from '../../services/logger.js';
import { userService } from '../../services/user-service.js';
import {
  JWT_CONFIG,
  TIME_MS,
  RATE_LIMIT_CONFIG,
  COOKIE_CONFIG,
  ACCOUNT_LOCKOUT_CONFIG
} from '../../utils/auth-constants.js';
import {
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
  sendServerError,
  ErrorCodes
} from '../../utils/api-response.js';
import { validateRequest } from '../../middleware/validation.js';
import { errorResponseWithPayload } from '../../utils/api-response.js';
import {
  TEMP_TOKEN_CONFIG,
  TWO_FACTOR_SETTINGS_KEYS
} from '../../utils/two-factor-constants.js';

const router = express.Router();

// ============================================
// 2FA LOGIN HELPER
// ============================================

/**
 * Check if admin 2FA is enabled and handle the login response accordingly.
 * If 2FA is enabled, issues a short-lived temp token and signals the client
 * to proceed with 2FA verification instead of completing login.
 *
 * @returns true if 2FA is required (response already sent), false otherwise
 */
async function handleAdmin2FACheck(
  req: express.Request,
  res: express.Response,
  adminEmail: string
): Promise<boolean> {
  const twoFactorEnabled = await userService.isAdmin2FAEnabled(TWO_FACTOR_SETTINGS_KEYS.ENABLED);

  if (!twoFactorEnabled) {
    return false;
  }

  // 2FA is enabled: issue a temp token instead of the full JWT
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
    return true;
  }

  const tempToken = jwt.sign(
    { email: adminEmail, sub: TEMP_TOKEN_CONFIG.SUBJECT },
    jwtSecret,
    { expiresIn: TEMP_TOKEN_CONFIG.EXPIRY_STRING } as SignOptions
  );

  errorResponseWithPayload(
    res,
    'Two-factor authentication required',
    200,
    ErrorCodes.TWO_FACTOR_REQUIRED,
    { requires2FA: true, tempToken }
  );

  return true;
}

// Auth-specific validation schemas (login-related)
const LoginValidationSchemas = {
  clientLogin: {
    email: [{ type: 'required' as const }, { type: 'email' as const }],
    password: [{ type: 'required' as const }, { type: 'string' as const, minLength: 1, maxLength: 128 }]
  },
  adminLogin: {
    password: [{ type: 'required' as const }, { type: 'string' as const, minLength: 1, maxLength: 128 }]
  },
  portalLogin: {
    email: [{ type: 'required' as const }, { type: 'email' as const }],
    password: [{ type: 'required' as const }, { type: 'string' as const, minLength: 1, maxLength: 128 }]
  },
  magicLink: {
    email: [{ type: 'required' as const }, { type: 'email' as const }]
  },
  verifyToken: {
    token: [{ type: 'required' as const }, { type: 'string' as const, minLength: 32, maxLength: 256 }]
  }
};

// ============================================
// CLIENT LOGIN (legacy — prefer /api/auth/portal-login)
// ============================================

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User login (legacy)
 *     description: |
 *       Authenticate client credentials and return a JWT auth cookie.
 *       New integrations should use POST /api/auth/portal-login, which is the
 *       unified entry point for both client and admin credentials and branches
 *       server-side by email. This endpoint is kept for backward compatibility.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message, user, token, expiresIn]
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: JWT access token
 *                 expiresIn:
 *                   type: string
 *                   example: "7d"
 *       400:
 *         description: Missing credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Email and password are required"
 *                 code:
 *                   type: string
 *                   example: "MISSING_CREDENTIALS"
 *       401:
 *         description: Invalid credentials or inactive account
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid credentials"
 *                 code:
 *                   type: string
 *                   enum: [INVALID_CREDENTIALS, ACCOUNT_INACTIVE]
 *       500:
 *         description: Server configuration error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Server configuration error"
 *                 code:
 *                   type: string
 *                   example: "CONFIG_ERROR"
 */
router.post(
  '/login',
  rateLimit({
    windowMs: RATE_LIMIT_CONFIG.LOGIN.WINDOW_MS,
    maxRequests: RATE_LIMIT_CONFIG.LOGIN.MAX_ATTEMPTS,
    message: 'Too many login attempts. Please try again later.',
    keyGenerator: (req) => `login:${req.ip}`
  }),
  validateRequest(LoginValidationSchemas.clientLogin),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email, password } = req.body;

    // Find user in database (include lockout columns)
    const client = await userService.findClientByEmail(email);

    if (!client) {
      await auditLogger.logLoginFailed(email, req, 'User not found');
      return sendUnauthorized(res, 'Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);
    }

    const {
      id: clientId,
      email: clientEmail,
      status: clientStatus,
      isAdmin: clientIsAdmin,
      passwordHash,
      failedLoginAttempts,
      lockedUntil: lockedUntilStr
    } = client;

    // Check if account is locked
    if (lockedUntilStr) {
      const lockedUntil = new Date(lockedUntilStr);
      const now = new Date();
      if (now < lockedUntil) {
        const remainingMinutes = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);
        await auditLogger.logLoginFailed(email, req, 'Account locked');
        return sendUnauthorized(
          res,
          `Account is temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
          ErrorCodes.ACCOUNT_LOCKED
        );
      }
      // Lockout has expired - reset the counter so user gets fresh attempts
      await userService.resetClientLockout(clientId);
    }

    // Check if client is active
    if (clientStatus !== 'active') {
      await auditLogger.logLoginFailed(email, req, 'Account inactive');
      return sendUnauthorized(
        res,
        'Account is not active. Please contact support.',
        ErrorCodes.ACCOUNT_INACTIVE
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, passwordHash);
    if (!isValidPassword) {
      // Increment failed login attempts
      const newFailedAttempts = failedLoginAttempts + 1;

      if (newFailedAttempts >= ACCOUNT_LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS) {
        // Lock the account
        const lockUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_CONFIG.LOCKOUT_DURATION_MS);
        await userService.lockClientAccount(clientId, newFailedAttempts, lockUntil);
        await auditLogger.logLoginFailed(
          email,
          req,
          'Account locked due to too many failed attempts'
        );
        return sendUnauthorized(
          res,
          'Account has been temporarily locked due to too many failed login attempts. Please try again in 15 minutes.',
          ErrorCodes.ACCOUNT_LOCKED
        );
      }

      // Just increment the counter
      await userService.incrementClientFailedAttempts(clientId, newFailedAttempts);

      await auditLogger.logLoginFailed(email, req, 'Invalid password');
      return sendUnauthorized(res, 'Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);
    }

    if (!clientId) {
      return sendUnauthorized(res, 'Invalid user data', ErrorCodes.INVALID_CREDENTIALS);
    }

    // Generate JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      await logger.error('JWT_SECRET not configured', { category: 'AUTH' });
      return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
    }

    const token = jwt.sign(
      {
        id: clientId,
        email: clientEmail,
        type: clientIsAdmin ? 'admin' : 'client',
        isAdmin: clientIsAdmin
      },
      secret,
      { expiresIn: JWT_CONFIG.USER_TOKEN_EXPIRY } as SignOptions
    );

    // Check if this is first login (last_login was NULL)
    const isFirstLogin = client.lastLogin === null;

    // Update last_login timestamp and reset failed login attempts
    await userService.recordClientLoginSuccess(clientId);

    // Log successful login
    await auditLogger.logLogin(clientId, clientEmail, clientIsAdmin ? 'admin' : 'client', req);

    // Set HttpOnly cookie with auth token
    res.cookie(COOKIE_CONFIG.AUTH_TOKEN_NAME, token, COOKIE_CONFIG.USER_OPTIONS);

    // Return user data (without password) - token is in HttpOnly cookie
    return sendSuccess(
      res,
      {
        user: {
          id: clientId,
          email: clientEmail,
          name: client.contactName,
          companyName: client.companyName,
          contactName: client.contactName,
          status: clientStatus,
          isAdmin: clientIsAdmin,
          role: clientIsAdmin ? 'admin' : 'client'
        },
        isFirstLogin,
        expiresIn: JWT_CONFIG.USER_TOKEN_EXPIRY
      },
      'Login successful'
    );
  })
);

// ============================================
// ADMIN LOGIN (legacy — prefer /api/auth/portal-login)
// ============================================

/**
 * @swagger
 * /api/auth/admin/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Admin login (legacy)
 *     description: |
 *       Authenticate admin credentials (password-only) and return a JWT auth
 *       cookie. Also supports the 2FA TOTP handoff when admin 2FA is enabled.
 *       New integrations should use POST /api/auth/portal-login, which handles
 *       both admin and client login via a single call. This endpoint is kept
 *       for backward compatibility.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 description: Admin password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Admin login successful"
 *                 token:
 *                   type: string
 *                 expiresIn:
 *                   type: string
 *                   example: "1h"
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many attempts
 */
router.post(
  '/admin/login',
  rateLimit({
    windowMs: RATE_LIMIT_CONFIG.ADMIN_LOGIN.WINDOW_MS,
    maxRequests: RATE_LIMIT_CONFIG.ADMIN_LOGIN.MAX_ATTEMPTS,
    message: 'Too many admin login attempts. Please try again later.',
    keyGenerator: (req) => `admin-login:${req.ip}`
  }),
  validateRequest(LoginValidationSchemas.adminLogin),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { password } = req.body;

    // Check admin account lockout status from system_settings
    const lockedUntil = await userService.getAdminLockoutExpiry();
    if (lockedUntil) {
      const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
      await auditLogger.logLoginFailed(
        process.env.ADMIN_EMAIL || 'admin',
        req,
        'Admin account locked'
      );
      return sendUnauthorized(
        res,
        `Admin account is temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
        ErrorCodes.ACCOUNT_LOCKED
      );
    }

    // If there was an expired lockout, getAdminLockoutExpiry returned null; reset it
    const lockoutValue = await userService.getSystemSetting('admin.locked_until');
    if (lockoutValue) {
      await userService.resetAdminLockout();
    }

    // Get admin password hash from environment
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    if (!adminPasswordHash) {
      await logger.error('ADMIN_PASSWORD_HASH not configured', { category: 'AUTH' });
      return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
    }

    // Verify password using bcrypt
    const isValidPassword = await bcrypt.compare(password, adminPasswordHash);
    if (!isValidPassword) {
      // Get current failed attempts
      const currentAttempts = await userService.getAdminFailedAttempts();
      const newAttempts = currentAttempts + 1;

      if (newAttempts >= ACCOUNT_LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS) {
        // Lock the admin account
        const lockUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_CONFIG.LOCKOUT_DURATION_MS);
        await userService.lockAdminAccount(newAttempts, lockUntil);
        await auditLogger.logLoginFailed(
          process.env.ADMIN_EMAIL || 'admin',
          req,
          'Admin account locked due to too many failed attempts'
        );
        return sendUnauthorized(
          res,
          'Admin account has been temporarily locked due to too many failed login attempts. Please try again in 15 minutes.',
          ErrorCodes.ACCOUNT_LOCKED
        );
      }

      // Increment failed attempts
      await userService.incrementAdminFailedAttempts(newAttempts);
      await auditLogger.logLoginFailed(
        process.env.ADMIN_EMAIL || 'admin',
        req,
        'Invalid admin password'
      );
      return sendUnauthorized(res, 'Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);
    }

    // Successful login - reset failed attempts
    await userService.resetAdminLockout();

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      await logger.error('ADMIN_EMAIL not configured', { category: 'AUTH' });
      return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
    }

    // Check if 2FA is enabled -- if so, issue temp token instead of full JWT
    const requires2FA = await handleAdmin2FACheck(req, res, adminEmail);
    if (requires2FA) {
      return;
    }

    // Generate JWT token for admin
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      await logger.error('JWT_SECRET not configured', { category: 'AUTH' });
      return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
    }

    const token = jwt.sign(
      {
        id: 0, // Admin doesn't have a client ID
        email: adminEmail,
        type: 'admin'
      },
      secret,
      { expiresIn: JWT_CONFIG.ADMIN_TOKEN_EXPIRY } as SignOptions // Shorter expiry for admin sessions
    );

    // Log successful admin login
    await auditLogger.logLogin(0, adminEmail, 'admin', req);

    // Set HttpOnly cookie with admin auth token
    res.cookie(COOKIE_CONFIG.AUTH_TOKEN_NAME, token, COOKIE_CONFIG.ADMIN_OPTIONS);

    // Return user data and token for frontend
    return sendSuccess(
      res,
      {
        user: {
          id: 0,
          email: adminEmail,
          name: 'Admin',
          username: 'admin',
          isAdmin: true,
          role: 'admin'
        },
        token,
        expiresIn: JWT_CONFIG.ADMIN_TOKEN_EXPIRY
      },
      'Admin login successful'
    );
  })
);

// ============================================
// MAGIC LINK
// ============================================

/**
 * @swagger
 * /api/auth/magic-link:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Request magic link for passwordless login
 *     description: Send a magic link email to allow passwordless authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "client@example.com"
 *     responses:
 *       200:
 *         description: Magic link sent (always returns success for security)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "If an account with that email exists, a login link has been sent."
 *       400:
 *         description: Missing or invalid email
 *       429:
 *         description: Too many requests
 */
router.post(
  '/magic-link',
  rateLimit({
    windowMs: RATE_LIMIT_CONFIG.MAGIC_LINK.WINDOW_MS,
    maxRequests: RATE_LIMIT_CONFIG.MAGIC_LINK.MAX_ATTEMPTS,
    message: 'Too many magic link requests. Please try again later.',
    keyGenerator: (req) => `magic-link:${req.ip}`
  }),
  validateRequest(LoginValidationSchemas.magicLink),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email } = req.body;

    if (!email) {
      return sendBadRequest(res, 'Email is required', ErrorCodes.MISSING_FIELDS);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || !emailRegex.test(email) || email.length > 254) {
      return sendBadRequest(res, 'Invalid email format', ErrorCodes.INVALID_EMAIL);
    }

    // Find active user by email
    const client = await userService.findActiveClientByEmail(email);

    // Always return success for security (don't reveal if email exists)
    if (client) {
      try {
        // Generate magic link token (32 bytes = 64 hex characters)
        const magicLinkToken = crypto.randomBytes(32).toString('hex');
        // Token expires in 15 minutes for security
        const magicLinkExpiresAt = new Date(Date.now() + TIME_MS.FIFTEEN_MINUTES);

        // Store magic link token in database
        await userService.storeMagicLinkToken(client.id, magicLinkToken, magicLinkExpiresAt);

        // Send magic link email
        await emailService.sendMagicLinkEmail(client.email, {
          magicLinkToken,
          name: client.contactName || undefined
        });

        await auditLogger.log({
          action: 'magic_link_requested',
          entityType: 'session',
          entityId: String(client.id),
          entityName: client.email,
          userId: client.id,
          userEmail: client.email,
          userType: 'client',
          metadata: { email: client.email },
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('user-agent') || 'unknown'
        });
      } catch (error) {
        await logger.error('Failed to send magic link email:', {
          error: error instanceof Error ? error : undefined,
          category: 'AUTH'
        });
        // Still return success to user - don't reveal internal errors
      }
    }

    return sendSuccess(
      res,
      undefined,
      'If an account with that email exists, a login link has been sent.'
    );
  })
);

// ============================================
// VERIFY MAGIC LINK
// ============================================

/**
 * @swagger
 * /api/auth/verify-magic-link:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verify magic link and authenticate user
 *     description: Verify the magic link token and return JWT for authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 example: "abc123def456..."
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                 expiresIn:
 *                   type: string
 *       400:
 *         description: Invalid or expired token
 */
router.post(
  '/verify-magic-link',
  validateRequest(LoginValidationSchemas.verifyToken),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { token } = req.body;

    // Find client by magic link token
    const client = await userService.findClientByMagicToken(token);

    if (!client) {
      return sendBadRequest(res, 'Invalid or expired login link', ErrorCodes.INVALID_TOKEN);
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = client.magicLinkExpiresAt ? new Date(client.magicLinkExpiresAt) : null;

    if (!expiresAt || now > expiresAt) {
      // Clear expired token
      if (client.id) {
        await userService.clearMagicLinkToken(client.id);
      }

      return sendBadRequest(
        res,
        'Login link has expired. Please request a new one.',
        ErrorCodes.TOKEN_EXPIRED
      );
    }

    // Check if account is active
    if (client.status !== 'active') {
      return sendUnauthorized(
        res,
        'Account is not active. Please contact support.',
        ErrorCodes.ACCOUNT_INACTIVE
      );
    }

    // Clear the magic link token (single use) and record login
    if (client.id) {
      await userService.consumeMagicLinkToken(client.id);
    }

    // Generate JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      await logger.error('JWT_SECRET not configured', { category: 'AUTH' });
      return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
    }

    if (!client.id) {
      return sendBadRequest(res, 'Invalid user data', ErrorCodes.INVALID_TOKEN);
    }

    const jwtToken = jwt.sign(
      {
        id: client.id,
        email: client.email,
        type: client.isAdmin ? 'admin' : 'client',
        isAdmin: client.isAdmin
      },
      secret,
      { expiresIn: JWT_CONFIG.USER_TOKEN_EXPIRY } as SignOptions
    );

    // Log successful magic link login
    await auditLogger.logLogin(client.id, client.email, 'client', req, {
      method: 'magic_link'
    });

    // Set HttpOnly cookie with auth token
    res.cookie(COOKIE_CONFIG.AUTH_TOKEN_NAME, jwtToken, COOKIE_CONFIG.USER_OPTIONS);

    return sendSuccess(
      res,
      {
        user: {
          id: client.id,
          email: client.email,
          name: client.contactName,
          companyName: client.companyName,
          contactName: client.contactName,
          status: client.status,
          isAdmin: client.isAdmin,
          role: client.isAdmin ? 'admin' : 'client'
        },
        expiresIn: JWT_CONFIG.USER_TOKEN_EXPIRY
      },
      'Login successful'
    );
  })
);

// ============================================
// PORTAL LOGIN (UNIFIED)
// ============================================

/**
 * @swagger
 * /api/auth/portal-login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Portal login (unified, recommended)
 *     description: |
 *       Unified login entry point. The server inspects the submitted email
 *       and routes to the admin or client authentication path internally, so
 *       callers do not branch. Returns the same JWT HttpOnly auth cookie that
 *       /api/auth/login and /api/auth/admin/login set, and the same response
 *       envelope shape.
 *
 *       This is the canonical endpoint for new integrations. The role-specific
 *       endpoints are kept for backward compatibility.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Client email, or the admin email (ADMIN_EMAIL env var).
 *               password:
 *                 type: string
 *                 description: Account password.
 *     responses:
 *       200:
 *         description: Login successful. Sets `auth_token` HttpOnly cookie.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id: { type: integer }
 *                         email: { type: string, format: email }
 *                         name: { type: string }
 *                         role: { type: string, enum: [admin, client] }
 *                         isAdmin: { type: boolean }
 *                     expiresIn:
 *                       type: string
 *                       description: JWT lifetime (e.g. "1d" for clients, "1h" for admin).
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many attempts (rate-limited)
 */
router.post(
  '/portal-login',
  rateLimit({
    windowMs: RATE_LIMIT_CONFIG.LOGIN.WINDOW_MS,
    maxRequests: RATE_LIMIT_CONFIG.LOGIN.MAX_ATTEMPTS,
    message: 'Too many login attempts. Please try again later.',
    keyGenerator: (req) => `portal-login:${req.ip}`
  }),
  validateRequest(LoginValidationSchemas.portalLogin),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email, password } = req.body as { email: string; password: string };
    const normalizedEmail = email.toLowerCase().trim();

    const adminEmail = process.env.ADMIN_EMAIL;
    const isAdminAttempt = adminEmail && normalizedEmail === adminEmail.toLowerCase();

    // ── Admin path ────────────────────────────────────────────────────────────
    if (isAdminAttempt) {
      // Check admin lockout
      const lockedUntil = await userService.getAdminLockoutExpiry();
      if (lockedUntil) {
        const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
        await auditLogger.logLoginFailed(normalizedEmail, req, 'Admin account locked');
        return sendUnauthorized(
          res,
          `Admin account is temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
          ErrorCodes.ACCOUNT_LOCKED
        );
      }

      // If there was an expired lockout, reset it
      const lockoutValue = await userService.getSystemSetting('admin.locked_until');
      if (lockoutValue) {
        await userService.resetAdminLockout();
      }

      const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
      if (!adminPasswordHash) {
        await logger.error('ADMIN_PASSWORD_HASH not configured', { category: 'AUTH' });
        return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
      }

      const isValidPassword = await bcrypt.compare(password, adminPasswordHash);
      if (!isValidPassword) {
        const currentAttempts = await userService.getAdminFailedAttempts();
        const newAttempts = currentAttempts + 1;

        if (newAttempts >= ACCOUNT_LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS) {
          const lockUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_CONFIG.LOCKOUT_DURATION_MS);
          await userService.lockAdminAccount(newAttempts, lockUntil);
          await auditLogger.logLoginFailed(normalizedEmail, req, 'Admin account locked');
          return sendUnauthorized(
            res,
            'Admin account has been temporarily locked due to too many failed login attempts. Please try again in 15 minutes.',
            ErrorCodes.ACCOUNT_LOCKED
          );
        }

        await userService.incrementAdminFailedAttempts(newAttempts);
        await auditLogger.logLoginFailed(normalizedEmail, req, 'Invalid admin password');
        return sendUnauthorized(res, 'Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);
      }

      // Success — reset lockout
      await userService.resetAdminLockout();

      // Check if 2FA is enabled -- if so, issue temp token instead of full JWT
      const requires2FA = await handleAdmin2FACheck(req, res, adminEmail);
      if (requires2FA) {
        return;
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
      }

      const token = jwt.sign(
        { id: 0, email: adminEmail, type: 'admin' },
        secret,
        { expiresIn: JWT_CONFIG.ADMIN_TOKEN_EXPIRY } as SignOptions
      );

      await auditLogger.logLogin(0, adminEmail, 'admin', req);
      res.cookie(COOKIE_CONFIG.AUTH_TOKEN_NAME, token, COOKIE_CONFIG.ADMIN_OPTIONS);

      return sendSuccess(
        res,
        {
          user: {
            id: 0,
            email: adminEmail,
            name: 'Admin',
            isAdmin: true,
            role: 'admin'
          },
          isFirstLogin: false,
          expiresIn: JWT_CONFIG.ADMIN_TOKEN_EXPIRY
        },
        'Login successful'
      );
    }

    // ── Client path ───────────────────────────────────────────────────────────
    const client = await userService.findClientByEmail(normalizedEmail);

    if (!client) {
      await auditLogger.logLoginFailed(normalizedEmail, req, 'User not found');
      return sendUnauthorized(res, 'Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);
    }

    const {
      id: clientId,
      email: clientEmail,
      status: clientStatus,
      isAdmin: clientIsAdmin,
      passwordHash,
      failedLoginAttempts,
      lockedUntil: lockedUntilStr
    } = client;

    if (lockedUntilStr) {
      const clientLockedUntil = new Date(lockedUntilStr);
      if (new Date() < clientLockedUntil) {
        const remainingMinutes = Math.ceil((clientLockedUntil.getTime() - Date.now()) / 60000);
        await auditLogger.logLoginFailed(normalizedEmail, req, 'Account locked');
        return sendUnauthorized(
          res,
          `Account is temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
          ErrorCodes.ACCOUNT_LOCKED
        );
      }
      await userService.resetClientLockout(clientId);
    }

    if (clientStatus !== 'active') {
      await auditLogger.logLoginFailed(normalizedEmail, req, 'Account inactive');
      return sendUnauthorized(
        res,
        'Account is not active. Please contact support.',
        ErrorCodes.ACCOUNT_INACTIVE
      );
    }

    const isValidPassword = await bcrypt.compare(password, passwordHash);
    if (!isValidPassword) {
      const newFailedAttempts = failedLoginAttempts + 1;

      if (newFailedAttempts >= ACCOUNT_LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_CONFIG.LOCKOUT_DURATION_MS);
        await userService.lockClientAccount(clientId, newFailedAttempts, lockUntil);
        await auditLogger.logLoginFailed(normalizedEmail, req, 'Account locked');
        return sendUnauthorized(
          res,
          'Account has been temporarily locked due to too many failed login attempts. Please try again in 15 minutes.',
          ErrorCodes.ACCOUNT_LOCKED
        );
      }

      await userService.incrementClientFailedAttempts(clientId, newFailedAttempts);
      await auditLogger.logLoginFailed(normalizedEmail, req, 'Invalid password');
      return sendUnauthorized(res, 'Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);
    }

    if (!clientId) {
      return sendUnauthorized(res, 'Invalid user data', ErrorCodes.INVALID_CREDENTIALS);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
    }

    const token = jwt.sign(
      {
        id: clientId,
        email: clientEmail,
        type: clientIsAdmin ? 'admin' : 'client',
        isAdmin: clientIsAdmin
      },
      secret,
      { expiresIn: JWT_CONFIG.USER_TOKEN_EXPIRY } as SignOptions
    );

    const isFirstLogin = client.lastLogin === null;

    await userService.recordClientLoginSuccess(clientId);
    await auditLogger.logLogin(clientId, clientEmail, clientIsAdmin ? 'admin' : 'client', req);

    res.cookie(COOKIE_CONFIG.AUTH_TOKEN_NAME, token, COOKIE_CONFIG.USER_OPTIONS);

    return sendSuccess(
      res,
      {
        user: {
          id: clientId,
          email: clientEmail,
          name: client.contactName,
          companyName: client.companyName,
          contactName: client.contactName,
          status: clientStatus,
          isAdmin: clientIsAdmin,
          role: clientIsAdmin ? 'admin' : 'client'
        },
        isFirstLogin,
        expiresIn: JWT_CONFIG.USER_TOKEN_EXPIRY
      },
      'Login successful'
    );
  })
);

export { router as loginRouter };
