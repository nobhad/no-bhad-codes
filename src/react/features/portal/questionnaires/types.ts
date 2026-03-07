/**
 * Portal Questionnaires Types
 * Types for client-facing questionnaire components
 */

import type { PortalViewProps } from '../types';

// ============================================================================
// QUESTION TYPES
// ============================================================================

export type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'file';

export type QuestionnaireStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';

// ============================================================================
// CONDITIONAL LOGIC
// ============================================================================

export interface ConditionalRule {
  /** ID of the question this condition depends on */
  questionId: string;
  /** Operator for comparison */
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  /** Value to compare against */
  value: string | number | string[];
}

// ============================================================================
// QUESTION DEFINITION
// ============================================================================

export interface PortalQuestion {
  id: string;
  /** Question text displayed to user */
  text: string;
  /** Type of input to render */
  type: QuestionType;
  /** Whether the question is required */
  required: boolean;
  /** Placeholder text for input */
  placeholder?: string;
  /** Help text displayed below the input */
  helpText?: string;
  /** Options for select/multiselect types */
  options?: Array<{ value: string; label: string }>;
  /** Min value for number type */
  min?: number;
  /** Max value for number type */
  max?: number;
  /** Accepted file types for file type (e.g., ".pdf,.jpg,.png") */
  acceptedFileTypes?: string;
  /** Max file size in bytes */
  maxFileSize?: number;
  /** Conditional visibility rules */
  conditionalRules?: ConditionalRule[];
  /** Order of the question */
  order: number;
}

// ============================================================================
// QUESTIONNAIRE DEFINITION
// ============================================================================

export interface PortalQuestionnaire {
  id: number;
  title: string;
  description?: string;
  questions: PortalQuestion[];
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// ANSWER AND RESPONSE
// ============================================================================

export interface QuestionAnswer {
  questionId: string;
  value: string | number | string[] | null;
  /** For file uploads, store file metadata */
  fileMetadata?: {
    filename: string;
    fileSize: number;
    fileType: string;
    uploadedAt: string;
  };
}

export interface PortalQuestionnaireResponse {
  id: number;
  questionnaire_id: number;
  questionnaire: PortalQuestionnaire;
  status: QuestionnaireStatus;
  answers: QuestionAnswer[];
  progress: number;
  submitted_at?: string;
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

export const QUESTIONNAIRE_STATUS_CONFIG: Record<
  QuestionnaireStatus,
  { label: string; variant: string }
> = {
  pending: { label: 'Not Started', variant: 'inactive' },
  in_progress: { label: 'In Progress', variant: 'active' },
  submitted: { label: 'Submitted', variant: 'completed' },
  approved: { label: 'Approved', variant: 'completed' },
  rejected: { label: 'Needs Revision', variant: 'cancelled' }
};

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface PortalQuestionnairesProps extends PortalViewProps {}

export interface QuestionnaireFormProps extends PortalViewProps {
  /** The questionnaire response to render */
  response: PortalQuestionnaireResponse;
  /** Callback when form is submitted successfully */
  onSubmitSuccess?: () => void;
  /** Callback to go back to list view */
  onBack?: () => void;
}
