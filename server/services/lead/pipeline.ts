/**
 * ===============================================
 * LEAD — PIPELINE MANAGEMENT
 * ===============================================
 * Pipeline stages, kanban view, and pipeline statistics.
 */

import { getDatabase } from '../../database/init.js';
import {
  toPipelineStage,
  toLeadSummary,
  type PipelineStageRow,
  type ProjectRow
} from '../../database/entities/index.js';
import type {
  SqlValue,
  PipelineStage,
  PipelineView,
  PipelineStats
} from './types.js';
import { PIPELINE_STAGE_COLUMNS } from './types.js';

export async function getPipelineStages(): Promise<PipelineStage[]> {
  const db = getDatabase();
  const rows = await db.all(`SELECT ${PIPELINE_STAGE_COLUMNS} FROM pipeline_stages ORDER BY sort_order ASC`);
  return rows.map((row) => toPipelineStage(row as unknown as PipelineStageRow));
}

export async function moveToStage(projectId: number, stageId: number): Promise<void> {
  const db = getDatabase();

  const stage = await db.get(`SELECT ${PIPELINE_STAGE_COLUMNS} FROM pipeline_stages WHERE id = ?`, [stageId]);

  if (!stage) {
    throw new Error('Pipeline stage not found');
  }

  const updates: string[] = ['pipeline_stage_id = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const values: SqlValue[] = [stageId];

  if (stage.is_won) {
    updates.push('won_at = CURRENT_TIMESTAMP');
    if (stage.auto_convert_to_project) {
      updates.push('status = \'in-progress\'');
    }
  } else if (stage.is_lost) {
    updates.push('lost_at = CURRENT_TIMESTAMP');
    updates.push('status = \'on-hold\'');
  }

  values.push(projectId);
  await db.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values);
}

export async function getPipelineView(): Promise<PipelineView> {
  const db = getDatabase();

  const stages = await getPipelineStages();
  const stagesWithLeads: PipelineView['stages'] = [];

  let totalValue = 0;
  let weightedValue = 0;

  for (const stage of stages) {
    const leads = (await db.all(
      `SELECT p.*, c.contact_name, c.company_name
       FROM active_projects p
       LEFT JOIN active_clients c ON p.client_id = c.id
       WHERE p.pipeline_stage_id = ? AND p.status = 'pending'
       ORDER BY p.lead_score DESC`,
      [stage.id]
    )) as unknown as ProjectRow[];

    const leadSummaries = leads.map(toLeadSummary);
    const stageValue = leads.reduce(
      (sum, l) => sum + (l.expected_value ? parseFloat(String(l.expected_value)) : 0),
      0
    );

    totalValue += stageValue;
    weightedValue += stageValue * stage.winProbability;

    stagesWithLeads.push({
      ...stage,
      leads: leadSummaries
    });
  }

  // Also get leads without a stage
  const unstaged = (await db.all(
    `SELECT p.*, c.contact_name, c.company_name
     FROM active_projects p
     LEFT JOIN active_clients c ON p.client_id = c.id
     WHERE p.pipeline_stage_id IS NULL AND p.status = 'pending'
     ORDER BY p.lead_score DESC`
  )) as unknown as ProjectRow[];

  if (unstaged.length > 0) {
    const defaultStage = stages[0];
    if (defaultStage) {
      const existingStage = stagesWithLeads.find((s) => s.id === defaultStage.id);
      if (existingStage) {
        existingStage.leads.push(...unstaged.map(toLeadSummary));
      }
    }
  }

  return { stages: stagesWithLeads, totalValue, weightedValue };
}

export async function getPipelineStats(): Promise<PipelineStats> {
  const db = getDatabase();

  const stats = (await db.get(
    `SELECT
      COUNT(*) as total_leads,
      SUM(COALESCE(expected_value, 0)) as total_value,
      AVG(julianday('now') - julianday(created_at)) as avg_days
     FROM active_projects
     WHERE status = 'pending'`
  )) as { total_leads: number; total_value: number | string; avg_days: number } | undefined;

  const wonCount = (await db.get(
    'SELECT COUNT(*) as count FROM active_projects WHERE won_at IS NOT NULL'
  )) as { count: number } | undefined;

  const lostCount = (await db.get(
    'SELECT COUNT(*) as count FROM active_projects WHERE lost_at IS NOT NULL'
  )) as { count: number } | undefined;

  const totalClosed = (wonCount?.count || 0) + (lostCount?.count || 0);
  const conversionRate = totalClosed > 0 ? (wonCount?.count || 0) / totalClosed : 0;

  const stages = await getPipelineStages();
  const stageBreakdown: PipelineStats['stageBreakdown'] = [];

  for (const stage of stages) {
    const stageStats = (await db.get(
      `SELECT COUNT(*) as count, SUM(COALESCE(expected_value, 0)) as value
       FROM active_projects
       WHERE pipeline_stage_id = ? AND status = 'pending'`,
      [stage.id]
    )) as { count: number; value: number | string } | undefined;

    stageBreakdown.push({
      stageId: stage.id,
      stageName: stage.name,
      count: stageStats?.count || 0,
      value: stageStats?.value ? parseFloat(String(stageStats.value)) : 0
    });
  }

  const totalValue = stats?.total_value ? parseFloat(String(stats.total_value)) : 0;
  const weightedValueCalc = stageBreakdown.reduce((sum, s) => {
    const stage = stages.find((st) => st.id === s.stageId);
    return sum + s.value * (stage?.winProbability || 0);
  }, 0);

  return {
    totalLeads: stats?.total_leads || 0,
    totalValue,
    weightedValue: weightedValueCalc,
    avgDaysInPipeline: stats?.avg_days ? Math.round(stats.avg_days) : 0,
    conversionRate,
    stageBreakdown
  };
}
