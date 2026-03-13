/**
 * ===============================================
 * ACCOUNT ROUTES
 * ===============================================
 * Profile, email verification, resend verification
 */

import express from 'express';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { emailService } from '../../services/email-service.js';
import { rateLimit } from '../../middleware/security.js';
import { auditLogger } from '../../services/audit-logger.js';
import { logger } from '../../services/logger.js';
import {
  RATE_LIMIT_CONFIG,
  EMAIL_VERIFICATION_CONFIG
} from '../../utils/auth-constants.js';
import { generateSecureToken } from '../../utils/token-utils.js';
import { getBaseUrl } from '../../config/environment.js';
import { getString, getNumber, getBoolean, getDate } from '../../database/row-helpers.js';
import {
  sendSuccess,
  sendBadRequest,
  sendNotFound,
  ErrorCodes
} from '../../utils/api-response.js';
import { validateRequest } from '../../middleware/validation.js';

const router = express.Router();

// Account-specific validation schemas
const AccountValidationSchemas = {
  resendVerification: {
    email: [{ type: 'required' as const }, { type: 'email' as const }]
  }
};

// ============================================
// USER PROFILE
// ============================================

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

// ============================================
// EMAIL VERIFICATION
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

// ============================================
// RESEND VERIFICATION
// ============================================

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
  validateRequest(AccountValidationSchemas.resendVerification),
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

export { router as accountRouter };
