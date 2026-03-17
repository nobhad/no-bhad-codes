/**
 * ===============================================
 * LEAD MANAGEMENT SERVICE — BARREL
 * ===============================================
 * Composes sub-modules into the `leadService` singleton.
 *
 * Sub-modules:
 *   lead/types.ts       — Shared types and column constants
 *   lead/scoring.ts     — Scoring rules CRUD, lead score calculation
 *   lead/pipeline.ts    — Pipeline stages, kanban view, stats
 *   lead/tasks.ts       — Lead task CRUD, overdue, upcoming
 *   lead/notes.ts       — Note CRUD, pin/unpin
 *   lead/duplicates.ts  — Duplicate detection and resolution
 *   lead/analytics.ts   — Lead analytics, funnel, source performance
 */

import { getDatabase } from '../database/init.js';
import {
  toLeadSource,
  toLeadSummary,
  type LeadSourceRow,
  type ProjectRow
} from '../database/entities/index.js';
import * as scoring from './lead/scoring.js';
import * as pipeline from './lead/pipeline.js';
import * as tasks from './lead/tasks.js';
import * as notes from './lead/notes.js';
import * as duplicates from './lead/duplicates.js';
import * as analytics from './lead/analytics.js';
import * as core from './lead/core.js';
import { LEAD_SOURCE_COLUMNS } from './lead/types.js';
import type { LeadSource, LeadSummary } from './lead/types.js';

// Re-export all types for consumers
export type {
  ScoringRule,
  ScoringRuleData,
  PipelineStage,
  PipelineView,
  LeadSummary,
  LeadTask,
  TaskData,
  LeadNote,
  LeadSource,
  DuplicateResult,
  LeadScoreResult,
  PipelineStats,
  FunnelData,
  SourceStats,
  LeadAnalytics
} from './lead/types.js';

export type {
  LeadRow,
  LeadStats,
  ContactSubmissionRow,
  ContactSubmissionStats,
  ContactSubmissionFull,
  ExistingClientRow,
  LeadWithClientRow,
  ExistingClientInvitationRow,
  ProjectStatusRow
} from './lead/core.js';

/**
 * Singleton lead service exposing all methods.
 * Route files import `{ leadService }` and call methods directly.
 */
export const leadService = {
  // ── Core CRUD ─────────────────────────────────────
  getLeadsWithClients: core.getLeadsWithClients,
  getLeadStats: core.getLeadStats,
  getContactSubmissions: core.getContactSubmissions,
  getContactSubmissionStats: core.getContactSubmissionStats,
  updateContactSubmissionStatus: core.updateContactSubmissionStatus,
  getContactSubmissionById: core.getContactSubmissionById,
  findClientByEmail: core.findClientByEmail,
  createClientFromContact: core.createClientFromContact,
  markContactAsConverted: core.markContactAsConverted,
  getProjectById: core.getProjectById,
  updateProjectStatus: core.updateProjectStatus,
  getLeadWithClient: core.getLeadWithClient,
  findClientByExactEmail: core.findClientByExactEmail,
  updateClientInvitation: core.updateClientInvitation,
  createClientFromLead: core.createClientFromLead,
  linkProjectToClient: core.linkProjectToClient,
  updateProjectStatusToConverted: core.updateProjectStatusToConverted,
  getProjectForActivation: core.getProjectForActivation,
  activateProject: core.activateProject,

  // ── Scoring ─────────────────────────────────────
  getScoringRules: scoring.getScoringRules,
  createScoringRule: scoring.createScoringRule,
  updateScoringRule: scoring.updateScoringRule,
  deleteScoringRule: scoring.deleteScoringRule,
  calculateLeadScore: scoring.calculateLeadScore,
  updateAllLeadScores: scoring.updateAllLeadScores,

  // ── Pipeline ────────────────────────────────────
  getPipelineStages: pipeline.getPipelineStages,
  moveToStage: pipeline.moveToStage,
  getPipelineView: pipeline.getPipelineView,
  getPipelineStats: pipeline.getPipelineStats,

  // ── Tasks ───────────────────────────────────────
  createTask: tasks.createTask,
  getTasks: tasks.getTasks,
  updateTask: tasks.updateTask,
  completeTask: tasks.completeTask,
  getOverdueTasks: tasks.getOverdueTasks,
  getUpcomingTasks: tasks.getUpcomingTasks,

  // ── Notes ───────────────────────────────────────
  addNote: notes.addNote,
  getNotes: notes.getNotes,
  togglePinNote: notes.togglePinNote,
  deleteNote: notes.deleteNote,

  // ── Duplicates ──────────────────────────────────
  findDuplicates: duplicates.findDuplicates,
  getAllPendingDuplicates: duplicates.getAllPendingDuplicates,
  resolveDuplicate: duplicates.resolveDuplicate,

  // ── Analytics ───────────────────────────────────
  getLeadAnalytics: analytics.getLeadAnalytics,
  getConversionFunnel: analytics.getConversionFunnel,
  getSourcePerformance: analytics.getSourcePerformance,

  // ── Lead Sources (inline — trivially small) ─────
  async getLeadSources(includeInactive: boolean = false, limit = 200): Promise<LeadSource[]> {
    const db = getDatabase();
    let query = `SELECT ${LEAD_SOURCE_COLUMNS} FROM lead_sources`;
    if (!includeInactive) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY name ASC LIMIT ?';
    const rows = (await db.all(query, [limit])) as unknown as LeadSourceRow[];
    return rows.map(toLeadSource);
  },

  async setLeadSource(projectId: number, sourceId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE projects SET lead_source_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [sourceId, projectId]
    );
  },

  // ── Assignment (inline — trivially small) ───────
  async assignLead(projectId: number, assignee: string): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE projects SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [assignee, projectId]
    );
  },

  async getMyLeads(assignee: string, limit = 100): Promise<LeadSummary[]> {
    const db = getDatabase();
    const rows = (await db.all(
      `SELECT p.*, c.contact_name, c.company_name
       FROM active_projects p
       LEFT JOIN active_clients c ON p.client_id = c.id
       WHERE p.assigned_to = ? AND p.status = 'pending'
       ORDER BY p.lead_score DESC
       LIMIT ?`,
      [assignee, limit]
    )) as unknown as ProjectRow[];
    return rows.map(toLeadSummary);
  },

  async getUnassignedLeads(limit = 100): Promise<LeadSummary[]> {
    const db = getDatabase();
    const rows = (await db.all(
      `SELECT p.*, c.contact_name, c.company_name
       FROM active_projects p
       LEFT JOIN active_clients c ON p.client_id = c.id
       WHERE (p.assigned_to IS NULL OR p.assigned_to = '') AND p.status = 'pending'
       ORDER BY p.lead_score DESC
       LIMIT ?`,
      [limit]
    )) as unknown as ProjectRow[];
    return rows.map(toLeadSummary);
  },

  // ── Bulk Operations (inline — trivially small) ──
  async bulkUpdateStatus(projectIds: number[], status: string): Promise<number> {
    const db = getDatabase();
    const placeholders = projectIds.map(() => '?').join(',');
    const result = await db.run(
      `UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      [status, ...projectIds]
    );
    return result.changes || 0;
  },

  async bulkAssign(projectIds: number[], assignee: string): Promise<number> {
    const db = getDatabase();
    const placeholders = projectIds.map(() => '?').join(',');
    const result = await db.run(
      `UPDATE projects SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      [assignee, ...projectIds]
    );
    return result.changes || 0;
  },

  async bulkMoveToStage(projectIds: number[], stageId: number): Promise<number> {
    const db = getDatabase();
    const placeholders = projectIds.map(() => '?').join(',');
    const result = await db.run(
      `UPDATE projects SET pipeline_stage_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      [stageId, ...projectIds]
    );
    return result.changes || 0;
  },

  /**
   * Bulk soft-delete leads (projects) by ID
   */
  async bulkSoftDeleteLeads(leadIds: (number | string)[], deletedBy: string): Promise<number> {
    const db = getDatabase();
    const now = new Date().toISOString();
    let deleted = 0;

    for (const leadId of leadIds) {
      const id = typeof leadId === 'string' ? parseInt(leadId, 10) : leadId;
      if (isNaN(id) || id <= 0) continue;

      const result = await db.run(
        'UPDATE projects SET deleted_at = ?, deleted_by = ? WHERE id = ? AND deleted_at IS NULL',
        [now, deletedBy, id]
      );
      if (result.changes && result.changes > 0) {
        deleted++;
      }
    }

    return deleted;
  }
};

export default leadService;
