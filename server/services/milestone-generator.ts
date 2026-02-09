/**
 * ===============================================
 * MILESTONE GENERATOR SERVICE
 * ===============================================
 * @file server/services/milestone-generator.ts
 *
 * Automatically generates default milestones for new projects
 * based on project type configuration.
 */

import { getDatabase } from '../database/init.js';
import { getMilestoneTemplates, normalizeProjectType, MilestoneTemplate } from '../config/default-milestones.js';
import { generateMilestoneTasks } from './task-generator.js';

/**
 * Generated milestone result
 */
export interface GeneratedMilestone {
  id: number;
  projectId: number;
  title: string;
  description: string;
  dueDate: string;
  order: number;
}

/**
 * Options for milestone generation
 */
export interface MilestoneGenerationOptions {
  /** Start date for calculating milestone due dates (defaults to today) */
  startDate?: Date;
  /** Skip if milestones already exist for this project */
  skipIfExists?: boolean;
}

/**
 * Generate default milestones for a project
 *
 * Creates milestones based on the project type configuration.
 * Due dates are calculated from the start date plus estimated days.
 * Also automatically generates tasks for each milestone.
 *
 * @param projectId - ID of the project to create milestones for
 * @param projectType - Type of project (e.g., 'simple-site', 'business-site')
 * @param options - Optional configuration for milestone generation
 * @returns Object with counts of created milestones and tasks
 */
export async function generateDefaultMilestones(
  projectId: number,
  projectType: string | null | undefined,
  options: MilestoneGenerationOptions = {}
): Promise<{ milestonesCreated: number; tasksCreated: number }> {
  const db = getDatabase();
  const startDate = options.startDate || new Date();
  const milestoneIds: number[] = [];
  let totalTasksCreated = 0;

  try {
    // Check if milestones already exist for this project
    if (options.skipIfExists !== false) {
      const existingCount = await db.get(
        'SELECT COUNT(*) as count FROM milestones WHERE project_id = ?',
        [projectId]
      ) as { count: number };

      if (existingCount && existingCount.count > 0) {
        console.log(`[MilestoneGenerator] Skipping project ${projectId}: ${existingCount.count} milestones already exist`);
        return { milestonesCreated: 0, tasksCreated: 0 };
      }
    }

    // Get milestone templates for this project type
    const templates = getMilestoneTemplates(projectType);
    const normalizedType = normalizeProjectType(projectType);

    console.log(`[MilestoneGenerator] Generating ${templates.length} milestones for project ${projectId} (type: ${normalizedType})`);

    // Generate each milestone
    for (const template of templates) {
      const dueDate = calculateDueDate(startDate, template.estimatedDays);
      const deliverables = template.deliverables ? JSON.stringify(template.deliverables) : null;

      const result = await db.run(
        `INSERT INTO milestones (
          project_id, title, description, due_date, deliverables,
          is_completed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, FALSE, datetime('now'), datetime('now'))`,
        [
          projectId,
          template.name,
          template.description,
          dueDate,
          deliverables
        ]
      );

      if (result?.lastID) {
        const milestoneId = result.lastID;
        milestoneIds.push(milestoneId);

        // Generate tasks for this milestone
        try {
          const taskIds = await generateMilestoneTasks(
            projectId,
            milestoneId,
            template.name,
            dueDate,
            projectType,
            { skipIfExists: false }
          );
          totalTasksCreated += taskIds.length;
        } catch (taskError) {
          console.error(`[MilestoneGenerator] Error generating tasks for milestone ${milestoneId}:`, taskError);
          // Continue with other milestones even if task generation fails
        }
      }
    }

    console.log(`[MilestoneGenerator] Created ${milestoneIds.length} milestones and ${totalTasksCreated} tasks for project ${projectId}`);
    return { milestonesCreated: milestoneIds.length, tasksCreated: totalTasksCreated };
  } catch (error) {
    console.error(`[MilestoneGenerator] Error generating milestones for project ${projectId}:`, error);
    throw error;
  }
}

/**
 * Calculate due date from start date and days offset
 *
 * @param startDate - Project start date
 * @param daysOffset - Number of days from start date
 * @returns ISO date string (YYYY-MM-DD)
 */
function calculateDueDate(startDate: Date, daysOffset: number): string {
  const dueDate = new Date(startDate);
  dueDate.setDate(dueDate.getDate() + daysOffset);
  return dueDate.toISOString().split('T')[0];
}

/**
 * Get milestone templates preview for a project type
 *
 * Returns the templates that would be used without creating them.
 * Useful for showing expected milestones before project creation.
 *
 * @param projectType - Type of project
 * @param startDate - Optional start date for calculating due dates
 * @returns Array of milestone previews with calculated due dates
 */
export function previewMilestones(
  projectType: string | null | undefined,
  startDate?: Date
): Array<MilestoneTemplate & { dueDate: string }> {
  const templates = getMilestoneTemplates(projectType);
  const baseDate = startDate || new Date();

  return templates.map(template => ({
    ...template,
    dueDate: calculateDueDate(baseDate, template.estimatedDays)
  }));
}

/**
 * Regenerate milestones for an existing project
 *
 * Deletes existing milestones and creates new ones based on project type.
 * Use with caution as this removes all existing milestone data.
 * Also regenerates all tasks for the milestones.
 *
 * @param projectId - ID of the project
 * @param projectType - Type of project
 * @param startDate - Optional start date
 * @returns Object with counts of created milestones and tasks
 */
export async function regenerateMilestones(
  projectId: number,
  projectType: string | null | undefined,
  startDate?: Date
): Promise<{ milestonesCreated: number; tasksCreated: number }> {
  const db = getDatabase();

  try {
    // Delete existing milestones (tasks will cascade delete due to FK constraint)
    await db.run('DELETE FROM milestones WHERE project_id = ?', [projectId]);

    // Generate new milestones and tasks
    return generateDefaultMilestones(projectId, projectType, {
      startDate: startDate || new Date(),
      skipIfExists: false
    });
  } catch (error) {
    console.error(`[MilestoneGenerator] Error regenerating milestones for project ${projectId}:`, error);
    throw error;
  }
}

/**
 * Get projects without milestones
 *
 * Returns a list of projects that have no milestones configured.
 * Useful for identifying projects that need milestone setup.
 *
 * @returns Array of project IDs without milestones
 */
export async function getProjectsWithoutMilestones(): Promise<number[]> {
  const db = getDatabase();

  const results = await db.all(`
    SELECT p.id
    FROM projects p
    LEFT JOIN milestones m ON p.id = m.project_id
    WHERE m.id IS NULL
      AND p.deleted_at IS NULL
      AND p.status NOT IN ('completed', 'cancelled')
    ORDER BY p.created_at DESC
  `);

  return (results || []).map((row) => (row as { id: number }).id);
}

/**
 * Backfill milestones for existing projects
 *
 * Generates milestones and tasks for all active projects that don't have any.
 * Useful for initial setup or migration.
 *
 * @returns Object with count of processed projects, created milestones, and created tasks
 */
export async function backfillMilestones(): Promise<{
  projectsProcessed: number;
  milestonesCreated: number;
  tasksCreated: number;
  errors: Array<{ projectId: number; error: string }>;
}> {
  const db = getDatabase();
  const errors: Array<{ projectId: number; error: string }> = [];
  let projectsProcessed = 0;
  let milestonesCreated = 0;
  let tasksCreated = 0;

  // Get projects without milestones along with their types
  const projects = await db.all(`
    SELECT p.id, p.project_type, p.start_date
    FROM projects p
    LEFT JOIN milestones m ON p.id = m.project_id
    WHERE m.id IS NULL
      AND p.deleted_at IS NULL
      AND p.status NOT IN ('completed', 'cancelled')
    ORDER BY p.created_at DESC
  `) as Array<{ id: number; project_type: string | null; start_date: string | null }>;

  console.log(`[MilestoneGenerator] Backfilling milestones for ${projects.length} projects`);

  for (const project of projects) {
    try {
      const startDate = project.start_date ? new Date(project.start_date) : new Date();
      const result = await generateDefaultMilestones(project.id, project.project_type, {
        startDate,
        skipIfExists: true
      });

      milestonesCreated += result.milestonesCreated;
      tasksCreated += result.tasksCreated;
      projectsProcessed++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({ projectId: project.id, error: errorMessage });
      console.error(`[MilestoneGenerator] Failed to backfill project ${project.id}:`, errorMessage);
    }
  }

  console.log(`[MilestoneGenerator] Backfill complete: ${projectsProcessed} projects, ${milestonesCreated} milestones, ${tasksCreated} tasks`);

  return {
    projectsProcessed,
    milestonesCreated,
    tasksCreated,
    errors
  };
}

export default {
  generateDefaultMilestones,
  previewMilestones,
  regenerateMilestones,
  getProjectsWithoutMilestones,
  backfillMilestones
};
