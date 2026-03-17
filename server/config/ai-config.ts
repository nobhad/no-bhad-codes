/**
 * ===============================================
 * AI CONFIGURATION
 * ===============================================
 * @file server/config/ai-config.ts
 *
 * Configuration for AI-powered features including
 * model selection, budget limits, and caching.
 */

// ============================================
// Environment-driven config
// ============================================

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250514';
const DEFAULT_MONTHLY_BUDGET_CENTS = 5000; // $50
const DEFAULT_DAILY_REQUEST_LIMIT = 50;
const DEFAULT_MAX_TOKENS = 2000;
const DEFAULT_CACHE_TTL_SECONDS = 86400; // 24 hours

export const AI_CONFIG = {
  /** Anthropic API key from environment */
  apiKey: process.env.ANTHROPIC_API_KEY || '',

  /** Master kill switch for all AI features */
  enabled: process.env.AI_ENABLED !== 'false',

  /** Claude model to use */
  model: process.env.AI_MODEL || DEFAULT_MODEL,

  /** Maximum tokens per request */
  maxTokensPerRequest: DEFAULT_MAX_TOKENS,

  /** Monthly spending limit in cents */
  monthlyBudgetCents: parseInt(process.env.AI_MONTHLY_BUDGET_CENTS || '', 10) || DEFAULT_MONTHLY_BUDGET_CENTS,

  /** Maximum API calls per day (excludes cache hits) */
  dailyRequestLimit: parseInt(process.env.AI_DAILY_REQUEST_LIMIT || '', 10) || DEFAULT_DAILY_REQUEST_LIMIT,

  /** Whether to use response caching */
  cacheEnabled: true,

  /** Cache TTL in seconds */
  cacheTtlSeconds: DEFAULT_CACHE_TTL_SECONDS
} as const;

// ============================================
// Model Pricing (per million tokens, in cents)
// ============================================

const CENTS_PER_DOLLAR = 100;

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

/** Pricing in cents per million tokens */
const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-5-20250514': {
    inputPerMillion: 3 * CENTS_PER_DOLLAR,   // $3/M input
    outputPerMillion: 15 * CENTS_PER_DOLLAR   // $15/M output
  },
  'claude-haiku-4-5-20251001': {
    inputPerMillion: 0.80 * CENTS_PER_DOLLAR,  // $0.80/M input
    outputPerMillion: 4 * CENTS_PER_DOLLAR     // $4/M output
  }
};

const TOKENS_PER_MILLION = 1_000_000;

/**
 * Calculate cost in cents for a given model and token counts.
 */
export function calculateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];

  const inputCost = (inputTokens / TOKENS_PER_MILLION) * pricing.inputPerMillion;
  const outputCost = (outputTokens / TOKENS_PER_MILLION) * pricing.outputPerMillion;

  return Math.round((inputCost + outputCost) * 100) / 100;
}

// ============================================
// Temperature Presets
// ============================================

export const AI_TEMPERATURES: Record<string, number> = {
  proposal: 0.7,
  email: 0.6,
  search: 0.3
};
