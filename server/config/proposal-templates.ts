/**
 * ===============================================
 * PROPOSAL TEMPLATE CONFIGURATION
 * ===============================================
 * @file server/config/proposal-templates.ts
 *
 * Budget-relative tier system for proposal generation.
 * Tiers map to the client's budget range, not fixed prices:
 *   - Good = low end of budget (essentials, minimum viable delivery)
 *   - Better = middle of budget (custom, the sweet spot)
 *   - Best = high end of budget (everything + premium extras)
 *
 * Template data lives in proposal-templates.json. This module
 * provides the TypeScript interfaces and lookup functions.
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// =====================================================
// CONSTANTS
// =====================================================

/** Budget percentage multipliers for each tier */
const TIER_BUDGET_MULTIPLIERS = {
  good: { target: 0.35, floor: 'min' as const },
  better: { target: 0.60, floor: null },
  best: { target: 0.95, floor: null }
} as const;

/** Rounding thresholds for calculated tier prices */
const PRICE_ROUNDING_THRESHOLD_MEDIUM = 5000;
const PRICE_ROUNDING_THRESHOLD_HIGH = 20000;
const PRICE_ROUNDING_INCREMENT_LOW = 50;
const PRICE_ROUNDING_INCREMENT_MEDIUM = 100;
const PRICE_ROUNDING_INCREMENT_HIGH = 500;

/**
 * Multipliers for deriving tier prices from a single budget number.
 * Calibrated from real client data (Hedgewitch: $5,000 budget →
 * Good=$2,000-2,500, Better=$4,000, Best=$6,500):
 *   Good  = ~45% of budget (well under — the practical/savings option)
 *   Better = ~80% of budget (at/near budget — the recommended sweet spot)
 *   Best  = ~130% of budget (above budget — the stretch/premium option)
 */
const SINGLE_BUDGET_GOOD_MULTIPLIER = 0.45;
const SINGLE_BUDGET_BETTER_MULTIPLIER = 0.80;
const SINGLE_BUDGET_BEST_MULTIPLIER = 1.30;

// =====================================================
// INTERFACES
// =====================================================

export interface FeatureDefinition {
  id: string;
  name: string;
  category: string;
}

export interface AddonDefinition {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
}

export interface MaintenanceInclusion {
  included: string;  // 'none' | 'essential' | 'standard' | 'premium'
  includedDuration?: string;  // e.g., '3 months'
  description: string;
  recommendedOption: string;
  availableOptions: string[];
}

export interface TierDefinition {
  name: string;
  displayName: string;
  scope: string;
  estimatedWeeks: string;
  includesAllFrom?: string;
  deliverables: string[];
  maintenanceInclusion?: MaintenanceInclusion;
  features: FeatureDefinition[];
}

export interface ProjectTypeDefinition {
  displayName: string;
  description: string;
  typicalBudgetRange: string;
  estimatedTimeline: string;
  tiers: Record<string, TierDefinition>;
  addons: AddonDefinition[];
}

export interface BudgetGuidanceEntry {
  budgetPosition: string;
  budgetPercentage: string;
  description: string;
  positioning: string;
}

export interface MaintenanceFeature {
  id: string;
  name: string;
}

export interface MaintenanceOptionDefinition {
  name: string;
  displayName: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: MaintenanceFeature[];
}

export interface MaintenanceConfig {
  displayName: string;
  description: string;
  options: Record<string, MaintenanceOptionDefinition>;
}

export interface DiscountRule {
  type: 'percentage' | 'fixed';
  value: number;
  reason: string;
}

export interface GlobalAddonDefinition {
  id: string;
  name: string;
  description: string;
  priceRange: { min: number; max: number };
  category: string;
}

export interface AIInstructions {
  overview: string;
  pricingRules: string[];
  proposalStructure: string[];
  toneGuidance: string;
  maintenanceRules: string[];
  featureDescriptions: string;
  tierCumulativeRule: string;
  budgetExamples: Array<{
    clientBudget: string;
    projectType: string;
    good: string;
    better: string;
    best: string;
  }>;
}

export interface ProposalTemplateConfig {
  version: string;
  lastUpdated: string;
  description: string;
  budgetGuidance: Record<string, BudgetGuidanceEntry>;
  projectTypes: Record<string, ProjectTypeDefinition>;
  maintenance: MaintenanceConfig;
  globalAddons: GlobalAddonDefinition[];
  featureCategories: Record<string, { displayName: string; description: string }>;
  discountRules: Record<string, DiscountRule>;
  paymentSchedules: Record<string, unknown>;
  paymentMethods: Array<unknown>;
  aiInstructions: AIInstructions;
}

// =====================================================
// LOAD TEMPLATE DATA
// =====================================================

// Resolves relative to this file — works with tsx (dev) and tsc (build)
const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = resolve(__dirname, 'proposal-templates.json');

export const PROPOSAL_TEMPLATES: ProposalTemplateConfig = JSON.parse(
  readFileSync(jsonPath, 'utf-8')
);

// =====================================================
// LOOKUP FUNCTIONS
// =====================================================

/**
 * Get template for a specific project type
 */
export function getProjectTypeTemplate(projectType: string): ProjectTypeDefinition | undefined {
  return PROPOSAL_TEMPLATES.projectTypes[projectType];
}

/**
 * Get tier definition for a project type + tier
 */
export function getTierDefinition(projectType: string, tier: string): TierDefinition | undefined {
  return PROPOSAL_TEMPLATES.projectTypes[projectType]?.tiers[tier];
}

/**
 * Get all available addons for a project type
 */
export function getAddons(projectType: string): AddonDefinition[] {
  return PROPOSAL_TEMPLATES.projectTypes[projectType]?.addons || [];
}

/**
 * Get all available project type keys
 */
export function getProjectTypeKeys(): string[] {
  return Object.keys(PROPOSAL_TEMPLATES.projectTypes);
}

/**
 * Get all maintenance options
 */
export function getMaintenanceOptions(): Record<string, MaintenanceOptionDefinition> {
  return PROPOSAL_TEMPLATES.maintenance.options;
}

/**
 * Get budget guidance for all tiers
 */
export function getBudgetGuidance(): Record<string, BudgetGuidanceEntry> {
  return PROPOSAL_TEMPLATES.budgetGuidance;
}

/**
 * Get AI instructions for proposal generation
 */
export function getAIInstructions(): AIInstructions {
  return PROPOSAL_TEMPLATES.aiInstructions;
}

// =====================================================
// BUDGET CALCULATION
// =====================================================

export interface BudgetRange {
  min: number;
  max: number;
}

/**
 * Round a price to the appropriate increment based on amount.
 *
 * - Under $5,000: round to nearest $50
 * - $5,000 - $20,000: round to nearest $100
 * - Over $20,000: round to nearest $500
 */
function roundPrice(price: number): number {
  if (price >= PRICE_ROUNDING_THRESHOLD_HIGH) {
    return Math.round(price / PRICE_ROUNDING_INCREMENT_HIGH) * PRICE_ROUNDING_INCREMENT_HIGH;
  }
  if (price >= PRICE_ROUNDING_THRESHOLD_MEDIUM) {
    return Math.round(price / PRICE_ROUNDING_INCREMENT_MEDIUM) * PRICE_ROUNDING_INCREMENT_MEDIUM;
  }
  return Math.round(price / PRICE_ROUNDING_INCREMENT_LOW) * PRICE_ROUNDING_INCREMENT_LOW;
}

/**
 * Calculate tier prices from a client's budget range.
 *
 * - Good = 35% of max budget (floored at min budget)
 * - Better = 60% of max budget
 * - Best = 95% of max budget
 *
 * If a single number is given (min === max), it's the budget anchor:
 *   Good = 45% (well under budget — the practical option)
 *   Better = 80% (at budget — the recommended sweet spot)
 *   Best = 130% (above budget — the premium stretch option)
 */
export function calculateTierPrices(budget: BudgetRange): Record<string, number> {
  const isSingleBudget = budget.min === budget.max;

  if (isSingleBudget) {
    // Single budget = the anchor point. Better sits at/near it,
    // Good is well under (savings option), Best stretches above (premium option).
    // Calibrated: $5,000 budget → Good=$2,250, Better=$4,000, Best=$6,500
    return {
      good: roundPrice(budget.max * SINGLE_BUDGET_GOOD_MULTIPLIER),
      better: roundPrice(budget.max * SINGLE_BUDGET_BETTER_MULTIPLIER),
      best: roundPrice(budget.max * SINGLE_BUDGET_BEST_MULTIPLIER)
    };
  }

  const goodPrice = roundPrice(budget.max * TIER_BUDGET_MULTIPLIERS.good.target);
  const betterPrice = roundPrice(budget.max * TIER_BUDGET_MULTIPLIERS.better.target);
  const bestPrice = roundPrice(budget.max * TIER_BUDGET_MULTIPLIERS.best.target);

  return {
    good: Math.max(goodPrice, budget.min),
    better: betterPrice,
    best: bestPrice
  };
}

// =====================================================
// FEATURE RESOLUTION
// =====================================================

/**
 * Resolve all features for a tier, including inherited features
 * from lower tiers (cumulative tier system).
 */
export function resolveAllTierFeatures(projectType: string, tier: string): FeatureDefinition[] {
  const projectConfig = PROPOSAL_TEMPLATES.projectTypes[projectType];
  if (!projectConfig) return [];

  const tierConfig = projectConfig.tiers[tier];
  if (!tierConfig) return [];

  const allFeatures: FeatureDefinition[] = [];
  const seenIds = new Set<string>();

  // Recursively collect features from inherited tiers
  if (tierConfig.includesAllFrom) {
    const inheritedFeatures = resolveAllTierFeatures(projectType, tierConfig.includesAllFrom);
    for (const feature of inheritedFeatures) {
      if (!seenIds.has(feature.id)) {
        seenIds.add(feature.id);
        allFeatures.push(feature);
      }
    }
  }

  // Add this tier's own features
  for (const feature of tierConfig.features) {
    if (!seenIds.has(feature.id)) {
      seenIds.add(feature.id);
      allFeatures.push(feature);
    }
  }

  return allFeatures;
}

// =====================================================
// PROPOSAL BUILDER
// =====================================================

interface ProposalFeatureOutput {
  featureId: string;
  featureName: string;
  featurePrice: number;
  featureCategory: string;
  isIncludedInTier: boolean;
  isAddon: boolean;
}

interface BuildProposalResult {
  tierPrice: number;
  finalPrice: number;
  allTierPrices: Record<string, number>;
  maintenanceOption: string | null;
  maintenanceInclusion?: MaintenanceInclusion;
  features: ProposalFeatureOutput[];
  scope: string;
  estimatedWeeks: string;
  deliverables: string[];
}

/**
 * Build a complete proposal payload from template + selections.
 *
 * Calculates tier prices from the client's budget, resolves
 * cumulative features, adds selected addons, and returns
 * a complete proposal payload.
 */
export function buildProposalFromTemplate(params: {
  projectType: string;
  tier: string;
  budget: BudgetRange;
  selectedAddonIds?: string[];
  maintenanceOption?: string;
}): BuildProposalResult | null {
  const projectConfig = PROPOSAL_TEMPLATES.projectTypes[params.projectType];
  if (!projectConfig) return null;

  const tierConfig = projectConfig.tiers[params.tier];
  if (!tierConfig) return null;

  // Calculate tier prices from budget
  const allTierPrices = calculateTierPrices(params.budget);
  const tierPrice = allTierPrices[params.tier] ?? allTierPrices.better;

  // Resolve all features (including inherited from lower tiers)
  const resolvedFeatures = resolveAllTierFeatures(params.projectType, params.tier);

  const features: ProposalFeatureOutput[] = [];

  // Add tier-included features (no additional cost)
  for (const feature of resolvedFeatures) {
    features.push({
      featureId: feature.id,
      featureName: feature.name,
      featurePrice: 0,
      featureCategory: feature.category,
      isIncludedInTier: true,
      isAddon: false
    });
  }

  // Add selected addons (with their prices)
  let addonTotal = 0;
  if (params.selectedAddonIds) {
    for (const addonId of params.selectedAddonIds) {
      const addon = projectConfig.addons.find(a => a.id === addonId);
      if (addon) {
        features.push({
          featureId: addon.id,
          featureName: addon.name,
          featurePrice: addon.price,
          featureCategory: addon.category,
          isIncludedInTier: false,
          isAddon: true
        });
        addonTotal += addon.price;
      }
    }
  }

  return {
    tierPrice,
    finalPrice: tierPrice + addonTotal,
    allTierPrices,
    maintenanceOption: params.maintenanceOption || null,
    maintenanceInclusion: tierConfig.maintenanceInclusion,
    features,
    scope: tierConfig.scope,
    estimatedWeeks: tierConfig.estimatedWeeks,
    deliverables: tierConfig.deliverables
  };
}
