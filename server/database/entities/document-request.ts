/**
 * ===============================================
 * DOCUMENT REQUEST ENTITY SCHEMAS
 * ===============================================
 * @file server/database/entities/document-request.ts
 *
 * Entity schemas and mappers for document requests, templates, and history.
 */

import { defineSchema, createMapper } from '../entity-mapper.js';
import type { DatabaseRow } from '../init.js';
import type { DocumentRequestStatus, PriorityLevel } from '../../config/constants.js';

// =====================================================
// TYPES
// =====================================================

export type DocumentType =
  | 'general'
  | 'contract'
  | 'invoice'
  | 'asset'
  | 'source'
  | 'deliverable'
  | 'identification'
  | 'other';

export type TemplateCategory = 'general' | 'brand_assets' | 'content' | 'legal' | 'technical';

export interface DocumentRequest {
  id: number;
  clientId: number;
  projectId: number | null;
  requestedBy: string;
  title: string;
  description: string | null;
  documentType: DocumentType;
  priority: PriorityLevel;
  status: DocumentRequestStatus;
  dueDate: string | null;
  fileId: number | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  approvedFileId: number | null;
  isRequired: boolean;
  reminderSentAt: string | null;
  reminderCount: number;
  createdAt: string;
  updatedAt: string;
  // Joined
  clientName?: string;
  projectName?: string;
  fileName?: string;
}

export interface DocumentRequestTemplate {
  id: number;
  name: string;
  title: string;
  description: string | null;
  documentType: DocumentType;
  isRequired: boolean;
  daysUntilDue: number;
  category: TemplateCategory;
  projectType: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRequestHistory {
  id: number;
  requestId: number;
  action: string;
  oldStatus: string | null;
  newStatus: string | null;
  actorEmail: string;
  actorType: 'admin' | 'client' | 'system';
  notes: string | null;
  createdAt: string;
}

// =====================================================
// ROW TYPES
// =====================================================

export interface DocumentRequestRow extends DatabaseRow {
  id: number;
  client_id: number;
  project_id: number | null;
  requested_by: string;
  title: string;
  description: string | null;
  document_type: string;
  priority: string;
  status: string;
  due_date: string | null;
  file_id: number | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  rejection_reason: string | null;
  approved_file_id: number | null;
  is_required: number;
  reminder_sent_at: string | null;
  reminder_count: number;
  created_at: string;
  updated_at: string;
  client_name?: string;
  project_name?: string;
  file_name?: string;
}

export interface DocumentRequestTemplateRow extends DatabaseRow {
  id: number;
  name: string;
  title: string;
  description: string | null;
  document_type: string;
  is_required: number;
  days_until_due: number;
  category: string;
  project_type: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRequestHistoryRow extends DatabaseRow {
  id: number;
  request_id: number;
  action: string;
  old_status: string | null;
  new_status: string | null;
  actor_email: string;
  actor_type: string;
  notes: string | null;
  created_at: string;
}

// =====================================================
// COLUMN CONSTANTS
// =====================================================

export const DOC_REQUEST_COLUMNS = `
  dr.id, dr.client_id, dr.project_id, dr.requested_by, dr.title, dr.description,
  dr.document_type, dr.priority, dr.status, dr.due_date, dr.file_id,
  dr.uploaded_by, dr.uploaded_at, dr.reviewed_by, dr.reviewed_at,
  dr.review_notes, dr.rejection_reason, dr.approved_file_id,
  dr.is_required, dr.reminder_sent_at, dr.reminder_count,
  dr.created_at, dr.updated_at
`.replace(/\s+/g, ' ').trim();

export const DOC_REQUEST_TEMPLATE_COLUMNS = `
  id, name, title, description, document_type, is_required, days_until_due,
  category, project_type, created_by, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

export const DOC_REQUEST_HISTORY_COLUMNS = `
  id, request_id, action, old_status, new_status, actor_email, actor_type, notes, created_at
`.replace(/\s+/g, ' ').trim();

// =====================================================
// SCHEMAS & MAPPERS
// =====================================================

export const documentRequestSchema = defineSchema<DocumentRequest>({
  id: 'number',
  clientId: { column: 'client_id', type: 'number' },
  projectId: { column: 'project_id', type: 'number?' },
  requestedBy: { column: 'requested_by', type: 'string' },
  title: 'string',
  description: 'string?',
  documentType: {
    column: 'document_type',
    type: 'string',
    transform: (v) => v as DocumentType
  },
  priority: {
    column: 'priority',
    type: 'string',
    transform: (v) => (v || 'normal') as PriorityLevel
  },
  status: {
    column: 'status',
    type: 'string',
    transform: (v) => v as DocumentRequestStatus
  },
  dueDate: { column: 'due_date', type: 'string?' },
  fileId: { column: 'file_id', type: 'number?' },
  uploadedBy: { column: 'uploaded_by', type: 'string?' },
  uploadedAt: { column: 'uploaded_at', type: 'string?' },
  reviewedBy: { column: 'reviewed_by', type: 'string?' },
  reviewedAt: { column: 'reviewed_at', type: 'string?' },
  reviewNotes: { column: 'review_notes', type: 'string?' },
  rejectionReason: { column: 'rejection_reason', type: 'string?' },
  approvedFileId: { column: 'approved_file_id', type: 'number?' },
  isRequired: { column: 'is_required', type: 'boolean' },
  reminderSentAt: { column: 'reminder_sent_at', type: 'string?' },
  reminderCount: { column: 'reminder_count', type: 'number' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' },
  clientName: { column: 'client_name', type: 'string?' },
  projectName: { column: 'project_name', type: 'string?' },
  fileName: { column: 'file_name', type: 'string?' }
});

export const documentRequestTemplateSchema = defineSchema<DocumentRequestTemplate>({
  id: 'number',
  name: 'string',
  title: 'string',
  description: 'string?',
  documentType: { column: 'document_type', type: 'string', transform: (v) => v as DocumentType },
  isRequired: { column: 'is_required', type: 'boolean' },
  daysUntilDue: { column: 'days_until_due', type: 'number' },
  category: { column: 'category', type: 'string', transform: (v) => v as TemplateCategory },
  projectType: { column: 'project_type', type: 'string?' },
  createdBy: { column: 'created_by', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

export const documentRequestHistorySchema = defineSchema<DocumentRequestHistory>({
  id: 'number',
  requestId: { column: 'request_id', type: 'number' },
  action: 'string',
  oldStatus: { column: 'old_status', type: 'string?' },
  newStatus: { column: 'new_status', type: 'string?' },
  actorEmail: { column: 'actor_email', type: 'string' },
  actorType: { column: 'actor_type', type: 'string', transform: (v) => v as 'admin' | 'client' | 'system' },
  notes: 'string?',
  createdAt: { column: 'created_at', type: 'string' }
});

export const toDocumentRequest = createMapper<DocumentRequestRow, DocumentRequest>(documentRequestSchema);
export const toDocumentRequestTemplate = createMapper<DocumentRequestTemplateRow, DocumentRequestTemplate>(documentRequestTemplateSchema);
export const toDocumentRequestHistory = createMapper<DocumentRequestHistoryRow, DocumentRequestHistory>(documentRequestHistorySchema);
