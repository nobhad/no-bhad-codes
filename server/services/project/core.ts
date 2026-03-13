/**
 * ===============================================
 * PROJECT — CORE CRUD OPERATIONS
 * ===============================================
 * Project listing, detail retrieval, creation, updates,
 * and related file-record persistence.
 */

import { getDatabase } from '../../database/init.js';
import type { SqlParam, DatabaseRow } from '../../database/init.js';
import { notDeleted } from '../../database/query-helpers.js';

// =====================================================
// COLUMN CONSTANTS
// =====================================================

const PROJECT_COLUMNS = `
  id, client_id, project_name, description, status, priority, progress,
  start_date, estimated_end_date, actual_end_date, budget_range, project_type,
  timeline, preview_url, price, notes, repository_url, staging_url, production_url,
  deposit_amount, contract_signed_at, cancelled_by, cancellation_reason,
  default_deposit_percentage, hourly_rate, estimated_hours, actual_hours, template_id,
  features, design_level, content_status, tech_comfort, hosting_preference,
  page_count, integrations, brand_assets, inspiration, current_site, challenges,
  additional_info, addons, referral_source, contract_reminders_enabled,
  deleted_at, deleted_by, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

// =====================================================
// INTERFACES
// =====================================================

/** Shape returned by the projects-with-stats queries (list endpoints). */
export interface ProjectRow extends DatabaseRow {}

/** Shape for project files returned by getProjectFiles. */
export interface ProjectFileRow {
  id: number;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
}

/** Shape for project messages returned by getProjectMessages. */
export interface ProjectMessageRow {
  id: number;
  sender_type: string;
  sender_name: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

/** Shape for project updates returned by getProjectUpdates. */
export interface ProjectUpdateRow {
  id: number;
  title: string;
  description: string;
  update_type: string;
  created_at: string;
}

/** Shape for the client-info lookup. */
export interface ClientInfoRow extends DatabaseRow {
  id?: number;
  email: string;
  contact_name: string;
  company_name: string;
}

/** Parameters for inserting a client-submitted project request. */
export interface ProjectRequestData {
  clientId: number;
  name: string;
  description: string;
  projectType: string;
  budget: string | null;
  timeline: string | null;
}

/** Parameters for admin project creation. */
export interface AdminProjectCreateData {
  clientId: number;
  name: string;
  description: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  budget: string | null;
}

/** Parameters for a saved-file record (report/SOW PDFs). */
export interface SaveFileRecordData {
  projectId: number;
  filename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileType: string;
  description: string;
  uploadedBy: string;
  category: string;
  sharedWithClient: boolean;
}

// =====================================================
// LIST QUERIES
// =====================================================

/** Fetch all projects with stats (admin view — includes client info). */
export async function listProjectsAdmin(): Promise<ProjectRow[]> {
  const db = getDatabase();
  const query = `
    SELECT
      p.*,
      p.estimated_end_date as end_date,
      p.repository_url as repo_url,
      p.contract_signed_at as contract_signed_date,
      p.budget_range as budget,
      c.company_name,
      c.contact_name,
      c.email as client_email,
      COALESCE(f_stats.file_count, 0) as file_count,
      COALESCE(m_stats.message_count, 0) as message_count,
      COALESCE(m_stats.unread_count, 0) as unread_count
    FROM projects p
    JOIN clients c ON p.client_id = c.id AND ${notDeleted('c')}
    LEFT JOIN (
      SELECT project_id, COUNT(*) as file_count
      FROM files
      WHERE deleted_at IS NULL
      GROUP BY project_id
    ) f_stats ON p.id = f_stats.project_id
    LEFT JOIN (
      SELECT project_id,
             COUNT(*) as message_count,
             SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) as unread_count
      FROM messages
      WHERE deleted_at IS NULL
      GROUP BY project_id
    ) m_stats ON p.id = m_stats.project_id
    WHERE ${notDeleted('p')}
    ORDER BY p.created_at DESC
  `;
  return (await db.all(query)) as ProjectRow[];
}

/** Fetch projects for a specific client (with stats). */
export async function listProjectsForClient(clientId: number): Promise<ProjectRow[]> {
  const db = getDatabase();
  const query = `
    SELECT
      p.*,
      p.estimated_end_date as end_date,
      p.repository_url as repo_url,
      p.contract_signed_at as contract_signed_date,
      p.budget_range as budget,
      COALESCE(f_stats.file_count, 0) as file_count,
      COALESCE(m_stats.message_count, 0) as message_count,
      COALESCE(m_stats.unread_count, 0) as unread_count
    FROM projects p
    LEFT JOIN (
      SELECT project_id, COUNT(*) as file_count
      FROM files
      WHERE deleted_at IS NULL
      GROUP BY project_id
    ) f_stats ON p.id = f_stats.project_id
    LEFT JOIN (
      SELECT project_id,
             COUNT(*) as message_count,
             SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) as unread_count
      FROM messages
      WHERE deleted_at IS NULL
      GROUP BY project_id
    ) m_stats ON p.id = m_stats.project_id
    WHERE p.client_id = ? AND ${notDeleted('p')}
    ORDER BY p.created_at DESC
  `;
  return (await db.all(query, [clientId])) as ProjectRow[];
}

// =====================================================
// SINGLE PROJECT DETAIL
// =====================================================

/** Fetch a single project with client info (admin view). */
export async function getProjectAdmin(projectId: number): Promise<ProjectRow | undefined> {
  const db = getDatabase();
  const query = `
    SELECT
      p.*,
      p.estimated_end_date as end_date,
      p.repository_url as repo_url,
      p.contract_signed_at as contract_signed_date,
      p.budget_range as budget,
      c.company_name, c.contact_name, c.email as client_email
    FROM projects p
    JOIN clients c ON p.client_id = c.id AND ${notDeleted('c')}
    WHERE p.id = ? AND ${notDeleted('p')}
  `;
  return (await db.get(query, [projectId])) as ProjectRow | undefined;
}

/** Fetch a single project scoped to a client (client view). */
export async function getProjectForClient(
  projectId: number,
  clientId: number
): Promise<ProjectRow | undefined> {
  const db = getDatabase();
  const query = `
    SELECT
      p.*,
      p.estimated_end_date as end_date,
      p.repository_url as repo_url,
      p.contract_signed_at as contract_signed_date,
      p.budget_range as budget
    FROM projects p
    WHERE p.id = ? AND p.client_id = ? AND ${notDeleted('p')}
  `;
  return (await db.get(query, [projectId, clientId])) as ProjectRow | undefined;
}

/** Fetch files for a project. */
export async function getProjectFiles(projectId: number): Promise<ProjectFileRow[]> {
  const db = getDatabase();
  return (await db.all(
    `SELECT id, filename, original_filename, file_size, mime_type, uploaded_by, created_at
     FROM files
     WHERE project_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [projectId]
  )) as ProjectFileRow[];
}

/** Fetch messages for a project (project-context only). */
export async function getProjectMessages(projectId: number): Promise<ProjectMessageRow[]> {
  const db = getDatabase();
  return (await db.all(
    `SELECT id, sender_type, sender_name, message as content, read_at, created_at
     FROM active_messages
     WHERE project_id = ? AND context_type = 'project'
     ORDER BY created_at ASC`,
    [projectId]
  )) as ProjectMessageRow[];
}

/** Fetch updates for a project. */
export async function getProjectUpdates(projectId: number): Promise<ProjectUpdateRow[]> {
  const db = getDatabase();
  return (await db.all(
    `SELECT id, title, description, update_type, created_at
     FROM project_updates
     WHERE project_id = ?
     ORDER BY created_at DESC`,
    [projectId]
  )) as ProjectUpdateRow[];
}

// =====================================================
// PROJECT CREATION
// =====================================================

/** Insert a client-submitted project request and return the new row. */
export async function createProjectRequest(
  data: ProjectRequestData
): Promise<{ lastID: number; project: ProjectRow }> {
  const db = getDatabase();
  const result = await db.run(
    `INSERT INTO projects (client_id, name, description, status, priority, project_type, budget_range, timeline)
     VALUES (?, ?, ?, 'pending', 'medium', ?, ?, ?)`,
    [data.clientId, data.name, data.description, data.projectType, data.budget, data.timeline]
  );
  const project = await db.get(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ?`, [
    result.lastID
  ]);
  return { lastID: result.lastID!, project: project as ProjectRow };
}

/** Verify a client exists. Returns the client row or undefined. */
export async function getClientById(
  clientId: number
): Promise<{ id: number } | undefined> {
  const db = getDatabase();
  return (await db.get('SELECT id FROM clients WHERE id = ?', [clientId])) as
    | { id: number }
    | undefined;
}

/** Insert an admin-created project and return the new row. */
export async function createProjectAdmin(
  data: AdminProjectCreateData
): Promise<{ lastID: number; project: ProjectRow }> {
  const db = getDatabase();
  const result = await db.run(
    `INSERT INTO projects (client_id, project_name, description, priority, start_date, estimated_end_date, budget_range)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.clientId,
      data.name,
      data.description,
      data.priority,
      data.startDate,
      data.dueDate,
      data.budget
    ]
  );
  const project = await db.get(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ?`, [
    result.lastID
  ]);
  return { lastID: result.lastID!, project: project as ProjectRow };
}

// =====================================================
// PROJECT UPDATE
// =====================================================

/** Fetch a project by ID (admin — no client scoping). */
export async function getProjectByIdAdmin(projectId: number): Promise<ProjectRow | undefined> {
  const db = getDatabase();
  return (await db.get(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ?`, [
    projectId
  ])) as ProjectRow | undefined;
}

/** Fetch a project by ID scoped to a client. */
export async function getProjectByIdForClient(
  projectId: number,
  clientId: number
): Promise<ProjectRow | undefined> {
  const db = getDatabase();
  return (await db.get(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ? AND client_id = ?`,
    [projectId, clientId]
  )) as ProjectRow | undefined;
}

/** Check whether a project exists by ID. */
export async function projectExists(projectId: number): Promise<boolean> {
  const db = getDatabase();
  const row = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
  return Boolean(row);
}

/** Run a dynamic UPDATE on the projects table. */
export async function updateProject(
  projectId: number,
  setClauses: string[],
  values: SqlParam[]
): Promise<void> {
  const db = getDatabase();
  await db.run(
    `UPDATE projects SET ${setClauses.join(', ')} WHERE id = ?`,
    [...values, projectId]
  );
}

/** Mark a project as completed (set actual_end_date). */
export async function setProjectCompletedDate(projectId: number): Promise<void> {
  const db = getDatabase();
  await db.run(
    'UPDATE projects SET actual_end_date = CURRENT_TIMESTAMP WHERE id = ?',
    [projectId]
  );
}

/** Fetch the updated project row with alias columns for API response. */
export async function getUpdatedProject(projectId: number): Promise<ProjectRow | undefined> {
  const db = getDatabase();
  return (await db.get(
    `SELECT
       p.*,
       p.estimated_end_date as end_date,
       p.repository_url as repo_url,
       p.contract_signed_at as contract_signed_date,
       p.budget_range as budget
     FROM projects p
     WHERE p.id = ?`,
    [projectId]
  )) as ProjectRow | undefined;
}

// =====================================================
// CLIENT INFO
// =====================================================

/** Fetch client contact info by ID. */
export async function getClientInfo(
  clientId: number
): Promise<ClientInfoRow | undefined> {
  const db = getDatabase();
  return (await db.get(
    'SELECT email, contact_name, company_name FROM clients WHERE id = ?',
    [clientId]
  )) as ClientInfoRow | undefined;
}

// =====================================================
// FILE RECORDS
// =====================================================

/** Insert a file record (for saved PDFs, etc.) and return the new row ID. */
export async function saveFileRecord(data: SaveFileRecordData): Promise<number> {
  const db = getDatabase();
  const result = await db.run(
    `INSERT INTO files (
       project_id, filename, original_filename, file_path, file_size, mime_type,
       file_type, description, uploaded_by, category, shared_with_client
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.projectId,
      data.filename,
      data.filename,
      data.filePath,
      data.fileSize,
      data.mimeType,
      data.fileType,
      data.description,
      data.uploadedBy,
      data.category,
      data.sharedWithClient
    ]
  );
  return result.lastID!;
}

// =====================================================
// PROJECT DASHBOARD / ACTIVITY
// =====================================================

/**
 * Get the full project dashboard data (project details, stats, milestones, updates, messages).
 * Used by GET /projects/:id/dashboard.
 */
export async function getProjectDashboard(
  projectId: number,
  isAdmin: boolean,
  clientId?: number
): Promise<{
  project: Record<string, unknown>;
  stats: Record<string, unknown>;
  progressPercentage: number;
  upcomingMilestones: Record<string, unknown>[];
  recentUpdates: Record<string, unknown>[];
  recentMessages: Record<string, unknown>[];
} | null> {
  const db = getDatabase();
  const projectCols = PROJECT_COLUMNS.split(', ').map(c => `p.${c}`).join(', ');

  const project = isAdmin
    ? await db.get(
      `SELECT ${projectCols}, c.company_name, c.contact_name, c.email as client_email
         FROM projects p JOIN clients c ON p.client_id = c.id WHERE p.id = ?`,
      [projectId]
    )
    : await db.get(
      `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ? AND client_id = ?`,
      [projectId, clientId]
    );

  if (!project) return null;

  const stats = await db.get(`
    SELECT
      COUNT(DISTINCT m.id) as total_milestones,
      COUNT(DISTINCT CASE WHEN m.is_completed = 1 THEN m.id END) as completed_milestones,
      COUNT(DISTINCT f.id) as total_files,
      COUNT(DISTINCT msg.id) as total_messages,
      COUNT(DISTINCT CASE WHEN msg.read_at IS NULL THEN msg.id END) as unread_messages,
      COUNT(DISTINCT u.id) as total_updates
    FROM projects p
    LEFT JOIN milestones m ON p.id = m.project_id
    LEFT JOIN files f ON p.id = f.project_id
    LEFT JOIN messages msg ON p.id = msg.project_id
    LEFT JOIN project_updates u ON p.id = u.project_id
    WHERE p.id = ?
  `, [projectId]);

  const upcomingMilestones = await db.all(`
    SELECT id, title, description, due_date, is_completed
    FROM milestones
    WHERE project_id = ? AND is_completed = 0 AND deleted_at IS NULL
    ORDER BY due_date ASC LIMIT 3
  `, [projectId]);

  const recentUpdates = await db.all(`
    SELECT pu.id, pu.title, pu.description, pu.update_type, u.display_name as author, pu.created_at
    FROM project_updates pu
    LEFT JOIN users u ON pu.author_user_id = u.id
    WHERE pu.project_id = ?
    ORDER BY pu.created_at DESC LIMIT 5
  `, [projectId]);

  const recentMessages = await db.all(`
    SELECT id, sender_type, sender_name, message, read_at, created_at
    FROM messages WHERE project_id = ?
    ORDER BY created_at DESC LIMIT 5
  `, [projectId]);

  const s = (stats || {}) as Record<string, unknown>;
  const totalMilestones = Number(s.total_milestones) || 0;
  const completedMilestones = Number(s.completed_milestones) || 0;
  const projectProgress = Number((project as Record<string, unknown>).progress) || 0;
  const progressPercentage = totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : projectProgress || 0;

  return {
    project: project as Record<string, unknown>,
    stats: (stats || {}) as Record<string, unknown>,
    progressPercentage,
    upcomingMilestones: upcomingMilestones as Record<string, unknown>[],
    recentUpdates: recentUpdates as Record<string, unknown>[],
    recentMessages: recentMessages as Record<string, unknown>[]
  };
}

/**
 * Add a project update (admin only).
 * Returns the newly created update row.
 */
export async function addProjectUpdate(params: {
  projectId: number;
  title: string;
  description: string | null;
  updateType: string;
  authorUserId: number | null;
}): Promise<Record<string, unknown> | undefined> {
  const db = getDatabase();

  const result = await db.run(
    `INSERT INTO project_updates (project_id, title, description, update_type, author_user_id)
     VALUES (?, ?, ?, ?, ?)`,
    [params.projectId, params.title, params.description, params.updateType, params.authorUserId]
  );

  return db.get(
    `SELECT pu.id, pu.title, pu.description, pu.update_type, u.display_name as author, pu.created_at
     FROM project_updates pu
     LEFT JOIN users u ON pu.author_user_id = u.id
     WHERE pu.id = ?`,
    [result.lastID]
  ) as Promise<Record<string, unknown> | undefined>;
}
