/**
 * ===============================================
 * PAYMENT SCHEDULE ROUTES - SHARED
 * ===============================================
 * @file server/routes/payment-schedules/shared.ts
 *
 * Validation schemas and constants shared across payment schedule sub-routers.
 */

import { ValidationSchema } from '../../middleware/validation.js';
import { PAYMENT_INSTALLMENT_STATUSES, PAYMENT_METHODS } from '../../config/constants.js';

// =====================================================
// CONSTANTS (derived from SSOT)
// =====================================================

const AMOUNT_MAX = 1000000;
const LABEL_MAX_LENGTH = 200;
const NOTES_MAX_LENGTH = 2000;
const REFERENCE_MAX_LENGTH = 500;
const BULK_DELETE_MAX_IDS = 100;

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

export const PaymentScheduleValidationSchemas = {
  createSchedule: {
    project_id: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    client_id: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ]
  } as ValidationSchema,

  createInstallment: {
    amount: [
      { type: 'required' as const },
      { type: 'number' as const, min: 0.01, max: AMOUNT_MAX }
    ],
    due_date: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 10, maxLength: 10 }
    ],
    label: {
      type: 'string' as const,
      maxLength: LABEL_MAX_LENGTH
    },
    notes: {
      type: 'string' as const,
      maxLength: NOTES_MAX_LENGTH
    }
  } as ValidationSchema,

  markPaid: {
    payment_method: {
      type: 'string' as const,
      allowedValues: [...PAYMENT_METHODS]
    },
    payment_reference: {
      type: 'string' as const,
      maxLength: REFERENCE_MAX_LENGTH
    }
  } as ValidationSchema,

  updateInstallment: {
    label: {
      type: 'string' as const,
      maxLength: LABEL_MAX_LENGTH
    },
    amount: {
      type: 'number' as const,
      min: 0.01,
      max: AMOUNT_MAX
    },
    status: {
      type: 'string' as const,
      allowedValues: [...PAYMENT_INSTALLMENT_STATUSES]
    },
    notes: {
      type: 'string' as const,
      maxLength: NOTES_MAX_LENGTH
    }
  } as ValidationSchema,

  bulkDelete: {
    ids: [
      { type: 'required' as const },
      { type: 'array' as const, minLength: 1, maxLength: BULK_DELETE_MAX_IDS }
    ]
  } as ValidationSchema
};
