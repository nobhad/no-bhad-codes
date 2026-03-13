/**
 * ===============================================
 * LEAD — SHARED TYPES & CONSTANTS
 * ===============================================
 * Interfaces, column constants, and type aliases
 * used across all lead sub-modules.
 */

import type { SqlParam } from '../../database/init.js';

// Type alias for backward compatibility
export type SqlValue = SqlParam;

// =====================================================
// Column Constants
// =====================================================

export const SCORING_RULE_COLUMNS = `
  id, name, description, field_name, operator, threshold_value, points, is_active, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

export const PIPELINE_STAGE_COLUMNS = `
  id, name, description, color, sort_order, win_probability, is_won, is_lost, auto_convert_to_project, created_at
`.replace(/\s+/g, ' ').trim();

export const LEAD_SOURCE_COLUMNS = `
  id, name, description, is_active, created_at
`.replace(/\s+/g, ' ').trim();

export const LEAD_DUPLICATE_COLUMNS = `
  id, lead_id_1, lead_id_2, similarity_score, match_fields, status, resolved_at, resolved_by, created_at
`.replace(/\s+/g, ' ').trim();

// =====================================================
// Scoring Rules
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

// =====================================================
// Pipeline
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
// Tasks
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

// =====================================================
// Notes
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

// =====================================================
// Lead Sources
// =====================================================

export interface LeadSource {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

// =====================================================
// Duplicates
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

// =====================================================
// Analytics
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
