/**
 * ===============================================
 * PROJECT SERVICE — ADMIN OPERATIONS
 * ===============================================
 * Database operations for admin project management:
 * - Client lookup & creation
 * - Project creation
 * - Project update logging
 * - File record insertion
 */

import { getDatabase } from '../../database/init.js';

// =====================================================
// TYPES
// =====================================================

export interface ClientRow {
  id: number;
  contact_name: string;
  company_name: string | null;
  email: string;
}

export interface NewClientData {
  contactName: string;
  companyName: string | null;
  email: string;
  phone: string | null;
}

export interface CreateProjectData {
  clientId: number;
  projectName: string;
  description: string;
  projectType: string;
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

export interface FileRecordData {
  projectId: number;
  filename: string;
  originalFilename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileType: string;
  description: string;
  uploadedBy: string;
}

// =====================================================
// CLIENT OPERATIONS
// =====================================================

/** Check if a client already exists by email (case-insensitive). */
export async function findClientByEmail(email: string): Promise<{ id: number } | undefined> {
  const db = getDatabase();
  return db.get<{ id: number }>('SELECT id FROM clients WHERE LOWER(email) = LOWER(?)', [email]);
}

/** Look up an existing client by ID, returning the columns needed for project creation. */
export async function getClientById(clientId: number): Promise<ClientRow | undefined> {
  const db = getDatabase();
  return db.get<ClientRow>(
    'SELECT id, contact_name, company_name, email FROM clients WHERE id = ?',
    [clientId]
  );
}

/** Insert a new client and return the generated ID. */
export async function createClient(data: NewClientData): Promise<number> {
  const db = getDatabase();
  const result = await db.run(
    `INSERT INTO clients (company_name, contact_name, email, phone, password_hash, status, client_type, created_at, updated_at)
     VALUES (?, ?, LOWER(?), ?, '', 'pending', 'business', datetime('now'), datetime('now'))`,
    [data.companyName, data.contactName, data.email, data.phone]
  );
  return result.lastID!;
}

// =====================================================
// PROJECT OPERATIONS
// =====================================================

/** Insert a new project and return the generated ID. */
export async function createProject(data: CreateProjectData): Promise<number> {
  const db = getDatabase();
  const result = await db.run(
    `INSERT INTO projects (
      client_id, project_name, description, status, project_type,
      budget_range, timeline, notes,
      features, page_count, integrations, addons,
      design_level, content_status, brand_assets,
      tech_comfort, hosting_preference, current_site,
      inspiration, challenges, additional_info, referral_source,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      data.clientId, data.projectName, data.description, data.projectType,
      data.budget, data.timeline, data.notes,
      data.features, data.pageCount, data.integrations, data.addons,
      data.designLevel, data.contentStatus, data.brandAssets,
      data.techComfort, data.hostingPreference, data.currentSite,
      data.inspiration, data.challenges, data.additionalInfo, data.referralSource
    ]
  );
  return result.lastID!;
}

/** Insert an initial project update record (e.g. "Project Created"). */
export async function insertProjectUpdateRecord(
  projectId: number,
  title: string,
  description: string,
  updateType: string,
  authorUserId: number | null
): Promise<void> {
  const db = getDatabase();
  await db.run(
    `INSERT INTO project_updates (
      project_id, title, description, update_type, author_user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [projectId, title, description, updateType, authorUserId]
  );
}

// =====================================================
// FILE OPERATIONS
// =====================================================

/** Insert a file record associated with a project. */
export async function insertFileRecord(data: FileRecordData): Promise<void> {
  const db = getDatabase();
  await db.run(
    `INSERT INTO files (
      project_id, filename, original_filename, file_path,
      file_size, mime_type, file_type, description, uploaded_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      data.projectId,
      data.filename,
      data.originalFilename,
      data.filePath,
      data.fileSize,
      data.mimeType,
      data.fileType,
      data.description,
      data.uploadedBy
    ]
  );
}
