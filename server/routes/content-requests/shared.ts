/**
 * ===============================================
 * CONTENT REQUEST ROUTES - SHARED
 * ===============================================
 * @file server/routes/content-requests/shared.ts
 *
 * Validation schemas shared across content request sub-routers.
 * Status/type constants imported from SSOT (constants.ts).
 */

import { ValidationSchema } from '../../middleware/validation.js';
import {
  CONTENT_REQUEST_ITEM_STATUSES,
  CONTENT_TYPES,
  CONTENT_CATEGORIES,
  CONTENT_CHECKLIST_STATUSES
} from '../../config/constants.js';

// =====================================================
// CONSTANTS
// =====================================================

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 5000;
const TEXT_CONTENT_MAX_LENGTH = 50000;
const NOTES_MAX_LENGTH = 2000;
const NAME_MAX_LENGTH = 200;

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

export const ContentRequestValidationSchemas = {
  createChecklist: {
    project_id: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    client_id: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: NAME_MAX_LENGTH }
    ],
    description: {
      type: 'string' as const,
      maxLength: DESCRIPTION_MAX_LENGTH
    }
  } as ValidationSchema,

  createItem: {
    title: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: TITLE_MAX_LENGTH }
    ],
    content_type: [
      { type: 'required' as const },
      { type: 'string' as const, allowedValues: [...CONTENT_TYPES] }
    ],
    category: {
      type: 'string' as const,
      allowedValues: [...CONTENT_CATEGORIES]
    },
    description: {
      type: 'string' as const,
      maxLength: DESCRIPTION_MAX_LENGTH
    }
  } as ValidationSchema,

  submitText: {
    text: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: TEXT_CONTENT_MAX_LENGTH }
    ]
  } as ValidationSchema,

  submitUrl: {
    url: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: 2000 }
    ]
  } as ValidationSchema,

  acceptItem: {} as ValidationSchema,

  requestRevision: {
    notes: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: NOTES_MAX_LENGTH }
    ]
  } as ValidationSchema,

  updateChecklist: {
    name: {
      type: 'string' as const,
      maxLength: NAME_MAX_LENGTH
    },
    status: {
      type: 'string' as const,
      allowedValues: [...CONTENT_CHECKLIST_STATUSES]
    }
  } as ValidationSchema,

  updateItem: {
    title: {
      type: 'string' as const,
      maxLength: TITLE_MAX_LENGTH
    },
    status: {
      type: 'string' as const,
      allowedValues: [...CONTENT_REQUEST_ITEM_STATUSES]
    },
    admin_notes: {
      type: 'string' as const,
      maxLength: NOTES_MAX_LENGTH
    }
  } as ValidationSchema
};
