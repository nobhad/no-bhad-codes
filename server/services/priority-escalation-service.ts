/**
 * ===============================================
 * PRIORITY ESCALATION SERVICE
 * ===============================================
 * @file server/services/priority-escalation-service.ts
 *
 * Automatically escalates task priorities based on due date proximity.
 * Only escalates UP (never downgrades). Excludes completed/cancelled tasks.
 *
 * Escalation Rules:
 * - ≤ 1 day (tomorrow/overdue): urgent
 * - ≤ 3 days: high
 * - ≤ 7 days: medium
 * - > 7 days: no change
 */

import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';

/**
 * Priority levels in ascending order of urgency
 */
export const PRIORITY_LEVELS = ['low', 'medium', 'high', 'urgent'] as const;
export type PriorityLevel = typeof PRIORITY_LEVELS[number];

/**
 * Priority level numeric values for comparison
 */
const PRIORITY_RANK: Record<PriorityLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4
};

/**
 * Escalation thresholds (days until due)
 */
const ESCALATION_THRESHOLDS = {
  URGENT: 1,   // ≤ 1 day (tomorrow or overdue)
  HIGH: 3,     // ≤ 3 days
  MEDIUM: 7    // ≤ 7 days
};

/**
 * Excluded task statuses (tasks that should not be escalated)
 */
const EXCLUDED_STATUSES = ['completed', 'cancelled'];

/**
 * Task data from database
 */
interface TaskRow {
  id: number;
  project_id: number;
  title: string;
  due_date: string;
  priority: PriorityLevel;
  status: string;
}

/**
 * Result of escalation operation
 */
export interface EscalationResult {
  /** Number of tasks updated */
  updatedCount: number;
  /** Details of each escalated task */
  escalatedTasks: Array<{
    taskId: number;
    projectId: number;
    title: string;
    oldPriority: PriorityLevel;
    newPriority: PriorityLevel;
    daysUntilDue: number;
  }>;
}

/**
 * Determine required priority based on days until due
 *
 * @param daysUntilDue - Number of days until task is due (can be negative for overdue)
 * @returns Required minimum priority level
 */
export function getRequiredPriority(daysUntilDue: number): PriorityLevel {
  if (daysUntilDue <= ESCALATION_THRESHOLDS.URGENT) {
    return 'urgent';
  }
  if (daysUntilDue <= ESCALATION_THRESHOLDS.HIGH) {
    return 'high';
  }
  if (daysUntilDue <= ESCALATION_THRESHOLDS.MEDIUM) {
    return 'medium';
  }
  return 'low';
}

/**
 * Check if priority should be escalated
 *
 * Only escalates UP (never downgrades).
 *
 * @param currentPriority - Current task priority
 * @param requiredPriority - Required priority based on due date
 * @returns true if escalation needed
 */
export function shouldEscalate(
  currentPriority: PriorityLevel,
  requiredPriority: PriorityLevel
): boolean {
  return PRIORITY_RANK[requiredPriority] > PRIORITY_RANK[currentPriority];
}

/**
 * Calculate days until a date
 *
 * @param dueDate - Date string (YYYY-MM-DD)
 * @returns Number of days until date (negative if overdue)
 */
function calculateDaysUntilDue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Escalate task priorities for a specific project
 *
 * Queries tasks with due dates, calculates required priority based on
 * proximity, and updates only if escalating UP.
 *
 * @param projectId - ID of project to check (optional, checks all if omitted)
 * @returns Escalation result with updated count and details
 */
export async function escalateTaskPriorities(projectId?: number): Promise<EscalationResult> {
  const db = getDatabase();
  const escalatedTasks: EscalationResult['escalatedTasks'] = [];

  try {
    // Build query to get tasks with due dates
    let query = `
      SELECT id, project_id, title, due_date, priority, status
      FROM project_tasks
      WHERE due_date IS NOT NULL
        AND status NOT IN (${EXCLUDED_STATUSES.map(() => '?').join(', ')})
    `;
    const params: (string | number)[] = [...EXCLUDED_STATUSES];

    if (projectId !== undefined) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }

    const tasks = (await db.all(query, params)) as unknown as TaskRow[];

    // Process each task
    for (const task of tasks) {
      const daysUntilDue = calculateDaysUntilDue(task.due_date);
      const requiredPriority = getRequiredPriority(daysUntilDue);

      // Only escalate if needed (going UP in priority)
      if (shouldEscalate(task.priority, requiredPriority)) {
        await db.run(
          `UPDATE project_tasks
           SET priority = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [requiredPriority, task.id]
        );

        escalatedTasks.push({
          taskId: task.id,
          projectId: task.project_id,
          title: task.title,
          oldPriority: task.priority,
          newPriority: requiredPriority,
          daysUntilDue
        });
      }
    }

    if (escalatedTasks.length > 0) {
      const scope = projectId !== undefined ? `project ${projectId}` : 'all projects';
      logger.info(`[PriorityEscalation] Escalated ${escalatedTasks.length} tasks for ${scope}`);
    }

    return {
      updatedCount: escalatedTasks.length,
      escalatedTasks
    };
  } catch (error) {
    logger.error('[PriorityEscalation] Error escalating priorities', { error: error instanceof Error ? error : undefined });
    throw error;
  }
}

/**
 * Escalate priorities for all active projects
 *
 * Convenience method that calls escalateTaskPriorities without project filter.
 *
 * @returns Escalation result
 */
export async function escalateAllProjects(): Promise<EscalationResult> {
  return escalateTaskPriorities();
}

/**
 * Get tasks that would be escalated (dry run)
 *
 * Performs the same logic as escalateTaskPriorities but without updating.
 * Useful for previewing what would change.
 *
 * @param projectId - Optional project filter
 * @returns Preview of what would be escalated
 */
export async function previewEscalation(projectId?: number): Promise<EscalationResult> {
  const db = getDatabase();
  const escalatedTasks: EscalationResult['escalatedTasks'] = [];

  try {
    let query = `
      SELECT id, project_id, title, due_date, priority, status
      FROM project_tasks
      WHERE due_date IS NOT NULL
        AND status NOT IN (${EXCLUDED_STATUSES.map(() => '?').join(', ')})
    `;
    const params: (string | number)[] = [...EXCLUDED_STATUSES];

    if (projectId !== undefined) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }

    const tasks = (await db.all(query, params)) as unknown as TaskRow[];

    for (const task of tasks) {
      const daysUntilDue = calculateDaysUntilDue(task.due_date);
      const requiredPriority = getRequiredPriority(daysUntilDue);

      if (shouldEscalate(task.priority, requiredPriority)) {
        escalatedTasks.push({
          taskId: task.id,
          projectId: task.project_id,
          title: task.title,
          oldPriority: task.priority,
          newPriority: requiredPriority,
          daysUntilDue
        });
      }
    }

    return {
      updatedCount: escalatedTasks.length,
      escalatedTasks
    };
  } catch (error) {
    logger.error('[PriorityEscalation] Error previewing escalation', { error: error instanceof Error ? error : undefined });
    throw error;
  }
}

/**
 * Get escalation summary statistics
 *
 * Returns counts of tasks by priority and due date proximity.
 *
 * @param projectId - Optional project filter
 * @returns Summary statistics
 */
export async function getEscalationSummary(projectId?: number): Promise<{
  totalTasks: number;
  byPriority: Record<PriorityLevel, number>;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  wouldEscalate: number;
}> {
  const db = getDatabase();

  let whereClause = `WHERE status NOT IN (${EXCLUDED_STATUSES.map(() => '?').join(', ')})`;
  const params: (string | number)[] = [...EXCLUDED_STATUSES];

  if (projectId !== undefined) {
    whereClause += ' AND project_id = ?';
    params.push(projectId);
  }

  // Get total and priority breakdown
  const priorityStats = await db.all(`
    SELECT priority, COUNT(*) as count
    FROM project_tasks
    ${whereClause}
    GROUP BY priority
  `, params);

  const byPriority: Record<PriorityLevel, number> = {
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0
  };

  let totalTasks = 0;
  for (const stat of priorityStats as { priority: PriorityLevel; count: number }[]) {
    byPriority[stat.priority] = stat.count;
    totalTasks += stat.count;
  }

  // Get due date statistics
  const today = new Date().toISOString().split('T')[0];
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const weekEnd = weekFromNow.toISOString().split('T')[0];

  const overdueResult = await db.get(`
    SELECT COUNT(*) as count FROM project_tasks
    ${whereClause} AND due_date < ?
  `, [...params, today]) as { count: number };

  const dueTodayResult = await db.get(`
    SELECT COUNT(*) as count FROM project_tasks
    ${whereClause} AND due_date = ?
  `, [...params, today]) as { count: number };

  const dueThisWeekResult = await db.get(`
    SELECT COUNT(*) as count FROM project_tasks
    ${whereClause} AND due_date > ? AND due_date <= ?
  `, [...params, today, weekEnd]) as { count: number };

  // Get count that would escalate
  const preview = await previewEscalation(projectId);

  return {
    totalTasks,
    byPriority,
    overdue: overdueResult?.count || 0,
    dueToday: dueTodayResult?.count || 0,
    dueThisWeek: dueThisWeekResult?.count || 0,
    wouldEscalate: preview.updatedCount
  };
}

export default {
  escalateTaskPriorities,
  escalateAllProjects,
  previewEscalation,
  getEscalationSummary,
  getRequiredPriority,
  shouldEscalate,
  PRIORITY_LEVELS,
  PRIORITY_RANK
};
