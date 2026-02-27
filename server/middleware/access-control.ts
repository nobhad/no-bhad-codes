/**
 * ===============================================
 * ACCESS CONTROL RE-EXPORTS
 * ===============================================
 * @file server/middleware/access-control.ts
 *
 * @deprecated Import from '../utils/access-control.js' instead.
 *
 * This file re-exports access control utilities for backwards compatibility.
 * The actual implementation is in server/utils/access-control.ts since these
 * are utility functions, not Express middleware.
 */

// Re-export all access control utilities for backwards compatibility
export {
  isUserAdmin,
  canAccessProject,
  canAccessInvoice,
  canAccessFile,
  canAccessFolder,
  canAccessTask,
  canAccessMilestone,
  canAccessChecklistItem,
  canAccessFileComment,
  canAccessThread,
  canAccessDocumentRequest,
  canAccessContract,
  canAccessProposal,
  getClientIdFromEntity,
} from '../utils/access-control.js';
