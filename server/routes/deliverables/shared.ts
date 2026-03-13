/**
 * ===============================================
 * DELIVERABLES — SHARED
 * ===============================================
 * Validation schemas, constants, and helper functions
 * used by all deliverable sub-routers.
 */

import type { ValidationSchema } from '../../middleware/validation.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { isUserAdmin } from '../../utils/access-control.js';
import { getDatabase } from '../../database/init.js';

// =====================================================
// CONSTANTS
// =====================================================

const DELIVERABLE_TITLE_MAX_LENGTH = 200;
const DELIVERABLE_DESCRIPTION_MAX_LENGTH = 5000;
const FILE_NAME_MAX_LENGTH = 255;
const FILE_PATH_MAX_LENGTH = 500;
const FILE_TYPE_MAX_LENGTH = 100;
const COMMENT_TEXT_MAX_LENGTH = 5000;
const ELEMENT_NAME_MAX_LENGTH = 200;
const REVIEW_FEEDBACK_MAX_LENGTH = 10000;
const CHANGE_NOTES_MAX_LENGTH = 2000;
const REVISION_REASON_MAX_LENGTH = 5000;

export const DELIVERABLE_TYPE_VALUES = [
  'mockup', 'wireframe', 'prototype', 'design', 'logo',
  'icon', 'illustration', 'document', 'code', 'other'
];
export const APPROVAL_STATUS_VALUES = ['pending', 'approved', 'revision_needed'];
export const REVIEW_DECISION_VALUES = ['approved', 'revision_needed', 'rejected'];

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

export const DeliverableValidationSchemas = {
  create: {
    projectId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    title: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: DELIVERABLE_TITLE_MAX_LENGTH }
    ],
    type: [
      { type: 'required' as const },
      { type: 'string' as const, allowedValues: DELIVERABLE_TYPE_VALUES }
    ],
    createdById: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    description: { type: 'string' as const, maxLength: DELIVERABLE_DESCRIPTION_MAX_LENGTH },
    tags: { type: 'array' as const, maxLength: 20 },
    reviewDeadline: { type: 'string' as const, maxLength: 30 },
    roundNumber: { type: 'number' as const, min: 1, max: 100 }
  } as ValidationSchema,

  update: {
    title: { type: 'string' as const, minLength: 1, maxLength: DELIVERABLE_TITLE_MAX_LENGTH },
    description: { type: 'string' as const, maxLength: DELIVERABLE_DESCRIPTION_MAX_LENGTH },
    type: { type: 'string' as const, allowedValues: DELIVERABLE_TYPE_VALUES },
    status: {
      type: 'string' as const,
      allowedValues: ['draft', 'in_review', 'revision_needed', 'approved', 'locked']
    }
  } as ValidationSchema,

  uploadVersion: {
    filePath: [
      { type: 'required' as const },
      { type: 'string' as const, maxLength: FILE_PATH_MAX_LENGTH }
    ],
    fileName: [
      { type: 'required' as const },
      { type: 'string' as const, maxLength: FILE_NAME_MAX_LENGTH }
    ],
    uploadedById: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    fileSize: { type: 'number' as const, min: 0 },
    fileType: { type: 'string' as const, maxLength: FILE_TYPE_MAX_LENGTH },
    changeNotes: { type: 'string' as const, maxLength: CHANGE_NOTES_MAX_LENGTH }
  } as ValidationSchema,

  addComment: {
    authorId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    text: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: COMMENT_TEXT_MAX_LENGTH }
    ],
    x: { type: 'number' as const },
    y: { type: 'number' as const },
    annotationType: { type: 'string' as const, maxLength: 50 },
    elementId: { type: 'string' as const, maxLength: 50 }
  } as ValidationSchema,

  createElement: {
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: ELEMENT_NAME_MAX_LENGTH }
    ],
    description: { type: 'string' as const, maxLength: DELIVERABLE_DESCRIPTION_MAX_LENGTH }
  } as ValidationSchema,

  updateElementApproval: {
    status: [
      { type: 'required' as const },
      { type: 'string' as const, allowedValues: APPROVAL_STATUS_VALUES }
    ]
  } as ValidationSchema,

  createReview: {
    reviewerId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    decision: [
      { type: 'required' as const },
      { type: 'string' as const, allowedValues: REVIEW_DECISION_VALUES }
    ],
    feedback: { type: 'string' as const, maxLength: REVIEW_FEEDBACK_MAX_LENGTH },
    elementsReviewed: { type: 'array' as const, maxLength: 100 }
  } as ValidationSchema,

  requestRevision: {
    reason: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: REVISION_REASON_MAX_LENGTH }
    ],
    reviewedById: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ]
  } as ValidationSchema,

  lockDeliverable: {
    reviewedById: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ]
  } as ValidationSchema
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check if user can access a deliverable
 */
export async function canAccessDeliverable(
  req: AuthenticatedRequest,
  deliverableId: number
): Promise<boolean> {
  if (await isUserAdmin(req)) return true;
  const db = getDatabase();
  const row = await db.get(
    `SELECT d.project_id FROM deliverables d
     JOIN projects p ON d.project_id = p.id
     WHERE d.id = ? AND p.client_id = ? AND d.deleted_at IS NULL`,
    [deliverableId, req.user?.id]
  );
  return !!row;
}
