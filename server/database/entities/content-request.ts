/**
 * ===============================================
 * CONTENT REQUEST ENTITY SCHEMAS
 * ===============================================
 * @file server/database/entities/content-request.ts
 *
 * Entity schemas and mappers for content request checklists and items.
 */

import { defineSchema, createMapper } from '../entity-mapper.js';
import type { DatabaseRow } from '../init.js';
import type {
  ContentChecklistStatus,
  ContentRequestItemStatus,
  ContentType,
  ContentCategory
} from '../../config/constants.js';

// =====================================================
// TYPES
// =====================================================

export interface ContentChecklist {
  id: number;
  projectId: number;
  clientId: number;
  name: string;
  description: string | null;
  status: ContentChecklistStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  projectName?: string;
  clientName?: string;
  // Computed
  items?: ContentItem[];
  completionStats?: CompletionStats;
}

export interface ContentItem {
  id: number;
  checklistId: number;
  projectId: number;
  clientId: number;
  title: string;
  description: string | null;
  contentType: ContentType;
  category: ContentCategory;
  isRequired: boolean;
  dueDate: string | null;
  status: ContentRequestItemStatus;
  sortOrder: number;
  textContent: string | null;
  fileId: number | null;
  structuredData: Record<string, unknown> | null;
  adminNotes: string | null;
  reviewedAt: string | null;
  submittedAt: string | null;
  reminderSentAt: string | null;
  reminderCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContentRequestTemplate {
  id: number;
  name: string;
  description: string | null;
  items: ContentRequestTemplateItem[];
  projectType: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentRequestTemplateItem {
  title: string;
  description?: string;
  content_type: ContentType;
  category: ContentCategory;
  is_required: boolean;
  due_offset_days?: number;
}

export interface CompletionStats {
  total: number;
  pending: number;
  submitted: number;
  accepted: number;
  revisionNeeded: number;
  completionPercent: number;
}

// =====================================================
// ROW TYPES
// =====================================================

export interface ContentChecklistRow extends DatabaseRow {
  id: number;
  project_id: number;
  client_id: number;
  name: string;
  description: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  project_name?: string;
  client_name?: string;
}

export interface ContentItemRow extends DatabaseRow {
  id: number;
  checklist_id: number;
  project_id: number;
  client_id: number;
  title: string;
  description: string | null;
  content_type: string;
  category: string;
  is_required: number;
  due_date: string | null;
  status: string;
  sort_order: number;
  text_content: string | null;
  file_id: number | null;
  structured_data: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  reminder_sent_at: string | null;
  reminder_count: number;
  created_at: string;
  updated_at: string;
}

export interface ContentRequestTemplateRow extends DatabaseRow {
  id: number;
  name: string;
  description: string | null;
  items: string;
  project_type: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// =====================================================
// COLUMN CONSTANTS
// =====================================================

export const CHECKLIST_COLUMNS = `
  crc.id, crc.project_id, crc.client_id, crc.name, crc.description,
  crc.status, crc.completed_at, crc.created_at, crc.updated_at
`.replace(/\s+/g, ' ').trim();

export const CHECKLIST_COLUMNS_WITH_JOINS = `
  ${CHECKLIST_COLUMNS},
  p.project_name, c.contact_name AS client_name
`.replace(/\s+/g, ' ').trim();

export const ITEM_COLUMNS = `
  cri.id, cri.checklist_id, cri.project_id, cri.client_id,
  cri.title, cri.description, cri.content_type, cri.category,
  cri.is_required, cri.due_date, cri.status, cri.sort_order,
  cri.text_content, cri.file_id, cri.structured_data,
  cri.admin_notes, cri.reviewed_at, cri.submitted_at,
  cri.reminder_sent_at, cri.reminder_count,
  cri.created_at, cri.updated_at
`.replace(/\s+/g, ' ').trim();

export const TEMPLATE_COLUMNS = `
  id, name, description, items, project_type, is_active, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

// =====================================================
// SCHEMAS & MAPPERS
// =====================================================

export const contentChecklistSchema = defineSchema<Omit<ContentChecklist, 'items' | 'completionStats'>>({
  id: 'number',
  projectId: { column: 'project_id', type: 'number' },
  clientId: { column: 'client_id', type: 'number' },
  name: 'string',
  description: 'string?',
  status: {
    column: 'status',
    type: 'string',
    transform: (v) => v as ContentChecklistStatus
  },
  completedAt: { column: 'completed_at', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' },
  projectName: { column: 'project_name', type: 'string?' },
  clientName: { column: 'client_name', type: 'string?' }
});

export const contentItemSchema = defineSchema<ContentItem>({
  id: 'number',
  checklistId: { column: 'checklist_id', type: 'number' },
  projectId: { column: 'project_id', type: 'number' },
  clientId: { column: 'client_id', type: 'number' },
  title: 'string',
  description: 'string?',
  contentType: {
    column: 'content_type',
    type: 'string',
    transform: (v) => v as ContentType
  },
  category: {
    column: 'category',
    type: 'string',
    transform: (v) => v as ContentCategory
  },
  isRequired: { column: 'is_required', type: 'boolean' },
  dueDate: { column: 'due_date', type: 'string?' },
  status: {
    column: 'status',
    type: 'string',
    transform: (v) => v as ContentRequestItemStatus
  },
  sortOrder: { column: 'sort_order', type: 'number' },
  textContent: { column: 'text_content', type: 'string?' },
  fileId: { column: 'file_id', type: 'number?' },
  structuredData: {
    column: 'structured_data',
    type: 'string?',
    transform: (v) => {
      if (!v) return null;
      try { return JSON.parse(v as string); } catch { return null; }
    }
  },
  adminNotes: { column: 'admin_notes', type: 'string?' },
  reviewedAt: { column: 'reviewed_at', type: 'string?' },
  submittedAt: { column: 'submitted_at', type: 'string?' },
  reminderSentAt: { column: 'reminder_sent_at', type: 'string?' },
  reminderCount: { column: 'reminder_count', type: 'number' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

export const contentRequestTemplateSchema = defineSchema<ContentRequestTemplate>({
  id: 'number',
  name: 'string',
  description: 'string?',
  items: {
    column: 'items',
    type: 'string',
    transform: (v) => {
      try { return JSON.parse(v as string); } catch { return []; }
    }
  },
  projectType: { column: 'project_type', type: 'string?' },
  isActive: { column: 'is_active', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

export const toContentChecklist = createMapper<ContentChecklistRow, ContentChecklist>(contentChecklistSchema);
export const toContentItem = createMapper<ContentItemRow, ContentItem>(contentItemSchema);
export const toContentRequestTemplate = createMapper<ContentRequestTemplateRow, ContentRequestTemplate>(contentRequestTemplateSchema);
