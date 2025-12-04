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

const router = express.Router();

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
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS',
      });
    }

    const db = getDatabase();

    // Find user in database
    const client = await db.get(
      'SELECT id, email, password_hash, company_name, contact_name, status, is_admin FROM clients WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!client) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Check if client is active
    if (client.status !== 'active') {
      return res.status(401).json({
        error: 'Account is not active. Please contact support.',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, client.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Generate JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({
        error: 'Server configuration error',
        code: 'CONFIG_ERROR',
      });
    }

    const token = jwt.sign(
      {
        id: client.id,
        email: client.email,
        type: client.is_admin ? 'admin' : 'client',
        isAdmin: Boolean(client.is_admin),
      },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
    );

    // Return user data (without password) and token
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: client.id,
        email: client.email,
        name: client.contact_name,
        companyName: client.company_name,
        contactName: client.contact_name,
        status: client.status,
        isAdmin: Boolean(client.is_admin),
      },
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
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
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    res.json({
      user: {
        id: client.id,
        email: client.email,
        companyName: client.company_name,
        contactName: client.contact_name,
        phone: client.phone,
        status: client.status,
        createdAt: client.created_at,
      },
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
      return res.status(500).json({
        error: 'Server configuration error',
        code: 'CONFIG_ERROR',
      });
    }

    // Generate new token
    const newToken = jwt.sign(
      {
        id: req.user!.id,
        email: req.user!.email,
        type: req.user!.type,
      },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
    );

    res.json({
      token: newToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
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
  // In a more sophisticated setup, you might want to blacklist the token
  // For now, we'll just return success and let the client remove the token
  res.json({
    message: 'Logout successful',
  });
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
  res.json({
    valid: true,
    user: req.user,
  });
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
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        code: 'MISSING_EMAIL',
      });
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
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        // Store reset token in database
        await db.run(
          `
        UPDATE clients 
        SET reset_token = ?, reset_token_expiry = ?
        WHERE id = ?
      `,
          [resetToken, resetTokenExpiry.toISOString(), client.id]
        );

        // Send reset email
        await emailService.sendPasswordResetEmail(client.email, {
          name: client.contact_name || 'Client',
          resetToken,
        });

        // Send admin notification
        await emailService.sendAdminNotification('Password Reset Request', {
          type: 'system-alert',
          message: `Password reset requested for client: ${client.email}`,
          details: {
            clientId: client.id,
            email: client.email,
            name: client.contact_name || 'Unknown',
          },
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Failed to send password reset email:', error);
        // Still return success to user - don't reveal internal errors
      }
    }

    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
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
 *                 minLength: 8
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
      return res.status(400).json({
        error: 'Token and password are required',
        code: 'MISSING_FIELDS',
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long',
        code: 'WEAK_PASSWORD',
      });
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
      return res.status(400).json({
        error: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN',
      });
    }

    // Check if token is expired
    const now = new Date();
    const expiry = new Date(client.reset_token_expiry);

    if (now > expiry) {
      return res.status(400).json({
        error: 'Reset token has expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    // Hash new password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Update password and clear reset token
    await db.run(
      `
    UPDATE clients 
    SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL
    WHERE id = ?
  `,
      [password_hash, client.id]
    );

    // Send confirmation email
    try {
      await emailService.sendAdminNotification({
        subject: 'Password Reset Completed',
        intakeId: client.id.toString(),
        clientName: client.contact_name || 'Unknown',
        companyName: client.company_name || 'Unknown Company',
        projectType: 'Password Reset',
        budget: 'N/A',
        timeline: 'Completed',
      });
    } catch (emailError) {
      console.error('Failed to send password reset confirmation:', emailError);
      // Continue - password was reset successfully
    }

    res.json({
      message: 'Password reset successfully',
    });
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
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'Password is required',
        code: 'MISSING_PASSWORD',
      });
    }

    // Get admin password hash from environment
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    if (!adminPasswordHash) {
      console.error('ADMIN_PASSWORD_HASH not configured');
      return res.status(500).json({
        error: 'Server configuration error',
        code: 'CONFIG_ERROR',
      });
    }

    // Verify password using bcrypt
    const isValidPassword = await bcrypt.compare(password, adminPasswordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Generate JWT token for admin
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({
        error: 'Server configuration error',
        code: 'CONFIG_ERROR',
      });
    }

    const token = jwt.sign(
      {
        id: 0, // Admin doesn't have a client ID
        email: process.env.ADMIN_EMAIL || 'nobhaduri@gmail.com',
        type: 'admin',
      },
      secret,
      { expiresIn: '1h' } as SignOptions // Shorter expiry for admin sessions
    );

    res.json({
      message: 'Admin login successful',
      token,
      expiresIn: '1h',
    });
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
      return res.status(400).json({
        success: false,
        error: 'Token is required',
      });
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
      return res.status(400).json({
        success: false,
        error: 'Invalid invitation token',
      });
    }

    // Check if token is expired
    if (client.invitation_expires_at && new Date(client.invitation_expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Invitation has expired. Please contact support for a new invitation.',
      });
    }

    res.json({
      success: true,
      email: client.email,
      name: client.contact_name,
      company: client.company_name,
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
      return res.status(400).json({
        success: false,
        error: 'Token and password are required',
      });
    }

    // Password validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long',
      });
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
      return res.status(400).json({
        success: false,
        error: 'Invalid invitation token',
      });
    }

    // Check if token is expired
    if (client.invitation_expires_at && new Date(client.invitation_expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Invitation has expired. Please contact support for a new invitation.',
      });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update client with password and activate account
    await db.run(
      `
      UPDATE clients
      SET password_hash = ?, status = 'active', invitation_token = NULL, invitation_expires_at = NULL
      WHERE id = ?
    `,
      [hashedPassword, client.id]
    );

    res.json({
      success: true,
      message: 'Password set successfully. You can now log in.',
      email: client.email,
    });
  })
);

export { router as authRouter };
export default router;
