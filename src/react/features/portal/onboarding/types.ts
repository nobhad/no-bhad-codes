/**
 * Onboarding Wizard Types
 * Types for the client portal onboarding wizard
 */

import type { PortalViewProps } from '../types';

// ============================================================================
// STEP TYPES
// ============================================================================

export type OnboardingStep =
  | 'basic-info'
  | 'project-overview'
  | 'requirements'
  | 'assets'
  | 'confirmation';

export interface StepConfig {
  id: OnboardingStep;
  title: string;
  description: string;
  number: number;
}

export const ONBOARDING_STEPS: StepConfig[] = [
  {
    id: 'basic-info',
    title: 'Basic Info',
    description: 'Contact and company details',
    number: 1
  },
  {
    id: 'project-overview',
    title: 'Project Overview',
    description: 'Project goals and timeline',
    number: 2
  },
  {
    id: 'requirements',
    title: 'Requirements',
    description: 'Technical and design requirements',
    number: 3
  },
  {
    id: 'assets',
    title: 'Assets',
    description: 'Upload files and resources',
    number: 4
  },
  {
    id: 'confirmation',
    title: 'Confirmation',
    description: 'Review and submit',
    number: 5
  }
];

// ============================================================================
// FORM DATA TYPES
// ============================================================================

export interface BasicInfoData {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string;
  companyWebsite: string;
  timezone: string;
  preferredContactMethod: 'email' | 'phone' | 'either';
}

export interface ProjectOverviewData {
  projectName: string;
  projectType: string;
  projectDescription: string;
  targetLaunchDate: string;
  budget: string;
  targetAudience: string;
}

export interface RequirementsData {
  designStyle: string;
  colorPreferences: string;
  brandGuidelines: boolean;
  contentReady: boolean;
  features: string[];
  integrations: string;
  additionalNotes: string;
}

export interface AssetData {
  files: UploadedFile[];
  logoProvided: boolean;
  existingAssets: string;
  contentAccess: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  url?: string;
}

export interface OnboardingFormData {
  basicInfo: BasicInfoData;
  projectOverview: ProjectOverviewData;
  requirements: RequirementsData;
  assets: AssetData;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface OnboardingProgress {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  formData: Partial<OnboardingFormData>;
  lastSavedAt?: string;
  isComplete: boolean;
}

export interface OnboardingApiResponse {
  success: boolean;
  data?: OnboardingProgress;
  error?: string;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface StepValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// COMPONENT PROPS TYPES
// ============================================================================

export interface OnboardingWizardProps extends PortalViewProps {
  onComplete?: () => void;
}

export interface StepProps {
  data: Partial<OnboardingFormData>;
  onUpdate: (stepData: Partial<OnboardingFormData>) => void;
  errors: ValidationError[];
  isSubmitting?: boolean;
}

export interface StepIndicatorProps {
  steps: StepConfig[];
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  onStepClick?: (step: OnboardingStep) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DRAFT_STORAGE_KEY = 'onboarding_draft';
export const DRAFT_SAVE_INTERVAL = 5000; // 5 seconds

export const PROJECT_TYPES = [
  'Website Design',
  'Web Application',
  'E-commerce',
  'Landing Page',
  'Redesign',
  'Brand Identity',
  'Other'
] as const;

export const BUDGET_RANGES = [
  'Under $5,000',
  '$5,000 - $10,000',
  '$10,000 - $25,000',
  '$25,000 - $50,000',
  '$50,000+',
  'Not sure yet'
] as const;

export const DESIGN_STYLES = [
  'Modern & Minimal',
  'Bold & Vibrant',
  'Corporate & Professional',
  'Creative & Artistic',
  'Playful & Fun',
  'Luxury & Elegant',
  'Not sure yet'
] as const;

export const FEATURE_OPTIONS = [
  'User Authentication',
  'Payment Processing',
  'Content Management (CMS)',
  'Blog',
  'Contact Forms',
  'Newsletter Signup',
  'Social Media Integration',
  'Analytics & Tracking',
  'Search Functionality',
  'Multi-language Support',
  'File Uploads',
  'Admin Dashboard'
] as const;

export const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' }
] as const;
