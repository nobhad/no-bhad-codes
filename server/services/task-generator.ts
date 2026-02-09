/**
 * ===============================================
 * TASK GENERATOR SERVICE
 * ===============================================
 * @file server/services/task-generator.ts
 *
 * Automatically generates default tasks for project milestones
 * based on milestone and project type configuration.
 */

import { getDatabase } from '../database/init.js';
import { getTaskTemplatesForMilestone, TaskTemplate, normalizeMilestoneTitle } from '../config/default-tasks.js';
import { normalizeProjectType } from '../config/default-milestones.js';

/**
 * Generated task result
 */
export interface GeneratedTask {
  id: number;
  projectId: number;
  milestoneId: number | null;
  title: string;
  description?: string;
  dueDate?: string;
  order: number;
}

/**
 * Options for task generation
 */
export interface TaskGenerationOptions {
  /** Skip if tasks already exist for this milestone */
  skipIfExists?: boolean;
  /** Default priority for all tasks */
  defaultPriority?: 'low' | 'medium' | 'high' | 'urgent';
  /** Assigned to (team member name/email) */
  assignedTo?: string;
}

/**
 * Generate tasks for a specific milestone
 *
 * Creates tasks based on milestone type and project type configuration.
 * Task due dates are distributed evenly between now and milestone due date.
 *
 * @param projectId - ID of the project
 * @param milestoneId - ID of the milestone
 * @param milestoneTitle - Title of the milestone (for template matching)
 * @param milestoneDueDate - Due date of the milestone (ISO string YYYY-MM-DD)
 * @param projectType - Type of project (e.g., 'simple-site', 'business-site')
 * @param options - Optional configuration for task generation
 * @returns Array of generated task IDs
 */
export async function generateMilestoneTasks(
  projectId: number,
  milestoneId: number,
  milestoneTitle: string,
  milestoneDueDate: string | null,
  projectType: string | null | undefined,
  options: TaskGenerationOptions = {}
): Promise<number[]> {
  const db = getDatabase();
  const taskIds: number[] = [];

  try {
    // Check if tasks already exist for this milestone
    if (options.skipIfExists !== false && milestoneId) {
      const existingCount = await db.get(
        'SELECT COUNT(*) as count FROM project_tasks WHERE milestone_id = ?',
        [milestoneId]
      ) as { count: number };

      if (existingCount && existingCount.count > 0) {
        console.log(`[TaskGenerator] Skipping milestone ${milestoneId}: ${existingCount.count} tasks already exist`);
        return [];
      }
    }

    // Get task templates for this milestone type
    const normalizedType = normalizeProjectType(projectType);
    const templates = getTaskTemplatesForMilestone(milestoneTitle, normalizedType);

    if (templates.length === 0) {
      console.log(`[TaskGenerator] No task templates found for milestone "${milestoneTitle}" (project type: ${normalizedType})`);
      return [];
    }

    console.log(`[TaskGenerator] Generating ${templates.length} tasks for milestone ${milestoneId} "${milestoneTitle}"`);

    // Calculate task due dates (spread evenly before milestone due date)
    const taskDueDates = calculateTaskDueDates(milestoneDueDate, templates.length);

    // Generate each task
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const dueDate = taskDueDates[i];

      const result = await db.run(
        `INSERT INTO project_tasks (
          project_id, milestone_id, title, description,
          status, priority, due_date, estimated_hours,
          sort_order, assigned_to, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          projectId,
          milestoneId,
          template.title,
          template.description || null,
          'pending',
          options.defaultPriority || 'medium',
          dueDate,
          template.estimatedHours || null,
          template.order,
          options.assignedTo || null
        ]
      );

      if (result?.lastID) {
        taskIds.push(result.lastID);
      }
    }

    console.log(`[TaskGenerator] Created ${taskIds.length} tasks for milestone ${milestoneId}`);
    return taskIds;
  } catch (error) {
    console.error(`[TaskGenerator] Error generating tasks for milestone ${milestoneId}:`, error);
    throw error;
  }
}

/**
 * Calculate due dates for tasks
 *
 * Distributes task due dates evenly between today and milestone due date.
 * If no milestone due date provided, tasks get null due dates.
 *
 * @param milestoneDueDate - Due date of the milestone (ISO string YYYY-MM-DD) or null
 * @param taskCount - Number of tasks to generate
 * @returns Array of due date strings (YYYY-MM-DD) or nulls
 */
function calculateTaskDueDates(milestoneDueDate: string | null, taskCount: number): (string | null)[] {
  // If no milestone due date, all tasks get null due dates
  if (!milestoneDueDate) {
    return new Array(taskCount).fill(null);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day

  const milestoneDate = new Date(milestoneDueDate);
  milestoneDate.setHours(0, 0, 0, 0);

  // Calculate days between today and milestone due date
  const daysUntilMilestone = Math.max(1, Math.ceil((milestoneDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  // If milestone is in the past or today, all tasks get milestone due date
  if (daysUntilMilestone <= 1) {
    return new Array(taskCount).fill(milestoneDueDate);
  }

  // Distribute task due dates evenly
  const dueDates: string[] = [];
  const interval = daysUntilMilestone / taskCount;

  for (let i = 0; i < taskCount; i++) {
    const daysOffset = Math.floor(interval * (i + 1));
    const taskDueDate = new Date(today);
    taskDueDate.setDate(taskDueDate.getDate() + daysOffset);
    dueDates.push(taskDueDate.toISOString().split('T')[0]);
  }

  return dueDates;
}

/**
 * Generate tasks for all milestones in a project
 *
 * Useful for backfilling tasks for existing projects or regenerating after changes.
 *
 * @param projectId - ID of the project
 * @param projectType - Type of project
 * @param options - Optional configuration for task generation
 * @returns Total number of tasks created
 */
export async function generateAllMilestoneTasksForProject(
  projectId: number,
  projectType: string | null | undefined,
  options: TaskGenerationOptions = {}
): Promise<number> {
  const db = getDatabase();

  try {
    // Get all milestones for this project
    const milestones = await db.all(
      `SELECT id, title, due_date
       FROM milestones
       WHERE project_id = ?
       ORDER BY sort_order, due_date`,
      [projectId]
    ) as Array<{ id: number; title: string; due_date: string | null }>;

    console.log(`[TaskGenerator] Generating tasks for ${milestones.length} milestones in project ${projectId}`);

    let totalTasksCreated = 0;

    // Generate tasks for each milestone
    for (const milestone of milestones) {
      const taskIds = await generateMilestoneTasks(
        projectId,
        milestone.id,
        milestone.title,
        milestone.due_date,
        projectType,
        options
      );

      totalTasksCreated += taskIds.length;
    }

    console.log(`[TaskGenerator] Created ${totalTasksCreated} total tasks for project ${projectId}`);
    return totalTasksCreated;
  } catch (error) {
    console.error(`[TaskGenerator] Error generating tasks for project ${projectId}:`, error);
    throw error;
  }
}

/**
 * Get milestones without tasks
 *
 * Returns a list of milestones that have no tasks configured.
 * Useful for identifying milestones that need task setup.
 *
 * @returns Array of milestone IDs without tasks
 */
export async function getMilestonesWithoutTasks(): Promise<number[]> {
  const db = getDatabase();

  const results = await db.all(`
    SELECT m.id
    FROM milestones m
    LEFT JOIN project_tasks t ON m.id = t.milestone_id
    WHERE t.id IS NULL
      AND m.project_id IN (
        SELECT id FROM projects
        WHERE deleted_at IS NULL
        AND status NOT IN ('completed', 'cancelled')
      )
    ORDER BY m.due_date
  `);

  return (results || []).map((row) => (row as { id: number }).id);
}

/**
 * Backfill tasks for existing milestones
 *
 * Generates tasks for all milestones that don't have any.
 * Useful for initial setup or migration.
 *
 * @returns Object with count of processed milestones and created tasks
 */
export async function backfillMilestoneTasks(): Promise<{
  milestonesProcessed: number;
  tasksCreated: number;
  errors: Array<{ milestoneId: number; error: string }>;
}> {
  const db = getDatabase();
  const errors: Array<{ milestoneId: number; error: string }> = [];
  let milestonesProcessed = 0;
  let tasksCreated = 0;

  // Get milestones without tasks along with project info
  const milestones = await db.all(`
    SELECT m.id, m.title, m.due_date, m.project_id, p.project_type
    FROM milestones m
    JOIN projects p ON m.project_id = p.id
    LEFT JOIN project_tasks t ON m.id = t.milestone_id
    WHERE t.id IS NULL
      AND p.deleted_at IS NULL
      AND p.status NOT IN ('completed', 'cancelled')
    GROUP BY m.id
    ORDER BY m.due_date
  `) as Array<{
    id: number;
    title: string;
    due_date: string | null;
    project_id: number;
    project_type: string | null;
  }>;

  console.log(`[TaskGenerator] Backfilling tasks for ${milestones.length} milestones`);

  for (const milestone of milestones) {
    try {
      const taskIds = await generateMilestoneTasks(
        milestone.project_id,
        milestone.id,
        milestone.title,
        milestone.due_date,
        milestone.project_type,
        { skipIfExists: true }
      );

      tasksCreated += taskIds.length;
      milestonesProcessed++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({ milestoneId: milestone.id, error: errorMessage });
      console.error(`[TaskGenerator] Failed to backfill milestone ${milestone.id}:`, errorMessage);
    }
  }

  console.log(`[TaskGenerator] Backfill complete: ${milestonesProcessed} milestones, ${tasksCreated} tasks`);

  return {
    milestonesProcessed,
    tasksCreated,
    errors
  };
}

/**
 * Preview tasks for a milestone
 *
 * Returns the task templates that would be used without creating them.
 * Useful for showing expected tasks before milestone creation.
 *
 * @param milestoneTitle - Title of the milestone
 * @param projectType - Type of project
 * @param milestoneDueDate - Optional due date for calculating task due dates
 * @returns Array of task previews with calculated due dates
 */
export function previewMilestoneTasks(
  milestoneTitle: string,
  projectType: string | null | undefined,
  milestoneDueDate?: string
): Array<TaskTemplate & { dueDate: string | null }> {
  const normalizedType = normalizeProjectType(projectType);
  const templates = getTaskTemplatesForMilestone(milestoneTitle, normalizedType);

  if (!milestoneDueDate) {
    return templates.map(template => ({
      ...template,
      dueDate: null
    }));
  }

  const dueDates = calculateTaskDueDates(milestoneDueDate, templates.length);

  return templates.map((template, index) => ({
    ...template,
    dueDate: dueDates[index]
  }));
}

export default {
  generateMilestoneTasks,
  generateAllMilestoneTasksForProject,
  getMilestonesWithoutTasks,
  backfillMilestoneTasks,
  previewMilestoneTasks
};
