/**
 * ===============================================
 * LEAD ENTITY SCHEMAS
 * ===============================================
 * @file server/database/entities/lead.ts
 *
 * Entity schemas and mappers for lead/pipeline-related data types.
 */

import { defineSchema, definePartialSchema, createMapper } from '../entity-mapper.js';
import type { DatabaseRow } from '../init.js';
import type {
  ScoringRule,
  PipelineStage,
  LeadTask,
  LeadNote,
  LeadSource,
  LeadSummary,
  DuplicateResult
} from '../../services/lead-service.js';

// =====================================================
// ROW TYPE DEFINITIONS
// =====================================================

export interface ScoringRuleRow extends DatabaseRow {
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

export interface PipelineStageRow extends DatabaseRow {
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

export interface LeadTaskRow extends DatabaseRow {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  task_type: string;
  due_date?: string;
  due_time?: string;
  status: string;
  assigned_to_user_id?: number;
  assigned_to_name?: string;
  priority: string;
  reminder_at?: string;
  completed_at?: string;
  completed_by?: string;
  created_at: string;
  updated_at: string;
}

export interface LeadNoteRow extends DatabaseRow {
  id: number;
  project_id: number;
  author_user_id: number | null;
  author_name: string | null;
  content: string;
  is_pinned: number;
  created_at: string;
  updated_at: string;
}

export interface LeadSourceRow extends DatabaseRow {
  id: number;
  name: string;
  description?: string;
  is_active: number;
  created_at: string;
}

export interface ProjectRow extends DatabaseRow {
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

export interface DuplicateRow extends DatabaseRow {
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
// ENTITY SCHEMAS
// =====================================================

export const scoringRuleSchema = defineSchema<ScoringRule>({
  id: 'number',
  name: 'string',
  description: 'string?',
  fieldName: { column: 'field_name', type: 'string' },
  operator: {
    column: 'operator',
    type: 'string',
    transform: (v) => v as ScoringRule['operator']
  },
  thresholdValue: { column: 'threshold_value', type: 'string' },
  points: 'number',
  isActive: { column: 'is_active', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

export const pipelineStageSchema = defineSchema<PipelineStage>({
  id: 'number',
  name: 'string',
  description: 'string?',
  color: 'string',
  sortOrder: { column: 'sort_order', type: 'number' },
  winProbability: { column: 'win_probability', type: 'float' },
  isWon: { column: 'is_won', type: 'boolean' },
  isLost: { column: 'is_lost', type: 'boolean' },
  autoConvertToProject: { column: 'auto_convert_to_project', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'string' }
});

export const leadTaskSchema = defineSchema<LeadTask>({
  id: 'number',
  projectId: { column: 'project_id', type: 'number' },
  title: 'string',
  description: 'string?',
  taskType: {
    column: 'task_type',
    type: 'string',
    transform: (v) => v as LeadTask['taskType']
  },
  dueDate: { column: 'due_date', type: 'string?' },
  dueTime: { column: 'due_time', type: 'string?' },
  status: {
    column: 'status',
    type: 'string',
    transform: (v) => v as LeadTask['status']
  },
  assignedTo: { column: 'assigned_to_name', type: 'string?' },
  priority: {
    column: 'priority',
    type: 'string',
    transform: (v) => v as LeadTask['priority']
  },
  reminderAt: { column: 'reminder_at', type: 'string?' },
  completedAt: { column: 'completed_at', type: 'string?' },
  completedBy: { column: 'completed_by', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

export const leadNoteSchema = defineSchema<LeadNote>({
  id: 'number',
  projectId: { column: 'project_id', type: 'number' },
  author: {
    column: 'author_name',
    type: 'string',
    default: 'Unknown'
  },
  content: 'string',
  isPinned: { column: 'is_pinned', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

export const leadSourceSchema = defineSchema<LeadSource>({
  id: 'number',
  name: 'string',
  description: 'string?',
  isActive: { column: 'is_active', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'string' }
});

export const leadSummarySchema = defineSchema<LeadSummary>({
  id: 'number',
  projectName: { column: 'project_name', type: 'string' },
  clientName: { column: 'contact_name', type: 'string?' },
  companyName: { column: 'company_name', type: 'string?' },
  budgetRange: { column: 'budget_range', type: 'string?' },
  leadScore: { column: 'lead_score', type: 'number', default: 0 },
  expectedValue: { column: 'expected_value', type: 'float?' },
  expectedCloseDate: { column: 'expected_close_date', type: 'string?' },
  assignedTo: { column: 'assigned_to', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' }
});

// DuplicateResult has optional lead1/lead2 fields that are computed, not from DB
export const duplicateResultSchema = definePartialSchema<DuplicateResult>()({
  id: 'number',
  leadId1: { column: 'lead_id_1', type: 'number' },
  leadId2: { column: 'lead_id_2', type: 'number' },
  similarityScore: { column: 'similarity_score', type: 'float' },
  matchFields: { column: 'match_fields', type: 'json', default: [] },
  status: {
    column: 'status',
    type: 'string',
    transform: (v) => v as DuplicateResult['status']
  },
  resolvedAt: { column: 'resolved_at', type: 'string?' },
  resolvedBy: { column: 'resolved_by', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' }
});

// =====================================================
// MAPPER FUNCTIONS
// =====================================================

export const toScoringRule = createMapper<ScoringRuleRow, ScoringRule>(scoringRuleSchema);
export const toPipelineStage = createMapper<PipelineStageRow, PipelineStage>(pipelineStageSchema);
export const toLeadTask = createMapper<LeadTaskRow, LeadTask>(leadTaskSchema);
export const toLeadNote = createMapper<LeadNoteRow, LeadNote>(leadNoteSchema);
export const toLeadSource = createMapper<LeadSourceRow, LeadSource>(leadSourceSchema);
export const toLeadSummary = createMapper<ProjectRow, LeadSummary>(leadSummarySchema);
/**
 * Map a DuplicateRow to DuplicateResult.
 * Note: lead1 and lead2 are optional computed fields that need to be added separately.
 */
export function toDuplicateResult(row: DuplicateRow): DuplicateResult {
  return createMapper<DuplicateRow, Omit<DuplicateResult, 'lead1' | 'lead2'>>(
    duplicateResultSchema as ReturnType<typeof defineSchema<Omit<DuplicateResult, 'lead1' | 'lead2'>>>
  )(row) as DuplicateResult;
}
