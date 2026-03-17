/**
 * ===============================================
 * AI SERVICE TYPES
 * ===============================================
 * @file server/services/ai-types.ts
 *
 * Type definitions for the AI-powered features
 * including proposal drafting, email drafting,
 * and usage tracking.
 */

// ============================================
// Request Types
// ============================================

export type AiRequestType = 'draft_proposal' | 'draft_email' | 'search';

// ============================================
// DB Row Types
// ============================================

export interface AiUsageLogRow {
  id: number;
  request_type: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_cents: number;
  cache_hit: number;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
}

export interface AiResponseCacheRow {
  id: number;
  context_hash: string;
  request_type: string;
  response_json: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
  expires_at: string;
}

// ============================================
// Proposal Drafting
// ============================================

export interface DraftProposalContext {
  projectId: number;
  projectName?: string;
  projectType?: string;
  tier?: string;
  features?: string[];
  budget?: string | null;
  timeline?: string | null;
  clientName?: string;
  questionnaireInsights?: Record<string, string>;
  tone?: 'professional' | 'friendly' | 'technical';
}

export interface DraftProposalResult {
  scope: string;
  featureDescriptions: string;
  timeline: string;
  tokensUsed: { input: number; output: number };
  cached: boolean;
}

// ============================================
// Email Drafting
// ============================================

export interface DraftEmailContext {
  purpose: string;
  threadId?: number;
  projectId?: number;
  clientName?: string;
  customPrompt?: string;
  tone?: 'professional' | 'friendly' | 'technical';
}

export interface DraftEmailResult {
  subject: string;
  body: string;
  tokensUsed: { input: number; output: number };
  cached: boolean;
}

// ============================================
// Usage Analytics
// ============================================

export interface AiUsageSummary {
  totalCostCents: number;
  requestCount: number;
  cacheHits: number;
  byType: Record<string, { count: number; costCents: number }>;
  monthlyLimitCents: number;
  dailyRemaining: number;
}

export interface AiUsageHistoryEntry {
  month: string;
  totalCostCents: number;
  requestCount: number;
}
