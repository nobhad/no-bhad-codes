/**
 * ===============================================
 * ONBOARDING CHECKLIST TYPES
 * ===============================================
 * @file server/services/onboarding-checklist-types.ts
 *
 * Type definitions for post-agreement onboarding checklists.
 */

// ============================================
// Status Types
// ============================================

export type ChecklistStatus = 'active' | 'completed' | 'dismissed';
export type StepStatus = 'pending' | 'completed';

// ============================================
// DB Row Types
// ============================================

export interface OnboardingChecklistRow {
  id: number;
  project_id: number;
  client_id: number;
  status: string;
  welcome_text: string | null;
  created_at: string;
  completed_at: string | null;
  dismissed_at: string | null;
}

export interface OnboardingStepRow {
  id: number;
  checklist_id: number;
  step_type: string;
  label: string;
  description: string | null;
  step_order: number;
  status: string;
  entity_type: string | null;
  entity_id: number | null;
  auto_detect: number;
  navigate_tab: string | null;
  navigate_entity_id: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingTemplateRow {
  id: number;
  name: string;
  project_type: string | null;
  steps_config: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Template Step Config
// ============================================

export interface TemplateStepConfig {
  step_type: string;
  label: string;
  description?: string;
  auto_detect?: boolean;
  entity_type?: string;
  navigate_tab?: string;
}

// ============================================
// API Types
// ============================================

export interface CreateChecklistParams {
  projectId: number;
  clientId: number;
  templateId?: number;
  welcomeText?: string;
}

export interface ChecklistWithSteps extends OnboardingChecklistRow {
  steps: OnboardingStepRow[];
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
}
