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
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { emailService } from '../../services/email-service.js';
import { rateLimit } from '../../middleware/security.js';
import { auditLogger } from '../../services/audit-logger.js';
import { logger } from '../../services/logger.js';
import {
  JWT_CONFIG,
  TIME_MS,
  RATE_LIMIT_CONFIG,
  COOKIE_CONFIG,
  ACCOUNT_LOCKOUT_CONFIG
} from '../../utils/auth-constants.js';
import { getString, getNumber, getBoolean } from '../../database/row-helpers.js';
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
  const db = getDatabase();
  const enabledRow = await db.get(
    'SELECT setting_value FROM system_settings WHERE setting_key = ?',
    [TWO_FACTOR_SETTINGS_KEYS.ENABLED]
  );

  const twoFactorEnabled = enabledRow
    && (enabledRow as { setting_value: string }).setting_value === 'true';

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
// CLIENT LOGIN
// ============================================

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User login
 *     description: Authenticate client credentials and return JWT token
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

    const db = getDatabase();

    // Find user in database (include lockout columns)
    const client = await db.get(
      'SELECT id, email, password_hash, company_name, contact_name, status, is_admin, last_login, failed_login_attempts, locked_until FROM clients WHERE email = ? AND deleted_at IS NULL',
      [email.toLowerCase()]
    );

    if (!client) {
      await auditLogger.logLoginFailed(email, req, 'User not found');
      return sendUnauthorized(res, 'Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);
    }

    // Extract typed values using helpers
    const clientId = getNumber(client, 'id');
    const clientEmail = getString(client, 'email');
    const clientStatus = getString(client, 'status');
    const clientIsAdmin = getBoolean(client, 'is_admin');
    const passwordHash = getString(client, 'password_hash');
    const failedLoginAttempts = getNumber(client, 'failed_login_attempts') || 0;
    const lockedUntilStr = getString(client, 'locked_until');

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
      await db.run(
        'UPDATE clients SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
        [clientId]
      );
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
        await db.run(
          'UPDATE clients SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
          [newFailedAttempts, lockUntil.toISOString(), clientId]
        );
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
      await db.run('UPDATE clients SET failed_login_attempts = ? WHERE id = ?', [
        newFailedAttempts,
        clientId
      ]);

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
    const previousLastLogin = client.last_login;
    const isFirstLogin = previousLastLogin === null;

    // Update last_login timestamp and reset failed login attempts
    await db.run(
      'UPDATE clients SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [clientId]
    );

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
          name: getString(client, 'contact_name'),
          companyName: getString(client, 'company_name'),
          contactName: getString(client, 'contact_name'),
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
// ADMIN LOGIN
// ============================================

/**
 * @swagger
 * /api/auth/admin/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Admin login
 *     description: Authenticate admin credentials and return JWT token
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
    const db = getDatabase();

    // Check admin account lockout status from system_settings
    const lockoutSetting = await db.get(
      'SELECT setting_value FROM system_settings WHERE setting_key = \'admin.locked_until\''
    );
    if (lockoutSetting) {
      const lockedUntil = new Date(lockoutSetting.setting_value as string);
      const now = new Date();
      if (now < lockedUntil) {
        const remainingMinutes = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);
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
      // Lockout expired - reset
      await db.run(
        'DELETE FROM system_settings WHERE setting_key IN (\'admin.locked_until\', \'admin.failed_login_attempts\')'
      );
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
      const attemptsSetting = await db.get(
        'SELECT setting_value FROM system_settings WHERE setting_key = \'admin.failed_login_attempts\''
      );
      const currentAttempts = attemptsSetting
        ? parseInt(attemptsSetting.setting_value as string, 10)
        : 0;
      const newAttempts = currentAttempts + 1;

      if (newAttempts >= ACCOUNT_LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS) {
        // Lock the admin account
        const lockUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_CONFIG.LOCKOUT_DURATION_MS);
        await db.run(
          'INSERT OR REPLACE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES (\'admin.locked_until\', ?, \'string\', \'Admin account lockout expiry\')',
          [lockUntil.toISOString()]
        );
        await db.run(
          'INSERT OR REPLACE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES (\'admin.failed_login_attempts\', ?, \'number\', \'Admin failed login attempts\')',
          [newAttempts.toString()]
        );
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
      await db.run(
        'INSERT OR REPLACE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES (\'admin.failed_login_attempts\', ?, \'number\', \'Admin failed login attempts\')',
        [newAttempts.toString()]
      );
      await auditLogger.logLoginFailed(
        process.env.ADMIN_EMAIL || 'admin',
        req,
        'Invalid admin password'
      );
      return sendUnauthorized(res, 'Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);
    }

    // Successful login - reset failed attempts
    await db.run(
      'DELETE FROM system_settings WHERE setting_key IN (\'admin.locked_until\', \'admin.failed_login_attempts\')'
    );

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

    const db = getDatabase();

    // Find active user by email
    const client = await db.get(
      'SELECT id, email, contact_name FROM clients WHERE email = ? AND status = "active"',
      [email.toLowerCase()]
    );

    // Always return success for security (don't reveal if email exists)
    if (client) {
      try {
        // Generate magic link token (32 bytes = 64 hex characters)
        const magicLinkToken = crypto.randomBytes(32).toString('hex');
        // Token expires in 15 minutes for security
        const magicLinkExpiresAt = new Date(Date.now() + TIME_MS.FIFTEEN_MINUTES);

        // Store magic link token in database
        await db.run(
          `UPDATE clients
           SET magic_link_token = ?, magic_link_expires_at = ?
           WHERE id = ?`,
          [magicLinkToken, magicLinkExpiresAt.toISOString(), getNumber(client, 'id')]
        );

        // Send magic link email
        const clientEmailForMagic = getString(client, 'email');
        const clientContactNameForMagic = getString(client, 'contact_name');
        const clientIdForMagic = getNumber(client, 'id');
        await emailService.sendMagicLinkEmail(clientEmailForMagic, {
          magicLinkToken,
          name: clientContactNameForMagic || undefined
        });

        await auditLogger.log({
          action: 'magic_link_requested',
          entityType: 'session',
          entityId: String(clientIdForMagic),
          entityName: clientEmailForMagic,
          userId: clientIdForMagic,
          userEmail: clientEmailForMagic,
          userType: 'client',
          metadata: { email: clientEmailForMagic },
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

    const db = getDatabase();

    // Find client by magic link token
    const client = await db.get(
      `SELECT id, email, contact_name, company_name, status, is_admin, magic_link_expires_at
       FROM clients
       WHERE magic_link_token = ?`,
      [token]
    );

    if (!client) {
      return sendBadRequest(res, 'Invalid or expired login link', ErrorCodes.INVALID_TOKEN);
    }

    // Check if token is expired
    const now = new Date();
    const magicLinkExpiresAtStr = getString(client, 'magic_link_expires_at');
    const expiresAt = magicLinkExpiresAtStr ? new Date(magicLinkExpiresAtStr) : null;
    const clientId = getNumber(client, 'id');
    const clientStatus = getString(client, 'status');

    if (!expiresAt || now > expiresAt) {
      // Clear expired token
      if (clientId) {
        await db.run(
          'UPDATE clients SET magic_link_token = NULL, magic_link_expires_at = NULL WHERE id = ?',
          [clientId]
        );
      }

      return sendBadRequest(
        res,
        'Login link has expired. Please request a new one.',
        ErrorCodes.TOKEN_EXPIRED
      );
    }

    // Check if account is active
    if (clientStatus !== 'active') {
      return sendUnauthorized(
        res,
        'Account is not active. Please contact support.',
        ErrorCodes.ACCOUNT_INACTIVE
      );
    }

    // Clear the magic link token (single use)
    const clientIdForMagicLink = getNumber(client, 'id');
    const clientEmailForMagicLink = getString(client, 'email');
    const clientContactNameForMagicLink = getString(client, 'contact_name');
    const clientCompanyNameForMagicLink = getString(client, 'company_name');
    const clientIsAdminForMagicLink = getBoolean(client, 'is_admin');

    if (clientIdForMagicLink) {
      await db.run(
        'UPDATE clients SET magic_link_token = NULL, magic_link_expires_at = NULL, last_login_at = ? WHERE id = ?',
        [new Date().toISOString(), clientIdForMagicLink]
      );
    }

    // Generate JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      await logger.error('JWT_SECRET not configured', { category: 'AUTH' });
      return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
    }

    if (!clientIdForMagicLink) {
      return sendBadRequest(res, 'Invalid user data', ErrorCodes.INVALID_TOKEN);
    }

    const jwtToken = jwt.sign(
      {
        id: clientIdForMagicLink,
        email: clientEmailForMagicLink,
        type: clientIsAdminForMagicLink ? 'admin' : 'client',
        isAdmin: clientIsAdminForMagicLink
      },
      secret,
      { expiresIn: JWT_CONFIG.USER_TOKEN_EXPIRY } as SignOptions
    );

    // Log successful magic link login
    await auditLogger.logLogin(clientIdForMagicLink, clientEmailForMagicLink, 'client', req, {
      method: 'magic_link'
    });

    // Set HttpOnly cookie with auth token
    res.cookie(COOKIE_CONFIG.AUTH_TOKEN_NAME, jwtToken, COOKIE_CONFIG.USER_OPTIONS);

    return sendSuccess(
      res,
      {
        user: {
          id: clientIdForMagicLink,
          email: clientEmailForMagicLink,
          name: clientContactNameForMagicLink,
          companyName: clientCompanyNameForMagicLink,
          contactName: clientContactNameForMagicLink,
          status: clientStatus,
          isAdmin: clientIsAdminForMagicLink,
          role: clientIsAdminForMagicLink ? 'admin' : 'client'
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
 *     summary: POST /api/auth/portal-login
 *     description: Unified login endpoint for the portal login page.
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many attempts
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
      const db = getDatabase();

      // Check admin lockout
      const lockoutSetting = await db.get(
        'SELECT setting_value FROM system_settings WHERE setting_key = \'admin.locked_until\''
      );
      if (lockoutSetting) {
        const lockedUntil = new Date(lockoutSetting.setting_value as string);
        if (new Date() < lockedUntil) {
          const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
          await auditLogger.logLoginFailed(normalizedEmail, req, 'Admin account locked');
          return sendUnauthorized(
            res,
            `Admin account is temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
            ErrorCodes.ACCOUNT_LOCKED
          );
        }
        await db.run(
          'DELETE FROM system_settings WHERE setting_key IN (\'admin.locked_until\', \'admin.failed_login_attempts\')'
        );
      }

      const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
      if (!adminPasswordHash) {
        await logger.error('ADMIN_PASSWORD_HASH not configured', { category: 'AUTH' });
        return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
      }

      const isValidPassword = await bcrypt.compare(password, adminPasswordHash);
      if (!isValidPassword) {
        const attemptsSetting = await db.get(
          'SELECT setting_value FROM system_settings WHERE setting_key = \'admin.failed_login_attempts\''
        );
        const currentAttempts = attemptsSetting
          ? parseInt(attemptsSetting.setting_value as string, 10)
          : 0;
        const newAttempts = currentAttempts + 1;

        if (newAttempts >= ACCOUNT_LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS) {
          const lockUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_CONFIG.LOCKOUT_DURATION_MS);
          await db.run(
            'INSERT OR REPLACE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES (\'admin.locked_until\', ?, \'string\', \'Admin account lockout expiry\')',
            [lockUntil.toISOString()]
          );
          await db.run(
            'INSERT OR REPLACE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES (\'admin.failed_login_attempts\', ?, \'number\', \'Admin failed login attempts\')',
            [newAttempts.toString()]
          );
          await auditLogger.logLoginFailed(normalizedEmail, req, 'Admin account locked');
          return sendUnauthorized(
            res,
            'Admin account has been temporarily locked due to too many failed login attempts. Please try again in 15 minutes.',
            ErrorCodes.ACCOUNT_LOCKED
          );
        }

        await db.run(
          'INSERT OR REPLACE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES (\'admin.failed_login_attempts\', ?, \'number\', \'Admin failed login attempts\')',
          [newAttempts.toString()]
        );
        await auditLogger.logLoginFailed(normalizedEmail, req, 'Invalid admin password');
        return sendUnauthorized(res, 'Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);
      }

      // Success — reset lockout
      await db.run(
        'DELETE FROM system_settings WHERE setting_key IN (\'admin.locked_until\', \'admin.failed_login_attempts\')'
      );

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
    const db = getDatabase();
    const client = await db.get(
      'SELECT id, email, password_hash, company_name, contact_name, status, is_admin, last_login, failed_login_attempts, locked_until FROM clients WHERE email = ? AND deleted_at IS NULL',
      [normalizedEmail]
    );

    if (!client) {
      await auditLogger.logLoginFailed(normalizedEmail, req, 'User not found');
      return sendUnauthorized(res, 'Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);
    }

    const clientId = getNumber(client, 'id');
    const clientEmail = getString(client, 'email');
    const clientStatus = getString(client, 'status');
    const clientIsAdmin = getBoolean(client, 'is_admin');
    const passwordHash = getString(client, 'password_hash');
    const failedLoginAttempts = getNumber(client, 'failed_login_attempts') || 0;
    const lockedUntilStr = getString(client, 'locked_until');

    if (lockedUntilStr) {
      const lockedUntil = new Date(lockedUntilStr);
      if (new Date() < lockedUntil) {
        const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
        await auditLogger.logLoginFailed(normalizedEmail, req, 'Account locked');
        return sendUnauthorized(
          res,
          `Account is temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
          ErrorCodes.ACCOUNT_LOCKED
        );
      }
      await db.run(
        'UPDATE clients SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
        [clientId]
      );
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
        await db.run(
          'UPDATE clients SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
          [newFailedAttempts, lockUntil.toISOString(), clientId]
        );
        await auditLogger.logLoginFailed(normalizedEmail, req, 'Account locked');
        return sendUnauthorized(
          res,
          'Account has been temporarily locked due to too many failed login attempts. Please try again in 15 minutes.',
          ErrorCodes.ACCOUNT_LOCKED
        );
      }

      await db.run('UPDATE clients SET failed_login_attempts = ? WHERE id = ?', [
        newFailedAttempts,
        clientId
      ]);
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

    const isFirstLogin = client.last_login === null;

    await db.run(
      'UPDATE clients SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [clientId]
    );
    await auditLogger.logLogin(clientId, clientEmail, clientIsAdmin ? 'admin' : 'client', req);

    res.cookie(COOKIE_CONFIG.AUTH_TOKEN_NAME, token, COOKIE_CONFIG.USER_OPTIONS);

    return sendSuccess(
      res,
      {
        user: {
          id: clientId,
          email: clientEmail,
          name: getString(client, 'contact_name'),
          companyName: getString(client, 'company_name'),
          contactName: getString(client, 'contact_name'),
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
