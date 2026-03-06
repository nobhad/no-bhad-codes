/**
 * ===============================================
 * PORTAL QUESTIONNAIRES - SHARED TYPES
 * ===============================================
 * @file src/features/client/modules/portal-questionnaires-types.ts
 *
 * Type definitions shared between questionnaire modules.
 */

export type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'file';
export type ResponseStatus = 'pending' | 'in_progress' | 'completed';

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  conditionalOn?: {
    questionId: string;
    value: string | string[];
  };
}

export interface Questionnaire {
  id: number;
  name: string;
  description?: string;
  questions: Question[];
}

export interface QuestionnaireResponse {
  id: number;
  questionnaire_id: number;
  project_id?: number;
  answers: Record<string, unknown>;
  status: ResponseStatus;
  started_at?: string;
  completed_at?: string;
  due_date?: string;
  created_at: string;
  questionnaire_name?: string;
  project_name?: string;
}

export interface QuestionnaireStats {
  pending: number;
  in_progress: number;
  completed: number;
  total: number;
}
