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
import { database } from '../database/database.js';
import { generateProjectPlan, ProjectPlan } from '../services/project-generator.js';
import { generateInvoice, Invoice } from '../services/invoice-generator.js';
import { sendWelcomeEmail, sendNewIntakeNotification } from '../services/email-service.js';

const router = express.Router();

interface IntakeFormData {
  name: string;
  email: string;
  company: string;
  phone: string;
  projectType: string;
  projectDescription: string;
  timeline: string;
  budget: string;
  features?: string | string[];
  addons?: string | string[];
  brandAssets?: string | string[];
  designLevel?: string;
  contentStatus?: string;
  techComfort?: string;
  hosting?: string;
  pages?: string;
  integrations?: string;
  inspiration?: string;
  currentSite?: string;
  challenges?: string;
  additionalInfo?: string;
  wasReferred?: string;
  referralName?: string;
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
    const requiredFields = ['name', 'email', 'company', 'phone', 'projectType', 'projectDescription', 'timeline', 'budget'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missingFields
      });
    }

    const intakeData: IntakeFormData = req.body;

    // Start database transaction
    const db = await database.getDatabase();
    
    try {
      await db.run('BEGIN TRANSACTION');

      // Check if client with this email already exists
      const existingClient = await db.get<ExistingClient>(
        'SELECT id, email FROM clients WHERE email = ?',
        [intakeData.email]
      );

      let clientId: number;
      let isNewClient = !existingClient;

      if (existingClient) {
        clientId = existingClient.id;
        console.log(`Existing client found: ${clientId}`);
      } else {
        // Create new client account
        const hashedPassword = await bcrypt.hash(generateRandomPassword(), 10);
        
        const clientResult = await db.run(`
          INSERT INTO clients (
            company_name, contact_name, email, phone,
            password_hash, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
        `, [
          intakeData.company,
          intakeData.name,
          intakeData.email,
          intakeData.phone,
          hashedPassword
        ]);

        clientId = clientResult.lastID!;
        console.log(`New client created: ${clientId}`);
      }

      // Process features array
      const features = Array.isArray(intakeData.features) ? intakeData.features : [intakeData.features].filter(Boolean);
      const addons = Array.isArray(intakeData.addons) ? intakeData.addons : [intakeData.addons].filter(Boolean);
      const brandAssets = Array.isArray(intakeData.brandAssets) ? intakeData.brandAssets : [intakeData.brandAssets].filter(Boolean);

      // Create project record
      const projectResult = await db.run(`
        INSERT INTO projects (
          client_id, project_name, description, status, priority,
          project_type, budget_range, timeline, features,
          design_level, content_status, tech_comfort,
          hosting_preference, page_count, integrations,
          brand_assets, inspiration, current_site,
          challenges, additional_info, addons,
          referral_source, created_at, updated_at
        ) VALUES (?, ?, ?, 'pending', 'medium', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [
        clientId,
        generateProjectName(intakeData.projectType, intakeData.company),
        intakeData.projectDescription,
        intakeData.projectType,
        intakeData.budget,
        intakeData.timeline,
        features.join(','),
        intakeData.designLevel,
        intakeData.contentStatus,
        intakeData.techComfort,
        intakeData.hosting,
        intakeData.pages,
        intakeData.integrations,
        brandAssets.join(','),
        intakeData.inspiration,
        intakeData.currentSite,
        intakeData.challenges,
        intakeData.additionalInfo,
        addons.join(','),
        intakeData.wasReferred === 'yes' ? intakeData.referralName : null
      ]);

      const projectId = projectResult.lastID!;
      console.log(`Project created: ${projectId}`);

      // Generate project plan based on intake data
      const projectPlan: ProjectPlan = await generateProjectPlan(intakeData, projectId);
      
      // Generate initial invoice
      const invoice: Invoice = await generateInvoice(intakeData, projectId, clientId);

      // Create initial project update
      await db.run(`
        INSERT INTO project_updates (
          project_id, title, description, type, author, created_at
        ) VALUES (?, ?, ?, 'general', 'system', datetime('now'))
      `, [
        projectId,
        'Project Intake Received',
        `Thank you for submitting your project details! We're reviewing your requirements and will provide a detailed proposal within 24-48 hours.`
      ]);

      // Generate access token for client portal
      const accessToken = jwt.sign(
        { 
          clientId, 
          projectId, 
          email: intakeData.email,
          type: 'client_access'
        },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '7d' }
      );

      // Commit transaction
      await db.run('COMMIT');

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
          projectName: generateProjectName(intakeData.projectType, intakeData.company),
          accessToken,
          isNewClient,
          projectPlan: projectPlan.summary,
          estimatedDelivery: projectPlan.estimatedDelivery,
          nextSteps: [
            'Review your project details in the client portal',
            'We\'ll send a detailed proposal within 24-48 hours',
            'Schedule a discovery call to discuss requirements',
            'Begin project development upon agreement'
          ]
        }
      });

    } catch (dbError) {
      // Rollback transaction on error
      await db.run('ROLLBACK');
      throw dbError;
    }

  } catch (error: any) {
    console.error('Intake processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process intake form',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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
    
    const db = await database.getDatabase();
    const project = await db.get(`
      SELECT p.*, c.company_name, c.contact_name, c.email
      FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE p.id = ?
    `, [projectId]);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Get latest update
    const latestUpdate = await db.get(`
      SELECT * FROM project_updates 
      WHERE project_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [projectId]);

    const responseData: ProjectStatusResponse = {
      project: {
        id: project.id,
        name: project.project_name,
        status: project.status,
        type: project.project_type,
        timeline: project.timeline,
        budget: project.budget_range
      },
      client: {
        name: project.contact_name,
        company: project.company_name,
        email: project.email
      },
      latestUpdate: latestUpdate ? {
        title: latestUpdate.title,
        description: latestUpdate.description,
        date: latestUpdate.created_at,
        type: latestUpdate.type
      } : null
    };

    res.json({
      success: true,
      data: responseData
    });

  } catch (error: any) {
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

function generateProjectName(projectType: string, companyName: string): string {
  const typeNames: Record<string, string> = {
    'simple-site': 'Simple Website',
    'business-site': 'Business Website',
    'portfolio': 'Portfolio Website',
    'ecommerce': 'E-commerce Store',
    'web-app': 'Web Application',
    'browser-extension': 'Browser Extension',
    'other': 'Custom Project'
  };

  const typeName = typeNames[projectType] || 'Web Project';
  return `${companyName} - ${typeName}`;
}

export default router;