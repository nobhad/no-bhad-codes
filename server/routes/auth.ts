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
import {
  PASSWORD_CONFIG,
  JWT_CONFIG,
  TIME_MS,
  RATE_LIMIT_CONFIG,
  COOKIE_CONFIG,
  validatePassword
} from '../utils/auth-constants.js';
import { getString, getNumber, getBoolean, getDate } from '../database/row-helpers.js';
import {
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
  sendServerError,
  sendNotFound,
  ErrorCodes
} from '../utils/response.js';

const router = express.Router();

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
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return sendBadRequest(res, 'Email and password are required', ErrorCodes.MISSING_CREDENTIALS);
    }

    const db = getDatabase();

    // Find user in database
    const client = await db.get(
      'SELECT id, email, password_hash, company_name, contact_name, status, is_admin FROM clients WHERE email = ?',
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

    // Check if client is active
    if (clientStatus !== 'active') {
      await auditLogger.logLoginFailed(email, req, 'Account inactive');
      return sendUnauthorized(res, 'Account is not active. Please contact support.', ErrorCodes.ACCOUNT_INACTIVE);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, passwordHash);
    if (!isValidPassword) {
      await auditLogger.logLoginFailed(email, req, 'Invalid password');
      return sendUnauthorized(res, 'Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);
    }

    if (!clientId) {
      return sendUnauthorized(res, 'Invalid user data', ErrorCodes.INVALID_CREDENTIALS);
    }

    // Generate JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not configured');
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

    // Log successful login
    await auditLogger.logLogin(
      clientId,
      clientEmail,
      clientIsAdmin ? 'admin' : 'client',
      req
    );

    // Set HttpOnly cookie with auth token
    res.cookie(COOKIE_CONFIG.AUTH_TOKEN_NAME, token, COOKIE_CONFIG.USER_OPTIONS);

    // Return user data (without password) - token is in HttpOnly cookie
    return sendSuccess(res, {
      user: {
        id: clientId,
        email: clientEmail,
        name: getString(client, 'contact_name'),
        companyName: getString(client, 'company_name'),
        contactName: getString(client, 'contact_name'),
        status: clientStatus,
        isAdmin: clientIsAdmin
      },
      expiresIn: JWT_CONFIG.USER_TOKEN_EXPIRY
    }, 'Login successful');
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
      'SELECT id, email, company_name, contact_name, phone, status, created_at FROM clients WHERE id = ?',
      [req.user!.id]
    );

    if (!client) {
      return sendNotFound(res, 'User not found', ErrorCodes.NOT_FOUND);
    }

    return sendSuccess(res, {
      user: {
        id: getNumber(client, 'id'),
        email: getString(client, 'email'),
        companyName: getString(client, 'company_name'),
        contactName: getString(client, 'contact_name'),
        phone: getString(client, 'phone'),
        status: getString(client, 'status'),
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
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email } = req.body;

    if (!email) {
      return sendBadRequest(res, 'Email is required', ErrorCodes.MISSING_FIELDS);
    }

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
        console.error('Failed to send password reset email:', error);
        // Still return success to user - don't reveal internal errors
      }
    }

    return sendSuccess(res, undefined, 'If an account with that email exists, a password reset link has been sent.');
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
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { token, password } = req.body;

    if (!token || !password) {
      return sendBadRequest(res, 'Token and password are required', ErrorCodes.MISSING_FIELDS);
    }

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
      console.error('Failed to send password reset confirmation:', emailError);
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
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { password } = req.body;

    if (!password) {
      return sendBadRequest(res, 'Password is required', ErrorCodes.MISSING_CREDENTIALS);
    }

    // Get admin password hash from environment
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    if (!adminPasswordHash) {
      console.error('ADMIN_PASSWORD_HASH not configured');
      return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
    }

    // Verify password using bcrypt
    const isValidPassword = await bcrypt.compare(password, adminPasswordHash);
    if (!isValidPassword) {
      await auditLogger.logLoginFailed(process.env.ADMIN_EMAIL || 'admin', req, 'Invalid admin password');
      return sendUnauthorized(res, 'Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);
    }

    // Generate JWT token for admin
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not configured');
      return sendServerError(res, 'Server configuration error', ErrorCodes.CONFIG_ERROR);
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.error('ADMIN_EMAIL not configured');
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

    // Also return token in response body for frontend storage
    return sendSuccess(res, {
      token,
      expiresIn: JWT_CONFIG.ADMIN_TOKEN_EXPIRY
    }, 'Admin login successful');
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
        console.error('Failed to send magic link email:', error);
        // Still return success to user - don't reveal internal errors
      }
    }

    return sendSuccess(res, undefined, 'If an account with that email exists, a login link has been sent.');
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
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { token } = req.body;

    if (!token) {
      return sendBadRequest(res, 'Token is required', ErrorCodes.MISSING_FIELDS);
    }

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

      return sendBadRequest(res, 'Login link has expired. Please request a new one.', ErrorCodes.TOKEN_EXPIRED);
    }

    // Check if account is active
    if (clientStatus !== 'active') {
      return sendUnauthorized(res, 'Account is not active. Please contact support.', ErrorCodes.ACCOUNT_INACTIVE);
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
      console.error('JWT_SECRET not configured');
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
    await auditLogger.logLogin(clientIdForMagicLink, clientEmailForMagicLink, 'client', req, { method: 'magic_link' });

    // Set HttpOnly cookie with auth token
    res.cookie(COOKIE_CONFIG.AUTH_TOKEN_NAME, jwtToken, COOKIE_CONFIG.USER_OPTIONS);

    return sendSuccess(res, {
      user: {
        id: clientIdForMagicLink,
        email: clientEmailForMagicLink,
        name: clientContactNameForMagicLink,
        companyName: clientCompanyNameForMagicLink,
        contactName: clientContactNameForMagicLink,
        status: clientStatus,
        isAdmin: clientIsAdminForMagicLink
      },
      expiresIn: JWT_CONFIG.USER_TOKEN_EXPIRY
    }, 'Login successful');
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
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { token } = req.body;

    if (!token) {
      return sendBadRequest(res, 'Token is required', ErrorCodes.MISSING_FIELDS);
    }

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
      return sendBadRequest(res, 'Invitation has expired. Please contact support for a new invitation.', ErrorCodes.TOKEN_EXPIRED);
    }

    return sendSuccess(res, {
      email: getString(client, 'email'),
      name: getString(client, 'contact_name'),
      company: getString(client, 'company_name')
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
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { token, password } = req.body;

    if (!token || !password) {
      return sendBadRequest(res, 'Token and password are required', ErrorCodes.MISSING_FIELDS);
    }

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
      return sendBadRequest(res, 'Invitation has expired. Please contact support for a new invitation.', ErrorCodes.TOKEN_EXPIRED);
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
    const clientData = await db.get(
      'SELECT contact_name, company_name FROM clients WHERE id = ?',
      [clientId]
    );
    const clientName = getString(clientData, 'contact_name') || getString(clientData, 'company_name') || 'there';

    // === ACCOUNT ACTIVATION WELCOME FLOW ===
    // 1. Send welcome email with billing CTA
    try {
      await emailService.sendAccountActivationEmail(clientEmail, {
        name: clientName
      });
      console.log(`[AUTH] Sent account activation email to ${clientEmail}`);
    } catch (emailError) {
      console.error('[AUTH] Failed to send account activation email:', emailError);
      // Continue - account was activated successfully
    }

    // 2. Create welcome system message in portal inbox
    try {
      await db.run(
        `INSERT INTO general_messages
         (client_id, sender_type, sender_name, subject, message, message_type, priority, status, is_read)
         VALUES (?, 'system', 'No Bhad Codes', ?, ?, 'system', 'normal', 'new', FALSE)`,
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
      console.log(`[AUTH] Created welcome message for client ${clientId}`);
    } catch (messageError) {
      console.error('[AUTH] Failed to create welcome message:', messageError);
      // Continue - account was activated successfully
    }

    // 3. Log the activation
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

    return sendSuccess(res, { email: clientEmail }, 'Password set successfully. You can now log in.');
  })
);

export { router as authRouter };
export default router;
