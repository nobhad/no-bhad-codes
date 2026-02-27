/**
 * ===============================================
 * PROPOSAL ENTITY SCHEMAS
 * ===============================================
 * @file server/database/entities/proposal.ts
 *
 * Entity schemas and mappers for proposal-related data types.
 */

import { defineSchema, definePartialSchema, createMapper } from '../entity-mapper.js';
import type { DatabaseRow } from '../init.js';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface ProposalTemplate {
  id: number;
  name: string;
  description?: string;
  projectType?: string;
  tierStructure?: object;
  defaultLineItems?: object[];
  termsAndConditions?: string;
  validityDays: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalVersion {
  id: number;
  proposalId: number;
  versionNumber: number;
  tierData?: object;
  featuresData?: object[];
  pricingData?: object;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export interface ProposalSignature {
  id: number;
  proposalId: number;
  signerName: string;
  signerEmail: string;
  signerTitle?: string;
  signerCompany?: string;
  signatureMethod: string;
  signatureData?: string;
  ipAddress?: string;
  userAgent?: string;
  signedAt: string;
}

export interface ProposalComment {
  id: number;
  proposalId: number;
  authorType: 'admin' | 'client';
  authorName: string;
  authorEmail?: string;
  content: string;
  isInternal: boolean;
  parentCommentId?: number;
  createdAt: string;
  updatedAt: string;
  replies?: ProposalComment[];
}

export interface ProposalActivity {
  id: number;
  proposalId: number;
  activityType: string;
  actor?: string;
  actorType?: string;
  metadata?: object;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ProposalCustomItem {
  id: number;
  proposalId: number;
  itemType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitLabel?: string;
  category?: string;
  isTaxable: boolean;
  isOptional: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SignatureRequest {
  id: number;
  proposalId: number;
  signerEmail: string;
  signerName?: string;
  requestToken: string;
  status: string;
  sentAt?: string;
  viewedAt?: string;
  signedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  expiresAt?: string;
  reminderCount: number;
  lastReminderAt?: string;
  createdAt: string;
}

// =====================================================
// ROW TYPE DEFINITIONS
// =====================================================

export interface ProposalTemplateRow extends DatabaseRow {
  id: number;
  name: string;
  description?: string;
  project_type?: string;
  tier_structure?: string;
  default_line_items?: string;
  terms_and_conditions?: string;
  validity_days: number;
  is_default: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ProposalVersionRow extends DatabaseRow {
  id: number;
  proposal_id: number;
  version_number: number;
  tier_data?: string;
  features_data?: string;
  pricing_data?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface ProposalSignatureRow extends DatabaseRow {
  id: number;
  proposal_id: number;
  signer_name: string;
  signer_email: string;
  signer_title?: string;
  signer_company?: string;
  signature_method: string;
  signature_data?: string;
  ip_address?: string;
  user_agent?: string;
  signed_at: string;
}

export interface ProposalCommentRow extends DatabaseRow {
  id: number;
  proposal_id: number;
  author_type: string;
  author_name: string;
  author_email?: string;
  content: string;
  is_internal: number;
  parent_comment_id?: number;
  created_at: string;
  updated_at: string;
}

export interface ProposalActivityRow extends DatabaseRow {
  id: number;
  proposal_id: number;
  activity_type: string;
  actor?: string;
  actor_type?: string;
  metadata?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface ProposalCustomItemRow extends DatabaseRow {
  id: number;
  proposal_id: number;
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number | string;
  unit_label?: string;
  category?: string;
  is_taxable: number;
  is_optional: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SignatureRequestRow extends DatabaseRow {
  id: number;
  proposal_id: number;
  signer_email: string;
  signer_name?: string;
  request_token: string;
  status: string;
  sent_at?: string;
  viewed_at?: string;
  signed_at?: string;
  declined_at?: string;
  decline_reason?: string;
  expires_at?: string;
  reminder_count: number;
  last_reminder_at?: string;
  created_at: string;
}

// =====================================================
// ENTITY SCHEMAS
// =====================================================

export const proposalTemplateSchema = defineSchema<ProposalTemplate>({
  id: 'number',
  name: 'string',
  description: 'string?',
  projectType: { column: 'project_type', type: 'string?' },
  tierStructure: { column: 'tier_structure', type: 'json?' },
  defaultLineItems: { column: 'default_line_items', type: 'json?' },
  termsAndConditions: { column: 'terms_and_conditions', type: 'string?' },
  validityDays: { column: 'validity_days', type: 'number', default: 30 },
  isDefault: { column: 'is_default', type: 'boolean' },
  isActive: { column: 'is_active', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' },
});

export const proposalVersionSchema = defineSchema<ProposalVersion>({
  id: 'number',
  proposalId: { column: 'proposal_id', type: 'number' },
  versionNumber: { column: 'version_number', type: 'number' },
  tierData: { column: 'tier_data', type: 'json?' },
  featuresData: { column: 'features_data', type: 'json?' },
  pricingData: { column: 'pricing_data', type: 'json?' },
  notes: 'string?',
  createdBy: { column: 'created_by', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' },
});

export const proposalSignatureSchema = defineSchema<ProposalSignature>({
  id: 'number',
  proposalId: { column: 'proposal_id', type: 'number' },
  signerName: { column: 'signer_name', type: 'string' },
  signerEmail: { column: 'signer_email', type: 'string' },
  signerTitle: { column: 'signer_title', type: 'string?' },
  signerCompany: { column: 'signer_company', type: 'string?' },
  signatureMethod: { column: 'signature_method', type: 'string' },
  signatureData: { column: 'signature_data', type: 'string?' },
  ipAddress: { column: 'ip_address', type: 'string?' },
  userAgent: { column: 'user_agent', type: 'string?' },
  signedAt: { column: 'signed_at', type: 'string' },
});

// ProposalComment has optional 'replies' computed field
export const proposalCommentSchema = definePartialSchema<ProposalComment>()({
  id: 'number',
  proposalId: { column: 'proposal_id', type: 'number' },
  authorType: {
    column: 'author_type',
    type: 'string',
    transform: (v) => v as 'admin' | 'client',
  },
  authorName: { column: 'author_name', type: 'string' },
  authorEmail: { column: 'author_email', type: 'string?' },
  content: 'string',
  isInternal: { column: 'is_internal', type: 'boolean' },
  parentCommentId: { column: 'parent_comment_id', type: 'number?' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' },
});

export const proposalActivitySchema = defineSchema<ProposalActivity>({
  id: 'number',
  proposalId: { column: 'proposal_id', type: 'number' },
  activityType: { column: 'activity_type', type: 'string' },
  actor: 'string?',
  actorType: { column: 'actor_type', type: 'string?' },
  metadata: { column: 'metadata', type: 'json?' },
  ipAddress: { column: 'ip_address', type: 'string?' },
  userAgent: { column: 'user_agent', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' },
});

export const proposalCustomItemSchema = defineSchema<ProposalCustomItem>({
  id: 'number',
  proposalId: { column: 'proposal_id', type: 'number' },
  itemType: { column: 'item_type', type: 'string' },
  description: 'string',
  quantity: { column: 'quantity', type: 'number', default: 1 },
  unitPrice: { column: 'unit_price', type: 'float' },
  unitLabel: { column: 'unit_label', type: 'string?' },
  category: 'string?',
  isTaxable: { column: 'is_taxable', type: 'boolean' },
  isOptional: { column: 'is_optional', type: 'boolean' },
  sortOrder: { column: 'sort_order', type: 'number', default: 0 },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' },
});

export const signatureRequestSchema = defineSchema<SignatureRequest>({
  id: 'number',
  proposalId: { column: 'proposal_id', type: 'number' },
  signerEmail: { column: 'signer_email', type: 'string' },
  signerName: { column: 'signer_name', type: 'string?' },
  requestToken: { column: 'request_token', type: 'string' },
  status: 'string',
  sentAt: { column: 'sent_at', type: 'string?' },
  viewedAt: { column: 'viewed_at', type: 'string?' },
  signedAt: { column: 'signed_at', type: 'string?' },
  declinedAt: { column: 'declined_at', type: 'string?' },
  declineReason: { column: 'decline_reason', type: 'string?' },
  expiresAt: { column: 'expires_at', type: 'string?' },
  reminderCount: { column: 'reminder_count', type: 'number', default: 0 },
  lastReminderAt: { column: 'last_reminder_at', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' },
});

// =====================================================
// MAPPER FUNCTIONS
// =====================================================

export const toProposalTemplate = createMapper<ProposalTemplateRow, ProposalTemplate>(
  proposalTemplateSchema
);
export const toProposalVersion = createMapper<ProposalVersionRow, ProposalVersion>(
  proposalVersionSchema
);
export const toProposalSignature = createMapper<ProposalSignatureRow, ProposalSignature>(
  proposalSignatureSchema
);
export const toProposalActivity = createMapper<ProposalActivityRow, ProposalActivity>(
  proposalActivitySchema
);
export const toProposalCustomItem = createMapper<ProposalCustomItemRow, ProposalCustomItem>(
  proposalCustomItemSchema
);
export const toSignatureRequest = createMapper<SignatureRequestRow, SignatureRequest>(
  signatureRequestSchema
);

/**
 * Map a ProposalCommentRow to ProposalComment.
 * Note: 'replies' is a computed field that needs to be added separately.
 */
export function toProposalComment(row: ProposalCommentRow): ProposalComment {
  type BaseComment = Omit<ProposalComment, 'replies'>;
  return createMapper<ProposalCommentRow, BaseComment>(
    proposalCommentSchema as ReturnType<typeof defineSchema<BaseComment>>
  )(row) as ProposalComment;
}
