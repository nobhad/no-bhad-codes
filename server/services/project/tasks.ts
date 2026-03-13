/**
 * ===============================================
 * PROJECT — TASK MANAGEMENT
 * ===============================================
 * Task CRUD, dependencies, comments, checklists, and global task queries.
 */

import { getDatabase } from '../../database/init.js';
import { checkAndUpdateMilestoneCompletion, updateProjectProgress } from '../progress-calculator.js';
import { userService } from '../user-service.js';
import { logger } from '../logger.js';
import {
  toProjectTask as toTask,
  toTaskDependency as toDependency,
  toTaskComment as toComment,
  toChecklistItem,
  type TaskRow,
  type DependencyRow,
  type CommentRow,
  type ChecklistRow,
} from '../../database/entities/index.js';
import type {
  SqlValue,
  ProjectTask,
  TaskCreateData,
  TaskDependency,
  TaskComment,
  ChecklistItem,
} from './types.js';
import {
  PROJECT_TASK_COLUMNS,
  TASK_DEPENDENCY_COLUMNS,
  TASK_CHECKLIST_ITEM_COLUMNS,
} from './types.js';

// ============================================
// TASK CRUD
// ============================================

export async function createTask(projectId: number, data: TaskCreateData): Promise<ProjectTask> {
  const db = getDatabase();

  let sortOrder = data.sortOrder;
  if (sortOrder === undefined) {
    const maxOrder = await db.get(
      'SELECT MAX(sort_order) as max_order FROM project_tasks WHERE project_id = ? AND parent_task_id IS NULL',
      [projectId]
    );
    sortOrder = (Number(maxOrder?.max_order) || 0) + 1;
  }

  const assignedToUserId = await userService.getUserIdByEmail(data.assignedTo);

  const result = await db.run(
    `INSERT INTO project_tasks (
      project_id, milestone_id, title, description, status, priority,
      assigned_to_user_id, due_date, estimated_hours, sort_order, parent_task_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      data.milestoneId || null,
      data.title,
      data.description || null,
      data.status || 'pending',
      data.priority || 'medium',
      assignedToUserId,
      data.dueDate || null,
      data.estimatedHours || null,
      sortOrder,
      data.parentTaskId || null
    ]
  );

  const task = await db.get(
    `SELECT t.*, u.display_name as assigned_to_name
     FROM project_tasks t
     LEFT JOIN users u ON t.assigned_to_user_id = u.id
     WHERE t.id = ?`,
    [result.lastID]
  );

  if (!task) {
    throw new Error('Failed to create task');
  }

  return toTask(task as unknown as TaskRow);
}

export async function getTasks(
  projectId: number,
  options?: {
    status?: ProjectTask['status'];
    assignedTo?: string;
    milestoneId?: number;
    includeSubtasks?: boolean;
  }
): Promise<ProjectTask[]> {
  const db = getDatabase();

  let query = `
    SELECT
      t.*,
      u.display_name as assigned_to_name,
      p.project_name,
      m.title as milestone_title
    FROM project_tasks t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assigned_to_user_id = u.id
    LEFT JOIN milestones m ON t.milestone_id = m.id
    WHERE t.project_id = ? AND t.deleted_at IS NULL
  `;
  const params: SqlValue[] = [projectId];

  if (options?.status) {
    query += ' AND t.status = ?';
    params.push(options.status);
  }
  if (options?.assignedTo) {
    query += ' AND (u.display_name = ? OR u.email = ?)';
    params.push(options.assignedTo);
    params.push(options.assignedTo);
  }
  if (options?.milestoneId) {
    query += ' AND t.milestone_id = ?';
    params.push(options.milestoneId);
  }
  if (!options?.includeSubtasks) {
    query += ' AND t.parent_task_id IS NULL';
  }

  query += ' ORDER BY t.sort_order ASC, t.created_at ASC';

  const rows = await db.all(query, params);
  const tasks = (
    rows as unknown as (TaskRow & { project_name?: string; milestone_title?: string })[]
  ).map((row) => ({
    ...toTask(row),
    projectName: row.project_name,
    milestoneTitle: row.milestone_title
  }));

  if (options?.includeSubtasks) {
    const taskMap = new Map<number, ProjectTask>();
    tasks.forEach((t) => taskMap.set(t.id, t));

    tasks.forEach((t) => {
      if (t.parentTaskId) {
        const parent = taskMap.get(t.parentTaskId);
        if (parent) {
          parent.subtasks = parent.subtasks || [];
          parent.subtasks.push(t);
        }
      }
    });

    return tasks.filter((t) => !t.parentTaskId);
  }

  return tasks;
}

export async function getTask(taskId: number): Promise<ProjectTask | null> {
  const db = getDatabase();

  const row = await db.get(
    `SELECT t.*, u.display_name as assigned_to_name
     FROM project_tasks t
     LEFT JOIN users u ON t.assigned_to_user_id = u.id
     WHERE t.id = ? AND t.deleted_at IS NULL`,
    [taskId]
  );

  if (!row) return null;

  const task = toTask(row as unknown as TaskRow);

  const subtaskRows = await db.all(
    `SELECT t.*, u.display_name as assigned_to_name
     FROM project_tasks t
     LEFT JOIN users u ON t.assigned_to_user_id = u.id
     WHERE t.parent_task_id = ? AND t.deleted_at IS NULL
     ORDER BY t.sort_order ASC`,
    [taskId]
  );
  task.subtasks = (subtaskRows as unknown as TaskRow[]).map(toTask);

  const depRows = await db.all(`SELECT ${TASK_DEPENDENCY_COLUMNS} FROM task_dependencies WHERE task_id = ?`, [taskId]);
  task.dependencies = (depRows as unknown as DependencyRow[]).map(toDependency);

  const checklistRows = await db.all(
    `SELECT ${TASK_CHECKLIST_ITEM_COLUMNS} FROM task_checklist_items WHERE task_id = ? ORDER BY sort_order ASC`,
    [taskId]
  );
  task.checklistItems = (checklistRows as unknown as ChecklistRow[]).map(toChecklistItem);

  return task;
}

export async function updateTask(
  taskId: number,
  data: Partial<TaskCreateData> & { actualHours?: number }
): Promise<ProjectTask> {
  const db = getDatabase();

  const currentTask = (await db.get(
    'SELECT milestone_id, project_id FROM project_tasks WHERE id = ?',
    [taskId]
  )) as { milestone_id: number | null; project_id: number } | undefined;

  if (!currentTask) {
    throw new Error('Task not found');
  }

  const updates: string[] = [];
  const values: SqlValue[] = [];
  const statusChanged = data.status !== undefined;

  if (data.milestoneId !== undefined) {
    updates.push('milestone_id = ?');
    values.push(data.milestoneId || null);
  }
  if (data.title !== undefined) {
    updates.push('title = ?');
    values.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    values.push(data.description || null);
  }
  if (data.status !== undefined) {
    updates.push('status = ?');
    values.push(data.status);
    if (data.status === 'completed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }
  }
  if (data.priority !== undefined) {
    updates.push('priority = ?');
    values.push(data.priority);
  }
  if (data.assignedTo !== undefined) {
    const userId = await userService.getUserIdByEmail(data.assignedTo);
    updates.push('assigned_to_user_id = ?');
    values.push(userId);
  }
  if (data.dueDate !== undefined) {
    updates.push('due_date = ?');
    values.push(data.dueDate || null);
  }
  if (data.estimatedHours !== undefined) {
    updates.push('estimated_hours = ?');
    values.push(data.estimatedHours || null);
  }
  if (data.actualHours !== undefined) {
    updates.push('actual_hours = ?');
    values.push(data.actualHours || null);
  }
  if (data.sortOrder !== undefined) {
    updates.push('sort_order = ?');
    values.push(data.sortOrder);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(taskId);
    await db.run(`UPDATE project_tasks SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  if (statusChanged && currentTask.milestone_id) {
    try {
      await checkAndUpdateMilestoneCompletion(currentTask.milestone_id);
    } catch (error) {
      logger.error('[ProjectService] Error updating milestone completion:', {
        error: error instanceof Error ? error : undefined
      });
    }
  }

  if (statusChanged) {
    try {
      await updateProjectProgress(currentTask.project_id);
    } catch (error) {
      logger.error('[ProjectService] Error updating project progress:', {
        error: error instanceof Error ? error : undefined
      });
    }
  }

  const task = await getTask(taskId);
  if (!task) {
    throw new Error('Task not found after update');
  }
  return task;
}

export async function deleteTask(taskId: number): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();

  const task = (await db.get('SELECT milestone_id, project_id FROM project_tasks WHERE id = ? AND deleted_at IS NULL', [
    taskId
  ])) as { milestone_id: number | null; project_id: number } | undefined;

  if (!task) {
    throw new Error('Task not found');
  }

  await db.run(
    'UPDATE project_tasks SET deleted_at = ?, deleted_by = ? WHERE id = ?',
    [now, 'admin', taskId]
  );

  if (task.milestone_id) {
    try {
      await checkAndUpdateMilestoneCompletion(task.milestone_id);
    } catch (error) {
      logger.error('[ProjectService] Error updating milestone completion after task deletion:', {
        error: error instanceof Error ? error : undefined
      });
    }
  }

  try {
    await updateProjectProgress(task.project_id);
  } catch (error) {
    logger.error('[ProjectService] Error updating project progress after task deletion:', {
      error: error instanceof Error ? error : undefined
    });
  }
}

export async function moveTask(taskId: number, newPosition: number, milestoneId?: number): Promise<void> {
  const db = getDatabase();

  const task = await db.get(`SELECT ${PROJECT_TASK_COLUMNS} FROM project_tasks WHERE id = ?`, [taskId]);

  if (!task) {
    throw new Error('Task not found');
  }

  const taskSortOrder = Number(task.sort_order);
  const taskProjectId = task.project_id as number;
  const taskMilestoneId = task.milestone_id as number | null;

  if (newPosition > taskSortOrder) {
    await db.run(
      `UPDATE project_tasks SET sort_order = sort_order - 1
       WHERE project_id = ? AND sort_order > ? AND sort_order <= ?`,
      [taskProjectId, taskSortOrder, newPosition]
    );
  } else {
    await db.run(
      `UPDATE project_tasks SET sort_order = sort_order + 1
       WHERE project_id = ? AND sort_order >= ? AND sort_order < ?`,
      [taskProjectId, newPosition, taskSortOrder]
    );
  }

  await db.run(
    'UPDATE project_tasks SET sort_order = ?, milestone_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newPosition, milestoneId ?? taskMilestoneId, taskId]
  );
}

export async function completeTask(taskId: number): Promise<ProjectTask> {
  return updateTask(taskId, { status: 'completed' });
}

// ============================================
// TASK DEPENDENCIES
// ============================================

export async function addDependency(
  taskId: number,
  dependsOnTaskId: number,
  type: TaskDependency['dependencyType'] = 'finish_to_start'
): Promise<TaskDependency> {
  const db = getDatabase();

  const wouldCreateCycle = await wouldCreateCyclicDependency(taskId, dependsOnTaskId);
  if (wouldCreateCycle) {
    throw new Error('Adding this dependency would create a circular dependency');
  }

  const result = await db.run(
    `INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id, dependency_type)
     VALUES (?, ?, ?)`,
    [taskId, dependsOnTaskId, type]
  );

  const dep = await db.get(`SELECT ${TASK_DEPENDENCY_COLUMNS} FROM task_dependencies WHERE id = ?`, [result.lastID]);

  if (!dep) {
    throw new Error('Failed to create dependency');
  }

  return toDependency(dep as unknown as DependencyRow);
}

async function wouldCreateCyclicDependency(
  taskId: number,
  dependsOnTaskId: number
): Promise<boolean> {
  const db = getDatabase();

  const visited = new Set<number>();
  const queue = [dependsOnTaskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = await db.all(
      'SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?',
      [current]
    );

    for (const dep of deps) {
      queue.push(Number(dep.depends_on_task_id));
    }
  }

  return false;
}

export async function removeDependency(taskId: number, dependsOnTaskId: number): Promise<void> {
  const db = getDatabase();
  await db.run('DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?', [
    taskId,
    dependsOnTaskId
  ]);
}

export async function getBlockedTasks(projectId: number): Promise<ProjectTask[]> {
  const db = getDatabase();

  const rows = await db.all(
    `SELECT DISTINCT t.*, u.display_name as assigned_to_name
     FROM project_tasks t
     LEFT JOIN users u ON t.assigned_to_user_id = u.id
     JOIN task_dependencies d ON t.id = d.task_id
     JOIN project_tasks dep ON d.depends_on_task_id = dep.id
     WHERE t.project_id = ? AND t.status NOT IN ('completed', 'cancelled')
       AND dep.status NOT IN ('completed', 'cancelled')
     ORDER BY t.sort_order`,
    [projectId]
  );

  return (rows as unknown as TaskRow[]).map(toTask);
}

// ============================================
// TASK COMMENTS
// ============================================

export async function addTaskComment(taskId: number, author: string, content: string): Promise<TaskComment> {
  const db = getDatabase();

  const authorUserId = await userService.getUserIdByEmailOrName(author);

  const result = await db.run(
    'INSERT INTO task_comments (task_id, author_user_id, content) VALUES (?, ?, ?)',
    [taskId, authorUserId, content]
  );

  const comment = await db.get(
    `SELECT tc.*, u.display_name as author_name
     FROM task_comments tc
     LEFT JOIN users u ON tc.author_user_id = u.id
     WHERE tc.id = ?`,
    [result.lastID]
  );

  if (!comment) {
    throw new Error('Failed to create comment');
  }

  return toComment(comment as unknown as CommentRow);
}

export async function getTaskComments(taskId: number): Promise<TaskComment[]> {
  const db = getDatabase();
  const rows = await db.all(
    `SELECT tc.*, u.display_name as author_name
     FROM task_comments tc
     LEFT JOIN users u ON tc.author_user_id = u.id
     WHERE tc.task_id = ?
     ORDER BY tc.created_at ASC`,
    [taskId]
  );
  return (rows as unknown as CommentRow[]).map(toComment);
}

export async function deleteTaskComment(commentId: number): Promise<void> {
  const db = getDatabase();
  await db.run('DELETE FROM task_comments WHERE id = ?', [commentId]);
}

// ============================================
// TASK CHECKLISTS
// ============================================

export async function addChecklistItem(taskId: number, content: string): Promise<ChecklistItem> {
  const db = getDatabase();

  const maxOrder = await db.get(
    'SELECT MAX(sort_order) as max_order FROM task_checklist_items WHERE task_id = ?',
    [taskId]
  );

  const result = await db.run(
    'INSERT INTO task_checklist_items (task_id, content, sort_order) VALUES (?, ?, ?)',
    [taskId, content, (Number(maxOrder?.max_order) || 0) + 1]
  );

  const item = await db.get(`SELECT ${TASK_CHECKLIST_ITEM_COLUMNS} FROM task_checklist_items WHERE id = ?`, [result.lastID]);

  if (!item) {
    throw new Error('Failed to create checklist item');
  }

  return toChecklistItem(item as unknown as ChecklistRow);
}

export async function toggleChecklistItem(itemId: number): Promise<ChecklistItem> {
  const db = getDatabase();

  await db.run(
    `UPDATE task_checklist_items SET
      is_completed = NOT is_completed,
      completed_at = CASE WHEN is_completed = 0 THEN CURRENT_TIMESTAMP ELSE NULL END
     WHERE id = ?`,
    [itemId]
  );

  const item = await db.get(`SELECT ${TASK_CHECKLIST_ITEM_COLUMNS} FROM task_checklist_items WHERE id = ?`, [itemId]);

  if (!item) {
    throw new Error('Checklist item not found');
  }

  return toChecklistItem(item as unknown as ChecklistRow);
}

export async function deleteChecklistItem(itemId: number): Promise<void> {
  const db = getDatabase();
  await db.run('DELETE FROM task_checklist_items WHERE id = ?', [itemId]);
}

// ============================================
// GLOBAL TASKS (ACROSS ALL PROJECTS)
// ============================================

export async function getAllTasks(options?: {
  status?: string;
  priority?: string;
  limit?: number;
}): Promise<
  (ProjectTask & { projectName: string; clientName?: string; milestoneTitle?: string })[]
> {
  const db = getDatabase();

  let query = `
    SELECT
      t.*,
      p.project_name,
      c.contact_name as client_name,
      m.title as milestone_title
    FROM project_tasks t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN clients c ON p.client_id = c.id
    LEFT JOIN milestones m ON t.milestone_id = m.id
    WHERE p.archived_at IS NULL
      AND p.status NOT IN ('cancelled', 'completed')
  `;
  const params: SqlValue[] = [];

  if (options?.status) {
    const statuses = options.status
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length === 1) {
      query += ' AND t.status = ?';
      params.push(statuses[0]);
    } else if (statuses.length > 1) {
      const placeholders = statuses.map(() => '?').join(', ');
      query += ` AND t.status IN (${placeholders})`;
      params.push(...statuses);
    }
  }
  if (options?.priority) {
    query += ' AND t.priority = ?';
    params.push(options.priority);
  }

  query += `
    ORDER BY
      CASE t.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END ASC,
      CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END ASC,
      t.due_date ASC,
      t.created_at DESC
  `;

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  const rows = await db.all(query, params);

  return (
    rows as unknown as (TaskRow & {
      project_name: string;
      client_name?: string;
      milestone_title?: string;
    })[]
  ).map((row) => ({
    ...toTask(row),
    projectName: row.project_name,
    clientName: row.client_name,
    milestoneTitle: row.milestone_title
  }));
}
