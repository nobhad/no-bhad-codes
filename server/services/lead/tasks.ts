/**
 * ===============================================
 * LEAD — TASK MANAGEMENT
 * ===============================================
 * Lead task CRUD, overdue tasks, and upcoming tasks.
 */

import { getDatabase } from '../../database/init.js';
import { userService } from '../user-service.js';
import {
  toLeadTask as toTask,
  type LeadTaskRow as TaskRow
} from '../../database/entities/index.js';
import type {
  SqlValue,
  LeadTask,
  TaskData
} from './types.js';

export async function createTask(projectId: number, data: TaskData): Promise<LeadTask> {
  const db = getDatabase();

  const assignedToUserId = await userService.getUserIdByEmail(data.assignedTo);

  const result = await db.run(
    `INSERT INTO lead_tasks (
      project_id, title, description, task_type, due_date, due_time,
      assigned_to_user_id, priority, reminder_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      data.title,
      data.description || null,
      data.taskType || 'follow_up',
      data.dueDate || null,
      data.dueTime || null,
      assignedToUserId,
      data.priority || 'medium',
      data.reminderAt || null
    ]
  );

  // Update project's next follow-up date
  if (data.dueDate) {
    await db.run(
      'UPDATE projects SET next_follow_up_at = ? WHERE id = ? AND (next_follow_up_at IS NULL OR next_follow_up_at > ?)',
      [data.dueDate, projectId, data.dueDate]
    );
  }

  const task = await db.get(
    `SELECT lt.*, u.display_name as assigned_to_name
     FROM lead_tasks lt
     LEFT JOIN users u ON lt.assigned_to_user_id = u.id
     WHERE lt.id = ?`,
    [result.lastID]
  );

  if (!task) {
    throw new Error('Failed to create task');
  }

  return toTask(task as unknown as TaskRow);
}

export async function getTasks(projectId: number): Promise<LeadTask[]> {
  const db = getDatabase();
  const rows = (await db.all(
    `SELECT lt.*, u.display_name as assigned_to_name
     FROM lead_tasks lt
     LEFT JOIN users u ON lt.assigned_to_user_id = u.id
     WHERE lt.project_id = ?
     ORDER BY
       CASE lt.status WHEN 'pending' THEN 0 WHEN 'snoozed' THEN 1 ELSE 2 END,
       CASE WHEN lt.due_date IS NULL THEN 1 ELSE 0 END,
       lt.due_date ASC`,
    [projectId]
  )) as unknown as TaskRow[];
  return rows.map(toTask);
}

export async function updateTask(
  taskId: number,
  data: Partial<TaskData> & { status?: LeadTask['status'] }
): Promise<LeadTask> {
  const db = getDatabase();

  const updates: string[] = [];
  const values: SqlValue[] = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    values.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    values.push(data.description || null);
  }
  if (data.taskType !== undefined) {
    updates.push('task_type = ?');
    values.push(data.taskType);
  }
  if (data.dueDate !== undefined) {
    updates.push('due_date = ?');
    values.push(data.dueDate || null);
  }
  if (data.dueTime !== undefined) {
    updates.push('due_time = ?');
    values.push(data.dueTime || null);
  }
  if (data.assignedTo !== undefined) {
    const userId = await userService.getUserIdByEmail(data.assignedTo);
    updates.push('assigned_to_user_id = ?');
    values.push(userId);
  }
  if (data.priority !== undefined) {
    updates.push('priority = ?');
    values.push(data.priority);
  }
  if (data.reminderAt !== undefined) {
    updates.push('reminder_at = ?');
    values.push(data.reminderAt || null);
  }
  if (data.status !== undefined) {
    updates.push('status = ?');
    values.push(data.status);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(taskId);
    await db.run(`UPDATE lead_tasks SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  const task = await db.get(
    `SELECT lt.*, u.display_name as assigned_to_name
     FROM lead_tasks lt
     LEFT JOIN users u ON lt.assigned_to_user_id = u.id
     WHERE lt.id = ?`,
    [taskId]
  );

  if (!task) {
    throw new Error('Task not found');
  }

  return toTask(task as unknown as TaskRow);
}

export async function completeTask(taskId: number, completedBy?: string): Promise<LeadTask> {
  const db = getDatabase();

  await db.run(
    `UPDATE lead_tasks SET
      status = 'completed',
      completed_at = CURRENT_TIMESTAMP,
      completed_by = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [completedBy || 'admin', taskId]
  );

  const task = (await db.get(
    `SELECT lt.*, u.display_name as assigned_to_name
     FROM lead_tasks lt
     LEFT JOIN users u ON lt.assigned_to_user_id = u.id
     WHERE lt.id = ?`,
    [taskId]
  )) as unknown as TaskRow | undefined;

  if (!task) {
    throw new Error('Task not found');
  }

  // Update project's last activity
  await db.run('UPDATE projects SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?', [
    task.project_id
  ]);

  return toTask(task);
}

export async function getOverdueTasks(): Promise<(LeadTask & { projectName: string })[]> {
  const db = getDatabase();

  const rows = (await db.all(
    `SELECT t.*, p.project_name
     FROM lead_tasks t
     JOIN active_projects p ON t.project_id = p.id
     WHERE t.status = 'pending'
       AND t.due_date < DATE('now')
     ORDER BY t.due_date ASC`
  )) as unknown as (TaskRow & { project_name: string })[];

  return rows.map((row) => ({
    ...toTask(row),
    projectName: row.project_name
  }));
}

export async function getUpcomingTasks(days: number = 7): Promise<(LeadTask & { projectName: string })[]> {
  const db = getDatabase();

  const rows = (await db.all(
    `SELECT t.*, p.project_name
     FROM lead_tasks t
     JOIN active_projects p ON t.project_id = p.id
     WHERE t.status = 'pending'
       AND t.due_date >= DATE('now')
       AND t.due_date <= DATE('now', '+' || ? || ' days')
     ORDER BY t.due_date ASC`,
    [days]
  )) as unknown as (TaskRow & { project_name: string })[];

  return rows.map((row) => ({
    ...toTask(row),
    projectName: row.project_name
  }));
}
