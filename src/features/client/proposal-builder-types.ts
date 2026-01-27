/**
 * ===============================================
 * PROPOSAL BUILDER - TYPE DEFINITIONS
 * ===============================================
 * @file src/features/client/proposal-builder-types.ts
 *
 * Type definitions for the tiered proposal builder module.
 * Supports GOOD/BETTER/BEST tier structure with mix & match capabilities.
 */

/**
 * Tier identifier
 */
export type TierId = 'good' | 'better' | 'best';

/**
 * Project type identifier (matches terminal-intake-data.ts)
 */
export type ProjectType =
  | 'simple-site'
  | 'business-site'
  | 'portfolio'
  | 'ecommerce'
  | 'web-app'
  | 'browser-extension'
  | 'other';

/**
 * Feature category for organization
 */
export type FeatureCategory = 'design' | 'development' | 'support' | 'marketing';

/**
 * Billing cycle for maintenance options
 */
export type BillingCycle = 'monthly' | 'annual';

/**
 * Maintenance option identifier
 */
export type MaintenanceId = 'diy' | 'essential' | 'standard' | 'premium';

/**
 * Proposal request status
 */
export type ProposalStatus = 'pending' | 'reviewed' | 'accepted' | 'rejected' | 'converted';

/**
 * Proposal tier configuration
 */
export interface ProposalTier {
  id: TierId;
  name: string;
  tagline: string;
  priceRange: {
    min: number;
    max: number;
  };
  baseFeatures: string[]; // Feature IDs included in this tier
  highlighted?: boolean; // Show as recommended
  description?: string;
}

/**
 * Individual feature definition
 */
export interface ProposalFeature {
  id: string;
  name: string;
  description: string;
  price: number; // Add-on price when not included in tier
  category: FeatureCategory;
  tiers: TierId[]; // Which tiers include this feature
  isRequired?: boolean; // Cannot be removed
  requiresFeature?: string; // Depends on another feature
}

/**
 * Maintenance/support option
 */
export interface MaintenanceOption {
  id: MaintenanceId;
  name: string;
  price: number;
  billingCycle: BillingCycle;
  features: string[];
  highlighted?: boolean;
  description?: string;
}

/**
 * User's proposal selection state
 */
export interface ProposalSelection {
  selectedTier: TierId;
  addedFeatures: string[]; // Feature IDs added beyond tier
  removedFeatures: string[]; // Feature IDs removed from tier (if allowed)
  maintenanceOption: MaintenanceId | null;
  calculatedPrice: number;
  notes: string;
}

/**
 * Complete tier configuration for a project type
 */
export interface TierConfiguration {
  projectType: ProjectType;
  tiers: ProposalTier[];
  features: ProposalFeature[];
  maintenanceOptions: MaintenanceOption[];
}

/**
 * Price breakdown for display
 */
export interface PriceBreakdown {
  tierBasePrice: number;
  tierName: string;
  addedFeatures: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  maintenanceOption: {
    name: string;
    price: number;
    billingCycle: BillingCycle;
  } | null;
  subtotal: number;
  total: number;
}

/**
 * Proposal request submitted to backend
 */
export interface ProposalRequest {
  intakeId?: string;
  projectType: ProjectType;
  selectedTier: TierId;
  addedFeatures: string[];
  removedFeatures: string[];
  maintenanceOption: MaintenanceId | null;
  basePrice: number;
  finalPrice: number;
  clientNotes: string;
}

/**
 * Proposal request response from backend
 */
export interface ProposalResponse {
  id: number;
  projectId: number;
  clientId: number;
  selectedTier: TierId;
  basePrice: number;
  finalPrice: number;
  maintenanceOption: MaintenanceId | null;
  status: ProposalStatus;
  clientNotes: string;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  features: Array<{
    featureId: string;
    featureName: string;
    featurePrice: number;
    isIncludedInTier: boolean;
    isAddon: boolean;
  }>;
}

/**
 * Options for initializing the proposal builder
 */
export interface ProposalBuilderOptions {
  projectType: ProjectType;
  intakeData?: Record<string, unknown>;
  onComplete?: (selection: ProposalSelection) => void;
  onCancel?: () => void;
}

/**
 * Step in the proposal builder flow
 */
export type ProposalStep = 'tier-selection' | 'feature-customization' | 'maintenance' | 'summary';

/**
 * State of the proposal builder
 */
export interface ProposalBuilderState {
  currentStep: ProposalStep;
  selection: ProposalSelection;
  configuration: TierConfiguration | null;
  isLoading: boolean;
  error: string | null;
}
