/**
 * ===============================================
 * QUESTIONNAIRE ENTITY SCHEMAS
 * ===============================================
 * @file server/database/entities/questionnaire.ts
 *
 * Entity schemas and mappers for questionnaires and responses.
 * Types are re-exported from the service for backward compatibility.
 */

import { defineSchema, createMapper } from '../entity-mapper.js';
import type { DatabaseRow } from '../init.js';
import type { QuestionnaireResponseStatus } from '../../config/constants.js';

// =====================================================
// TYPES
// =====================================================

export type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'file';

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  required?: boolean;
  options?: string[];
  conditionalOn?: {
    questionId: string;
    value: string | string[];
  };
  placeholder?: string;
  helpText?: string;
}

export interface Questionnaire {
  id: number;
  name: string;
  description?: string;
  projectType?: string;
  questions: Question[];
  isActive: boolean;
  autoSendOnProjectCreate: boolean;
  displayOrder: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionnaireResponse {
  id: number;
  questionnaireId: number;
  clientId: number;
  projectId?: number;
  answers: Record<string, unknown>;
  status: QuestionnaireResponseStatus;
  startedAt?: string;
  completedAt?: string;
  dueDate?: string;
  reminderCount: number;
  reminderSentAt?: string;
  exportedFileId?: number;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  questionnaireName?: string;
  questionnaireDescription?: string;
  clientName?: string;
  projectName?: string;
}

// =====================================================
// ROW TYPES
// =====================================================

export interface QuestionnaireRow extends DatabaseRow {
  id: number;
  name: string;
  description: string | null;
  project_type: string | null;
  questions: string;
  is_active: number;
  auto_send_on_project_create: number;
  display_order: number;
  created_by: string | null;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireResponseRow extends DatabaseRow {
  id: number;
  questionnaire_id: number;
  client_id: number;
  project_id: number | null;
  answers: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  due_date: string | null;
  reminder_count: number;
  reminder_sent_at: string | null;
  exported_file_id: number | null;
  created_at: string;
  updated_at: string;
  // Joined
  questionnaire_name?: string;
  questionnaire_description?: string;
  client_name?: string;
  project_name?: string;
}

// =====================================================
// COLUMN CONSTANTS
// =====================================================

export const QUESTIONNAIRE_COLUMNS = `
  id, name, description, project_type, questions, is_active, auto_send_on_project_create,
  display_order, created_by, created_by_user_id, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

export const QUESTIONNAIRE_RESPONSE_COLUMNS = `
  qr.id, qr.questionnaire_id, qr.client_id, qr.project_id, qr.answers,
  qr.status, qr.started_at, qr.completed_at, qr.due_date,
  qr.reminder_count, qr.reminder_sent_at, qr.exported_file_id,
  qr.created_at, qr.updated_at
`.replace(/\s+/g, ' ').trim();

// =====================================================
// SCHEMAS & MAPPERS
// =====================================================

export const questionnaireSchema = defineSchema<Questionnaire>({
  id: 'number',
  name: 'string',
  description: 'string?',
  projectType: { column: 'project_type', type: 'string?' },
  questions: { column: 'questions', type: 'json', default: [] },
  isActive: { column: 'is_active', type: 'boolean' },
  autoSendOnProjectCreate: { column: 'auto_send_on_project_create', type: 'boolean' },
  displayOrder: { column: 'display_order', type: 'number' },
  createdBy: { column: 'created_by', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

export const questionnaireResponseSchema = defineSchema<QuestionnaireResponse>({
  id: 'number',
  questionnaireId: { column: 'questionnaire_id', type: 'number' },
  clientId: { column: 'client_id', type: 'number' },
  projectId: { column: 'project_id', type: 'number?' },
  answers: { column: 'answers', type: 'json', default: {} },
  status: {
    column: 'status',
    type: 'string',
    transform: (v) => v as QuestionnaireResponseStatus
  },
  startedAt: { column: 'started_at', type: 'string?' },
  completedAt: { column: 'completed_at', type: 'string?' },
  dueDate: { column: 'due_date', type: 'string?' },
  reminderCount: { column: 'reminder_count', type: 'number' },
  reminderSentAt: { column: 'reminder_sent_at', type: 'string?' },
  exportedFileId: { column: 'exported_file_id', type: 'number?' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' },
  questionnaireName: { column: 'questionnaire_name', type: 'string?' },
  questionnaireDescription: { column: 'questionnaire_description', type: 'string?' },
  clientName: { column: 'client_name', type: 'string?' },
  projectName: { column: 'project_name', type: 'string?' }
});

export const toQuestionnaire = createMapper<QuestionnaireRow, Questionnaire>(questionnaireSchema);
export const toQuestionnaireResponse = createMapper<QuestionnaireResponseRow, QuestionnaireResponse>(questionnaireResponseSchema);
