import express from 'express';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { getUploadsSubdir, getRelativePath, UPLOAD_DIRS } from '../../config/uploads.js';
import { errorTracker } from '../../services/error-tracking.js';
import { generateDefaultMilestones } from '../../services/milestone-generator.js';
import { userService } from '../../services/user-service.js';
import { projectService } from '../../services/project-service.js';
import { errorResponse, sendSuccess, sendCreated, sanitizeErrorMessage, ErrorCodes } from '../../utils/api-response.js';
import { logger } from '../../services/logger.js';
import { softDeleteService } from '../../services/soft-delete-service.js';

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
    const {
      newClient,
      clientId,
      projectType,
      description,
      budget,
      timeline,
      notes,
      features,
      pageCount,
      integrations,
      addons,
      designLevel,
      contentStatus,
      brandAssets,
      techComfort,
      hostingPreference,
      currentSite,
      inspiration,
      challenges,
      additionalInfo,
      referralSource
    } = req.body;

    // Validate required project fields
    if (!projectType || !description || !budget || !timeline) {
      return errorResponse(
        res,
        'Project type, description, budget, and timeline are required',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Validate client - must have either newClient or clientId
    if (!newClient && !clientId) {
      return errorResponse(
        res,
        'Either newClient data or clientId is required',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    let finalClientId: number;
    let clientData: { contact_name: string; company_name: string | null; email: string };

    try {
      // Create or validate client
      if (newClient) {
        // Validate new client fields (accepts contactName for React modal compatibility)
        if (!newClient.contactName || !newClient.email) {
          return errorResponse(res, 'Client name and email are required', 400, ErrorCodes.VALIDATION_ERROR);
        }

        // Check for existing client with same email
        const existing = await projectService.findClientByEmail(newClient.email);
        if (existing) {
          return errorResponse(
            res,
            'Client with this email already exists',
            409,
            ErrorCodes.DUPLICATE_RESOURCE
          );
        }

        // Create client
        finalClientId = await projectService.createClient({
          contactName: newClient.contactName,
          companyName: newClient.companyName || null,
          email: newClient.email,
          phone: newClient.phone || null
        });

        clientData = {
          contact_name: newClient.contactName,
          company_name: newClient.companyName || null,
          email: newClient.email.toLowerCase()
        };

        logger.info(`[AdminProjects] Created new client: ${finalClientId}`);
      } else {
        // Validate existing client
        const client = await projectService.getAdminClientById(clientId);
        if (!client) {
          return errorResponse(res, 'Client not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
        }
        finalClientId = clientId;
        clientData = {
          contact_name: client.contact_name || '',
          company_name: client.company_name,
          email: client.email
        };
      }

      // Generate project name
      const projectName = generateAdminProjectName(projectType, clientData);

      // Create project
      const projectId = await projectService.createAdminProject({
        clientId: finalClientId,
        projectName,
        description,
        projectType,
        budget,
        timeline,
        notes: notes || null,
        features: features || null,
        pageCount: pageCount || null,
        integrations: integrations || null,
        addons: addons || null,
        designLevel: designLevel || null,
        contentStatus: contentStatus || null,
        brandAssets: brandAssets || null,
        techComfort: techComfort || null,
        hostingPreference: hostingPreference || null,
        currentSite: currentSite || null,
        inspiration: inspiration || null,
        challenges: challenges || null,
        additionalInfo: additionalInfo || null,
        referralSource: referralSource || null
      });

      logger.info(`[AdminProjects] Created project: ${projectId} - ${projectName}`);

      // Save project data as JSON file (like intake form)
      try {
        await saveAdminProjectAsFile(
          {
            clientName: clientData.contact_name,
            clientEmail: clientData.email,
            companyName: clientData.company_name,
            projectType,
            description,
            budget,
            timeline,
            notes: notes || null,
            features: features || null,
            pageCount: pageCount || null,
            integrations: integrations || null,
            addons: addons || null,
            designLevel: designLevel || null,
            contentStatus: contentStatus || null,
            brandAssets: brandAssets || null,
            techComfort: techComfort || null,
            hostingPreference: hostingPreference || null,
            currentSite: currentSite || null,
            inspiration: inspiration || null,
            challenges: challenges || null,
            additionalInfo: additionalInfo || null,
            referralSource: referralSource || null
          },
          projectId,
          projectName
        );
      } catch (fileError) {
        logger.error('[AdminProjects] Failed to save project file:', {
          error: fileError instanceof Error ? fileError : undefined
        });
        // Non-critical error - don't fail the whole request
      }

      // Create initial project update
      const adminUserId = await userService.getUserIdByEmailOrName('admin');
      await projectService.insertProjectUpdateRecord(
        projectId,
        'Project Created',
        'Project was manually created by admin.',
        'general',
        adminUserId
      );

      // Generate default milestones and tasks for the new project
      try {
        const generationResult = await generateDefaultMilestones(projectId, projectType);
        logger.info(
          `[AdminProjects] Generated ${generationResult.milestonesCreated} milestones and ${generationResult.tasksCreated} tasks for project ${projectId}`
        );
      } catch (milestoneError) {
        logger.error('[AdminProjects] Failed to generate milestones:', {
          error: milestoneError instanceof Error ? milestoneError : undefined
        });
        // Non-critical - don't fail the request
      }

      // Log the action
      errorTracker.captureMessage('Admin created project manually', 'info', {
        tags: { component: 'admin-projects' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' },
        extra: { projectId, projectName, clientId: finalClientId }
      });

      sendCreated(res, { projectId, projectName, clientId: finalClientId }, 'Project created successfully');
    } catch (error) {
      logger.error('[AdminProjects] Error creating project:', {
        error: error instanceof Error ? error : undefined
      });
      errorResponse(res, 'Failed to create project', 500, ErrorCodes.INTERNAL_ERROR);
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
  features: string | null;
  pageCount: string | null;
  integrations: string | null;
  addons: string | null;
  designLevel: string | null;
  contentStatus: string | null;
  brandAssets: string | null;
  techComfort: string | null;
  hostingPreference: string | null;
  currentSite: string | null;
  inspiration: string | null;
  challenges: string | null;
  additionalInfo: string | null;
  referralSource: string | null;
}

async function saveAdminProjectAsFile(
  data: AdminProjectData,
  projectId: number,
  projectName: string
): Promise<void> {
  const uploadsDir = getUploadsSubdir(UPLOAD_DIRS.INTAKE);

  // Parse features string into array so intake PDF can iterate it
  const featuresArray: string[] = data.features
    ? data.features
      .split(/[,\n]+/)
      .map((f: string) => f.trim())
      .filter(Boolean)
    : [];

  // Mirror the structure used by the client intake form so the intake PDF
  // generation route can read this file identically to a client submission.
  const document = {
    submittedAt: new Date().toISOString(),
    projectId,
    projectName,
    createdBy: 'admin',
    clientInfo: {
      name: data.clientName,
      email: data.clientEmail,
      projectFor: 'business',
      companyName: data.companyName
    },
    projectDetails: {
      type: data.projectType,
      description: data.description,
      timeline: data.timeline,
      budget: data.budget,
      features: featuresArray,
      designLevel: data.designLevel || null
    },
    technicalInfo: {
      techComfort: data.techComfort || null,
      domainHosting: data.hostingPreference || null
    },
    additionalInfo: data.additionalInfo || data.notes || null,
    // Extended admin-only fields (not read by PDF generator but kept for records)
    extendedScope: {
      pageCount: data.pageCount,
      integrations: data.integrations,
      addons: data.addons,
      contentStatus: data.contentStatus,
      brandAssets: data.brandAssets,
      currentSite: data.currentSite,
      inspiration: data.inspiration,
      challenges: data.challenges,
      referralSource: data.referralSource
    },
    notes: data.notes
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

  await projectService.insertFileRecord({
    projectId,
    filename,
    originalFilename: filename,
    filePath: relativePath,
    fileSize,
    mimeType: 'application/json',
    fileType: 'document',
    description: 'Project intake form',
    uploadedBy: 'admin'
  });

  logger.info(`[AdminProjects] Saved project file: ${relativePath}`);
}

// =====================================================
// BULK OPERATIONS
// =====================================================

/**
 * @swagger
 * /api/admin/projects/bulk/delete:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/projects/bulk/delete
 *     description: Bulk soft delete projects.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.post(
  '/projects/bulk/delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectIds } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return errorResponse(
        res,
        'projectIds array is required and must not be empty',
        400,
        ErrorCodes.MISSING_REQUIRED_FIELDS
      );
    }

    const deletedBy = req.user?.email || 'admin';
    let deleted = 0;
    const errors: string[] = [];

    // Soft delete each project using the soft delete service
    for (const projectId of projectIds) {
      const id = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
      if (isNaN(id) || id <= 0) {
        errors.push(`Invalid project ID: ${projectId}`);
        continue;
      }

      try {
        const result = await softDeleteService.softDeleteProject(id, deletedBy);
        if (result.success) {
          deleted++;
        } else {
          errors.push(`Project ${id}: ${result.message}`);
        }
      } catch (error) {
        errors.push(`Project ${id}: ${sanitizeErrorMessage(error, 'Failed to delete project')}`);
      }
    }

    // Log the bulk action
    errorTracker.captureMessage('Admin bulk deleted projects', 'info', {
      tags: { component: 'admin-projects' },
      user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' },
      extra: { projectIds, deleted, errors }
    });

    sendSuccess(res, { deleted, errors: errors.length > 0 ? errors : undefined }, `Deleted ${deleted} projects`);
  })
);

export default router;
