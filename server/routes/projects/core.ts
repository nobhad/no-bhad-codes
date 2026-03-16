import express, { Response } from 'express';
import { logger } from '../../services/logger.js';
import { projectService } from '../../services/project-service.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { cache, invalidateCache } from '../../middleware/cache.js';
import { isUserAdmin } from '../../utils/access-control.js';
import { emailService } from '../../services/email-service.js';
import { getString, getNumber } from '../../database/row-helpers.js';
import { softDeleteService } from '../../services/soft-delete-service.js';
import { generateDefaultMilestones } from '../../services/milestone-generator.js';
import { errorResponse, errorResponseWithPayload, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { workflowTriggerService } from '../../services/workflow-trigger-service.js';
import { validateRequest, ValidationSchemas } from '../../middleware/validation.js';
import { BUSINESS_INFO } from '../../config/business.js';

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
    const isAdmin = await isUserAdmin(req);

    const projects = isAdmin
      ? await projectService.listProjectsAdmin()
      : await projectService.listProjectsForClient(req.user!.id);

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

    sendSuccess(res, { projects });
  })
);

// Get single project details
router.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const isAdmin = await isUserAdmin(req);

    // Get project with client info
    const project = isAdmin
      ? await projectService.getProjectAdmin(projectId)
      : await projectService.getProjectForClient(projectId, req.user!.id);

    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    // Get project files, messages, and updates
    const files = await projectService.getProjectFiles(projectId);
    const messages = await projectService.getProjectMessages(projectId);
    const updates = await projectService.getProjectUpdates(projectId);

    sendSuccess(res, {
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
  validateRequest(ValidationSchemas.projectRequest),
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Only clients can submit project requests', 403, ErrorCodes.ACCESS_DENIED);
    }

    const { name, projectType, budget, timeline, description } = req.body;

    // Create project with pending status
    const { lastID, project: newProject } = await projectService.createProjectRequest({
      clientId: req.user!.id,
      name,
      description,
      projectType,
      budget: budget || null,
      timeline: timeline || null
    });

    // Generate default milestones and tasks for the new project
    try {
      const generationResult = await generateDefaultMilestones(lastID, projectType);
      await logger.info(
        `[Projects] Generated ${generationResult.milestonesCreated} milestones and ${generationResult.tasksCreated} tasks for project ${lastID}`,
        { category: 'PROJECTS' }
      );
    } catch (milestoneError) {
      await logger.error('[Projects] Failed to generate milestones:', {
        error: milestoneError instanceof Error ? milestoneError : undefined,
        category: 'PROJECTS'
      });
      // Non-critical - don't fail the request
    }

    // Get client info for notification
    const client = await projectService.getClientInfo(req.user!.id);

    // Send admin notification
    try {
      await emailService.sendAdminNotification({
        subject: 'New Project Request',
        intakeId: lastID?.toString() || 'N/A',
        clientName: client?.contact_name || 'Unknown',
        companyName: client?.company_name || 'Unknown Company',
        projectType: projectType,
        budget: budget || 'Not specified',
        timeline: timeline || 'Not specified'
      });
    } catch (emailError) {
      await logger.error('Failed to send admin notification:', {
        error: emailError instanceof Error ? emailError : undefined,
        category: 'PROJECTS'
      });
    }

    // Emit workflow event for project creation
    await workflowTriggerService.emit('project.created', {
      entityId: lastID,
      triggeredBy: req.user?.email || 'client',
      clientId: req.user!.id,
      projectType,
      name
    });

    sendCreated(res, { project: newProject }, 'Project request submitted successfully. We will review and get back to you soon!');
  })
);

// Create new project (admin only)
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest(ValidationSchemas.projectCreate),
  invalidateCache(['projects']),
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

    // Verify client exists
    const client = await projectService.getClientById(client_id);
    if (!client) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.INVALID_CLIENT);
    }

    const { lastID, project: newProject } = await projectService.createProjectAdmin({
      clientId: client_id,
      name,
      description,
      priority,
      startDate: start_date,
      dueDate: due_date,
      budget
    });

    // Generate default milestones and tasks for the new project
    try {
      const projectType = (newProject as { project_type?: string })?.project_type || null;
      const projectStartDate = start_date ? new Date(start_date) : undefined;
      const generationResult = await generateDefaultMilestones(lastID, projectType, {
        startDate: projectStartDate
      });
      await logger.info(
        `[Projects] Generated ${generationResult.milestonesCreated} milestones and ${generationResult.tasksCreated} tasks for project ${lastID}`,
        { category: 'PROJECTS' }
      );
    } catch (milestoneError) {
      await logger.error('[Projects] Failed to generate milestones:', {
        error: milestoneError instanceof Error ? milestoneError : undefined,
        category: 'PROJECTS'
      });
      // Non-critical - don't fail the request
    }

    // Emit workflow event for project creation
    await workflowTriggerService.emit('project.created', {
      entityId: lastID,
      triggeredBy: 'admin',
      clientId: client_id,
      name
    });

    sendCreated(res, { project: newProject }, 'Project created successfully');
  })
);

// Update project
router.put(
  '/:id',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const isAdmin = await isUserAdmin(req);

    // Check if user can update this project
    const project = isAdmin
      ? await projectService.getProjectByIdAdmin(projectId)
      : await projectService.getProjectByIdForClient(projectId, req.user!.id);

    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    // When updating status, validate against allowed project statuses (not lead pipeline statuses)
    if (req.body.status !== undefined) {
      const projectStatuses = [
        'pending',
        'active',
        'in-progress',
        'in-review',
        'completed',
        'on-hold',
        'cancelled'
      ];
      let raw =
        typeof req.body.status === 'string'
          ? req.body.status.trim().toLowerCase().replace(/_/g, '-')
          : '';
      if (raw === 'in progress') raw = 'in-progress';
      if (raw === 'on hold') raw = 'on-hold';
      if (!projectStatuses.includes(raw)) {
        return errorResponseWithPayload(
          res,
          `Invalid status. Must be one of: ${projectStatuses.join(', ')}`,
          400,
          ErrorCodes.INVALID_STATUS,
          { validStatuses: projectStatuses }
        );
      }
      req.body.status = raw;
    }

    const updateClauses: string[] = [];
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
    const allowedUpdates = isAdmin
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
        'contract_signed_date',
        // Intake fields
        'features',
        'page_count',
        'integrations',
        'addons',
        'design_level',
        'content_status',
        'brand_assets',
        'tech_comfort',
        'hosting_preference',
        'current_site',
        'inspiration',
        'challenges',
        'additional_info',
        'referral_source'
      ]
      : ['description']; // Clients can only update description

    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        const dbColumn = fieldMapping[field] || field;
        updateClauses.push(`${dbColumn} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updateClauses.length === 0) {
      return errorResponse(res, 'No valid fields to update', 400, ErrorCodes.NO_UPDATES);
    }

    await projectService.updateProject(projectId, updateClauses, values);

    // If status changed to completed, set actual_end_date
    if (req.body.status === 'completed') {
      await projectService.setProjectCompletedDate(projectId);
    }

    const updatedProject = await projectService.getUpdatedProject(projectId);

    // Emit workflow event for status change
    if (req.body.status && req.body.status !== project.status) {
      await workflowTriggerService.emit('project.status_changed', {
        entityId: projectId,
        triggeredBy: req.user?.email || 'system',
        previousStatus: project.status,
        newStatus: req.body.status
      });
    }

    // Send email notification if status changed and it's an admin update
    if (isAdmin && req.body.status && req.body.status !== project.status) {
      try {
        // Get client information
        const client = await projectService.getClientInfo(getNumber(project, 'client_id'));

        if (client) {
          const statusDescriptions: { [key: string]: string } = {
            pending: 'Your project has been queued and will begin soon.',
            'in-progress': 'Work has begun on your project and is progressing well.',
            'in-review': 'Your project is complete and under review. We\'ll have updates soon.',
            completed: 'Congratulations! Your project has been completed successfully.',
            'on-hold':
              'Your project has been temporarily paused. We\'ll keep you updated on next steps.'
          };

          const clientEmail = getString(client, 'email');
          const clientContactName = getString(client, 'contact_name');
          const updatedProjectName = updatedProject ? getString(updatedProject, 'name') : null;
          await emailService.sendProjectUpdateEmail(clientEmail, {
            projectName: updatedProjectName || 'Your Project',
            status: req.body.status,
            description:
              statusDescriptions[req.body.status] || 'Your project status has been updated.',
            clientName: clientContactName || 'Client',
            portalUrl: `${process.env.CLIENT_PORTAL_URL || `https://${BUSINESS_INFO.website}/client/portal.html`}?project=${projectId}`,
            nextSteps:
              req.body.status === 'completed'
                ? [
                  'Review the final deliverables',
                  'Provide feedback',
                  'Schedule follow-up if needed'
                ]
                : req.body.status === 'in-review'
                  ? [
                    'Review will be completed within 2 business days',
                    'We may contact you for clarifications'
                  ]
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
        await logger.error('Failed to send project update email:', {
          error: emailError instanceof Error ? emailError : undefined,
          category: 'PROJECTS'
        });
        // Continue with response - don't fail project update due to email issues
      }
    }

    sendSuccess(res, { project: updatedProject }, 'Project updated successfully');
  })
);

// Delete project (admin only) - soft delete with 30-day recovery
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const deletedBy = req.user?.email || 'admin';

    const result = await softDeleteService.softDeleteProject(projectId, deletedBy);

    if (!result.success) {
      return errorResponse(res, result.message, 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    sendSuccess(res, {
      projectId,
      affectedItems: result.affectedItems
    }, result.message);
  })
);

// Generate project report PDF
router.get(
  '/:id/report/pdf',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { fetchProjectReportData, generateProjectReportPdf } =
      await import('../../services/project-report-service.js');

    const reportData = await fetchProjectReportData(projectId);
    if (!reportData) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const pdfBytes = await generateProjectReportPdf(reportData);

    const filename = `project-report-${reportData.project.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.send(Buffer.from(pdfBytes));
  })
);

// Generate Statement of Work PDF
router.get(
  '/:id/sow/pdf',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { fetchSowData, generateSowPdf } = await import('../../services/sow-service.js');

    const sowData = await fetchSowData(projectId);
    if (!sowData) {
      return errorResponse(res, 'Project or proposal not found', 404, ErrorCodes.NOT_FOUND);
    }

    const pdfBytes = await generateSowPdf(sowData);

    const filename = `sow-${sowData.project.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.send(Buffer.from(pdfBytes));
  })
);

// Preview project report PDF (inline display)
router.get(
  '/:id/report/preview',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { fetchProjectReportData, generateProjectReportPdf } =
      await import('../../services/project-report-service.js');

    const reportData = await fetchProjectReportData(projectId);
    if (!reportData) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const pdfBytes = await generateProjectReportPdf(reportData);
    const filename = `project-report-${reportData.project.name.replace(/[^a-zA-Z0-9]/g, '-')}-preview.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.send(Buffer.from(pdfBytes));
  })
);

// Preview Statement of Work PDF (inline display)
router.get(
  '/:id/sow/preview',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { fetchSowData, generateSowPdf } = await import('../../services/sow-service.js');

    const sowData = await fetchSowData(projectId);
    if (!sowData) {
      return errorResponse(res, 'Project or proposal not found', 404, ErrorCodes.NOT_FOUND);
    }

    const pdfBytes = await generateSowPdf(sowData);
    const filename = `sow-${sowData.project.name.replace(/[^a-zA-Z0-9]/g, '-')}-preview.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.send(Buffer.from(pdfBytes));
  })
);

// Save project report PDF to project files
router.post(
  '/:id/report/save',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { fetchProjectReportData, generateProjectReportPdf } =
      await import('../../services/project-report-service.js');

    const reportData = await fetchProjectReportData(projectId);
    if (!reportData) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const pdfBytes = await generateProjectReportPdf(reportData);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `project-report-${reportData.project.name.replace(/[^a-zA-Z0-9]/g, '-')}-${dateStr}.pdf`;

    // Save to uploads directory
    const fs = await import('fs/promises');
    const path = await import('path');
    const uploadsDir = path.join(process.cwd(), 'uploads', 'projects', String(projectId));

    // Ensure directory exists
    await fs.mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, Buffer.from(pdfBytes));

    // Create file record in database
    const fileId = await projectService.saveFileRecord({
      projectId,
      filename,
      filePath: `uploads/projects/${projectId}/${filename}`,
      fileSize: pdfBytes.length,
      mimeType: 'application/pdf',
      fileType: 'document',
      description: `Project Report - Generated ${dateStr}`,
      uploadedBy: req.user?.email || 'admin',
      category: 'document',
      sharedWithClient: false
    });

    sendSuccess(res, {
      file: {
        id: fileId,
        filename,
        size: pdfBytes.length
      }
    }, 'Project report saved to files');
  })
);

// Save Statement of Work PDF to project files
router.post(
  '/:id/sow/save',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { fetchSowData, generateSowPdf } = await import('../../services/sow-service.js');

    const sowData = await fetchSowData(projectId);
    if (!sowData) {
      return errorResponse(res, 'Project or proposal not found', 404, ErrorCodes.NOT_FOUND);
    }

    const pdfBytes = await generateSowPdf(sowData);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `sow-${sowData.project.name.replace(/[^a-zA-Z0-9]/g, '-')}-${dateStr}.pdf`;

    // Save to uploads directory
    const fs = await import('fs/promises');
    const path = await import('path');
    const uploadsDir = path.join(process.cwd(), 'uploads', 'projects', String(projectId));

    // Ensure directory exists
    await fs.mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, Buffer.from(pdfBytes));

    // Create file record in database
    const fileId = await projectService.saveFileRecord({
      projectId,
      filename,
      filePath: `uploads/projects/${projectId}/${filename}`,
      fileSize: pdfBytes.length,
      mimeType: 'application/pdf',
      fileType: 'document',
      description: `Statement of Work - Generated ${dateStr}`,
      uploadedBy: req.user?.email || 'admin',
      category: 'contract',
      sharedWithClient: false
    });

    sendSuccess(res, {
      file: {
        id: fileId,
        filename,
        size: pdfBytes.length
      }
    }, 'Statement of Work saved to files');
  })
);

export { router as coreRouter };
export default router;
