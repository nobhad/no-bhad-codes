/**
 * ===============================================
 * INTAKE SERVICE
 * ===============================================
 * @file server/services/intake-service.ts
 *
 * Database operations for client intake form processing.
 * Extracted from server/routes/intake.ts.
 */

import { getDatabase } from '../database/init.js';
import { getString, getNumber } from '../database/row-helpers.js';

// =====================================================
// TYPES
// =====================================================

export interface IntakeFileInsertData {
  projectId: number;
  filename: string;
  originalFilename: string;
  relativePath: string;
  fileSize: number;
  description: string;
  uploadedBy: string;
}

interface ProjectWithClientRow {
  [key: string]: unknown;
}

interface ProjectUpdateRow {
  [key: string]: unknown;
}

export interface IntakeStatusResult {
  project: {
    id: number;
    name: string;
    status: string;
    type: string;
    timeline: string;
    budget: string;
  };
  client: {
    name: string;
    company: string;
    email: string;
  };
  latestUpdate: {
    title: string;
    description: string;
    date: string;
    type: string;
  } | null;
}

// =====================================================
// COLUMN LISTS
// =====================================================

const PROJECT_UPDATE_COLUMNS = `
  id, project_id, title, description, update_type, author_user_id, created_at
`.replace(/\s+/g, ' ').trim();

// =====================================================
// SERVICE
// =====================================================

class IntakeService {
  /**
   * Insert an intake form file record into the files table
   */
  async insertIntakeFile(data: IntakeFileInsertData): Promise<void> {
    const db = getDatabase();
    await db.run(
      `INSERT INTO files (
        project_id, filename, original_filename, file_path,
        file_size, mime_type, file_type, category, description, uploaded_by,
        shared_with_client, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'document', 'intake', ?, ?, 1, datetime('now'))`,
      [
        data.projectId,
        data.filename,
        data.originalFilename,
        data.relativePath,
        data.fileSize,
        'application/pdf',
        data.description,
        data.uploadedBy
      ]
    );
  }

  /**
   * Get project status with client info and latest update for intake status endpoint
   */
  async getIntakeProjectStatus(projectId: string): Promise<IntakeStatusResult | null> {
    const db = getDatabase();
    const project = await db.get(
      `
      SELECT p.*, c.company_name, c.contact_name, c.email
      FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE p.id = ?
    `,
      [projectId]
    ) as ProjectWithClientRow | undefined;

    if (!project) {
      return null;
    }

    const latestUpdate = await db.get(
      `SELECT ${PROJECT_UPDATE_COLUMNS} FROM project_updates
       WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    ) as ProjectUpdateRow | undefined;

    return {
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
  }
  /**
   * Get a project with its client details for intake PDF generation.
   * Joins projects with clients to return contact/company info.
   * Used by GET /api/projects/:id/intake/pdf
   */
  async getProjectWithClientForIntakePdf(
    projectId: number
  ): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT p.*, c.contact_name as client_name, c.email as client_email, c.company_name
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );
    return (row as Record<string, unknown>) ?? null;
  }

  /**
   * Find the most recent intake file for a project.
   * Looks for files with intake-related categories or filename patterns.
   * Used by GET /api/projects/:id/intake/pdf
   */
  async getIntakeFileForProject(
    projectId: number
  ): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const INTAKE_FILE_COLUMNS = `
      id, project_id, filename, original_filename, file_path, file_size,
      mime_type, file_type, description, uploaded_by, created_at
    `.replace(/\s+/g, ' ').trim();
    const row = await db.get(
      `SELECT ${INTAKE_FILE_COLUMNS} FROM files
       WHERE project_id = ? AND deleted_at IS NULL
       AND (category = 'intake' OR filename LIKE 'intake_%' OR filename LIKE 'nobhadcodes_intake_%' OR filename LIKE 'admin_project_%')
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId]
    );
    return (row as Record<string, unknown>) ?? null;
  }
  /**
   * Run the main intake form transaction: create/update client, create project,
   * milestones, project update, and optional proposal.
   * Returns the IDs created inside the transaction.
   */
  async runIntakeTransaction(params: {
    intakeData: {
      name: string;
      email: string;
      phone?: string;
      projectType: string;
      projectDescription: string;
      timeline: string;
      budget: string;
      designLevel?: string;
      techComfort?: string;
      domainHosting?: string;
      additionalInfo?: string;
      proposalSelection?: {
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
      };
    };
    companyName: string | null;
    clientType: 'personal' | 'business';
    hashedPassword: string;
    features: string[];
    projectName: string;
    milestones: Array<{
      title: string;
      description: string;
      dueDate: string;
      deliverables: string[];
    }>;
    systemUserId: number | null;
  }): Promise<{
    clientId: number;
    projectId: number;
    isNewClient: boolean;
    proposalRequestId: number | null;
  }> {
    const db = getDatabase();
    const { intakeData, companyName, clientType, hashedPassword, features, projectName, milestones, systemUserId } = params;
    const normalizedEmail = intakeData.email.trim().toLowerCase();

    return db.transaction(async (ctx) => {
      // Check if client already exists
      const existingClient = await ctx.get('SELECT id, email FROM clients WHERE email = ?', [
        normalizedEmail
      ]) as { id: number; email: string } | undefined;

      let clientId: number;
      const isNewClient = !existingClient;
      const intakePhone = (intakeData.phone ?? '').trim() || null;

      if (existingClient) {
        clientId = getNumber(existingClient as unknown as { [key: string]: unknown }, 'id');
        await ctx.run(
          'UPDATE clients SET contact_name = ?, company_name = ?, phone = COALESCE(?, phone), updated_at = datetime(\'now\') WHERE id = ?',
          [intakeData.name, companyName, intakePhone, clientId]
        );
      } else {
        const clientResult = await ctx.run(
          `INSERT INTO clients (company_name, contact_name, email, phone, password_hash, status, client_type, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))`,
          [companyName, intakeData.name, normalizedEmail, intakePhone ?? '', hashedPassword, clientType]
        );
        clientId = clientResult.lastID!;
      }

      // Create primary contact from intake data (if none exists for this client)
      const nameParts = intakeData.name.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const existingContact = await ctx.get(
        'SELECT id FROM client_contacts WHERE client_id = ? AND deleted_at IS NULL LIMIT 1',
        [clientId]
      );

      if (!existingContact) {
        await ctx.run(
          `INSERT INTO client_contacts (client_id, first_name, last_name, email, phone, role, is_primary, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'primary', 1, datetime('now'), datetime('now'))`,
          [clientId, firstName, lastName, normalizedEmail, intakePhone]
        );
      }

      // Create project
      const extraNotes: string[] = [];
      if (features.length) extraNotes.push(`Features: ${features.join(', ')}`);
      if (intakeData.designLevel) extraNotes.push(`Design level: ${intakeData.designLevel}`);
      if (intakeData.techComfort) extraNotes.push(`Tech comfort: ${intakeData.techComfort}`);
      if (intakeData.domainHosting) extraNotes.push(`Domain/hosting: ${intakeData.domainHosting}`);
      if (intakeData.additionalInfo) extraNotes.push(`Additional info: ${intakeData.additionalInfo}`);
      const notes = extraNotes.length ? extraNotes.join('\n') : null;

      const projectResult = await ctx.run(
        `INSERT INTO projects (client_id, project_name, description, status, priority, project_type, budget_range, timeline, notes, source_type, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', 'medium', ?, ?, ?, ?, 'intake_form', datetime('now'), datetime('now'))`,
        [clientId, projectName, intakeData.projectDescription, intakeData.projectType, intakeData.budget, intakeData.timeline, notes]
      );
      const projectId = projectResult.lastID!;

      // Create initial project update
      await ctx.run(
        `INSERT INTO project_updates (project_id, title, description, update_type, author_user_id, created_at)
         VALUES (?, ?, ?, 'general', ?, datetime('now'))`,
        [projectId, 'Project Intake Received', 'Thank you for submitting your project details! We\'re reviewing your requirements and will provide a detailed proposal within 24-48 hours.', systemUserId]
      );

      // Create milestones
      for (const milestone of milestones) {
        await ctx.run(
          `INSERT INTO milestones (project_id, title, description, due_date, deliverables, is_completed, created_at)
           VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`,
          [projectId, milestone.title, milestone.description, milestone.dueDate, JSON.stringify(milestone.deliverables)]
        );
      }

      // Create proposal if provided
      let proposalRequestId: number | null = null;
      if (intakeData.proposalSelection) {
        const proposal = intakeData.proposalSelection;
        const basePrice = proposal.basePrice ?? proposal.calculatedPrice ?? 0;
        const subtotal = proposal.subtotal ?? basePrice;
        const discountType = proposal.discountType || null;
        const discountValue = proposal.discountValue ?? 0;
        const taxRate = proposal.taxRate ?? 0;
        const taxAmount = proposal.taxAmount ?? 0;
        const expirationDate = proposal.expirationDate || null;
        let validityDays = 30;
        if (expirationDate) {
          const diffMs = new Date(expirationDate).getTime() - Date.now();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (Number.isFinite(diffDays) && diffDays > 0) validityDays = diffDays;
        }

        const proposalResult = await ctx.run(
          `INSERT INTO proposal_requests (project_id, client_id, project_type, selected_tier, base_price, final_price, maintenance_option, status, client_notes, created_at, subtotal, discount_type, discount_value, tax_rate, tax_amount, expiration_date, validity_days)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?)`,
          [projectId, clientId, intakeData.projectType, proposal.selectedTier || 'better', basePrice, proposal.calculatedPrice || basePrice, proposal.maintenanceOption || null, proposal.notes || null, subtotal, discountType, discountValue, taxRate, taxAmount, expirationDate, validityDays]
        );
        proposalRequestId = proposalResult.lastID!;

        if (proposal.customItems && proposal.customItems.length > 0) {
          for (const [index, item] of proposal.customItems.entries()) {
            await ctx.run(
              `INSERT INTO proposal_custom_items (proposal_id, item_type, description, quantity, unit_price, unit_label, is_taxable, is_optional, sort_order, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
              [proposalRequestId, item.itemType || 'service', item.description, item.quantity ?? 1, item.unitPrice, item.unitLabel || null, item.isTaxable !== false ? 1 : 0, item.isOptional ? 1 : 0, index]
            );
          }
        }
      }

      return { clientId, projectId, isNewClient, proposalRequestId };
    });
  }
}

export const intakeService = new IntakeService();
