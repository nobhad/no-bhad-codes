import express, { Response } from 'express';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { cache, invalidateCache } from '../../middleware/cache.js';
import { isUserAdmin } from '../../middleware/access-control.js';
import { emailService } from '../../services/email-service.js';
import { getString, getNumber } from '../../database/row-helpers.js';
import { notDeleted } from '../../database/query-helpers.js';
import { softDeleteService } from '../../services/soft-delete-service.js';
import { generateDefaultMilestones } from '../../services/milestone-generator.js';
import { errorResponse, errorResponseWithPayload } from '../../utils/api-response.js';

const router = express.Router();

// Get projects for current client
router.get(
  '/',
  authenticateToken,
  cache({
    ttl: 300, // 5 minutes
    tags: ['projects', 'clients']
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = getDatabase();
    let query = '';
    let params: (string | number | null)[] = [];

    const isAdmin = await isUserAdmin(req);

    if (isAdmin) {
      // Admin can see all projects with stats in single query (fixes N+1)
      // Filter out soft-deleted projects and clients
      query = `
      SELECT
        p.*,
        c.company_name,
        c.contact_name,
        c.email as client_email,
        COALESCE(f_stats.file_count, 0) as file_count,
        COALESCE(m_stats.message_count, 0) as message_count,
        COALESCE(m_stats.unread_count, 0) as unread_count
      FROM projects p
      JOIN clients c ON p.client_id = c.id AND ${notDeleted('c')}
      LEFT JOIN (
        SELECT project_id, COUNT(*) as file_count
        FROM files
        GROUP BY project_id
      ) f_stats ON p.id = f_stats.project_id
      LEFT JOIN (
        SELECT project_id,
               COUNT(*) as message_count,
               SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) as unread_count
        FROM messages
        GROUP BY project_id
      ) m_stats ON p.id = m_stats.project_id
      WHERE ${notDeleted('p')}
      ORDER BY p.created_at DESC
    `;
    } else {
      // Client can only see their own projects with stats in single query (fixes N+1)
      // Filter out soft-deleted projects
      query = `
      SELECT
        p.*,
        COALESCE(f_stats.file_count, 0) as file_count,
        COALESCE(m_stats.message_count, 0) as message_count,
        COALESCE(m_stats.unread_count, 0) as unread_count
      FROM projects p
      LEFT JOIN (
        SELECT project_id, COUNT(*) as file_count
        FROM files
        GROUP BY project_id
      ) f_stats ON p.id = f_stats.project_id
      LEFT JOIN (
        SELECT project_id,
               COUNT(*) as message_count,
               SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) as unread_count
        FROM messages
        GROUP BY project_id
      ) m_stats ON p.id = m_stats.project_id
      WHERE p.client_id = ? AND ${notDeleted('p')}
      ORDER BY p.created_at DESC
    `;
      params = [req.user!.id];
    }

    const projects = await db.all(query, params);

    // Format stats as nested object for API consistency
    for (const project of projects) {
      project.stats = {
        file_count: project.file_count,
        message_count: project.message_count,
        unread_count: project.unread_count
      };
      // Remove flat properties to avoid duplication
      delete project.file_count;
      delete project.message_count;
      delete project.unread_count;
    }

    res.json({ projects });
  })
);

// Get single project details
router.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();
    const isAdmin = await isUserAdmin(req);

    // Get project with client info
    let query = '';
    let params: any[] = [projectId];

    if (isAdmin) {
      query = `
      SELECT
        p.*, c.company_name, c.contact_name, c.email as client_email
      FROM projects p
      JOIN clients c ON p.client_id = c.id AND ${notDeleted('c')}
      WHERE p.id = ? AND ${notDeleted('p')}
    `;
    } else {
      query = `
      SELECT p.* FROM projects p
      WHERE p.id = ? AND p.client_id = ? AND ${notDeleted('p')}
    `;
      params = [projectId, req.user!.id];
    }

    const project = await db.get(query, params);

    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // Get project files
    const files = await db.all(
      `
    SELECT id, filename, original_filename, file_size, mime_type, uploaded_by, created_at
    FROM files 
    WHERE project_id = ?
    ORDER BY created_at DESC
  `,
      [projectId]
    );

    // Get project messages
    const messages = await db.all(
      `
    SELECT id, sender_type, sender_name, message, read_at, created_at
    FROM messages
    WHERE project_id = ?
    ORDER BY created_at ASC
  `,
      [projectId]
    );

    // Get project updates
    const updates = await db.all(
      `
    SELECT id, title, description, update_type, created_at
    FROM project_updates
    WHERE project_id = ?
    ORDER BY created_at DESC
  `,
      [projectId]
    );

    res.json({
      project,
      files,
      messages,
      updates
    });
  })
);

// Submit project request (client)
router.post(
  '/request',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Only clients can submit project requests', 403, 'ACCESS_DENIED');
    }

    const { name, projectType, budget, timeline, description } = req.body;

    if (!name || !projectType || !description) {
      return errorResponse(
        res,
        'Project name, type, and description are required',
        400,
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const db = getDatabase();

    // Create project with pending status
    const result = await db.run(
      `INSERT INTO projects (client_id, name, description, status, priority, project_type, budget_range, timeline)
       VALUES (?, ?, ?, 'pending', 'medium', ?, ?, ?)`,
      [req.user!.id, name, description, projectType, budget || null, timeline || null]
    );

    const newProject = await db.get('SELECT * FROM projects WHERE id = ?', [result.lastID]);

    // Generate default milestones and tasks for the new project
    try {
      const generationResult = await generateDefaultMilestones(result.lastID!, projectType);
      console.log(
        `[Projects] Generated ${generationResult.milestonesCreated} milestones and ${generationResult.tasksCreated} tasks for project ${result.lastID}`
      );
    } catch (milestoneError) {
      console.error('[Projects] Failed to generate milestones:', milestoneError);
      // Non-critical - don't fail the request
    }

    // Get client info for notification
    const client = await db.get(
      'SELECT email, contact_name, company_name FROM clients WHERE id = ?',
      [req.user!.id]
    );

    // Send admin notification
    try {
      await emailService.sendAdminNotification({
        subject: 'New Project Request',
        intakeId: result.lastID?.toString() || 'N/A',
        clientName: client?.contact_name || 'Unknown',
        companyName: client?.company_name || 'Unknown Company',
        projectType: projectType,
        budget: budget || 'Not specified',
        timeline: timeline || 'Not specified'
      });
    } catch (emailError) {
      console.error('Failed to send admin notification:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Project request submitted successfully. We will review and get back to you soon!',
      project: newProject
    });
  })
);

// Create new project (admin only)
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const {
      client_id,
      name,
      description,
      priority = 'medium',
      start_date,
      due_date,
      budget
    } = req.body;

    if (!client_id || !name) {
      return errorResponse(res, 'Client ID and project name are required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const db = getDatabase();

    // Verify client exists
    const client = await db.get('SELECT id FROM clients WHERE id = ?', [client_id]);
    if (!client) {
      return errorResponse(res, 'Invalid client ID', 400, 'INVALID_CLIENT');
    }

    const result = await db.run(
      `
    INSERT INTO projects (client_id, project_name, description, priority, start_date, estimated_end_date, budget_range)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
      [client_id, name, description, priority, start_date, due_date, budget]
    );

    const newProject = await db.get(
      `
    SELECT * FROM projects WHERE id = ?
  `,
      [result.lastID]
    );

    // Generate default milestones and tasks for the new project
    try {
      const projectType = (newProject as { project_type?: string })?.project_type || null;
      const projectStartDate = start_date ? new Date(start_date) : undefined;
      const generationResult = await generateDefaultMilestones(result.lastID!, projectType, {
        startDate: projectStartDate
      });
      console.log(
        `[Projects] Generated ${generationResult.milestonesCreated} milestones and ${generationResult.tasksCreated} tasks for project ${result.lastID}`
      );
    } catch (milestoneError) {
      console.error('[Projects] Failed to generate milestones:', milestoneError);
      // Non-critical - don't fail the request
    }

    res.status(201).json({
      message: 'Project created successfully',
      project: newProject
    });
  })
);

// Update project
router.put(
  '/:id',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();
    const isAdmin = await isUserAdmin(req);

    // Check if user can update this project
    let project;
    if (isAdmin) {
      project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    } else {
      project = await db.get('SELECT * FROM projects WHERE id = ? AND client_id = ?', [
        projectId,
        req.user!.id
      ]);
    }

    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // When updating status, validate against allowed project statuses (not lead pipeline statuses)
    if (req.body.status !== undefined) {
      const projectStatuses = ['pending', 'active', 'in-progress', 'in-review', 'completed', 'on-hold', 'cancelled'];
      let raw =
        typeof req.body.status === 'string' ? req.body.status.trim().toLowerCase().replace(/_/g, '-') : '';
      if (raw === 'in progress') raw = 'in-progress';
      if (raw === 'on hold') raw = 'on-hold';
      if (!projectStatuses.includes(raw)) {
        return errorResponseWithPayload(
          res,
          `Invalid status. Must be one of: ${projectStatuses.join(', ')}`,
          400,
          'INVALID_STATUS',
          { validStatuses: projectStatuses }
        );
      }
      req.body.status = raw;
    }

    const updates: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    // Map frontend field names to database column names
    const fieldMapping: Record<string, string> = {
      name: 'project_name',
      project_name: 'project_name',
      project_type: 'project_type',
      due_date: 'estimated_end_date',
      end_date: 'estimated_end_date', // Frontend sends end_date
      estimated_end_date: 'estimated_end_date',
      budget: 'budget_range',
      price: 'price',
      timeline: 'timeline',
      preview_url: 'preview_url',
      description: 'description',
      status: 'status',
      priority: 'priority',
      start_date: 'start_date',
      progress: 'progress',
      notes: 'notes',
      admin_notes: 'notes', // Frontend sends admin_notes, maps to notes column
      repository_url: 'repository_url',
      repo_url: 'repository_url', // Frontend sends repo_url
      staging_url: 'staging_url',
      production_url: 'production_url',
      deposit_amount: 'deposit_amount',
      contract_signed_at: 'contract_signed_at',
      contract_signed_date: 'contract_signed_at' // Frontend sends contract_signed_date
    };
    const allowedUpdates =
      isAdmin
        ? [
            'name',
            'project_name',
            'project_type',
            'description',
            'status',
            'priority',
            'start_date',
            'due_date',
            'end_date',
            'estimated_end_date',
            'budget',
            'price',
            'timeline',
            'preview_url',
            'progress',
            'notes',
            'admin_notes',
            'repository_url',
            'repo_url',
            'staging_url',
            'production_url',
            'deposit_amount',
            'contract_signed_at',
            'contract_signed_date'
          ]
        : ['description']; // Clients can only update description

    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        const dbColumn = fieldMapping[field] || field;
        updates.push(`${dbColumn} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return errorResponse(res, 'No valid fields to update', 400, 'NO_UPDATES');
    }

    values.push(projectId);

    await db.run(
      `
    UPDATE projects 
    SET ${updates.join(', ')}
    WHERE id = ?
  `,
      values
    );

    // If status changed to completed, set actual_end_date
    if (req.body.status === 'completed') {
      await db.run(
        `
      UPDATE projects
      SET actual_end_date = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
        [projectId]
      );
    }

    const updatedProject = await db.get(
      `
      SELECT
        p.*,
        p.estimated_end_date as end_date,
        p.repository_url as repo_url,
        p.contract_signed_at as contract_signed_date
      FROM projects p
      WHERE p.id = ?
    `,
      [projectId]
    );

    // Send email notification if status changed and it's an admin update
    if (isAdmin && req.body.status && req.body.status !== project.status) {
      try {
        // Get client information
        const client = await db.get(
          'SELECT email, contact_name, company_name FROM clients WHERE id = ?',
          [getNumber(project, 'client_id')]
        );

        if (client) {
          const statusDescriptions: { [key: string]: string } = {
            pending: 'Your project has been queued and will begin soon.',
            'in-progress': 'Work has begun on your project and is progressing well.',
            'in-review': "Your project is complete and under review. We'll have updates soon.",
            completed: 'Congratulations! Your project has been completed successfully.',
            'on-hold':
              "Your project has been temporarily paused. We'll keep you updated on next steps."
          };

          const clientEmail = getString(client, 'email');
          const clientContactName = getString(client, 'contact_name');
          const updatedProjectName = updatedProject ? getString(updatedProject, 'name') : null;
          await emailService.sendProjectUpdateEmail(clientEmail, {
            projectName: updatedProjectName || 'Your Project',
            status: req.body.status,
            description: statusDescriptions[req.body.status] || 'Your project status has been updated.',
            clientName: clientContactName || 'Client',
            portalUrl: `${process.env.CLIENT_PORTAL_URL || 'https://nobhad.codes/client/portal.html'}?project=${projectId}`,
            nextSteps:
              req.body.status === 'completed'
                ? ['Review the final deliverables', 'Provide feedback', 'Schedule follow-up if needed']
                : req.body.status === 'in-review'
                  ? ['Review will be completed within 2 business days', 'We may contact you for clarifications']
                  : []
          });

          // Send admin notification for milestone completion
          if (req.body.status === 'completed') {
            await emailService.sendAdminNotification('Project Milestone Completed', {
              type: 'project-milestone',
              message: `Project "${updatedProject?.name}" completed for client ${client.company_name || client.contact_name}`,
              details: {
                projectId: projectId,
                projectName: updatedProject?.name || 'Unknown Project',
                clientId: client.id,
                clientName: client.contact_name || 'Unknown',
                companyName: client.company_name || 'Unknown Company',
                completedAt: new Date().toISOString()
              },
              timestamp: new Date()
            });
          }
        }
      } catch (emailError) {
        console.error('Failed to send project update email:', emailError);
        // Continue with response - don't fail project update due to email issues
      }
    }

    res.json({
      message: 'Project updated successfully',
      project: updatedProject
    });
  })
);

// Delete project (admin only) - soft delete with 30-day recovery
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const deletedBy = req.user?.email || 'admin';

    const result = await softDeleteService.softDeleteProject(projectId, deletedBy);

    if (!result.success) {
      return errorResponse(res, result.message, 404, 'PROJECT_NOT_FOUND');
    }

    res.json({
      success: true,
      message: result.message,
      projectId,
      affectedItems: result.affectedItems
    });
  })
);

export { router as coreRouter };
export default router;
