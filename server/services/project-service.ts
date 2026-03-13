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
 */

import { getDatabase } from '../database/init.js';
import * as tasks from './project/tasks.js';
import * as timeTracking from './project/time-tracking.js';
import * as templates from './project/templates.js';
import * as health from './project/health.js';

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
  VelocityData,
} from './project/types.js';

/**
 * Singleton project service exposing all methods.
 * Route files import `{ projectService }` and call methods directly.
 */
export const projectService = {
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

  // ── Time Tracking ─────────────────────────────
  logTime: timeTracking.logTime,
  getTimeEntries: timeTracking.getTimeEntries,
  updateTimeEntry: timeTracking.updateTimeEntry,
  deleteTimeEntry: timeTracking.deleteTimeEntry,
  getProjectTimeStats: timeTracking.getProjectTimeStats,
  getTeamTimeReport: timeTracking.getTeamTimeReport,

  // ── Templates ─────────────────────────────────
  createTemplate: templates.createTemplate,
  getTemplates: templates.getTemplates,
  getTemplate: templates.getTemplate,
  createProjectFromTemplate: templates.createProjectFromTemplate,

  // ── Health ────────────────────────────────────
  calculateProjectHealth: health.calculateProjectHealth,
  getProjectBurndown: health.getProjectBurndown,
  getProjectVelocity: health.getProjectVelocity,

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
  },
};

export default projectService;
