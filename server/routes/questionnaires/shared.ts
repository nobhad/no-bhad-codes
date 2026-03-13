/**
 * ===============================================
 * QUESTIONNAIRE ROUTES — SHARED
 * ===============================================
 * @file server/routes/questionnaires/shared.ts
 *
 * Constants and validation schemas shared across questionnaire sub-routers
 */

import { ValidationSchema } from '../../middleware/validation.js';

// =====================================================
// CONSTANTS
// =====================================================

const QUESTIONNAIRE_NAME_MAX_LENGTH = 200;
const QUESTIONNAIRE_DESCRIPTION_MAX_LENGTH = 5000;
const QUESTIONS_MAX_COUNT = 100;
const PROJECT_TYPE_MAX_LENGTH = 50;
const DISPLAY_ORDER_MAX = 9999;
const BULK_DELETE_MAX_IDS = 100;

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

export const QuestionnaireValidationSchemas = {
  create: {
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: QUESTIONNAIRE_NAME_MAX_LENGTH }
    ],
    questions: [
      { type: 'required' as const },
      { type: 'array' as const, minLength: 1, maxLength: QUESTIONS_MAX_COUNT }
    ],
    description: { type: 'string' as const, maxLength: QUESTIONNAIRE_DESCRIPTION_MAX_LENGTH },
    project_type: { type: 'string' as const, maxLength: PROJECT_TYPE_MAX_LENGTH },
    is_active: { type: 'boolean' as const },
    auto_send_on_project_create: { type: 'boolean' as const },
    display_order: { type: 'number' as const, min: 0, max: DISPLAY_ORDER_MAX }
  } as ValidationSchema,

  update: {
    name: { type: 'string' as const, minLength: 1, maxLength: QUESTIONNAIRE_NAME_MAX_LENGTH },
    description: { type: 'string' as const, maxLength: QUESTIONNAIRE_DESCRIPTION_MAX_LENGTH },
    questions: { type: 'array' as const, maxLength: QUESTIONS_MAX_COUNT },
    project_type: { type: 'string' as const, maxLength: PROJECT_TYPE_MAX_LENGTH },
    is_active: { type: 'boolean' as const },
    auto_send_on_project_create: { type: 'boolean' as const },
    display_order: { type: 'number' as const, min: 0, max: DISPLAY_ORDER_MAX }
  } as ValidationSchema,

  bulkDelete: {
    questionnaireIds: [
      { type: 'required' as const },
      { type: 'array' as const, minLength: 1, maxLength: BULK_DELETE_MAX_IDS }
    ]
  } as ValidationSchema,

  send: {
    client_id: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    project_id: { type: 'number' as const, min: 1 },
    due_date: { type: 'string' as const, maxLength: 30 }
  } as ValidationSchema,

  saveProgress: {
    answers: { type: 'object' as const }
  } as ValidationSchema,

  submitResponse: {
    answers: { type: 'object' as const }
  } as ValidationSchema
};
