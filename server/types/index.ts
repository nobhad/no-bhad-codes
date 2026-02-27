/**
 * ===============================================
 * TYPE DEFINITIONS INDEX
 * ===============================================
 * @file server/types/index.ts
 *
 * Re-exports all type definitions for easy imports.
 *
 * Usage:
 *   import { JWTAuthRequest, InvoiceStatus, DatabaseRow } from '../types/index.js';
 */

// Request types (authentication, user context)
export * from './request.js';

// Database types (row definitions, query results)
// Note: InvoiceStatus and InvoiceRow are defined in both database.ts and invoice-types.ts
// We export the invoice-types.ts versions as they are the canonical invoice types
export {
  // Base types
  type BaseEntity,
  type SoftDeletableEntity,
  type DatabaseRow,
  // Lead types
  type LeadStatus,
  type LeadRow,
  type LeadInsert,
  type LeadUpdate,
  // Client types
  type ClientStatus,
  type ClientRow,
  type ClientInsert,
  type ClientUpdate,
  // Contact submission types
  type ContactStatus,
  type ContactSubmissionRow,
  type ContactSubmissionInsert,
  type ContactSubmissionUpdate,
  // Project types
  type ProjectStatus,
  type ProjectRow,
  type ProjectWithClientRow,
  type ProjectInsert,
  type ProjectUpdate,
  type ProjectMilestoneRow,
  type ProjectMilestoneInsert,
  type ProjectMilestoneUpdate,
  type ProjectFileRow,
  type ProjectFileInsert,
  // Message types
  type ThreadStatus,
  type SenderType,
  type MessageThreadRow,
  type MessageThreadWithClientRow,
  type MessageThreadInsert,
  type MessageThreadUpdate,
  type MessageRow,
  type MessageInsert,
  type MessageUpdate,
  // Invoice database types (excluding InvoiceStatus and InvoiceRow - use invoice-types.ts versions)
  type InvoiceInsert,
  type InvoiceUpdate,
  type InvoiceLineItemRow,
  type InvoiceLineItemInsert,
  // Admin/Session types
  type AdminUserRow,
  type SessionRow,
  type SessionInsert,
  // Audit types
  type AuditLogRow,
  type AuditLogInsert,
  // Utility types
  type PaginatedResult,
  type QueryExecutionResult,
  type InsertResult,
  type ModifyResult,
  // Stats types
  type LeadStats,
  type ProjectStats,
  type ClientStats,
  type ContactStats,
  type MessageStats,
  // Helper types
  type PartialWithId,
  type InsertFields
} from './database.js';

// Invoice-specific types (canonical invoice definitions)
export * from './invoice-types.js';
