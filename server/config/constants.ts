/**
 * ===============================================
 * APPLICATION CONSTANTS
 * ===============================================
 * @file server/config/constants.ts
 *
 * Centralized business logic constants.
 * Single source of truth for status values, types, and enums.
 */

// ============================================
// PROJECT TYPES
// ============================================

export const PROJECT_TYPES = [
  'simple-site',
  'business-site',
  'portfolio',
  'e-commerce',
  'ecommerce', // Legacy support
  'web-app',
  'browser-extension',
  'other',
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

// ============================================
// PROJECT STATUS
// ============================================

export const PROJECT_STATUSES = [
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
  'archived',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// ============================================
// PROPOSAL CONSTANTS
// ============================================

export const PROPOSAL_TIERS = ['good', 'better', 'best'] as const;
export type ProposalTier = (typeof PROPOSAL_TIERS)[number];

export const PROPOSAL_STATUSES = [
  'pending',
  'reviewed',
  'accepted',
  'rejected',
  'converted',
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const MAINTENANCE_OPTIONS = [
  'diy',
  'essential',
  'standard',
  'premium',
] as const;
export type MaintenanceOption = (typeof MAINTENANCE_OPTIONS)[number];

// ============================================
// INVOICE CONSTANTS
// ============================================

export const INVOICE_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'partial',
  'paid',
  'overdue',
  'cancelled',
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_TYPES = [
  'standard',
  'recurring',
  'milestone',
  'retainer',
] as const;

export type InvoiceType = (typeof INVOICE_TYPES)[number];

// ============================================
// TASK CONSTANTS
// ============================================

export const TASK_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'blocked',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = [
  'low',
  'medium',
  'high',
  'urgent',
] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

// ============================================
// LEAD CONSTANTS
// ============================================

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'unqualified',
  'converted',
  'lost',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = [
  'website',
  'referral',
  'social',
  'advertisement',
  'cold_outreach',
  'other',
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

// ============================================
// MESSAGE CONSTANTS
// ============================================

export const MESSAGE_STATUSES = [
  'new',
  'read',
  'replied',
  'archived',
] as const;

export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_PRIORITIES = [
  'low',
  'normal',
  'high',
  'urgent',
] as const;

export type MessagePriority = (typeof MESSAGE_PRIORITIES)[number];

export const THREAD_TYPES = [
  'general',
  'project',
  'support',
  'billing',
] as const;

export type ThreadType = (typeof THREAD_TYPES)[number];

// ============================================
// CONTRACT CONSTANTS
// ============================================

export const CONTRACT_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'signed',
  'expired',
  'cancelled',
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

// ============================================
// DELIVERABLE CONSTANTS
// ============================================

export const DELIVERABLE_STATUSES = [
  'pending',
  'in_progress',
  'ready_for_review',
  'approved',
  'revision_requested',
  'delivered',
] as const;

export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

// ============================================
// DOCUMENT REQUEST CONSTANTS
// ============================================

export const DOCUMENT_REQUEST_STATUSES = [
  'pending',
  'submitted',
  'reviewed',
  'approved',
  'rejected',
] as const;

export type DocumentRequestStatus = (typeof DOCUMENT_REQUEST_STATUSES)[number];

// ============================================
// NOTIFICATION CONSTANTS
// ============================================

export const NOTIFICATION_TYPES = [
  'info',
  'success',
  'warning',
  'error',
  'message',
  'task',
  'invoice',
  'project',
  'system',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ============================================
// PAGINATION DEFAULTS
// ============================================

export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 1000,
  DEFAULT_PAGE: 1,
} as const;

// ============================================
// RATE LIMITING
// ============================================

export const RATE_LIMITS = {
  /** Standard API rate limit (requests per minute) */
  STANDARD: 100,
  /** Auth endpoints rate limit */
  AUTH: 10,
  /** File upload rate limit */
  UPLOAD: 20,
  /** Email sending rate limit */
  EMAIL: 30,
  /** Proposal submission rate limit */
  PROPOSAL: 5,
} as const;

// ============================================
// FILE UPLOAD CONSTANTS
// ============================================

export const FILE_UPLOAD = {
  /** Max file size in bytes (10MB) */
  MAX_SIZE: 10 * 1024 * 1024,
  /** Max files per upload */
  MAX_FILES: 10,
  /** Allowed MIME types for documents */
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ],
  /** Allowed MIME types for images */
  ALLOWED_IMAGE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
} as const;

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Check if a value is a valid constant from an array
 */
export function isValidConstant<T extends readonly string[]>(
  value: unknown,
  constants: T
): value is T[number] {
  return typeof value === 'string' && constants.includes(value as T[number]);
}

/**
 * Get validation message for invalid constant
 */
export function getInvalidConstantMessage<T extends readonly string[]>(
  field: string,
  constants: T
): string {
  return `Invalid ${field}. Must be one of: ${constants.join(', ')}`;
}
