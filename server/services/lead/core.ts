/**
 * ===============================================
 * LEAD — CORE CRUD
 * ===============================================
 * Lead listing, contact submissions, status updates,
 * invitation helpers, and activation.
 */

import { getDatabase } from '../../database/init.js';
import type { SqlParam } from './types.js';

// =====================================================
// Types
// =====================================================

export interface LeadRow {
  id: number;
  client_id: number | null;
  project_name: string;
  description: string | null;
  status: string;
  project_type: string | null;
  budget_range: string | null;
  timeline: string | null;
  created_at: string;
  start_date: string | null;
  end_date: string | null;
  price: number | null;
  preview_url: string | null;
  notes: string | null;
  repo_url: string | null;
  production_url: string | null;
  deposit_amount: number | null;
  contract_signed_date: string | null;
  progress: number | null;
  contact_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
}

export interface LeadStats {
  total: number;
  new: number;
  inProgress: number;
  converted: number;
}

export interface ContactSubmissionRow {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  message: string | null;
  status: string;
  message_id: string | null;
  created_at: string;
  read_at: string | null;
  replied_at: string | null;
}

export interface ContactSubmissionStats {
  total: number;
  new: number;
  read: number;
  replied: number;
  archived: number;
}

export interface ContactSubmissionFull {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  message: string | null;
  status: string;
  ip_address: string | null;
  user_agent: string | null;
  message_id: string | null;
  created_at: string;
  updated_at: string | null;
  read_at: string | null;
  replied_at: string | null;
  client_id: number | null;
  converted_at: string | null;
}

export interface ExistingClientRow {
  id: number;
  contact_name: string;
  email: string;
}

export interface LeadWithClientRow {
  id: number;
  project_name: string;
  description: string | null;
  project_type: string | null;
  budget_range: string | null;
  timeline: string | null;
  features: string | null;
  client_id: number | null;
  email: string | null;
  contact_name: string | null;
  company_name: string | null;
  phone: string | null;
}

export interface ExistingClientInvitationRow {
  id: number;
  invitation_token: string | null;
}

export interface ProjectStatusRow {
  id: number;
  status: string;
  project_name?: string;
}

// =====================================================
// Constants
// =====================================================

const MAX_LEADS = 500;
const MAX_SUBMISSIONS = 500;

const CONTACT_SUBMISSION_COLUMNS = `
  id, name, email, subject, message, status, ip_address, user_agent,
  message_id, created_at, updated_at, read_at, replied_at, client_id, converted_at
`.replace(/\s+/g, ' ').trim();

// =====================================================
// Lead Listing
// =====================================================

export async function getLeadsWithClients(): Promise<LeadRow[]> {
  const db = getDatabase();
  return db.all<LeadRow>(`
    SELECT
      p.id,
      p.client_id,
      p.project_name,
      p.description,
      p.status,
      p.project_type,
      p.budget_range,
      p.timeline,
      p.created_at,
      p.start_date,
      p.estimated_end_date as end_date,
      p.price,
      p.preview_url,
      p.notes,
      p.repository_url as repo_url,
      p.production_url,
      p.deposit_amount,
      p.contract_signed_at as contract_signed_date,
      p.progress,
      c.contact_name,
      c.company_name,
      c.email,
      c.phone
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    ORDER BY p.created_at DESC
    LIMIT ?
  `, [MAX_LEADS]);
}

export async function getLeadStats(): Promise<LeadStats> {
  const db = getDatabase();
  const stats = await db.get<LeadStats>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new,
      SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted
    FROM projects
  `);
  return {
    total: stats?.total || 0,
    new: stats?.new || 0,
    inProgress: stats?.inProgress || 0,
    converted: stats?.converted || 0
  };
}

// =====================================================
// Contact Submissions
// =====================================================

export async function getContactSubmissions(): Promise<ContactSubmissionRow[]> {
  const db = getDatabase();
  return db.all<ContactSubmissionRow>(`
    SELECT
      id, name, email, subject, message, status,
      message_id, created_at, read_at, replied_at
    FROM contact_submissions
    ORDER BY created_at DESC
    LIMIT ?
  `, [MAX_SUBMISSIONS]);
}

export async function getContactSubmissionStats(): Promise<ContactSubmissionStats> {
  const db = getDatabase();
  const stats = await db.get<ContactSubmissionStats>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new,
      SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
      SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
      SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
    FROM contact_submissions
  `);
  return {
    total: stats?.total || 0,
    new: stats?.new || 0,
    read: stats?.read || 0,
    replied: stats?.replied || 0,
    archived: stats?.archived || 0
  };
}

export async function updateContactSubmissionStatus(
  id: string,
  status: string
): Promise<void> {
  const db = getDatabase();

  let updateFields = 'status = ?, updated_at = CURRENT_TIMESTAMP';
  const values: SqlParam[] = [status];

  if (status === 'read') {
    updateFields += ', read_at = CURRENT_TIMESTAMP';
  } else if (status === 'replied') {
    updateFields += ', replied_at = CURRENT_TIMESTAMP';
  }

  values.push(id);
  await db.run(`UPDATE contact_submissions SET ${updateFields} WHERE id = ?`, values);
}

export async function getContactSubmissionById(
  id: string
): Promise<ContactSubmissionFull | undefined> {
  const db = getDatabase();
  return db.get<ContactSubmissionFull>(
    `SELECT ${CONTACT_SUBMISSION_COLUMNS} FROM contact_submissions WHERE id = ?`,
    [id]
  );
}

export async function findClientByEmail(
  email: string
): Promise<ExistingClientRow | undefined> {
  const db = getDatabase();
  return db.get<ExistingClientRow>(
    'SELECT id, contact_name, email FROM clients WHERE LOWER(email) = LOWER(?)',
    [email]
  );
}

export async function createClientFromContact(params: {
  email: string;
  name: string;
  invitationToken: string | null;
  expiresAt: string | null;
  sendInvitation: boolean;
}): Promise<number> {
  const db = getDatabase();
  const result = await db.run(
    `INSERT INTO clients (
      email, password_hash, contact_name, company_name, phone,
      status, client_type, invitation_token, invitation_expires_at,
      invitation_sent_at, created_at, updated_at
    ) VALUES (
      LOWER(?), '', ?, ?, ?, 'pending', 'business', ?, ?,
      ${params.sendInvitation ? 'CURRENT_TIMESTAMP' : 'NULL'},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )`,
    [
      params.email,
      params.name,
      null, // company_name - not available from contact form
      null, // phone - not available from contact form
      params.invitationToken,
      params.expiresAt
    ]
  );
  return result.lastID!;
}

export async function markContactAsConverted(
  contactId: string,
  clientId: number
): Promise<void> {
  const db = getDatabase();
  await db.run(
    `UPDATE contact_submissions
     SET client_id = ?, converted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [clientId, contactId]
  );
}

// =====================================================
// Lead Status Updates
// =====================================================

export async function getProjectById(
  id: string
): Promise<ProjectStatusRow | undefined> {
  const db = getDatabase();
  return db.get<ProjectStatusRow>(
    'SELECT id, status FROM projects WHERE id = ?',
    [id]
  );
}

export async function updateProjectStatus(
  id: string,
  status: string,
  cancelledBy?: string | null,
  cancellationReason?: string | null
): Promise<void> {
  const db = getDatabase();
  if (status === 'cancelled') {
    await db.run(
      'UPDATE projects SET status = ?, cancelled_by = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, cancelledBy || null, cancellationReason || null, id]
    );
  } else {
    await db.run(
      'UPDATE projects SET status = ?, cancelled_by = NULL, cancellation_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );
  }
}

// =====================================================
// Lead Invitation
// =====================================================

export async function getLeadWithClient(
  id: string
): Promise<LeadWithClientRow | undefined> {
  const db = getDatabase();
  return db.get<LeadWithClientRow>(`
    SELECT
      p.id,
      p.project_name,
      p.description,
      p.project_type,
      p.budget_range,
      p.timeline,
      p.features,
      p.client_id,
      c.email,
      c.contact_name,
      c.company_name,
      c.phone
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.id = ?
  `, [id]);
}

export async function findClientByExactEmail(
  email: string
): Promise<ExistingClientInvitationRow | undefined> {
  const db = getDatabase();
  return db.get<ExistingClientInvitationRow>(
    'SELECT id, invitation_token FROM clients WHERE email = ?',
    [email]
  );
}

export async function updateClientInvitation(
  clientId: number,
  invitationToken: string,
  expiresAt: string
): Promise<void> {
  const db = getDatabase();
  await db.run(
    `UPDATE clients
     SET invitation_token = ?, invitation_expires_at = ?, invitation_sent_at = CURRENT_TIMESTAMP, status = 'pending'
     WHERE id = ?`,
    [invitationToken, expiresAt, clientId]
  );
}

export async function createClientFromLead(params: {
  email: string;
  contactName: string | null;
  companyName: string | null;
  phone: string | null;
  invitationToken: string;
  expiresAt: string;
}): Promise<number> {
  const db = getDatabase();
  const result = await db.run(
    `INSERT INTO clients (email, password_hash, contact_name, company_name, phone, status, invitation_token, invitation_expires_at, invitation_sent_at)
     VALUES (?, '', ?, ?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP)`,
    [params.email, params.contactName, params.companyName, params.phone, params.invitationToken, params.expiresAt]
  );
  return result.lastID || 0;
}

export async function linkProjectToClient(
  projectId: string,
  clientId: number
): Promise<void> {
  const db = getDatabase();
  await db.run('UPDATE projects SET client_id = ? WHERE id = ?', [clientId, projectId]);
}

export async function updateProjectStatusToConverted(
  projectId: string
): Promise<void> {
  const db = getDatabase();
  await db.run('UPDATE projects SET status = ? WHERE id = ?', ['converted', projectId]);
}

// =====================================================
// Lead Activation
// =====================================================

export async function getProjectForActivation(
  id: string
): Promise<ProjectStatusRow | undefined> {
  const db = getDatabase();
  return db.get<ProjectStatusRow>(
    'SELECT id, status, project_name FROM projects WHERE id = ?',
    [id]
  );
}

export async function activateProject(id: string): Promise<void> {
  const db = getDatabase();
  await db.run(
    'UPDATE projects SET status = ?, start_date = date(\'now\'), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['converted', id]
  );
}
