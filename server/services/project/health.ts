/**
 * ===============================================
 * PROJECT — HEALTH, BURNDOWN & VELOCITY
 * ===============================================
 * Project health scoring, burndown charts, and velocity tracking.
 */

import { getDatabase } from '../../database/init.js';
import type { ProjectHealth, BurndownData, VelocityData } from './types.js';

export async function calculateProjectHealth(projectId: number): Promise<ProjectHealth> {
  const db = getDatabase();

  const issues: string[] = [];
  let scheduleHealth = 100;
  let budgetHealth = 100;
  let taskCompletion = 100;
  let milestoneProgress = 100;

  const project = await db.get(
    'SELECT estimated_hours, actual_hours, estimated_end_date, budget_range FROM projects WHERE id = ?',
    [projectId]
  );

  if (!project) {
    throw new Error('Project not found');
  }

  // Check schedule
  const estimatedEndDate = project.estimated_end_date as string | undefined;
  if (estimatedEndDate) {
    const dueDate = new Date(estimatedEndDate);
    const today = new Date();
    const daysRemaining = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysRemaining < 0) {
      scheduleHealth = 30;
      issues.push(`Project is ${Math.abs(daysRemaining)} days overdue`);
    } else if (daysRemaining < 7) {
      scheduleHealth = 60;
      issues.push('Less than 1 week until deadline');
    }
  }

  // Check budget (estimated vs actual hours)
  if (project.estimated_hours && project.actual_hours) {
    const estimated = parseFloat(String(project.estimated_hours));
    const actual = parseFloat(String(project.actual_hours));
    const ratio = actual / estimated;

    if (ratio > 1.2) {
      budgetHealth = 30;
      issues.push(`${Math.round((ratio - 1) * 100)}% over estimated hours`);
    } else if (ratio > 0.9) {
      budgetHealth = 70;
      issues.push('Approaching estimated hours');
    }
  }

  // Check task completion
  const taskStats = await db.get(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
     FROM project_tasks
     WHERE project_id = ?`,
    [projectId]
  );

  const taskTotal = Number(taskStats?.total ?? 0);
  const taskCompleted = Number(taskStats?.completed ?? 0);
  const taskBlocked = Number(taskStats?.blocked ?? 0);

  if (taskStats && taskTotal > 0) {
    taskCompletion = Math.round((taskCompleted / taskTotal) * 100);
    if (taskBlocked > 0) {
      issues.push(`${taskBlocked} task(s) are blocked`);
    }
  }

  // Check milestone progress
  const milestoneStats = await db.get(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN is_completed = 0 AND due_date < DATE('now') THEN 1 ELSE 0 END) as overdue
     FROM milestones
     WHERE project_id = ?`,
    [projectId]
  );

  const msTotal = Number(milestoneStats?.total ?? 0);
  const msCompleted = Number(milestoneStats?.completed ?? 0);
  const msOverdue = Number(milestoneStats?.overdue ?? 0);

  if (milestoneStats && msTotal > 0) {
    milestoneProgress = Math.round((msCompleted / msTotal) * 100);
    if (msOverdue > 0) {
      milestoneProgress = Math.max(0, milestoneProgress - 20);
      issues.push(`${msOverdue} milestone(s) are overdue`);
    }
  }

  // Calculate overall score
  const score = Math.round(
    scheduleHealth * 0.3 + budgetHealth * 0.2 + taskCompletion * 0.25 + milestoneProgress * 0.25
  );

  let status: ProjectHealth['status'];
  if (score >= 70) {
    status = 'on_track';
  } else if (score >= 40) {
    status = 'at_risk';
  } else {
    status = 'off_track';
  }

  await db.run(
    'UPDATE projects SET project_health = ?, health_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, issues.join('; '), projectId]
  );

  return {
    status,
    score,
    factors: {
      scheduleHealth,
      budgetHealth,
      taskCompletion,
      milestoneProgress
    },
    issues,
    lastCalculated: new Date().toISOString()
  };
}

export async function getProjectBurndown(projectId: number): Promise<BurndownData> {
  const db = getDatabase();

  const project = await db.get(
    'SELECT start_date, estimated_end_date, estimated_hours FROM projects WHERE id = ?',
    [projectId]
  );

  const projStartDate = project?.start_date as string | undefined;
  const projEstimatedHours = project?.estimated_hours;
  const projEstimatedEndDate = project?.estimated_end_date as string | undefined;

  if (!project || !projStartDate || !projEstimatedHours) {
    return { dates: [], plannedHours: [], actualHours: [], remainingHours: [] };
  }

  const startDate = new Date(projStartDate);
  const endDate = projEstimatedEndDate ? new Date(projEstimatedEndDate) : new Date();
  const totalHours = parseFloat(String(projEstimatedHours));

  const dates: string[] = [];
  const plannedHours: number[] = [];
  const actualHours: number[] = [];
  const remainingHours: number[] = [];

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const hoursPerDay = totalHours / totalDays;

  const currentDate = new Date(startDate);
  let cumulativeActual = 0;

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    dates.push(dateStr);

    const dayIndex = Math.floor(
      (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const plannedRemaining = Math.max(0, totalHours - hoursPerDay * (dayIndex + 1));
    plannedHours.push(Math.round(plannedRemaining * 10) / 10);

    const dayActual = await db.get(
      `SELECT COALESCE(SUM(hours), 0) as hours
       FROM time_entries
       WHERE project_id = ? AND date <= ?`,
      [projectId, dateStr]
    );

    cumulativeActual = dayActual ? parseFloat(String(dayActual.hours)) : 0;
    actualHours.push(Math.round(cumulativeActual * 10) / 10);
    remainingHours.push(Math.round((totalHours - cumulativeActual) * 10) / 10);

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return { dates, plannedHours, actualHours, remainingHours };
}

export async function getProjectVelocity(projectId: number): Promise<VelocityData> {
  const db = getDatabase();

  const weeks: string[] = [];
  const hoursCompleted: number[] = [];
  const tasksCompleted: number[] = [];

  const weekData = await db.all(
    `SELECT
      DATE(date, 'weekday 0', '-6 days') as week_start,
      SUM(hours) as hours,
      COUNT(DISTINCT task_id) as tasks
     FROM time_entries
     WHERE project_id = ?
     GROUP BY week_start
     ORDER BY week_start DESC
     LIMIT 8`,
    [projectId]
  );

  for (const week of weekData.reverse()) {
    weeks.push(String(week.week_start));
    hoursCompleted.push(parseFloat(String(week.hours)));
    tasksCompleted.push(Number(week.tasks));
  }

  const averageVelocity =
    hoursCompleted.length > 0
      ? hoursCompleted.reduce((a, b) => a + b, 0) / hoursCompleted.length
      : 0;

  return {
    weeks,
    hoursCompleted,
    tasksCompleted,
    averageVelocity: Math.round(averageVelocity * 10) / 10
  };
}
