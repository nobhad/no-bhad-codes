import { logger } from '../services/logger.js';
/**
 * ===============================================
 * CLIENT INTAKE API ROUTES
 * ===============================================
 * @file server/routes/intake.ts
 *
 * Handles client intake form processing, project creation,
 * and client account setup.
 */

import crypto from 'crypto';
import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { generateProjectPlan, ProjectPlan } from '../services/project-generator.js';
import { generateInvoice } from '../services/invoice-generator.js';
import { sendNewIntakeNotification } from '../services/email-service.js';
import { getUploadsSubdir, getRelativePath, UPLOAD_DIRS } from '../config/uploads.js';
import { userService } from '../services/user-service.js';
import { intakeService } from '../services/intake-service.js';
import { errorResponse, errorResponseWithPayload, sendSuccess, sendCreated, sanitizeErrorMessage, ErrorCodes } from '../utils/api-response.js';
import { rateLimiters } from '../middleware/rate-limiter.js';
import { validateRequest, ValidationSchemas } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';
import { leadService } from '../services/lead-service.js';
import { registerAsyncTaskHandler } from '../services/async-task-service.js';

registerAsyncTaskHandler('intake.admin-notification', async (payload) => {
  const data = payload as { projectId: number; intakeData: IntakeFormData };
  await sendNewIntakeNotification(data.intakeData, data.projectId);
});

registerAsyncTaskHandler('intake.lead-score', async (payload) => {
  const { projectId } = payload as { projectId: number };
  await leadService.calculateLeadScore(projectId);
});

const router = express.Router();

/**
 * Save intake form data as a JSON file for project records
 */
async function saveIntakeAsFile(
  intakeData: IntakeFormData,
  projectId: number,
  projectName: string
): Promise<void> {
  // Get uploads directory (uses persistent storage on Railway)
  const uploadsDir = getUploadsSubdir(UPLOAD_DIRS.INTAKE);

  // Create formatted intake document
  const intakeDocument = {
    submittedAt: new Date().toISOString(),
    projectId,
    projectName,
    clientInfo: {
      name: intakeData.name,
      email: intakeData.email,
      projectFor: intakeData.projectFor || 'business',
      companyName: intakeData.companyName || null
    },
    projectDetails: {
      type: intakeData.projectType,
      description: intakeData.projectDescription,
      timeline: intakeData.timeline,
      budget: intakeData.budget,
      features: intakeData.features || [],
      designLevel: intakeData.designLevel || null
    },
    technicalInfo: {
      techComfort: intakeData.techComfort || null,
      domainHosting: intakeData.domainHosting || null
    },
    additionalInfo: intakeData.additionalInfo || null
  };

  // Generate descriptive filename with NoBhadCodes branding
  // Use company name if available, otherwise client name
  const clientOrCompany = intakeData.companyName || intakeData.name;
  const safeClientName = clientOrCompany
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `nobhadcodes_intake_${safeClientName}_${dateStr}.json`;
  const pdfDisplayName = `nobhadcodes_intake_${safeClientName}_${dateStr}.pdf`;
  const filePath = join(uploadsDir, filename);
  const relativePath = getRelativePath(UPLOAD_DIRS.INTAKE, filename);

  // Write JSON source file (used by PDF generation endpoint)
  await writeFile(filePath, JSON.stringify(intakeDocument, null, 2), 'utf-8');

  // Get file size
  const fileSize = Buffer.byteLength(JSON.stringify(intakeDocument, null, 2), 'utf-8');

  // Insert into files table — JSON is source data, PDF is generated on-the-fly
  // via /api/projects/:id/intake/pdf (uploads endpoint redirects for category=intake)
  // Display as PDF to the client (original_filename + mime_type)
  await intakeService.insertIntakeFile({
    projectId,
    filename,
    originalFilename: pdfDisplayName,
    relativePath,
    fileSize,
    description: 'Project intake form submission',
    uploadedBy: 'system'
  });

  await logger.info(`[Intake] Saved intake form as file: ${relativePath}`, { category: 'INTAKE' });
}

interface ProposalSelection {
  selectedTier: string;
  addedFeatures: string[];
  removedFeatures: string[];
  maintenanceOption: string | null;
  calculatedPrice: number;
  basePrice?: number;
  subtotal?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  notes: string;
  customItems?: Array<{
    itemType?: string;
    description: string;
    quantity?: number;
    unitPrice: number;
    unitLabel?: string;
    isTaxable?: boolean;
    isOptional?: boolean;
  }>;
  expirationDate?: string | null;
}

interface IntakeFormData {
  name: string;
  email: string;
  phone?: string;
  projectFor?: string;
  companyName?: string;
  projectType: string;
  projectDescription: string;
  timeline: string;
  budget: string;
  techComfort?: string;
  domainHosting?: string;
  features?: string | string[];
  designLevel?: string;
  additionalInfo?: string;
  proposalSelection?: ProposalSelection;
}

interface ProjectUpdate {
  title: string;
  description: string;
  date: string;
  type: string;
}

interface ProjectInfo {
  id: number;
  name: string;
  status: string;
  type: string;
  timeline: string;
  budget: string;
}

interface ClientInfo {
  name: string;
  company: string;
  email: string;
}

interface ProjectStatusResponse {
  project: ProjectInfo;
  client: ClientInfo;
  latestUpdate: ProjectUpdate | null;
}

/**
 * POST /api/intake
 * Process client intake form submission
 */
router.post(
  '/',
  rateLimiters.publicForm,
  validateRequest(ValidationSchemas.intakeSubmission),
  async (req: Request, res: Response) => {
    try {
      await logger.info('Received intake form submission', {
        category: 'INTAKE',
        metadata: { body: req.body }
      });

      const intakeData: IntakeFormData = req.body;

      // Normalize email before processing
      if (intakeData.email) {
        intakeData.email = intakeData.email.trim().toLowerCase();
      }

      // Process features array outside transaction
      const features = Array.isArray(intakeData.features)
        ? intakeData.features
        : [intakeData.features].filter(Boolean);

      // Determine client type and company name
      const clientType: 'individual' | 'company' =
        intakeData.projectFor === 'personal' ? 'individual' : 'company';
      const companyName =
        clientType === 'individual'
          ? null // Individual clients don't have a company name
          : intakeData.companyName || intakeData.name;

      // Generate password hash outside transaction
      const BCRYPT_ROUNDS = 12;
      const hashedPassword = await bcrypt.hash(generateRandomPassword(), BCRYPT_ROUNDS);

      // Auto-generate project milestones based on project type and timeline
      const milestones = generateProjectMilestones(intakeData.projectType, intakeData.timeline);

      // Look up system user ID for project update author
      const systemUserId = await userService.getUserIdByEmailOrName('system');

      // Execute database operations in a transaction via service
      const result = await intakeService.runIntakeTransaction({
        intakeData,
        companyName,
        clientType,
        hashedPassword,
        features: features as string[],
        projectName: generateProjectName(intakeData.projectType, clientType, companyName, intakeData.name),
        milestones,
        systemUserId
      });

      const { clientId, projectId, isNewClient, proposalRequestId } = result;

      // Generate project plan based on intake data (outside transaction)
      const projectPlan: ProjectPlan = await generateProjectPlan(intakeData, projectId);

      // Generate initial invoice (outside transaction)
      await generateInvoice(intakeData, projectId, clientId);

      // Save intake form as downloadable file
      const projectName = generateProjectName(
        intakeData.projectType,
        clientType,
        companyName,
        intakeData.name
      );
      try {
        await saveIntakeAsFile(intakeData, projectId, projectName);
      } catch (fileError) {
        await logger.error('[Intake] Failed to save intake file:', {
          error: fileError instanceof Error ? fileError : undefined,
          category: 'INTAKE'
        });
        // Non-critical error - don't fail the whole request
      }

      // Generate access token for client portal
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }
      const accessToken = jwt.sign(
        {
          clientId,
          projectId,
          email: intakeData.email,
          type: 'client_access'
        },
        jwtSecret,
        { expiresIn: '7d' }
      );

      // Admin notification + lead scoring are enqueued inside the intake
      // transaction (see intake-service.runIntakeTransaction) and picked up
      // by the async_tasks worker, so they survive a crash between commit
      // and handler execution.

      // Return success response
      sendCreated(res, {
        clientId,
        projectId,
        proposalRequestId,
        projectName: generateProjectName(
          intakeData.projectType,
          clientType,
          companyName,
          intakeData.name
        ),
        accessToken,
        isNewClient,
        projectPlan: projectPlan.summary,
        estimatedDelivery: projectPlan.estimatedDelivery,
        nextSteps: proposalRequestId
          ? [
            'Review your proposal in the client portal',
            'We\'ll finalize your quote within 24-48 hours',
            'Schedule a call to discuss the details',
            'Begin project development upon agreement'
          ]
          : [
            'Review your project details in the client portal',
            'We\'ll send a detailed proposal within 24-48 hours',
            'Schedule a discovery call to discuss requirements',
            'Begin project development upon agreement'
          ]
      }, 'Intake form processed successfully');
    } catch (error: unknown) {
      await logger.error('Intake processing error:', {
        error: error instanceof Error ? error : undefined,
        category: 'INTAKE'
      });
      errorResponseWithPayload(res, 'Failed to process intake form', 500, ErrorCodes.INTERNAL_ERROR, {
        details: sanitizeErrorMessage(error, 'Failed to process intake submission')
      });
    }
  }
);

/**
 * GET /api/intake/status/:projectId
 * Get intake processing status (requires authentication)
 */
router.get(
  '/status/:projectId',
  authenticateToken,
  rateLimiters.standard,
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;

      const statusResult = await intakeService.getIntakeProjectStatus(projectId);

      if (!statusResult) {
        return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      const responseData: ProjectStatusResponse = statusResult;

      sendSuccess(res, responseData);
    } catch (error: unknown) {
      await logger.error('Status check error:', {
        error: error instanceof Error ? error : undefined,
        category: 'INTAKE'
      });
      errorResponse(res, 'Failed to get project status', 500, ErrorCodes.INTERNAL_ERROR);
    }
  }
);

// Helper functions
function generateRandomPassword(length: number = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const randomBytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(randomBytes[i] % chars.length);
  }
  return password;
}

function generateProjectName(
  projectType: string,
  clientType: 'individual' | 'company',
  companyName: string | null,
  contactName: string
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

  // Personal: use contact name + project type (e.g., "John Doe Portfolio Site")
  // Business: use company/contact name + project type (e.g., "Hedgewitch Horticulture Business Site")
  const identifier = companyName || contactName;
  return `${identifier} ${typeName}`;
}

interface Milestone {
  title: string;
  description: string;
  dueDate: string;
  deliverables: string[];
}

function generateProjectMilestones(projectType: string, timeline: string): Milestone[] {
  const now = new Date();

  // Calculate timeline multiplier based on timeline selection
  let timelineWeeks = 4; // default
  switch (timeline) {
  case 'asap':
    timelineWeeks = 2;
    break;
  case '1-month':
    timelineWeeks = 4;
    break;
  case '1-3-months':
    timelineWeeks = 8;
    break;
  case '3-6-months':
    timelineWeeks = 16;
    break;
  case 'flexible':
    timelineWeeks = 6;
    break;
  }

  const addDays = (date: Date, days: number): string => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
  };

  // Base milestones for all project types
  const baseMilestones: Milestone[] = [
    {
      title: 'Discovery & Planning',
      description: 'Review requirements, create project plan and timeline',
      dueDate: addDays(now, Math.floor(timelineWeeks * 0.15 * 7)),
      deliverables: ['Requirements document', 'Project timeline', 'Technical specification']
    },
    {
      title: 'Design & Wireframes',
      description: 'Create visual designs and layout wireframes for approval',
      dueDate: addDays(now, Math.floor(timelineWeeks * 0.35 * 7)),
      deliverables: [
        'Wireframe mockups',
        'Color palette',
        'Typography selection',
        'Design approval'
      ]
    },
    {
      title: 'Development',
      description: 'Build the core functionality and features',
      dueDate: addDays(now, Math.floor(timelineWeeks * 0.7 * 7)),
      deliverables: ['Core features implemented', 'Responsive design', 'Content integration']
    },
    {
      title: 'Testing & Revisions',
      description: 'Quality assurance testing and client revisions',
      dueDate: addDays(now, Math.floor(timelineWeeks * 0.85 * 7)),
      deliverables: ['Bug fixes', 'Performance optimization', 'Client feedback integration']
    },
    {
      title: 'Launch',
      description: 'Final deployment and go-live',
      dueDate: addDays(now, timelineWeeks * 7),
      deliverables: ['Production deployment', 'DNS configuration', 'Launch checklist complete']
    }
  ];

  // Add project-type specific milestones
  const additionalMilestones: Milestone[] = [];

  if (projectType === 'e-commerce' || projectType === 'ecommerce') {
    additionalMilestones.push({
      title: 'Payment Integration',
      description: 'Set up payment processing and checkout flow',
      dueDate: addDays(now, Math.floor(timelineWeeks * 0.6 * 7)),
      deliverables: ['Payment gateway setup', 'Checkout testing', 'Order management']
    });
  }

  if (projectType === 'web-app') {
    additionalMilestones.push({
      title: 'User Authentication',
      description: 'Implement user login, registration, and security',
      dueDate: addDays(now, Math.floor(timelineWeeks * 0.4 * 7)),
      deliverables: ['Login system', 'User registration', 'Password recovery']
    });
  }

  // Combine and sort by due date
  const allMilestones = [...baseMilestones, ...additionalMilestones];
  allMilestones.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return allMilestones;
}

export default router;
