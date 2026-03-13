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
  type ProjectRow,
} from '../database/entities/index.js';
import * as scoring from './lead/scoring.js';
import * as pipeline from './lead/pipeline.js';
import * as tasks from './lead/tasks.js';
import * as notes from './lead/notes.js';
import * as duplicates from './lead/duplicates.js';
import * as analytics from './lead/analytics.js';
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
  LeadAnalytics,
} from './lead/types.js';

/**
 * Singleton lead service exposing all methods.
 * Route files import `{ leadService }` and call methods directly.
 */
export const leadService = {
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
  async getLeadSources(includeInactive: boolean = false): Promise<LeadSource[]> {
    const db = getDatabase();
    let query = `SELECT ${LEAD_SOURCE_COLUMNS} FROM lead_sources`;
    if (!includeInactive) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY name ASC';
    const rows = (await db.all(query)) as unknown as LeadSourceRow[];
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

  async getMyLeads(assignee: string): Promise<LeadSummary[]> {
    const db = getDatabase();
    const rows = (await db.all(
      `SELECT p.*, c.contact_name, c.company_name
       FROM active_projects p
       LEFT JOIN active_clients c ON p.client_id = c.id
       WHERE p.assigned_to = ? AND p.status = 'pending'
       ORDER BY p.lead_score DESC`,
      [assignee]
    )) as unknown as ProjectRow[];
    return rows.map(toLeadSummary);
  },

  async getUnassignedLeads(): Promise<LeadSummary[]> {
    const db = getDatabase();
    const rows = (await db.all(
      `SELECT p.*, c.contact_name, c.company_name
       FROM active_projects p
       LEFT JOIN active_clients c ON p.client_id = c.id
       WHERE (p.assigned_to IS NULL OR p.assigned_to = '') AND p.status = 'pending'
       ORDER BY p.lead_score DESC`
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
};

export default leadService;
