/**
 * ===============================================
 * LEAD — SCORING
 * ===============================================
 * Scoring rules CRUD and lead score calculation.
 */

import { getDatabase } from '../../database/init.js';
import {
  toScoringRule,
  type ScoringRuleRow,
  type ProjectRow
} from '../../database/entities/index.js';
import type {
  SqlValue,
  ScoringRule,
  ScoringRuleData,
  LeadScoreResult
} from './types.js';
import { SCORING_RULE_COLUMNS } from './types.js';

export async function getScoringRules(includeInactive: boolean = false): Promise<ScoringRule[]> {
  const db = getDatabase();
  let query = `SELECT ${SCORING_RULE_COLUMNS} FROM lead_scoring_rules`;
  if (!includeInactive) {
    query += ' WHERE is_active = 1';
  }
  query += ' ORDER BY points DESC';
  const rows = await db.all(query);
  return (rows as unknown as ScoringRuleRow[]).map(toScoringRule);
}

export async function createScoringRule(data: ScoringRuleData): Promise<ScoringRule> {
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

  const rule = await db.get(`SELECT ${SCORING_RULE_COLUMNS} FROM lead_scoring_rules WHERE id = ?`, [result.lastID]);

  if (!rule) {
    throw new Error('Failed to create scoring rule');
  }

  return toScoringRule(rule as unknown as ScoringRuleRow);
}

export async function updateScoringRule(ruleId: number, data: Partial<ScoringRuleData>): Promise<ScoringRule> {
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
    await db.run(`UPDATE lead_scoring_rules SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  const rule = await db.get(`SELECT ${SCORING_RULE_COLUMNS} FROM lead_scoring_rules WHERE id = ?`, [ruleId]);

  if (!rule) {
    throw new Error('Scoring rule not found');
  }

  return toScoringRule(rule as unknown as ScoringRuleRow);
}

export async function deleteScoringRule(ruleId: number): Promise<void> {
  const db = getDatabase();
  await db.run('DELETE FROM lead_scoring_rules WHERE id = ?', [ruleId]);
}

/**
 * Extended project row type for scoring — includes intake fields
 * available via SELECT p.* even if not on the base ProjectRow interface
 */
interface ScoringProjectRow extends ProjectRow {
  client_type?: string;
  design_level?: string;
  features?: string;
  notes?: string;
  referral_source?: string;
}

/**
 * Get field value from project for scoring
 */
function getFieldValue(
  project: ScoringProjectRow,
  fieldName: string
): string | undefined {
  const fieldMap: Record<string, string | undefined> = {
    budget_range: project.budget_range,
    project_type: project.project_type,
    description: project.description,
    priority: project.priority,
    client_type: project.client_type,
    timeline: project.expected_close_date,
    design_level: project.design_level,
    source_type: project.referral_source,
    feature_count: countFeatures(project.features, project.notes)
  };
  return fieldMap[fieldName];
}

/**
 * Count features from the features field or notes to produce a numeric string
 */
function countFeatures(features?: string, notes?: string): string {
  if (features) {
    // Features stored as comma-separated or JSON array
    try {
      const parsed = JSON.parse(features);
      if (Array.isArray(parsed)) return String(parsed.length);
    } catch {
      // Comma-separated fallback
      return String(features.split(',').filter((f) => f.trim()).length);
    }
  }
  if (notes) {
    // Look for "Features:" section in notes
    const featuresMatch = notes.match(/Features:\s*([\s\S]*?)(?:\n\n|$)/i);
    if (featuresMatch) {
      const lines = featuresMatch[1].split('\n').filter((l) => l.trim());
      return String(lines.length);
    }
  }
  return '0';
}

export async function calculateLeadScore(projectId: number): Promise<LeadScoreResult> {
  const db = getDatabase();

  const projectRow = await db.get(
    `SELECT p.*, c.contact_name, c.company_name, c.client_type
     FROM active_projects p
     LEFT JOIN active_clients c ON p.client_id = c.id
     WHERE p.id = ?`,
    [projectId]
  );

  if (!projectRow) {
    throw new Error('Project not found');
  }

  const project = projectRow as unknown as ScoringProjectRow;

  const rules = await getScoringRules();

  let totalScore = 0;
  const breakdown: LeadScoreResult['breakdown'] = [];

  for (const rule of rules) {
    let matched = false;
    const fieldValue = getFieldValue(project, rule.fieldName);

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
    case 'in': {
      const values = rule.thresholdValue.split(',').map((v) => v.trim().toLowerCase());
      matched = values.includes(fieldValue?.toLowerCase() || '');
      break;
    }
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

export async function updateAllLeadScores(): Promise<number> {
  const db = getDatabase();

  const leads = (await db.all('SELECT id FROM active_projects WHERE status = \'pending\'')) as unknown as {
    id: number;
  }[];

  for (const lead of leads) {
    await calculateLeadScore(lead.id);
  }

  return leads.length;
}
