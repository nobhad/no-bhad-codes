/**
 * ===============================================
 * CLIENT ENTITY SCHEMAS
 * ===============================================
 * @file server/database/entities/client.ts
 *
 * Entity schemas and mappers for client-related data types.
 */

import { defineSchema, createMapper } from '../entity-mapper.js';
import type { DatabaseRow } from '../init.js';
import type {
  ClientContact,
  ClientActivity,
  CustomField,
  CustomFieldValue,
  Tag,
  ClientNote
} from '../../services/client-service.js';

// =====================================================
// ROW TYPE DEFINITIONS
// =====================================================

export interface ContactRow extends DatabaseRow {
  id: number;
  client_id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  role: string;
  is_primary: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityRow extends DatabaseRow {
  id: number;
  client_id: number;
  activity_type: string;
  title: string;
  description?: string;
  metadata?: string;
  created_by?: string;
  created_at: string;
}

export interface CustomFieldRow extends DatabaseRow {
  id: number;
  field_name: string;
  field_label: string;
  field_type: string;
  options?: string;
  is_required: number;
  placeholder?: string;
  default_value?: string;
  display_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldValueRow extends DatabaseRow {
  id: number;
  client_id: number;
  field_id: number;
  field_name: string;
  field_label: string;
  field_type: string;
  field_value?: string;
  created_at: string;
  updated_at: string;
}

export interface TagRow extends DatabaseRow {
  id: number;
  name: string;
  color: string;
  description?: string;
  tag_type: string;
  created_at: string;
}

export interface ClientNoteRow extends DatabaseRow {
  id: number;
  client_id: number;
  author_user_id: number | null;
  author_name: string | null;
  content: string;
  is_pinned: number;
  created_at: string;
  updated_at: string;
}

// =====================================================
// ENTITY SCHEMAS
// =====================================================

export const clientContactSchema = defineSchema<ClientContact>({
  id: 'number',
  clientId: { column: 'client_id', type: 'number' },
  firstName: { column: 'first_name', type: 'string' },
  lastName: { column: 'last_name', type: 'string' },
  email: 'string?',
  phone: 'string?',
  title: 'string?',
  department: 'string?',
  role: {
    column: 'role',
    type: 'string',
    transform: (v) => (v as string) || 'general'
  },
  isPrimary: { column: 'is_primary', type: 'boolean' },
  notes: 'string?',
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

export const clientActivitySchema = defineSchema<ClientActivity>({
  id: 'number',
  clientId: { column: 'client_id', type: 'number' },
  activityType: { column: 'activity_type', type: 'string' },
  title: 'string',
  description: 'string?',
  metadata: { column: 'metadata', type: 'json?' },
  createdBy: { column: 'created_by', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' }
});

export const customFieldSchema = defineSchema<CustomField>({
  id: 'number',
  fieldName: { column: 'field_name', type: 'string' },
  fieldLabel: { column: 'field_label', type: 'string' },
  fieldType: {
    column: 'field_type',
    type: 'string',
    transform: (v) => v as CustomField['fieldType']
  },
  options: { column: 'options', type: 'json?' },
  isRequired: { column: 'is_required', type: 'boolean' },
  placeholder: 'string?',
  defaultValue: { column: 'default_value', type: 'string?' },
  displayOrder: { column: 'display_order', type: 'number' },
  isActive: { column: 'is_active', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

export const customFieldValueSchema = defineSchema<CustomFieldValue>({
  id: 'number',
  clientId: { column: 'client_id', type: 'number' },
  fieldId: { column: 'field_id', type: 'number' },
  fieldName: { column: 'field_name', type: 'string' },
  fieldLabel: { column: 'field_label', type: 'string' },
  fieldType: { column: 'field_type', type: 'string' },
  fieldValue: { column: 'field_value', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

export const tagSchema = defineSchema<Tag>({
  id: 'number',
  name: 'string',
  color: 'string',
  description: 'string?',
  tagType: { column: 'tag_type', type: 'string' },
  createdAt: { column: 'created_at', type: 'string' }
});

export const clientNoteSchema = defineSchema<ClientNote>({
  id: 'number',
  clientId: { column: 'client_id', type: 'number' },
  author: {
    column: 'author_name',
    type: 'string',
    default: 'Unknown'
  },
  content: 'string',
  isPinned: { column: 'is_pinned', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

// =====================================================
// MAPPER FUNCTIONS
// =====================================================

export const toContact = createMapper<ContactRow, ClientContact>(clientContactSchema);
export const toActivity = createMapper<ActivityRow, ClientActivity>(clientActivitySchema);
export const toCustomField = createMapper<CustomFieldRow, CustomField>(customFieldSchema);
export const toCustomFieldValue = createMapper<CustomFieldValueRow, CustomFieldValue>(
  customFieldValueSchema
);
export const toTag = createMapper<TagRow, Tag>(tagSchema);
export const toClientNote = createMapper<ClientNoteRow, ClientNote>(clientNoteSchema);
