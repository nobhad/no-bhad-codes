/**
 * ===============================================
 * PROJECT ROUTES
 * ===============================================
 * Project management, files, and messages endpoints
 */

import express, { Response } from 'express';
import multer from 'multer';
import path, { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { PDFDocument as PDFLibDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
import { getDatabase } from '../database/init.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { emailService } from '../services/email-service.js';
import { cache, invalidateCache } from '../middleware/cache.js';
import { getUploadsSubdir, UPLOAD_DIRS, sanitizeFilename } from '../config/uploads.js';
import { getString, getNumber } from '../database/row-helpers.js';
import { projectService } from '../services/project-service.js';
import { fileService } from '../services/file-service.js';

const router = express.Router();

// Business info from environment variables
const BUSINESS_INFO = {
  name: process.env.BUSINESS_NAME || 'No Bhad Codes',
  owner: process.env.BUSINESS_OWNER || 'Noelle Bhaduri',
  contact: process.env.BUSINESS_CONTACT || 'Noelle Bhaduri',
  tagline: process.env.BUSINESS_TAGLINE || 'Web Development & Design',
  email: process.env.BUSINESS_EMAIL || 'nobhaduri@gmail.com',
  website: process.env.BUSINESS_WEBSITE || 'nobhad.codes'
};

// Debug log for business info (remove after verification)
console.log('[Projects Route] BUSINESS_INFO loaded:', BUSINESS_INFO);

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

    if (req.user!.type === 'admin') {
      // Admin can see all projects with stats in single query (fixes N+1)
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
      JOIN clients c ON p.client_id = c.id
      LEFT JOIN (
        SELECT project_id, COUNT(*) as file_count
        FROM files
        GROUP BY project_id
      ) f_stats ON p.id = f_stats.project_id
      LEFT JOIN (
        SELECT project_id,
               COUNT(*) as message_count,
               SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_count
        FROM messages
        GROUP BY project_id
      ) m_stats ON p.id = m_stats.project_id
      ORDER BY p.created_at DESC
    `;
    } else {
      // Client can only see their own projects with stats in single query (fixes N+1)
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
               SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_count
        FROM messages
        GROUP BY project_id
      ) m_stats ON p.id = m_stats.project_id
      WHERE p.client_id = ?
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
      JOIN clients c ON p.client_id = c.id
      WHERE p.id = ?
    `;
    } else {
      query = `
      SELECT p.* FROM projects p
      WHERE p.id = ? AND p.client_id = ?
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
    SELECT id, sender_type, sender_name, message, is_read, created_at
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

    for (const file of files) {
      const result = await db.run(
        `
      INSERT INTO files (project_id, filename, original_filename, file_path, file_size, mime_type, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
        [
          projectId,
          file.filename,
          file.originalname,
          file.path,
          file.size,
          file.mimetype,
          req.user!.type
        ]
      );

      uploadedFiles.push({
        id: result.lastID,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype
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
    SELECT id, sender_type, sender_name, message, is_read, created_at
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

    const result = await db.run(
      `
    INSERT INTO messages (project_id, sender_type, sender_name, message)
    VALUES (?, ?, ?, ?)
  `,
      [
        projectId,
        req.user!.type,
        req.user!.email, // or get actual name from user profile
        message.trim()
      ]
    );

    const newMessage = await db.get(
      `
    SELECT id, sender_type, sender_name, message, is_read, created_at
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
    SET is_read = 1 
    WHERE project_id = ? AND sender_type != ?
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

    const milestones = await db.all(
      `
    SELECT id, title, description, due_date, completed_date, is_completed, 
           deliverables, created_at, updated_at
    FROM milestones 
    WHERE project_id = ?
    ORDER BY due_date ASC, created_at ASC
  `,
      [projectId]
    );

    // Parse deliverables JSON
    milestones.forEach((milestone) => {
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

    const result = await db.run(
      `
    INSERT INTO project_updates (project_id, title, description, update_type, author)
    VALUES (?, ?, ?, ?, ?)
  `,
      [projectId, title, description || null, update_type, author]
    );

    const newUpdate = await db.get(
      `
    SELECT id, title, description, update_type, author, created_at
    FROM project_updates WHERE id = ?
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
      COUNT(DISTINCT CASE WHEN msg.is_read = 0 THEN msg.id END) as unread_messages,
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
    SELECT id, sender_type, sender_name, message, is_read, created_at
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

    // === HEADER - Title on left, logo and business info on right ===
    const logoPath = join(process.cwd(), 'public/images/avatar_pdf.png');
    const logoHeight = 100; // ~1.4 inch for prominent branding

    // CONTRACT title on left: 28pt
    const titleText = 'CONTRACT';
    page.drawText(titleText, {
      x: leftMargin, y: y - 20, size: 28, font: helveticaBold, color: rgb(0.15, 0.15, 0.15)
    });

    // Logo and business info on right (logo left of text, text left-aligned)
    let textStartX = rightMargin - 180;
    if (existsSync(logoPath)) {
      const logoBytes = readFileSync(logoPath);
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

    // === 1. PROJECT SCOPE ===
    page.drawText('1. Project Scope', { x: leftMargin, y: y, size: 14, font: helveticaBold, color: rgb(0, 0, 0) });
    y -= 18;

    page.drawText('Project Name:', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    page.drawText(getString(p, 'project_name'), { x: leftMargin + 85, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    y -= 15;

    const projectType = getString(p, 'project_type');
    if (projectType) {
      page.drawText('Project Type:', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
      page.drawText(projectType.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()), { x: leftMargin + 80, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      y -= 15;
    }

    const description = getString(p, 'description');
    if (description) {
      page.drawText('Description:', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
      y -= 12;
      // Simple text wrapping for description
      const words = description.split(' ');
      let line = '';
      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        if (helvetica.widthOfTextAtSize(testLine, 10) > contentWidth - 20) {
          page.drawText(line, { x: leftMargin + 10, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
          y -= 12;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        page.drawText(line, { x: leftMargin + 10, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
        y -= 12;
      }
    }

    y -= 15;

    // === 2. TIMELINE ===
    page.drawText('2. Timeline', { x: leftMargin, y: y, size: 14, font: helveticaBold, color: rgb(0, 0, 0) });
    y -= 18;

    const startDate = getString(p, 'start_date');
    const dueDate = getString(p, 'due_date');
    const timeline = getString(p, 'timeline');

    if (startDate) {
      page.drawText('Start Date:', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
      page.drawText(formatDate(startDate), { x: leftMargin + 70, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      y -= 15;
    }
    if (dueDate) {
      page.drawText('Target Completion:', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
      page.drawText(formatDate(dueDate), { x: leftMargin + 110, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      y -= 15;
    }
    if (timeline) {
      page.drawText('Estimated Timeline:', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
      page.drawText(timeline, { x: leftMargin + 115, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      y -= 15;
    }

    y -= 15;

    // === 3. PAYMENT TERMS ===
    page.drawText('3. Payment Terms', { x: leftMargin, y: y, size: 14, font: helveticaBold, color: rgb(0, 0, 0) });
    y -= 18;

    const price = getString(p, 'price');
    const depositAmount = getString(p, 'deposit_amount');

    if (price) {
      page.drawText('Total Project Cost:', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
      page.drawText(`$${parseFloat(price).toLocaleString()}`, { x: leftMargin + 110, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      y -= 15;
    }
    if (depositAmount) {
      page.drawText('Deposit Amount:', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
      page.drawText(`$${parseFloat(depositAmount).toLocaleString()}`, { x: leftMargin + 100, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      y -= 15;
    }

    y -= 5;
    page.drawText('Payment is due according to the agreed milestones. Final payment is due upon', { x: leftMargin, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    y -= 12;
    page.drawText('project completion and client approval.', { x: leftMargin, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    y -= 25;

    // === 4. TERMS AND CONDITIONS ===
    page.drawText('4. Terms and Conditions', { x: leftMargin, y: y, size: 14, font: helveticaBold, color: rgb(0, 0, 0) });
    y -= 18;

    const terms = [
      '1. All work will be performed in a professional manner and according to industry standards.',
      '2. Client agrees to provide timely feedback and necessary materials to avoid project delays.',
      '3. Changes to the scope of work may require additional time and cost adjustments.',
      '4. Client retains ownership of all final deliverables upon full payment.',
      '5. Service Provider retains the right to showcase the completed project in their portfolio.'
    ];

    for (const term of terms) {
      page.drawText(term, { x: leftMargin + 10, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      y -= 15;
    }

    y -= 20;

    // === 5. SIGNATURES ===
    page.drawText('5. Signatures', { x: leftMargin, y: y, size: 14, font: helveticaBold, color: rgb(0, 0, 0) });
    y -= 30;

    const signatureWidth = 200;

    // Client signature
    page.drawText('Client:', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: leftMargin, y: y - 40 }, end: { x: leftMargin + signatureWidth, y: y - 40 }, thickness: 1, color: rgb(0, 0, 0) });
    page.drawText(getString(p, 'client_name') || 'Client Name', { x: leftMargin, y: y - 55, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    page.drawText('Date: _______________', { x: leftMargin, y: y - 70, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    // Service provider signature
    page.drawText('Service Provider:', { x: rightCol, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: rightCol, y: y - 40 }, end: { x: rightCol + signatureWidth, y: y - 40 }, thickness: 1, color: rgb(0, 0, 0) });
    page.drawText(BUSINESS_INFO.name, { x: rightCol, y: y - 55, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    page.drawText('Date: _______________', { x: rightCol, y: y - 70, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    // === FOOTER ===
    const footerText = `Questions? Contact us at ${BUSINESS_INFO.email}`;
    const footerWidth = helvetica.widthOfTextAtSize(footerText, 9);
    page.drawText(footerText, { x: (width - footerWidth) / 2, y: 40, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

    // Generate PDF bytes and send
    const pdfBytes = await pdfDoc.save();
    const projectName = getString(p, 'project_name').replace(/[^a-zA-Z0-9]/g, '-');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contract-${projectName}-${projectId}.pdf"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.send(Buffer.from(pdfBytes));
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

    // Read the intake JSON file
    const filePath = join(process.cwd(), getString(intakeFile as Record<string, unknown>, 'file_path'));
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
    const logoPath = join(process.cwd(), 'public/images/avatar_pdf.png');

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
    if (existsSync(logoPath)) {
      const logoBytes = readFileSync(logoPath);
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
    page.drawText(intakeData.clientInfo.name, {
      x: leftMargin,
      y: y - 14,
      size: 10,
      font: helveticaBold,
      color: black
    });

    // Company name (if exists)
    let clientLineY = y - 25;
    if (intakeData.clientInfo.companyName) {
      page.drawText(intakeData.clientInfo.companyName, {
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

    // === PROJECT DETAILS ===
    page.drawText('Project Details', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: black });
    y -= 20;

    // Project Name
    page.drawText('Project Name: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
    const nameX = leftMargin + helveticaBold.widthOfTextAtSize('Project Name: ', 10);
    page.drawText(intakeData.projectName, { x: nameX, y: y, size: 10, font: helvetica, color: black });
    y -= 16;

    // Project Type
    page.drawText('Project Type: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
    const typeX = leftMargin + helveticaBold.widthOfTextAtSize('Project Type: ', 10);
    page.drawText(formatProjectType(intakeData.projectDetails.type), { x: typeX, y: y, size: 10, font: helvetica, color: black });
    y -= 16;

    // Timeline
    page.drawText('Timeline: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
    const timelineX = leftMargin + helveticaBold.widthOfTextAtSize('Timeline: ', 10);
    page.drawText(formatTimeline(intakeData.projectDetails.timeline), { x: timelineX, y: y, size: 10, font: helvetica, color: black });
    y -= 16;

    // Budget
    page.drawText('Budget: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
    const budgetX = leftMargin + helveticaBold.widthOfTextAtSize('Budget: ', 10);
    page.drawText(formatBudget(intakeData.projectDetails.budget), { x: budgetX, y: y, size: 10, font: helvetica, color: black });
    y -= 30;

    // === PROJECT DESCRIPTION ===
    page.drawText('Project Description', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: black });
    y -= 18;

    // Word wrap description text
    const description = decodeHtml(intakeData.projectDetails.description || 'No description provided');
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
        const featureText = `•  ${feature.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
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
        page.drawText(intakeData.technicalInfo.techComfort, { x: tcX, y: y, size: 10, font: helvetica, color: black });
        y -= 14;
      }
      if (intakeData.technicalInfo.domainHosting) {
        page.drawText('Domain/Hosting: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
        const dhX = leftMargin + helveticaBold.widthOfTextAtSize('Domain/Hosting: ', 10);
        page.drawText(intakeData.technicalInfo.domainHosting, { x: dhX, y: y, size: 10, font: helvetica, color: black });
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

    res.json({ entries });
  })
);

// Log time entry
router.post(
  '/:id/time-entries',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
    }

    const { userName, hours, date } = req.body;
    if (!userName || !hours || !date) {
      return res.status(400).json({
        error: 'userName, hours, and date are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const entry = await projectService.logTime(projectId, req.body);
    res.status(201).json({ message: 'Time logged successfully', entry });
  })
);

// Update time entry
router.put(
  '/time-entries/:entryId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const entryId = parseInt(req.params.entryId);
    const entry = await projectService.updateTimeEntry(entryId, req.body);
    res.json({ message: 'Time entry updated successfully', entry });
  })
);

// Delete time entry
router.delete(
  '/time-entries/:entryId',
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

export { router as projectsRouter };
export default router;
