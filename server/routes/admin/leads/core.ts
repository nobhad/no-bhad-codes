/**
 * ===============================================
 * LEAD ROUTES — CORE
 * ===============================================
 * Core lead CRUD, contact submissions, invitations,
 * status updates, and activation.
 */

import express from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../../middleware/auth.js';
import { emailService } from '../../../services/email-service.js';
import { errorTracker } from '../../../services/error-tracking.js';
import { leadService } from '../../../services/lead-service.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../../utils/api-response.js';
import { logger } from '../../../services/logger.js';
import { BUSINESS_INFO } from '../../../config/business.js';

const router = express.Router();

/**
 * @swagger
 * /api/admin/leads:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get all intake form submissions (leads)
 *     description: Retrieve all projects with associated client information
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Leads retrieved successfully
 */
router.get(
  '/leads',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const leads = await leadService.getLeadsWithClients();
      const stats = await leadService.getLeadStats();

      sendSuccess(res, { leads, stats });
    } catch (error) {
      logger.error('Error fetching leads:', { error: error instanceof Error ? error : undefined });
      errorResponse(res, 'Failed to fetch leads', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

/**
 * @swagger
 * /api/admin/contact-submissions:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get all contact form submissions
 *     description: Retrieve all contact form submissions with optional filtering
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Contact submissions retrieved successfully
 */
router.get(
  '/contact-submissions',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const submissions = await leadService.getContactSubmissions();
      const stats = await leadService.getContactSubmissionStats();

      sendSuccess(res, { submissions, stats });
    } catch (error) {
      logger.error('Error fetching contact submissions:', {
        error: error instanceof Error ? error : undefined
      });
      errorResponse(res, 'Failed to fetch contact submissions', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

/**
 * @swagger
 * /api/admin/contact-submissions/{id}/status:
 *   put:
 *     tags:
 *       - Admin
 *     summary: Update contact submission status
 *     description: Mark a contact submission as read, replied, or archived
 *     security:
 *       - BearerAuth: []
 */
router.put(
  '/contact-submissions/:id/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['new', 'read', 'replied', 'archived'].includes(status)) {
        return errorResponse(res, 'Invalid status value', 400, ErrorCodes.VALIDATION_ERROR);
      }

      await leadService.updateContactSubmissionStatus(id, status);

      sendSuccess(res, undefined, 'Status updated successfully');
    } catch (error) {
      logger.error('Error updating contact submission status:', {
        error: error instanceof Error ? error : undefined
      });
      errorResponse(res, 'Failed to update status', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

/**
 * @swagger
 * /api/admin/contact-submissions/{id}/convert-to-client:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Convert contact submission to client
 *     description: Creates a new client from a contact submission and optionally sends invitation
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/contact-submissions/:id/convert-to-client',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const { sendInvitation = false } = req.body;

      // Get the contact submission
      const contact = await leadService.getContactSubmissionById(id);

      if (!contact) {
        return errorResponse(res, 'Contact submission not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      // Check if already converted
      if (contact.client_id) {
        return errorResponse(
          res,
          'This contact has already been converted to a client',
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }

      // Check if client with this email already exists
      const existingClient = await leadService.findClientByEmail(contact.email);

      let clientId: number;

      if (existingClient) {
        // Link to existing client
        clientId = existingClient.id;
      } else {
        // Create new client with pending status
        const invitationToken = sendInvitation ? crypto.randomUUID() : null;
        const expiresAt = sendInvitation
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : null;

        clientId = await leadService.createClientFromContact({
          email: contact.email,
          name: contact.name,
          invitationToken,
          expiresAt,
          sendInvitation
        });

        // Send invitation email if requested
        if (sendInvitation && invitationToken) {
          // Validate email format before sending
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const contactEmail = contact.email;
          if (!contactEmail || !emailRegex.test(contactEmail)) {
            logger.warn('Invalid contact email format, skipping invitation email', {
              category: 'leads',
              metadata: { clientId }
            });
          } else {
            const baseUrl =
            process.env.CLIENT_PORTAL_URL || process.env.FRONTEND_URL || 'http://localhost:4000';
            const inviteLink = `${baseUrl}/set-password?token=${invitationToken}`;

            try {
              await emailService.sendEmail({
                to: contactEmail,
                subject: 'Welcome to ${BUSINESS_INFO.name} - Set Up Your Client Portal',
                html: `
                <h2>Welcome, ${contact.name}!</h2>
                <p>You've been invited to set up your client portal account.</p>
                <p>Click the link below to create your password and access your portal:</p>
                <p><a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #e07a5f; color: white; text-decoration: none; border-radius: 4px;">Set Up Your Account</a></p>
                <p>This link will expire in 7 days.</p>
                <p>If you didn't expect this email, please ignore it.</p>
              `,
                text: `Welcome, ${contact.name}!\n\nYou've been invited to set up your client portal account.\n\nVisit this link to create your password: ${inviteLink}\n\nThis link will expire in 7 days.`
              });
            } catch (emailError) {
              logger.error('Failed to send invitation email:', {
                error: emailError instanceof Error ? emailError : undefined
              });
            // Don't fail the conversion if email fails
            }
          }
        }
      }

      // Update contact submission with client_id and converted_at
      await leadService.markContactAsConverted(id, clientId);

      sendSuccess(
        res,
        {
          clientId,
          isExisting: !!existingClient,
          invitationSent: sendInvitation && !existingClient
        },
        existingClient
          ? 'Contact linked to existing client'
          : 'Contact converted to client successfully'
      );
    } catch (error) {
      logger.error('Error converting contact to client:', {
        error: error instanceof Error ? error : undefined
      });
      errorResponse(res, 'Failed to convert contact to client', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

/**
 * @swagger
 * /api/admin/leads/{id}/status:
 *   put:
 *     tags:
 *       - Admin
 *     summary: Update lead/project status
 *     description: Update the status of an intake submission (project)
 *     security:
 *       - BearerAuth: []
 */
router.put(
  '/leads/:id/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const { status: rawStatus, cancelled_by, cancellation_reason } = req.body;

      // Normalize: trim, lowercase, accept legacy/label forms (spaces, underscores)
      let normalized =
        typeof rawStatus === 'string'
          ? rawStatus.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-')
          : '';
      if (normalized === 'in-progress' || normalized === 'inprogress') normalized = 'in-progress';
      if (normalized === 'on-hold' || normalized === 'onhold') normalized = 'on-hold';
      const status = normalized;

      // Lead pipeline statuses (must match frontend LEAD_STATUS_OPTIONS and GET /leads stats)
      const validStatuses = [
        'new',
        'pending',
        'contacted',
        'qualified',
        'in-progress',
        'converted',
        'lost',
        'on-hold',
        'cancelled'
      ];
      if (!status || !validStatuses.includes(status)) {
        return errorResponse(
          res,
          status
            ? `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}`
            : 'Missing or invalid status in request body',
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }

      // Validate cancelled_by when status is 'cancelled'
      if (status === 'cancelled') {
        const validCancelledBy = ['admin', 'client'];
        if (!cancelled_by || !validCancelledBy.includes(cancelled_by)) {
          return errorResponse(
            res,
            'When cancelling, must specify cancelled_by as "admin" or "client"',
            400,
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }

      // Check if project exists
      const project = await leadService.getProjectById(id);
      if (!project) {
        return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      // Update status and cancellation fields (clear them if not cancelling)
      await leadService.updateProjectStatus(
        id,
        status,
        status === 'cancelled' ? cancelled_by : null,
        status === 'cancelled' ? cancellation_reason : null
      );

      sendSuccess(
        res,
        {
          previousStatus: project.status,
          newStatus: status,
          cancelledBy: status === 'cancelled' ? cancelled_by : null,
          cancellationReason: status === 'cancelled' ? cancellation_reason : null
        },
        'Lead status updated successfully'
      );
    } catch (error) {
      logger.error('Error updating lead status:', {
        error: error instanceof Error ? error : undefined
      });
      errorResponse(res, 'Failed to update lead status', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

/**
 * @swagger
 * /api/admin/leads/{id}/invite:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Invite a lead to the client portal
 *     description: Creates a client account and sends invitation email with magic link
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/leads/:id/invite',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;

      // Get the lead/project
      const lead = await leadService.getLeadWithClient(id);

      if (!lead) {
        return errorResponse(res, 'Lead not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      const leadEmail = typeof lead.email === 'string' ? lead.email : null;
      const leadContactName = typeof lead.contact_name === 'string' ? lead.contact_name : null;
      const leadCompanyName = typeof lead.company_name === 'string' ? lead.company_name : null;
      const leadPhone = typeof lead.phone === 'string' ? lead.phone : null;

      if (!leadEmail) {
        return errorResponse(res, 'Lead does not have an email address', 400, ErrorCodes.VALIDATION_ERROR);
      }

      // Check if client already exists
      let clientId = typeof lead.client_id === 'number' ? lead.client_id : null;

      // Generate invitation token (valid for 7 days)
      const invitationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const existingClient = await leadService.findClientByExactEmail(leadEmail);

      if (existingClient) {
        // Update existing client with new invitation token
        const existingClientId = typeof existingClient.id === 'number' ? existingClient.id : null;
        if (existingClientId) {
          clientId = existingClientId;
          await leadService.updateClientInvitation(clientId, invitationToken, expiresAt);
        }
      } else {
        // Create new client with pending status (no password yet)
        clientId = await leadService.createClientFromLead({
          email: leadEmail,
          contactName: leadContactName,
          companyName: leadCompanyName,
          phone: leadPhone,
          invitationToken,
          expiresAt
        });

        // Update project to link to new client
        if (clientId && typeof id === 'string') {
          await leadService.linkProjectToClient(id, clientId);
        }
      }

      // Update lead status to converted (lead is now a project)
      if (typeof id === 'string') {
        await leadService.updateProjectStatusToConverted(id);
      }

      // Validate email format before sending
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!leadEmail || !emailRegex.test(leadEmail)) {
        return errorResponse(res, 'Invalid lead email format', 400, ErrorCodes.VALIDATION_ERROR);
      }

      // Build invitation link
      const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
      const invitationUrl = new URL('/set-password', baseUrl);
      invitationUrl.searchParams.set('token', invitationToken);
      invitationUrl.searchParams.set('email', leadEmail);
      const invitationLink = invitationUrl.toString();

      // Send invitation email
      const emailResult = await emailService.sendEmail({
        to: leadEmail,
        subject: 'Welcome to ${BUSINESS_INFO.name} - Set Up Your Client Portal',
        text: `
Hello ${leadContactName || 'there'},

You've been invited to access the ${BUSINESS_INFO.name} client portal for your project.

Click the link below to set your password and access your dashboard:
${invitationLink}

This link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
${BUSINESS_INFO.name} Team
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; }
    .button { display: inline-block; padding: 12px 30px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to ${BUSINESS_INFO.name}</h1>
    </div>
    <p>Hello ${leadContactName || 'there'},</p>
    <p>You've been invited to access the ${BUSINESS_INFO.name} client portal for your project.</p>
    <p>Click the button below to set your password and access your dashboard:</p>
    <p style="text-align: center;">
      <a href="${invitationLink}" class="button">Set Up Your Account</a>
    </p>
    <p>Or copy and paste this link:</p>
    <p style="word-break: break-all; color: #666;">${invitationLink}</p>
    <p><strong>This link will expire in 7 days.</strong></p>
    <div class="footer">
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      <p>Best regards,<br>${BUSINESS_INFO.name} Team</p>
    </div>
  </div>
</body>
</html>
        `
      });

      // Log the invitation
      errorTracker.captureMessage('Admin sent client invitation', 'info', {
        tags: { component: 'admin-invite' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' },
        extra: { leadId: id, clientEmail: leadEmail }
      });

      sendSuccess(
        res,
        {
          clientId,
          email: leadEmail,
          emailResult
        },
        'Invitation sent successfully'
      );
    } catch (error) {
      logger.error('Error inviting lead:', { error: error instanceof Error ? error : undefined });
      errorResponse(res, 'Failed to send invitation', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

/**
 * @swagger
 * /api/admin/leads/{id}/activate:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Activate a lead as a project
 *     description: Converts a pending lead to an active project without sending invitation
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/leads/:id/activate',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;

      // Get the lead/project
      const lead = await leadService.getProjectForActivation(id);

      if (!lead) {
        return errorResponse(res, 'Lead not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      if (lead.status === 'converted') {
        return errorResponse(res, 'Lead is already converted', 400, ErrorCodes.VALIDATION_ERROR);
      }

      // Update lead status to converted and set start_date
      await leadService.activateProject(id);

      // Log the activation
      errorTracker.captureMessage('Admin activated lead as project', 'info', {
        tags: { component: 'admin-leads' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' },
        extra: { leadId: id, projectName: lead.project_name }
      });

      sendSuccess(res, { projectId: id }, 'Lead activated as project successfully');
    } catch (error) {
      logger.error('Error activating lead:', { error: error instanceof Error ? error : undefined });
      errorResponse(res, 'Failed to activate lead', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

export default router;
