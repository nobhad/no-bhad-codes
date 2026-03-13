/**
 * ===============================================
 * DOCUMENT REQUEST ROUTES - SHARED
 * ===============================================
 * @file server/routes/document-requests/shared.ts
 *
 * Constants, validation schemas, and helpers shared across document request sub-routers
 */

import { ValidationSchema } from '../../middleware/validation.js';

// =====================================================
// CONSTANTS
// =====================================================

const DOC_REQUEST_TITLE_MAX_LENGTH = 200;
const DOC_REQUEST_DESCRIPTION_MAX_LENGTH = 5000;
const DOC_TYPE_MAX_LENGTH = 100;
const DOC_PRIORITY_VALUES = ['low', 'normal', 'high', 'urgent'];
const BULK_DELETE_MAX_IDS = 100;
const TEMPLATE_NAME_MAX_LENGTH = 200;
const MAX_TEMPLATE_IDS = 50;
const REJECTION_REASON_MAX_LENGTH = 2000;
const REVIEW_NOTES_MAX_LENGTH = 2000;
const DAYS_UNTIL_DUE_MAX = 365;

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

export const DocRequestValidationSchemas = {
  create: {
    client_id: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    title: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: DOC_REQUEST_TITLE_MAX_LENGTH }
    ],
    project_id: { type: 'number' as const, min: 1 },
    description: { type: 'string' as const, maxLength: DOC_REQUEST_DESCRIPTION_MAX_LENGTH },
    document_type: { type: 'string' as const, maxLength: DOC_TYPE_MAX_LENGTH },
    priority: { type: 'string' as const, allowedValues: DOC_PRIORITY_VALUES },
    due_date: { type: 'string' as const, maxLength: 30 },
    is_required: { type: 'boolean' as const }
  } as ValidationSchema,

  fromTemplates: {
    client_id: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    template_ids: [
      { type: 'required' as const },
      { type: 'array' as const, minLength: 1, maxLength: MAX_TEMPLATE_IDS }
    ],
    project_id: { type: 'number' as const, min: 1 }
  } as ValidationSchema,

  upload: {
    fileId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ]
  } as ValidationSchema,

  approve: {
    notes: { type: 'string' as const, maxLength: REVIEW_NOTES_MAX_LENGTH }
  } as ValidationSchema,

  reject: {
    reason: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: REJECTION_REASON_MAX_LENGTH }
    ]
  } as ValidationSchema,

  bulkDelete: {
    requestIds: [
      { type: 'required' as const },
      { type: 'array' as const, minLength: 1, maxLength: BULK_DELETE_MAX_IDS }
    ]
  } as ValidationSchema,

  createTemplate: {
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: TEMPLATE_NAME_MAX_LENGTH }
    ],
    title: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: DOC_REQUEST_TITLE_MAX_LENGTH }
    ],
    description: { type: 'string' as const, maxLength: DOC_REQUEST_DESCRIPTION_MAX_LENGTH },
    document_type: { type: 'string' as const, maxLength: DOC_TYPE_MAX_LENGTH },
    is_required: { type: 'boolean' as const },
    days_until_due: { type: 'number' as const, min: 1, max: DAYS_UNTIL_DUE_MAX }
  } as ValidationSchema,

  updateTemplate: {
    name: { type: 'string' as const, minLength: 1, maxLength: TEMPLATE_NAME_MAX_LENGTH },
    title: { type: 'string' as const, minLength: 1, maxLength: DOC_REQUEST_TITLE_MAX_LENGTH },
    description: { type: 'string' as const, maxLength: DOC_REQUEST_DESCRIPTION_MAX_LENGTH },
    document_type: { type: 'string' as const, maxLength: DOC_TYPE_MAX_LENGTH },
    is_required: { type: 'boolean' as const },
    days_until_due: { type: 'number' as const, min: 1, max: DAYS_UNTIL_DUE_MAX }
  } as ValidationSchema
};
