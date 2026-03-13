/**
 * ===============================================
 * API TYPES — LEADS
 * ===============================================
 */

import type { PaginationParams } from './shared.js';

// ============================================
// Lead API Types
// ============================================

/**
 * Lead status values
 * Simplified pipeline stages: new → contacted → qualified → in-progress → converted/lost
 */
export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'in-progress'
  | 'converted'
  | 'lost'
  | 'on-hold'
  | 'cancelled';

/**
 * Lead entity response
 */
export interface LeadResponse {
  id: number;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  status: LeadStatus;
  source?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  project_name?: string;
  project_type?: string;
  description?: string;
  budget_range?: string;
  timeline?: string;
  features?: string;
}

/**
 * Lead update request
 */
export interface LeadUpdateRequest {
  status?: LeadStatus;
  notes?: string;
  contact_name?: string;
  phone?: string;
}

/**
 * Leads list response
 */
export interface LeadsListResponse {
  leads: LeadResponse[];
  stats: LeadStats;
}

/**
 * Lead statistics
 */
export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  converted: number;
}


// ============================================
// Lead Management API Types
// ============================================

/**
 * Scoring rule operators
 */
export type ScoringOperator =
  | 'equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_empty';

/**
 * Lead scoring rule
 */
export interface ScoringRule {
  id: number;
  name: string;
  description?: string;
  fieldName: string;
  operator: ScoringOperator;
  thresholdValue: string;
  points: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pipeline stage
 */
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

/**
 * Lead summary for pipeline view
 */
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

/**
 * Pipeline view data
 */
export interface PipelineView {
  stages: (PipelineStage & { leads: LeadSummary[] })[];
  totalValue: number;
  weightedValue: number;
}

/**
 * Lead task types
 */
export type LeadTaskType =
  | 'follow_up'
  | 'call'
  | 'email'
  | 'meeting'
  | 'proposal'
  | 'demo'
  | 'other';

/**
 * Lead task status
 */
export type LeadTaskStatus = 'pending' | 'completed' | 'cancelled' | 'snoozed';

/**
 * Lead task
 */
export interface LeadTask {
  id: number;
  projectId: number;
  title: string;
  description?: string;
  taskType: LeadTaskType;
  dueDate?: string;
  dueTime?: string;
  status: LeadTaskStatus;
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reminderAt?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lead note
 */
export interface LeadNote {
  id: number;
  projectId: number;
  author: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lead source
 */
export interface LeadSource {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Duplicate result status
 */
export type DuplicateStatus = 'pending' | 'merged' | 'not_duplicate' | 'dismissed';

/**
 * Duplicate detection result
 */
export interface DuplicateResult {
  id: number;
  leadId1: number;
  leadId2: number;
  similarityScore: number;
  matchFields: string[];
  status: DuplicateStatus;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  lead1?: LeadSummary;
  lead2?: LeadSummary;
}

/**
 * Lead score result
 */
export interface LeadScoreResult {
  score: number;
  breakdown: { ruleName: string; points: number; matched: boolean }[];
}

/**
 * Pipeline statistics
 */
export interface PipelineStats {
  totalLeads: number;
  totalValue: number;
  weightedValue: number;
  avgDaysInPipeline: number;
  conversionRate: number;
  stageBreakdown: { stageId: number; stageName: string; count: number; value: number }[];
}

/**
 * Lead analytics
 */
export interface LeadAnalytics {
  totalLeads: number;
  newLeadsThisMonth: number;
  conversionRate: number;
  avgLeadScore: number;
  avgDaysToClose: number;
  topSources: {
    sourceId: number;
    sourceName: string;
    leadCount: number;
    totalValue: number;
    wonCount: number;
    conversionRate: number;
  }[];
  scoreDistribution: { range: string; count: number }[];
}

/**
 * Conversion funnel data
 */
export interface FunnelData {
  stages: { name: string; count: number; value: number; conversionRate: number }[];
  overallConversionRate: number;
}

/**
 * Source performance stats
 */
export interface SourceStats {
  sourceId: number;
  sourceName: string;
  leadCount: number;
  totalValue: number;
  wonCount: number;
  conversionRate: number;
}

/**
 * Filter params for leads
 */
export interface LeadFilterParams extends PaginationParams {
  status?: LeadStatus;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
}
