/**
 * ===============================================
 * SERVER DATABASE TYPE DEFINITIONS
 * ===============================================
 * @file server/types/database.ts
 *
 * Type definitions for database entities and operations
 * on the server side. Provides type safety for database queries.
 */

// ============================================
// Base Types
// ============================================

/**
 * Base entity with common database fields
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

/**
 * Generic row result from database
 */
export type DatabaseRow = Record<string, unknown>;

// ============================================
// Lead/Intake Types
// ============================================

// Lead status values - simplified pipeline stages
// new → contacted → qualified → in-progress → converted/lost
export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'in-progress'
  | 'converted'
  | 'lost'
  | 'on-hold'
  | 'cancelled';

export interface LeadRow extends BaseEntity {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  status: LeadStatus;
  source: string | null;
  notes: string | null;
  project_name: string | null;
  project_type: string | null;
  description: string | null;
  budget_range: string | null;
  timeline: string | null;
  features: string | null;
  invited_at: string | null;
}

export interface LeadInsert {
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  status?: LeadStatus;
  source?: string;
  notes?: string;
  project_name?: string;
  project_type?: string;
  description?: string;
  budget_range?: string;
  timeline?: string;
  features?: string;
}

export interface LeadUpdate {
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  status?: LeadStatus;
  source?: string;
  notes?: string;
  invited_at?: string;
}

// ============================================
// Client Types
// ============================================

export type ClientStatus = 'active' | 'inactive' | 'pending';

export interface ClientRow extends BaseEntity {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  status: ClientStatus;
  password_hash: string | null;
  magic_link_token: string | null;
  magic_link_expires: string | null;
  last_login: string | null;
}

export interface ClientInsert {
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  status?: ClientStatus;
  password_hash?: string;
}

export interface ClientUpdate {
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  status?: ClientStatus;
  password_hash?: string;
  magic_link_token?: string | null;
  magic_link_expires?: string | null;
  last_login?: string;
}

// ============================================
// Contact Submission Types
// ============================================

export type ContactStatus = 'new' | 'read' | 'replied' | 'archived';

export interface ContactSubmissionRow extends BaseEntity {
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  status: ContactStatus;
  read_at: string | null;
  replied_at: string | null;
}

export interface ContactSubmissionInsert {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  subject?: string;
  message: string;
  status?: ContactStatus;
}

export interface ContactSubmissionUpdate {
  status?: ContactStatus;
  read_at?: string;
  replied_at?: string;
}

// ============================================
// Project Types
// ============================================

// Project status values must match database CHECK constraint
export type ProjectStatus =
  | 'pending'
  | 'active'
  | 'in-progress'
  | 'in-review'
  | 'completed'
  | 'on-hold'
  | 'cancelled';

export interface ProjectRow extends BaseEntity {
  name: string;
  client_id: number;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  description: string | null;
  progress: number | null;
}

export interface ProjectWithClientRow extends ProjectRow {
  client_name: string;
  client_email: string;
}

export interface ProjectInsert {
  name: string;
  client_id: number;
  status?: ProjectStatus;
  start_date?: string;
  end_date?: string;
  budget?: number;
  description?: string;
  progress?: number;
}

export interface ProjectUpdate {
  name?: string;
  status?: ProjectStatus;
  start_date?: string;
  end_date?: string;
  budget?: number;
  description?: string;
  progress?: number;
}

// ============================================
// Project Milestone Types
// ============================================

export interface ProjectMilestoneRow extends BaseEntity {
  project_id: number;
  title: string;
  description: string | null;
  due_date: string;
  is_completed: number; // SQLite uses 0/1 for boolean
  completed_at: string | null;
}

export interface ProjectMilestoneInsert {
  project_id: number;
  title: string;
  description?: string;
  due_date: string;
  is_completed?: boolean;
}

export interface ProjectMilestoneUpdate {
  title?: string;
  description?: string;
  due_date?: string;
  is_completed?: boolean;
  completed_at?: string;
}

// ============================================
// Project File Types
// ============================================

export interface ProjectFileRow extends BaseEntity {
  project_id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  uploaded_by: string;
  storage_path: string | null;
}

export interface ProjectFileInsert {
  project_id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  uploaded_by: string;
  storage_path?: string;
}

// ============================================
// Message Types
// ============================================

export type ThreadStatus = 'active' | 'closed' | 'archived';
export type SenderType = 'client' | 'admin' | 'system';

export interface MessageThreadRow extends BaseEntity {
  subject: string;
  client_id: number;
  project_id: number | null;
  status: ThreadStatus;
  last_message_at: string | null;
}

export interface MessageThreadWithClientRow extends MessageThreadRow {
  client_name: string;
  unread_count: number;
}

export interface MessageThreadInsert {
  subject: string;
  client_id: number;
  project_id?: number;
  status?: ThreadStatus;
}

export interface MessageThreadUpdate {
  subject?: string;
  status?: ThreadStatus;
  last_message_at?: string;
}

export interface MessageRow extends BaseEntity {
  thread_id: number;
  sender_type: SenderType;
  sender_id: number | null;
  sender_name: string;
  message: string;
  read_at: string | null; // NULL = unread, timestamp = read
}

export interface MessageInsert {
  thread_id: number;
  sender_type: SenderType;
  sender_id?: number;
  sender_name: string;
  message: string;
}

export interface MessageUpdate {
  read_at?: string; // Set to CURRENT_TIMESTAMP to mark as read
}

// ============================================
// Invoice Types
// ============================================

// NOTE: Must match CHECK constraint in migrations/002_client_intakes.sql
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceRow extends BaseEntity {
  project_id: number;
  client_id: number;
  invoice_number: string;
  amount_subtotal: number;
  amount_tax: number;
  amount_total: number;
  status: InvoiceStatus;
  due_date: string;
  paid_date: string | null;
  notes: string | null;
}

export interface InvoiceInsert {
  project_id: number;
  client_id: number;
  invoice_number: string;
  amount_subtotal: number;
  amount_tax: number;
  amount_total: number;
  status?: InvoiceStatus;
  due_date: string;
  notes?: string;
}

export interface InvoiceUpdate {
  status?: InvoiceStatus;
  paid_date?: string;
  notes?: string;
}

export interface InvoiceLineItemRow extends BaseEntity {
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface InvoiceLineItemInsert {
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

// ============================================
// Admin User Types
// ============================================

export interface AdminUserRow extends BaseEntity {
  username: string;
  password_hash: string;
  email: string | null;
  last_login: string | null;
  is_active: number; // SQLite uses 0/1 for boolean
}

// ============================================
// Session Types
// ============================================

export interface SessionRow extends BaseEntity {
  user_id: number;
  user_type: 'admin' | 'client';
  token_hash: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface SessionInsert {
  user_id: number;
  user_type: 'admin' | 'client';
  token_hash: string;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
}

// ============================================
// Audit Log Types
// ============================================

export interface AuditLogRow extends BaseEntity {
  user_id: number | null;
  user_type: 'admin' | 'client' | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface AuditLogInsert {
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
// Query Result Types
// ============================================

/**
 * Generic paginated query result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Query execution result
 */
export interface QueryExecutionResult<T = unknown> {
  rows: T[];
  rowCount: number;
  executionTime: number;
  sql: string;
  params: unknown[];
}

/**
 * Insert result
 */
export interface InsertResult {
  insertId: number;
  changes: number;
}

/**
 * Update/Delete result
 */
export interface ModifyResult {
  changes: number;
}

// ============================================
// Stats/Aggregation Types
// ============================================

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  converted: number;
  lost: number;
}

export interface ProjectStats {
  total: number;
  pending: number;
  'in-progress': number;
  'in-review': number;
  completed: number;
  'on-hold': number;
}

export interface ClientStats {
  total: number;
  active: number;
  inactive: number;
  pending: number;
}

export interface ContactStats {
  total: number;
  new: number;
  read: number;
  replied: number;
  archived: number;
}

export interface MessageStats {
  total_threads: number;
  active_threads: number;
  unread_messages: number;
}

// ============================================
// Type Guards
// ============================================

export function isLeadRow(row: unknown): row is LeadRow {
  return (
    typeof row === 'object' &&
    row !== null &&
    'id' in row &&
    'company_name' in row &&
    'email' in row &&
    'status' in row
  );
}

export function isClientRow(row: unknown): row is ClientRow {
  return (
    typeof row === 'object' &&
    row !== null &&
    'id' in row &&
    'company_name' in row &&
    'email' in row
  );
}

export function isProjectRow(row: unknown): row is ProjectRow {
  return (
    typeof row === 'object' &&
    row !== null &&
    'id' in row &&
    'name' in row &&
    'client_id' in row &&
    'status' in row
  );
}

export function isMessageRow(row: unknown): row is MessageRow {
  return (
    typeof row === 'object' &&
    row !== null &&
    'id' in row &&
    'thread_id' in row &&
    'message' in row &&
    'sender_type' in row
  );
}

// ============================================
// Utility Types
// ============================================

/**
 * Make all properties optional except id
 */
export type PartialWithId<T extends BaseEntity> = Partial<Omit<T, 'id'>> & { id: number };

/**
 * Omit base entity fields for inserts
 */
export type InsertFields<T extends BaseEntity> = Omit<T, 'id' | 'created_at' | 'updated_at'>;

// NOTE: SQLite boolean handling is done via row-helpers.ts
// Use getBoolean() or getBooleanOrNull() from server/database/row-helpers.ts
// These functions handle SQLite's 0/1 representation automatically
