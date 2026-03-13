/**
 * ===============================================
 * API TYPES — PROJECTS
 * ===============================================
 */

import type { PaginationParams } from './shared.js';

// ============================================
// Project API Types
// ============================================

/**
 * Project status values
 * NOTE: Must match database CHECK constraint in server/types/database.ts
 */
export type ProjectStatus =
  | 'pending'
  | 'active'
  | 'in-progress'
  | 'in-review'
  | 'completed'
  | 'on-hold'
  | 'cancelled';

/**
 * Project entity response (matches server API response)
 */
export interface ProjectResponse {
  id: number;
  name?: string; // Legacy field
  project_name?: string; // Preferred field
  client_id: number;
  client_name?: string;
  contact_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  status: ProjectStatus | string; // Allow string for flexibility
  project_type?: string;
  budget_range?: string;
  timeline?: string;
  priority?: string;
  start_date?: string;
  end_date?: string;
  estimated_end_date?: string;
  actual_end_date?: string;
  budget?: number;
  description?: string;
  progress?: number;
  created_at: string;
  updated_at?: string;
  // Stats from joins
  file_count?: number;
  message_count?: number;
  unread_count?: number;
  // Optional fields that may be present
  preview_url?: string;
  repository_url?: string;
  production_url?: string;
  deposit_amount?: number;
  contract_signed_at?: string;
  contract_signer_name?: string;
  contract_signer_email?: string;
  contract_signature_requested_at?: string;
  contract_signature_expires_at?: string;
  contract_countersigned_at?: string;
  contract_countersigner_name?: string;
  contract_countersigner_email?: string;
  contract_signed_pdf_path?: string;
  notes?: string;
  features?: string | string[]; // Can be JSON string or parsed array
  password_hash?: string; // Admin only field
  last_login_at?: string;
  price?: number;
}

/**
 * Project update request
 */
export interface ProjectUpdateRequest {
  name?: string;
  status?: ProjectStatus;
  start_date?: string;
  end_date?: string;
  budget?: number;
  description?: string;
  progress?: number;
}

/**
 * Project milestone response (matches server API response)
 */
export interface ProjectMilestoneResponse {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  due_date: string;
  completed_date?: string;
  is_completed: boolean;
  deliverables?: string | string[] | null; // Can be JSON string or parsed array or null
  // Task progress fields (returned from API with task stats)
  task_count?: number;
  completed_task_count?: number;
  progress_percentage?: number;
}

/**
 * Project file response
 */
export interface ProjectFileResponse {
  id: number;
  project_id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  uploaded_by: string;
  created_at: string;
}

/**
 * Projects list response
 */
export interface ProjectsListResponse {
  projects: ProjectResponse[];
  stats: ProjectStats;
}

/**
 * Project statistics
 */
export interface ProjectStats {
  total: number;
  active: number;
  completed: number;
  on_hold: number;
}


// ============================================
// Project Management API Types
// ============================================

/**
 * Project task status values
 */
export type ProjectTaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

/**
 * Project task priority values
 */
export type ProjectTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Project task
 */
export interface ProjectTask {
  id: number;
  projectId: number;
  milestoneId?: number;
  title: string;
  description?: string;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
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
  checklistItems?: ChecklistItem[];
}

/**
 * Project task response (snake_case for API)
 */
export interface ProjectTaskResponse {
  id: number;
  project_id: number;
  milestone_id?: number;
  title: string;
  description?: string;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  assigned_to?: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  sort_order: number;
  parent_task_id?: number;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Task create/update data
 */
export interface TaskCreateData {
  milestoneId?: number;
  title: string;
  description?: string;
  status?: ProjectTaskStatus;
  priority?: ProjectTaskPriority;
  assignedTo?: string;
  dueDate?: string;
  estimatedHours?: number;
  sortOrder?: number;
  parentTaskId?: number;
}

/**
 * Task dependency types
 */
export type TaskDependencyType =
  | 'finish_to_start'
  | 'start_to_start'
  | 'finish_to_finish'
  | 'start_to_finish';

/**
 * Task dependency
 */
export interface TaskDependency {
  id: number;
  taskId: number;
  dependsOnTaskId: number;
  dependencyType: TaskDependencyType;
  createdAt: string;
}

/**
 * Task dependency response (snake_case for API)
 */
export interface TaskDependencyResponse {
  id: number;
  task_id: number;
  depends_on_task_id: number;
  dependency_type: TaskDependencyType;
  created_at: string;
}

/**
 * Task comment
 */
export interface TaskComment {
  id: number;
  taskId: number;
  author: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Task comment response (snake_case for API)
 */
export interface TaskCommentResponse {
  id: number;
  task_id: number;
  author: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/**
 * Checklist item
 */
export interface ChecklistItem {
  id: number;
  taskId: number;
  content: string;
  isCompleted: boolean;
  completedAt?: string;
  sortOrder: number;
  createdAt: string;
}

/**
 * Checklist item response (snake_case for API)
 */
export interface ChecklistItemResponse {
  id: number;
  task_id: number;
  content: string;
  is_completed: boolean;
  completed_at?: string;
  sort_order: number;
  created_at: string;
}

/**
 * Time entry
 */
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

/**
 * Time entry response (snake_case for API)
 */
export interface TimeEntryResponse {
  id: number;
  project_id: number;
  task_id?: number;
  user_name: string;
  description?: string;
  hours: number;
  date: string;
  billable: boolean;
  hourly_rate?: number;
  created_at: string;
  updated_at: string;
  task_title?: string;
}

/**
 * Time entry create data
 */
export interface TimeEntryData {
  taskId?: number;
  userName: string;
  description?: string;
  hours: number;
  date: string;
  billable?: boolean;
  hourlyRate?: number;
}

/**
 * Project time statistics
 */
export interface ProjectTimeStats {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  totalAmount: number;
  byUser: { userName: string; hours: number; amount: number }[];
  byTask: { taskId: number; taskTitle: string; hours: number }[];
  byWeek: { weekStart: string; hours: number }[];
}

/**
 * Team time report
 */
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

/**
 * Template milestone
 */
export interface TemplateMilestone {
  name: string;
  description?: string;
  deliverables?: string;
  order: number;
  estimatedDays?: number;
}

/**
 * Template task
 */
export interface TemplateTask {
  title: string;
  description?: string;
  milestoneIndex: number;
  priority?: string;
  estimatedHours?: number;
}

/**
 * Project template
 */
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

/**
 * Project template response (snake_case for API)
 */
export interface ProjectTemplateResponse {
  id: number;
  name: string;
  description?: string;
  project_type?: string;
  default_milestones: TemplateMilestone[];
  default_tasks: TemplateTask[];
  estimated_duration_days?: number;
  default_hourly_rate?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Template create data
 */
export interface TemplateCreateData {
  name: string;
  description?: string;
  projectType?: string;
  defaultMilestones?: TemplateMilestone[];
  defaultTasks?: TemplateTask[];
  estimatedDurationDays?: number;
  defaultHourlyRate?: number;
}

/**
 * Project health status values
 */
export type ProjectHealthStatus = 'on_track' | 'at_risk' | 'off_track';

/**
 * Project health data
 */
export interface ProjectHealth {
  status: ProjectHealthStatus;
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

/**
 * Project burndown chart data
 */
export interface BurndownData {
  dates: string[];
  plannedHours: number[];
  actualHours: number[];
  remainingHours: number[];
}

/**
 * Project velocity data
 */
export interface VelocityData {
  weeks: string[];
  hoursCompleted: number[];
  tasksCompleted: number[];
  averageVelocity: number;
}

/**
 * Filter params for projects
 */
export interface ProjectFilterParams extends PaginationParams {
  status?: ProjectStatus;
  clientId?: number;
  dateFrom?: string;
  dateTo?: string;
}
