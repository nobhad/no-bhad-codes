/**
 * ===============================================
 * PROJECT SERVICE — MILESTONE SUB-MODULE
 * ===============================================
 * Database operations for project milestones.
 * Consumed via the `projectService` barrel (project-service.ts).
 */

import { getDatabase } from '../../database/init.js';
import type { DatabaseRow } from '../../database/init.js';
import { getString } from '../../database/row-helpers.js';
import { logger } from '../logger.js';

// =====================================================
// TYPES
// =====================================================

/** Individual deliverable within a milestone */
export interface DeliverableEntry {
  text: string;
  completed: boolean;
}

/** Milestone row shape returned from database queries */
export interface MilestoneRow extends DatabaseRow {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_date: string | null;
  is_completed: number;
  deliverables: string | DeliverableEntry[];
  created_at: string;
  updated_at: string;
  task_count?: number;
  completed_task_count?: number;
  progress_percentage?: number;
}

/** Data required to create a new milestone */
export interface MilestoneCreateData {
  projectId: number;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  deliverables?: unknown[];
}

/** Fields eligible for milestone update (all optional) */
export interface MilestoneUpdateFields {
  title?: string;
  description?: string | null;
  due_date?: string | null;
  deliverables?: string;
  is_completed?: number;
  completed_date?: string | null;
}

// Explicit column list for SELECT queries (avoid SELECT *)
const MILESTONE_COLUMNS = `
  id, project_id, title, description, due_date, completed_date,
  is_completed, deliverables, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

// =====================================================
// HELPERS
// =====================================================

/**
 * Normalize deliverables from legacy string[] format to DeliverableEntry[].
 * Handles both old format (["text1", "text2"]) and new format ([{text, completed}]).
 */
export function normalizeDeliverables(raw: unknown): DeliverableEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown) => {
    if (typeof item === 'string') {
      return { text: item, completed: false };
    }
    if (item && typeof item === 'object' && 'text' in item) {
      return {
        text: String((item as Record<string, unknown>).text),
        completed: Boolean((item as Record<string, unknown>).completed)
      };
    }
    return { text: String(item), completed: false };
  });
}

/**
 * Parse deliverables JSON string on a milestone row,
 * normalizing legacy formats and attaching progress_percentage.
 */
export function hydrateMilestoneDeliverables(milestone: MilestoneRow): void {
  const deliverablesStr = getString(milestone, 'deliverables');
  if (deliverablesStr) {
    try {
      milestone.deliverables = normalizeDeliverables(JSON.parse(deliverablesStr));
    } catch (_e) {
      logger.debug('[Milestones] Failed to parse milestone deliverables JSON', {
        error: _e instanceof Error ? _e : undefined
      });
      milestone.deliverables = [];
    }
  } else {
    milestone.deliverables = [];
  }

  // Calculate progress percentage — prefer deliverable completion, fallback to tasks
  const deliverablesList = milestone.deliverables as DeliverableEntry[];
  if (deliverablesList.length > 0) {
    const completedDeliverables = deliverablesList.filter((d) => d.completed).length;
    milestone.progress_percentage = Math.round((completedDeliverables / deliverablesList.length) * 100);
  } else {
    const taskCount = milestone.task_count || 0;
    const completedCount = milestone.completed_task_count || 0;
    milestone.progress_percentage =
      taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;
  }
}

// =====================================================
// DATABASE OPERATIONS
// =====================================================

/** Check whether a project exists by ID */
export async function projectExists(projectId: number): Promise<boolean> {
  const db = getDatabase();
  const row = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
  return Boolean(row);
}

/** Fetch all milestones for a project (with task counts) */
export async function getMilestones(projectId: number): Promise<MilestoneRow[]> {
  const db = getDatabase();
  const milestones = await db.all<MilestoneRow>(
    `
    SELECT
      m.id,
      m.title,
      m.description,
      m.due_date,
      m.completed_date,
      m.is_completed,
      m.deliverables,
      m.created_at,
      m.updated_at,
      COUNT(t.id) as task_count,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_task_count
    FROM milestones m
    LEFT JOIN project_tasks t ON m.id = t.milestone_id AND t.deleted_at IS NULL
    WHERE m.project_id = ? AND m.deleted_at IS NULL
    GROUP BY m.id
    ORDER BY m.due_date ASC, m.created_at ASC
    `,
    [projectId]
  );

  milestones.forEach(hydrateMilestoneDeliverables);
  return milestones;
}

/** Insert a new milestone and return the hydrated row */
export async function createMilestone(data: MilestoneCreateData): Promise<MilestoneRow | undefined> {
  const db = getDatabase();
  const result = await db.run(
    `
    INSERT INTO milestones (project_id, title, description, due_date, deliverables)
    VALUES (?, ?, ?, ?, ?)
    `,
    [
      data.projectId,
      data.title,
      data.description ?? null,
      data.dueDate ?? null,
      JSON.stringify(data.deliverables ?? [])
    ]
  );

  const newMilestone = await db.get<MilestoneRow>(
    `
    SELECT id, title, description, due_date, completed_date, is_completed,
           deliverables, created_at, updated_at
    FROM milestones WHERE id = ?
    `,
    [result.lastID]
  );

  if (newMilestone) {
    hydrateMilestoneDeliverables(newMilestone);
  }
  return newMilestone;
}

/** Fetch a single milestone by ID and project, using full column list */
export async function getMilestoneByIdAndProject(
  milestoneId: number,
  projectId: number
): Promise<MilestoneRow | undefined> {
  const db = getDatabase();
  return db.get<MilestoneRow>(
    `SELECT ${MILESTONE_COLUMNS} FROM milestones WHERE id = ? AND project_id = ?`,
    [milestoneId, projectId]
  );
}

/** Apply dynamic field updates to a milestone and return the hydrated row */
export async function updateMilestone(
  milestoneId: number,
  fields: MilestoneUpdateFields
): Promise<MilestoneRow | undefined> {
  const updates: string[] = [];
  const values: (string | number | boolean | null)[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      values.push(value as string | number | boolean | null);
    }
  }

  if (updates.length === 0) return undefined;

  values.push(milestoneId);

  const db = getDatabase();
  await db.run(
    `
    UPDATE milestones
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    values
  );

  const updatedMilestone = await db.get<MilestoneRow>(
    `
    SELECT id, title, description, due_date, completed_date, is_completed,
           deliverables, created_at, updated_at
    FROM milestones WHERE id = ?
    `,
    [milestoneId]
  );

  if (updatedMilestone) {
    hydrateMilestoneDeliverables(updatedMilestone);
  }
  return updatedMilestone;
}

/** Check if a milestone belongs to a project and is not soft-deleted */
export async function getActiveMilestone(
  milestoneId: number,
  projectId: number
): Promise<DatabaseRow | undefined> {
  const db = getDatabase();
  return db.get(
    'SELECT id FROM milestones WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
    [milestoneId, projectId]
  );
}
