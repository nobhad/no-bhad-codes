import express from 'express';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { getDatabase } from '../../database/init.js';
import { getUploadsSubdir, getRelativePath, UPLOAD_DIRS } from '../../config/uploads.js';
import { errorTracker } from '../../services/error-tracking.js';
import { generateDefaultMilestones } from '../../services/milestone-generator.js';
import { userService } from '../../services/user-service.js';
import { errorResponse } from '../../utils/api-response.js';

const router = express.Router();

/**
 * @swagger
 * /api/admin/projects:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Create a new project manually
 *     description: Admin can create a project for an existing or new client, saves project details as JSON file
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/projects',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { newClient, clientId, projectType, description, budget, timeline, notes } = req.body;

    // Validate required project fields
    if (!projectType || !description || !budget || !timeline) {
      return errorResponse(
        res,
        'Project type, description, budget, and timeline are required',
        400,
        'VALIDATION_ERROR'
      );
    }

    // Validate client - must have either newClient or clientId
    if (!newClient && !clientId) {
      return errorResponse(res, 'Either newClient data or clientId is required', 400, 'VALIDATION_ERROR');
    }

    const db = getDatabase();
    let finalClientId: number;
    let clientData: { contact_name: string; company_name: string | null; email: string };

    try {
      // Create or validate client
      if (newClient) {
        // Validate new client fields
        if (!newClient.name || !newClient.email) {
          return errorResponse(res, 'Client name and email are required', 400, 'VALIDATION_ERROR');
        }

        // Check for existing client with same email
        const existing = await db.get(
          'SELECT id FROM clients WHERE LOWER(email) = LOWER(?)',
          [newClient.email]
        );
        if (existing) {
          return errorResponse(res, 'Client with this email already exists', 409, 'DUPLICATE_RESOURCE');
        }

        // Create client
        const result = await db.run(
          `INSERT INTO clients (company_name, contact_name, email, phone, password_hash, status, client_type, created_at, updated_at)
           VALUES (?, ?, LOWER(?), ?, '', 'pending', 'business', datetime('now'), datetime('now'))`,
          [newClient.company || null, newClient.name, newClient.email, newClient.phone || null]
        );
        finalClientId = result.lastID!;

        clientData = {
          contact_name: newClient.name,
          company_name: newClient.company || null,
          email: newClient.email.toLowerCase()
        };

        console.log(`[AdminProjects] Created new client: ${finalClientId}`);
      } else {
        // Validate existing client
        const client = await db.get(
          'SELECT id, contact_name, company_name, email FROM clients WHERE id = ?',
          [clientId]
        );
        if (!client) {
          return errorResponse(res, 'Client not found', 404, 'RESOURCE_NOT_FOUND');
        }
        finalClientId = clientId;
        clientData = {
          contact_name: (client as { contact_name: string }).contact_name || '',
          company_name: (client as { company_name: string | null }).company_name,
          email: (client as { email: string }).email
        };
      }

      // Generate project name
      const projectName = generateAdminProjectName(projectType, clientData);

      // Create project
      const projectResult = await db.run(
        `INSERT INTO projects (
          client_id, project_name, description, status, project_type,
          budget_range, timeline, additional_info, created_at, updated_at
        ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [finalClientId, projectName, description, projectType, budget, timeline, notes || null]
      );
      const projectId = projectResult.lastID!;

      console.log(`[AdminProjects] Created project: ${projectId} - ${projectName}`);

      // Save project data as JSON file (like intake form)
      try {
        await saveAdminProjectAsFile({
          clientName: clientData.contact_name,
          clientEmail: clientData.email,
          companyName: clientData.company_name,
          projectType,
          description,
          budget,
          timeline,
          notes: notes || null
        }, projectId, projectName);
      } catch (fileError) {
        console.error('[AdminProjects] Failed to save project file:', fileError);
        // Non-critical error - don't fail the whole request
      }

      // Create initial project update
      const adminUserId = await userService.getUserIdByEmailOrName('admin');
      await db.run(
        `INSERT INTO project_updates (
          project_id, title, description, update_type, author_user_id, created_at
        ) VALUES (?, ?, ?, 'general', ?, datetime('now'))`,
        [
          projectId,
          'Project Created',
          'Project was manually created by admin.',
          adminUserId
        ]
      );

      // Generate default milestones and tasks for the new project
      try {
        const generationResult = await generateDefaultMilestones(projectId, projectType);
        console.log(`[AdminProjects] Generated ${generationResult.milestonesCreated} milestones and ${generationResult.tasksCreated} tasks for project ${projectId}`);
      } catch (milestoneError) {
        console.error('[AdminProjects] Failed to generate milestones:', milestoneError);
        // Non-critical - don't fail the request
      }

      // Log the action
      errorTracker.captureMessage('Admin created project manually', 'info', {
        tags: { component: 'admin-projects' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' },
        extra: { projectId, projectName, clientId: finalClientId }
      });

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        projectId,
        projectName,
        clientId: finalClientId
      });
    } catch (error) {
      console.error('[AdminProjects] Error creating project:', error);
      errorResponse(res, 'Failed to create project', 500, 'INTERNAL_ERROR');
    }
  })
);

/**
 * Generate project name for admin-created projects
 */
function generateAdminProjectName(
  projectType: string,
  clientData: { contact_name: string; company_name: string | null }
): string {
  const typeNames: Record<string, string> = {
    'simple-site': 'Simple Site',
    'business-site': 'Business Site',
    portfolio: 'Portfolio Site',
    'e-commerce': 'E-commerce Store',
    ecommerce: 'E-commerce Store', // Legacy support
    'web-app': 'Web App',
    'browser-extension': 'Browser Extension',
    other: 'Custom Project'
  };

  const typeName = typeNames[projectType] || 'Web Project';
  const identifier = clientData.company_name || clientData.contact_name || 'Client';

  return `${identifier} ${typeName}`;
}

/**
 * Save admin-created project as JSON file
 */
interface AdminProjectData {
  clientName: string;
  clientEmail: string;
  companyName: string | null;
  projectType: string;
  description: string;
  budget: string;
  timeline: string;
  notes: string | null;
}

async function saveAdminProjectAsFile(
  data: AdminProjectData,
  projectId: number,
  projectName: string
): Promise<void> {
  const db = getDatabase();
  const uploadsDir = getUploadsSubdir(UPLOAD_DIRS.INTAKE);

  const document = {
    submittedAt: new Date().toISOString(),
    projectId,
    projectName,
    createdBy: 'admin',
    clientInfo: {
      name: data.clientName,
      email: data.clientEmail,
      companyName: data.companyName
    },
    projectDetails: {
      type: data.projectType,
      description: data.description,
      timeline: data.timeline,
      budget: data.budget
    },
    additionalInfo: data.notes
  };

  // Generate descriptive filename with NoBhadCodes branding
  // Use company name if available, otherwise client name
  const clientOrCompany = data.companyName || data.clientName;
  const safeClientName = clientOrCompany
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `nobhadcodes_intake_${safeClientName}_${dateStr}.json`;
  const filePath = join(uploadsDir, filename);
  const relativePath = getRelativePath(UPLOAD_DIRS.INTAKE, filename);

  writeFileSync(filePath, JSON.stringify(document, null, 2), 'utf-8');
  const fileSize = Buffer.byteLength(JSON.stringify(document, null, 2), 'utf-8');

  await db.run(
    `INSERT INTO files (
      project_id, filename, original_filename, file_path,
      file_size, mime_type, file_type, description, uploaded_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      projectId,
      filename,
      filename, // Use descriptive filename for downloads
      relativePath,
      fileSize,
      'application/json',
      'document',
      'Project intake form',
      'admin'
    ]
  );

  console.log(`[AdminProjects] Saved project file: ${relativePath}`);
}

export default router;
