/**
 * ===============================================
 * PASSWORD ROUTES
 * ===============================================
 * Forgot password, reset password, set password, verify invitation
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
  PASSWORD_CONFIG,
  JWT_CONFIG,
  TIME_MS,
  RATE_LIMIT_CONFIG,
  validatePassword
} from '../../utils/auth-constants.js';
import { generateSecureToken } from '../../utils/token-utils.js';
import { BUSINESS_INFO } from '../../config/business.js';
import { getString, getNumber } from '../../database/row-helpers.js';
import {
  sendSuccess,
  sendBadRequest,
  ErrorCodes
} from '../../utils/api-response.js';
import { validateRequest } from '../../middleware/validation.js';

const router = express.Router();

// Password-specific validation schemas
const PasswordValidationSchemas = {
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
  verifyToken: {
    token: [{ type: 'required' as const }, { type: 'string' as const, minLength: 32, maxLength: 256 }]
  }
};

// ============================================
// FORGOT PASSWORD
// ============================================

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
  rateLimit({
    windowMs: RATE_LIMIT_CONFIG.FORGOT_PASSWORD.WINDOW_MS,
    maxRequests: RATE_LIMIT_CONFIG.FORGOT_PASSWORD.MAX_ATTEMPTS,
    message: 'Too many password reset requests. Please try again later.',
    keyGenerator: (req) => `forgot-password:${req.ip}`
  }),
  validateRequest(PasswordValidationSchemas.forgotPassword),
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

// ============================================
// RESET PASSWORD
// ============================================

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
  rateLimit({
    windowMs: RATE_LIMIT_CONFIG.FORGOT_PASSWORD.WINDOW_MS,
    maxRequests: 10,
    message: 'Too many password reset attempts. Please try again later.',
    keyGenerator: (req) => `reset-password:${req.ip}`
  }),
  validateRequest(PasswordValidationSchemas.resetPassword),
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

// ============================================
// VERIFY INVITATION
// ============================================

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
  validateRequest(PasswordValidationSchemas.verifyToken),
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

// ============================================
// SET PASSWORD (INVITATION)
// ============================================

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
  rateLimit({
    windowMs: RATE_LIMIT_CONFIG.FORGOT_PASSWORD.WINDOW_MS,
    maxRequests: 10,
    message: 'Too many password set attempts. Please try again later.',
    keyGenerator: (req) => `set-password:${req.ip}`
  }),
  validateRequest(PasswordValidationSchemas.setPassword),
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
         VALUES ('general', ?, 'system', ?, ?, ?, 'system', 'normal', 'new')`,
        [
          clientId,
          BUSINESS_INFO.name,
          'Welcome to Your Client Portal!',
          `Hi ${clientName},

Welcome to your ${BUSINESS_INFO.name} client portal! Your account is now active.

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
${BUSINESS_INFO.name} Team`
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

export { router as passwordRouter };
