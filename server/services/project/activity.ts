/**
 * ===============================================
 * PROJECT — ACTIVITY & DASHBOARD
 * ===============================================
 * Project updates CRUD and dashboard data aggregation.
 */

import { getDatabase } from '../../database/init.js';
import { getNumber } from '../../database/row-helpers.js';
import { userService } from '../user-service.js';

// =====================================================
// TYPES
// =====================================================

export interface ProjectUpdate {
  id: number;
  title: string;
  description: string | null;
  update_type: string;
  author: string | null;
  created_at: string;
}

export interface ProjectStats {
  total_milestones: number;
  completed_milestones: number;
  total_files: number;
  total_messages: number;
  unread_messages: number;
  total_updates: number;
}

export interface UpcomingMilestone {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: number;
}

export interface RecentMessage {
  id: number;
  sender_type: string;
  sender_name: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface DashboardData {
  project: Record<string, unknown>;
  stats: Record<string, unknown>;
  progressPercentage: number;
  upcomingMilestones: UpcomingMilestone[];
  recentUpdates: ProjectUpdate[];
  recentMessages: RecentMessage[];
}

const VALID_UPDATE_TYPES = ['progress', 'milestone', 'issue', 'resolution', 'general'] as const;
export type UpdateType = (typeof VALID_UPDATE_TYPES)[number];

/** Explicit column list for project SELECT queries (avoid SELECT *) */
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
// VALIDATION
// =====================================================

export function isValidUpdateType(type: string): type is UpdateType {
  return (VALID_UPDATE_TYPES as readonly string[]).includes(type);
}

// =====================================================
// PROJECT EXISTENCE
// =====================================================

export async function projectExists(projectId: number): Promise<boolean> {
  const db = getDatabase();
  const row = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
  return !!row;
}

// =====================================================
// PROJECT UPDATES
// =====================================================

interface CreateUpdateParams {
  projectId: number;
  title: string;
  description: string | null;
  updateType: UpdateType;
  author: string;
}

export async function createProjectUpdate(params: CreateUpdateParams): Promise<ProjectUpdate> {
  const { projectId, title, description, updateType, author } = params;
  const db = getDatabase();

  const authorUserId = await userService.getUserIdByEmailOrName(author);

  const result = await db.run(
    `INSERT INTO project_updates (project_id, title, description, update_type, author_user_id)
     VALUES (?, ?, ?, ?, ?)`,
    [projectId, title, description, updateType, authorUserId]
  );

  const newUpdate = await db.get(
    `SELECT pu.id, pu.title, pu.description, pu.update_type, u.display_name as author, pu.created_at
     FROM project_updates pu
     LEFT JOIN users u ON pu.author_user_id = u.id
     WHERE pu.id = ?`,
    [result.lastID]
  );

  return newUpdate as unknown as ProjectUpdate;
}

// =====================================================
// DASHBOARD
// =====================================================

interface GetDashboardProjectParams {
  projectId: number;
  isAdmin: boolean;
  clientId: number;
}

export async function getDashboardProject(
  params: GetDashboardProjectParams
): Promise<Record<string, unknown> | null> {
  const { projectId, isAdmin, clientId } = params;
  const db = getDatabase();

  if (isAdmin) {
    const projectCols = PROJECT_COLUMNS.split(', ').map(c => `p.${c}`).join(', ');
    const row = await db.get(
      `SELECT ${projectCols}, c.company_name, c.contact_name, c.email as client_email
       FROM projects p JOIN clients c ON p.client_id = c.id WHERE p.id = ?`,
      [projectId]
    );
    return (row as unknown as Record<string, unknown>) ?? null;
  }

  const row = await db.get(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ? AND client_id = ?`,
    [projectId, clientId]
  );
  return (row as unknown as Record<string, unknown>) ?? null;
}

export async function getProjectStats(projectId: number): Promise<Record<string, unknown>> {
  const db = getDatabase();
  const stats = await db.get(
    `SELECT
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
    WHERE p.id = ?`,
    [projectId]
  );
  return stats as unknown as Record<string, unknown>;
}

export async function getUpcomingMilestones(
  projectId: number,
  limit: number = 3
): Promise<UpcomingMilestone[]> {
  const db = getDatabase();
  const rows = await db.all(
    `SELECT id, title, description, due_date, is_completed
     FROM milestones
     WHERE project_id = ? AND is_completed = 0 AND deleted_at IS NULL
     ORDER BY due_date ASC
     LIMIT ?`,
    [projectId, limit]
  );
  return rows as unknown as UpcomingMilestone[];
}

export async function getRecentUpdates(
  projectId: number,
  limit: number = 5
): Promise<ProjectUpdate[]> {
  const db = getDatabase();
  const rows = await db.all(
    `SELECT pu.id, pu.title, pu.description, pu.update_type, u.display_name as author, pu.created_at
     FROM project_updates pu
     LEFT JOIN users u ON pu.author_user_id = u.id
     WHERE pu.project_id = ?
     ORDER BY pu.created_at DESC
     LIMIT ?`,
    [projectId, limit]
  );
  return rows as unknown as ProjectUpdate[];
}

export async function getRecentMessages(
  projectId: number,
  limit: number = 5
): Promise<RecentMessage[]> {
  const db = getDatabase();
  const rows = await db.all(
    `SELECT id, sender_type, sender_name, message, read_at, created_at
     FROM messages
     WHERE project_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [projectId, limit]
  );
  return rows as unknown as RecentMessage[];
}

export function calculateProgressPercentage(
  stats: Record<string, unknown>,
  project: Record<string, unknown>
): number {
  const totalMilestones = getNumber(stats, 'total_milestones');
  const completedMilestones = getNumber(stats, 'completed_milestones');
  const projectProgress = getNumber(project, 'progress');
  return totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : projectProgress || 0;
}
