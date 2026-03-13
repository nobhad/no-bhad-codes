/**
 * ===============================================
 * PROJECT ENTITY SCHEMAS
 * ===============================================
 * @file server/database/entities/project.ts
 *
 * Entity schemas and mappers for project-related data types.
 */

import { defineSchema, definePartialSchema, createMapper } from '../entity-mapper.js';
import type { DatabaseRow } from '../init.js';
import type {
  ProjectTask,
  TaskDependency,
  TaskComment,
  ChecklistItem,
  TimeEntry,
  ProjectTemplate
} from '../../services/project-service.js';

// =====================================================
// ROW TYPE DEFINITIONS
// =====================================================

export interface TaskRow extends DatabaseRow {
  id: number;
  project_id: number;
  milestone_id?: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigned_to_user_id?: number;
  assigned_to_name?: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  sort_order: number;
  parent_task_id?: number;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DependencyRow extends DatabaseRow {
  id: number;
  task_id: number;
  depends_on_task_id: number;
  dependency_type: string;
  created_at: string;
}

export interface CommentRow extends DatabaseRow {
  id: number;
  task_id: number;
  author_user_id: number | null;
  author_name: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ChecklistRow extends DatabaseRow {
  id: number;
  task_id: number;
  content: string;
  is_completed: number;
  completed_at?: string;
  sort_order: number;
  created_at: string;
}

export interface TimeEntryRow extends DatabaseRow {
  id: number;
  project_id: number;
  task_id?: number;
  user_id: number | null;
  user_name: string | null;
  description?: string;
  hours: number;
  date: string;
  billable: number;
  hourly_rate?: number;
  created_at: string;
  updated_at: string;
  task_title?: string;
}

export interface TemplateRow extends DatabaseRow {
  id: number;
  name: string;
  description?: string;
  project_type?: string;
  default_milestones?: string;
  default_tasks?: string;
  estimated_duration_days?: number;
  default_hourly_rate?: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// =====================================================
// ENTITY SCHEMAS
// =====================================================

// ProjectTask has computed fields: subtasks, dependencies, blockedBy, checklistItems
export const projectTaskSchema = definePartialSchema<ProjectTask>()({
  id: 'number',
  projectId: { column: 'project_id', type: 'number' },
  milestoneId: { column: 'milestone_id', type: 'number?' },
  title: 'string',
  description: 'string?',
  status: {
    column: 'status',
    type: 'string',
    transform: (v) => v as ProjectTask['status']
  },
  priority: {
    column: 'priority',
    type: 'string',
    transform: (v) => v as ProjectTask['priority']
  },
  assignedTo: { column: 'assigned_to_name', type: 'string?' },
  dueDate: { column: 'due_date', type: 'string?' },
  estimatedHours: { column: 'estimated_hours', type: 'float?' },
  actualHours: { column: 'actual_hours', type: 'float?' },
  sortOrder: { column: 'sort_order', type: 'number' },
  parentTaskId: { column: 'parent_task_id', type: 'number?' },
  completedAt: { column: 'completed_at', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

export const taskDependencySchema = defineSchema<TaskDependency>({
  id: 'number',
  taskId: { column: 'task_id', type: 'number' },
  dependsOnTaskId: { column: 'depends_on_task_id', type: 'number' },
  dependencyType: {
    column: 'dependency_type',
    type: 'string',
    transform: (v) => v as TaskDependency['dependencyType']
  },
  createdAt: { column: 'created_at', type: 'string' }
});

export const taskCommentSchema = defineSchema<TaskComment>({
  id: 'number',
  taskId: { column: 'task_id', type: 'number' },
  author: {
    column: 'author_name',
    type: 'string',
    default: 'Unknown'
  },
  content: 'string',
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

export const checklistItemSchema = defineSchema<ChecklistItem>({
  id: 'number',
  taskId: { column: 'task_id', type: 'number' },
  content: 'string',
  isCompleted: { column: 'is_completed', type: 'boolean' },
  completedAt: { column: 'completed_at', type: 'string?' },
  sortOrder: { column: 'sort_order', type: 'number' },
  createdAt: { column: 'created_at', type: 'string' }
});

// TimeEntry has computed 'amount' field
export const timeEntrySchema = definePartialSchema<TimeEntry>()({
  id: 'number',
  projectId: { column: 'project_id', type: 'number' },
  taskId: { column: 'task_id', type: 'number?' },
  userName: {
    column: 'user_name',
    type: 'string',
    default: 'Unknown'
  },
  description: 'string?',
  hours: { column: 'hours', type: 'float' },
  date: 'string',
  billable: { column: 'billable', type: 'boolean' },
  hourlyRate: { column: 'hourly_rate', type: 'float?' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' },
  taskTitle: { column: 'task_title', type: 'string?' }
});

export const projectTemplateSchema = defineSchema<ProjectTemplate>({
  id: 'number',
  name: 'string',
  description: 'string?',
  projectType: { column: 'project_type', type: 'string?' },
  defaultMilestones: { column: 'default_milestones', type: 'json', default: [] },
  defaultTasks: { column: 'default_tasks', type: 'json', default: [] },
  estimatedDurationDays: { column: 'estimated_duration_days', type: 'number?' },
  defaultHourlyRate: { column: 'default_hourly_rate', type: 'float?' },
  isActive: { column: 'is_active', type: 'boolean' },
  defaultContentRequests: { column: 'default_content_requests', type: 'json?' },
  defaultPaymentSchedule: { column: 'default_payment_schedule', type: 'json?' },
  contractTemplateId: { column: 'contract_template_id', type: 'number?' },
  tierDefinitions: { column: 'tier_definitions', type: 'json?' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

// =====================================================
// MAPPER FUNCTIONS
// =====================================================

/**
 * Map a TaskRow to ProjectTask.
 * Note: subtasks, dependencies, blockedBy, checklistItems are computed fields.
 */
export function toProjectTask(row: TaskRow): ProjectTask {
  type BaseProjectTask = Omit<
    ProjectTask,
    'subtasks' | 'dependencies' | 'blockedBy' | 'checklistItems'
  >;
  return createMapper<TaskRow, BaseProjectTask>(
    projectTaskSchema as ReturnType<typeof defineSchema<BaseProjectTask>>
  )(row) as ProjectTask;
}
export const toTaskDependency = createMapper<DependencyRow, TaskDependency>(taskDependencySchema);
export const toTaskComment = createMapper<CommentRow, TaskComment>(taskCommentSchema);
export const toChecklistItem = createMapper<ChecklistRow, ChecklistItem>(checklistItemSchema);
export const toProjectTemplate = createMapper<TemplateRow, ProjectTemplate>(projectTemplateSchema);

/**
 * Custom mapper for TimeEntry to handle computed 'amount' field
 */
export function toTimeEntry(row: TimeEntryRow): TimeEntry {
  type BaseTimeEntry = Omit<TimeEntry, 'amount'>;
  const baseEntry = createMapper<TimeEntryRow, BaseTimeEntry>(
    timeEntrySchema as ReturnType<typeof defineSchema<BaseTimeEntry>>
  )(row);

  // Compute the amount if we have hours and hourly rate
  const amount = baseEntry.hourlyRate != null ? baseEntry.hours * baseEntry.hourlyRate : undefined;

  return {
    ...baseEntry,
    amount
  };
}
