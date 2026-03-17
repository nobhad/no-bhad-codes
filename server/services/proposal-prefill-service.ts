/**
 * ===============================================
 * PROPOSAL PREFILL SERVICE
 * ===============================================
 * @file server/services/proposal-prefill-service.ts
 *
 * Maps completed questionnaire responses to proposal
 * prefill data: suggested tier, auto-selected features,
 * custom item suggestions, and maintenance recommendation.
 */

import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';

// =====================================================
// TYPES
// =====================================================

export interface ProposalPrefillData {
  projectId: number;
  projectType: string;
  suggestedTier: { tier: string; confidence: number; reasoning: string };
  suggestedFeatureIds: string[];
  suggestedCustomItems: Array<{ description: string; reason: string }>;
  maintenanceRecommendation: { recommended: string; reasoning: string };
  budget: string | null;
  timeline: string | null;
  questionnaireInsights: Record<string, string>;
}

interface TierSuggestionParams {
  budget: string | null;
  pageCount: number;
  featureComplexity: number;
  techComfort: string | null;
}

interface FeatureMapping {
  answerKey: string;
  answerMatch: string | boolean;
  featureId: string;
}

// =====================================================
// CONSTANTS
// =====================================================

/** Maps budget range strings to complexity scores (0-5) */
const BUDGET_SCORE_MAP: Record<string, number> = {
  'under-1k': 0,
  '1k-2k': 1,
  '2k-5k': 2,
  '5k-10k': 3,
  '10k-20k': 4,
  '20k-plus': 5
};

/** Default budget score when range is unknown */
const DEFAULT_BUDGET_SCORE = 2;

/** Maximum feature complexity contribution to tier score */
const MAX_FEATURE_COMPLEXITY_SCORE = 5;

/** Tier score thresholds */
const GOOD_TIER_THRESHOLD = 4;
const BETTER_TIER_THRESHOLD = 8;

/** Confidence levels for tier suggestions */
const GOOD_TIER_CONFIDENCE = 0.7;
const BETTER_TIER_CONFIDENCE = 0.8;
const BEST_TIER_CONFIDENCE = 0.75;

/** Page count thresholds */
const SMALL_SITE_MAX_PAGES = 3;
const MEDIUM_SITE_MAX_PAGES = 8;

/** Default page count when not specified */
const DEFAULT_PAGE_COUNT = 5;

/** Max length for insight string values */
const INSIGHT_MAX_LENGTH = 500;

/** Low tech comfort boost for tier scoring */
const LOW_TECH_COMFORT_SCORE_BOOST = 2;

/** Page count score values */
const SMALL_SITE_SCORE = 0;
const MEDIUM_SITE_SCORE = 2;
const LARGE_SITE_SCORE = 4;

/** Boolean feature keys used for complexity calculation */
const BOOLEAN_FEATURE_KEYS = [
  'needs_blog',
  'needs_newsletter',
  'needs_booking',
  'needs_gallery',
  'needs_ecommerce',
  'needs_multilingual',
  'needs_portal'
] as const;

/** Low tech comfort values that signal need for extra support */
const LOW_TECH_COMFORT_VALUES = ['beginner', 'low', 'none'];

/** Answer-to-feature mapping rules */
const FEATURE_MAPPINGS: FeatureMapping[] = [
  { answerKey: 'needs_blog', answerMatch: true, featureId: 'blog-setup' },
  { answerKey: 'blog', answerMatch: 'yes', featureId: 'blog-setup' },
  { answerKey: 'needs_newsletter', answerMatch: true, featureId: 'newsletter-integration' },
  { answerKey: 'newsletter', answerMatch: 'yes', featureId: 'newsletter-integration' },
  { answerKey: 'needs_booking', answerMatch: true, featureId: 'booking-system' },
  { answerKey: 'booking', answerMatch: 'yes', featureId: 'booking-system' },
  { answerKey: 'needs_gallery', answerMatch: true, featureId: 'filterable-gallery' },
  { answerKey: 'gallery', answerMatch: 'yes', featureId: 'filterable-gallery' },
  { answerKey: 'needs_ecommerce', answerMatch: true, featureId: 'ecommerce-lite' },
  { answerKey: 'ecommerce', answerMatch: 'yes', featureId: 'ecommerce-lite' },
  { answerKey: 'needs_multilingual', answerMatch: true, featureId: 'multi-language' },
  { answerKey: 'needs_logo', answerMatch: true, featureId: 'logo-design' },
  { answerKey: 'logo', answerMatch: 'no', featureId: 'logo-design' },
  { answerKey: 'needs_copywriting', answerMatch: true, featureId: 'professional-copywriting' },
  { answerKey: 'content_status', answerMatch: 'need_help', featureId: 'professional-copywriting' },
  { answerKey: 'needs_domain', answerMatch: true, featureId: 'domain-hosting-setup' },
  { answerKey: 'domain_hosting', answerMatch: 'need_help', featureId: 'domain-hosting-setup' }
];

// =====================================================
// TIER SUGGESTION
// =====================================================

/**
 * Suggests a proposal tier based on project signals.
 * Scores budget, page count, feature complexity, and tech comfort
 * to recommend good/better/best tier.
 */
function suggestTier(params: TierSuggestionParams): {
  tier: string;
  confidence: number;
  reasoning: string;
} {
  let score = 0;
  const reasons: string[] = [];

  // Budget signals
  const budgetScore = BUDGET_SCORE_MAP[params.budget || ''] ?? DEFAULT_BUDGET_SCORE;
  score += budgetScore;

  // Page count signals
  if (params.pageCount <= SMALL_SITE_MAX_PAGES) {
    score += SMALL_SITE_SCORE;
    reasons.push(`Small site (1-${SMALL_SITE_MAX_PAGES} pages)`);
  } else if (params.pageCount <= MEDIUM_SITE_MAX_PAGES) {
    score += MEDIUM_SITE_SCORE;
    reasons.push(`Medium site (${SMALL_SITE_MAX_PAGES + 1}-${MEDIUM_SITE_MAX_PAGES} pages)`);
  } else {
    score += LARGE_SITE_SCORE;
    reasons.push(`Large site (${MEDIUM_SITE_MAX_PAGES + 1}+ pages)`);
  }

  // Feature complexity (capped)
  score += Math.min(params.featureComplexity, MAX_FEATURE_COMPLEXITY_SCORE);

  // Tech comfort (low comfort = needs more support = higher tier)
  if (LOW_TECH_COMFORT_VALUES.includes(params.techComfort || '')) {
    score += LOW_TECH_COMFORT_SCORE_BOOST;
    reasons.push('Low tech comfort — needs training and support');
  }

  // Map score to tier
  if (score <= GOOD_TIER_THRESHOLD) {
    return { tier: 'good', confidence: GOOD_TIER_CONFIDENCE, reasoning: reasons.join('; ') };
  }
  if (score <= BETTER_TIER_THRESHOLD) {
    return { tier: 'better', confidence: BETTER_TIER_CONFIDENCE, reasoning: reasons.join('; ') };
  }
  return { tier: 'best', confidence: BEST_TIER_CONFIDENCE, reasoning: reasons.join('; ') };
}

// =====================================================
// FEATURE MAPPING
// =====================================================

/**
 * Maps questionnaire answers to suggested feature IDs.
 * Checks each mapping rule against the merged answer set
 * and returns deduplicated feature IDs.
 */
function mapAnswersToFeatures(answers: Record<string, unknown>): string[] {
  const featureIds: string[] = [];

  for (const mapping of FEATURE_MAPPINGS) {
    const value = answers[mapping.answerKey];
    const isExactMatch = value === mapping.answerMatch;
    const isSubstringMatch =
      typeof value === 'string' &&
      typeof mapping.answerMatch === 'string' &&
      value.toLowerCase().includes(mapping.answerMatch.toLowerCase());

    if (isExactMatch || isSubstringMatch) {
      if (!featureIds.includes(mapping.featureId)) {
        featureIds.push(mapping.featureId);
      }
    }
  }

  return featureIds;
}

// =====================================================
// MAINTENANCE RECOMMENDATION
// =====================================================

/**
 * Recommends a maintenance tier based on tech comfort
 * and expected update frequency.
 */
function recommendMaintenance(
  techComfort: string | null,
  updateFrequency: string | null
): { recommended: string; reasoning: string } {
  if (LOW_TECH_COMFORT_VALUES.includes(techComfort || '')) {
    return {
      recommended: 'standard',
      reasoning: 'Low tech comfort — standard care recommended for ongoing support'
    };
  }
  if (updateFrequency === 'weekly' || updateFrequency === 'frequently') {
    return {
      recommended: 'standard',
      reasoning: 'Frequent updates needed — standard care covers 2 hours/month'
    };
  }
  if (updateFrequency === 'monthly') {
    return {
      recommended: 'essential',
      reasoning: 'Monthly updates — essential care handles security and monitoring'
    };
  }
  return {
    recommended: 'diy',
    reasoning: 'Comfortable with tech — DIY with documentation should work'
  };
}

// =====================================================
// CUSTOM ITEM SUGGESTIONS
// =====================================================

/**
 * Builds custom item suggestions based on questionnaire answers.
 */
function buildCustomItemSuggestions(
  allAnswers: Record<string, unknown>,
  techComfort: string
): Array<{ description: string; reason: string }> {
  const items: Array<{ description: string; reason: string }> = [];

  if (
    allAnswers.needs_logo === true ||
    allAnswers.logo === 'no' ||
    allAnswers.has_logo === false
  ) {
    items.push({
      description: 'Logo Design',
      reason: 'Client indicated they need a logo'
    });
  }

  if (LOW_TECH_COMFORT_VALUES.includes(techComfort)) {
    items.push({
      description: 'Training & Documentation Package',
      reason: 'Low tech comfort — extra training recommended'
    });
  }

  if (allAnswers.needs_domain === true || allAnswers.domain_hosting === 'need_help') {
    items.push({
      description: 'Domain Registration & DNS Setup',
      reason: 'Client needs help with domain/hosting'
    });
  }

  return items;
}

// =====================================================
// INSIGHT EXTRACTION
// =====================================================

/**
 * Extracts key insights from project data and questionnaire answers
 * for display in the prefill summary.
 */
function extractInsights(
  project: Record<string, unknown>,
  allAnswers: Record<string, unknown>,
  budget: string,
  timeline: string,
  techComfort: string
): Record<string, string> {
  const insights: Record<string, string> = {};

  if (budget) insights.budget = budget;
  if (timeline) insights.timeline = timeline;
  if (techComfort) insights.techComfort = techComfort;

  if (project.description) {
    insights.projectDescription = String(project.description).slice(0, INSIGHT_MAX_LENGTH);
  }
  if (allAnswers.inspiration) {
    insights.inspiration = String(allAnswers.inspiration).slice(0, INSIGHT_MAX_LENGTH);
  }
  if (allAnswers.brand_values) {
    insights.brandValues = String(allAnswers.brand_values).slice(0, INSIGHT_MAX_LENGTH);
  }
  if (allAnswers.competitors) {
    insights.competitors = String(allAnswers.competitors).slice(0, INSIGHT_MAX_LENGTH);
  }

  return insights;
}

// =====================================================
// ANSWER MERGING
// =====================================================

/**
 * Merges all completed questionnaire response answers into
 * a single flat object. Later responses override earlier ones.
 */
function mergeResponseAnswers(
  responses: Array<{ answers: string }>
): Record<string, unknown> {
  const allAnswers: Record<string, unknown> = {};

  for (const response of responses) {
    try {
      const parsed = JSON.parse(response.answers || '{}');
      Object.assign(allAnswers, parsed);
    } catch {
      // Skip invalid JSON silently
    }
  }

  return allAnswers;
}

/**
 * Calculates feature complexity score by counting boolean
 * feature flags that are enabled in the answers.
 */
function calculateFeatureComplexity(allAnswers: Record<string, unknown>): number {
  let complexity = 0;

  for (const key of BOOLEAN_FEATURE_KEYS) {
    if (allAnswers[key] === true || allAnswers[key] === 'yes') {
      complexity++;
    }
  }

  return complexity;
}

// =====================================================
// MAIN FUNCTION
// =====================================================

/**
 * Generates proposal prefill data from a project's completed
 * questionnaire responses. Returns null if the project is not found.
 *
 * Steps:
 * 1. Fetch project info (type, budget, timeline)
 * 2. Fetch all completed questionnaire responses
 * 3. Parse and merge answer JSON from each response
 * 4. Analyze answers for tier, features, custom items, maintenance
 * 5. Return structured prefill data
 */
export async function generateProposalPrefill(
  projectId: number
): Promise<ProposalPrefillData | null> {
  const db = getDatabase();

  // Get project info
  const project = (await db.get(
    `SELECT p.id, p.project_type, p.budget_range, p.timeline, p.description,
            p.features, p.page_count, p.tech_comfort, p.design_level
     FROM active_projects p WHERE p.id = ?`,
    [projectId]
  )) as Record<string, unknown> | undefined;

  if (!project) return null;

  // Get all completed questionnaire responses
  const responses = (await db.all(
    `SELECT qr.answers, q.title as questionnaire_title, q.project_type as questionnaire_type
     FROM questionnaire_responses qr
     JOIN questionnaires q ON qr.questionnaire_id = q.id
     WHERE qr.project_id = ? AND qr.status = 'completed'`,
    [projectId]
  )) as Array<{
    answers: string;
    questionnaire_title: string;
    questionnaire_type: string | null;
  }>;

  // Merge all answers into a single object
  const allAnswers = mergeResponseAnswers(responses);

  // Extract key signals from project and answers
  const pageCount =
    Number(project.page_count) || Number(allAnswers.page_count) || DEFAULT_PAGE_COUNT;
  const budget = String(project.budget_range || allAnswers.budget || '');
  const techComfort = String(project.tech_comfort || allAnswers.tech_comfort || '');
  const timeline = String(project.timeline || allAnswers.timeline || '');
  const projectType = String(project.project_type || 'other');

  // Calculate feature complexity from boolean answer flags
  const featureComplexity = calculateFeatureComplexity(allAnswers);

  // Generate all suggestions
  const suggestedTier = suggestTier({ budget, pageCount, featureComplexity, techComfort });
  const suggestedFeatureIds = mapAnswersToFeatures(allAnswers);
  const maintenanceRecommendation = recommendMaintenance(
    techComfort,
    String(allAnswers.update_frequency || allAnswers.updateFrequency || '')
  );
  const suggestedCustomItems = buildCustomItemSuggestions(allAnswers, techComfort);
  const questionnaireInsights = extractInsights(
    project,
    allAnswers,
    budget,
    timeline,
    techComfort
  );

  await logger.info(`[ProposalPrefill] Generated prefill for project ${projectId}`, {
    category: 'proposals',
    metadata: {
      tier: suggestedTier.tier,
      features: suggestedFeatureIds.length,
      customItems: suggestedCustomItems.length
    }
  });

  return {
    projectId,
    projectType,
    suggestedTier,
    suggestedFeatureIds,
    suggestedCustomItems,
    maintenanceRecommendation,
    budget: budget || null,
    timeline: timeline || null,
    questionnaireInsights
  };
}
