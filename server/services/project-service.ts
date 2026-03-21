/**
 * ===============================================
 * PROJECT MANAGEMENT SERVICE — BARREL
 * ===============================================
 * Composes sub-modules into the `projectService` singleton.
 *
 * Sub-modules:
 *   project/types.ts          — Shared types and column constants
 *   project/tasks.ts          — Task CRUD, dependencies, comments, checklists, global tasks
 *   project/time-tracking.ts  — Time entries, stats, team reports
 *   project/templates.ts      — Template CRUD, project creation from template
 *   project/health.ts         — Health scoring, burndown, velocity
 *   project/admin.ts          — Admin project creation, client ops, file records
 */

import { getDatabase } from '../database/init.js';
import * as core from './project/core.js';
import * as tasks from './project/tasks.js';
import * as timeTracking from './project/time-tracking.js';
import * as templates from './project/templates.js';
import * as health from './project/health.js';
import * as adminOps from './project/admin.js';
import * as milestones from './project/milestones.js';

// Re-export all types for consumers
export type {
  ProjectTask,
  TaskCreateData,
  TaskDependency,
  TaskComment,
  ChecklistItem,
  TimeEntry,
  TimeEntryData,
  TimeStats,
  TeamTimeReport,
  ProjectTemplate,
  TemplateMilestone,
  TemplateTask,
  TemplateData,
  ProjectHealth,
  BurndownData,
  VelocityData
} from './project/types.js';

export type {
  ProjectRow,
  ProjectFileRow,
  ProjectMessageRow,
  ProjectUpdateRow,
  ClientInfoRow,
  ProjectRequestData,
  AdminProjectCreateData,
  SaveFileRecordData
} from './project/core.js';

export type {
  ClientRow as AdminClientRow,
  NewClientData,
  CreateProjectData,
  FileRecordData
} from './project/admin.js';

/**
 * Singleton project service exposing all methods.
 * Route files import `{ projectService }` and call methods directly.
 */
export const projectService = {
  // ── Core CRUD ───────────────────────────────────
  listProjectsAdmin: core.listProjectsAdmin,
  listProjectsForClient: core.listProjectsForClient,
  getProjectAdmin: core.getProjectAdmin,
  getProjectForClient: core.getProjectForClient,
  getProjectFiles: core.getProjectFiles,
  getProjectMessages: core.getProjectMessages,
  getProjectUpdates: core.getProjectUpdates,
  createProjectRequest: core.createProjectRequest,
  getClientById: core.getClientById,
  createProjectAdmin: core.createProjectAdmin,
  getProjectByIdAdmin: core.getProjectByIdAdmin,
  getProjectByIdForClient: core.getProjectByIdForClient,
  updateProject: core.updateProject,
  setProjectCompletedDate: core.setProjectCompletedDate,
  getUpdatedProject: core.getUpdatedProject,
  getClientInfo: core.getClientInfo,
  saveFileRecord: core.saveFileRecord,
  projectExists: core.projectExists,
  getProjectDashboard: core.getProjectDashboard,
  addProjectUpdate: core.addProjectUpdate,

  // ── Tasks ─────────────────────────────────────
  createTask: tasks.createTask,
  getTasks: tasks.getTasks,
  getTask: tasks.getTask,
  updateTask: tasks.updateTask,
  deleteTask: tasks.deleteTask,
  moveTask: tasks.moveTask,
  completeTask: tasks.completeTask,

  // ── Dependencies ──────────────────────────────
  addDependency: tasks.addDependency,
  removeDependency: tasks.removeDependency,
  getBlockedTasks: tasks.getBlockedTasks,

  // ── Comments ──────────────────────────────────
  addTaskComment: tasks.addTaskComment,
  getTaskComments: tasks.getTaskComments,
  deleteTaskComment: tasks.deleteTaskComment,

  // ── Checklists ────────────────────────────────
  addChecklistItem: tasks.addChecklistItem,
  toggleChecklistItem: tasks.toggleChecklistItem,
  deleteChecklistItem: tasks.deleteChecklistItem,

  // ── Global Tasks ──────────────────────────────
  getAllTasks: tasks.getAllTasks,
  updateTaskAdmin: tasks.updateTaskAdmin,
  recalculateTaskDueDates: tasks.recalculateTaskDueDates,

  // ── Time Tracking ─────────────────────────────
  logTime: timeTracking.logTime,
  getTimeEntries: timeTracking.getTimeEntries,
  updateTimeEntry: timeTracking.updateTimeEntry,
  deleteTimeEntry: timeTracking.deleteTimeEntry,
  getProjectTimeStats: timeTracking.getProjectTimeStats,
  getTeamTimeReport: timeTracking.getTeamTimeReport,
  getAdminTimeEntries: timeTracking.getAdminTimeEntries,
  startTimer: timeTracking.startTimer,
  stopTimer: timeTracking.stopTimer,
  createAdminTimeEntry: timeTracking.createAdminTimeEntry,
  timeEntryExists: timeTracking.timeEntryExists,

  // ── Templates ─────────────────────────────────
  createTemplate: templates.createTemplate,
  getTemplates: templates.getTemplates,
  getTemplate: templates.getTemplate,
  updateTemplate: templates.updateTemplate,
  deleteTemplate: templates.deleteTemplate,
  createProjectFromTemplate: templates.createProjectFromTemplate,

  // ── Health ────────────────────────────────────
  calculateProjectHealth: health.calculateProjectHealth,
  getProjectBurndown: health.getProjectBurndown,
  getProjectVelocity: health.getProjectVelocity,

  // ── Admin Project Operations ────────────────────
  findClientByEmail: adminOps.findClientByEmail,
  getAdminClientById: adminOps.getClientById,
  createClient: adminOps.createClient,
  createAdminProject: adminOps.createProject,
  insertProjectUpdateRecord: adminOps.insertProjectUpdateRecord,
  insertFileRecord: adminOps.insertFileRecord,

  // ── Milestones ──────────────────────────────────
  milestoneProjectExists: milestones.projectExists,
  getMilestones: milestones.getMilestones,
  createMilestone: milestones.createMilestone,
  getMilestoneByIdAndProject: milestones.getMilestoneByIdAndProject,
  updateMilestone: milestones.updateMilestone,
  getActiveMilestone: milestones.getActiveMilestone,
  normalizeDeliverables: milestones.normalizeDeliverables,

  // ── Tags ──────────────────────────────────────
  async addTagToProject(projectId: number, tagId: number): Promise<void> {
    const db = getDatabase();
    await db.run('INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)', [
      projectId,
      tagId
    ]);
  },

  async removeTagFromProject(projectId: number, tagId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM project_tags WHERE project_id = ? AND tag_id = ?', [
      projectId,
      tagId
    ]);
  },

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
  },

  // ── Archive ───────────────────────────────────
  async archiveProject(projectId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE projects SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [projectId]
    );
  },

  async unarchiveProject(projectId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE projects SET archived_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [projectId]
    );
  }
};

export default projectService;
