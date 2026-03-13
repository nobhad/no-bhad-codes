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
}

export const intakeService = new IntakeService();
