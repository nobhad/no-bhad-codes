/**
 * ===============================================
 * UPLOAD SERVICE
 * ===============================================
 * Database operations for file upload CRUD:
 * inserting file records, retrieving by project/client,
 * fetching individual files with access info, and
 * updating client avatars.
 */

import { getDatabase } from '../database/init.js';
import { FileRow, ProjectRow } from '../routes/uploads/shared.js';

// ============================================
// Types
// ============================================

/** Row returned when looking up a file with its owning client */
export interface FileWithClientRow extends FileRow {
  [key: string]: unknown;
  client_id?: number;
  uploaded_by: string;
  file_path: string;
  original_filename: string;
  mime_type: string;
}

/** Parameters for inserting a new file record */
interface InsertFileParams {
  projectId: number | null;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  uploadedBy: string;
}

/** Filter options for the client files query */
interface ClientFileFilters {
  projectId?: number;
  fileType?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ============================================
// Service
// ============================================

/** Find the most recent project belonging to a client */
async function findDefaultProjectForClient(clientId: number | string): Promise<number | null> {
  const db = getDatabase();
  const project = await db.get<{ id: number }>(
    'SELECT id FROM projects WHERE client_id = ? ORDER BY created_at DESC LIMIT 1',
    [clientId]
  );
  return project?.id ?? null;
}

/** Insert a file record and return its new row ID */
async function insertFileRecord(params: InsertFileParams): Promise<number | undefined> {
  const db = getDatabase();
  const result = await db.run(
    `INSERT INTO files (project_id, filename, original_filename, mime_type, file_size, file_path, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      params.projectId,
      params.filename,
      params.originalFilename,
      params.mimeType,
      params.fileSize,
      params.filePath,
      params.uploadedBy
    ]
  );
  return result.lastID;
}

/** Update a client's avatar URL */
async function updateClientAvatar(clientId: number | string, avatarUrl: string): Promise<void> {
  const db = getDatabase();
  await db.run(
    'UPDATE clients SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [avatarUrl, clientId]
  );
}

/** Fetch all non-deleted files for a project */
async function getFilesByProject(projectId: number): Promise<FileRow[]> {
  const db = getDatabase();
  const files = await db.all<FileRow>(
    `SELECT id, project_id, filename, original_filename, mime_type, file_size, file_path, uploaded_by, created_at, description, shared_with_client, shared_at, shared_by
     FROM files
     WHERE project_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [projectId]
  );
  return files;
}

/** Fetch files visible to a client, with optional filters, plus their project list */
async function getClientFiles(
  clientId: number | string,
  filters: ClientFileFilters
): Promise<{ files: FileRow[]; projects: ProjectRow[] }> {
  const db = getDatabase();

  let query = `
    SELECT f.id, f.project_id, f.filename, f.original_filename, f.mime_type, f.file_size,
           f.file_path, f.uploaded_by, f.created_at, f.file_type, f.category,
           f.shared_with_client, f.shared_at,
           p.project_name as project_name
    FROM files f
    LEFT JOIN projects p ON f.project_id = p.id
    WHERE f.deleted_at IS NULL
      AND (f.uploaded_by = ? OR (p.client_id = ? AND f.shared_with_client = TRUE))
  `;
  const params: (string | number)[] = [clientId, clientId];

  if (filters.projectId) {
    query += ' AND f.project_id = ?';
    params.push(filters.projectId);
  }

  if (filters.fileType && filters.fileType !== 'all') {
    query += ' AND f.file_type = ?';
    params.push(filters.fileType);
  }

  if (filters.category && filters.category !== 'all') {
    query += ' AND f.category = ?';
    params.push(filters.category);
  }

  if (filters.dateFrom) {
    query += ' AND date(f.created_at) >= date(?)';
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    query += ' AND date(f.created_at) <= date(?)';
    params.push(filters.dateTo);
  }

  query += ' ORDER BY f.created_at DESC';

  const files = await db.all<FileRow>(query, params);

  const projects = await db.all<ProjectRow>(
    `SELECT DISTINCT p.id, p.project_name
     FROM projects p
     WHERE p.client_id = ?
     ORDER BY p.project_name`,
    [clientId]
  );

  return { files, projects };
}

/** Fetch a single file record with its owning client_id (for access checks) */
async function getFileWithClient(fileId: number): Promise<FileWithClientRow | undefined> {
  const db = getDatabase();
  const file = await db.get<FileWithClientRow>(
    `SELECT f.*, p.client_id
     FROM files f
     LEFT JOIN projects p ON f.project_id = p.id
     WHERE f.id = ? AND f.deleted_at IS NULL`,
    [fileId]
  );
  return file ?? undefined;
}

/** Find a non-deleted file by ID (returns id and project_id) */
async function findActiveFileById(fileId: number): Promise<{ id: number; project_id: number } | undefined> {
  const db = getDatabase();
  const file = await db.get<{ id: number; project_id: number }>(
    'SELECT id, project_id FROM files WHERE id = ? AND deleted_at IS NULL',
    [fileId]
  );
  return file ?? undefined;
}

/** Mark a file as shared with the client */
async function shareFileWithClient(fileId: number, sharedBy: string): Promise<void> {
  const db = getDatabase();
  await db.run(
    `UPDATE files
     SET shared_with_client = TRUE,
         shared_at = datetime('now'),
         shared_by = ?
     WHERE id = ?`,
    [sharedBy, fileId]
  );
}

/** Revoke client sharing on a file */
async function unshareFileWithClient(fileId: number): Promise<void> {
  const db = getDatabase();
  await db.run(
    `UPDATE files
     SET shared_with_client = FALSE,
         shared_at = NULL,
         shared_by = NULL
     WHERE id = ?`,
    [fileId]
  );
}

/** Check whether a project belongs to a given client */
async function isProjectOwnedByClient(projectId: number, clientId: number | string): Promise<boolean> {
  const db = getDatabase();
  const row = await db.get<{ '1': number }>(
    'SELECT 1 FROM projects WHERE id = ? AND client_id = ?',
    [projectId, clientId]
  );
  return !!row;
}

/** Check whether a client can access a specific file (owner or shared) */
async function canClientAccessFile(
  fileId: number,
  userId: number | string,
  userEmail: string
): Promise<boolean> {
  const db = getDatabase();
  const row = await db.get<{ '1': number }>(
    `SELECT 1
     FROM files f
     LEFT JOIN projects p ON f.project_id = p.id
     WHERE f.id = ? AND f.deleted_at IS NULL
       AND (
         f.uploaded_by = ?
         OR f.uploaded_by = ?
         OR f.uploaded_by = ?
         OR (p.client_id = ? AND f.shared_with_client = TRUE)
       )`,
    [fileId, userEmail, userId, String(userId), userId]
  );
  return !!row;
}

export const uploadService = {
  findDefaultProjectForClient,
  insertFileRecord,
  updateClientAvatar,
  getFilesByProject,
  getClientFiles,
  getFileWithClient,
  findActiveFileById,
  shareFileWithClient,
  unshareFileWithClient,
  isProjectOwnedByClient,
  canClientAccessFile
};
