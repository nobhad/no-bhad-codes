/**
 * ===============================================
 * PROJECT MANAGEMENT SERVICE
 * ===============================================
 * @file server/services/project-service.ts
 *
 * Advanced project management with tasks, time tracking,
 * templates, dependencies, and project health metrics.
 */

import { getDatabase } from '../database/init.js';
import { checkAndUpdateMilestoneCompletion, updateProjectProgress } from './progress-calculator.js';
import { userService } from './user-service.js';

// Type definitions
type SqlValue = string | number | boolean | null;

// =====================================================
// INTERFACES - Tasks
// =====================================================

export interface ProjectTask {
  id: number;
  projectId: number;
  milestoneId?: number;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  sortOrder: number;
  parentTaskId?: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  subtasks?: ProjectTask[];
  dependencies?: TaskDependency[];
  blockedBy?: ProjectTask[];
  checklistItems?: ChecklistItem[];
}

export interface TaskCreateData {
  milestoneId?: number;
  title: string;
  description?: string;
  status?: ProjectTask['status'];
  priority?: ProjectTask['priority'];
  assignedTo?: string;
  dueDate?: string;
  estimatedHours?: number;
  sortOrder?: number;
  parentTaskId?: number;
}

interface TaskRow {
  id: number;
  project_id: number;
  milestone_id?: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigned_to?: string;
  due_date?: string;
  estimated_hours?: number | string;
  actual_hours?: number | string;
  sort_order: number;
  parent_task_id?: number;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// INTERFACES - Dependencies
// =====================================================

export interface TaskDependency {
  id: number;
  taskId: number;
  dependsOnTaskId: number;
  dependencyType: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
  createdAt: string;
}

interface DependencyRow {
  id: number;
  task_id: number;
  depends_on_task_id: number;
  dependency_type: string;
  created_at: string;
}

// =====================================================
// INTERFACES - Comments
// =====================================================

export interface TaskComment {
  id: number;
  taskId: number;
  author: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface CommentRow {
  id: number;
  task_id: number;
  author: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// INTERFACES - Checklist
// =====================================================

export interface ChecklistItem {
  id: number;
  taskId: number;
  content: string;
  isCompleted: boolean;
  completedAt?: string;
  sortOrder: number;
  createdAt: string;
}

interface ChecklistRow {
  id: number;
  task_id: number;
  content: string;
  is_completed: number;
  completed_at?: string;
  sort_order: number;
  created_at: string;
}

// =====================================================
// INTERFACES - Time Tracking
// =====================================================

export interface TimeEntry {
  id: number;
  projectId: number;
  taskId?: number;
  userName: string;
  description?: string;
  hours: number;
  date: string;
  billable: boolean;
  hourlyRate?: number;
  createdAt: string;
  updatedAt: string;
  // Computed
  amount?: number;
  taskTitle?: string;
}

export interface TimeEntryData {
  taskId?: number;
  userName: string;
  description?: string;
  hours: number;
  date: string;
  billable?: boolean;
  hourlyRate?: number;
}

interface TimeEntryRow {
  id: number;
  project_id: number;
  task_id?: number;
  user_name: string;
  description?: string;
  hours: number | string;
  date: string;
  billable: number;
  hourly_rate?: number | string;
  created_at: string;
  updated_at: string;
  task_title?: string;
}

export interface TimeStats {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  totalAmount: number;
  byUser: { userName: string; hours: number; amount: number }[];
  byTask: { taskId: number; taskTitle: string; hours: number }[];
  byWeek: { weekStart: string; hours: number }[];
}

export interface TeamTimeReport {
  startDate: string;
  endDate: string;
  totalHours: number;
  totalAmount: number;
  byUser: {
    userName: string;
    totalHours: number;
    billableHours: number;
    totalAmount: number;
    projects: { projectId: number; projectName: string; hours: number }[];
  }[];
}

// =====================================================
// INTERFACES - Templates
// =====================================================

export interface ProjectTemplate {
  id: number;
  name: string;
  description?: string;
  projectType?: string;
  defaultMilestones: TemplateMilestone[];
  defaultTasks: TemplateTask[];
  estimatedDurationDays?: number;
  defaultHourlyRate?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateMilestone {
  name: string;
  description?: string;
  deliverables?: string;
  order: number;
  estimatedDays?: number;
}

export interface TemplateTask {
  title: string;
  description?: string;
  milestoneIndex: number;
  priority?: string;
  estimatedHours?: number;
}

export interface TemplateData {
  name: string;
  description?: string;
  projectType?: string;
  defaultMilestones?: TemplateMilestone[];
  defaultTasks?: TemplateTask[];
  estimatedDurationDays?: number;
  defaultHourlyRate?: number;
}

interface TemplateRow {
  id: number;
  name: string;
  description?: string;
  project_type?: string;
  default_milestones?: string;
  default_tasks?: string;
  estimated_duration_days?: number;
  default_hourly_rate?: number | string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// =====================================================
// INTERFACES - Project Health
// =====================================================

export interface ProjectHealth {
  status: 'on_track' | 'at_risk' | 'off_track';
  score: number;
  factors: {
    scheduleHealth: number;
    budgetHealth: number;
    taskCompletion: number;
    milestoneProgress: number;
  };
  issues: string[];
  lastCalculated: string;
}

export interface BurndownData {
  dates: string[];
  plannedHours: number[];
  actualHours: number[];
  remainingHours: number[];
}

export interface VelocityData {
  weeks: string[];
  hoursCompleted: number[];
  tasksCompleted: number[];
  averageVelocity: number;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function toTask(row: TaskRow): ProjectTask {
  return {
    id: row.id,
    projectId: row.project_id,
    milestoneId: row.milestone_id,
    title: row.title,
    description: row.description,
    status: row.status as ProjectTask['status'],
    priority: row.priority as ProjectTask['priority'],
    assignedTo: row.assigned_to,
    dueDate: row.due_date,
    estimatedHours: row.estimated_hours ? parseFloat(String(row.estimated_hours)) : undefined,
    actualHours: row.actual_hours ? parseFloat(String(row.actual_hours)) : undefined,
    sortOrder: row.sort_order,
    parentTaskId: row.parent_task_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toDependency(row: DependencyRow): TaskDependency {
  return {
    id: row.id,
    taskId: row.task_id,
    dependsOnTaskId: row.depends_on_task_id,
    dependencyType: row.dependency_type as TaskDependency['dependencyType'],
    createdAt: row.created_at
  };
}

function toComment(row: CommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    author: row.author,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toChecklistItem(row: ChecklistRow): ChecklistItem {
  return {
    id: row.id,
    taskId: row.task_id,
    content: row.content,
    isCompleted: Boolean(row.is_completed),
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at
  };
}

function toTimeEntry(row: TimeEntryRow): TimeEntry {
  const hours = parseFloat(String(row.hours));
  const hourlyRate = row.hourly_rate ? parseFloat(String(row.hourly_rate)) : undefined;
  return {
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id,
    userName: row.user_name,
    description: row.description,
    hours,
    date: row.date,
    billable: Boolean(row.billable),
    hourlyRate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    amount: hourlyRate ? hours * hourlyRate : undefined,
    taskTitle: row.task_title
  };
}

function toTemplate(row: TemplateRow): ProjectTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    projectType: row.project_type,
    defaultMilestones: row.default_milestones ? JSON.parse(row.default_milestones) : [],
    defaultTasks: row.default_tasks ? JSON.parse(row.default_tasks) : [],
    estimatedDurationDays: row.estimated_duration_days,
    defaultHourlyRate: row.default_hourly_rate ? parseFloat(String(row.default_hourly_rate)) : undefined,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// =====================================================
// PROJECT SERVICE CLASS
// =====================================================

class ProjectService {
  // ===================================================
  // TASK MANAGEMENT
  // ===================================================

  /**
   * Create a new task
   */
  async createTask(projectId: number, data: TaskCreateData): Promise<ProjectTask> {
    const db = getDatabase();

    // Get max sort order if not specified
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxOrder = await db.get(
        'SELECT MAX(sort_order) as max_order FROM project_tasks WHERE project_id = ? AND parent_task_id IS NULL',
        [projectId]
      );
      sortOrder = (Number(maxOrder?.max_order) || 0) + 1;
    }

    // Look up user ID for assigned_to
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
      'SELECT * FROM project_tasks WHERE id = ?',
      [result.lastID]
    );

    if (!task) {
      throw new Error('Failed to create task');
    }

    return toTask(task as unknown as TaskRow);
  }

  /**
   * Get all tasks for a project
   */
  async getTasks(projectId: number, options?: {
    status?: ProjectTask['status'];
    assignedTo?: string;
    milestoneId?: number;
    includeSubtasks?: boolean;
  }): Promise<ProjectTask[]> {
    const db = getDatabase();

    let query = `
      SELECT
        t.*,
        p.project_name,
        m.title as milestone_title
      FROM project_tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN milestones m ON t.milestone_id = m.id
      WHERE t.project_id = ?
    `;
    const params: SqlValue[] = [projectId];

    if (options?.status) {
      query += ' AND t.status = ?';
      params.push(options.status);
    }
    if (options?.assignedTo) {
      query += ' AND t.assigned_to = ?';
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
    const tasks = (rows as unknown as (TaskRow & { project_name?: string; milestone_title?: string })[]).map(row => ({
      ...toTask(row),
      projectName: row.project_name,
      milestoneTitle: row.milestone_title
    }));

    // Attach subtasks if requested
    if (options?.includeSubtasks) {
      const taskMap = new Map<number, ProjectTask>();
      tasks.forEach(t => taskMap.set(t.id, t));

      tasks.forEach(t => {
        if (t.parentTaskId) {
          const parent = taskMap.get(t.parentTaskId);
          if (parent) {
            parent.subtasks = parent.subtasks || [];
            parent.subtasks.push(t);
          }
        }
      });

      return tasks.filter(t => !t.parentTaskId);
    }

    return tasks;
  }

  /**
   * Get a single task with all details
   */
  async getTask(taskId: number): Promise<ProjectTask | null> {
    const db = getDatabase();

    const row = await db.get(
      'SELECT * FROM project_tasks WHERE id = ?',
      [taskId]
    );

    if (!row) return null;

    const task = toTask(row as unknown as TaskRow);

    // Get subtasks
    const subtaskRows = await db.all(
      'SELECT * FROM project_tasks WHERE parent_task_id = ? ORDER BY sort_order ASC',
      [taskId]
    );
    task.subtasks = (subtaskRows as unknown as TaskRow[]).map(toTask);

    // Get dependencies
    const depRows = await db.all(
      'SELECT * FROM task_dependencies WHERE task_id = ?',
      [taskId]
    );
    task.dependencies = (depRows as unknown as DependencyRow[]).map(toDependency);

    // Get checklist items
    const checklistRows = await db.all(
      'SELECT * FROM task_checklist_items WHERE task_id = ? ORDER BY sort_order ASC',
      [taskId]
    );
    task.checklistItems = (checklistRows as unknown as ChecklistRow[]).map(toChecklistItem);

    return task;
  }

  /**
   * Update a task
   */
  async updateTask(taskId: number, data: Partial<TaskCreateData> & { actualHours?: number }): Promise<ProjectTask> {
    const db = getDatabase();

    // Get current task to check milestone_id and project_id
    const currentTask = await db.get(
      'SELECT milestone_id, project_id FROM project_tasks WHERE id = ?',
      [taskId]
    ) as { milestone_id: number | null; project_id: number } | undefined;

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
      await db.run(
        `UPDATE project_tasks SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Update milestone completion status if task status changed and task belongs to a milestone
    if (statusChanged && currentTask.milestone_id) {
      try {
        await checkAndUpdateMilestoneCompletion(currentTask.milestone_id);
      } catch (error) {
        console.error(`[ProjectService] Error updating milestone completion:`, error);
        // Don't fail the task update if milestone update fails
      }
    }

    // Update project progress if task status changed
    if (statusChanged) {
      try {
        await updateProjectProgress(currentTask.project_id);
      } catch (error) {
        console.error(`[ProjectService] Error updating project progress:`, error);
        // Don't fail the task update if project progress update fails
      }
    }

    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error('Task not found after update');
    }
    return task;
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: number): Promise<void> {
    const db = getDatabase();

    // Get task info before deleting to update milestone/project progress
    const task = await db.get(
      'SELECT milestone_id, project_id FROM project_tasks WHERE id = ?',
      [taskId]
    ) as { milestone_id: number | null; project_id: number } | undefined;

    if (!task) {
      throw new Error('Task not found');
    }

    await db.run('DELETE FROM project_tasks WHERE id = ?', [taskId]);

    // Update milestone completion status if task belonged to a milestone
    if (task.milestone_id) {
      try {
        await checkAndUpdateMilestoneCompletion(task.milestone_id);
      } catch (error) {
        console.error(`[ProjectService] Error updating milestone completion after task deletion:`, error);
      }
    }

    // Update project progress
    try {
      await updateProjectProgress(task.project_id);
    } catch (error) {
      console.error(`[ProjectService] Error updating project progress after task deletion:`, error);
    }
  }

  /**
   * Move task to new position
   */
  async moveTask(taskId: number, newPosition: number, milestoneId?: number): Promise<void> {
    const db = getDatabase();

    // Get current task
    const task = await db.get(
      'SELECT * FROM project_tasks WHERE id = ?',
      [taskId]
    );

    if (!task) {
      throw new Error('Task not found');
    }

    const taskSortOrder = Number(task.sort_order);
    const taskProjectId = task.project_id as number;
    const taskMilestoneId = task.milestone_id as number | null;

    // Update sort orders for other tasks
    if (newPosition > taskSortOrder) {
      // Moving down
      await db.run(
        `UPDATE project_tasks SET sort_order = sort_order - 1
         WHERE project_id = ? AND sort_order > ? AND sort_order <= ?`,
        [taskProjectId, taskSortOrder, newPosition]
      );
    } else {
      // Moving up
      await db.run(
        `UPDATE project_tasks SET sort_order = sort_order + 1
         WHERE project_id = ? AND sort_order >= ? AND sort_order < ?`,
        [taskProjectId, newPosition, taskSortOrder]
      );
    }

    // Update task
    await db.run(
      `UPDATE project_tasks SET sort_order = ?, milestone_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newPosition, milestoneId ?? taskMilestoneId, taskId]
    );
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: number): Promise<ProjectTask> {
    return this.updateTask(taskId, { status: 'completed' });
  }

  // ===================================================
  // TASK DEPENDENCIES
  // ===================================================

  /**
   * Add a dependency
   */
  async addDependency(taskId: number, dependsOnTaskId: number, type: TaskDependency['dependencyType'] = 'finish_to_start'): Promise<TaskDependency> {
    const db = getDatabase();

    // Check for circular dependency
    const wouldCreateCycle = await this.wouldCreateCyclicDependency(taskId, dependsOnTaskId);
    if (wouldCreateCycle) {
      throw new Error('Adding this dependency would create a circular dependency');
    }

    const result = await db.run(
      `INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id, dependency_type)
       VALUES (?, ?, ?)`,
      [taskId, dependsOnTaskId, type]
    );

    const dep = await db.get(
      'SELECT * FROM task_dependencies WHERE id = ?',
      [result.lastID]
    );

    if (!dep) {
      throw new Error('Failed to create dependency');
    }

    return toDependency(dep as unknown as DependencyRow);
  }

  /**
   * Check for cyclic dependency
   */
  private async wouldCreateCyclicDependency(taskId: number, dependsOnTaskId: number): Promise<boolean> {
    const db = getDatabase();

    // Simple check: see if dependsOnTaskId already depends on taskId
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

  /**
   * Remove a dependency
   */
  async removeDependency(taskId: number, dependsOnTaskId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?',
      [taskId, dependsOnTaskId]
    );
  }

  /**
   * Get blocked tasks (tasks with incomplete dependencies)
   */
  async getBlockedTasks(projectId: number): Promise<ProjectTask[]> {
    const db = getDatabase();

    const rows = await db.all(
      `SELECT DISTINCT t.* FROM project_tasks t
       JOIN task_dependencies d ON t.id = d.task_id
       JOIN project_tasks dep ON d.depends_on_task_id = dep.id
       WHERE t.project_id = ? AND t.status NOT IN ('completed', 'cancelled')
         AND dep.status NOT IN ('completed', 'cancelled')
       ORDER BY t.sort_order`,
      [projectId]
    );

    return (rows as unknown as TaskRow[]).map(toTask);
  }

  // ===================================================
  // TASK COMMENTS
  // ===================================================

  /**
   * Add a comment to a task
   */
  async addTaskComment(taskId: number, author: string, content: string): Promise<TaskComment> {
    const db = getDatabase();

    // Look up user ID for author
    const authorUserId = await userService.getUserIdByEmailOrName(author);

    const result = await db.run(
      'INSERT INTO task_comments (task_id, author_user_id, content) VALUES (?, ?, ?)',
      [taskId, authorUserId, content]
    );

    const comment = await db.get(
      'SELECT * FROM task_comments WHERE id = ?',
      [result.lastID]
    );

    if (!comment) {
      throw new Error('Failed to create comment');
    }

    return toComment(comment as unknown as CommentRow);
  }

  /**
   * Get comments for a task
   */
  async getTaskComments(taskId: number): Promise<TaskComment[]> {
    const db = getDatabase();
    const rows = await db.all(
      'SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC',
      [taskId]
    );
    return (rows as unknown as CommentRow[]).map(toComment);
  }

  /**
   * Delete a comment
   */
  async deleteTaskComment(commentId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM task_comments WHERE id = ?', [commentId]);
  }

  // ===================================================
  // TASK CHECKLISTS
  // ===================================================

  /**
   * Add checklist item
   */
  async addChecklistItem(taskId: number, content: string): Promise<ChecklistItem> {
    const db = getDatabase();

    const maxOrder = await db.get(
      'SELECT MAX(sort_order) as max_order FROM task_checklist_items WHERE task_id = ?',
      [taskId]
    );

    const result = await db.run(
      'INSERT INTO task_checklist_items (task_id, content, sort_order) VALUES (?, ?, ?)',
      [taskId, content, (Number(maxOrder?.max_order) || 0) + 1]
    );

    const item = await db.get(
      'SELECT * FROM task_checklist_items WHERE id = ?',
      [result.lastID]
    );

    if (!item) {
      throw new Error('Failed to create checklist item');
    }

    return toChecklistItem(item as unknown as ChecklistRow);
  }

  /**
   * Toggle checklist item
   */
  async toggleChecklistItem(itemId: number): Promise<ChecklistItem> {
    const db = getDatabase();

    await db.run(
      `UPDATE task_checklist_items SET
        is_completed = NOT is_completed,
        completed_at = CASE WHEN is_completed = 0 THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = ?`,
      [itemId]
    );

    const item = await db.get(
      'SELECT * FROM task_checklist_items WHERE id = ?',
      [itemId]
    );

    if (!item) {
      throw new Error('Checklist item not found');
    }

    return toChecklistItem(item as unknown as ChecklistRow);
  }

  /**
   * Delete checklist item
   */
  async deleteChecklistItem(itemId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM task_checklist_items WHERE id = ?', [itemId]);
  }

  // ===================================================
  // TIME TRACKING
  // ===================================================

  /**
   * Log time entry
   */
  async logTime(projectId: number, data: TimeEntryData): Promise<TimeEntry> {
    const db = getDatabase();

    // Look up user ID for user
    const userId = await userService.getUserIdByEmailOrName(data.userName);

    const result = await db.run(
      `INSERT INTO time_entries (
        project_id, task_id, user_id, description, hours, date, billable, hourly_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        data.taskId || null,
        userId,
        data.description || null,
        data.hours,
        data.date,
        data.billable !== false ? 1 : 0,
        data.hourlyRate || null
      ]
    );

    // Update task actual hours
    if (data.taskId) {
      await db.run(
        `UPDATE project_tasks SET
          actual_hours = COALESCE(actual_hours, 0) + ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [data.hours, data.taskId]
      );
    }

    // Update project actual hours
    await db.run(
      `UPDATE projects SET
        actual_hours = COALESCE(actual_hours, 0) + ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [data.hours, projectId]
    );

    const entry = await db.get(
      'SELECT * FROM time_entries WHERE id = ?',
      [result.lastID]
    );

    if (!entry) {
      throw new Error('Failed to log time');
    }

    return toTimeEntry(entry as unknown as TimeEntryRow);
  }

  /**
   * Get time entries for a project
   */
  async getTimeEntries(projectId: number, options?: {
    startDate?: string;
    endDate?: string;
    userName?: string;
    taskId?: number;
  }): Promise<TimeEntry[]> {
    const db = getDatabase();

    let query = `SELECT te.*, pt.title as task_title
                 FROM time_entries te
                 LEFT JOIN project_tasks pt ON te.task_id = pt.id
                 WHERE te.project_id = ?`;
    const params: SqlValue[] = [projectId];

    if (options?.startDate) {
      query += ' AND te.date >= ?';
      params.push(options.startDate);
    }
    if (options?.endDate) {
      query += ' AND te.date <= ?';
      params.push(options.endDate);
    }
    if (options?.userName) {
      query += ' AND te.user_name = ?';
      params.push(options.userName);
    }
    if (options?.taskId) {
      query += ' AND te.task_id = ?';
      params.push(options.taskId);
    }

    query += ' ORDER BY te.date DESC, te.created_at DESC';

    const rows = await db.all(query, params);
    return (rows as unknown as TimeEntryRow[]).map(toTimeEntry);
  }

  /**
   * Update time entry
   */
  async updateTimeEntry(entryId: number, data: Partial<TimeEntryData>): Promise<TimeEntry> {
    const db = getDatabase();

    const updates: string[] = [];
    const values: SqlValue[] = [];

    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description || null);
    }
    if (data.hours !== undefined) {
      updates.push('hours = ?');
      values.push(data.hours);
    }
    if (data.date !== undefined) {
      updates.push('date = ?');
      values.push(data.date);
    }
    if (data.billable !== undefined) {
      updates.push('billable = ?');
      values.push(data.billable ? 1 : 0);
    }
    if (data.hourlyRate !== undefined) {
      updates.push('hourly_rate = ?');
      values.push(data.hourlyRate || null);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(entryId);
      await db.run(
        `UPDATE time_entries SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    const entry = await db.get(
      'SELECT * FROM time_entries WHERE id = ?',
      [entryId]
    );

    if (!entry) {
      throw new Error('Time entry not found');
    }

    return toTimeEntry(entry as unknown as TimeEntryRow);
  }

  /**
   * Delete time entry
   */
  async deleteTimeEntry(entryId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM time_entries WHERE id = ?', [entryId]);
  }

  /**
   * Get project time statistics
   */
  async getProjectTimeStats(projectId: number): Promise<TimeStats> {
    const db = getDatabase();

    // Total hours
    const totals = await db.get(
      `SELECT
        SUM(hours) as total,
        SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END) as billable,
        SUM(CASE WHEN billable = 0 THEN hours ELSE 0 END) as non_billable,
        SUM(CASE WHEN billable = 1 THEN hours * COALESCE(hourly_rate, 0) ELSE 0 END) as amount
       FROM time_entries
       WHERE project_id = ?`,
      [projectId]
    );

    // By user
    const byUser = await db.all(
      `SELECT user_name, SUM(hours) as hours,
        SUM(CASE WHEN billable = 1 THEN hours * COALESCE(hourly_rate, 0) ELSE 0 END) as amount
       FROM time_entries
       WHERE project_id = ?
       GROUP BY user_name
       ORDER BY hours DESC`,
      [projectId]
    );

    // By task
    const byTask = await db.all(
      `SELECT te.task_id, COALESCE(pt.title, 'No Task') as task_title, SUM(te.hours) as hours
       FROM time_entries te
       LEFT JOIN project_tasks pt ON te.task_id = pt.id
       WHERE te.project_id = ?
       GROUP BY te.task_id
       ORDER BY hours DESC`,
      [projectId]
    );

    // By week
    const byWeek = await db.all(
      `SELECT DATE(date, 'weekday 0', '-6 days') as week_start, SUM(hours) as hours
       FROM time_entries
       WHERE project_id = ?
       GROUP BY week_start
       ORDER BY week_start DESC
       LIMIT 12`,
      [projectId]
    );

    return {
      totalHours: parseFloat(String(totals?.total ?? 0)),
      billableHours: parseFloat(String(totals?.billable ?? 0)),
      nonBillableHours: parseFloat(String(totals?.non_billable ?? 0)),
      totalAmount: parseFloat(String(totals?.amount ?? 0)),
      byUser: byUser.map(u => ({
        userName: String(u.user_name),
        hours: parseFloat(String(u.hours)),
        amount: parseFloat(String(u.amount))
      })),
      byTask: byTask.map(t => ({
        taskId: Number(t.task_id),
        taskTitle: String(t.task_title),
        hours: parseFloat(String(t.hours))
      })),
      byWeek: byWeek.map(w => ({
        weekStart: String(w.week_start),
        hours: parseFloat(String(w.hours))
      }))
    };
  }

  /**
   * Get team time report
   */
  async getTeamTimeReport(startDate: string, endDate: string): Promise<TeamTimeReport> {
    const db = getDatabase();

    const byUser = await db.all(
      `SELECT user_name,
        SUM(hours) as total_hours,
        SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END) as billable_hours,
        SUM(CASE WHEN billable = 1 THEN hours * COALESCE(hourly_rate, 0) ELSE 0 END) as total_amount
       FROM time_entries
       WHERE date >= ? AND date <= ?
       GROUP BY user_name
       ORDER BY total_hours DESC`,
      [startDate, endDate]
    );

    const report: TeamTimeReport = {
      startDate,
      endDate,
      totalHours: 0,
      totalAmount: 0,
      byUser: []
    };

    for (const user of byUser) {
      const userProjects = await db.all(
        `SELECT te.project_id, p.project_name, SUM(te.hours) as hours
         FROM time_entries te
         JOIN projects p ON te.project_id = p.id
         WHERE te.user_name = ? AND te.date >= ? AND te.date <= ?
         GROUP BY te.project_id
         ORDER BY hours DESC`,
        [String(user.user_name), startDate, endDate]
      );

      const totalHours = parseFloat(String(user.total_hours));
      const totalAmount = parseFloat(String(user.total_amount));

      report.totalHours += totalHours;
      report.totalAmount += totalAmount;

      report.byUser.push({
        userName: String(user.user_name),
        totalHours,
        billableHours: parseFloat(String(user.billable_hours)),
        totalAmount,
        projects: userProjects.map(p => ({
          projectId: Number(p.project_id),
          projectName: String(p.project_name),
          hours: parseFloat(String(p.hours))
        }))
      });
    }

    return report;
  }

  // ===================================================
  // TEMPLATES
  // ===================================================

  /**
   * Create a template
   */
  async createTemplate(data: TemplateData): Promise<ProjectTemplate> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO project_templates (
        name, description, project_type, default_milestones, default_tasks,
        estimated_duration_days, default_hourly_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.description || null,
        data.projectType || null,
        data.defaultMilestones ? JSON.stringify(data.defaultMilestones) : null,
        data.defaultTasks ? JSON.stringify(data.defaultTasks) : null,
        data.estimatedDurationDays || null,
        data.defaultHourlyRate || null
      ]
    );

    const template = await db.get(
      'SELECT * FROM project_templates WHERE id = ?',
      [result.lastID]
    );

    if (!template) {
      throw new Error('Failed to create template');
    }

    return toTemplate(template as unknown as TemplateRow);
  }

  /**
   * Get all templates
   */
  async getTemplates(projectType?: string): Promise<ProjectTemplate[]> {
    const db = getDatabase();

    let query = 'SELECT * FROM project_templates WHERE is_active = 1';
    const params: SqlValue[] = [];

    if (projectType) {
      query += ' AND project_type = ?';
      params.push(projectType);
    }

    query += ' ORDER BY name ASC';

    const rows = await db.all(query, params);
    return (rows as unknown as TemplateRow[]).map(toTemplate);
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: number): Promise<ProjectTemplate | null> {
    const db = getDatabase();
    const row = await db.get(
      'SELECT * FROM project_templates WHERE id = ?',
      [templateId]
    );
    return row ? toTemplate(row as unknown as TemplateRow) : null;
  }

  /**
   * Create project from template
   */
  async createProjectFromTemplate(
    templateId: number,
    clientId: number,
    projectName: string,
    startDate: string
  ): Promise<{ projectId: number; milestoneIds: number[]; taskIds: number[] }> {
    const db = getDatabase();

    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Create project
    const projectResult = await db.run(
      `INSERT INTO projects (
        client_id, project_name, project_type, status, template_id,
        hourly_rate, estimated_hours, start_date, created_at, updated_at
      ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        clientId,
        projectName,
        template.projectType,
        templateId,
        template.defaultHourlyRate,
        template.defaultTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
        startDate
      ]
    );
    const projectId = projectResult.lastID as number;

    // Create milestones
    const milestoneIds: number[] = [];
    let currentDate = new Date(startDate);

    for (const milestone of template.defaultMilestones) {
      const dueDate = new Date(currentDate);
      dueDate.setDate(dueDate.getDate() + (milestone.estimatedDays || 7));

      const milestoneResult = await db.run(
        `INSERT INTO milestones (
          project_id, title, description, deliverables, due_date, sort_order, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [
          projectId,
          milestone.name,
          milestone.description,
          milestone.deliverables,
          dueDate.toISOString().split('T')[0],
          milestone.order
        ]
      );
      milestoneIds.push(milestoneResult.lastID as number);
      currentDate = dueDate;
    }

    // Create tasks
    const taskIds: number[] = [];
    let taskOrder = 0;

    for (const task of template.defaultTasks) {
      const milestoneId = milestoneIds[task.milestoneIndex] || null;

      const taskResult = await db.run(
        `INSERT INTO project_tasks (
          project_id, milestone_id, title, description, priority, estimated_hours, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          milestoneId,
          task.title,
          task.description,
          task.priority || 'medium',
          task.estimatedHours,
          taskOrder++
        ]
      );
      taskIds.push(taskResult.lastID as number);
    }

    return { projectId, milestoneIds, taskIds };
  }

  // ===================================================
  // PROJECT HEALTH
  // ===================================================

  /**
   * Calculate project health
   */
  async calculateProjectHealth(projectId: number): Promise<ProjectHealth> {
    const db = getDatabase();

    const issues: string[] = [];
    let scheduleHealth = 100;
    let budgetHealth = 100;
    let taskCompletion = 100;
    let milestoneProgress = 100;

    // Get project
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
      const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

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
      (scheduleHealth * 0.3) +
      (budgetHealth * 0.2) +
      (taskCompletion * 0.25) +
      (milestoneProgress * 0.25)
    );

    // Determine status
    let status: ProjectHealth['status'];
    if (score >= 70) {
      status = 'on_track';
    } else if (score >= 40) {
      status = 'at_risk';
    } else {
      status = 'off_track';
    }

    // Update project
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

  /**
   * Get burndown chart data
   */
  async getProjectBurndown(projectId: number): Promise<BurndownData> {
    const db = getDatabase();

    // Get project dates
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

    let currentDate = new Date(startDate);
    let cumulativeActual = 0;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dates.push(dateStr);

      const dayIndex = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const plannedRemaining = Math.max(0, totalHours - (hoursPerDay * (dayIndex + 1)));
      plannedHours.push(Math.round(plannedRemaining * 10) / 10);

      // Get actual hours logged up to this date
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

  /**
   * Get velocity data
   */
  async getProjectVelocity(projectId: number): Promise<VelocityData> {
    const db = getDatabase();

    const weeks: string[] = [];
    const hoursCompleted: number[] = [];
    const tasksCompleted: number[] = [];

    // Get last 8 weeks of data
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

    const averageVelocity = hoursCompleted.length > 0
      ? hoursCompleted.reduce((a, b) => a + b, 0) / hoursCompleted.length
      : 0;

    return {
      weeks,
      hoursCompleted,
      tasksCompleted,
      averageVelocity: Math.round(averageVelocity * 10) / 10
    };
  }

  // ===================================================
  // PROJECT TAGS
  // ===================================================

  /**
   * Add tag to project
   */
  async addTagToProject(projectId: number, tagId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)',
      [projectId, tagId]
    );
  }

  /**
   * Remove tag from project
   */
  async removeTagFromProject(projectId: number, tagId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'DELETE FROM project_tags WHERE project_id = ? AND tag_id = ?',
      [projectId, tagId]
    );
  }

  /**
   * Get tags for project
   */
  async getProjectTags(projectId: number): Promise<{ id: number; name: string; color: string }[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT t.id, t.name, t.color
       FROM tags t
       JOIN project_tags pt ON t.id = pt.tag_id
       WHERE pt.project_id = ?
       ORDER BY t.name ASC`,
      [projectId]
    );
    return rows as unknown as { id: number; name: string; color: string }[];
  }

  /**
   * Archive a project
   */
  async archiveProject(projectId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE projects SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [projectId]
    );
  }

  /**
   * Unarchive a project
   */
  async unarchiveProject(projectId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE projects SET archived_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [projectId]
    );
  }

  // ===================================================
  // GLOBAL TASKS (ACROSS ALL PROJECTS)
  // ===================================================

  /**
   * Get all tasks across all projects
   * Returns tasks with project info, ordered by priority and due date
   */
  async getAllTasks(options?: {
    status?: string;
    priority?: string;
    limit?: number;
  }): Promise<(ProjectTask & { projectName: string; clientName?: string; milestoneTitle?: string })[]> {
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
      // Support comma-separated statuses (e.g., "pending,in_progress,blocked")
      const statuses = options.status.split(',').map(s => s.trim()).filter(Boolean);
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

    // Order by: urgent first, then by due date (nulls last), then by created date
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

    return (rows as unknown as (TaskRow & { project_name: string; client_name?: string; milestone_title?: string })[]).map(row => ({
      ...toTask(row),
      projectName: row.project_name,
      clientName: row.client_name,
      milestoneTitle: row.milestone_title
    }));
  }
}

// Export singleton instance
export const projectService = new ProjectService();
export default projectService;
