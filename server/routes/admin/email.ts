/**
 * ===============================================
 * ADMIN EMAIL ROUTES
 * ===============================================
 * @file server/routes/admin/email.ts
 *
 * Admin email testing endpoint.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { emailService } from '../../services/email-service.js';
import { errorResponse, sendSuccess } from '../../utils/api-response.js';

const router = express.Router();

/**
 * POST /api/admin/test-email - Send a test email to admin
 */
router.post(
  '/test-email',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const adminEmail = process.env.ADMIN_EMAIL || req.user?.email;
    if (!adminEmail) {
      return errorResponse(
        res,
        'Admin email not configured. Set ADMIN_EMAIL in environment.',
        400,
        'ADMIN_EMAIL_NOT_CONFIGURED'
      );
    }

    const result = await emailService.sendEmail({
      to: adminEmail,
      subject: 'No Bhad Codes - Test Email',
      text: 'This is a test email from the admin dashboard. Email service is working correctly.',
      html: '<p>This is a test email from the admin dashboard.</p><p>Email service is working correctly.</p>'
    });

    if (!result.success) {
      return errorResponse(
        res,
        result.message || 'Failed to send test email',
        500,
        'TEST_EMAIL_FAILED'
      );
    }

    sendSuccess(res, { to: adminEmail }, 'Test email sent successfully');
  })
);

export default router;
