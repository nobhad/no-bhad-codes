/**
 * ===============================================
 * PROGRESS CALCULATOR SERVICE
 * ===============================================
 * @file server/services/progress-calculator.ts
 *
 * Calculates milestone and project progress based on task completion.
 * Automatically marks milestones as complete when all tasks are done.
 */

import { getDatabase } from '../database/init.js';

/**
 * Milestone progress result
 */
export interface MilestoneProgress {
  /** Total number of tasks in milestone */
  total: number;
  /** Number of completed tasks */
  completed: number;
  /** Number of in-progress tasks */
  inProgress: number;
  /** Number of pending tasks */
  pending: number;
  /** Progress percentage (0-100) */
  percentage: number;
}

/**
 * Project progress result
 */
export interface ProjectProgress {
  /** Progress from milestone tasks only */
  milestoneProgress: number;
  /** Progress from standalone tasks only */
  standaloneProgress: number;
  /** Overall progress (all tasks) */
  overallProgress: number;
  /** Total number of tasks */
  totalTasks: number;
  /** Number of completed tasks */
  completedTasks: number;
  /** Total milestone tasks */
  milestoneTasks: number;
  /** Completed milestone tasks */
  completedMilestoneTasks: number;
  /** Total standalone tasks */
  standaloneTasks: number;
  /** Completed standalone tasks */
  completedStandaloneTasks: number;
}

/**
 * Calculate progress for a specific milestone
 *
 * Returns task counts and progress percentage for the milestone.
 *
 * @param milestoneId - ID of the milestone
 * @returns Milestone progress data
 */
export async function calculateMilestoneProgress(milestoneId: number): Promise<MilestoneProgress> {
  const db = getDatabase();

  try {
    const result = await db.get(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM project_tasks
      WHERE milestone_id = ?`,
      [milestoneId]
    ) as { total: number; completed: number; in_progress: number; pending: number };

    const total = result?.total || 0;
    const completed = result?.completed || 0;
    const inProgress = result?.in_progress || 0;
    const pending = result?.pending || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      pending,
      percentage
    };
  } catch (error) {
    console.error(`[ProgressCalculator] Error calculating milestone ${milestoneId} progress:`, error);
    throw error;
  }
}

/**
 * Calculate overall progress for a project
 *
 * Returns progress broken down by milestone tasks vs standalone tasks.
 *
 * @param projectId - ID of the project
 * @returns Project progress data
 */
export async function calculateProjectProgress(projectId: number): Promise<ProjectProgress> {
  const db = getDatabase();

  try {
    // Get milestone task counts
    const milestoneResult = await db.get(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM project_tasks
      WHERE project_id = ? AND milestone_id IS NOT NULL`,
      [projectId]
    ) as { total: number; completed: number };

    const milestoneTasks = milestoneResult?.total || 0;
    const completedMilestoneTasks = milestoneResult?.completed || 0;

    // Get standalone task counts
    const standaloneResult = await db.get(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM project_tasks
      WHERE project_id = ? AND milestone_id IS NULL`,
      [projectId]
    ) as { total: number; completed: number };

    const standaloneTasks = standaloneResult?.total || 0;
    const completedStandaloneTasks = standaloneResult?.completed || 0;

    // Calculate totals
    const totalTasks = milestoneTasks + standaloneTasks;
    const completedTasks = completedMilestoneTasks + completedStandaloneTasks;

    // Calculate percentages
    const milestoneProgress = milestoneTasks > 0
      ? Math.round((completedMilestoneTasks / milestoneTasks) * 100)
      : 0;

    const standaloneProgress = standaloneTasks > 0
      ? Math.round((completedStandaloneTasks / standaloneTasks) * 100)
      : 0;

    const overallProgress = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    return {
      milestoneProgress,
      standaloneProgress,
      overallProgress,
      totalTasks,
      completedTasks,
      milestoneTasks,
      completedMilestoneTasks,
      standaloneTasks,
      completedStandaloneTasks
    };
  } catch (error) {
    console.error(`[ProgressCalculator] Error calculating project ${projectId} progress:`, error);
    throw error;
  }
}

/**
 * Check and update milestone completion status
 *
 * Marks milestone as complete if all tasks are completed.
 * Marks milestone as incomplete if any tasks are not completed.
 *
 * @param milestoneId - ID of the milestone
 * @returns True if milestone status was changed, false otherwise
 */
export async function checkAndUpdateMilestoneCompletion(milestoneId: number): Promise<boolean> {
  const db = getDatabase();

  try {
    // Get current milestone status
    const milestone = await db.get(
      'SELECT is_completed FROM milestones WHERE id = ?',
      [milestoneId]
    ) as { is_completed: boolean } | undefined;

    if (!milestone) {
      console.warn(`[ProgressCalculator] Milestone ${milestoneId} not found`);
      return false;
    }

    // Calculate progress
    const progress = await calculateMilestoneProgress(milestoneId);

    // Determine if milestone should be completed
    const shouldBeCompleted = progress.total > 0 && progress.completed === progress.total;
    const isCurrentlyCompleted = Boolean(milestone.is_completed);

    // Update if status changed
    if (shouldBeCompleted !== isCurrentlyCompleted) {
      await db.run(
        `UPDATE milestones
         SET is_completed = ?,
             completed_date = CASE WHEN ? THEN datetime('now') ELSE NULL END,
             updated_at = datetime('now')
         WHERE id = ?`,
        [shouldBeCompleted, shouldBeCompleted, milestoneId]
      );

      console.log(`[ProgressCalculator] Milestone ${milestoneId} marked as ${shouldBeCompleted ? 'complete' : 'incomplete'} (${progress.completed}/${progress.total} tasks)`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[ProgressCalculator] Error checking milestone ${milestoneId} completion:`, error);
    throw error;
  }
}

/**
 * Update project progress percentage
 *
 * Calculates overall project progress and updates the projects table.
 *
 * @param projectId - ID of the project
 * @returns Updated progress percentage
 */
export async function updateProjectProgress(projectId: number): Promise<number> {
  const db = getDatabase();

  try {
    const progress = await calculateProjectProgress(projectId);

    await db.run(
      `UPDATE projects
       SET progress = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [progress.overallProgress, projectId]
    );

    console.log(`[ProgressCalculator] Project ${projectId} progress updated to ${progress.overallProgress}%`);
    return progress.overallProgress;
  } catch (error) {
    console.error(`[ProgressCalculator] Error updating project ${projectId} progress:`, error);
    throw error;
  }
}

/**
 * Recalculate all progress for a project
 *
 * Updates all milestone completion statuses and project progress.
 * Useful after bulk task updates or migrations.
 *
 * @param projectId - ID of the project
 * @returns Summary of updates
 */
export async function recalculateProjectProgress(projectId: number): Promise<{
  milestonesUpdated: number;
  projectProgress: number;
}> {
  const db = getDatabase();

  try {
    // Get all milestones for project
    const milestones = await db.all(
      'SELECT id FROM milestones WHERE project_id = ?',
      [projectId]
    ) as Array<{ id: number }>;

    let milestonesUpdated = 0;

    // Update each milestone
    for (const milestone of milestones) {
      const wasUpdated = await checkAndUpdateMilestoneCompletion(milestone.id);
      if (wasUpdated) {
        milestonesUpdated++;
      }
    }

    // Update project progress
    const projectProgress = await updateProjectProgress(projectId);

    console.log(`[ProgressCalculator] Recalculated project ${projectId}: ${milestonesUpdated} milestones updated, progress ${projectProgress}%`);

    return {
      milestonesUpdated,
      projectProgress
    };
  } catch (error) {
    console.error(`[ProgressCalculator] Error recalculating project ${projectId} progress:`, error);
    throw error;
  }
}

/**
 * Get milestones with progress data
 *
 * Returns all milestones for a project with task counts and progress.
 *
 * @param projectId - ID of the project
 * @returns Array of milestones with progress data
 */
export async function getMilestonesWithProgress(projectId: number): Promise<Array<{
  id: number;
  title: string;
  description: string;
  due_date: string | null;
  is_completed: boolean;
  total_tasks: number;
  completed_tasks: number;
  progress_percentage: number;
}>> {
  const db = getDatabase();

  try {
    const milestones = await db.all(
      `SELECT
        m.id,
        m.title,
        m.description,
        m.due_date,
        m.is_completed,
        COUNT(t.id) as total_tasks,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
      FROM milestones m
      LEFT JOIN project_tasks t ON m.id = t.milestone_id
      WHERE m.project_id = ?
      GROUP BY m.id
      ORDER BY m.sort_order, m.due_date`,
      [projectId]
    ) as Array<{
      id: number;
      title: string;
      description: string;
      due_date: string | null;
      is_completed: boolean;
      total_tasks: number;
      completed_tasks: number;
    }>;

    return milestones.map(milestone => ({
      ...milestone,
      progress_percentage: milestone.total_tasks > 0
        ? Math.round((milestone.completed_tasks / milestone.total_tasks) * 100)
        : 0
    }));
  } catch (error) {
    console.error(`[ProgressCalculator] Error getting milestones with progress for project ${projectId}:`, error);
    throw error;
  }
}

export default {
  calculateMilestoneProgress,
  calculateProjectProgress,
  checkAndUpdateMilestoneCompletion,
  updateProjectProgress,
  recalculateProjectProgress,
  getMilestonesWithProgress
};
