/**
 * ===============================================
 * ACCESS CONTROL MIDDLEWARE
 * ===============================================
 * @file server/middleware/access-control.ts
 *
 * Centralized access control helpers for verifying
 * user permissions to access various resources.
 */

import { getDatabase } from '../database/init.js';
import { AuthenticatedRequest } from './auth.js';

/**
 * Check if user is actually an admin (verifies against database, not just JWT)
 * This prevents JWT tampering attacks by double-checking admin status.
 */
export async function isUserAdmin(req: AuthenticatedRequest): Promise<boolean> {
  if (req.user?.type !== 'admin') {
    return false;
  }

  // For admin users with id > 0 (not the special admin account), verify from database
  if (req.user.id > 0) {
    const db = getDatabase();
    const client = await db.get('SELECT is_admin FROM clients WHERE id = ?', [req.user.id]);
    return !!(client && client.is_admin === 1);
  }

  // Admin account (id = 0) is always admin
  return true;
}

/**
 * Check if user can access a specific project
 */
export async function canAccessProject(
  req: AuthenticatedRequest,
  projectId: number
): Promise<boolean> {
  if (await isUserAdmin(req)) {
    return true;
  }

  const db = getDatabase();
  const row = await db.get('SELECT 1 FROM projects WHERE id = ? AND client_id = ?', [
    projectId,
    req.user?.id
  ]);

  return !!row;
}

/**
 * Check if user can access a specific invoice
 */
export async function canAccessInvoice(
  req: AuthenticatedRequest,
  invoiceId: number
): Promise<boolean> {
  if (await isUserAdmin(req)) {
    return true;
  }

  const db = getDatabase();
  const row = await db.get('SELECT 1 FROM invoices WHERE id = ? AND client_id = ?', [
    invoiceId,
    req.user?.id
  ]);

  return !!row;
}

/**
 * Check if user can access a specific file
 */
export async function canAccessFile(
  req: AuthenticatedRequest,
  fileId: number
): Promise<boolean> {
  if (await isUserAdmin(req)) {
    return true;
  }

  const db = getDatabase();
  const row = await db.get(
    `SELECT 1
     FROM files f
     JOIN projects p ON f.project_id = p.id
     WHERE f.id = ? AND p.client_id = ?`,
    [fileId, req.user?.id]
  );

  return !!row;
}

/**
 * Check if user can access a specific folder
 */
export async function canAccessFolder(
  req: AuthenticatedRequest,
  folderId: number
): Promise<boolean> {
  if (await isUserAdmin(req)) {
    return true;
  }

  const db = getDatabase();
  const row = await db.get(
    `SELECT 1
     FROM file_folders ff
     JOIN projects p ON ff.project_id = p.id
     WHERE ff.id = ? AND p.client_id = ?`,
    [folderId, req.user?.id]
  );

  return !!row;
}

/**
 * Check if user can access a specific task
 */
export async function canAccessTask(
  req: AuthenticatedRequest,
  taskId: number
): Promise<boolean> {
  if (await isUserAdmin(req)) {
    return true;
  }

  const db = getDatabase();
  const row = await db.get(
    `SELECT 1
     FROM project_tasks t
     JOIN projects p ON t.project_id = p.id
     WHERE t.id = ? AND p.client_id = ?`,
    [taskId, req.user?.id]
  );

  return !!row;
}

/**
 * Check if user can access a specific milestone
 */
export async function canAccessMilestone(
  req: AuthenticatedRequest,
  milestoneId: number
): Promise<boolean> {
  if (await isUserAdmin(req)) {
    return true;
  }

  const db = getDatabase();
  const row = await db.get(
    `SELECT 1
     FROM milestones m
     JOIN projects p ON m.project_id = p.id
     WHERE m.id = ? AND p.client_id = ?`,
    [milestoneId, req.user?.id]
  );

  return !!row;
}

/**
 * Check if user can access a specific checklist item
 */
export async function canAccessChecklistItem(
  req: AuthenticatedRequest,
  itemId: number
): Promise<boolean> {
  if (await isUserAdmin(req)) {
    return true;
  }

  const db = getDatabase();
  const row = await db.get(
    `SELECT 1
     FROM task_checklist_items i
     JOIN project_tasks t ON i.task_id = t.id
     JOIN projects p ON t.project_id = p.id
     WHERE i.id = ? AND p.client_id = ?`,
    [itemId, req.user?.id]
  );

  return !!row;
}

/**
 * Check if user can access a specific file comment
 */
export async function canAccessFileComment(
  req: AuthenticatedRequest,
  commentId: number
): Promise<boolean> {
  if (await isUserAdmin(req)) {
    return true;
  }

  const db = getDatabase();
  const row = await db.get(
    `SELECT 1
     FROM file_comments fc
     JOIN files f ON fc.file_id = f.id
     JOIN projects p ON f.project_id = p.id
     WHERE fc.id = ? AND p.client_id = ?`,
    [commentId, req.user?.id]
  );

  return !!row;
}

/**
 * Check if user can access a specific message thread
 */
export async function canAccessThread(
  req: AuthenticatedRequest,
  threadId: number
): Promise<boolean> {
  if (await isUserAdmin(req)) {
    return true;
  }

  const db = getDatabase();
  const row = await db.get(
    `SELECT 1
     FROM message_threads mt
     WHERE mt.id = ? AND mt.client_id = ?`,
    [threadId, req.user?.id]
  );

  return !!row;
}

/**
 * Check if user can access a specific document request
 */
export async function canAccessDocumentRequest(
  req: AuthenticatedRequest,
  requestId: number
): Promise<boolean> {
  if (await isUserAdmin(req)) {
    return true;
  }

  const db = getDatabase();
  const row = await db.get(
    `SELECT 1
     FROM document_requests dr
     WHERE dr.id = ? AND dr.client_id = ?`,
    [requestId, req.user?.id]
  );

  return !!row;
}

/**
 * Check if user can access a specific contract
 */
export async function canAccessContract(
  req: AuthenticatedRequest,
  contractId: number
): Promise<boolean> {
  if (await isUserAdmin(req)) {
    return true;
  }

  const db = getDatabase();
  const row = await db.get(
    `SELECT 1
     FROM contracts c
     WHERE c.id = ? AND c.client_id = ?`,
    [contractId, req.user?.id]
  );

  return !!row;
}

/**
 * Get client ID from various entity types
 */
export async function getClientIdFromEntity(
  entityType: 'project' | 'invoice' | 'file' | 'task' | 'milestone' | 'thread',
  entityId: number
): Promise<number | null> {
  const db = getDatabase();

  const queries: Record<string, string> = {
    project: 'SELECT client_id FROM projects WHERE id = ?',
    invoice: 'SELECT client_id FROM invoices WHERE id = ?',
    file: 'SELECT p.client_id FROM files f JOIN projects p ON f.project_id = p.id WHERE f.id = ?',
    task: 'SELECT p.client_id FROM project_tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ?',
    milestone: 'SELECT p.client_id FROM milestones m JOIN projects p ON m.project_id = p.id WHERE m.id = ?',
    thread: 'SELECT client_id FROM message_threads WHERE id = ?'
  };

  const query = queries[entityType];
  if (!query) return null;

  const row = await db.get(query, [entityId]) as { client_id?: number } | undefined;
  return row?.client_id ?? null;
}
