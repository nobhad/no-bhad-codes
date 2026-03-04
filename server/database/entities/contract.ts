/**
 * ===============================================
 * CONTRACT ENTITY SCHEMAS
 * ===============================================
 * @file server/database/entities/contract.ts
 *
 * Entity schemas and mappers for contract-related data types.
 */

import { defineSchema, definePartialSchema, createMapper } from '../entity-mapper.js';
import type { DatabaseRow } from '../init.js';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export type ContractTemplateType = 'standard' | 'custom' | 'amendment' | 'nda' | 'maintenance';
export type ContractStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'expired' | 'cancelled';

export interface ContractTemplate {
  id: number;
  name: string;
  type: ContractTemplateType;
  content: string;
  variables?: string[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: number;
  templateId?: number | null;
  projectId: number;
  clientId: number;
  content: string;
  status: ContractStatus;
  variables?: Record<string, string>;
  templateName?: string;
  templateType?: ContractTemplateType | null;
  projectName?: string;
  clientName?: string;
  clientEmail?: string;
  parentContractId?: number | null;
  renewalAt?: string | null;
  renewalReminderSentAt?: string | null;
  lastReminderAt?: string | null;
  reminderCount?: number | null;
  // Signature request tracking
  signatureToken?: string | null;
  signatureRequestedAt?: string | null;
  signatureExpiresAt?: string | null;
  // Signer info
  signerName?: string | null;
  signerEmail?: string | null;
  signerIp?: string | null;
  signerUserAgent?: string | null;
  signatureData?: string | null;
  signedPdfPath?: string | null;
  // Countersigner info
  countersignedAt?: string | null;
  countersignerName?: string | null;
  countersignerEmail?: string | null;
  countersignerIp?: string | null;
  countersignerUserAgent?: string | null;
  countersignatureData?: string | null;
  // Timestamps
  sentAt?: string | null;
  signedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// ROW TYPE DEFINITIONS
// =====================================================

export interface ContractTemplateRow extends DatabaseRow {
  id: number;
  name: string;
  type: string;
  content: string;
  variables?: string;
  is_default: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ContractRow extends DatabaseRow {
  id: number;
  template_id?: number;
  project_id: number;
  client_id: number;
  content: string;
  status: string;
  variables?: string;
  template_name?: string;
  template_type?: string;
  project_name?: string;
  client_name?: string;
  client_email?: string;
  parent_contract_id?: number;
  renewal_at?: string;
  renewal_reminder_sent_at?: string;
  last_reminder_at?: string;
  reminder_count?: number;
  signature_token?: string;
  signature_requested_at?: string;
  signature_expires_at?: string;
  signer_name?: string;
  signer_email?: string;
  signer_ip?: string;
  signer_user_agent?: string;
  signature_data?: string;
  signed_pdf_path?: string;
  countersigned_at?: string;
  countersigner_name?: string;
  countersigner_email?: string;
  countersigner_ip?: string;
  countersigner_user_agent?: string;
  countersignature_data?: string;
  sent_at?: string;
  signed_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// ENTITY SCHEMAS
// =====================================================

export const contractTemplateSchema = defineSchema<ContractTemplate>({
  id: 'number',
  name: 'string',
  type: {
    column: 'type',
    type: 'string',
    transform: (v) => v as ContractTemplateType
  },
  content: 'string',
  variables: { column: 'variables', type: 'json?' },
  isDefault: { column: 'is_default', type: 'boolean' },
  isActive: { column: 'is_active', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

// Contract has many optional joined fields
export const contractSchema = definePartialSchema<Contract>()({
  id: 'number',
  templateId: { column: 'template_id', type: 'number?' },
  projectId: { column: 'project_id', type: 'number' },
  clientId: { column: 'client_id', type: 'number' },
  content: 'string',
  status: {
    column: 'status',
    type: 'string',
    transform: (v) => v as ContractStatus
  },
  variables: { column: 'variables', type: 'json?' },
  templateName: { column: 'template_name', type: 'string?' },
  templateType: {
    column: 'template_type',
    type: 'string?',
    transform: (v) => v as ContractTemplateType | null
  },
  projectName: { column: 'project_name', type: 'string?' },
  clientName: { column: 'client_name', type: 'string?' },
  clientEmail: { column: 'client_email', type: 'string?' },
  parentContractId: { column: 'parent_contract_id', type: 'number?' },
  renewalAt: { column: 'renewal_at', type: 'string?' },
  renewalReminderSentAt: { column: 'renewal_reminder_sent_at', type: 'string?' },
  lastReminderAt: { column: 'last_reminder_at', type: 'string?' },
  reminderCount: { column: 'reminder_count', type: 'number?' },
  signatureToken: { column: 'signature_token', type: 'string?' },
  signatureRequestedAt: { column: 'signature_requested_at', type: 'string?' },
  signatureExpiresAt: { column: 'signature_expires_at', type: 'string?' },
  signerName: { column: 'signer_name', type: 'string?' },
  signerEmail: { column: 'signer_email', type: 'string?' },
  signerIp: { column: 'signer_ip', type: 'string?' },
  signerUserAgent: { column: 'signer_user_agent', type: 'string?' },
  signatureData: { column: 'signature_data', type: 'string?' },
  signedPdfPath: { column: 'signed_pdf_path', type: 'string?' },
  countersignedAt: { column: 'countersigned_at', type: 'string?' },
  countersignerName: { column: 'countersigner_name', type: 'string?' },
  countersignerEmail: { column: 'countersigner_email', type: 'string?' },
  countersignerIp: { column: 'countersigner_ip', type: 'string?' },
  countersignerUserAgent: { column: 'countersigner_user_agent', type: 'string?' },
  countersignatureData: { column: 'countersignature_data', type: 'string?' },
  sentAt: { column: 'sent_at', type: 'string?' },
  signedAt: { column: 'signed_at', type: 'string?' },
  expiresAt: { column: 'expires_at', type: 'string?' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

// =====================================================
// MAPPER FUNCTIONS
// =====================================================

export const toContractTemplate = createMapper<ContractTemplateRow, ContractTemplate>(
  contractTemplateSchema
);

/**
 * Map a ContractRow to Contract.
 * Note: Some fields are optional joined fields from related tables.
 */
export function toContract(row: ContractRow): Contract {
  return createMapper<ContractRow, Contract>(
    contractSchema as ReturnType<typeof defineSchema<Contract>>
  )(row);
}
