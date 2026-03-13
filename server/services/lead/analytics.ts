/**
 * ===============================================
 * LEAD — ANALYTICS
 * ===============================================
 * Lead analytics, conversion funnel, and source performance.
 */

import { getDatabase } from '../../database/init.js';
import { getPipelineStages } from './pipeline.js';
import type {
  LeadAnalytics,
  FunnelData,
  SourceStats,
} from './types.js';

export async function getLeadAnalytics(): Promise<LeadAnalytics> {
  const db = getDatabase();

  const totalLeads = (await db.get(
    'SELECT COUNT(*) as count FROM active_projects WHERE status = \'pending\''
  )) as { count: number } | undefined;

  const newLeadsThisMonth = (await db.get(
    `SELECT COUNT(*) as count FROM active_projects
     WHERE status = 'pending' AND created_at >= DATE('now', 'start of month')`
  )) as { count: number } | undefined;

  const wonCount = (await db.get(
    'SELECT COUNT(*) as count FROM active_projects WHERE won_at IS NOT NULL'
  )) as { count: number } | undefined;
  const lostCount = (await db.get(
    'SELECT COUNT(*) as count FROM active_projects WHERE lost_at IS NOT NULL'
  )) as { count: number } | undefined;
  const totalClosed = (wonCount?.count || 0) + (lostCount?.count || 0);
  const conversionRate = totalClosed > 0 ? (wonCount?.count || 0) / totalClosed : 0;

  const avgScore = (await db.get(
    'SELECT AVG(lead_score) as avg FROM active_projects WHERE status = \'pending\''
  )) as { avg: number | null } | undefined;

  const avgDays = (await db.get(
    `SELECT AVG(julianday(won_at) - julianday(created_at)) as avg
     FROM active_projects WHERE won_at IS NOT NULL`
  )) as { avg: number | null } | undefined;

  type SourceStatsRow = {
    source_id: number;
    source_name: string;
    lead_count: number;
    total_value: number | string;
    won_count: number;
  };
  const topSources = (await db.all(
    `SELECT
      ls.id as source_id,
      ls.name as source_name,
      COUNT(p.id) as lead_count,
      SUM(COALESCE(p.expected_value, 0)) as total_value,
      SUM(CASE WHEN p.won_at IS NOT NULL THEN 1 ELSE 0 END) as won_count
     FROM lead_sources ls
     LEFT JOIN active_projects p ON p.lead_source_id = ls.id
     GROUP BY ls.id
     ORDER BY lead_count DESC
     LIMIT 5`
  )) as unknown as SourceStatsRow[];

  const scoreDistribution = (await db.all(
    `SELECT
      CASE
        WHEN lead_score >= 80 THEN '80-100'
        WHEN lead_score >= 60 THEN '60-79'
        WHEN lead_score >= 40 THEN '40-59'
        WHEN lead_score >= 20 THEN '20-39'
        ELSE '0-19'
      END as range,
      COUNT(*) as count
     FROM active_projects
     WHERE status = 'pending'
     GROUP BY range
     ORDER BY range DESC`
  )) as unknown as Array<{ range: string; count: number }>;

  return {
    totalLeads: totalLeads?.count || 0,
    newLeadsThisMonth: newLeadsThisMonth?.count || 0,
    conversionRate,
    avgLeadScore: avgScore?.avg ? Math.round(avgScore.avg) : 0,
    avgDaysToClose: avgDays?.avg ? Math.round(avgDays.avg) : 0,
    topSources: topSources.map((s) => ({
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

export async function getConversionFunnel(): Promise<FunnelData> {
  const db = getDatabase();

  const stages = await getPipelineStages();
  const funnelStages: FunnelData['stages'] = [];

  let previousCount = 0;

  for (const stage of stages) {
    const stats = (await db.get(
      `SELECT COUNT(*) as count, SUM(COALESCE(expected_value, 0)) as value
       FROM active_projects
       WHERE pipeline_stage_id = ?`,
      [stage.id]
    )) as { count: number; value: number | string | null } | undefined;

    const count = stats?.count || 0;
    const stageConversionRate = previousCount > 0 ? count / previousCount : 1;

    funnelStages.push({
      name: stage.name,
      count,
      value: parseFloat(String(stats?.value)) || 0,
      conversionRate: stageConversionRate
    });

    if (count > 0) {
      previousCount = count;
    }
  }

  const firstStageCount = funnelStages[0]?.count || 0;
  const wonStage = funnelStages.find((s) => s.name === 'Won');
  const overallConversionRate =
    firstStageCount > 0 && wonStage ? wonStage.count / firstStageCount : 0;

  return { stages: funnelStages, overallConversionRate };
}

export async function getSourcePerformance(): Promise<SourceStats[]> {
  const db = getDatabase();

  type SourcePerfRow = {
    source_id: number;
    source_name: string;
    lead_count: number;
    total_value: number | string;
    won_count: number;
  };

  const stats = (await db.all(
    `SELECT
      ls.id as source_id,
      ls.name as source_name,
      COUNT(p.id) as lead_count,
      SUM(COALESCE(p.expected_value, 0)) as total_value,
      SUM(CASE WHEN p.won_at IS NOT NULL THEN 1 ELSE 0 END) as won_count
     FROM lead_sources ls
     LEFT JOIN active_projects p ON p.lead_source_id = ls.id
     GROUP BY ls.id
     ORDER BY lead_count DESC`
  )) as unknown as SourcePerfRow[];

  return stats.map((s) => ({
    sourceId: s.source_id,
    sourceName: s.source_name,
    leadCount: s.lead_count,
    totalValue: parseFloat(String(s.total_value)) || 0,
    wonCount: s.won_count,
    conversionRate: s.lead_count > 0 ? s.won_count / s.lead_count : 0
  }));
}
