/**
 * ===============================================
 * LEAD MANAGEMENT SERVICE
 * ===============================================
 * @file server/services/lead-service.ts
 *
 * Lead scoring, pipeline management, tasks, notes,
 * duplicate detection, and bulk operations.
 */

import { getDatabase } from '../database/init.js';

// Type definitions
type SqlValue = string | number | boolean | null;

// =====================================================
// INTERFACES - Scoring Rules
// =====================================================

export interface ScoringRule {
  id: number;
  name: string;
  description?: string;
  fieldName: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_empty';
  thresholdValue: string;
  points: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScoringRuleData {
  name: string;
  description?: string;
  fieldName: string;
  operator: ScoringRule['operator'];
  thresholdValue: string;
  points: number;
  isActive?: boolean;
}

interface ScoringRuleRow {
  id: number;
  name: string;
  description?: string;
  field_name: string;
  operator: string;
  threshold_value: string;
  points: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// =====================================================
// INTERFACES - Pipeline
// =====================================================

export interface PipelineStage {
  id: number;
  name: string;
  description?: string;
  color: string;
  sortOrder: number;
  winProbability: number;
  isWon: boolean;
  isLost: boolean;
  autoConvertToProject: boolean;
  createdAt: string;
}

interface PipelineStageRow {
  id: number;
  name: string;
  description?: string;
  color: string;
  sort_order: number;
  win_probability: number | string;
  is_won: number;
  is_lost: number;
  auto_convert_to_project: number;
  created_at: string;
}

export interface PipelineView {
  stages: (PipelineStage & { leads: LeadSummary[] })[];
  totalValue: number;
  weightedValue: number;
}

export interface LeadSummary {
  id: number;
  projectName: string;
  clientName?: string;
  companyName?: string;
  budgetRange?: string;
  leadScore: number;
  expectedValue?: number;
  expectedCloseDate?: string;
  assignedTo?: string;
  createdAt: string;
}

// =====================================================
// INTERFACES - Tasks
// =====================================================

export interface LeadTask {
  id: number;
  projectId: number;
  title: string;
  description?: string;
  taskType: 'follow_up' | 'call' | 'email' | 'meeting' | 'proposal' | 'demo' | 'other';
  dueDate?: string;
  dueTime?: string;
  status: 'pending' | 'completed' | 'cancelled' | 'snoozed';
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reminderAt?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskData {
  title: string;
  description?: string;
  taskType?: LeadTask['taskType'];
  dueDate?: string;
  dueTime?: string;
  assignedTo?: string;
  priority?: LeadTask['priority'];
  reminderAt?: string;
}

interface TaskRow {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  task_type: string;
  due_date?: string;
  due_time?: string;
  status: string;
  assigned_to?: string;
  priority: string;
  reminder_at?: string;
  completed_at?: string;
  completed_by?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// INTERFACES - Notes
// =====================================================

export interface LeadNote {
  id: number;
  projectId: number;
  author: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NoteRow {
  id: number;
  project_id: number;
  author: string;
  content: string;
  is_pinned: number;
  created_at: string;
  updated_at: string;
}

// =====================================================
// INTERFACES - Lead Sources
// =====================================================

export interface LeadSource {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

interface LeadSourceRow {
  id: number;
  name: string;
  description?: string;
  is_active: number;
  created_at: string;
}

// =====================================================
// INTERFACES - Duplicates
// =====================================================

export interface DuplicateResult {
  id: number;
  leadId1: number;
  leadId2: number;
  similarityScore: number;
  matchFields: string[];
  status: 'pending' | 'merged' | 'not_duplicate' | 'dismissed';
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  lead1?: LeadSummary;
  lead2?: LeadSummary;
}

interface DuplicateRow {
  id: number;
  lead_id_1: number;
  lead_id_2: number;
  similarity_score: number | string;
  match_fields?: string;
  status: string;
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
}

// =====================================================
// INTERFACES - Analytics
// =====================================================

export interface LeadScoreResult {
  score: number;
  breakdown: { ruleName: string; points: number; matched: boolean }[];
}

export interface PipelineStats {
  totalLeads: number;
  totalValue: number;
  weightedValue: number;
  avgDaysInPipeline: number;
  conversionRate: number;
  stageBreakdown: { stageId: number; stageName: string; count: number; value: number }[];
}

export interface FunnelData {
  stages: { name: string; count: number; value: number; conversionRate: number }[];
  overallConversionRate: number;
}

export interface SourceStats {
  sourceId: number;
  sourceName: string;
  leadCount: number;
  totalValue: number;
  wonCount: number;
  conversionRate: number;
}

export interface LeadAnalytics {
  totalLeads: number;
  newLeadsThisMonth: number;
  conversionRate: number;
  avgLeadScore: number;
  avgDaysToClose: number;
  topSources: SourceStats[];
  scoreDistribution: { range: string; count: number }[];
}

// =====================================================
// INTERFACES - Project/Lead
// =====================================================

interface ProjectRow {
  id: number;
  client_id: number;
  project_name: string;
  description?: string;
  status: string;
  priority: string;
  budget_range?: string;
  project_type?: string;
  lead_score?: number;
  lead_score_breakdown?: string;
  pipeline_stage_id?: number;
  lead_source_id?: number;
  assigned_to?: string;
  expected_value?: number | string;
  expected_close_date?: string;
  lost_reason?: string;
  lost_at?: string;
  won_at?: string;
  competitor?: string;
  last_activity_at?: string;
  next_follow_up_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  contact_name?: string;
  company_name?: string;
  client_email?: string;
  stage_name?: string;
  source_name?: string;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function toScoringRule(row: ScoringRuleRow): ScoringRule {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fieldName: row.field_name,
    operator: row.operator as ScoringRule['operator'],
    thresholdValue: row.threshold_value,
    points: row.points,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toPipelineStage(row: PipelineStageRow): PipelineStage {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    sortOrder: row.sort_order,
    winProbability: parseFloat(String(row.win_probability)),
    isWon: Boolean(row.is_won),
    isLost: Boolean(row.is_lost),
    autoConvertToProject: Boolean(row.auto_convert_to_project),
    createdAt: row.created_at
  };
}

function toTask(row: TaskRow): LeadTask {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    taskType: row.task_type as LeadTask['taskType'],
    dueDate: row.due_date,
    dueTime: row.due_time,
    status: row.status as LeadTask['status'],
    assignedTo: row.assigned_to,
    priority: row.priority as LeadTask['priority'],
    reminderAt: row.reminder_at,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toNote(row: NoteRow): LeadNote {
  return {
    id: row.id,
    projectId: row.project_id,
    author: row.author,
    content: row.content,
    isPinned: Boolean(row.is_pinned),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toLeadSource(row: LeadSourceRow): LeadSource {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at
  };
}

function toLeadSummary(row: ProjectRow): LeadSummary {
  return {
    id: row.id,
    projectName: row.project_name,
    clientName: row.contact_name,
    companyName: row.company_name,
    budgetRange: row.budget_range,
    leadScore: row.lead_score || 0,
    expectedValue: row.expected_value ? parseFloat(String(row.expected_value)) : undefined,
    expectedCloseDate: row.expected_close_date,
    assignedTo: row.assigned_to,
    createdAt: row.created_at
  };
}

function toDuplicateResult(row: DuplicateRow): DuplicateResult {
  return {
    id: row.id,
    leadId1: row.lead_id_1,
    leadId2: row.lead_id_2,
    similarityScore: parseFloat(String(row.similarity_score)),
    matchFields: row.match_fields ? JSON.parse(row.match_fields) : [],
    status: row.status as DuplicateResult['status'],
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    createdAt: row.created_at
  };
}

// =====================================================
// LEAD SERVICE CLASS
// =====================================================

class LeadService {
  // ===================================================
  // LEAD SCORING
  // ===================================================

  /**
   * Get all scoring rules
   */
  async getScoringRules(includeInactive: boolean = false): Promise<ScoringRule[]> {
    const db = getDatabase();
    let query = 'SELECT * FROM lead_scoring_rules';
    if (!includeInactive) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY points DESC';
    const rows = await db.all(query);
    return (rows as unknown as ScoringRuleRow[]).map(toScoringRule);
  }

  /**
   * Create a scoring rule
   */
  async createScoringRule(data: ScoringRuleData): Promise<ScoringRule> {
    const db = getDatabase();
    const result = await db.run(
      `INSERT INTO lead_scoring_rules (name, description, field_name, operator, threshold_value, points, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.description || null,
        data.fieldName,
        data.operator,
        data.thresholdValue,
        data.points,
        data.isActive !== false ? 1 : 0
      ]
    );

    const rule = await db.get(
      'SELECT * FROM lead_scoring_rules WHERE id = ?',
      [result.lastID]
    );

    if (!rule) {
      throw new Error('Failed to create scoring rule');
    }

    return toScoringRule(rule as unknown as ScoringRuleRow);
  }

  /**
   * Update a scoring rule
   */
  async updateScoringRule(ruleId: number, data: Partial<ScoringRuleData>): Promise<ScoringRule> {
    const db = getDatabase();

    const updates: string[] = [];
    const values: SqlValue[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description || null);
    }
    if (data.fieldName !== undefined) {
      updates.push('field_name = ?');
      values.push(data.fieldName);
    }
    if (data.operator !== undefined) {
      updates.push('operator = ?');
      values.push(data.operator);
    }
    if (data.thresholdValue !== undefined) {
      updates.push('threshold_value = ?');
      values.push(data.thresholdValue);
    }
    if (data.points !== undefined) {
      updates.push('points = ?');
      values.push(data.points);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(ruleId);
      await db.run(
        `UPDATE lead_scoring_rules SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    const rule = await db.get(
      'SELECT * FROM lead_scoring_rules WHERE id = ?',
      [ruleId]
    );

    if (!rule) {
      throw new Error('Scoring rule not found');
    }

    return toScoringRule(rule as unknown as ScoringRuleRow);
  }

  /**
   * Delete a scoring rule
   */
  async deleteScoringRule(ruleId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM lead_scoring_rules WHERE id = ?', [ruleId]);
  }

  /**
   * Calculate lead score for a project
   */
  async calculateLeadScore(projectId: number): Promise<LeadScoreResult> {
    const db = getDatabase();

    // Get project data
    const projectRow = await db.get(
      `SELECT p.*, c.contact_name, c.company_name, c.client_type
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );

    if (!projectRow) {
      throw new Error('Project not found');
    }

    const project = projectRow as unknown as ProjectRow & { client_type?: string };

    // Get active scoring rules
    const rules = await this.getScoringRules();

    let totalScore = 0;
    const breakdown: LeadScoreResult['breakdown'] = [];

    for (const rule of rules) {
      let matched = false;
      const fieldValue = this.getFieldValue(project, rule.fieldName);

      switch (rule.operator) {
        case 'equals':
          matched = fieldValue?.toLowerCase() === rule.thresholdValue.toLowerCase();
          break;
        case 'contains':
          matched = fieldValue?.toLowerCase().includes(rule.thresholdValue.toLowerCase()) || false;
          break;
        case 'greater_than':
          matched = parseFloat(fieldValue || '0') > parseFloat(rule.thresholdValue);
          break;
        case 'less_than':
          matched = parseFloat(fieldValue || '0') < parseFloat(rule.thresholdValue);
          break;
        case 'in':
          const values = rule.thresholdValue.split(',').map(v => v.trim().toLowerCase());
          matched = values.includes(fieldValue?.toLowerCase() || '');
          break;
        case 'not_empty':
          matched = !!fieldValue && fieldValue.trim() !== '';
          break;
      }

      if (matched) {
        totalScore += rule.points;
      }

      breakdown.push({
        ruleName: rule.name,
        points: rule.points,
        matched
      });
    }

    // Cap score at 100
    totalScore = Math.min(100, Math.max(0, totalScore));

    // Update project with score
    await db.run(
      `UPDATE projects SET
        lead_score = ?,
        lead_score_breakdown = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [totalScore, JSON.stringify(breakdown), projectId]
    );

    return { score: totalScore, breakdown };
  }

  /**
   * Get field value from project for scoring
   */
  private getFieldValue(project: ProjectRow & { client_type?: string }, fieldName: string): string | undefined {
    const fieldMap: Record<string, string | undefined> = {
      budget_range: project.budget_range,
      project_type: project.project_type,
      description: project.description,
      priority: project.priority,
      client_type: project.client_type,
      timeline: project.expected_close_date
    };
    return fieldMap[fieldName];
  }

  /**
   * Recalculate scores for all leads
   */
  async updateAllLeadScores(): Promise<number> {
    const db = getDatabase();

    // Get all leads (projects in pending status)
    const leads = await db.all(
      `SELECT id FROM projects WHERE status = 'pending'`
    ) as unknown as { id: number }[];

    for (const lead of leads) {
      await this.calculateLeadScore(lead.id);
    }

    return leads.length;
  }

  // ===================================================
  // PIPELINE MANAGEMENT
  // ===================================================

  /**
   * Get all pipeline stages
   */
  async getPipelineStages(): Promise<PipelineStage[]> {
    const db = getDatabase();
    const rows = await db.all(
      'SELECT * FROM pipeline_stages ORDER BY sort_order ASC'
    );
    return rows.map(row => toPipelineStage(row as unknown as PipelineStageRow));
  }

  /**
   * Move lead to a stage
   */
  async moveToStage(projectId: number, stageId: number): Promise<void> {
    const db = getDatabase();

    // Get stage info
    const stage = await db.get(
      'SELECT * FROM pipeline_stages WHERE id = ?',
      [stageId]
    );

    if (!stage) {
      throw new Error('Pipeline stage not found');
    }

    const updates: string[] = ['pipeline_stage_id = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values: SqlValue[] = [stageId];

    // Handle won/lost stages
    if (stage.is_won) {
      updates.push('won_at = CURRENT_TIMESTAMP');
      if (stage.auto_convert_to_project) {
        updates.push("status = 'in-progress'");
      }
    } else if (stage.is_lost) {
      updates.push('lost_at = CURRENT_TIMESTAMP');
      updates.push("status = 'on-hold'");
    }

    values.push(projectId);
    await db.run(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * Get pipeline view (kanban data)
   */
  async getPipelineView(): Promise<PipelineView> {
    const db = getDatabase();

    const stages = await this.getPipelineStages();
    const stagesWithLeads: PipelineView['stages'] = [];

    let totalValue = 0;
    let weightedValue = 0;

    for (const stage of stages) {
      const leads = await db.all(
        `SELECT p.*, c.contact_name, c.company_name
         FROM projects p
         LEFT JOIN clients c ON p.client_id = c.id
         WHERE p.pipeline_stage_id = ? AND p.status = 'pending'
         ORDER BY p.lead_score DESC`,
        [stage.id]
      ) as unknown as ProjectRow[];

      const leadSummaries = leads.map(toLeadSummary);
      const stageValue = leads.reduce((sum, l) =>
        sum + (l.expected_value ? parseFloat(String(l.expected_value)) : 0), 0);

      totalValue += stageValue;
      weightedValue += stageValue * stage.winProbability;

      stagesWithLeads.push({
        ...stage,
        leads: leadSummaries
      });
    }

    // Also get leads without a stage
    const unstaged = await db.all(
      `SELECT p.*, c.contact_name, c.company_name
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.pipeline_stage_id IS NULL AND p.status = 'pending'
       ORDER BY p.lead_score DESC`
    ) as unknown as ProjectRow[];

    if (unstaged.length > 0) {
      const defaultStage = stages[0];
      if (defaultStage) {
        const existingStage = stagesWithLeads.find(s => s.id === defaultStage.id);
        if (existingStage) {
          existingStage.leads.push(...unstaged.map(toLeadSummary));
        }
      }
    }

    return { stages: stagesWithLeads, totalValue, weightedValue };
  }

  /**
   * Get pipeline statistics
   */
  async getPipelineStats(): Promise<PipelineStats> {
    const db = getDatabase();

    const stats = await db.get(
      `SELECT
        COUNT(*) as total_leads,
        SUM(COALESCE(expected_value, 0)) as total_value,
        AVG(julianday('now') - julianday(created_at)) as avg_days
       FROM projects
       WHERE status = 'pending'`
    ) as { total_leads: number; total_value: number | string; avg_days: number } | undefined;

    const wonCount = await db.get(
      `SELECT COUNT(*) as count FROM projects WHERE won_at IS NOT NULL`
    ) as { count: number } | undefined;

    const lostCount = await db.get(
      `SELECT COUNT(*) as count FROM projects WHERE lost_at IS NOT NULL`
    ) as { count: number } | undefined;

    const totalClosed = (wonCount?.count || 0) + (lostCount?.count || 0);
    const conversionRate = totalClosed > 0 ? (wonCount?.count || 0) / totalClosed : 0;

    const stages = await this.getPipelineStages();
    const stageBreakdown: PipelineStats['stageBreakdown'] = [];

    for (const stage of stages) {
      const stageStats = await db.get(
        `SELECT COUNT(*) as count, SUM(COALESCE(expected_value, 0)) as value
         FROM projects
         WHERE pipeline_stage_id = ? AND status = 'pending'`,
        [stage.id]
      ) as { count: number; value: number | string } | undefined;

      stageBreakdown.push({
        stageId: stage.id,
        stageName: stage.name,
        count: stageStats?.count || 0,
        value: stageStats?.value ? parseFloat(String(stageStats.value)) : 0
      });
    }

    const totalValue = stats?.total_value ? parseFloat(String(stats.total_value)) : 0;
    const weightedValue = stageBreakdown.reduce((sum, s) => {
      const stage = stages.find(st => st.id === s.stageId);
      return sum + (s.value * (stage?.winProbability || 0));
    }, 0);

    return {
      totalLeads: stats?.total_leads || 0,
      totalValue,
      weightedValue,
      avgDaysInPipeline: stats?.avg_days ? Math.round(stats.avg_days) : 0,
      conversionRate,
      stageBreakdown
    };
  }

  // ===================================================
  // TASK MANAGEMENT
  // ===================================================

  /**
   * Create a task for a lead
   */
  async createTask(projectId: number, data: TaskData): Promise<LeadTask> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO lead_tasks (
        project_id, title, description, task_type, due_date, due_time,
        assigned_to, priority, reminder_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        data.title,
        data.description || null,
        data.taskType || 'follow_up',
        data.dueDate || null,
        data.dueTime || null,
        data.assignedTo || null,
        data.priority || 'medium',
        data.reminderAt || null
      ]
    );

    // Update project's next follow-up date
    if (data.dueDate) {
      await db.run(
        `UPDATE projects SET next_follow_up_at = ? WHERE id = ? AND (next_follow_up_at IS NULL OR next_follow_up_at > ?)`,
        [data.dueDate, projectId, data.dueDate]
      );
    }

    const task = await db.get(
      'SELECT * FROM lead_tasks WHERE id = ?',
      [result.lastID]
    );

    if (!task) {
      throw new Error('Failed to create task');
    }

    return toTask(task as unknown as TaskRow);
  }

  /**
   * Get tasks for a lead
   */
  async getTasks(projectId: number): Promise<LeadTask[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT * FROM lead_tasks
       WHERE project_id = ?
       ORDER BY
         CASE status WHEN 'pending' THEN 0 WHEN 'snoozed' THEN 1 ELSE 2 END,
         due_date ASC NULLS LAST`,
      [projectId]
    ) as unknown as TaskRow[];
    return rows.map(toTask);
  }

  /**
   * Update a task
   */
  async updateTask(taskId: number, data: Partial<TaskData> & { status?: LeadTask['status'] }): Promise<LeadTask> {
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
      updates.push('assigned_to = ?');
      values.push(data.assignedTo || null);
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
      await db.run(
        `UPDATE lead_tasks SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    const task = await db.get(
      'SELECT * FROM lead_tasks WHERE id = ?',
      [taskId]
    );

    if (!task) {
      throw new Error('Task not found');
    }

    return toTask(task as unknown as TaskRow);
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: number, completedBy?: string): Promise<LeadTask> {
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

    const task = await db.get(
      'SELECT * FROM lead_tasks WHERE id = ?',
      [taskId]
    ) as unknown as TaskRow | undefined;

    if (!task) {
      throw new Error('Task not found');
    }

    // Update project's last activity
    await db.run(
      'UPDATE projects SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?',
      [task.project_id]
    );

    return toTask(task);
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(): Promise<(LeadTask & { projectName: string })[]> {
    const db = getDatabase();

    const rows = await db.all(
      `SELECT t.*, p.project_name
       FROM lead_tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.status = 'pending'
         AND t.due_date < DATE('now')
       ORDER BY t.due_date ASC`
    ) as unknown as (TaskRow & { project_name: string })[];

    return rows.map(row => ({
      ...toTask(row),
      projectName: row.project_name
    }));
  }

  /**
   * Get upcoming tasks
   */
  async getUpcomingTasks(days: number = 7): Promise<(LeadTask & { projectName: string })[]> {
    const db = getDatabase();

    const rows = await db.all(
      `SELECT t.*, p.project_name
       FROM lead_tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.status = 'pending'
         AND t.due_date >= DATE('now')
         AND t.due_date <= DATE('now', '+' || ? || ' days')
       ORDER BY t.due_date ASC`,
      [days]
    ) as unknown as (TaskRow & { project_name: string })[];

    return rows.map(row => ({
      ...toTask(row),
      projectName: row.project_name
    }));
  }

  // ===================================================
  // NOTES
  // ===================================================

  /**
   * Add a note to a lead
   */
  async addNote(projectId: number, author: string, content: string): Promise<LeadNote> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO lead_notes (project_id, author, content) VALUES (?, ?, ?)`,
      [projectId, author, content]
    );

    // Update project's last activity
    await db.run(
      'UPDATE projects SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?',
      [projectId]
    );

    const note = await db.get(
      'SELECT * FROM lead_notes WHERE id = ?',
      [result.lastID]
    );

    if (!note) {
      throw new Error('Failed to create note');
    }

    return toNote(note as unknown as NoteRow);
  }

  /**
   * Get notes for a lead
   */
  async getNotes(projectId: number): Promise<LeadNote[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT * FROM lead_notes
       WHERE project_id = ?
       ORDER BY is_pinned DESC, created_at DESC`,
      [projectId]
    ) as unknown as NoteRow[];
    return rows.map(toNote);
  }

  /**
   * Pin/unpin a note
   */
  async togglePinNote(noteId: number): Promise<LeadNote> {
    const db = getDatabase();

    await db.run(
      `UPDATE lead_notes SET
        is_pinned = NOT is_pinned,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [noteId]
    );

    const note = await db.get(
      'SELECT * FROM lead_notes WHERE id = ?',
      [noteId]
    ) as unknown as NoteRow | undefined;

    if (!note) {
      throw new Error('Note not found');
    }

    return toNote(note);
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM lead_notes WHERE id = ?', [noteId]);
  }

  // ===================================================
  // LEAD SOURCES
  // ===================================================

  /**
   * Get all lead sources
   */
  async getLeadSources(includeInactive: boolean = false): Promise<LeadSource[]> {
    const db = getDatabase();
    let query = 'SELECT * FROM lead_sources';
    if (!includeInactive) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY name ASC';
    const rows = await db.all(query) as unknown as LeadSourceRow[];
    return rows.map(toLeadSource);
  }

  /**
   * Set lead source for a project
   */
  async setLeadSource(projectId: number, sourceId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE projects SET lead_source_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [sourceId, projectId]
    );
  }

  // ===================================================
  // ASSIGNMENT
  // ===================================================

  /**
   * Assign a lead to someone
   */
  async assignLead(projectId: number, assignee: string): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE projects SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [assignee, projectId]
    );
  }

  /**
   * Get leads assigned to someone
   */
  async getMyLeads(assignee: string): Promise<LeadSummary[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT p.*, c.contact_name, c.company_name
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.assigned_to = ? AND p.status = 'pending'
       ORDER BY p.lead_score DESC`,
      [assignee]
    ) as unknown as ProjectRow[];
    return rows.map(toLeadSummary);
  }

  /**
   * Get unassigned leads
   */
  async getUnassignedLeads(): Promise<LeadSummary[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT p.*, c.contact_name, c.company_name
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE (p.assigned_to IS NULL OR p.assigned_to = '') AND p.status = 'pending'
       ORDER BY p.lead_score DESC`
    ) as unknown as ProjectRow[];
    return rows.map(toLeadSummary);
  }

  // ===================================================
  // DUPLICATE DETECTION
  // ===================================================

  /**
   * Find potential duplicates for a lead
   */
  async findDuplicates(projectId: number): Promise<DuplicateResult[]> {
    const db = getDatabase();

    type LeadMatchRow = ProjectRow & {
      contact_name?: string;
      company_name?: string;
      client_email?: string;
      email?: string;
    };

    // Get the lead
    const lead = await db.get(
      `SELECT p.*, c.contact_name, c.company_name, c.email
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    ) as unknown as LeadMatchRow | undefined;

    if (!lead) {
      throw new Error('Lead not found');
    }

    // Find potential matches
    const potentialMatches = await db.all(
      `SELECT p.*, c.contact_name, c.company_name, c.email as client_email
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id != ? AND p.status = 'pending'`,
      [projectId]
    ) as unknown as LeadMatchRow[];

    const duplicates: DuplicateResult[] = [];

    for (const match of potentialMatches) {
      const matchFields: string[] = [];
      let score = 0;

      // Check email match (high weight)
      if (lead.client_email && match.client_email &&
          lead.client_email.toLowerCase() === match.client_email.toLowerCase()) {
        matchFields.push('email');
        score += 0.5;
      }

      // Check company name similarity
      if (lead.company_name && match.company_name) {
        const similarity = this.stringSimilarity(
          lead.company_name.toLowerCase(),
          match.company_name.toLowerCase()
        );
        if (similarity > 0.8) {
          matchFields.push('company_name');
          score += 0.3;
        }
      }

      // Check contact name similarity
      if (lead.contact_name && match.contact_name) {
        const similarity = this.stringSimilarity(
          lead.contact_name.toLowerCase(),
          match.contact_name.toLowerCase()
        );
        if (similarity > 0.8) {
          matchFields.push('contact_name');
          score += 0.2;
        }
      }

      // Only report if score is significant
      if (score >= 0.5) {
        // Check if already tracked
        const existing = await db.get(
          `SELECT * FROM lead_duplicates
           WHERE (lead_id_1 = ? AND lead_id_2 = ?) OR (lead_id_1 = ? AND lead_id_2 = ?)`,
          [projectId, match.id, match.id, projectId]
        );

        if (!existing) {
          // Create new duplicate record
          const result = await db.run(
            `INSERT INTO lead_duplicates (lead_id_1, lead_id_2, similarity_score, match_fields)
             VALUES (?, ?, ?, ?)`,
            [projectId, match.id, score, JSON.stringify(matchFields)]
          );

          duplicates.push({
            id: result.lastID as number,
            leadId1: projectId,
            leadId2: match.id,
            similarityScore: score,
            matchFields,
            status: 'pending',
            createdAt: new Date().toISOString(),
            lead2: toLeadSummary(match as unknown as ProjectRow)
          });
        } else if ((existing as { status: string }).status === 'pending') {
          duplicates.push({
            ...toDuplicateResult(existing as unknown as DuplicateRow),
            lead2: toLeadSummary(match as unknown as ProjectRow)
          });
        }
      }
    }

    return duplicates;
  }

  /**
   * Simple string similarity using Levenshtein distance
   */
  private stringSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) {
        costs[s2.length] = lastValue;
      }
    }
    return costs[s2.length];
  }

  /**
   * Get all pending duplicates
   */
  async getAllPendingDuplicates(): Promise<DuplicateResult[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT * FROM lead_duplicates WHERE status = 'pending' ORDER BY similarity_score DESC`
    ) as unknown as DuplicateRow[];
    return rows.map(toDuplicateResult);
  }

  /**
   * Mark duplicate as resolved
   */
  async resolveDuplicate(
    duplicateId: number,
    status: 'merged' | 'not_duplicate' | 'dismissed',
    resolvedBy: string
  ): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE lead_duplicates SET
        status = ?,
        resolved_at = CURRENT_TIMESTAMP,
        resolved_by = ?
       WHERE id = ?`,
      [status, resolvedBy, duplicateId]
    );
  }

  // ===================================================
  // BULK OPERATIONS
  // ===================================================

  /**
   * Bulk update status
   */
  async bulkUpdateStatus(projectIds: number[], status: string): Promise<number> {
    const db = getDatabase();
    const placeholders = projectIds.map(() => '?').join(',');
    const result = await db.run(
      `UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      [status, ...projectIds]
    );
    return result.changes || 0;
  }

  /**
   * Bulk assign
   */
  async bulkAssign(projectIds: number[], assignee: string): Promise<number> {
    const db = getDatabase();
    const placeholders = projectIds.map(() => '?').join(',');
    const result = await db.run(
      `UPDATE projects SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      [assignee, ...projectIds]
    );
    return result.changes || 0;
  }

  /**
   * Bulk move to stage
   */
  async bulkMoveToStage(projectIds: number[], stageId: number): Promise<number> {
    const db = getDatabase();
    const placeholders = projectIds.map(() => '?').join(',');
    const result = await db.run(
      `UPDATE projects SET pipeline_stage_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      [stageId, ...projectIds]
    );
    return result.changes || 0;
  }

  // ===================================================
  // ANALYTICS
  // ===================================================

  /**
   * Get lead analytics
   */
  async getLeadAnalytics(): Promise<LeadAnalytics> {
    const db = getDatabase();

    // Total leads
    const totalLeads = await db.get(
      `SELECT COUNT(*) as count FROM projects WHERE status = 'pending'`
    ) as { count: number } | undefined;

    // New leads this month
    const newLeadsThisMonth = await db.get(
      `SELECT COUNT(*) as count FROM projects
       WHERE status = 'pending' AND created_at >= DATE('now', 'start of month')`
    ) as { count: number } | undefined;

    // Conversion rate
    const wonCount = await db.get(
      `SELECT COUNT(*) as count FROM projects WHERE won_at IS NOT NULL`
    ) as { count: number } | undefined;
    const lostCount = await db.get(
      `SELECT COUNT(*) as count FROM projects WHERE lost_at IS NOT NULL`
    ) as { count: number } | undefined;
    const totalClosed = (wonCount?.count || 0) + (lostCount?.count || 0);
    const conversionRate = totalClosed > 0 ? (wonCount?.count || 0) / totalClosed : 0;

    // Average lead score
    const avgScore = await db.get(
      `SELECT AVG(lead_score) as avg FROM projects WHERE status = 'pending'`
    ) as { avg: number | null } | undefined;

    // Average days to close
    const avgDays = await db.get(
      `SELECT AVG(julianday(won_at) - julianday(created_at)) as avg
       FROM projects WHERE won_at IS NOT NULL`
    ) as { avg: number | null } | undefined;

    // Top sources
    type SourceStatsRow = {
      source_id: number;
      source_name: string;
      lead_count: number;
      total_value: number | string;
      won_count: number;
    };
    const topSources = await db.all(
      `SELECT
        ls.id as source_id,
        ls.name as source_name,
        COUNT(p.id) as lead_count,
        SUM(COALESCE(p.expected_value, 0)) as total_value,
        SUM(CASE WHEN p.won_at IS NOT NULL THEN 1 ELSE 0 END) as won_count
       FROM lead_sources ls
       LEFT JOIN projects p ON p.lead_source_id = ls.id
       GROUP BY ls.id
       ORDER BY lead_count DESC
       LIMIT 5`
    ) as unknown as SourceStatsRow[];

    // Score distribution
    const scoreDistribution = await db.all(
      `SELECT
        CASE
          WHEN lead_score >= 80 THEN '80-100'
          WHEN lead_score >= 60 THEN '60-79'
          WHEN lead_score >= 40 THEN '40-59'
          WHEN lead_score >= 20 THEN '20-39'
          ELSE '0-19'
        END as range,
        COUNT(*) as count
       FROM projects
       WHERE status = 'pending'
       GROUP BY range
       ORDER BY range DESC`
    ) as unknown as Array<{ range: string; count: number }>;

    return {
      totalLeads: totalLeads?.count || 0,
      newLeadsThisMonth: newLeadsThisMonth?.count || 0,
      conversionRate,
      avgLeadScore: avgScore?.avg ? Math.round(avgScore.avg) : 0,
      avgDaysToClose: avgDays?.avg ? Math.round(avgDays.avg) : 0,
      topSources: topSources.map(s => ({
        sourceId: s.source_id,
        sourceName: s.source_name,
        leadCount: s.lead_count,
        totalValue: parseFloat(String(s.total_value)) || 0,
        wonCount: s.won_count,
        conversionRate: s.lead_count > 0 ? s.won_count / s.lead_count : 0
      })),
      scoreDistribution
    };
  }

  /**
   * Get conversion funnel
   */
  async getConversionFunnel(): Promise<FunnelData> {
    const db = getDatabase();

    const stages = await this.getPipelineStages();
    const funnelStages: FunnelData['stages'] = [];

    let previousCount = 0;

    for (const stage of stages) {
      const stats = await db.get(
        `SELECT COUNT(*) as count, SUM(COALESCE(expected_value, 0)) as value
         FROM projects
         WHERE pipeline_stage_id = ?`,
        [stage.id]
      ) as { count: number; value: number | string | null } | undefined;

      const count = stats?.count || 0;
      const conversionRate = previousCount > 0 ? count / previousCount : 1;

      funnelStages.push({
        name: stage.name,
        count,
        value: parseFloat(String(stats?.value)) || 0,
        conversionRate
      });

      if (count > 0) {
        previousCount = count;
      }
    }

    // Calculate overall conversion rate (first stage to won)
    const firstStageCount = funnelStages[0]?.count || 0;
    const wonStage = funnelStages.find(s => s.name === 'Won');
    const overallConversionRate = firstStageCount > 0 && wonStage
      ? wonStage.count / firstStageCount
      : 0;

    return { stages: funnelStages, overallConversionRate };
  }

  /**
   * Get source performance
   */
  async getSourcePerformance(): Promise<SourceStats[]> {
    const db = getDatabase();

    type SourcePerfRow = {
      source_id: number;
      source_name: string;
      lead_count: number;
      total_value: number | string;
      won_count: number;
    };

    const stats = await db.all(
      `SELECT
        ls.id as source_id,
        ls.name as source_name,
        COUNT(p.id) as lead_count,
        SUM(COALESCE(p.expected_value, 0)) as total_value,
        SUM(CASE WHEN p.won_at IS NOT NULL THEN 1 ELSE 0 END) as won_count
       FROM lead_sources ls
       LEFT JOIN projects p ON p.lead_source_id = ls.id
       GROUP BY ls.id
       ORDER BY lead_count DESC`
    ) as unknown as SourcePerfRow[];

    return stats.map(s => ({
      sourceId: s.source_id,
      sourceName: s.source_name,
      leadCount: s.lead_count,
      totalValue: parseFloat(String(s.total_value)) || 0,
      wonCount: s.won_count,
      conversionRate: s.lead_count > 0 ? s.won_count / s.lead_count : 0
    }));
  }
}

// Export singleton instance
export const leadService = new LeadService();
export default leadService;
