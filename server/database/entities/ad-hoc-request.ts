/**
 * ===============================================
 * AD HOC REQUEST ENTITY SCHEMAS
 * ===============================================
 * @file server/database/entities/ad-hoc-request.ts
 *
 * Entity schemas and mappers for ad hoc requests.
 */

import { defineSchema, createMapper } from '../entity-mapper.js';
import type { DatabaseRow } from '../init.js';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export type AdHocRequestStatus =
  | 'submitted'
  | 'reviewing'
  | 'quoted'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'declined';

export type AdHocRequestType = 'feature' | 'change' | 'bug_fix' | 'enhancement' | 'support';

export type AdHocRequestPriority = 'low' | 'normal' | 'high' | 'urgent';

export type AdHocRequestUrgency = 'normal' | 'priority' | 'urgent' | 'emergency';

export interface AdHocRequest {
  id: number;
  projectId: number;
  clientId: number;
  title: string;
  description: string;
  status: AdHocRequestStatus;
  requestType: AdHocRequestType;
  priority: AdHocRequestPriority;
  urgency: AdHocRequestUrgency;
  estimatedHours: number | null;
  flatRate: number | null;
  hourlyRate: number | null;
  quotedPrice: number | null;
  attachmentFileId?: number | null;
  taskId?: number | null;
  convertedAt?: string | null;
  convertedBy?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  projectName?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

// =====================================================
// ROW TYPE DEFINITIONS
// =====================================================

export interface AdHocRequestRow extends DatabaseRow {
  id: number;
  project_id: number;
  client_id: number;
  title: string;
  description: string;
  status: string;
  request_type: string;
  priority: string;
  urgency: string;
  estimated_hours?: number | string;
  flat_rate?: number | string;
  hourly_rate?: number | string;
  quoted_price?: number | string;
  attachment_file_id?: number;
  task_id?: number;
  converted_at?: string;
  converted_by?: string;
  client_name?: string;
  client_email?: string;
  project_name?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  deleted_by?: string;
}

// =====================================================
// ENTITY SCHEMAS
// =====================================================

export const adHocRequestSchema = defineSchema<AdHocRequest>({
  id: 'number',
  projectId: { column: 'project_id', type: 'number' },
  clientId: { column: 'client_id', type: 'number' },
  title: 'string',
  description: 'string',
  status: {
    column: 'status',
    type: 'string',
    transform: (v) => v as AdHocRequestStatus
  },
  requestType: {
    column: 'request_type',
    type: 'string',
    transform: (v) => v as AdHocRequestType
  },
  priority: {
    column: 'priority',
    type: 'string',
    transform: (v) => v as AdHocRequestPriority
  },
  urgency: {
    column: 'urgency',
    type: 'string',
    transform: (v) => v as AdHocRequestUrgency
  },
  estimatedHours: { column: 'estimated_hours', type: 'float?', default: null },
  flatRate: { column: 'flat_rate', type: 'float?', default: null },
  hourlyRate: { column: 'hourly_rate', type: 'float?', default: null },
  quotedPrice: { column: 'quoted_price', type: 'float?', default: null },
  attachmentFileId: { column: 'attachment_file_id', type: 'number?', default: null },
  taskId: { column: 'task_id', type: 'number?', default: null },
  convertedAt: { column: 'converted_at', type: 'string?', default: null },
  convertedBy: { column: 'converted_by', type: 'string?', default: null },
  clientName: { column: 'client_name', type: 'string?', default: null },
  clientEmail: { column: 'client_email', type: 'string?', default: null },
  projectName: { column: 'project_name', type: 'string?', default: null },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' },
  deletedAt: { column: 'deleted_at', type: 'string?', default: null },
  deletedBy: { column: 'deleted_by', type: 'string?', default: null }
});

// =====================================================
// MAPPER FUNCTIONS
// =====================================================

export const toAdHocRequest = createMapper<AdHocRequestRow, AdHocRequest>(adHocRequestSchema);
