/**
 * ===============================================
 * PROJECT ROUTES
 * ===============================================
 * Project management, files, and messages endpoints
 */

import express from 'express';
import multer from 'multer';
import path, { join } from 'path';
import { existsSync } from 'fs';
import PDFDocument from 'pdfkit';
import { getDatabase } from '../database/init.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { emailService } from '../services/email-service.js';
import { cache, invalidateCache } from '../middleware/cache.js';
import { getUploadsSubdir, UPLOAD_DIRS } from '../config/uploads.js';
import { getString, getNumber } from '../database/row-helpers.js';

const router = express.Router();

// Business info from environment variables
const BUSINESS_INFO = {
  name: process.env.BUSINESS_NAME || '',
  contact: process.env.BUSINESS_CONTACT || '',
  email: process.env.BUSINESS_EMAIL || '',
  website: process.env.BUSINESS_WEBSITE || ''
};

// Configure multer for file uploads using centralized config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadsSubdir(UPLOAD_DIRS.PROJECTS));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueSuffix + path.extname(file.originalname));
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
    SELECT id, sender_role, sender_name, message, is_read, created_at
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
    SELECT id, sender_role, sender_name, message, is_read, created_at
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
    SELECT id, sender_role, sender_name, message, is_read, created_at
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
    SELECT id, sender_role, sender_name, message, is_read, created_at
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

    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });

    // Set response headers
    const projectName = getString(p, 'project_name').replace(/[^a-zA-Z0-9]/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="contract-${projectName}-${projectId}.pdf"`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Helper function to format date
    const formatDate = (dateStr: string | undefined): string => {
      if (!dateStr) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    // === HEADER WITH LOGO ===
    const logoPath = join(process.cwd(), 'public/images/avatar_pdf.png');
    if (existsSync(logoPath)) {
      doc.image(logoPath, (doc.page.width - 60) / 2, 30, { width: 60 });
      doc.moveDown(4);
    }

    // Business header line
    doc.y = 100;
    doc.fontSize(10).font('Helvetica-Bold')
      .text(BUSINESS_INFO.name, { continued: true, align: 'center' })
      .font('Helvetica')
      .text(` | ${BUSINESS_INFO.contact} | ${BUSINESS_INFO.email} | ${BUSINESS_INFO.website}`, { align: 'center' });

    doc.moveDown(2);

    // === CONTRACT TITLE ===
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#0066cc')
      .text('Project Contract', { align: 'center' });
    doc.fillColor('black');
    doc.moveDown(1);

    // === CONTRACT INFO ===
    const leftCol = 50;
    const rightCol = 350;
    let currentY = doc.y;

    // Left column: Client Info
    doc.fontSize(10).font('Helvetica-Bold').text('Client:', leftCol, currentY);
    doc.font('Helvetica').text(getString(p, 'client_name') || 'Client', leftCol, currentY + 15);
    if (p.company_name) {
      doc.text(String(p.company_name), leftCol, currentY + 30);
    }
    doc.text(getString(p, 'client_email') || '', leftCol, currentY + (p.company_name ? 45 : 30));

    // Right column: Contract Details
    doc.font('Helvetica-Bold').text('Service Provider:', rightCol, currentY);
    doc.font('Helvetica').text(BUSINESS_INFO.name, rightCol, currentY + 15);
    doc.font('Helvetica-Bold').text('Contract Date:', rightCol, currentY + 45);
    doc.font('Helvetica').text(formatDate(getString(p, 'contract_signed_at') || getString(p, 'created_at')), rightCol, currentY + 60);

    doc.y = currentY + 90;
    doc.moveDown(1);

    // === PROJECT SCOPE ===
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#0066cc').text('1. Project Scope');
    doc.fillColor('black');
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica-Bold').text('Project Name: ', { continued: true });
    doc.font('Helvetica').text(getString(p, 'project_name'));

    const projectType = getString(p, 'project_type');
    if (projectType) {
      doc.font('Helvetica-Bold').text('Project Type: ', { continued: true });
      doc.font('Helvetica').text(projectType.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()));
    }

    const description = getString(p, 'description');
    if (description) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Description:');
      doc.font('Helvetica').text(description, { indent: 10 });
    }

    const features = getString(p, 'features');
    if (features) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Features:');
      // Parse features if JSON, otherwise display as-is
      try {
        const featureList = JSON.parse(features);
        if (Array.isArray(featureList)) {
          featureList.forEach((feature: string) => {
            doc.font('Helvetica').text(`• ${feature}`, { indent: 10 });
          });
        } else {
          doc.font('Helvetica').text(features, { indent: 10 });
        }
      } catch {
        doc.font('Helvetica').text(features, { indent: 10 });
      }
    }

    doc.moveDown(1);

    // === TIMELINE ===
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#0066cc').text('2. Timeline');
    doc.fillColor('black');
    doc.moveDown(0.5);

    doc.fontSize(10);
    const startDate = getString(p, 'start_date');
    const dueDate = getString(p, 'due_date');
    const timeline = getString(p, 'timeline');

    if (startDate) {
      doc.font('Helvetica-Bold').text('Start Date: ', { continued: true });
      doc.font('Helvetica').text(formatDate(startDate));
    }
    if (dueDate) {
      doc.font('Helvetica-Bold').text('Target Completion: ', { continued: true });
      doc.font('Helvetica').text(formatDate(dueDate));
    }
    if (timeline) {
      doc.font('Helvetica-Bold').text('Estimated Timeline: ', { continued: true });
      doc.font('Helvetica').text(timeline);
    }

    doc.moveDown(1);

    // === PAYMENT TERMS ===
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#0066cc').text('3. Payment Terms');
    doc.fillColor('black');
    doc.moveDown(0.5);

    doc.fontSize(10);
    const price = getString(p, 'price');
    const depositAmount = getString(p, 'deposit_amount');

    if (price) {
      doc.font('Helvetica-Bold').text('Total Project Cost: ', { continued: true });
      doc.font('Helvetica').text(`$${parseFloat(price).toLocaleString()}`);
    }
    if (depositAmount) {
      doc.font('Helvetica-Bold').text('Deposit Amount: ', { continued: true });
      doc.font('Helvetica').text(`$${parseFloat(depositAmount).toLocaleString()}`);
    }

    doc.moveDown(0.5);
    doc.font('Helvetica').text('Payment is due according to the agreed milestones. Final payment is due upon project completion and client approval.');

    doc.moveDown(1);

    // === TERMS AND CONDITIONS ===
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#0066cc').text('4. Terms and Conditions');
    doc.fillColor('black');
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');
    const terms = [
      'All work will be performed in a professional manner and according to industry standards.',
      'Client agrees to provide timely feedback and necessary materials to avoid project delays.',
      'Changes to the scope of work may require additional time and cost adjustments.',
      'Client retains ownership of all final deliverables upon full payment.',
      'Service Provider retains the right to showcase the completed project in their portfolio.'
    ];

    terms.forEach((term, index) => {
      doc.text(`${index + 1}. ${term}`, { indent: 10 });
      doc.moveDown(0.3);
    });

    doc.moveDown(1);

    // === SIGNATURES ===
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#0066cc').text('5. Signatures');
    doc.fillColor('black');
    doc.moveDown(1);

    // Check if we need a new page for signatures
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
    }

    currentY = doc.y;
    const signatureWidth = 200;

    // Client signature
    doc.fontSize(10).font('Helvetica-Bold').text('Client:', leftCol, currentY);
    doc.moveTo(leftCol, currentY + 50).lineTo(leftCol + signatureWidth, currentY + 50).stroke();
    doc.font('Helvetica').text(getString(p, 'client_name') || 'Client Name', leftCol, currentY + 55);
    doc.text('Date: _______________', leftCol, currentY + 70);

    // Service provider signature
    doc.font('Helvetica-Bold').text('Service Provider:', rightCol, currentY);
    doc.moveTo(rightCol, currentY + 50).lineTo(rightCol + signatureWidth, currentY + 50).stroke();
    doc.font('Helvetica').text(BUSINESS_INFO.name, rightCol, currentY + 55);
    doc.text('Date: _______________', rightCol, currentY + 70);

    // === FOOTER ===
    doc.y = doc.page.height - 60;
    doc.fontSize(9).font('Helvetica').fillColor('#666666')
      .text(`Questions? Contact us at ${BUSINESS_INFO.email}`, { align: 'center' });

    // Finalize PDF
    doc.end();
  })
);

export { router as projectsRouter };
export default router;
