/**
 * ===============================================
 * CLIENT INTAKE API ROUTES
 * ===============================================
 * @file server/routes/intake.ts
 *
 * Handles client intake form processing, project creation,
 * and client account setup.
 */

import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { getDatabase } from '../database/init.js';
import { generateProjectPlan, ProjectPlan } from '../services/project-generator.js';
import { generateInvoice } from '../services/invoice-generator.js';
import { sendWelcomeEmail, sendNewIntakeNotification } from '../services/email-service.js';
import { getUploadsSubdir, getRelativePath, UPLOAD_DIRS } from '../config/uploads.js';
import { getString, getNumber } from '../database/row-helpers.js';

const router = express.Router();

/**
 * Save intake form data as a JSON file for project records
 */
async function saveIntakeAsFile(
  intakeData: IntakeFormData,
  projectId: number,
  projectName: string
): Promise<void> {
  const db = getDatabase();

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

  // Generate filename
  const timestamp = Date.now();
  const safeProjectName = projectName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  const filename = `intake_${projectId}_${safeProjectName}_${timestamp}.json`;
  const filePath = join(uploadsDir, filename);
  const relativePath = getRelativePath(UPLOAD_DIRS.INTAKE, filename);

  // Write file
  writeFileSync(filePath, JSON.stringify(intakeDocument, null, 2), 'utf-8');

  // Get file size
  const fileSize = Buffer.byteLength(JSON.stringify(intakeDocument, null, 2), 'utf-8');

  // Insert into files table
  await db.run(
    `INSERT INTO files (
      project_id, filename, original_filename, file_path,
      file_size, mime_type, file_type, description, uploaded_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      projectId,
      filename,
      'Project Intake Form.json',
      relativePath,
      fileSize,
      'application/json',
      'document',
      'Original project intake form submission',
      'system'
    ]
  );

  console.log(`[Intake] Saved intake form as file: ${relativePath}`);
}

interface ProposalSelection {
  selectedTier: string;
  addedFeatures: string[];
  removedFeatures: string[];
  maintenanceOption: string | null;
  calculatedPrice: number;
  notes: string;
}

interface IntakeFormData {
  name: string;
  email: string;
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

interface ExistingClient {
  id: number;
  email: string;
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
router.post('/', async (req: Request, res: Response) => {
  try {
    console.log('Received intake form submission:', req.body);

    // Validate required fields
    const requiredFields = [
      'name',
      'email',
      'projectType',
      'projectDescription',
      'timeline',
      'budget'
    ];
    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missingFields
      });
    }

    const intakeData: IntakeFormData = req.body;

    // Get database and run everything in a transaction
    const db = getDatabase();

    // Process features array outside transaction
    const features = Array.isArray(intakeData.features)
      ? intakeData.features
      : [intakeData.features].filter(Boolean);

    // Determine client type and company name
    const clientType: 'personal' | 'business' = intakeData.projectFor === 'personal' ? 'personal' : 'business';
    const companyName = clientType === 'personal'
      ? null  // Personal clients don't have a company name
      : (intakeData.companyName || intakeData.name);

    // Generate password hash outside transaction
    const hashedPassword = await bcrypt.hash(generateRandomPassword(), 10);

    // Execute database operations in a transaction
    const result = await db.transaction(async (ctx) => {
      // Check if client with this email already exists
      const existingClient = (await ctx.get('SELECT id, email FROM clients WHERE email = ?', [
        intakeData.email
      ])) as ExistingClient | undefined;

      let clientId: number;
      const isNewClient = !existingClient;

      if (existingClient) {
        clientId = getNumber(existingClient as unknown as { [key: string]: unknown }, 'id');
        console.log(`Existing client found: ${clientId}`);
      } else {
        // Create new client account
        const clientResult = await ctx.run(
          `
          INSERT INTO clients (
            company_name, contact_name, email, phone,
            password_hash, status, client_type, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
        `,
          [companyName, intakeData.name, intakeData.email, '', hashedPassword, clientType]
        );

        clientId = clientResult.lastID!;
        console.log(`New client created: ${clientId}`);
      }

      // Create project record
      const projectResult = await ctx.run(
        `
        INSERT INTO projects (
          client_id, project_name, description, status, priority,
          project_type, budget_range, timeline, features,
          design_level, tech_comfort, hosting_preference,
          additional_info, created_at, updated_at
        ) VALUES (?, ?, ?, 'pending', 'medium', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `,
        [
          clientId,
          generateProjectName(intakeData.projectType, clientType, companyName, intakeData.name),
          intakeData.projectDescription,
          intakeData.projectType,
          intakeData.budget,
          intakeData.timeline,
          features.join(','),
          intakeData.designLevel || null,
          intakeData.techComfort || null,
          intakeData.domainHosting || null,
          intakeData.additionalInfo || null
        ]
      );

      const projectId = projectResult.lastID!;
      console.log(`Project created: ${projectId}`);

      // Create initial project update
      await ctx.run(
        `
        INSERT INTO project_updates (
          project_id, title, description, update_type, author, created_at
        ) VALUES (?, ?, ?, 'general', 'system', datetime('now'))
      `,
        [
          projectId,
          'Project Intake Received',
          'Thank you for submitting your project details! We\'re reviewing your requirements and will provide a detailed proposal within 24-48 hours.'
        ]
      );

      // Auto-generate project milestones based on project type and timeline
      const milestones = generateProjectMilestones(intakeData.projectType, intakeData.timeline);
      for (const milestone of milestones) {
        await ctx.run(
          `INSERT INTO milestones (project_id, title, description, due_date, deliverables, is_completed, created_at)
           VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`,
          [
            projectId,
            milestone.title,
            milestone.description,
            milestone.dueDate,
            JSON.stringify(milestone.deliverables)
          ]
        );
      }
      console.log(`Created ${milestones.length} milestones for project ${projectId}`);

      // Create proposal request if provided
      let proposalRequestId: number | null = null;
      if (intakeData.proposalSelection) {
        const proposal = intakeData.proposalSelection;
        const proposalResult = await ctx.run(
          `INSERT INTO proposal_requests (
            project_id, client_id, project_type, selected_tier,
            base_price, final_price, maintenance_option,
            status, client_notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))`,
          [
            projectId,
            clientId,
            intakeData.projectType,
            proposal.selectedTier || 'better',
            proposal.calculatedPrice || 0,
            proposal.calculatedPrice || 0,
            proposal.maintenanceOption || null,
            proposal.notes || null
          ]
        );
        proposalRequestId = proposalResult.lastID!;
        console.log(`Created proposal request ${proposalRequestId} for project ${projectId}`);
      }

      return { clientId, projectId, isNewClient, proposalRequestId };
    });

    const { clientId, projectId, isNewClient, proposalRequestId } = result;

    // Generate project plan based on intake data (outside transaction)
    const projectPlan: ProjectPlan = await generateProjectPlan(intakeData, projectId);

    // Generate initial invoice (outside transaction)
    await generateInvoice(intakeData, projectId, clientId);

    // Save intake form as downloadable file
    const projectName = generateProjectName(intakeData.projectType, clientType, companyName, intakeData.name);
    try {
      await saveIntakeAsFile(intakeData, projectId, projectName);
    } catch (fileError) {
      console.error('[Intake] Failed to save intake file:', fileError);
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

    // Send notifications (async, don't wait)
    setTimeout(async () => {
      try {
        // Send welcome email to client
        if (isNewClient) {
          await sendWelcomeEmail(intakeData.email, intakeData.name, accessToken);
        }

        // Send new intake notification to admin
        await sendNewIntakeNotification(intakeData, projectId);
      } catch (emailError) {
        console.error('Failed to send emails:', emailError);
      }
    }, 100);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Intake form processed successfully',
      data: {
        clientId,
        projectId,
        proposalRequestId,
        projectName: generateProjectName(intakeData.projectType, clientType, companyName, intakeData.name),
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
      }
    });
  } catch (error: unknown) {
    console.error('Intake processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      message: 'Failed to process intake form',
      error: process.env.NODE_ENV === 'development' ? errorMessage : 'Internal server error'
    });
  }
});

/**
 * GET /api/intake/status/:projectId
 * Get intake processing status
 */
router.get('/status/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const db = getDatabase();
    const project = await db.get(
      `
      SELECT p.*, c.company_name, c.contact_name, c.email
      FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE p.id = ?
    `,
      [projectId]
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Get latest update
    const latestUpdate = await db.get(
      `
      SELECT * FROM project_updates 
      WHERE project_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `,
      [projectId]
    );

    const responseData: ProjectStatusResponse = {
      project: {
        id: getNumber(project, 'id'),
        name: getString(project, 'project_name'),
        status: getString(project, 'status'),
        type: getString(project, 'project_type'),
        timeline: getString(project, 'timeline'),
        budget: getString(project, 'budget_range')
      },
      client: {
        name: getString(project, 'contact_name'),
        company: getString(project, 'company_name'),
        email: getString(project, 'email')
      },
      latestUpdate: latestUpdate
        ? {
          title: getString(latestUpdate, 'title'),
          description: getString(latestUpdate, 'description'),
          date: getString(latestUpdate, 'created_at'),
          type: getString(latestUpdate, 'type')
        }
        : null
    };

    res.json({
      success: true,
      data: responseData
    });
  } catch (error: unknown) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get project status'
    });
  }
});

// Helper functions
function generateRandomPassword(length: number = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateProjectName(
  projectType: string,
  clientType: 'personal' | 'business',
  companyName: string | null,
  contactName: string
): string {
  const typeNames: Record<string, string> = {
    'simple-site': 'Simple Website',
    'business-site': 'Business Website',
    portfolio: 'Portfolio Website',
    'e-commerce': 'E-commerce Store',
    ecommerce: 'E-commerce Store', // Legacy support
    'web-app': 'Web Application',
    'browser-extension': 'Browser Extension',
    other: 'Custom Project'
  };

  const typeName = typeNames[projectType] || 'Web Project';

  // Personal: just use project type (e.g., "Simple Website")
  // Business: "Acme Corp - Business Website"
  if (clientType === 'personal') {
    return typeName;
  }
  const identifier = companyName || contactName;
  return `${identifier} - ${typeName}`;
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
