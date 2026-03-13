/**
 * ===============================================
 * CONTRACT ROUTE SHARED
 * ===============================================
 * @file server/routes/contracts/shared.ts
 *
 * Shared constants, validation schemas, and helpers for contract routes.
 */

import { ValidationSchema } from '../../middleware/validation.js';

// =====================================================
// CONSTANTS
// =====================================================

export const CONTRACT_CONTENT_MAX_LENGTH = 100000;
export const CONTRACT_NAME_MAX_LENGTH = 200;
export const CONTRACT_STATUS_VALUES = ['draft', 'sent', 'signed', 'expired', 'cancelled', 'active', 'renewed'];
export const TEMPLATE_TYPE_VALUES = ['service-agreement', 'nda', 'scope-of-work', 'maintenance', 'custom'];
export const BULK_DELETE_MAX_IDS = 100;

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

export const ContractValidationSchemas = {
  create: {
    projectId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    clientId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    content: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: CONTRACT_CONTENT_MAX_LENGTH }
    ],
    status: {
      type: 'string' as const,
      allowedValues: CONTRACT_STATUS_VALUES
    }
  } as ValidationSchema,

  update: {
    content: { type: 'string' as const, maxLength: CONTRACT_CONTENT_MAX_LENGTH },
    status: {
      type: 'string' as const,
      allowedValues: CONTRACT_STATUS_VALUES
    }
  } as ValidationSchema,

  fromTemplate: {
    templateId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    projectId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    clientId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    status: {
      type: 'string' as const,
      allowedValues: CONTRACT_STATUS_VALUES
    },
    expiresAt: { type: 'string' as const, maxLength: 30 }
  } as ValidationSchema,

  bulkDelete: {
    contractIds: [
      { type: 'required' as const },
      { type: 'array' as const, minLength: 1, maxLength: BULK_DELETE_MAX_IDS }
    ]
  } as ValidationSchema,

  createTemplate: {
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: CONTRACT_NAME_MAX_LENGTH }
    ],
    type: [
      { type: 'required' as const },
      { type: 'string' as const, allowedValues: TEMPLATE_TYPE_VALUES }
    ],
    content: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: CONTRACT_CONTENT_MAX_LENGTH }
    ]
  } as ValidationSchema,

  updateTemplate: {
    name: { type: 'string' as const, minLength: 1, maxLength: CONTRACT_NAME_MAX_LENGTH },
    type: { type: 'string' as const, allowedValues: TEMPLATE_TYPE_VALUES },
    content: { type: 'string' as const, maxLength: CONTRACT_CONTENT_MAX_LENGTH }
  } as ValidationSchema,

  amendment: {
    content: { type: 'string' as const, maxLength: CONTRACT_CONTENT_MAX_LENGTH }
  } as ValidationSchema
};
