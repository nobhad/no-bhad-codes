/**
 * ===============================================
 * AI SERVICE
 * ===============================================
 * @file server/services/ai-service.ts
 *
 * Core service for AI-powered features: proposal
 * drafting, email drafting, usage tracking,
 * budget enforcement, and response caching.
 */

import { createHash } from 'crypto';
import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';
import { AI_CONFIG, calculateCostCents, AI_TEMPERATURES } from '../config/ai-config.js';
import type {
  AiRequestType,
  DraftProposalContext,
  DraftProposalResult,
  DraftEmailContext,
  DraftEmailResult,
  AiUsageSummary,
  AiUsageHistoryEntry,
  AiResponseCacheRow
} from './ai-types.js';

// ============================================
// Lazy Anthropic client
// ============================================

let anthropicClient: import('@anthropic-ai/sdk').default | null = null;

function getClient(): import('@anthropic-ai/sdk').default {
  if (!AI_CONFIG.apiKey) {
    throw new Error('AI features are not configured — ANTHROPIC_API_KEY is missing');
  }
  if (!AI_CONFIG.enabled) {
    throw new Error('AI features are disabled');
  }
  if (!anthropicClient) {
    // Dynamic import is used in the route handler; here we use the sync constructor
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Anthropic = require('@anthropic-ai/sdk').default;
    anthropicClient = new Anthropic({ apiKey: AI_CONFIG.apiKey });
  }
  return anthropicClient!;
}

// ============================================
// Budget & Rate Enforcement
// ============================================

async function checkBudget(): Promise<void> {
  const db = getDatabase();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = (await db.get(
    `SELECT COALESCE(SUM(cost_cents), 0) AS total
     FROM ai_usage_log
     WHERE created_at >= ?`,
    [startOfMonth.toISOString()]
  )) as { total: number };

  if (result.total >= AI_CONFIG.monthlyBudgetCents) {
    throw new Error(`Monthly AI budget exceeded ($${(result.total / 100).toFixed(2)} / $${(AI_CONFIG.monthlyBudgetCents / 100).toFixed(2)})`);
  }
}

async function checkDailyLimit(): Promise<void> {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];

  const result = (await db.get(
    `SELECT COUNT(*) AS cnt
     FROM ai_usage_log
     WHERE created_at >= ? AND cache_hit = 0`,
    [`${today}T00:00:00`]
  )) as { cnt: number };

  if (result.cnt >= AI_CONFIG.dailyRequestLimit) {
    throw new Error(`Daily AI request limit reached (${AI_CONFIG.dailyRequestLimit})`);
  }
}

// ============================================
// Caching
// ============================================

function hashContext(context: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(context))
    .digest('hex');
}

async function getCachedResponse(hash: string): Promise<AiResponseCacheRow | null> {
  if (!AI_CONFIG.cacheEnabled) return null;

  const db = getDatabase();
  const now = new Date().toISOString();

  const row = (await db.get(
    `SELECT * FROM ai_response_cache
     WHERE context_hash = ? AND expires_at > ?`,
    [hash, now]
  )) as AiResponseCacheRow | undefined;

  return row ?? null;
}

async function setCachedResponse(
  hash: string,
  requestType: AiRequestType,
  responseJson: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  if (!AI_CONFIG.cacheEnabled) return;

  const db = getDatabase();
  const expiresAt = new Date(
    Date.now() + AI_CONFIG.cacheTtlSeconds * 1000
  ).toISOString();

  await db.run(
    `INSERT OR REPLACE INTO ai_response_cache
     (context_hash, request_type, response_json, input_tokens, output_tokens, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`,
    [hash, requestType, responseJson, inputTokens, outputTokens, expiresAt]
  );
}

// ============================================
// Usage Logging
// ============================================

async function logUsage(
  requestType: AiRequestType,
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheHit: boolean,
  entityType?: string,
  entityId?: number
): Promise<void> {
  const db = getDatabase();
  const costCents = cacheHit ? 0 : calculateCostCents(model, inputTokens, outputTokens);

  await db.run(
    `INSERT INTO ai_usage_log
     (request_type, model, input_tokens, output_tokens, cost_cents, cache_hit, entity_type, entity_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      requestType,
      model,
      inputTokens,
      outputTokens,
      costCents,
      cacheHit ? 1 : 0,
      entityType ?? null,
      entityId ?? null
    ]
  );
}

// ============================================
// Core API Call
// ============================================

interface AiCallOptions {
  systemPrompt: string;
  userPrompt: string;
  requestType: AiRequestType;
  temperature?: number;
  entityType?: string;
  entityId?: number;
  cacheContext?: unknown;
}

interface AiCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
}

async function callAi(options: AiCallOptions): Promise<AiCallResult> {
  await checkBudget();
  await checkDailyLimit();

  // Check cache
  const cacheKey = options.cacheContext
    ? hashContext({ ...options.cacheContext, requestType: options.requestType })
    : null;

  if (cacheKey) {
    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      await logUsage(
        options.requestType,
        AI_CONFIG.model,
        cached.input_tokens,
        cached.output_tokens,
        true,
        options.entityType,
        options.entityId
      );

      return {
        text: JSON.parse(cached.response_json).text,
        inputTokens: cached.input_tokens,
        outputTokens: cached.output_tokens,
        cached: true
      };
    }
  }

  // Call Anthropic
  const client = getClient();
  const response = await client.messages.create({
    model: AI_CONFIG.model,
    max_tokens: AI_CONFIG.maxTokensPerRequest,
    temperature: options.temperature ?? AI_TEMPERATURES.proposal,
    system: options.systemPrompt,
    messages: [{ role: 'user', content: options.userPrompt }]
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('\n');

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  // Cache and log
  if (cacheKey) {
    await setCachedResponse(
      cacheKey,
      options.requestType,
      JSON.stringify({ text }),
      inputTokens,
      outputTokens
    );
  }

  await logUsage(
    options.requestType,
    AI_CONFIG.model,
    inputTokens,
    outputTokens,
    false,
    options.entityType,
    options.entityId
  );

  return { text, inputTokens, outputTokens, cached: false };
}

// ============================================
// 6A: Proposal Drafting
// ============================================

async function draftProposalScope(context: DraftProposalContext): Promise<DraftProposalResult> {
  const systemPrompt = `You are a professional web developer and project manager writing a project proposal for a freelance web development agency.
Write clear, concise scope descriptions, feature breakdowns, and timeline narratives.
Do NOT include pricing. Focus on what will be built and how.
Use markdown formatting for sections.
Tone: ${context.tone || 'professional'}.`;

  const parts: string[] = [];
  if (context.clientName) parts.push(`Client: ${context.clientName}`);
  if (context.projectType) parts.push(`Project Type: ${context.projectType}`);
  if (context.tier) parts.push(`Tier: ${context.tier}`);
  if (context.budget) parts.push(`Budget Range: ${context.budget}`);
  if (context.timeline) parts.push(`Timeline Preference: ${context.timeline}`);
  if (context.features?.length) parts.push(`Key Features: ${context.features.join(', ')}`);
  if (context.questionnaireInsights) {
    const insights = Object.entries(context.questionnaireInsights)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    parts.push(`Client Questionnaire Responses:\n${insights}`);
  }

  const userPrompt = `Draft a project proposal with the following sections:

## Scope of Work
A 2-3 paragraph overview of what will be built.

## Feature Descriptions
A bulleted list of features with 1-2 sentence descriptions each.

## Timeline
A realistic timeline narrative with phases/milestones.

Context:
${parts.join('\n')}`;

  const result = await callAi({
    systemPrompt,
    userPrompt,
    requestType: 'draft_proposal',
    temperature: AI_TEMPERATURES.proposal,
    entityType: 'proposal',
    entityId: context.projectId,
    cacheContext: context
  });

  // Parse sections from the response
  const sections = parseSections(result.text);

  return {
    scope: sections.scope || result.text,
    featureDescriptions: sections.features || '',
    timeline: sections.timeline || '',
    tokensUsed: { input: result.inputTokens, output: result.outputTokens },
    cached: result.cached
  };
}

function parseSections(text: string): { scope: string; features: string; timeline: string } {
  const scopeMatch = text.match(/##\s*Scope of Work\s*\n([\s\S]*?)(?=##|$)/i);
  const featuresMatch = text.match(/##\s*Feature Descriptions?\s*\n([\s\S]*?)(?=##|$)/i);
  const timelineMatch = text.match(/##\s*Timeline\s*\n([\s\S]*?)(?=##|$)/i);

  return {
    scope: scopeMatch ? scopeMatch[1].trim() : '',
    features: featuresMatch ? featuresMatch[1].trim() : '',
    timeline: timelineMatch ? timelineMatch[1].trim() : ''
  };
}

// ============================================
// 6B: Email Drafting
// ============================================

async function draftEmail(context: DraftEmailContext): Promise<DraftEmailResult> {
  const db = getDatabase();

  const systemPrompt = `You are a professional freelance web developer writing an email to a client.
Write clear, concise emails that are ${context.tone || 'professional'} in tone.
Return the response in this exact format:
SUBJECT: <the email subject>
BODY:
<the email body>`;

  const parts: string[] = [];
  parts.push(`Purpose: ${context.purpose}`);

  if (context.clientName) parts.push(`Client Name: ${context.clientName}`);

  // Fetch thread context if available
  if (context.threadId) {
    const messages = (await db.all(
      `SELECT content, sender_type, created_at
       FROM messages
       WHERE thread_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [context.threadId]
    )) as Array<{ content: string; sender_type: string; created_at: string }>;

    if (messages.length > 0) {
      const history = messages.reverse().map(m =>
        `[${m.sender_type}]: ${m.content.substring(0, 200)}`
      ).join('\n');
      parts.push(`Recent conversation:\n${history}`);
    }
  }

  // Fetch project context if available
  if (context.projectId) {
    const project = (await db.get(
      'SELECT project_name, status, description FROM projects WHERE id = ?',
      [context.projectId]
    )) as { project_name: string; status: string; description: string | null } | undefined;

    if (project) {
      parts.push(`Project: ${project.project_name} (${project.status})`);
    }
  }

  if (context.customPrompt) {
    parts.push(`Additional instructions: ${context.customPrompt}`);
  }

  const userPrompt = `Write an email based on this context:\n${parts.join('\n')}`;

  const result = await callAi({
    systemPrompt,
    userPrompt,
    requestType: 'draft_email',
    temperature: AI_TEMPERATURES.email,
    entityType: 'email',
    entityId: context.threadId,
    cacheContext: context
  });

  // Parse subject and body
  const subjectMatch = result.text.match(/SUBJECT:\s*(.+)/i);
  const bodyMatch = result.text.match(/BODY:\s*([\s\S]+)/i);

  return {
    subject: subjectMatch ? subjectMatch[1].trim() : 'Follow-up',
    body: bodyMatch ? bodyMatch[1].trim() : result.text,
    tokensUsed: { input: result.inputTokens, output: result.outputTokens },
    cached: result.cached
  };
}

// ============================================
// Usage Analytics
// ============================================

async function getUsageSummary(): Promise<AiUsageSummary> {
  const db = getDatabase();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const monthStart = startOfMonth.toISOString();

  const totals = (await db.get(
    `SELECT
       COALESCE(SUM(cost_cents), 0) AS total_cost,
       COUNT(*) AS request_count,
       SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) AS cache_hits
     FROM ai_usage_log
     WHERE created_at >= ?`,
    [monthStart]
  )) as { total_cost: number; request_count: number; cache_hits: number };

  const byType = (await db.all(
    `SELECT request_type, COUNT(*) AS cnt, COALESCE(SUM(cost_cents), 0) AS cost
     FROM ai_usage_log
     WHERE created_at >= ?
     GROUP BY request_type`,
    [monthStart]
  )) as Array<{ request_type: string; cnt: number; cost: number }>;

  const byTypeMap: Record<string, { count: number; costCents: number }> = {};
  for (const row of byType) {
    byTypeMap[row.request_type] = { count: row.cnt, costCents: row.cost };
  }

  // Daily remaining
  const today = new Date().toISOString().split('T')[0];
  const todayCount = (await db.get(
    `SELECT COUNT(*) AS cnt FROM ai_usage_log
     WHERE created_at >= ? AND cache_hit = 0`,
    [`${today}T00:00:00`]
  )) as { cnt: number };

  return {
    totalCostCents: totals.total_cost,
    requestCount: totals.request_count,
    cacheHits: totals.cache_hits,
    byType: byTypeMap,
    monthlyLimitCents: AI_CONFIG.monthlyBudgetCents,
    dailyRemaining: Math.max(0, AI_CONFIG.dailyRequestLimit - todayCount.cnt)
  };
}

async function getUsageHistory(): Promise<AiUsageHistoryEntry[]> {
  const db = getDatabase();

  const rows = (await db.all(
    `SELECT
       strftime('%Y-%m', created_at) AS month,
       COALESCE(SUM(cost_cents), 0) AS total_cost_cents,
       COUNT(*) AS request_count
     FROM ai_usage_log
     GROUP BY strftime('%Y-%m', created_at)
     ORDER BY month DESC
     LIMIT 12`
  )) as Array<{ month: string; total_cost_cents: number; request_count: number }>;

  return rows.map((row) => ({
    month: row.month,
    totalCostCents: row.total_cost_cents,
    requestCount: row.request_count
  }));
}

// ============================================
// Cache Cleanup
// ============================================

async function cleanupExpiredCache(): Promise<number> {
  const db = getDatabase();
  const now = new Date().toISOString();

  const result = await db.run(
    'DELETE FROM ai_response_cache WHERE expires_at <= ?',
    [now]
  );

  const deleted = result.changes ?? 0;
  if (deleted > 0) {
    logger.info('Cleaned expired AI cache entries', {
      category: 'ai',
      metadata: { deleted }
    });
  }

  return deleted;
}

// ============================================
// Status Check
// ============================================

function isAvailable(): boolean {
  return AI_CONFIG.enabled && !!AI_CONFIG.apiKey;
}

// ============================================
// Singleton Export
// ============================================

export const aiService = {
  draftProposalScope,
  draftEmail,
  getUsageSummary,
  getUsageHistory,
  cleanupExpiredCache,
  isAvailable
};
