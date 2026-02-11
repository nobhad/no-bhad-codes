/**
 * ===============================================
 * PROJECT ROUTES
 * ===============================================
 * Project management, files, and messages endpoints
 */

import express, { Response } from 'express';
import multer from 'multer';
import path, { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { PDFDocument as PDFLibDocument, StandardFonts, degrees, rgb, PDFPage } from 'pdf-lib';
import { getDatabase } from '../database/init.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import {
  isUserAdmin,
  canAccessProject,
  canAccessFile,
  canAccessFolder,
  canAccessTask,
  canAccessChecklistItem,
  canAccessFileComment
} from '../middleware/access-control.js';
import { emailService } from '../services/email-service.js';
import { cache, invalidateCache } from '../middleware/cache.js';
import { getUploadsDir, getUploadsSubdir, getRelativePath, UPLOAD_DIRS, sanitizeFilename } from '../config/uploads.js';
import { getString, getNumber } from '../database/row-helpers.js';
import { projectService } from '../services/project-service.js';
import { fileService } from '../services/file-service.js';
import { getSchedulerService } from '../services/scheduler-service.js';
import { BUSINESS_INFO, getPdfLogoBytes, CONTRACT_TERMS } from '../config/business.js';
import {
  getPdfCacheKey,
  getCachedPdf,
  cachePdf,
  ensureSpace,
  drawWrappedText,
  addPageNumbers,
  PAGE_MARGINS
} from '../utils/pdf-utils.js';
import { notDeleted } from '../database/query-helpers.js';
import { softDeleteService } from '../services/soft-delete-service.js';
import { generateDefaultMilestones } from '../services/milestone-generator.js';
import { escalateTaskPriorities, previewEscalation, getEscalationSummary } from '../services/priority-escalation-service.js';
import { userService } from '../services/user-service.js';

const router = express.Router();

// Configure multer for file uploads using centralized config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadsSubdir(UPLOAD_DIRS.PROJECTS));
  },
  filename: (req, file, cb) => {
    // Generate descriptive filename with sanitized original name and timestamp
    const filename = sanitizeFilename(file.originalname);
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|txt|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  }
});

// Get projects for current client
router.get(
  '/',
  authenticateToken,
  cache({
    ttl: 300, // 5 minutes
    tags: ['projects', 'clients']
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();
    let query = '';
    let params: (string | number | null)[] = [];

    // SECURITY: Double-check admin status from database, don't trust JWT alone
    let isAdmin = req.user!.type === 'admin';
    if (isAdmin && req.user!.id > 0) {
      // Verify this client actually has admin privileges
      const client = await db.get('SELECT is_admin FROM clients WHERE id = ?', [req.user!.id]);
      isAdmin = !!(client && client.is_admin === 1);
    }

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
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // Get project with client info
    let query = '';
    let params: any[] = [projectId];

    if (req.user!.type === 'admin') {
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
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
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
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return res
        .status(403)
        .json({ error: 'Only clients can submit project requests', code: 'ACCESS_DENIED' });
    }

    const { name, projectType, budget, timeline, description } = req.body;

    if (!name || !projectType || !description) {
      return res.status(400).json({
        error: 'Project name, type, and description are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
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
      console.log(`[Projects] Generated ${generationResult.milestonesCreated} milestones and ${generationResult.tasksCreated} tasks for project ${result.lastID}`);
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
  asyncHandler(async (req: express.Request, res: express.Response) => {
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
      return res.status(400).json({
        error: 'Client ID and project name are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const db = getDatabase();

    // Verify client exists
    const client = await db.get('SELECT id FROM clients WHERE id = ?', [client_id]);
    if (!client) {
      return res.status(400).json({
        error: 'Invalid client ID',
        code: 'INVALID_CLIENT'
      });
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
      const generationResult = await generateDefaultMilestones(result.lastID!, projectType, { startDate: projectStartDate });
      console.log(`[Projects] Generated ${generationResult.milestonesCreated} milestones and ${generationResult.tasksCreated} tasks for project ${result.lastID}`);
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
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // Check if user can update this project
    let project;
    if (req.user!.type === 'admin') {
      project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    } else {
      project = await db.get('SELECT * FROM projects WHERE id = ? AND client_id = ?', [
        projectId,
        req.user!.id
      ]);
    }

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    // When updating status, validate against allowed project statuses (not lead pipeline statuses)
    if (req.body.status !== undefined) {
      const projectStatuses = ['pending', 'active', 'in-progress', 'in-review', 'completed', 'on-hold', 'cancelled'];
      let raw = typeof req.body.status === 'string' ? req.body.status.trim().toLowerCase().replace(/_/g, '-') : '';
      if (raw === 'in progress') raw = 'in-progress';
      if (raw === 'on hold') raw = 'on-hold';
      if (!projectStatuses.includes(raw)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${projectStatuses.join(', ')}`,
          code: 'INVALID_STATUS',
          validStatuses: projectStatuses
        });
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
      req.user!.type === 'admin'
        ? ['name', 'project_name', 'project_type', 'description', 'status', 'priority', 'start_date', 'due_date', 'end_date', 'estimated_end_date', 'budget', 'price', 'timeline', 'preview_url', 'progress', 'notes', 'admin_notes', 'repository_url', 'repo_url', 'staging_url', 'production_url', 'deposit_amount', 'contract_signed_at', 'contract_signed_date']
        : ['description']; // Clients can only update description

    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        const dbColumn = fieldMapping[field] || field;
        updates.push(`${dbColumn} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update',
        code: 'NO_UPDATES'
      });
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

    const updatedProject = await db.get(`
      SELECT
        p.*,
        p.estimated_end_date as end_date,
        p.repository_url as repo_url,
        p.contract_signed_at as contract_signed_date
      FROM projects p
      WHERE p.id = ?
    `, [projectId]);

    // Send email notification if status changed and it's an admin update
    if (req.user!.type === 'admin' && req.body.status && req.body.status !== project.status) {
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
            portalUrl: `${process.env.CLIENT_PORTAL_URL || 'https://nobhad.codes/client/portal.html'}?project=${projectId}`,
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
      return res.status(404).json({
        error: result.message,
        code: 'PROJECT_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: result.message,
      projectId,
      affectedItems: result.affectedItems
    });
  })
);

// Get files for a project
router.get(
  '/:id/files',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // Check if user can access this project
    let project;
    if (req.user!.type === 'admin') {
      project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    } else {
      project = await db.get('SELECT id FROM projects WHERE id = ? AND client_id = ?', [
        projectId,
        req.user!.id
      ]);
    }

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const files = await db.all(
      `
    SELECT id, filename, original_filename, file_size, mime_type, file_type,
           file_path, description, uploaded_by, created_at
    FROM files
    WHERE project_id = ?
    ORDER BY created_at DESC
  `,
      [projectId]
    );

    // Map to consistent field names
    res.json({
      files: files.map((f: any) => ({
        ...f,
        size: f.file_size // Also include as 'size' for frontend compatibility
      }))
    });
  })
);

// Upload files to project
router.post(
  '/:id/files',
  authenticateToken,
  upload.array('files', 5),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
        code: 'NO_FILES'
      });
    }

    const db = getDatabase();

    // Check if user can upload to this project
    let project;
    if (req.user!.type === 'admin') {
      project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    } else {
      project = await db.get('SELECT id FROM projects WHERE id = ? AND client_id = ?', [
        projectId,
        req.user!.id
      ]);
    }

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const uploadedFiles = [];
    const label = req.body.label || null;

    for (const file of files) {
      const result = await db.run(
        `
      INSERT INTO files (project_id, filename, original_filename, file_path, file_size, mime_type, uploaded_by, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
        [
          projectId,
          file.filename,
          file.originalname,
          file.path,
          file.size,
          file.mimetype,
          req.user!.type,
          label
        ]
      );

      uploadedFiles.push({
        id: result.lastID,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        description: label
      });
    }

    res.status(201).json({
      message: `${files.length} file(s) uploaded successfully`,
      files: uploadedFiles
    });
  })
);

// Get messages for a project
router.get(
  '/:id/messages',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // Check if user can access this project
    let project;
    if (req.user!.type === 'admin') {
      project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    } else {
      project = await db.get('SELECT id FROM projects WHERE id = ? AND client_id = ?', [
        projectId,
        req.user!.id
      ]);
    }

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const messages = await db.all(
      `
    SELECT id, sender_type, sender_name, message, read_at, created_at
    FROM messages
    WHERE project_id = ?
    ORDER BY created_at ASC
  `,
      [projectId]
    );

    res.json({ messages });
  })
);

// Add message to project
router.post(
  '/:id/messages',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message content is required',
        code: 'MISSING_MESSAGE'
      });
    }

    const db = getDatabase();

    // Check if user can message on this project
    let project;
    if (req.user!.type === 'admin') {
      project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    } else {
      project = await db.get('SELECT id FROM projects WHERE id = ? AND client_id = ?', [
        projectId,
        req.user!.id
      ]);
    }

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    // Map 'admin' to 'developer' for messages table constraint compatibility
    // (messages table uses 'client', 'developer', 'system'; general_messages uses 'client', 'admin', 'system')
    const senderType = req.user!.type === 'admin' ? 'developer' : req.user!.type;

    const result = await db.run(
      `
    INSERT INTO messages (project_id, sender_type, sender_name, message)
    VALUES (?, ?, ?, ?)
  `,
      [
        projectId,
        senderType,
        req.user!.email, // or get actual name from user profile
        message.trim()
      ]
    );

    const newMessage = await db.get(
      `
    SELECT id, sender_type, sender_name, message, read_at, created_at
    FROM messages WHERE id = ?
  `,
      [result.lastID]
    );

    res.status(201).json({
      message: 'Message sent successfully',
      messageData: newMessage
    });
  })
);

// Mark messages as read
router.put(
  '/:id/messages/read',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // Check if user can access this project
    let project;
    if (req.user!.type === 'admin') {
      project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    } else {
      project = await db.get('SELECT id FROM projects WHERE id = ? AND client_id = ?', [
        projectId,
        req.user!.id
      ]);
    }

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    await db.run(
      `
    UPDATE messages 
    SET read_at = CURRENT_TIMESTAMP
    WHERE project_id = ? AND sender_type != ? AND read_at IS NULL
  `,
      [projectId, req.user!.type]
    );

    res.json({
      message: 'Messages marked as read'
    });
  })
);

// ===================================
// MILESTONE MANAGEMENT ENDPOINTS
// ===================================

// Get milestones for a project
router.get(
  '/:id/milestones',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // SECURITY: Always filter by client_id for non-admin users
    // Check admin status from database to ensure JWT wasn't tampered with
    let isAdmin = req.user!.type === 'admin';
    if (isAdmin && req.user!.id > 0) {
      const client = await db.get('SELECT is_admin FROM clients WHERE id = ?', [req.user!.id]);
      isAdmin = !!(client && client.is_admin === 1);
    }

    // Check if user can access this project
    let project;
    if (isAdmin) {
      project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    } else {
      project = await db.get('SELECT id FROM projects WHERE id = ? AND client_id = ?', [
        projectId,
        req.user!.id
      ]);
    }

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const milestones = await db.all(
      `
    SELECT
      m.id,
      m.title,
      m.description,
      m.due_date,
      m.completed_date,
      m.is_completed,
      m.deliverables,
      m.created_at,
      m.updated_at,
      COUNT(t.id) as task_count,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_task_count
    FROM milestones m
    LEFT JOIN project_tasks t ON m.id = t.milestone_id
    WHERE m.project_id = ?
    GROUP BY m.id
    ORDER BY m.due_date ASC, m.created_at ASC
  `,
      [projectId]
    );

    // Parse deliverables JSON and calculate progress
    milestones.forEach((milestone: any) => {
      const deliverablesStr = getString(milestone, 'deliverables');
      if (deliverablesStr) {
        try {
          milestone.deliverables = JSON.parse(deliverablesStr);
        } catch (_e) {
          milestone.deliverables = [];
        }
      } else {
        milestone.deliverables = [];
      }

      // Calculate progress percentage
      const taskCount = milestone.task_count || 0;
      const completedCount = milestone.completed_task_count || 0;
      milestone.progress_percentage = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;
    });

    res.json({ milestones });
  })
);

// Create new milestone (admin only)
router.post(
  '/:id/milestones',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const { title, description, due_date, deliverables = [] } = req.body;

    if (!title) {
      return res.status(400).json({
        error: 'Milestone title is required',
        code: 'MISSING_TITLE'
      });
    }

    const db = getDatabase();

    // Verify project exists
    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const result = await db.run(
      `
    INSERT INTO milestones (project_id, title, description, due_date, deliverables)
    VALUES (?, ?, ?, ?, ?)
  `,
      [projectId, title, description || null, due_date || null, JSON.stringify(deliverables)]
    );

    const newMilestone = await db.get(
      `
    SELECT id, title, description, due_date, completed_date, is_completed, 
           deliverables, created_at, updated_at
    FROM milestones WHERE id = ?
  `,
      [result.lastID]
    );

    if (!newMilestone) {
      return res.status(500).json({
        error: 'Milestone created but could not retrieve details',
        code: 'MILESTONE_CREATION_ERROR'
      });
    }

    // Parse deliverables JSON
    const newMilestoneDeliverablesStr = getString(newMilestone, 'deliverables');
    if (newMilestoneDeliverablesStr) {
      try {
        newMilestone.deliverables = JSON.parse(newMilestoneDeliverablesStr);
      } catch (_e) {
        newMilestone.deliverables = [];
      }
    } else {
      newMilestone.deliverables = [];
    }

    res.status(201).json({
      message: 'Milestone created successfully',
      milestone: newMilestone
    });
  })
);

// Update milestone (admin only)
router.put(
  '/:id/milestones/:milestoneId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const milestoneId = parseInt(req.params.milestoneId);
    const { title, description, due_date, deliverables, is_completed } = req.body;

    const db = getDatabase();

    // Verify milestone belongs to project
    const milestone = await db.get('SELECT * FROM milestones WHERE id = ? AND project_id = ?', [
      milestoneId,
      projectId
    ]);

    if (!milestone) {
      return res.status(404).json({
        error: 'Milestone not found',
        code: 'MILESTONE_NOT_FOUND'
      });
    }

    const updates: string[] = [];
    const values: (string | number | boolean | null)[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(due_date);
    }
    if (deliverables !== undefined) {
      updates.push('deliverables = ?');
      values.push(JSON.stringify(deliverables));
    }
    if (is_completed !== undefined) {
      updates.push('is_completed = ?');
      values.push(is_completed);

      if (is_completed && !milestone.is_completed) {
        // Mark as completed
        updates.push('completed_date = ?');
        values.push(new Date().toISOString());
      } else if (!is_completed && milestone.is_completed) {
        // Mark as incomplete
        updates.push('completed_date = ?');
        values.push(null);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update',
        code: 'NO_UPDATES'
      });
    }

    values.push(milestoneId);

    await db.run(
      `
    UPDATE milestones 
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
      values
    );

    const updatedMilestone = await db.get(
      `
    SELECT id, title, description, due_date, completed_date, is_completed, 
           deliverables, created_at, updated_at
    FROM milestones WHERE id = ?
  `,
      [milestoneId]
    );

    if (!updatedMilestone) {
      return res.status(500).json({
        error: 'Milestone updated but could not retrieve details',
        code: 'MILESTONE_UPDATE_ERROR'
      });
    }

    // Parse deliverables JSON
    const updatedMilestoneDeliverablesStr = getString(updatedMilestone, 'deliverables');
    if (updatedMilestoneDeliverablesStr) {
      try {
        updatedMilestone.deliverables = JSON.parse(updatedMilestoneDeliverablesStr);
      } catch (_e) {
        updatedMilestone.deliverables = [];
      }
    } else {
      updatedMilestone.deliverables = [];
    }

    res.json({
      message: 'Milestone updated successfully',
      milestone: updatedMilestone
    });
  })
);

// Delete milestone (admin only)
router.delete(
  '/:id/milestones/:milestoneId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const milestoneId = parseInt(req.params.milestoneId);
    const db = getDatabase();

    // Verify milestone belongs to project
    const milestone = await db.get('SELECT id FROM milestones WHERE id = ? AND project_id = ?', [
      milestoneId,
      projectId
    ]);

    if (!milestone) {
      return res.status(404).json({
        error: 'Milestone not found',
        code: 'MILESTONE_NOT_FOUND'
      });
    }

    await db.run('DELETE FROM milestones WHERE id = ?', [milestoneId]);

    res.json({
      message: 'Milestone deleted successfully'
    });
  })
);

// ===================================
// PROJECT UPDATES/TIMELINE ENDPOINTS
// ===================================

// Add project update (admin only)
router.post(
  '/:id/updates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const { title, description, update_type = 'general', author = 'Admin' } = req.body;

    if (!title) {
      return res.status(400).json({
        error: 'Update title is required',
        code: 'MISSING_TITLE'
      });
    }

    const db = getDatabase();

    // Verify project exists
    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const validUpdateTypes = ['progress', 'milestone', 'issue', 'resolution', 'general'];
    if (!validUpdateTypes.includes(update_type)) {
      return res.status(400).json({
        error: 'Invalid update type',
        code: 'INVALID_UPDATE_TYPE'
      });
    }

    // Look up user ID for author
    const authorUserId = await userService.getUserIdByEmailOrName(author);

    const result = await db.run(
      `
    INSERT INTO project_updates (project_id, title, description, update_type, author_user_id)
    VALUES (?, ?, ?, ?, ?)
  `,
      [projectId, title, description || null, update_type, authorUserId]
    );

    const newUpdate = await db.get(
      `
    SELECT pu.id, pu.title, pu.description, pu.update_type, u.display_name as author, pu.created_at
    FROM project_updates pu
    LEFT JOIN users u ON pu.author_user_id = u.id
    WHERE pu.id = ?
  `,
      [result.lastID]
    );

    res.status(201).json({
      message: 'Project update added successfully',
      update: newUpdate
    });
  })
);

// ===================================
// PROJECT DASHBOARD ENDPOINTS
// ===================================

// Get project dashboard data
router.get(
  '/:id/dashboard',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // Check if user can access this project
    let project;
    if (req.user!.type === 'admin') {
      project = await db.get(
        `
      SELECT p.*, c.company_name, c.contact_name, c.email as client_email
      FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE p.id = ?
    `,
        [projectId]
      );
    } else {
      project = await db.get(
        `
      SELECT * FROM projects 
      WHERE id = ? AND client_id = ?
    `,
        [projectId, req.user!.id]
      );
    }

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    // Get project statistics
    const stats = await db.get(
      `
    SELECT 
      COUNT(DISTINCT m.id) as total_milestones,
      COUNT(DISTINCT CASE WHEN m.is_completed = 1 THEN m.id END) as completed_milestones,
      COUNT(DISTINCT f.id) as total_files,
      COUNT(DISTINCT msg.id) as total_messages,
      COUNT(DISTINCT CASE WHEN msg.read_at IS NULL THEN msg.id END) as unread_messages,
      COUNT(DISTINCT u.id) as total_updates
    FROM projects p
    LEFT JOIN milestones m ON p.id = m.project_id
    LEFT JOIN files f ON p.id = f.project_id
    LEFT JOIN messages msg ON p.id = msg.project_id
    LEFT JOIN project_updates u ON p.id = u.project_id
    WHERE p.id = ?
  `,
      [projectId]
    );

    // Get recent milestones (next 3 upcoming)
    const upcomingMilestones = await db.all(
      `
    SELECT id, title, description, due_date, is_completed
    FROM milestones 
    WHERE project_id = ? AND is_completed = 0
    ORDER BY due_date ASC
    LIMIT 3
  `,
      [projectId]
    );

    // Get recent updates (last 5)
    const recentUpdates = await db.all(
      `
    SELECT id, title, description, update_type, author, created_at
    FROM project_updates
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT 5
  `,
      [projectId]
    );

    // Get recent messages (last 5)
    const recentMessages = await db.all(
      `
    SELECT id, sender_type, sender_name, message, read_at, created_at
    FROM messages
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT 5
  `,
      [projectId]
    );

    // Calculate progress percentage
    const totalMilestones = getNumber(stats, 'total_milestones');
    const completedMilestones = getNumber(stats, 'completed_milestones');
    const projectProgress = project ? getNumber(project, 'progress') : 0;
    const progressPercentage =
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : projectProgress || 0;

    res.json({
      project,
      stats,
      progressPercentage,
      upcomingMilestones,
      recentUpdates,
      recentMessages
    });
  })
);

/**
 * GET /api/projects/:id/contract/pdf
 * Generate PDF contract for a project
 */
router.get(
  '/:id/contract/pdf',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // Get project with client info
    const project = await db.get(
      `SELECT p.*, c.contact_name as client_name, c.email as client_email,
              c.company_name, c.phone as client_phone, c.address as client_address
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    // Check permissions - admin can access all, clients only their own
    if (req.user!.type !== 'admin' && getNumber(project, 'client_id') !== req.user!.id) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Cast project for helper functions
    const p = project as Record<string, unknown>;

    // Load latest contract draft (if any) for content and cache invalidation
    const contractRow = await db.get(
      `SELECT * FROM contracts WHERE project_id = ? AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );
    const contract = contractRow as Record<string, unknown> | undefined;
    const contractContent = contract ? getString(contract, 'content') : '';
    const contractStatus = contract ? getString(contract, 'status') : '';
    const contractUpdatedAt = contract ? getString(contract, 'updated_at') : undefined;

    const signedPdfPath = getString(p, 'contract_signed_pdf_path');
    if (signedPdfPath) {
      const cleanPath = signedPdfPath.replace(/^\//, '').replace(/^uploads\//, '');
      const absolutePath = path.resolve(getUploadsDir(), cleanPath);
      if (existsSync(absolutePath)) {
        const pdfBytes = readFileSync(absolutePath);
        const projectName = getString(project, 'project_name').replace(/[^a-zA-Z0-9]/g, '-');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="contract-${projectName}-${projectId}.pdf"`);
        res.setHeader('Content-Length', pdfBytes.length);
        res.setHeader('X-PDF-Cache', 'SIGNED');
        return res.send(Buffer.from(pdfBytes));
      }
    }

    // Check cache first
    const cacheKey = getPdfCacheKey('contract', projectId, contractUpdatedAt || getString(project, 'updated_at'));
    const cachedPdf = getCachedPdf(cacheKey);
    if (cachedPdf) {
      const projectName = getString(project, 'project_name').replace(/[^a-zA-Z0-9]/g, '-');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="contract-${projectName}-${projectId}.pdf"`);
      res.setHeader('Content-Length', cachedPdf.length);
      res.setHeader('X-PDF-Cache', 'HIT');
      return res.send(Buffer.from(cachedPdf));
    }

    // Helper function to format date
    const formatDate = (dateStr: string | undefined): string => {
      if (!dateStr) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    // Create PDF document using pdf-lib
    const pdfDoc = await PDFLibDocument.create();
    pdfDoc.setTitle(`Contract - ${getString(p, 'project_name')}`);
    pdfDoc.setAuthor(BUSINESS_INFO.name);

    const page = pdfDoc.addPage([612, 792]); // LETTER size
    const { width, height } = page.getSize();

    // Embed fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Layout constants (0.75 inch margins per template)
    const leftMargin = 54;
    const rightMargin = width - 54;
    const contentWidth = rightMargin - leftMargin;

    // Start from top - template uses 0.6 inch from top
    let y = height - 43;

    const isSigned = Boolean(getString(p, 'contract_signed_at') || (contract?.signed_at as string | undefined));
    const shouldWatermark = !isSigned;

    const drawDraftWatermark = (targetPage: PDFPage): void => {
      if (!shouldWatermark) return;
      const label = contractStatus === 'draft' || !contractStatus ? 'DRAFT' : 'UNSIGNED';
      const fontSize = 72;
      const textWidth = helveticaBold.widthOfTextAtSize(label, fontSize);
      targetPage.drawText(label, {
        x: (width - textWidth) / 2,
        y: height / 2,
        size: fontSize,
        font: helveticaBold,
        color: rgb(0.88, 0.88, 0.88),
        rotate: degrees(-20)
      });
    };

    const parseSignatureData = (data?: string): Uint8Array | null => {
      if (!data) return null;
      const match = data.match(/^data:image\/png;base64,(.+)$/);
      if (!match) return null;
      return Uint8Array.from(Buffer.from(match[1], 'base64'));
    };


    drawDraftWatermark(page);

    // === HEADER - Title on left, logo and business info on right ===
    const logoHeight = 100; // ~1.4 inch for prominent branding

    // CONTRACT title on left: 28pt
    const titleText = 'CONTRACT';
    page.drawText(titleText, {
      x: leftMargin, y: y - 20, size: 28, font: helveticaBold, color: rgb(0.15, 0.15, 0.15)
    });

    // Logo and business info on right (logo left of text, text left-aligned)
    let textStartX = rightMargin - 180;
    const logoBytes = getPdfLogoBytes();
    if (logoBytes) {
      const logoImage = await pdfDoc.embedPng(logoBytes);
      const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
      const logoX = rightMargin - logoWidth - 150;
      page.drawImage(logoImage, {
        x: logoX,
        y: y - logoHeight + 10,
        width: logoWidth,
        height: logoHeight
      });
      textStartX = logoX + logoWidth + 18;
    }

    // Business info (left-aligned, to right of logo)
    page.drawText(BUSINESS_INFO.name, { x: textStartX, y: y - 11, size: 15, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(BUSINESS_INFO.owner, { x: textStartX, y: y - 34, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(BUSINESS_INFO.tagline, { x: textStartX, y: y - 54, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(BUSINESS_INFO.email, { x: textStartX, y: y - 70, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(BUSINESS_INFO.website, { x: textStartX, y: y - 86, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

    y -= 120; // Account for 100pt logo height

    // Divider line
    page.drawLine({
      start: { x: leftMargin, y: y },
      end: { x: rightMargin, y: y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7)
    });
    y -= 21;

    // === CONTRACT INFO - Two columns ===
    const rightCol = width / 2 + 36;

    // Left side - Client Info
    page.drawText('Client:', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(getString(p, 'client_name') || 'Client', { x: leftMargin, y: y - 15, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    let clientLineY = y - 30;
    if (p.company_name) {
      page.drawText(String(p.company_name), { x: leftMargin, y: clientLineY, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      clientLineY -= 15;
    }
    page.drawText(getString(p, 'client_email') || '', { x: leftMargin, y: clientLineY, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });

    // Right side - Service Provider
    page.drawText('Service Provider:', { x: rightCol, y: y, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(BUSINESS_INFO.name, { x: rightCol, y: y - 15, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    page.drawText('Contract Date:', { x: rightCol, y: y - 45, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(formatDate(getString(p, 'contract_signed_at') || getString(p, 'created_at')), { x: rightCol, y: y - 60, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    y -= 90;

    const formatCurrency = (value?: string): string => {
      if (!value) return '';
      const numeric = Number(value);
      if (Number.isNaN(numeric)) return value;
      return numeric.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };

    const startDate = getString(p, 'start_date');
    const dueDate = getString(p, 'due_date');
    const timeline = getString(p, 'timeline');
    const projectType = getString(p, 'project_type');
    const description = getString(p, 'description');
    const price = getString(p, 'price');
    const depositAmount = getString(p, 'deposit_amount');

    const fallbackContent = [
      'CONTRACT AGREEMENT',
      '',
      `This Agreement is made on ${formatDate(getString(p, 'contract_signed_at') || getString(p, 'created_at'))} between ${BUSINESS_INFO.name} ("Service Provider") and ${getString(p, 'client_name') || 'Client'} ("Client").`,
      '',
      '1. Project Scope',
      `Project Name: ${getString(p, 'project_name')}`,
      projectType ? `Project Type: ${projectType.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}` : '',
      description ? `Description: ${description}` : '',
      '',
      '2. Timeline',
      startDate ? `Start Date: ${formatDate(startDate)}` : '',
      dueDate ? `Target Completion: ${formatDate(dueDate)}` : '',
      timeline ? `Estimated Timeline: ${timeline}` : '',
      '',
      '3. Payment Terms',
      price ? `Total Project Cost: ${formatCurrency(price)}` : '',
      depositAmount ? `Deposit Amount: ${formatCurrency(depositAmount)}` : '',
      'Payment is due according to the agreed milestones. Final payment is due upon project completion and client approval.',
      '',
      '4. Terms and Conditions',
      ...CONTRACT_TERMS.map((term) => `- ${term}`),
      '',
      '5. Contact',
      `Service Provider: ${BUSINESS_INFO.name}`,
      `Email: ${BUSINESS_INFO.email}`,
      `Website: ${BUSINESS_INFO.website}`,
      '',
      `Client: ${getString(p, 'client_name') || 'Client'}`,
      `Email: ${getString(p, 'client_email') || ''}`,
      `Company: ${getString(p, 'company_name') || ''}`
    ].join('\n');

    const contentSource = contractContent && contractContent.trim() ? contractContent : fallbackContent;
    const contentLines = contentSource.replace(/\r/g, '').split('\n');

    const ctx = {
      pdfDoc,
      currentPage: page,
      pageNumber: 1,
      y,
      width,
      height,
      leftMargin,
      rightMargin,
      topMargin: PAGE_MARGINS.top,
      bottomMargin: PAGE_MARGINS.bottom,
      contentWidth,
      fonts: {
        regular: helvetica,
        bold: helveticaBold
      }
    };

    const onNewPage = (nextCtx: typeof ctx): void => {
      drawDraftWatermark(nextCtx.currentPage);
    };

    for (const rawLine of contentLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        ctx.y -= 10;
        continue;
      }

      let text = trimmed;
      let font = helvetica;
      let fontSize = 10;
      let indent = 0;

      if (/^[-*]\s+/.test(text)) {
        indent = 12;
        text = text.replace(/^[-*]\s+/, '');
      }

      const isTitle = /^[A-Z][A-Z\s]{3,}$/.test(text);
      const isSection = /^\d+\.\s+/.test(text);

      if (isTitle) {
        font = helveticaBold;
        fontSize = 14;
      } else if (isSection) {
        font = helveticaBold;
        fontSize = 12;
      }

      drawWrappedText(ctx, text, {
        x: leftMargin + indent,
        fontSize,
        font,
        maxWidth: contentWidth - indent,
        onNewPage
      });

      ctx.y -= isTitle || isSection ? 6 : 2;
    }

    // === SIGNATURES ===
    ensureSpace(ctx, 120, onNewPage);
    ctx.currentPage.drawText('Signatures', { x: leftMargin, y: ctx.y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
    ctx.y -= 22;

    const signatureWidth = 200;
    const signatureLineY = ctx.y - 30;
    const signedDate = isSigned
      ? formatDate(getString(p, 'contract_signed_at') || (contract?.signed_at as string | undefined))
      : '______________';
    const countersignedAt = getString(p, 'contract_countersigned_at') || (contract?.countersigned_at as string | undefined);
    const countersignedDate = countersignedAt ? formatDate(countersignedAt) : '______________';

    const clientSignatureData = getString(p, 'contract_signature_data') || (contract ? getString(contract, 'signature_data') : '');
    const countersignatureData = getString(p, 'contract_countersignature_data') || (contract ? getString(contract, 'countersignature_data') : '');
    const clientSignatureBytes = parseSignatureData(clientSignatureData);
    const countersignatureBytes = parseSignatureData(countersignatureData);

    const signatureImageHeight = 40;
    const signatureImageWidth = 140;

    ctx.currentPage.drawText('Client:', { x: leftMargin, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    ctx.currentPage.drawLine({ start: { x: leftMargin, y: signatureLineY }, end: { x: leftMargin + signatureWidth, y: signatureLineY }, thickness: 1, color: rgb(0, 0, 0) });
    if (clientSignatureBytes) {
      const clientSignatureImage = await pdfDoc.embedPng(clientSignatureBytes);
      ctx.currentPage.drawImage(clientSignatureImage, {
        x: leftMargin + 8,
        y: signatureLineY + 6,
        width: signatureImageWidth,
        height: signatureImageHeight
      });
    }
    ctx.currentPage.drawText(getString(p, 'client_name') || 'Client Name', { x: leftMargin, y: signatureLineY - 15, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    ctx.currentPage.drawText(`Date: ${signedDate}`, { x: leftMargin, y: signatureLineY - 30, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    ctx.currentPage.drawText('Service Provider:', { x: rightCol, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    ctx.currentPage.drawLine({ start: { x: rightCol, y: signatureLineY }, end: { x: rightCol + signatureWidth, y: signatureLineY }, thickness: 1, color: rgb(0, 0, 0) });
    if (countersignatureBytes) {
      const countersignatureImage = await pdfDoc.embedPng(countersignatureBytes);
      ctx.currentPage.drawImage(countersignatureImage, {
        x: rightCol + 8,
        y: signatureLineY + 6,
        width: signatureImageWidth,
        height: signatureImageHeight
      });
    }
    ctx.currentPage.drawText(BUSINESS_INFO.name, { x: rightCol, y: signatureLineY - 15, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    ctx.currentPage.drawText(`Date: ${countersignedDate}`, { x: rightCol, y: signatureLineY - 30, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    // === FOOTERS ===
    const footerTerms = 'Standard terms and conditions apply.';
    const footerContact = `Questions? Contact us at ${BUSINESS_INFO.email}`;
    for (const footerPage of pdfDoc.getPages()) {
      const { width: footerWidth } = footerPage.getSize();
      const termsWidth = helvetica.widthOfTextAtSize(footerTerms, 8);
      const contactWidth = helvetica.widthOfTextAtSize(footerContact, 9);
      footerPage.drawText(footerTerms, {
        x: (footerWidth - termsWidth) / 2,
        y: 52,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5)
      });
      footerPage.drawText(footerContact, {
        x: (footerWidth - contactWidth) / 2,
        y: 40,
        size: 9,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4)
      });
    }

    await addPageNumbers(pdfDoc, { marginBottom: 30 });

    // Generate PDF bytes and send
    const pdfBytes = await pdfDoc.save();
    const projectName = getString(p, 'project_name').replace(/[^a-zA-Z0-9]/g, '-');

    const countersignedAtValue = getString(p, 'contract_countersigned_at') || (contract ? getString(contract, 'countersigned_at') : '');
    if (isSigned && countersignedAtValue && !signedPdfPath) {
      const contractsDir = getUploadsSubdir(UPLOAD_DIRS.CONTRACTS);
      const filename = sanitizeFilename(`contract-${projectName}-${projectId}.pdf`);
      const absolutePath = path.join(contractsDir, filename);
      writeFileSync(absolutePath, pdfBytes);
      const relativePath = getRelativePath(UPLOAD_DIRS.CONTRACTS, filename) as string;

      await db.run('UPDATE projects SET contract_signed_pdf_path = ? WHERE id = ?', [relativePath, projectId]);

      const latestContract = await db.get(
        `SELECT id FROM contracts WHERE project_id = ? AND status != 'cancelled'
         ORDER BY created_at DESC LIMIT 1`,
        [projectId]
      );

      if (latestContract) {
        await db.run('UPDATE contracts SET signed_pdf_path = ?, updated_at = datetime(\'now\') WHERE id = ?', [
          relativePath,
          (latestContract as Record<string, unknown>).id as number
        ]);
      }
    }

    // Cache the generated PDF
    cachePdf(cacheKey, pdfBytes, contractUpdatedAt || getString(p, 'updated_at'));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contract-${projectName}-${projectId}.pdf"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.setHeader('X-PDF-Cache', 'MISS');
    res.send(Buffer.from(pdfBytes));
  })
);

/**
 * POST /api/projects/:id/contract/request-signature
 * Request a contract signature from the client
 */
router.post(
  '/:id/contract/request-signature',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // Get project with client info
    const project = await db.get(
      `SELECT p.*, c.email as client_email, c.name as client_name
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const p = project as Record<string, unknown>;
    const clientEmail = p.client_email as string | null;
    const clientName = p.client_name as string | null;
    const projectName = p.project_name as string;

    if (!clientEmail) {
      return res.status(400).json({ error: 'No client email associated with this project' });
    }

    // Generate a signature token for the contract
    const crypto = await import('crypto');
    const signatureToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Token valid for 7 days

    // Store the signature request (dual-write: projects + contracts for rollback)
    await db.run(
      `UPDATE projects SET
        contract_signature_token = ?,
        contract_signature_requested_at = datetime('now'),
        contract_signature_expires_at = ?
       WHERE id = ?`,
      [signatureToken, expiresAt.toISOString(), projectId]
    );

    const latestContract = await db.get(
      `SELECT id FROM contracts WHERE project_id = ? AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );

    if (latestContract) {
      // Write signature request to contracts table (Phase 3.3 normalization)
      await db.run(
        `UPDATE contracts SET
          signature_token = ?,
          signature_requested_at = datetime('now'),
          signature_expires_at = ?,
          status = 'sent',
          sent_at = datetime('now'),
          expires_at = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
        [
          signatureToken,
          expiresAt.toISOString(),
          expiresAt.toISOString(),
          (latestContract as Record<string, unknown>).id as number
        ]
      );
    }

    // Log signature request to audit log
    await db.run(
      `INSERT INTO contract_signature_log (project_id, action, actor_email, details)
       VALUES (?, 'requested', ?, ?)`,
      [projectId, req.user?.email || 'admin', JSON.stringify({ clientEmail, expiresAt: expiresAt.toISOString() })]
    );

    // Generate signature URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const signatureUrl = `${baseUrl}/sign-contract.html?token=${signatureToken}`;
    const contractPreviewUrl = `${baseUrl}/api/projects/${projectId}/contract/pdf`;

    // Send email to client
    const { emailService } = await import('../services/email-service');
    const emailResult = await emailService.sendEmail({
      to: clientEmail,
      subject: `Contract Ready for Signature - ${projectName}`,
      text: `
Hi ${clientName || 'there'},

Your contract for "${projectName}" is ready for your signature.

Please review and sign the contract by clicking the link below:
${signatureUrl}

You can also preview the contract here:
${contractPreviewUrl}

This signature request expires on ${expiresAt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

If you have any questions about the contract, please don't hesitate to reach out.

Best regards,
${BUSINESS_INFO.name}
${BUSINESS_INFO.email}
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #00aff0; margin: 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 8px; }
    .btn { display: inline-block; padding: 14px 28px; background: #00aff0; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 5px 10px 0; }
    .btn-outline { background: transparent; border: 2px solid #00aff0; color: #00aff0; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 14px; }
    .deadline { background: #fff3cd; padding: 10px 15px; border-radius: 4px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${BUSINESS_INFO.name}</h1>
    </div>
    <div class="content">
      <p>Hi ${clientName || 'there'},</p>
      <p>Your contract for <strong>"${projectName}"</strong> is ready for your signature.</p>
      <p>Please review and sign the contract by clicking the button below:</p>
      <p style="text-align: center; margin: 25px 0;">
        <a href="${signatureUrl}" class="btn">Sign Contract</a>
        <a href="${contractPreviewUrl}" class="btn btn-outline">Preview Contract</a>
      </p>
      <div class="deadline">
        <strong>Deadline:</strong> This signature request expires on ${expiresAt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
      </div>
      <p>If you have any questions about the contract, please don't hesitate to reach out.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>${BUSINESS_INFO.name}<br>${BUSINESS_INFO.email}</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    });

    console.log(`[CONTRACT] Signature request sent for project ${projectId} to ${clientEmail}`);

    // Schedule contract reminders
    try {
      const scheduler = getSchedulerService();
      await scheduler.scheduleContractReminders(projectId);
    } catch (reminderError) {
      console.error('[CONTRACT] Failed to schedule contract reminders:', reminderError);
      // Continue - don't fail the request if reminder scheduling fails
    }

    res.json({
      success: true,
      message: 'Signature request sent',
      clientEmail,
      expiresAt: expiresAt.toISOString(),
      emailSent: emailResult.success
    });
  })
);

/**
 * GET /api/projects/contract/by-token/:token
 * Get contract details by signature token (PUBLIC - no auth required)
 */
router.get(
  '/contract/by-token/:token',
  asyncHandler(async (req: express.Request, res: Response) => {
    const { token } = req.params;
    const db = getDatabase();

    const project = await db.get(
      `SELECT p.id, p.project_name, p.price, p.contract_signature_expires_at,
              p.contract_signed_at, c.name as client_name, c.email as client_email
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.contract_signature_token = ?`,
      [token]
    );

    if (!project) {
      return res.status(404).json({ error: 'Invalid or expired signature link' });
    }

    const p = project as Record<string, unknown>;
    const expiresAt = p.contract_signature_expires_at as string | null;

    // Check if token is expired
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return res.status(410).json({ error: 'This signature link has expired. Please request a new one.' });
    }

    // Check if already signed
    if (p.contract_signed_at) {
      return res.status(400).json({ error: 'This contract has already been signed.' });
    }

    // Log view
    const projectId = p.id as number;
    await db.run(
      `INSERT INTO contract_signature_log (project_id, action, actor_ip, actor_user_agent)
       VALUES (?, 'viewed', ?, ?)`,
      [projectId, req.ip || 'unknown', req.get('user-agent') || 'unknown']
    );

    const latestContract = await db.get(
      `SELECT id, status FROM contracts WHERE project_id = ? AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );

    if (latestContract && (latestContract as Record<string, unknown>).status !== 'signed') {
      await db.run(
        `UPDATE contracts SET status = 'viewed', updated_at = datetime('now') WHERE id = ?`,
        [(latestContract as Record<string, unknown>).id as number]
      );
    }

    res.json({
      projectId: projectId,
      projectName: p.project_name,
      price: p.price,
      clientName: p.client_name,
      clientEmail: p.client_email,
      expiresAt: expiresAt,
      contractPdfUrl: `/api/projects/${projectId}/contract/pdf`
    });
  })
);

/**
 * POST /api/projects/contract/sign-by-token/:token
 * Sign contract using token (PUBLIC - no auth required)
 */
router.post(
  '/contract/sign-by-token/:token',
  asyncHandler(async (req: express.Request, res: Response) => {
    const { token } = req.params;
    const { signatureData, signerName, agreedToTerms } = req.body;
    const db = getDatabase();

    if (!signatureData || !signerName) {
      return res.status(400).json({ error: 'Signature and name are required' });
    }

    if (!agreedToTerms) {
      return res.status(400).json({ error: 'You must agree to the terms to sign' });
    }

    // Get project by token
    const project = await db.get(
      `SELECT p.id, p.project_name, p.contract_signature_expires_at, p.contract_signed_at,
              c.name as client_name, c.email as client_email
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.contract_signature_token = ?`,
      [token]
    );

    if (!project) {
      return res.status(404).json({ error: 'Invalid or expired signature link' });
    }

    const p = project as Record<string, unknown>;
    const projectId = p.id as number;
    const expiresAt = p.contract_signature_expires_at as string | null;
    const clientEmail = p.client_email as string;
    const clientName = p.client_name as string;
    const projectName = p.project_name as string;

    // Check if token is expired
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return res.status(410).json({ error: 'This signature link has expired. Please request a new one.' });
    }

    // Check if already signed
    if (p.contract_signed_at) {
      return res.status(400).json({ error: 'This contract has already been signed.' });
    }

    const signerIp = req.ip || req.socket.remoteAddress || 'unknown';
    const signerUserAgent = req.get('user-agent') || 'unknown';
    const signedAt = new Date().toISOString();

    // Update the project with signature
    await db.run(
      `UPDATE projects SET
        contract_signed_at = ?,
        contract_signature_token = NULL,
        contract_signature_expires_at = NULL,
        contract_signer_name = ?,
        contract_signer_email = ?,
        contract_signer_ip = ?,
        contract_signer_user_agent = ?,
        contract_signature_data = ?
       WHERE id = ?`,
      [signedAt, signerName, clientEmail, signerIp, signerUserAgent, signatureData, projectId]
    );

    const latestContract = await db.get(
      `SELECT id FROM contracts WHERE project_id = ? AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );

    if (latestContract) {
      const contractId = (latestContract as Record<string, unknown>).id as number;
      // Clear signature token and update signature data (Phase 3.3 normalization)
      await db.run(
        `UPDATE contracts SET
          status = 'signed',
          signed_at = ?,
          signature_token = NULL,
          signature_expires_at = NULL,
          signer_name = ?,
          signer_email = ?,
          signer_ip = ?,
          signer_user_agent = ?,
          signature_data = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
        [signedAt, signerName, clientEmail, signerIp, signerUserAgent, signatureData, contractId]
      );
    }

    // Log signature to audit log (include contract_id for Phase 3.3)
    const contractId = latestContract ? (latestContract as Record<string, unknown>).id as number : null;
    await db.run(
      `INSERT INTO contract_signature_log (project_id, contract_id, action, actor_email, actor_ip, actor_user_agent, details)
       VALUES (?, ?, 'signed', ?, ?, ?, ?)`,
      [projectId, contractId, clientEmail, signerIp, signerUserAgent, JSON.stringify({ signerName, signedAt })]
    );

    // Send confirmation email to client
    const { emailService } = await import('../services/email-service');
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    await emailService.sendEmail({
      to: clientEmail,
      subject: `Contract Signed - ${projectName}`,
      text: `
Hi ${clientName || signerName},

Thank you for signing the contract for "${projectName}".

Signature Details:
- Signed by: ${signerName}
- Date/Time: ${new Date(signedAt).toLocaleString()}
- IP Address: ${signerIp}

You can download a copy of the signed contract here:
${baseUrl}/api/projects/${projectId}/contract/pdf

We're excited to get started on your project! We'll be in touch soon with next steps.

Best regards,
${BUSINESS_INFO.name}
${BUSINESS_INFO.email}
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #00aff0; margin: 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 8px; }
    .success { background: #d4edda; padding: 15px; border-radius: 6px; text-align: center; margin-bottom: 20px; }
    .success h2 { color: #155724; margin: 0; }
    .details { background: white; padding: 15px; border-radius: 4px; margin: 20px 0; }
    .details table { width: 100%; }
    .details td { padding: 8px 0; }
    .details td:first-child { color: #666; }
    .btn { display: inline-block; padding: 14px 28px; background: #00aff0; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${BUSINESS_INFO.name}</h1>
    </div>
    <div class="content">
      <div class="success">
        <h2>Contract Signed Successfully</h2>
      </div>
      <p>Hi ${clientName || signerName},</p>
      <p>Thank you for signing the contract for <strong>"${projectName}"</strong>.</p>
      <div class="details">
        <table>
          <tr><td>Signed by:</td><td><strong>${signerName}</strong></td></tr>
          <tr><td>Date/Time:</td><td>${new Date(signedAt).toLocaleString()}</td></tr>
          <tr><td>IP Address:</td><td>${signerIp}</td></tr>
        </table>
      </div>
      <p style="text-align: center; margin: 25px 0;">
        <a href="${baseUrl}/api/projects/${projectId}/contract/pdf" class="btn">Download Contract</a>
      </p>
      <p>We're excited to get started on your project! We'll be in touch soon with next steps.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>${BUSINESS_INFO.name}<br>${BUSINESS_INFO.email}</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    });

    // Send notification to admin
    await emailService.sendEmail({
      to: BUSINESS_INFO.email,
      subject: `[Signed] Contract for ${projectName}`,
      text: `Contract signed for "${projectName}" by ${signerName} (${clientEmail}) from IP ${signerIp} at ${new Date(signedAt).toLocaleString()}.`,
      html: `<p>Contract signed for <strong>"${projectName}"</strong> by ${signerName} (${clientEmail}) from IP ${signerIp} at ${new Date(signedAt).toLocaleString()}.</p>`
    });

    console.log(`[CONTRACT] Contract signed for project ${projectId} by ${signerName}`);

    // Cancel pending contract reminders since contract is now signed
    try {
      const scheduler = getSchedulerService();
      await scheduler.cancelContractReminders(projectId);
    } catch (reminderError) {
      console.error('[CONTRACT] Failed to cancel contract reminders:', reminderError);
      // Continue - don't fail the signing if reminder cancellation fails
    }

    res.json({
      success: true,
      message: 'Contract signed successfully',
      signedAt,
      signerName
    });
  })
);

/**
 * POST /api/projects/:id/contract/countersign
 * Countersign a contract (ADMIN ONLY)
 */
router.post(
  '/:id/contract/countersign',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const { signatureData, signerName } = req.body;
    const db = getDatabase();

    if (!signerName) {
      return res.status(400).json({ error: 'Signer name is required' });
    }

    const project = await db.get(
      `SELECT id, project_name, contract_signed_at
       FROM projects
       WHERE id = ?`,
      [projectId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const p = project as Record<string, unknown>;

    if (!p.contract_signed_at) {
      return res.status(400).json({ error: 'Client signature is required before countersigning.' });
    }

    const countersignedAt = new Date().toISOString();
    const countersignerIp = req.ip || req.socket.remoteAddress || 'unknown';
    const countersignerUserAgent = req.get('user-agent') || 'unknown';
    const countersignerEmail = req.user?.email || 'admin';

    await db.run(
      `UPDATE projects SET
        contract_countersigned_at = ?,
        contract_countersigner_name = ?,
        contract_countersigner_email = ?,
        contract_countersigner_ip = ?,
        contract_countersigner_user_agent = ?,
        contract_countersignature_data = ?
       WHERE id = ?`,
      [countersignedAt, signerName, countersignerEmail, countersignerIp, countersignerUserAgent, signatureData || null, projectId]
    );

    const latestContract = await db.get(
      `SELECT id FROM contracts WHERE project_id = ? AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );

    if (latestContract) {
      await db.run(
        `UPDATE contracts SET
          status = 'signed',
          countersigned_at = ?,
          countersigner_name = ?,
          countersigner_email = ?,
          countersigner_ip = ?,
          countersigner_user_agent = ?,
          countersignature_data = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
        [countersignedAt, signerName, countersignerEmail, countersignerIp, countersignerUserAgent, signatureData || null, (latestContract as Record<string, unknown>).id]
      );
    }

    await db.run(
      `INSERT INTO contract_signature_log (project_id, action, actor_email, actor_ip, actor_user_agent, details)
       VALUES (?, 'countersigned', ?, ?, ?, ?)`,
      [projectId, countersignerEmail, countersignerIp, countersignerUserAgent, JSON.stringify({ signerName, countersignedAt })]
    );

    res.json({
      success: true,
      message: 'Contract countersigned successfully',
      countersignedAt,
      signerName
    });
  })
);

/**
 * GET /api/projects/:id/contract/signature-status
 * Get contract signature status for a project
 */
router.get(
  '/:id/contract/signature-status',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    const project = await db.get(
      `SELECT contract_signed_at, contract_signature_requested_at, contract_signature_expires_at,
              contract_signer_name, contract_signer_email, contract_signer_ip,
              contract_countersigned_at, contract_countersigner_name, contract_countersigner_email,
              contract_countersigner_ip, contract_signed_pdf_path
       FROM projects WHERE id = ?`,
      [projectId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const p = project as Record<string, unknown>;

    res.json({
      isSigned: !!p.contract_signed_at,
      signedAt: p.contract_signed_at,
      signerName: p.contract_signer_name,
      signerEmail: p.contract_signer_email,
      signerIp: p.contract_signer_ip,
      requestedAt: p.contract_signature_requested_at,
      expiresAt: p.contract_signature_expires_at,
      countersignedAt: p.contract_countersigned_at,
      countersignerName: p.contract_countersigner_name,
      countersignerEmail: p.contract_countersigner_email,
      countersignerIp: p.contract_countersigner_ip,
      signedPdfPath: p.contract_signed_pdf_path
    });
  })
);

// ============================================
// INTAKE PDF GENERATION (using pdf-lib)
// ============================================

interface IntakeDocument {
  submittedAt: string;
  projectId: number;
  projectName: string;
  createdBy?: string;
  clientInfo: {
    name: string;
    email: string;
    projectFor?: string;
    companyName?: string | null;
  };
  projectDetails: {
    type: string;
    description: string;
    timeline: string;
    budget: string;
    features?: string[];
    designLevel?: string | null;
  };
  technicalInfo?: {
    techComfort?: string | null;
    domainHosting?: string | null;
  };
  additionalInfo?: string | null;
}

/**
 * GET /api/projects/:id/intake/pdf
 * Generate a branded PDF from the project's intake form using pdf-lib
 */
router.get(
  '/:id/intake/pdf',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // Get project with client info
    const project = await db.get(
      `SELECT p.*, c.contact_name as client_name, c.email as client_email, c.company_name
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const p = project as Record<string, unknown>;

    // Authorization: admin or project owner
    const projectClientId = getNumber(p, 'client_id');
    if (req.user!.type !== 'admin' && req.user!.id !== projectClientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Find the intake file for this project
    const intakeFile = await db.get(
      `SELECT * FROM files
       WHERE project_id = ?
       AND (original_filename LIKE '%intake%' OR filename LIKE 'intake_%' OR filename LIKE 'admin_project_%' OR filename LIKE 'project_intake_%' OR filename LIKE 'nobhadcodes_intake_%')
       AND mime_type = 'application/json'
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId]
    );

    if (!intakeFile) {
      return res.status(404).json({ error: 'Intake form not found for this project' });
    }

    // Check cache first (use intake file's updated_at for freshness)
    const intakeFileRecord = intakeFile as Record<string, unknown>;
    const cacheKey = getPdfCacheKey('intake', projectId, getString(intakeFileRecord, 'updated_at') || getString(intakeFileRecord, 'created_at'));
    const cachedPdf = getCachedPdf(cacheKey);
    if (cachedPdf) {
      const clientOrCompany = getString(p, 'company_name') || getString(p, 'client_name');
      const safeClientName = clientOrCompany
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_-]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="nobhadcodes_intake_${safeClientName}.pdf"`);
      res.setHeader('Content-Length', cachedPdf.length);
      res.setHeader('X-PDF-Cache', 'HIT');
      return res.send(Buffer.from(cachedPdf));
    }

    // Read the intake JSON file
    const filePath = join(process.cwd(), getString(intakeFileRecord, 'file_path'));
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Intake file not found on disk' });
    }

    let intakeData: IntakeDocument;
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      intakeData = JSON.parse(fileContent);
    } catch {
      return res.status(500).json({ error: 'Failed to read intake file' });
    }

    // Helper functions
    const formatDate = (dateStr: string | undefined): string => {
      if (!dateStr) return 'N/A';
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    };

    const formatTimeline = (timeline: string): string => {
      const timelineMap: Record<string, string> = {
        'asap': 'As Soon As Possible',
        '1-month': '1 Month',
        '1-3-months': '1-3 Months',
        '3-6-months': '3-6 Months',
        'flexible': 'Flexible'
      };
      return timelineMap[timeline] || timeline;
    };

    const formatBudget = (budget: string): string => {
      const budgetMap: Record<string, string> = {
        'under-2k': 'Under $2,000',
        '2k-5k': '$2,000 - $5,000',
        '2.5k-5k': '$2,500 - $5,000',
        '5k-10k': '$5,000 - $10,000',
        '10k-25k': '$10,000 - $25,000',
        '25k+': '$25,000+'
      };
      return budgetMap[budget] || budget;
    };

    const formatProjectType = (type: string): string => {
      const typeMap: Record<string, string> = {
        'simple-site': 'Simple Website',
        'business-site': 'Business Website',
        'portfolio': 'Portfolio Website',
        'e-commerce': 'E-commerce Store',
        'ecommerce': 'E-commerce Store',
        'web-app': 'Web Application',
        'browser-extension': 'Browser Extension',
        'other': 'Custom Project'
      };
      return typeMap[type] || type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const decodeHtml = (text: string): string => {
      return text
        .replace(/&amp;/g, '&')
        .replace(/&#x2F;/g, '/')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    };

    // Create PDF document using pdf-lib
    const pdfDoc = await PDFLibDocument.create();

    // Set PDF metadata for proper title in browser tab
    const pdfClientName = getString(p, 'company_name') || getString(p, 'client_name') || 'Client';
    const pdfTitle = `NoBhadCodes Intake - ${pdfClientName}`;
    pdfDoc.setTitle(pdfTitle);
    pdfDoc.setAuthor(BUSINESS_INFO.name);
    pdfDoc.setSubject('Project Intake Form');
    pdfDoc.setCreator('NoBhadCodes');

    const page = pdfDoc.addPage([612, 792]); // LETTER size
    const { width, height } = page.getSize();

    // Embed fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Colors
    const black = rgb(0, 0, 0);
    const gray = rgb(0.2, 0.2, 0.2);
    const lightGray = rgb(0.5, 0.5, 0.5);
    const lineGray = rgb(0.8, 0.8, 0.8);

    // Layout constants (matching template: 0.75 inch margins)
    const leftMargin = 54; // 0.75 inch
    const rightMargin = width - 54;
    const contentWidth = rightMargin - leftMargin;

    // pdf-lib uses bottom-left origin, so we work from top down
    // Y position decreases as we go down the page
    let y = height - 43; // Start ~0.6 inch from top (matching template)

    // === HEADER - Title on left, logo and business info on right ===
    const logoHeight = 100;

    // INTAKE title on left: 28pt
    const titleText = 'INTAKE';
    page.drawText(titleText, {
      x: leftMargin,
      y: y - 20,
      size: 28,
      font: helveticaBold,
      color: rgb(0.15, 0.15, 0.15)
    });

    // Logo and business info on right (logo left of text, text left-aligned)
    let textStartX = rightMargin - 180;
    const intakeLogoBytes = getPdfLogoBytes();
    if (intakeLogoBytes) {
      const logoImage = await pdfDoc.embedPng(intakeLogoBytes);
      const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
      const logoX = rightMargin - logoWidth - 150;
      page.drawImage(logoImage, {
        x: logoX,
        y: y - logoHeight + 10,
        width: logoWidth,
        height: logoHeight
      });
      textStartX = logoX + logoWidth + 18;
    }

    // Business info (left-aligned, to right of logo)
    page.drawText(BUSINESS_INFO.name, { x: textStartX, y: y - 11, size: 15, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(BUSINESS_INFO.owner, { x: textStartX, y: y - 34, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(BUSINESS_INFO.tagline, { x: textStartX, y: y - 54, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(BUSINESS_INFO.email, { x: textStartX, y: y - 70, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(BUSINESS_INFO.website, { x: textStartX, y: y - 86, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

    y -= 120; // Account for 100pt logo height

    // === DIVIDER LINE ===
    page.drawLine({
      start: { x: leftMargin, y: y },
      end: { x: rightMargin, y: y },
      thickness: 1,
      color: lineGray
    });
    y -= 21; // 0.3 inch gap

    // === PREPARED FOR (left) and DATE/PROJECT (right) ===
    const detailsX = width / 2 + 36; // Middle + 0.5 inch

    // Left side - PREPARED FOR:
    page.drawText('PREPARED FOR:', {
      x: leftMargin,
      y: y,
      size: 11,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    });

    // Client name (bold)
    page.drawText(decodeHtml(intakeData.clientInfo.name), {
      x: leftMargin,
      y: y - 14,
      size: 10,
      font: helveticaBold,
      color: black
    });

    // Company name (if exists)
    let clientLineY = y - 25;
    if (intakeData.clientInfo.companyName) {
      page.drawText(decodeHtml(intakeData.clientInfo.companyName), {
        x: leftMargin,
        y: clientLineY,
        size: 10,
        font: helvetica,
        color: black
      });
      clientLineY -= 11;
    }

    // Email
    page.drawText(intakeData.clientInfo.email, {
      x: leftMargin,
      y: clientLineY,
      size: 10,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3)
    });

    // Right side - DATE:
    page.drawText('DATE:', {
      x: detailsX,
      y: y,
      size: 9,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3)
    });
    page.drawText(formatDate(intakeData.submittedAt), {
      x: rightMargin - helvetica.widthOfTextAtSize(formatDate(intakeData.submittedAt), 9),
      y: y,
      size: 9,
      font: helvetica,
      color: black
    });

    // PROJECT #:
    page.drawText('PROJECT #:', {
      x: detailsX,
      y: y - 14,
      size: 9,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3)
    });
    const projectIdText = `#${intakeData.projectId}`;
    page.drawText(projectIdText, {
      x: rightMargin - helvetica.widthOfTextAtSize(projectIdText, 9),
      y: y - 14,
      size: 9,
      font: helvetica,
      color: black
    });

    y -= 72; // Move past client info section (1.0 inch)

    // === CONTENT AREA SEPARATOR (light line) ===
    page.drawLine({
      start: { x: leftMargin, y: y },
      end: { x: rightMargin, y: y },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9)
    });
    y -= 21;

    // Helper to sanitize text for PDF (remove newlines and special chars)
    const sanitizeForPdf = (text: string): string => {
      return text.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    };

    // === PROJECT DETAILS ===
    page.drawText('Project Details', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: black });
    y -= 20;

    // Project Name
    page.drawText('Project Name: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
    const nameX = leftMargin + helveticaBold.widthOfTextAtSize('Project Name: ', 10);
    page.drawText(sanitizeForPdf(decodeHtml(intakeData.projectName)), { x: nameX, y: y, size: 10, font: helvetica, color: black });
    y -= 16;

    // Project Type
    page.drawText('Project Type: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
    const typeX = leftMargin + helveticaBold.widthOfTextAtSize('Project Type: ', 10);
    page.drawText(sanitizeForPdf(formatProjectType(intakeData.projectDetails.type)), { x: typeX, y: y, size: 10, font: helvetica, color: black });
    y -= 16;

    // Timeline
    page.drawText('Timeline: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
    const timelineX = leftMargin + helveticaBold.widthOfTextAtSize('Timeline: ', 10);
    page.drawText(sanitizeForPdf(formatTimeline(intakeData.projectDetails.timeline)), { x: timelineX, y: y, size: 10, font: helvetica, color: black });
    y -= 16;

    // Budget
    page.drawText('Budget: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
    const budgetX = leftMargin + helveticaBold.widthOfTextAtSize('Budget: ', 10);
    page.drawText(sanitizeForPdf(formatBudget(intakeData.projectDetails.budget)), { x: budgetX, y: y, size: 10, font: helvetica, color: black });
    y -= 30;

    // === PROJECT DESCRIPTION ===
    page.drawText('Project Description', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: black });
    y -= 18;

    // Word wrap description text
    const description = sanitizeForPdf(decodeHtml(intakeData.projectDetails.description || 'No description provided'));
    const words = description.split(' ');
    let line = '';
    const maxWidth = contentWidth;
    const lineHeight = 14;

    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const testWidth = helvetica.widthOfTextAtSize(testLine, 10);
      if (testWidth > maxWidth && line) {
        page.drawText(line, { x: leftMargin, y: y, size: 10, font: helvetica, color: black });
        y -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: leftMargin, y: y, size: 10, font: helvetica, color: black });
      y -= lineHeight;
    }
    y -= 15;

    // === FEATURES (if any) ===
    if (intakeData.projectDetails.features && intakeData.projectDetails.features.length > 0) {
      page.drawText('Requested Features', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: black });
      y -= 18;

      for (const feature of intakeData.projectDetails.features) {
        const featureText = sanitizeForPdf(decodeHtml(`•  ${feature.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`));
        page.drawText(featureText, { x: leftMargin, y: y, size: 10, font: helvetica, color: black });
        y -= 14;
      }
      y -= 10;
    }

    // === TECHNICAL INFO (if any) ===
    if (intakeData.technicalInfo && (intakeData.technicalInfo.techComfort || intakeData.technicalInfo.domainHosting)) {
      page.drawText('Technical Information', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: black });
      y -= 18;

      if (intakeData.technicalInfo.techComfort) {
        page.drawText('Technical Comfort: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
        const tcX = leftMargin + helveticaBold.widthOfTextAtSize('Technical Comfort: ', 10);
        page.drawText(sanitizeForPdf(decodeHtml(intakeData.technicalInfo.techComfort)), { x: tcX, y: y, size: 10, font: helvetica, color: black });
        y -= 14;
      }
      if (intakeData.technicalInfo.domainHosting) {
        page.drawText('Domain/Hosting: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
        const dhX = leftMargin + helveticaBold.widthOfTextAtSize('Domain/Hosting: ', 10);
        page.drawText(sanitizeForPdf(decodeHtml(intakeData.technicalInfo.domainHosting)), { x: dhX, y: y, size: 10, font: helvetica, color: black });
        y -= 14;
      }
    }

    // === FOOTER - always at bottom of page 1 ===
    // Footer separator line
    page.drawLine({
      start: { x: leftMargin, y: 72 }, // 1 inch from bottom
      end: { x: rightMargin, y: 72 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8)
    });

    // Footer contact info (centered with bullet separators)
    const footerText = `${BUSINESS_INFO.name} • ${BUSINESS_INFO.owner} • ${BUSINESS_INFO.email} • ${BUSINESS_INFO.website}`;
    const footerWidth = helvetica.widthOfTextAtSize(footerText, 7);
    page.drawText(footerText, {
      x: (width - footerWidth) / 2,
      y: 36, // 0.5 inch from bottom
      size: 7,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5)
    });

    // Generate PDF bytes and send response
    const pdfBytes = await pdfDoc.save();

    // Cache the generated PDF
    cachePdf(cacheKey, pdfBytes, getString(intakeFileRecord, 'updated_at') || getString(intakeFileRecord, 'created_at'));

    // Generate descriptive PDF filename with NoBhadCodes branding
    // Use company name if available, otherwise client name
    const clientOrCompany = getString(p, 'company_name') || getString(p, 'client_name');
    const safeClientName = clientOrCompany
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="nobhadcodes_intake_${safeClientName}.pdf"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.setHeader('X-PDF-Cache', 'MISS');
    res.send(Buffer.from(pdfBytes));
  })
);

// ===================================
// TASK MANAGEMENT ENDPOINTS
// ===================================

// Get tasks for a project
router.get(
  '/:id/tasks',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // Check access
    let project;
    if (req.user!.type === 'admin') {
      project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    } else {
      project = await db.get('SELECT id FROM projects WHERE id = ? AND client_id = ?', [
        projectId,
        req.user!.id
      ]);
    }

    if (!project) {
      return res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
    }

    const { status, assignedTo, milestoneId, includeSubtasks } = req.query;

    type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';
    const validStatuses: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled', 'blocked'];
    const statusFilter = status && validStatuses.includes(status as TaskStatus)
      ? status as TaskStatus
      : undefined;

    const tasks = await projectService.getTasks(projectId, {
      status: statusFilter,
      assignedTo: assignedTo as string | undefined,
      milestoneId: milestoneId ? parseInt(milestoneId as string) : undefined,
      includeSubtasks: includeSubtasks === 'true'
    });

    res.json({ tasks });
  })
);

// Create task
router.post(
  '/:id/tasks',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
    }

    const task = await projectService.createTask(projectId, req.body);
    res.status(201).json({ message: 'Task created successfully', task });
  })
);

// Get single task
router.get(
  '/tasks/:taskId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    const task = await projectService.getTask(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found', code: 'TASK_NOT_FOUND' });
    }

    // Check access
    const db = getDatabase();
    if (req.user!.type !== 'admin') {
      const project = await db.get('SELECT id FROM projects WHERE id = ? AND client_id = ?', [
        task.projectId,
        req.user!.id
      ]);
      if (!project) {
        return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
      }
    }

    res.json({ task });
  })
);

// Update task
router.put(
  '/tasks/:taskId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    const task = await projectService.updateTask(taskId, req.body);
    res.json({ message: 'Task updated successfully', task });
  })
);

// Delete task
router.delete(
  '/tasks/:taskId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    await projectService.deleteTask(taskId);
    res.json({ message: 'Task deleted successfully' });
  })
);

// Complete task
router.post(
  '/tasks/:taskId/complete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    const task = await projectService.completeTask(taskId);
    res.json({ message: 'Task completed successfully', task });
  })
);

// Move task
router.post(
  '/tasks/:taskId/move',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    const { position, milestoneId } = req.body;

    await projectService.moveTask(taskId, position, milestoneId);
    res.json({ message: 'Task moved successfully' });
  })
);

// ===================================
// TASK DEPENDENCIES ENDPOINTS
// ===================================

// Add dependency
router.post(
  '/tasks/:taskId/dependencies',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    const { dependsOnTaskId, type } = req.body;

    if (!dependsOnTaskId) {
      return res.status(400).json({ error: 'dependsOnTaskId is required', code: 'MISSING_DEPENDENCY' });
    }

    const dependency = await projectService.addDependency(taskId, dependsOnTaskId, type);
    res.status(201).json({ message: 'Dependency added successfully', dependency });
  })
);

// Remove dependency
router.delete(
  '/tasks/:taskId/dependencies/:dependsOnTaskId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    const dependsOnTaskId = parseInt(req.params.dependsOnTaskId);

    await projectService.removeDependency(taskId, dependsOnTaskId);
    res.json({ message: 'Dependency removed successfully' });
  })
);

// Get blocked tasks for a project
router.get(
  '/:id/tasks/blocked',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessProject(req, projectId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const tasks = await projectService.getBlockedTasks(projectId);
    res.json({ tasks });
  })
);

// ===================================
// TASK COMMENTS ENDPOINTS
// ===================================

// Get comments for a task
router.get(
  '/tasks/:taskId/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessTask(req, taskId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const comments = await projectService.getTaskComments(taskId);
    res.json({ comments });
  })
);

// Add comment to task
router.post(
  '/tasks/:taskId/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    const { content } = req.body;

    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessTask(req, taskId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    if (!content) {
      return res.status(400).json({ error: 'Comment content is required', code: 'MISSING_CONTENT' });
    }

    const comment = await projectService.addTaskComment(
      taskId,
      req.user!.email,
      content
    );
    res.status(201).json({ message: 'Comment added successfully', comment });
  })
);

// Delete comment
router.delete(
  '/tasks/comments/:commentId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const commentId = parseInt(req.params.commentId);
    await projectService.deleteTaskComment(commentId);
    res.json({ message: 'Comment deleted successfully' });
  })
);

// ===================================
// TASK CHECKLIST ENDPOINTS
// ===================================

// Add checklist item
router.post(
  '/tasks/:taskId/checklist',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Checklist item content is required', code: 'MISSING_CONTENT' });
    }

    const item = await projectService.addChecklistItem(taskId, content);
    res.status(201).json({ message: 'Checklist item added successfully', item });
  })
);

// Toggle checklist item
router.post(
  '/tasks/checklist/:itemId/toggle',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const itemId = parseInt(req.params.itemId);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid checklist item ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessChecklistItem(req, itemId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const item = await projectService.toggleChecklistItem(itemId);
    res.json({ message: 'Checklist item toggled', item });
  })
);

// Delete checklist item
router.delete(
  '/tasks/checklist/:itemId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const itemId = parseInt(req.params.itemId);
    await projectService.deleteChecklistItem(itemId);
    res.json({ message: 'Checklist item deleted successfully' });
  })
);

// ===================================
// TIME TRACKING ENDPOINTS
// ===================================

// Get time entries for a project
router.get(
  '/:id/time-entries',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // Check access
    let project;
    if (req.user!.type === 'admin') {
      project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    } else {
      project = await db.get('SELECT id FROM projects WHERE id = ? AND client_id = ?', [
        projectId,
        req.user!.id
      ]);
    }

    if (!project) {
      return res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
    }

    const { startDate, endDate, userName, taskId } = req.query;

    const entries = await projectService.getTimeEntries(projectId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      userName: userName as string | undefined,
      taskId: taskId ? parseInt(taskId as string) : undefined
    });

    // Transform to frontend format (hours -> duration_minutes, billable -> is_billable)
    const transformedEntries = entries.map((entry) => ({
      ...entry,
      duration_minutes: Math.round((entry.hours || 0) * 60),
      is_billable: entry.billable === true,
      hourly_rate: entry.hourlyRate || null,
      user_email: entry.userName || 'admin',
      user_name: entry.userName || 'Admin'
    }));

    res.json({ entries: transformedEntries });
  })
);

// Log time entry
router.post(
  '/:id/time-entries',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
    }

    // Support both frontend format (duration_minutes, is_billable) and legacy format (hours, billable)
    const {
      userName,
      hours,
      duration_minutes,
      date,
      description,
      is_billable,
      billable,
      hourly_rate,
      hourlyRate,
      task_id,
      taskId
    } = req.body;

    // Calculate hours from duration_minutes if provided, otherwise use hours
    const calculatedHours = duration_minutes ? duration_minutes / 60 : hours;

    // Use authenticated user if userName not provided
    const effectiveUserName = userName || req.user?.email || 'admin';

    if (!calculatedHours || !date) {
      return res.status(400).json({
        error: 'hours (or duration_minutes) and date are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Normalize the data for the service
    const normalizedData = {
      userName: effectiveUserName,
      hours: calculatedHours,
      date,
      description: description || null,
      billable: is_billable !== undefined ? is_billable : (billable !== undefined ? billable : true),
      hourlyRate: hourly_rate || hourlyRate || null,
      taskId: task_id || taskId || null
    };

    const entry = await projectService.logTime(projectId, normalizedData);
    res.status(201).json({ message: 'Time logged successfully', entry });
  })
);

// Update time entry
router.put(
  '/:id/time-entries/:entryId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const entryId = parseInt(req.params.entryId);

    // Support both frontend format and legacy format
    const {
      hours,
      duration_minutes,
      date,
      description,
      is_billable,
      billable,
      hourly_rate,
      hourlyRate,
      task_id,
      taskId
    } = req.body;

    // Calculate hours from duration_minutes if provided
    const calculatedHours = duration_minutes !== undefined ? duration_minutes / 60 : hours;

    // Normalize the data for the service
    const normalizedData: Record<string, unknown> = {};
    if (calculatedHours !== undefined) normalizedData.hours = calculatedHours;
    if (date !== undefined) normalizedData.date = date;
    if (description !== undefined) normalizedData.description = description;
    if (is_billable !== undefined) normalizedData.billable = is_billable;
    else if (billable !== undefined) normalizedData.billable = billable;
    if (hourly_rate !== undefined) normalizedData.hourlyRate = hourly_rate;
    else if (hourlyRate !== undefined) normalizedData.hourlyRate = hourlyRate;
    if (task_id !== undefined) normalizedData.taskId = task_id;
    else if (taskId !== undefined) normalizedData.taskId = taskId;

    const entry = await projectService.updateTimeEntry(entryId, normalizedData);
    res.json({ message: 'Time entry updated successfully', entry });
  })
);

// Delete time entry
router.delete(
  '/:id/time-entries/:entryId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const entryId = parseInt(req.params.entryId);
    await projectService.deleteTimeEntry(entryId);
    res.json({ message: 'Time entry deleted successfully' });
  })
);

// Get project time statistics
router.get(
  '/:id/time-stats',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const stats = await projectService.getProjectTimeStats(projectId);
    res.json({ stats });
  })
);

// Get team time report
router.get(
  '/reports/team-time',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDate and endDate are required',
        code: 'MISSING_DATE_RANGE'
      });
    }

    const report = await projectService.getTeamTimeReport(
      startDate as string,
      endDate as string
    );
    res.json({ report });
  })
);

// ===================================
// TEMPLATE ENDPOINTS
// ===================================

// Get all templates
router.get(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { projectType } = req.query;
    const templates = await projectService.getTemplates(projectType as string | undefined);
    res.json({ templates });
  })
);

// Get single template
router.get(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const templateId = parseInt(req.params.templateId);
    const template = await projectService.getTemplate(templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found', code: 'TEMPLATE_NOT_FOUND' });
    }

    res.json({ template });
  })
);

// Create template
router.post(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Template name is required', code: 'MISSING_NAME' });
    }

    const template = await projectService.createTemplate(req.body);
    res.status(201).json({ message: 'Template created successfully', template });
  })
);

// Create project from template
router.post(
  '/from-template',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { templateId, clientId, projectName, startDate } = req.body;

    if (!templateId || !clientId || !projectName || !startDate) {
      return res.status(400).json({
        error: 'templateId, clientId, projectName, and startDate are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const result = await projectService.createProjectFromTemplate(
      templateId,
      clientId,
      projectName,
      startDate
    );

    res.status(201).json({
      message: 'Project created from template successfully',
      projectId: result.projectId,
      milestoneIds: result.milestoneIds,
      taskIds: result.taskIds
    });
  })
);

// ===================================
// PROJECT HEALTH ENDPOINTS
// ===================================

// Get project health
router.get(
  '/:id/health',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const health = await projectService.calculateProjectHealth(projectId);
    res.json({ health });
  })
);

// Get project burndown
router.get(
  '/:id/burndown',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const burndown = await projectService.getProjectBurndown(projectId);
    res.json({ burndown });
  })
);

// Get project velocity
router.get(
  '/:id/velocity',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const velocity = await projectService.getProjectVelocity(projectId);
    res.json({ velocity });
  })
);

// ===================================
// PROJECT TAGS ENDPOINTS
// ===================================

// Get tags for a project
router.get(
  '/:id/tags',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const tags = await projectService.getProjectTags(projectId);
    res.json({ tags });
  })
);

// Add tag to project
router.post(
  '/:id/tags/:tagId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const tagId = parseInt(req.params.tagId);

    await projectService.addTagToProject(projectId, tagId);
    res.status(201).json({ message: 'Tag added to project successfully' });
  })
);

// Remove tag from project
router.delete(
  '/:id/tags/:tagId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const tagId = parseInt(req.params.tagId);

    await projectService.removeTagFromProject(projectId, tagId);
    res.json({ message: 'Tag removed from project successfully' });
  })
);

// ===================================
// PROJECT ARCHIVE ENDPOINTS
// ===================================

// Archive project
router.post(
  '/:id/archive',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    await projectService.archiveProject(projectId);
    res.json({ message: 'Project archived successfully' });
  })
);

// Unarchive project
router.post(
  '/:id/unarchive',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    await projectService.unarchiveProject(projectId);
    res.json({ message: 'Project unarchived successfully' });
  })
);

// ===================================
// FILE MANAGEMENT ENHANCEMENT ENDPOINTS
// ===================================

// ---------------
// FILE VERSIONS
// ---------------

// Get versions of a file
router.get(
  '/files/:fileId/versions',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const versions = await fileService.getVersions(fileId);
    res.json({ versions });
  })
);

// Upload new version
router.post(
  '/files/:fileId/versions',
  authenticateToken,
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const file = req.file;

    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded', code: 'NO_FILE' });
    }

    const { comment } = req.body;
    const version = await fileService.uploadNewVersion(fileId, {
      filename: file.filename,
      original_filename: file.originalname,
      file_path: file.path,
      file_size: file.size,
      mime_type: file.mimetype,
      uploaded_by: req.user!.email,
      comment
    });

    res.status(201).json({ version });
  })
);

// Restore a previous version
router.post(
  '/files/:fileId/versions/:versionId/restore',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const versionId = parseInt(req.params.versionId);
    const version = await fileService.restoreVersion(fileId, versionId);
    res.json({ message: 'Version restored', version });
  })
);

// ---------------
// FOLDERS
// ---------------

// Get folders for a project
router.get(
  '/:id/folders',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const parentId = req.query.parent_id ? parseInt(req.query.parent_id as string) : undefined;
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessProject(req, projectId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const folders = await fileService.getFolders(projectId, parentId);
    res.json({ folders });
  })
);

// Create a folder
router.post(
  '/:id/folders',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const { name, description, parent_folder_id, color, icon } = req.body;

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessProject(req, projectId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Folder name is required', code: 'MISSING_NAME' });
    }

    const folder = await fileService.createFolder(projectId, {
      name: name.trim(),
      description,
      parent_folder_id,
      color,
      icon,
      created_by: req.user!.email
    });

    res.status(201).json({ folder });
  })
);

// Update a folder
router.put(
  '/folders/:folderId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const folderId = parseInt(req.params.folderId);
    const { name, description, color, icon, sort_order } = req.body;
    if (isNaN(folderId)) {
      return res.status(400).json({ error: 'Invalid folder ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFolder(req, folderId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const folder = await fileService.updateFolder(folderId, { name, description, color, icon, sort_order });
    res.json({ folder });
  })
);

// Delete a folder
router.delete(
  '/folders/:folderId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const folderId = parseInt(req.params.folderId);
    const moveFilesTo = req.query.move_files_to ? parseInt(req.query.move_files_to as string) : undefined;
    await fileService.deleteFolder(folderId, moveFilesTo);
    res.json({ message: 'Folder deleted' });
  })
);

// Move a file to a folder
router.post(
  '/files/:fileId/move',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const { folder_id } = req.body;
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    await fileService.moveFile(fileId, folder_id || null);
    res.json({ message: 'File moved' });
  })
);

// Move a folder
router.post(
  '/folders/:folderId/move',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const folderId = parseInt(req.params.folderId);
    const { parent_folder_id } = req.body;
    if (isNaN(folderId)) {
      return res.status(400).json({ error: 'Invalid folder ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFolder(req, folderId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    await fileService.moveFolder(folderId, parent_folder_id || null);
    res.json({ message: 'Folder moved' });
  })
);

// ---------------
// FILE TAGS
// ---------------

// Get tags for a file
router.get(
  '/files/:fileId/tags',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const tags = await fileService.getFileTags(fileId);
    res.json({ tags });
  })
);

// Add tag to a file
router.post(
  '/files/:fileId/tags/:tagId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const tagId = parseInt(req.params.tagId);
    if (isNaN(fileId) || isNaN(tagId)) {
      return res.status(400).json({ error: 'Invalid file or tag ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    await fileService.addTag(fileId, tagId);
    res.json({ message: 'Tag added' });
  })
);

// Remove tag from a file
router.delete(
  '/files/:fileId/tags/:tagId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const tagId = parseInt(req.params.tagId);
    if (isNaN(fileId) || isNaN(tagId)) {
      return res.status(400).json({ error: 'Invalid file or tag ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    await fileService.removeTag(fileId, tagId);
    res.json({ message: 'Tag removed' });
  })
);

// Get files by tag
router.get(
  '/:id/files/by-tag/:tagId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const tagId = parseInt(req.params.tagId);
    if (isNaN(projectId) || isNaN(tagId)) {
      return res.status(400).json({ error: 'Invalid project or tag ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessProject(req, projectId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const files = await fileService.getFilesByTag(projectId, tagId);
    res.json({ files });
  })
);

// ---------------
// ACCESS TRACKING
// ---------------

// Log file access (called when file is viewed/downloaded)
router.post(
  '/files/:fileId/access',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const { access_type } = req.body;

    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    if (!access_type || !['view', 'download', 'preview'].includes(access_type)) {
      return res.status(400).json({ error: 'Invalid access type', code: 'INVALID_ACCESS_TYPE' });
    }

    await fileService.logAccess(
      fileId,
      req.user!.email,
      req.user!.type as 'admin' | 'client',
      access_type,
      req.ip,
      req.get('User-Agent')
    );
    res.json({ message: 'Access logged' });
  })
);

// Get access log for a file (admin only)
router.get(
  '/files/:fileId/access-log',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const log = await fileService.getAccessLog(fileId, limit);
    res.json({ access_log: log });
  })
);

// Get access stats for a file
router.get(
  '/files/:fileId/access-stats',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const stats = await fileService.getAccessStats(fileId);
    res.json({ stats });
  })
);

// ---------------
// FILE COMMENTS
// ---------------

// Get comments for a file
router.get(
  '/files/:fileId/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const includeInternal = req.user!.type === 'admin';
    const comments = await fileService.getComments(fileId, includeInternal);
    res.json({ comments });
  })
);

// Add comment to a file
router.post(
  '/files/:fileId/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const { content, is_internal, parent_comment_id, author_name } = req.body;

    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required', code: 'MISSING_CONTENT' });
    }

    const comment = await fileService.addComment(
      fileId,
      req.user!.email,
      req.user!.type as 'admin' | 'client',
      content.trim(),
      author_name || req.user!.email,
      is_internal && req.user!.type === 'admin',
      parent_comment_id
    );

    res.status(201).json({ comment });
  })
);

// Delete a comment
router.delete(
  '/files/comments/:commentId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const commentId = parseInt(req.params.commentId);
    if (isNaN(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFileComment(req, commentId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    await fileService.deleteComment(commentId);
    res.json({ message: 'Comment deleted' });
  })
);

// ---------------
// ARCHIVING & EXPIRATION
// ---------------

// Archive a file
router.post(
  '/files/:fileId/archive',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    await fileService.archiveFile(fileId, req.user!.email);
    res.json({ message: 'File archived' });
  })
);

// Restore a file from archive
router.post(
  '/files/:fileId/restore',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    await fileService.restoreFile(fileId);
    res.json({ message: 'File restored' });
  })
);

// Get archived files for a project
router.get(
  '/:id/files/archived',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessProject(req, projectId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const files = await fileService.getArchivedFiles(projectId);
    res.json({ files });
  })
);

// Set file expiration
router.put(
  '/files/:fileId/expiration',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const { expires_at } = req.body;
    await fileService.setExpiration(fileId, expires_at || null);
    res.json({ message: 'Expiration set' });
  })
);

// Get files expiring soon
router.get(
  '/files/expiring-soon',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const daysAhead = req.query.days ? parseInt(req.query.days as string) : 7;
    const files = await fileService.getExpiringFiles(daysAhead);
    res.json({ files });
  })
);

// Process expired files (admin batch operation)
router.post(
  '/files/process-expired',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const count = await fileService.processExpiredFiles();
    res.json({ message: `Processed ${count} expired files`, count });
  })
);

// ---------------
// FILE LOCKING
// ---------------

// Lock a file
router.post(
  '/files/:fileId/lock',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    await fileService.lockFile(fileId, req.user!.email);
    res.json({ message: 'File locked' });
  })
);

// Unlock a file
router.post(
  '/files/:fileId/unlock',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const isAdmin = req.user!.type === 'admin';
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    await fileService.unlockFile(fileId, req.user!.email, isAdmin);
    res.json({ message: 'File unlocked' });
  })
);

// ---------------
// FILE CATEGORY
// ---------------

// Set file category
router.put(
  '/files/:fileId/category',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const { category } = req.body;

    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessFile(req, fileId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const validCategories = ['general', 'deliverable', 'source', 'asset', 'document', 'contract', 'invoice'];
    if (!category || !validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category', code: 'INVALID_CATEGORY' });
    }

    await fileService.setCategory(fileId, category);
    res.json({ message: 'Category set' });
  })
);

// Get files by category
router.get(
  '/:id/files/by-category/:category',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const category = req.params.category as 'general' | 'deliverable' | 'source' | 'asset' | 'document' | 'contract' | 'invoice';
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessProject(req, projectId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const files = await fileService.getFilesByCategory(projectId, category);
    res.json({ files });
  })
);

// ---------------
// FILE STATISTICS & SEARCH
// ---------------

// Get file statistics for a project
router.get(
  '/:id/files/stats',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessProject(req, projectId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const stats = await fileService.getFileStats(projectId);
    res.json({ stats });
  })
);

// Search files
router.get(
  '/:id/files/search',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const query = req.query.q as string;

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID', code: 'INVALID_ID' });
    }

    if (!(await canAccessProject(req, projectId))) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required', code: 'MISSING_QUERY' });
    }

    const files = await fileService.searchFiles(projectId, query.trim(), {
      folder_id: req.query.folder_id ? parseInt(req.query.folder_id as string) : undefined,
      category: req.query.category as any,
      include_archived: req.query.include_archived === 'true',
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50
    });

    res.json({ files, count: files.length });
  })
);

// ===================================
// TASK PRIORITY ESCALATION
// ===================================

/**
 * Escalate task priorities based on due date proximity
 * POST /api/projects/:id/tasks/escalate-priorities
 * Admin only - escalates priorities for tasks in a specific project
 */
router.post(
  '/:id/tasks/escalate-priorities',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const preview = req.query.preview === 'true';

    // Verify project exists
    const db = getDatabase();
    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
    }

    if (preview) {
      // Preview mode - show what would be escalated
      const result = await previewEscalation(projectId);
      return res.json({
        preview: true,
        ...result
      });
    }

    // Execute escalation
    const result = await escalateTaskPriorities(projectId);

    res.json({
      success: true,
      message: `Escalated ${result.updatedCount} task(s)`,
      ...result
    });
  })
);

/**
 * Get escalation summary for a project
 * GET /api/projects/:id/tasks/escalation-summary
 * Admin only - shows task distribution and what would be escalated
 */
router.get(
  '/:id/tasks/escalation-summary',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);

    // Verify project exists
    const db = getDatabase();
    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
    }

    const summary = await getEscalationSummary(projectId);

    res.json({
      projectId,
      ...summary
    });
  })
);

export { router as projectsRouter };
export default router;
