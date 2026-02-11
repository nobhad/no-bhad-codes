/**
 * ===============================================
 * CONTRACT SERVICE
 * ===============================================
 * @file server/services/contract-service.ts
 *
 * Service for managing contract templates and generated contracts.
 */

import { getDatabase } from '../database/init.js';
import { getNumber, getString } from '../database/row-helpers.js';
import { BUSINESS_INFO } from '../config/business.js';
import {
  applyContractVariables,
  getDefaultContractVariables,
  resolveContractVariables
} from '../utils/contract-variables.js';

const CONTRACT_TEMPLATE_TYPES = ['standard', 'custom', 'amendment', 'nda', 'maintenance'] as const;
export type ContractTemplateType = typeof CONTRACT_TEMPLATE_TYPES[number];

interface ContractTemplate {
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

interface ContractTemplateCreateData {
  name: string;
  type: ContractTemplateType;
  content: string;
  variables?: string[];
  isDefault?: boolean;
}

export type ContractStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'expired' | 'cancelled';

interface Contract {
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
  // Signature request tracking (Phase 3.3)
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

interface ContractCreateData {
  templateId?: number | null;
  projectId: number;
  clientId: number;
  content: string;
  status?: ContractStatus;
  variables?: Record<string, string>;
  parentContractId?: number | null;
  renewalAt?: string | null;
  renewalReminderSentAt?: string | null;
  lastReminderAt?: string | null;
  reminderCount?: number | null;
  sentAt?: string | null;
  signedAt?: string | null;
  expiresAt?: string | null;
}

const CONTRACT_STATUSES: ContractStatus[] = ['draft', 'sent', 'viewed', 'signed', 'expired', 'cancelled'];

function mapTemplate(row: Record<string, unknown>): ContractTemplate {
  return {
    id: getNumber(row, 'id'),
    name: getString(row, 'name'),
    type: getString(row, 'type') as ContractTemplateType,
    content: getString(row, 'content'),
    variables: row.variables ? (JSON.parse(row.variables as string) as string[]) : undefined,
    isDefault: Boolean(row.is_default),
    isActive: Boolean(row.is_active),
    createdAt: getString(row, 'created_at'),
    updatedAt: getString(row, 'updated_at')
  };
}

function mapContract(row: Record<string, unknown>): Contract {
  return {
    id: getNumber(row, 'id'),
    templateId: row.template_id ? getNumber(row, 'template_id') : null,
    projectId: getNumber(row, 'project_id'),
    clientId: getNumber(row, 'client_id'),
    content: getString(row, 'content'),
    status: getString(row, 'status') as ContractStatus,
    variables: row.variables ? (JSON.parse(row.variables as string) as Record<string, string>) : undefined,
    templateName: row.template_name ? getString(row, 'template_name') : undefined,
    templateType: row.template_type ? (getString(row, 'template_type') as ContractTemplateType) : null,
    projectName: row.project_name ? getString(row, 'project_name') : undefined,
    clientName: row.client_name ? getString(row, 'client_name') : undefined,
    clientEmail: row.client_email ? getString(row, 'client_email') : undefined,
    parentContractId: row.parent_contract_id ? getNumber(row, 'parent_contract_id') : null,
    renewalAt: row.renewal_at as string | null,
    renewalReminderSentAt: row.renewal_reminder_sent_at as string | null,
    lastReminderAt: row.last_reminder_at as string | null,
    reminderCount: row.reminder_count as number | null,
    // Signature request tracking (Phase 3.3)
    signatureToken: row.signature_token as string | null,
    signatureRequestedAt: row.signature_requested_at as string | null,
    signatureExpiresAt: row.signature_expires_at as string | null,
    // Signer info
    signerName: row.signer_name as string | null,
    signerEmail: row.signer_email as string | null,
    signerIp: row.signer_ip as string | null,
    signerUserAgent: row.signer_user_agent as string | null,
    signatureData: row.signature_data as string | null,
    signedPdfPath: row.signed_pdf_path as string | null,
    // Countersigner info
    countersignedAt: row.countersigned_at as string | null,
    countersignerName: row.countersigner_name as string | null,
    countersignerEmail: row.countersigner_email as string | null,
    countersignerIp: row.countersigner_ip as string | null,
    countersignerUserAgent: row.countersigner_user_agent as string | null,
    countersignatureData: row.countersignature_data as string | null,
    // Timestamps
    sentAt: row.sent_at as string | null,
    signedAt: row.signed_at as string | null,
    expiresAt: row.expires_at as string | null,
    createdAt: getString(row, 'created_at'),
    updatedAt: getString(row, 'updated_at')
  };
}

class ContractService {
  private async getContractVariableSource(projectId: number, clientId: number) {
    const db = getDatabase();
    const row = await db.get(
      `SELECT
        p.project_name,
        p.project_type,
        p.description,
        p.start_date,
        p.due_date,
        p.price,
        p.deposit_amount,
        c.contact_name,
        c.email,
        c.company_name
      FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE p.id = ? AND c.id = ?`,
      [projectId, clientId]
    );

    if (!row) {
      throw new Error('Project or client not found');
    }

    const data = row as Record<string, unknown>;
    return {
      client: {
        name: getString(data, 'contact_name'),
        email: getString(data, 'email'),
        company: data.company_name as string | null | undefined
      },
      project: {
        name: getString(data, 'project_name'),
        type: getString(data, 'project_type'),
        description: data.description as string | null | undefined,
        startDate: data.start_date as string | null | undefined,
        dueDate: data.due_date as string | null | undefined,
        price: data.price as string | number | null | undefined,
        depositAmount: data.deposit_amount as string | number | null | undefined
      },
      business: {
        name: BUSINESS_INFO.name,
        owner: BUSINESS_INFO.owner,
        contact: BUSINESS_INFO.contact,
        email: BUSINESS_INFO.email,
        website: BUSINESS_INFO.website
      },
      date: {
        today: new Date().toISOString().split('T')[0]
      }
    };
  }

  async getTemplates(type?: string): Promise<ContractTemplate[]> {
    const db = getDatabase();
    const params: string[] = [];
    let query = 'SELECT * FROM contract_templates WHERE is_active = TRUE';

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY is_default DESC, name ASC';

    const rows = await db.all(query, params);
    return rows.map((row) => mapTemplate(row as Record<string, unknown>));
  }

  async getTemplate(templateId: number): Promise<ContractTemplate> {
    const db = getDatabase();
    const row = await db.get('SELECT * FROM contract_templates WHERE id = ?', [templateId]);

    if (!row) {
      throw new Error('Template not found');
    }

    return mapTemplate(row as Record<string, unknown>);
  }

  async createTemplate(data: ContractTemplateCreateData): Promise<ContractTemplate> {
    const db = getDatabase();
    const variables = data.variables && data.variables.length > 0
      ? data.variables
      : getDefaultContractVariables();

    if (data.isDefault) {
      await db.run('UPDATE contract_templates SET is_default = FALSE WHERE type = ?', [data.type]);
    }

    const result = await db.run(
      `INSERT INTO contract_templates (
        name, type, content, variables,
        is_default, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, TRUE, datetime('now'), datetime('now'))`,
      [
        data.name,
        data.type,
        data.content,
        JSON.stringify(variables),
        data.isDefault ? 1 : 0
      ]
    );

    return this.getTemplate(result.lastID!);
  }

  async updateTemplate(templateId: number, data: Partial<ContractTemplateCreateData>): Promise<ContractTemplate> {
    const db = getDatabase();
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.type !== undefined) {
      updates.push('type = ?');
      params.push(data.type);
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      params.push(data.content);
    }
    if (data.variables !== undefined) {
      updates.push('variables = ?');
      params.push(JSON.stringify(data.variables));
    }
    if (data.isDefault !== undefined) {
      if (data.isDefault) {
        const template = await this.getTemplate(templateId);
        const type = data.type || template.type;
        await db.run('UPDATE contract_templates SET is_default = FALSE WHERE type = ?', [type]);
      }
      updates.push('is_default = ?');
      params.push(data.isDefault ? 1 : 0);
    }

    updates.push("updated_at = datetime('now')");
    params.push(templateId);

    await db.run(`UPDATE contract_templates SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.getTemplate(templateId);
  }

  async deleteTemplate(templateId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      "UPDATE contract_templates SET is_active = FALSE, updated_at = datetime('now') WHERE id = ?",
      [templateId]
    );
  }

  async getContracts(filters?: {
    projectId?: number;
    clientId?: number;
    status?: ContractStatus;
  }): Promise<Contract[]> {
    const db = getDatabase();
    const params: (number | string)[] = [];
    let query = `
      SELECT
        contracts.*,
        p.project_name as project_name,
        c.contact_name as client_name,
        c.email as client_email,
        t.name as template_name,
        t.type as template_type
      FROM contracts
      LEFT JOIN projects p ON contracts.project_id = p.id
      LEFT JOIN clients c ON contracts.client_id = c.id
      LEFT JOIN contract_templates t ON contracts.template_id = t.id
    `;
    const where: string[] = [];

    if (filters?.projectId !== undefined) {
      where.push('project_id = ?');
      params.push(filters.projectId);
    }

    if (filters?.clientId !== undefined) {
      where.push('client_id = ?');
      params.push(filters.clientId);
    }

    if (filters?.status) {
      where.push('status = ?');
      params.push(filters.status);
    }

    if (where.length > 0) {
      query += ` WHERE ${where.join(' AND ')}`;
    }

    query += ' ORDER BY created_at DESC';

    const rows = await db.all(query, params);
    return rows.map((row) => mapContract(row as Record<string, unknown>));
  }

  async getContract(contractId: number): Promise<Contract> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT
        contracts.*,
        p.project_name as project_name,
        c.contact_name as client_name,
        c.email as client_email,
        t.name as template_name,
        t.type as template_type
       FROM contracts
       LEFT JOIN projects p ON contracts.project_id = p.id
       LEFT JOIN clients c ON contracts.client_id = c.id
       LEFT JOIN contract_templates t ON contracts.template_id = t.id
       WHERE contracts.id = ?`,
      [contractId]
    );

    if (!row) {
      throw new Error('Contract not found');
    }

    return mapContract(row as Record<string, unknown>);
  }

  async createContract(data: ContractCreateData): Promise<Contract> {
    const db = getDatabase();
    const status = data.status || 'draft';

    if (!CONTRACT_STATUSES.includes(status)) {
      throw new Error('Invalid contract status');
    }

    const result = await db.run(
      `INSERT INTO contracts (
        template_id, project_id, client_id, content, status, variables,
        parent_contract_id, renewal_at, renewal_reminder_sent_at, last_reminder_at, reminder_count,
        sent_at, signed_at, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        data.templateId || null,
        data.projectId,
        data.clientId,
        data.content,
        status,
        data.variables ? JSON.stringify(data.variables) : null,
        data.parentContractId || null,
        data.renewalAt || null,
        data.renewalReminderSentAt || null,
        data.lastReminderAt || null,
        data.reminderCount ?? null,
        data.sentAt || null,
        data.signedAt || null,
        data.expiresAt || null
      ]
    );

    return this.getContract(result.lastID!);
  }

  async createContractFromTemplate(options: {
    templateId: number;
    projectId: number;
    clientId: number;
    status?: ContractStatus;
    expiresAt?: string | null;
  }): Promise<Contract> {
    const template = await this.getTemplate(options.templateId);
    const source = await this.getContractVariableSource(options.projectId, options.clientId);
    const variables = resolveContractVariables(source);
    const content = applyContractVariables(template.content, variables);

    return this.createContract({
      templateId: template.id,
      projectId: options.projectId,
      clientId: options.clientId,
      content,
      status: options.status,
      variables,
      expiresAt: options.expiresAt || null
    });
  }

  async updateContract(contractId: number, data: Partial<ContractCreateData>): Promise<Contract> {
    const db = getDatabase();
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (data.templateId !== undefined) {
      updates.push('template_id = ?');
      params.push(data.templateId || null);
    }
    if (data.projectId !== undefined) {
      updates.push('project_id = ?');
      params.push(data.projectId);
    }
    if (data.clientId !== undefined) {
      updates.push('client_id = ?');
      params.push(data.clientId);
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      params.push(data.content);
    }
    if (data.status !== undefined) {
      if (!CONTRACT_STATUSES.includes(data.status)) {
        throw new Error('Invalid contract status');
      }
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.variables !== undefined) {
      updates.push('variables = ?');
      params.push(data.variables ? JSON.stringify(data.variables) : null);
    }
    if (data.parentContractId !== undefined) {
      updates.push('parent_contract_id = ?');
      params.push(data.parentContractId || null);
    }
    if (data.renewalAt !== undefined) {
      updates.push('renewal_at = ?');
      params.push(data.renewalAt || null);
    }
    if (data.renewalReminderSentAt !== undefined) {
      updates.push('renewal_reminder_sent_at = ?');
      params.push(data.renewalReminderSentAt || null);
    }
    if (data.lastReminderAt !== undefined) {
      updates.push('last_reminder_at = ?');
      params.push(data.lastReminderAt || null);
    }
    if (data.reminderCount !== undefined) {
      updates.push('reminder_count = ?');
      params.push(data.reminderCount ?? null);
    }
    if (data.sentAt !== undefined) {
      updates.push('sent_at = ?');
      params.push(data.sentAt || null);
    }
    if (data.signedAt !== undefined) {
      updates.push('signed_at = ?');
      params.push(data.signedAt || null);
    }
    if (data.expiresAt !== undefined) {
      updates.push('expires_at = ?');
      params.push(data.expiresAt || null);
    }

    if (updates.length === 0) {
      return this.getContract(contractId);
    }

    updates.push("updated_at = datetime('now')");
    params.push(contractId);

    await db.run(`UPDATE contracts SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.getContract(contractId);
  }

  isValidTemplateType(type: string): type is ContractTemplateType {
    return CONTRACT_TEMPLATE_TYPES.includes(type as ContractTemplateType);
  }

  isValidContractStatus(status: string): status is ContractStatus {
    return CONTRACT_STATUSES.includes(status as ContractStatus);
  }

  // ============================================
  // SIGNATURE HANDLING METHODS (Phase 3.3)
  // ============================================

  /**
   * Request signature for a contract
   */
  async requestSignature(
    contractId: number,
    options: {
      signatureToken: string;
      expiresAt: string;
    }
  ): Promise<Contract> {
    const db = getDatabase();

    await db.run(
      `UPDATE contracts SET
        signature_token = ?,
        signature_requested_at = datetime('now'),
        signature_expires_at = ?,
        status = 'sent',
        sent_at = datetime('now'),
        updated_at = datetime('now')
       WHERE id = ?`,
      [options.signatureToken, options.expiresAt, contractId]
    );

    return this.getContract(contractId);
  }

  /**
   * Get contract by signature token
   */
  async getContractBySignatureToken(token: string): Promise<Contract | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT
        contracts.*,
        p.project_name as project_name,
        c.contact_name as client_name,
        c.email as client_email,
        t.name as template_name,
        t.type as template_type
       FROM contracts
       LEFT JOIN projects p ON contracts.project_id = p.id
       LEFT JOIN clients c ON contracts.client_id = c.id
       LEFT JOIN contract_templates t ON contracts.template_id = t.id
       WHERE contracts.signature_token = ?`,
      [token]
    );

    if (!row) {
      return null;
    }

    return mapContract(row as Record<string, unknown>);
  }

  /**
   * Record contract signature
   */
  async recordSignature(
    contractId: number,
    data: {
      signerName: string;
      signerEmail: string;
      signerIp: string;
      signerUserAgent: string;
      signatureData: string;
    }
  ): Promise<Contract> {
    const db = getDatabase();
    const signedAt = new Date().toISOString();

    await db.run(
      `UPDATE contracts SET
        signed_at = ?,
        signature_token = NULL,
        signature_expires_at = NULL,
        signer_name = ?,
        signer_email = ?,
        signer_ip = ?,
        signer_user_agent = ?,
        signature_data = ?,
        status = 'signed',
        updated_at = datetime('now')
       WHERE id = ?`,
      [
        signedAt,
        data.signerName,
        data.signerEmail,
        data.signerIp,
        data.signerUserAgent,
        data.signatureData,
        contractId
      ]
    );

    return this.getContract(contractId);
  }

  /**
   * Record contract countersignature
   */
  async recordCountersignature(
    contractId: number,
    data: {
      countersignerName: string;
      countersignerEmail: string;
      countersignerIp: string;
      countersignerUserAgent: string;
      countersignatureData: string;
      signedPdfPath?: string;
    }
  ): Promise<Contract> {
    const db = getDatabase();
    const countersignedAt = new Date().toISOString();

    await db.run(
      `UPDATE contracts SET
        countersigned_at = ?,
        countersigner_name = ?,
        countersigner_email = ?,
        countersigner_ip = ?,
        countersigner_user_agent = ?,
        countersignature_data = ?,
        signed_pdf_path = ?,
        updated_at = datetime('now')
       WHERE id = ?`,
      [
        countersignedAt,
        data.countersignerName,
        data.countersignerEmail,
        data.countersignerIp,
        data.countersignerUserAgent,
        data.countersignatureData,
        data.signedPdfPath || null,
        contractId
      ]
    );

    return this.getContract(contractId);
  }

  /**
   * Expire a contract signature request
   */
  async expireSignatureRequest(contractId: number): Promise<Contract> {
    const db = getDatabase();

    await db.run(
      `UPDATE contracts SET
        signature_expires_at = datetime('now'),
        signature_token = NULL,
        status = 'expired',
        updated_at = datetime('now')
       WHERE id = ?`,
      [contractId]
    );

    return this.getContract(contractId);
  }

  /**
   * Get signature info for a contract
   */
  async getSignatureInfo(contractId: number): Promise<{
    signedAt: string | null;
    signatureRequestedAt: string | null;
    signatureExpiresAt: string | null;
    signerName: string | null;
    signerEmail: string | null;
    signerIp: string | null;
    countersignedAt: string | null;
    countersignerName: string | null;
    countersignerEmail: string | null;
    countersignerIp: string | null;
    signedPdfPath: string | null;
  }> {
    const contract = await this.getContract(contractId);

    return {
      signedAt: contract.signedAt ?? null,
      signatureRequestedAt: contract.signatureRequestedAt ?? null,
      signatureExpiresAt: contract.signatureExpiresAt ?? null,
      signerName: contract.signerName ?? null,
      signerEmail: contract.signerEmail ?? null,
      signerIp: contract.signerIp ?? null,
      countersignedAt: contract.countersignedAt ?? null,
      countersignerName: contract.countersignerName ?? null,
      countersignerEmail: contract.countersignerEmail ?? null,
      countersignerIp: contract.countersignerIp ?? null,
      signedPdfPath: contract.signedPdfPath ?? null
    };
  }
}

export const contractService = new ContractService();
