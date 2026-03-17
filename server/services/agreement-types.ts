/**
 * ===============================================
 * AGREEMENT TYPES
 * ===============================================
 * @file server/services/agreement-types.ts
 *
 * Type definitions for the unified project agreement flow.
 */

// ============================================
// Agreement Status
// ============================================

export type AgreementStatus = 'draft' | 'sent' | 'viewed' | 'in_progress' | 'completed' | 'cancelled' | 'expired';

// ============================================
// Step Types
// ============================================

export type AgreementStepType =
  | 'welcome'
  | 'proposal_review'
  | 'contract_sign'
  | 'deposit_payment'
  | 'questionnaire'
  | 'custom_message';

export type AgreementStepStatus = 'pending' | 'active' | 'completed' | 'skipped';

// ============================================
// DB Row Types
// ============================================

export interface AgreementRow {
  id: number;
  project_id: number;
  client_id: number;
  name: string;
  status: string;
  proposal_id: number | null;
  contract_id: number | null;
  questionnaire_id: number | null;
  steps_config: string | null;
  welcome_message: string | null;
  current_step: number;
  sent_at: string | null;
  viewed_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  reminder_sent_3d: number;
  reminder_sent_7d: number;
  created_at: string;
  updated_at: string;
}

export interface AgreementStepRow {
  id: number;
  agreement_id: number;
  step_type: string;
  step_order: number;
  status: string;
  entity_id: number | null;
  custom_title: string | null;
  custom_content: string | null;
  started_at: string | null;
  completed_at: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// API Types
// ============================================

export interface CreateAgreementParams {
  projectId: number;
  clientId: number;
  name?: string;
  proposalId?: number;
  contractId?: number;
  questionnaireId?: number;
  welcomeMessage?: string;
  steps: CreateAgreementStepParams[];
}

export interface CreateAgreementStepParams {
  stepType: AgreementStepType;
  entityId?: number;
  customTitle?: string;
  customContent?: string;
}

export interface CreateFromTemplateParams {
  projectId: number;
  clientId: number;
  templateType?: 'standard' | 'simple';
}

export interface EnrichedAgreement extends AgreementRow {
  steps: EnrichedAgreementStep[];
  project?: { name: string; status: string };
  client?: { name: string; email: string };
}

export interface EnrichedAgreementStep extends AgreementStepRow {
  entityData?: Record<string, unknown>;
}
