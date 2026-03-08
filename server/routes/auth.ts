/**
 * ===============================================
 * AUTHENTICATION ROUTES
 * ===============================================
 * Login, logout, and token refresh endpoints
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { getDatabase } from '../database/init.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { emailService } from '../services/email-service.js';
import { rateLimit } from '../middleware/security.js';
import { auditLogger } from '../services/audit-logger.js';
import { logger } from '../services/logger.js';
import {
  PASSWORD_CONFIG,
  JWT_CONFIG,
  TIME_MS,
  RATE_LIMIT_CONFIG,
  COOKIE_CONFIG,
  ACCOUNT_LOCKOUT_CONFIG,
  EMAIL_VERIFICATION_CONFIG,
  validatePassword
} from '../utils/auth-constants.js';
import { generateSecureToken } from '../utils/token-utils.js';
import { getBaseUrl } from '../config/environment.js';
import { getString, getNumber, getBoolean, getDate } from '../database/row-helpers.js';
import {
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
  sendServerError,
  sendNotFound,
  ErrorCodes
} from '../utils/api-response.js';
import { validateRequest } from '../middleware/validation.js';
import { errorResponseWithPayload } from '../utils/api-response.js';
import {
  TEMP_TOKEN_CONFIG,
  TWO_FACTOR_SETTINGS_KEYS
} from '../utils/two-factor-constants.js';

const router = express.Router();

// ============================================
// 2FA LOGIN HELPERS
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

// Auth-specific validation schemas
const AuthValidationSchemas = {
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
  forgotPassword: {
    email: [{ type: 'required' as const }, { type: 'email' as const }]
  },
  resetPassword: {
    token: [{ type: 'required' as const }, { type: 'string' as const, minLength: 32, maxLength: 128 }],
    password: [{ type: 'required' as const }, { type: 'string' as const, minLength: 12, maxLength: 128 }]
  },
  setPassword: {
    token: [{ type: 'required' as const }, { type: 'string' as const, minLength: 32, maxLength: 128 }],
    password: [{ type: 'required' as const }, { type: 'string' as const, minLength: 12, maxLength: 128 }]
  },
  magicLink: {
    email: [{ type: 'required' as const }, { type: 'email' as const }]
  },
  verifyToken: {
    token: [{ type: 'required' as const }, { type: 'string' as const, minLength: 32, maxLength: 256 }]
  },
  resendVerification: {
    email: [{ type: 'required' as const }, { type: 'email' as const }]
  }
};

// Note: Using validatePassword from auth-constants.ts instead of local implementation

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
  // Rate limit: login attempts per IP to prevent brute force
  rateLimit({
    windowMs: RATE_LIMIT_CONFIG.LOGIN.WINDOW_MS,
    maxRequests: RATE_LIMIT_CONFIG.LOGIN.MAX_ATTEMPTS,
    message: 'Too many login attempts. Please try again later.',
    keyGenerator: (req) => `login:${req.ip}`
  }),
  // Validate and sanitize input
  validateRequest(AuthValidationSchemas.clientLogin),
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

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get current user profile
 *     description: Retrieve authenticated user's profile information
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not found"
 *                 code:
 *                   type: string
 *                   example: "USER_NOT_FOUND"
 */
router.get(
  '/profile',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    const client = await db.get(
      'SELECT id, email, company_name, contact_name, phone, status, is_admin, created_at FROM clients WHERE id = ?',
      [req.user!.id]
    );

    if (!client) {
      return sendNotFound(res, 'User not found', ErrorCodes.NOT_FOUND);
    }

    const isAdmin = getBoolean(client, 'is_admin');
    return sendSuccess(res, {
      user: {
        id: getNumber(client, 'id'),
        email: getString(client, 'email'),
        companyName: getString(client, 'company_name'),
        contactName: getString(client, 'contact_name'),
        phone: getString(client, 'phone'),
        status: getString(client, 'status'),
        isAdmin,
        role: isAdmin ? 'admin' : 'client',
        createdAt: getDate(client, 'created_at')?.toISOString() || null
      }
    });
  })
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh JWT token
 *     description: Generate a new JWT token using the current valid token
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [token, expiresIn]
 *               properties:
 *                 token:
 *                   type: string
 *                   description: New JWT access token
 *                 expiresIn:
 *                   type: string
 *                   example: "7d"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
  '/refresh',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
    }

    // Generate new token
    const newToken = jwt.sign(
      {
        id: req.user!.id,
        email: req.user!.email,
        type: req.user!.type
      },
      secret,
      { expiresIn: JWT_CONFIG.USER_TOKEN_EXPIRY } as SignOptions
    );

    return sendSuccess(res, {
      token: newToken,
      expiresIn: JWT_CONFIG.USER_TOKEN_EXPIRY
    });
  })
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User logout
 *     description: Logout user (client-side token removal)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logout successful"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/logout', authenticateToken, (req, res) => {
  // Clear the HttpOnly auth cookie
  res.clearCookie(COOKIE_CONFIG.AUTH_TOKEN_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  return sendSuccess(res, undefined, 'Logout successful');
});

/**
 * @swagger
 * /api/auth/validate:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Validate JWT token
 *     description: Check if the provided JWT token is valid and return user info
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "client@example.com"
 *                     type:
 *                       type: string
 *                       example: "client"
 *       401:
 *         description: Invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/validate', authenticateToken, (req: AuthenticatedRequest, res) => {
  return sendSuccess(res, { valid: true, user: req.user });
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Request password reset
 *     description: Send password reset email to the user
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
 *         description: Password reset email sent (always returns success for security)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "If an account with that email exists, a password reset link has been sent."
 *       400:
 *         description: Missing email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Email is required"
 *                 code:
 *                   type: string
 *                   example: "MISSING_EMAIL"
 */
router.post(
  '/forgot-password',
  // Rate limit: 3 requests per 15 minutes per IP to prevent abuse
  rateLimit({
    windowMs: RATE_LIMIT_CONFIG.FORGOT_PASSWORD.WINDOW_MS,
    maxRequests: RATE_LIMIT_CONFIG.FORGOT_PASSWORD.MAX_ATTEMPTS,
    message: 'Too many password reset requests. Please try again later.',
    keyGenerator: (req) => `forgot-password:${req.ip}`
  }),
  // Validate and sanitize input
  validateRequest(AuthValidationSchemas.forgotPassword),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email } = req.body;

    // Validate email format before DB query
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || !emailRegex.test(email) || email.length > 254) {
      return sendBadRequest(res, 'Invalid email format', ErrorCodes.INVALID_EMAIL);
    }

    const db = getDatabase();

    // Find user by email
    const client = await db.get(
      'SELECT id, email, contact_name FROM clients WHERE email = ? AND status = "active"',
      [email.toLowerCase()]
    );

    // Always return success for security (don't reveal if email exists)
    if (client) {
      try {
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + TIME_MS.HOUR); // 1 hour from now

        // Store reset token in database
        await db.run(
          `
        UPDATE clients 
        SET reset_token = ?, reset_token_expiry = ?
        WHERE id = ?
      `,
          [resetToken, resetTokenExpiry.toISOString(), getNumber(client, 'id')]
        );

        // Send reset email
        const clientEmail = getString(client, 'email');
        const clientContactName = getString(client, 'contact_name');
        await emailService.sendPasswordResetEmail(clientEmail, {
          name: clientContactName || 'Client',
          resetToken
        });

        // Send admin notification
        await emailService.sendAdminNotification('Password Reset Request', {
          type: 'system-alert',
          message: `Password reset requested for client: ${clientEmail}`,
          details: {
            clientId: getNumber(client, 'id'),
            email: clientEmail,
            name: clientContactName || 'Unknown'
          },
          timestamp: new Date()
        });
      } catch (error) {
        await logger.error('Failed to send password reset email:', {
          error: error instanceof Error ? error : undefined,
          category: 'AUTH'
        });
        // Still return success to user - don't reveal internal errors
      }
    }

    return sendSuccess(
      res,
      undefined,
      'If an account with that email exists, a password reset link has been sent.'
    );
  })
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Reset password with token
 *     description: Reset user password using the token from email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *                 example: "abc123def456..."
 *               password:
 *                 type: string
 *                 minLength: 12
 *                 description: "Requires 12+ chars, uppercase, lowercase, number, and special character"
 *                 example: "NewSecurePassword123!"
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Password reset successfully"
 *       400:
 *         description: Invalid request or weak password
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Password must be at least 8 characters long"
 *                 code:
 *                   type: string
 *                   enum: [MISSING_FIELDS, WEAK_PASSWORD, INVALID_TOKEN, TOKEN_EXPIRED]
 */
router.post(
  '/reset-password',
  // Rate limit: 10 reset attempts per 15 minutes per IP to prevent token brute-forcing
  rateLimit({
    windowMs: RATE_LIMIT_CONFIG.FORGOT_PASSWORD.WINDOW_MS,
    maxRequests: 10,
    message: 'Too many password reset attempts. Please try again later.',
    keyGenerator: (req) => `reset-password:${req.ip}`
  }),
  // Validate and sanitize input
  validateRequest(AuthValidationSchemas.resetPassword),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { token, password } = req.body;

    // Validate password strength using centralized validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return sendBadRequest(res, passwordValidation.errors.join('. '), ErrorCodes.INVALID_PASSWORD);
    }

    const db = getDatabase();

    // Find user by reset token
    const client = await db.get(
      `
    SELECT id, email, contact_name, reset_token_expiry 
    FROM clients 
    WHERE reset_token = ? AND status = "active"
  `,
      [token]
    );

    if (!client) {
      return sendBadRequest(res, 'Invalid or expired reset token', ErrorCodes.INVALID_TOKEN);
    }

    // Check if token is expired
    const now = new Date();
    const resetTokenExpiryStr = getString(client, 'reset_token_expiry');
    const expiry = resetTokenExpiryStr ? new Date(resetTokenExpiryStr) : null;

    if (!expiry || now > expiry) {
      return sendBadRequest(res, 'Reset token has expired', ErrorCodes.TOKEN_EXPIRED);
    }

    // Hash new password using centralized salt rounds
    const password_hash = await bcrypt.hash(password, PASSWORD_CONFIG.SALT_ROUNDS);

    // Update password and clear reset token
    await db.run(
      `
    UPDATE clients 
    SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL
    WHERE id = ?
  `,
      [password_hash, getNumber(client, 'id')]
    );

    // Send confirmation email
    const clientId = getNumber(client, 'id');
    const clientContactName = getString(client, 'contact_name');
    const clientCompanyName = getString(client, 'company_name');
    try {
      await emailService.sendAdminNotification({
        subject: 'Password Reset Completed',
        intakeId: clientId.toString(),
        clientName: clientContactName || 'Unknown',
        companyName: clientCompanyName || 'Unknown Company',
        projectType: 'Password Reset',
        budget: 'N/A',
        timeline: 'Completed'
      });
    } catch (emailError) {
      logger.error('Failed to send password reset confirmation', {
        category: 'email',
        metadata: { error: emailError, clientId }
      });
      // Continue - password was reset successfully
    }

    return sendSuccess(res, undefined, 'Password reset successfully');
  })
);

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
  // Rate limit: admin login attempts per IP (stricter for admin)
  rateLimit({
    windowMs: RATE_LIMIT_CONFIG.ADMIN_LOGIN.WINDOW_MS,
    maxRequests: RATE_LIMIT_CONFIG.ADMIN_LOGIN.MAX_ATTEMPTS,
    message: 'Too many admin login attempts. Please try again later.',
    keyGenerator: (req) => `admin-login:${req.ip}`
  }),
  // Validate and sanitize input
  validateRequest(AuthValidationSchemas.adminLogin),
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
  // Rate limit: magic link requests per IP to prevent abuse
  rateLimit({
    windowMs: RATE_LIMIT_CONFIG.MAGIC_LINK.WINDOW_MS,
    maxRequests: RATE_LIMIT_CONFIG.MAGIC_LINK.MAX_ATTEMPTS,
    message: 'Too many magic link requests. Please try again later.',
    keyGenerator: (req) => `magic-link:${req.ip}`
  }),
  // Validate and sanitize input
  validateRequest(AuthValidationSchemas.magicLink),
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
  // Validate and sanitize input
  validateRequest(AuthValidationSchemas.verifyToken),
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

/**
 * @swagger
 * /api/auth/verify-invitation:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verify invitation token
 *     description: Check if an invitation token is valid
 */
router.post(
  '/verify-invitation',
  // Validate and sanitize input
  validateRequest(AuthValidationSchemas.verifyToken),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { token } = req.body;

    const db = getDatabase();
    const client = await db.get(
      `
      SELECT id, email, contact_name, company_name, invitation_expires_at
      FROM clients
      WHERE invitation_token = ?
    `,
      [token]
    );

    if (!client) {
      return sendBadRequest(res, 'Invalid invitation token', ErrorCodes.INVALID_TOKEN);
    }

    // Check if token is expired
    const invitationExpiresAtStr = getString(client, 'invitation_expires_at');
    if (invitationExpiresAtStr && new Date(invitationExpiresAtStr) < new Date()) {
      return sendBadRequest(
        res,
        'Invitation has expired. Please contact support for a new invitation.',
        ErrorCodes.TOKEN_EXPIRED
      );
    }

    const normalizeValue = (value: string): string =>
      value && value !== 'undefined' && value !== 'null' ? value : '';

    return sendSuccess(res, {
      email: normalizeValue(getString(client, 'email')),
      name: normalizeValue(getString(client, 'contact_name')),
      company: normalizeValue(getString(client, 'company_name'))
    });
  })
);

/**
 * @swagger
 * /api/auth/set-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Set password for invited client
 *     description: Set password using invitation token (magic link)
 */
router.post(
  '/set-password',
  // Rate limit: 10 set-password attempts per 15 minutes per IP to prevent token brute-forcing
  rateLimit({
    windowMs: RATE_LIMIT_CONFIG.FORGOT_PASSWORD.WINDOW_MS,
    maxRequests: 10,
    message: 'Too many password set attempts. Please try again later.',
    keyGenerator: (req) => `set-password:${req.ip}`
  }),
  // Validate and sanitize input
  validateRequest(AuthValidationSchemas.setPassword),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { token, password } = req.body;

    // Password validation using centralized validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return sendBadRequest(res, passwordValidation.errors.join('. '), ErrorCodes.INVALID_PASSWORD);
    }

    const db = getDatabase();
    const client = await db.get(
      `
      SELECT id, email, invitation_expires_at
      FROM clients
      WHERE invitation_token = ?
    `,
      [token]
    );

    if (!client) {
      return sendBadRequest(res, 'Invalid invitation token', ErrorCodes.INVALID_TOKEN);
    }

    // Check if token is expired
    const invitationExpiresAtStrForSet = getString(client, 'invitation_expires_at');
    if (invitationExpiresAtStrForSet && new Date(invitationExpiresAtStrForSet) < new Date()) {
      return sendBadRequest(
        res,
        'Invitation has expired. Please contact support for a new invitation.',
        ErrorCodes.TOKEN_EXPIRED
      );
    }

    // Hash the new password using centralized salt rounds
    const hashedPassword = await bcrypt.hash(password, PASSWORD_CONFIG.SALT_ROUNDS);

    const clientId = getNumber(client, 'id');
    const clientEmail = getString(client, 'email');

    // Update client with password and activate account
    await db.run(
      `
      UPDATE clients
      SET password_hash = ?, status = 'active', invitation_token = NULL, invitation_expires_at = NULL
      WHERE id = ?
    `,
      [hashedPassword, clientId]
    );

    // Get client name for personalization
    const clientData = await db.get('SELECT contact_name, company_name FROM clients WHERE id = ?', [
      clientId
    ]);
    const clientName =
      getString(clientData, 'contact_name') || getString(clientData, 'company_name') || 'there';

    // === ACCOUNT ACTIVATION WELCOME FLOW ===
    // 1. Send welcome email with billing CTA
    try {
      await emailService.sendAccountActivationEmail(clientEmail, {
        name: clientName
      });
      logger.info('Sent account activation email', {
        category: 'email',
        metadata: { clientEmail }
      });
    } catch (emailError) {
      logger.error('Failed to send account activation email', {
        category: 'email',
        metadata: { error: emailError, clientEmail }
      });
      // Continue - account was activated successfully
    }

    // 2. Create welcome system message in portal inbox
    // Note: Uses unified messages table with context_type after migration 085
    try {
      await db.run(
        `INSERT INTO messages
         (context_type, client_id, sender_type, sender_name, subject, message, message_type, priority, status)
         VALUES ('general', ?, 'system', 'No Bhad Codes', ?, ?, 'system', 'normal', 'new')`,
        [
          clientId,
          'Welcome to Your Client Portal!',
          `Hi ${clientName},

Welcome to your No Bhad Codes client portal! Your account is now active.

**What you can do here:**
- View your project status and milestones
- Send and receive messages with our team
- Upload and download project files
- View and pay invoices

**Important: Please add your billing information**
To ensure smooth invoicing and payments, please add your billing details in your Settings.

Click on "Settings" in the sidebar to update your billing information.

If you have any questions, feel free to send us a message through this portal.

Best regards,
No Bhad Codes Team`
        ]
      );
      await logger.info(`[Auth] Created welcome message for client ${clientId}`, {
        category: 'AUTH'
      });
    } catch (messageError) {
      await logger.error('[Auth] Failed to create welcome message:', {
        error: messageError instanceof Error ? messageError : undefined,
        category: 'AUTH'
      });
      // Continue - account was activated successfully
    }

    // 3. Send email verification
    try {
      const verificationToken = generateSecureToken();
      const verificationSentAt = new Date();
      await db.run(
        `UPDATE clients
         SET email_verification_token = ?,
             email_verification_sent_at = ?
         WHERE id = ?`,
        [verificationToken, verificationSentAt.toISOString(), clientId]
      );
      await emailService.sendEmailVerificationEmail(clientEmail, {
        verificationToken,
        name: clientName
      });
      logger.info(`[Auth] Sent email verification for client ${clientId}`, {
        category: 'AUTH'
      });
    } catch (verificationError) {
      logger.error('[Auth] Failed to send email verification on account activation', {
        error: verificationError instanceof Error ? verificationError : undefined,
        category: 'AUTH'
      });
      // Continue - account activation is more important than verification email
    }

    // 4. Log the activation
    await auditLogger.log({
      action: 'account_activated',
      entityType: 'client',
      entityId: String(clientId),
      entityName: clientEmail,
      userId: clientId,
      userEmail: clientEmail,
      userType: 'client',
      metadata: { activatedVia: 'invitation_link' },
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown'
    });

    // 5. Generate JWT token for auto-login
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      await logger.error('[Auth] JWT_SECRET not configured for auto-login after set-password', {
        category: 'AUTH'
      });
      return sendSuccess(
        res,
        { email: clientEmail },
        'Password set successfully. You can now log in.'
      );
    }

    const authToken = jwt.sign(
      {
        id: clientId,
        email: clientEmail,
        type: 'client',
        isAdmin: false
      },
      secret,
      { expiresIn: JWT_CONFIG.USER_TOKEN_EXPIRY } as SignOptions
    );

    await logger.info(`[Auth] Generated auto-login token for client ${clientId}`, {
      category: 'AUTH'
    });

    return sendSuccess(res, { email: clientEmail, token: authToken }, 'Password set successfully.');
  })
);

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
  validateRequest(AuthValidationSchemas.portalLogin),
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

// ============================================
// EMAIL VERIFICATION ROUTES
// ============================================

/**
 * @swagger
 * /api/auth/verify-email/{token}:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: GET /api/auth/verify-email/:token
 *     description: Verify a client email address using the token from the verification email.
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to portal on success
 *       400:
 *         description: Invalid or expired token
 */
router.get(
  '/verify-email/:token',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { token } = req.params;

    if (!token || token.length < 32) {
      return sendBadRequest(res, 'Invalid verification token', ErrorCodes.INVALID_TOKEN);
    }

    const db = getDatabase();

    const client = await db.get(
      `SELECT id, email, email_verified, email_verification_sent_at
       FROM clients
       WHERE email_verification_token = ? AND deleted_at IS NULL`,
      [token]
    );

    if (!client) {
      return sendBadRequest(res, 'Invalid or expired verification token', ErrorCodes.INVALID_TOKEN);
    }

    const clientId = getNumber(client, 'id');
    const clientEmail = getString(client, 'email');
    const alreadyVerified = getBoolean(client, 'email_verified');

    if (alreadyVerified) {
      // Redirect to portal with message even if already verified
      const portalUrl = getBaseUrl();
      return res.redirect(`${portalUrl}/client/portal?email_verified=already`);
    }

    // Check if token has expired
    const sentAtStr = getString(client, 'email_verification_sent_at');
    if (sentAtStr) {
      const sentAt = new Date(sentAtStr);
      const now = new Date();
      const elapsed = now.getTime() - sentAt.getTime();

      if (elapsed > EMAIL_VERIFICATION_CONFIG.TOKEN_EXPIRY_MS) {
        return sendBadRequest(
          res,
          'Verification link has expired. Please request a new one.',
          ErrorCodes.TOKEN_EXPIRED
        );
      }
    }

    // Mark email as verified and clear the token
    await db.run(
      `UPDATE clients
       SET email_verified = 1,
           email_verification_token = NULL,
           email_verification_sent_at = NULL
       WHERE id = ?`,
      [clientId]
    );

    await auditLogger.log({
      action: 'email_verified',
      entityType: 'client',
      entityId: String(clientId),
      entityName: clientEmail,
      userId: clientId,
      userEmail: clientEmail,
      userType: 'client',
      metadata: { verifiedVia: 'email_link' },
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown'
    });

    logger.info(`[Auth] Email verified for client ${clientId}`, { category: 'AUTH' });

    // Redirect to portal with success indicator
    const portalUrl = getBaseUrl();
    return res.redirect(`${portalUrl}/client/portal?email_verified=success`);
  })
);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: POST /api/auth/resend-verification
 *     description: Resend the email verification email for a client.
 *     responses:
 *       200:
 *         description: Verification email sent
 *       400:
 *         description: Invalid email or already verified
 *       429:
 *         description: Too many requests
 */
router.post(
  '/resend-verification',
  rateLimit({
    windowMs: RATE_LIMIT_CONFIG.RESEND_VERIFICATION.WINDOW_MS,
    maxRequests: RATE_LIMIT_CONFIG.RESEND_VERIFICATION.MAX_ATTEMPTS,
    message: 'Too many verification email requests. Please try again later.',
    keyGenerator: (req) => `resend-verification:${req.ip}`
  }),
  validateRequest(AuthValidationSchemas.resendVerification),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email } = req.body;

    const db = getDatabase();

    const client = await db.get(
      `SELECT id, email, contact_name, email_verified, email_verification_sent_at
       FROM clients
       WHERE email = ? AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );

    // Always return success to avoid revealing account existence
    if (!client) {
      return sendSuccess(
        res,
        undefined,
        'If an account with that email exists, a verification email has been sent.'
      );
    }

    const clientId = getNumber(client, 'id');
    const clientEmail = getString(client, 'email');
    const clientName = getString(client, 'contact_name');
    const alreadyVerified = getBoolean(client, 'email_verified');

    if (alreadyVerified) {
      return sendSuccess(res, undefined, 'Email is already verified.');
    }

    // Enforce cooldown based on last send timestamp
    const lastSentStr = getString(client, 'email_verification_sent_at');
    if (lastSentStr) {
      const lastSent = new Date(lastSentStr);
      const now = new Date();
      const elapsed = now.getTime() - lastSent.getTime();

      if (elapsed < EMAIL_VERIFICATION_CONFIG.RESEND_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil(
          (EMAIL_VERIFICATION_CONFIG.RESEND_COOLDOWN_MS - elapsed) / 1000
        );
        return sendBadRequest(
          res,
          `Please wait ${remainingSeconds} seconds before requesting another verification email.`,
          ErrorCodes.RATE_LIMIT_EXCEEDED
        );
      }
    }

    // Generate new token and update the database
    const verificationToken = generateSecureToken();
    const now = new Date();

    await db.run(
      `UPDATE clients
       SET email_verification_token = ?,
           email_verification_sent_at = ?
       WHERE id = ?`,
      [verificationToken, now.toISOString(), clientId]
    );

    // Send verification email
    try {
      await emailService.sendEmailVerificationEmail(clientEmail, {
        verificationToken,
        name: clientName || undefined
      });
    } catch (emailError) {
      logger.error('[Auth] Failed to send verification email on resend', {
        error: emailError instanceof Error ? emailError : undefined,
        category: 'AUTH'
      });
      // Still return success - token was saved, email delivery is best-effort
    }

    return sendSuccess(
      res,
      undefined,
      'If an account with that email exists, a verification email has been sent.'
    );
  })
);

// ============================================
// TWO-FACTOR AUTHENTICATION ROUTES
// ============================================

import { twoFactorRouter } from './two-factor.js';
router.use('/2fa', twoFactorRouter);

export { router as authRouter };
export default router;
