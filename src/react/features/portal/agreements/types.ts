/**
 * ===============================================
 * AGREEMENT TYPES
 * ===============================================
 * @file src/react/features/portal/agreements/types.ts
 */

export type AgreementStatus = 'draft' | 'sent' | 'viewed' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
export type StepType = 'welcome' | 'proposal_review' | 'contract_sign' | 'deposit_payment' | 'questionnaire' | 'custom_message';
export type StepStatus = 'pending' | 'active' | 'completed' | 'skipped';

export interface AgreementStep {
  id: number;
  agreementId: number;
  stepType: StepType;
  stepOrder: number;
  status: StepStatus;
  entityId: number | null;
  customTitle: string | null;
  customContent: string | null;
  startedAt: string | null;
  completedAt: string | null;
  entityData?: Record<string, unknown>;
}

export interface Agreement {
  id: number;
  projectId: number;
  clientId: number;
  name: string;
  status: AgreementStatus;
  proposalId: number | null;
  contractId: number | null;
  questionnaireId: number | null;
  welcomeMessage: string | null;
  currentStep: number;
  sentAt: string | null;
  viewedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  steps: AgreementStep[];
  project?: { name: string; status: string };
  client?: { name: string; email: string };
}

export interface AgreementFlowProps {
  agreementId: number;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error') => void;
  onComplete?: () => void;
}

export interface AgreementsListProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

/** Map step types to display labels */
export const STEP_TYPE_LABELS: Record<StepType, string> = {
  welcome: 'Welcome',
  proposal_review: 'Review Proposal',
  contract_sign: 'Sign Contract',
  deposit_payment: 'Pay Deposit',
  questionnaire: 'Complete Questionnaire',
  custom_message: 'Information'
};
