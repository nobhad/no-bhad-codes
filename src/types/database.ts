/**
 * ===============================================
 * DATABASE ENTITY TYPE DEFINITIONS (CLIENT)
 * ===============================================
 * @file src/types/database.ts
 *
 * Type definitions for database entities used on the client side.
 * These mirror server-side database entities for type safety.
 */

import type {
  LeadStatus,
  ProjectStatus,
  ClientStatus,
  ContactStatus,
  ThreadStatus,
  InvoiceStatus,
  SenderType
} from './api';

// ============================================
// Base Entity Types
// ============================================

/**
 * Base entity with common fields
 */
export interface BaseEntity {
  id: number;
  created_at: string;
  updated_at?: string;
}

/**
 * Soft-deletable entity
 */
export interface SoftDeletableEntity extends BaseEntity {
  deleted_at?: string;
}

// ============================================
// Lead Entity
// ============================================

/**
 * Lead/Intake submission entity
 */
export interface LeadEntity extends BaseEntity {
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  status: LeadStatus;
  source?: string;
  notes?: string;
  project_name?: string;
  project_type?: string;
  description?: string;
  budget_range?: string;
  timeline?: string;
  features?: string;
  invited_at?: string;
}

/**
 * Lead with computed fields
 */
export interface LeadWithComputed extends LeadEntity {
  daysOld: number;
  hasProject: boolean;
}

// ============================================
// Client Entity
// ============================================

/**
 * Client entity
 */
export interface ClientEntity extends BaseEntity {
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  status: ClientStatus;
  password_hash?: string;
  magic_link_token?: string;
  magic_link_expires?: string;
  last_login?: string;
}

/**
 * Client with computed fields (for admin views)
 */
export interface ClientWithComputed extends ClientEntity {
  project_count: number;
  total_revenue: number;
  active_projects: number;
  last_activity?: string;
}

// ============================================
// Contact Submission Entity
// ============================================

/**
 * Contact form submission entity
 */
export interface ContactSubmissionEntity extends BaseEntity {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  subject?: string;
  message: string;
  status: ContactStatus;
  read_at?: string;
  replied_at?: string;
}

// ============================================
// Project Entity
// ============================================

/**
 * Project entity
 */
export interface ProjectEntity extends BaseEntity {
  name: string;
  client_id: number;
  status: ProjectStatus;
  start_date?: string;
  end_date?: string;
  budget?: number;
  description?: string;
  progress?: number;
}

/**
 * Project with client info (joined)
 */
export interface ProjectWithClient extends ProjectEntity {
  client_name: string;
  client_email: string;
}

/**
 * Project milestone entity
 */
export interface ProjectMilestoneEntity extends BaseEntity {
  project_id: number;
  title: string;
  description?: string;
  due_date: string;
  is_completed: boolean;
  completed_at?: string;
}

/**
 * Project file entity
 */
export interface ProjectFileEntity extends BaseEntity {
  project_id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  uploaded_by: string;
  storage_path?: string;
}

/**
 * Project update/changelog entity
 */
export interface ProjectUpdateEntity extends BaseEntity {
  project_id: number;
  title: string;
  description: string;
  author: string;
  update_type: 'progress' | 'milestone' | 'issue' | 'resolution' | 'general';
}

// ============================================
// Messaging Entities
// ============================================

/**
 * Message thread entity
 */
export interface MessageThreadEntity extends BaseEntity {
  subject: string;
  client_id: number;
  project_id?: number;
  status: ThreadStatus;
  last_message_at?: string;
}

/**
 * Message thread with computed fields
 */
export interface MessageThreadWithComputed extends MessageThreadEntity {
  client_name: string;
  unread_count: number;
  last_message_preview?: string;
}

/**
 * Message entity
 */
export interface MessageEntity extends BaseEntity {
  thread_id: number;
  sender_type: SenderType;
  sender_id?: number;
  sender_name: string;
  message: string;
  read_at: string | null; // Datetime when message was read, null if unread
}

/**
 * Message with attachments
 */
export interface MessageWithAttachments extends MessageEntity {
  attachments: MessageAttachmentEntity[];
}

/**
 * Message attachment entity
 */
export interface MessageAttachmentEntity extends BaseEntity {
  message_id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  storage_path: string;
}

// ============================================
// Invoice Entity
// ============================================

/**
 * Invoice entity
 */
export interface InvoiceEntity extends BaseEntity {
  project_id: number;
  client_id: number;
  invoice_number: string;
  amount_subtotal: number;
  amount_tax: number;
  amount_total: number;
  status: InvoiceStatus;
  due_date: string;
  paid_date?: string;
  notes?: string;
}

/**
 * Invoice line item entity
 */
export interface InvoiceLineItemEntity extends BaseEntity {
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

/**
 * Invoice with line items
 */
export interface InvoiceWithLineItems extends InvoiceEntity {
  line_items: InvoiceLineItemEntity[];
  project_name?: string;
  client_name?: string;
}

// ============================================
// User/Auth Entities
// ============================================

/**
 * Admin user entity
 */
export interface AdminUserEntity extends BaseEntity {
  username: string;
  password_hash: string;
  email?: string;
  last_login?: string;
  is_active: boolean;
}

/**
 * Session entity
 */
export interface SessionEntity extends BaseEntity {
  user_id: number;
  user_type: 'admin' | 'client';
  token_hash: string;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
}

// ============================================
// Audit/Logging Entities
// ============================================

/**
 * Audit log entity
 */
export interface AuditLogEntity extends BaseEntity {
  user_id?: number;
  user_type?: 'admin' | 'client';
  action: string;
  entity_type: string;
  entity_id?: number;
  old_values?: string;
  new_values?: string;
  ip_address?: string;
  user_agent?: string;
}

// ============================================
// Analytics Entities
// ============================================

/**
 * Page view entity
 */
export interface PageViewEntity extends BaseEntity {
  session_id: string;
  url: string;
  title?: string;
  referrer?: string;
  time_on_page?: number;
}

/**
 * Visitor session entity
 */
export interface VisitorSessionEntity extends BaseEntity {
  session_id: string;
  visitor_id?: string;
  start_time: string;
  end_time?: string;
  page_views: number;
  ip_address?: string;
  user_agent?: string;
  device_type?: string;
  country?: string;
  city?: string;
}

// ============================================
// Settings Entities
// ============================================

/**
 * Application setting entity
 */
export interface AppSettingEntity extends BaseEntity {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
}

/**
 * Email template entity
 */
export interface EmailTemplateEntity extends BaseEntity {
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  variables: string;
}

// ============================================
// Type Guards
// ============================================

/**
 * Type guard for LeadEntity
 */
export function isLeadEntity(entity: unknown): entity is LeadEntity {
  return (
    typeof entity === 'object' &&
    entity !== null &&
    'id' in entity &&
    'company_name' in entity &&
    'email' in entity &&
    'status' in entity
  );
}

/**
 * Type guard for ProjectEntity
 */
export function isProjectEntity(entity: unknown): entity is ProjectEntity {
  return (
    typeof entity === 'object' &&
    entity !== null &&
    'id' in entity &&
    'name' in entity &&
    'client_id' in entity &&
    'status' in entity
  );
}

/**
 * Type guard for ClientEntity
 */
export function isClientEntity(entity: unknown): entity is ClientEntity {
  return (
    typeof entity === 'object' &&
    entity !== null &&
    'id' in entity &&
    'company_name' in entity &&
    'email' in entity
  );
}

/**
 * Type guard for MessageEntity
 */
export function isMessageEntity(entity: unknown): entity is MessageEntity {
  return (
    typeof entity === 'object' &&
    entity !== null &&
    'id' in entity &&
    'thread_id' in entity &&
    'message' in entity &&
    'sender_type' in entity
  );
}
