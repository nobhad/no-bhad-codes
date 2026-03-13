/**
 * ===============================================
 * PROJECT SERVICE — SHARED TYPES & COLUMN CONSTANTS
 * ===============================================
 */

import type { SqlParam } from '../../database/init.js';

// Type alias for backward compatibility
export type SqlValue = SqlParam;

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
  // Enhanced template fields
  defaultContentRequests?: TemplateContentRequest[];
  defaultPaymentSchedule?: TemplatePaymentMilestone[];
  contractTemplateId?: number;
  tierDefinitions?: TemplateTierDefinition[];
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

export interface TemplateContentRequest {
  title: string;
  description?: string;
  contentType: string;
  category?: string;
  isRequired?: boolean;
  dueOffsetDays?: number;
}

export interface TemplatePaymentMilestone {
  label?: string;
  percentageOfTotal: number;
  dueOffsetDays: number;
}

export interface TemplateTierDefinition {
  tierName: string;
  price: number;
  features: string[];
  description?: string;
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
  defaultContentRequests?: TemplateContentRequest[];
  defaultPaymentSchedule?: TemplatePaymentMilestone[];
  contractTemplateId?: number;
  tierDefinitions?: TemplateTierDefinition[];
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
// COLUMN CONSTANTS
// =====================================================

export const PROJECT_TASK_COLUMNS = `
  id, project_id, milestone_id, title, description, status, priority, assigned_to,
  due_date, estimated_hours, actual_hours, sort_order, parent_task_id,
  created_at, updated_at, completed_at
`.replace(/\s+/g, ' ').trim();

export const TASK_DEPENDENCY_COLUMNS = `
  id, task_id, depends_on_task_id, dependency_type, created_at
`.replace(/\s+/g, ' ').trim();

export const TASK_CHECKLIST_ITEM_COLUMNS = `
  id, task_id, content, is_completed, completed_at, sort_order, created_at
`.replace(/\s+/g, ' ').trim();

export const PROJECT_TEMPLATE_COLUMNS = `
  id, name, description, project_type, default_milestones, default_tasks,
  estimated_duration_days, default_hourly_rate, is_active,
  default_content_requests, default_payment_schedule, contract_template_id, tier_definitions,
  created_at, updated_at
`.replace(/\s+/g, ' ').trim();
