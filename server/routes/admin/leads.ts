import express from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { emailService } from '../../services/email-service.js';
import { errorTracker } from '../../services/error-tracking.js';
import { getDatabase } from '../../database/init.js';
import { leadService } from '../../services/lead-service.js';
import { errorResponse, sendSuccess, sendCreated } from '../../utils/api-response.js';

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
      const db = getDatabase();

      // Get all projects with client info
      const leads = await db.all(`
        SELECT
          p.id,
          p.client_id,
          p.project_name,
          p.description,
          p.status,
          p.project_type,
          p.budget_range,
          p.timeline,
          p.created_at,
          p.start_date,
          p.estimated_end_date as end_date,
          p.price,
          p.preview_url,
          p.notes,
          p.repository_url as repo_url,
          p.production_url,
          p.deposit_amount,
          p.contract_signed_at as contract_signed_date,
          p.progress,
          c.contact_name,
          c.company_name,
          c.email,
          c.phone
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.id
        ORDER BY p.created_at DESC
      `);

      // Get stats - using simplified lead statuses
      const stats = await db.get(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new,
          SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
          SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted
        FROM projects
      `);

      sendSuccess(res, {
        leads,
        stats: {
          total: stats?.total || 0,
          new: stats?.new || 0,
          inProgress: stats?.inProgress || 0,
          converted: stats?.converted || 0
        }
      });
    } catch (error) {
      console.error('Error fetching leads:', error);
      errorResponse(res, 'Failed to fetch leads', 500, 'INTERNAL_ERROR');
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
      const db = getDatabase();

      // Get all contact submissions
      const submissions = await db.all(`
        SELECT
          id,
          name,
          email,
          subject,
          message,
          status,
          message_id,
          created_at,
          read_at,
          replied_at
        FROM contact_submissions
        ORDER BY created_at DESC
      `);

      // Get stats
      const stats = await db.get(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new,
          SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
          SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
          SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
        FROM contact_submissions
      `);

      sendSuccess(res, {
        submissions,
        stats: {
          total: stats?.total || 0,
          new: stats?.new || 0,
          read: stats?.read || 0,
          replied: stats?.replied || 0,
          archived: stats?.archived || 0
        }
      });
    } catch (error) {
      console.error('Error fetching contact submissions:', error);
      errorResponse(res, 'Failed to fetch contact submissions', 500, 'INTERNAL_ERROR');
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
        return errorResponse(res, 'Invalid status value', 400, 'VALIDATION_ERROR');
      }

      const db = getDatabase();

      let updateFields = 'status = ?, updated_at = CURRENT_TIMESTAMP';
      const values: (string | number)[] = [status];

      if (status === 'read') {
        updateFields += ', read_at = CURRENT_TIMESTAMP';
      } else if (status === 'replied') {
        updateFields += ', replied_at = CURRENT_TIMESTAMP';
      }

      values.push(id);

      await db.run(`UPDATE contact_submissions SET ${updateFields} WHERE id = ?`, values);

      sendSuccess(res, undefined, 'Status updated successfully');
    } catch (error) {
      console.error('Error updating contact submission status:', error);
      errorResponse(res, 'Failed to update status', 500, 'INTERNAL_ERROR');
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

      const db = getDatabase();

      // Get the contact submission
      const contact = await db.get(
        'SELECT * FROM contact_submissions WHERE id = ?',
        [id]
      );

      if (!contact) {
        return errorResponse(res, 'Contact submission not found', 404, 'RESOURCE_NOT_FOUND');
      }

      // Check if already converted
      if (contact.client_id) {
        return errorResponse(res, 'This contact has already been converted to a client', 400, 'VALIDATION_ERROR');
      }

      // Check if client with this email already exists
      const existingClient = await db.get(
        'SELECT id, contact_name, email FROM clients WHERE LOWER(email) = LOWER(?)',
        [contact.email as string]
      ) as { id: number; contact_name: string; email: string } | undefined;

      let clientId: number;

      if (existingClient) {
        // Link to existing client
        clientId = existingClient.id as number;
      } else {
        // Create new client with pending status
        const invitationToken = sendInvitation ? crypto.randomUUID() : null;
        const expiresAt = sendInvitation
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : null;

        const result = await db.run(
          `INSERT INTO clients (
            email, password_hash, contact_name, company_name, phone,
            status, client_type, invitation_token, invitation_expires_at,
            invitation_sent_at, created_at, updated_at
          ) VALUES (
            LOWER(?), '', ?, ?, ?, 'pending', 'business', ?, ?,
            ${sendInvitation ? 'CURRENT_TIMESTAMP' : 'NULL'},
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`,
          [
            contact.email as string,
            contact.name as string,
            null, // company_name - not available from contact form
            null, // phone - not available from contact form
            invitationToken,
            expiresAt
          ]
        );

        clientId = result.lastID!;

        // Send invitation email if requested
        if (sendInvitation && invitationToken) {
          const baseUrl = process.env.CLIENT_PORTAL_URL || process.env.FRONTEND_URL || 'http://localhost:4000';
          const inviteLink = `${baseUrl}/client/set-password.html?token=${invitationToken}`;

          try {
            await emailService.sendEmail({
              to: contact.email as string,
              subject: 'Welcome to No Bhad Codes - Set Up Your Client Portal',
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
            console.error('Failed to send invitation email:', emailError);
            // Don't fail the conversion if email fails
          }
        }
      }

      // Update contact submission with client_id and converted_at
      await db.run(
        `UPDATE contact_submissions
         SET client_id = ?, converted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [clientId, id]
      );

      sendSuccess(res, {
        clientId,
        isExisting: !!existingClient,
        invitationSent: sendInvitation && !existingClient
      }, existingClient ? 'Contact linked to existing client' : 'Contact converted to client successfully');
    } catch (error) {
      console.error('Error converting contact to client:', error);
      errorResponse(res, 'Failed to convert contact to client', 500, 'INTERNAL_ERROR');
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
      const validStatuses = ['new', 'contacted', 'qualified', 'in-progress', 'converted', 'lost', 'on-hold', 'cancelled'];
      if (!status || !validStatuses.includes(status)) {
        return errorResponse(
          res,
          status
            ? `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}`
            : 'Missing or invalid status in request body',
          400,
          'VALIDATION_ERROR'
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
            'VALIDATION_ERROR'
          );
        }
      }

      const db = getDatabase();

      // Check if project exists
      const project = await db.get('SELECT id, status FROM projects WHERE id = ?', [id]);
      if (!project) {
        return errorResponse(res, 'Project not found', 404, 'RESOURCE_NOT_FOUND');
      }

      // Update status and cancellation fields (clear them if not cancelling)
      if (status === 'cancelled') {
        await db.run(
          'UPDATE projects SET status = ?, cancelled_by = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [status, cancelled_by, cancellation_reason || null, id]
        );
      } else {
        await db.run(
          'UPDATE projects SET status = ?, cancelled_by = NULL, cancellation_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [status, id]
        );
      }

      sendSuccess(res, {
        previousStatus: project.status,
        newStatus: status,
        cancelledBy: status === 'cancelled' ? cancelled_by : null,
        cancellationReason: status === 'cancelled' ? cancellation_reason : null
      }, 'Lead status updated successfully');
    } catch (error) {
      console.error('Error updating lead status:', error);
      errorResponse(res, 'Failed to update lead status', 500, 'INTERNAL_ERROR');
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
      const db = getDatabase();

      // Get the lead/project
      const lead = await db.get(
        `
        SELECT
          p.id,
          p.project_name,
          p.description,
          p.project_type,
          p.budget_range,
          p.timeline,
          p.features,
          p.client_id,
          c.email,
          c.contact_name,
          c.company_name,
          c.phone
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.id
        WHERE p.id = ?
      `,
        [id]
      );

      if (!lead) {
        return errorResponse(res, 'Lead not found', 404, 'RESOURCE_NOT_FOUND');
      }

      const leadEmail = typeof lead.email === 'string' ? lead.email : null;
      const leadContactName = typeof lead.contact_name === 'string' ? lead.contact_name : null;
      const leadCompanyName = typeof lead.company_name === 'string' ? lead.company_name : null;
      const leadPhone = typeof lead.phone === 'string' ? lead.phone : null;

      if (!leadEmail) {
        return errorResponse(res, 'Lead does not have an email address', 400, 'VALIDATION_ERROR');
      }

      // Check if client already exists
      let clientId = typeof lead.client_id === 'number' ? lead.client_id : null;
      const existingClient = await db.get(
        'SELECT id, invitation_token FROM clients WHERE email = ?',
        [leadEmail]
      );

      // Generate invitation token (valid for 7 days)
      const invitationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      if (existingClient) {
        // Update existing client with new invitation token
        const existingClientId = typeof existingClient.id === 'number' ? existingClient.id : null;
        if (existingClientId) {
          clientId = existingClientId;
          await db.run(
            `
            UPDATE clients
            SET invitation_token = ?, invitation_expires_at = ?, invitation_sent_at = CURRENT_TIMESTAMP, status = 'pending'
            WHERE id = ?
          `,
            [invitationToken, expiresAt, clientId]
          );
        }
      } else {
        // Create new client with pending status (no password yet)
        const result = await db.run(
          `
          INSERT INTO clients (email, password_hash, contact_name, company_name, phone, status, invitation_token, invitation_expires_at, invitation_sent_at)
          VALUES (?, '', ?, ?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP)
        `,
          [leadEmail, leadContactName, leadCompanyName, leadPhone, invitationToken, expiresAt]
        );
        clientId = result.lastID || null;

        // Update project to link to new client
        if (clientId && typeof id === 'string') {
          await db.run('UPDATE projects SET client_id = ? WHERE id = ?', [clientId, id]);
        }
      }

      // Update lead status to converted (lead is now a project)
      if (typeof id === 'string') {
        await db.run('UPDATE projects SET status = ? WHERE id = ?', ['converted', id]);
      }

      // Build invitation link
      const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
      const invitationUrl = new URL('/client/set-password.html', baseUrl);
      invitationUrl.searchParams.set('token', invitationToken);
      if (leadEmail) {
        invitationUrl.searchParams.set('email', leadEmail);
      }
      const invitationLink = invitationUrl.toString();

      // Send invitation email
      const emailResult = await emailService.sendEmail({
        to: leadEmail,
        subject: 'Welcome to No Bhad Codes - Set Up Your Client Portal',
        text: `
Hello ${leadContactName || 'there'},

You've been invited to access the No Bhad Codes client portal for your project.

Click the link below to set your password and access your dashboard:
${invitationLink}

This link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
No Bhad Codes Team
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
      <h1>Welcome to No Bhad Codes</h1>
    </div>
    <p>Hello ${leadContactName || 'there'},</p>
    <p>You've been invited to access the No Bhad Codes client portal for your project.</p>
    <p>Click the button below to set your password and access your dashboard:</p>
    <p style="text-align: center;">
      <a href="${invitationLink}" class="button">Set Up Your Account</a>
    </p>
    <p>Or copy and paste this link:</p>
    <p style="word-break: break-all; color: #666;">${invitationLink}</p>
    <p><strong>This link will expire in 7 days.</strong></p>
    <div class="footer">
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      <p>Best regards,<br>No Bhad Codes Team</p>
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

      sendSuccess(res, {
        clientId,
        email: leadEmail,
        emailResult
      }, 'Invitation sent successfully');
    } catch (error) {
      console.error('Error inviting lead:', error);
      errorResponse(res, 'Failed to send invitation', 500, 'INTERNAL_ERROR');
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
      const db = getDatabase();

      // Get the lead/project
      const lead = await db.get('SELECT id, status, project_name FROM projects WHERE id = ?', [id]);

      if (!lead) {
        return errorResponse(res, 'Lead not found', 404, 'RESOURCE_NOT_FOUND');
      }

      if (lead.status === 'converted') {
        return errorResponse(res, 'Lead is already converted', 400, 'VALIDATION_ERROR');
      }

      // Update lead status to converted and set start_date
      await db.run('UPDATE projects SET status = ?, start_date = date(\'now\'), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        'converted',
        id
      ]);

      // Log the activation
      errorTracker.captureMessage('Admin activated lead as project', 'info', {
        tags: { component: 'admin-leads' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' },
        extra: { leadId: id, projectName: lead.project_name }
      });

      sendSuccess(res, { projectId: id }, 'Lead activated as project successfully');
    } catch (error) {
      console.error('Error activating lead:', error);
      errorResponse(res, 'Failed to activate lead', 500, 'INTERNAL_ERROR');
    }
  })
);

// =====================================================
// LEAD SCORING
// =====================================================

/**
 * GET /api/admin/leads/scoring-rules - Get all scoring rules
 */
router.get(
  '/leads/scoring-rules',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const rules = await leadService.getScoringRules(includeInactive);
    sendSuccess(res, { rules });
  })
);

/**
 * POST /api/admin/leads/scoring-rules - Create scoring rule
 */
router.post(
  '/leads/scoring-rules',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, description, fieldName, operator, thresholdValue, points, isActive } = req.body;

    if (!name || !fieldName || !operator || thresholdValue === undefined || points === undefined) {
      return errorResponse(
        res,
        'Name, fieldName, operator, thresholdValue, and points are required',
        400,
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const rule = await leadService.createScoringRule({
      name,
      description,
      fieldName,
      operator,
      thresholdValue,
      points,
      isActive
    });

    sendCreated(res, { rule });
  })
);

/**
 * PUT /api/admin/leads/scoring-rules/:id - Update scoring rule
 */
router.put(
  '/leads/scoring-rules/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const ruleId = parseInt(req.params.id);
    const rule = await leadService.updateScoringRule(ruleId, req.body);
    sendSuccess(res, { rule });
  })
);

/**
 * DELETE /api/admin/leads/scoring-rules/:id - Delete scoring rule
 */
router.delete(
  '/leads/scoring-rules/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const ruleId = parseInt(req.params.id);
    await leadService.deleteScoringRule(ruleId);
    sendSuccess(res, undefined, 'Scoring rule deleted');
  })
);

/**
 * POST /api/admin/leads/:id/calculate-score - Calculate score for a lead
 */
router.post(
  '/leads/:id/calculate-score',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const result = await leadService.calculateLeadScore(projectId);
    sendSuccess(res, result);
  })
);

/**
 * POST /api/admin/leads/recalculate-all - Recalculate all lead scores
 */
router.post(
  '/leads/recalculate-all',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const count = await leadService.updateAllLeadScores();
    sendSuccess(res, { count }, `Recalculated scores for ${count} leads`);
  })
);

// =====================================================
// PIPELINE MANAGEMENT
// =====================================================

/**
 * GET /api/admin/leads/pipeline/stages - Get pipeline stages
 */
router.get(
  '/leads/pipeline/stages',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const stages = await leadService.getPipelineStages();
    sendSuccess(res, { stages });
  })
);

/**
 * GET /api/admin/leads/pipeline - Get pipeline view (kanban)
 */
router.get(
  '/leads/pipeline',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const pipeline = await leadService.getPipelineView();
    sendSuccess(res, pipeline);
  })
);

/**
 * GET /api/admin/leads/pipeline/stats - Get pipeline statistics
 */
router.get(
  '/leads/pipeline/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const stats = await leadService.getPipelineStats();
    sendSuccess(res, { stats });
  })
);

/**
 * POST /api/admin/leads/:id/move-stage - Move lead to stage
 */
router.post(
  '/leads/:id/move-stage',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const { stageId } = req.body;

    if (!stageId) {
      return errorResponse(res, 'stageId is required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    await leadService.moveToStage(projectId, stageId);
    sendSuccess(res, undefined, 'Lead moved to stage');
  })
);

// =====================================================
// TASK MANAGEMENT
// =====================================================

/**
 * GET /api/admin/leads/:id/tasks - Get tasks for a lead
 */
router.get(
  '/leads/:id/tasks',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const tasks = await leadService.getTasks(projectId);
    sendSuccess(res, { tasks });
  })
);

/**
 * POST /api/admin/leads/:id/tasks - Create task for a lead
 */
router.post(
  '/leads/:id/tasks',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const { title, description, taskType, dueDate, dueTime, assignedTo, priority, reminderAt } = req.body;

    if (!title) {
      return errorResponse(res, 'Title is required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const task = await leadService.createTask(projectId, {
      title,
      description,
      taskType,
      dueDate,
      dueTime,
      assignedTo,
      priority,
      reminderAt
    });

    sendCreated(res, { task });
  })
);

/**
 * PUT /api/admin/leads/tasks/:taskId - Update a task
 */
router.put(
  '/leads/tasks/:taskId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    const task = await leadService.updateTask(taskId, req.body);
    sendSuccess(res, { task });
  })
);

/**
 * POST /api/admin/leads/tasks/:taskId/complete - Complete a task
 */
router.post(
  '/leads/tasks/:taskId/complete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    const task = await leadService.completeTask(taskId, req.user?.email);
    sendSuccess(res, { task });
  })
);

/**
 * GET /api/admin/leads/tasks/overdue - Get overdue tasks
 */
router.get(
  '/leads/tasks/overdue',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const tasks = await leadService.getOverdueTasks();
    sendSuccess(res, { tasks });
  })
);

/**
 * GET /api/admin/leads/tasks/upcoming - Get upcoming tasks
 */
router.get(
  '/leads/tasks/upcoming',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const days = req.query.days ? parseInt(req.query.days as string) : 7;
    const tasks = await leadService.getUpcomingTasks(days);
    sendSuccess(res, { tasks });
  })
);

// =====================================================
// NOTES
// =====================================================

/**
 * GET /api/admin/leads/:id/notes - Get notes for a lead
 */
router.get(
  '/leads/:id/notes',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const notes = await leadService.getNotes(projectId);
    sendSuccess(res, { notes });
  })
);

/**
 * POST /api/admin/leads/:id/notes - Add note to a lead
 */
router.post(
  '/leads/:id/notes',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content) {
      return errorResponse(res, 'Content is required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const note = await leadService.addNote(projectId, req.user?.email || 'admin', content);
    sendCreated(res, { note });
  })
);

/**
 * POST /api/admin/leads/notes/:noteId/toggle-pin - Pin/unpin a note
 */
router.post(
  '/leads/notes/:noteId/toggle-pin',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const noteId = parseInt(req.params.noteId);
    const note = await leadService.togglePinNote(noteId);
    sendSuccess(res, { note });
  })
);

/**
 * DELETE /api/admin/leads/notes/:noteId - Delete a note
 */
router.delete(
  '/leads/notes/:noteId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const noteId = parseInt(req.params.noteId);
    await leadService.deleteNote(noteId);
    sendSuccess(res, undefined, 'Note deleted');
  })
);

// =====================================================
// LEAD SOURCES
// =====================================================

/**
 * GET /api/admin/leads/sources - Get lead sources
 */
router.get(
  '/leads/sources',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const sources = await leadService.getLeadSources(includeInactive);
    sendSuccess(res, { sources });
  })
);

/**
 * POST /api/admin/leads/:id/source - Set lead source
 */
router.post(
  '/leads/:id/source',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const { sourceId } = req.body;

    if (!sourceId) {
      return errorResponse(res, 'sourceId is required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    await leadService.setLeadSource(projectId, sourceId);
    sendSuccess(res, undefined, 'Lead source updated');
  })
);

// =====================================================
// ASSIGNMENT
// =====================================================

/**
 * POST /api/admin/leads/:id/assign - Assign a lead
 */
router.post(
  '/leads/:id/assign',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const { assignee } = req.body;

    if (!assignee) {
      return errorResponse(res, 'assignee is required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    await leadService.assignLead(projectId, assignee);
    sendSuccess(res, undefined, 'Lead assigned');
  })
);

/**
 * GET /api/admin/leads/my-leads - Get leads assigned to current user
 */
router.get(
  '/leads/my-leads',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const leads = await leadService.getMyLeads(req.user?.email || '');
    sendSuccess(res, { leads });
  })
);

/**
 * GET /api/admin/leads/unassigned - Get unassigned leads
 */
router.get(
  '/leads/unassigned',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const leads = await leadService.getUnassignedLeads();
    sendSuccess(res, { leads });
  })
);

// =====================================================
// DUPLICATE DETECTION
// =====================================================

/**
 * GET /api/admin/leads/:id/duplicates - Find duplicates for a lead
 */
router.get(
  '/leads/:id/duplicates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const duplicates = await leadService.findDuplicates(projectId);
    sendSuccess(res, { duplicates });
  })
);

/**
 * GET /api/admin/leads/duplicates - Get all pending duplicates
 */
router.get(
  '/leads/duplicates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const duplicates = await leadService.getAllPendingDuplicates();
    sendSuccess(res, { duplicates });
  })
);

/**
 * POST /api/admin/leads/duplicates/:id/resolve - Resolve duplicate
 */
router.post(
  '/leads/duplicates/:id/resolve',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const duplicateId = parseInt(req.params.id);
    const { status } = req.body;

    if (!status || !['merged', 'not_duplicate', 'dismissed'].includes(status)) {
      return errorResponse(res, 'Valid status is required (merged, not_duplicate, dismissed)', 400, 'INVALID_STATUS');
    }

    await leadService.resolveDuplicate(duplicateId, status, req.user?.email || 'admin');
    sendSuccess(res, undefined, 'Duplicate resolved');
  })
);

// =====================================================
// BULK OPERATIONS
// =====================================================

/**
 * POST /api/admin/leads/bulk/status - Bulk update status
 */
router.post(
  '/leads/bulk/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectIds, status } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || !status) {
      return errorResponse(res, 'projectIds array and status are required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const count = await leadService.bulkUpdateStatus(projectIds, status);
    sendSuccess(res, { count }, `Updated ${count} leads`);
  })
);

/**
 * POST /api/admin/leads/bulk/assign - Bulk assign
 */
router.post(
  '/leads/bulk/assign',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectIds, assignee } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || !assignee) {
      return errorResponse(res, 'projectIds array and assignee are required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const count = await leadService.bulkAssign(projectIds, assignee);
    sendSuccess(res, { count }, `Assigned ${count} leads`);
  })
);

/**
 * POST /api/admin/leads/bulk/move-stage - Bulk move to stage
 */
router.post(
  '/leads/bulk/move-stage',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectIds, stageId } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || !stageId) {
      return errorResponse(res, 'projectIds array and stageId are required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const count = await leadService.bulkMoveToStage(projectIds, stageId);
    sendSuccess(res, { count }, `Moved ${count} leads`);
  })
);

// =====================================================
// ANALYTICS
// =====================================================

/**
 * GET /api/admin/leads/analytics - Get lead analytics
 */
router.get(
  '/leads/analytics',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const analytics = await leadService.getLeadAnalytics();
    sendSuccess(res, { analytics });
  })
);

/**
 * GET /api/admin/leads/conversion-funnel - Get conversion funnel
 */
router.get(
  '/leads/conversion-funnel',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const funnel = await leadService.getConversionFunnel();
    sendSuccess(res, { funnel });
  })
);

/**
 * GET /api/admin/leads/source-performance - Get source performance
 */
router.get(
  '/leads/source-performance',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const sources = await leadService.getSourcePerformance();
    sendSuccess(res, { sources });
  })
);

export default router;
