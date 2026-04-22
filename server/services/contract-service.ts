/**
 * ===============================================
 * CONTRACT SERVICE
 * ===============================================
 * @file server/services/contract-service.ts
 *
 * Service for managing contract templates and generated contracts.
 */

import { getDatabase } from '../database/init.js';
import { getString } from '../database/row-helpers.js';
import { BUSINESS_INFO } from '../config/business.js';
import {
  applyContractVariables,
  getDefaultContractVariables,
  resolveContractVariables
} from '../utils/contract-variables.js';
import {
  type ContractTemplate,
  type Contract,
  type ContractTemplateType,
  type ContractStatus,
  type ContractTemplateRow,
  type ContractRow,
  toContractTemplate,
  toContract
} from '../database/entities/index.js';
import { NotFoundError, ValidationError } from '../utils/app-errors.js';

// =====================================================
// Column Constants - Explicit column lists for SELECT queries
// =====================================================

const CONTRACT_TEMPLATE_COLUMNS = `
  id, name, type, content, variables, is_default, is_active, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

// Re-export types for external usage
export type { ContractTemplateType, ContractStatus };

const CONTRACT_TEMPLATE_TYPES = ['standard', 'custom', 'amendment', 'nda', 'maintenance'] as const;

interface ContractTemplateCreateData {
  name: string;
  type: ContractTemplateType;
  content: string;
  variables?: string[];
  isDefault?: boolean;
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

const CONTRACT_STATUSES: ContractStatus[] = [
  'draft',
  'sent',
  'viewed',
  'signed',
  'expired',
  'cancelled'
];

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
        COALESCE(c.billing_name, c.contact_name) as contact_name,
        COALESCE(c.billing_email, c.email) as email,
        COALESCE(c.billing_company, c.company_name) as company_name
      FROM active_projects p
      JOIN active_clients c ON p.client_id = c.id
      WHERE p.id = ? AND c.id = ?`,
      [projectId, clientId]
    );

    if (!row) {
      throw new NotFoundError('project or client');
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
    let query = `SELECT ${CONTRACT_TEMPLATE_COLUMNS} FROM contract_templates WHERE is_active = TRUE`;

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY is_default DESC, name ASC';

    const rows = await db.all(query, params);
    return rows.map((row) => toContractTemplate(row as ContractTemplateRow));
  }

  async getTemplate(templateId: number): Promise<ContractTemplate> {
    const db = getDatabase();
    const row = await db.get(`SELECT ${CONTRACT_TEMPLATE_COLUMNS} FROM contract_templates WHERE id = ?`, [templateId]);

    if (!row) {
      throw new NotFoundError('contract template');
    }

    return toContractTemplate(row as ContractTemplateRow);
  }

  async createTemplate(data: ContractTemplateCreateData): Promise<ContractTemplate> {
    const db = getDatabase();
    const variables =
      data.variables && data.variables.length > 0 ? data.variables : getDefaultContractVariables();

    if (data.isDefault) {
      await db.run('UPDATE contract_templates SET is_default = FALSE WHERE type = ?', [data.type]);
    }

    const result = await db.run(
      `INSERT INTO contract_templates (
        name, type, content, variables,
        is_default, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, TRUE, datetime('now'), datetime('now'))`,
      [data.name, data.type, data.content, JSON.stringify(variables), data.isDefault ? 1 : 0]
    );

    return this.getTemplate(result.lastID!);
  }

  async updateTemplate(
    templateId: number,
    data: Partial<ContractTemplateCreateData>
  ): Promise<ContractTemplate> {
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

    updates.push('updated_at = datetime(\'now\')');
    params.push(templateId);

    await db.run(`UPDATE contract_templates SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.getTemplate(templateId);
  }

  async deleteTemplate(templateId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE contract_templates SET is_active = FALSE, updated_at = datetime(\'now\') WHERE id = ?',
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
        COALESCE(c.billing_name, c.contact_name) as client_name,
        COALESCE(c.billing_email, c.email) as client_email,
        t.name as template_name,
        t.type as template_type
      FROM active_contracts contracts
      LEFT JOIN active_projects p ON contracts.project_id = p.id
      LEFT JOIN active_clients c ON contracts.client_id = c.id
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
    return rows.map((row) => toContract(row as ContractRow));
  }

  async getContract(contractId: number): Promise<Contract> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT
        contracts.*,
        p.project_name as project_name,
        COALESCE(c.billing_name, c.contact_name) as client_name,
        COALESCE(c.billing_email, c.email) as client_email,
        t.name as template_name,
        t.type as template_type
       FROM active_contracts contracts
       LEFT JOIN active_projects p ON contracts.project_id = p.id
       LEFT JOIN active_clients c ON contracts.client_id = c.id
       LEFT JOIN contract_templates t ON contracts.template_id = t.id
       WHERE contracts.id = ?`,
      [contractId]
    );

    if (!row) {
      throw new NotFoundError('contract');
    }

    return toContract(row as ContractRow);
  }

  async createContract(data: ContractCreateData): Promise<Contract> {
    const db = getDatabase();
    const status = data.status || 'draft';

    if (!CONTRACT_STATUSES.includes(status)) {
      throw new ValidationError('Invalid contract status');
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
        throw new ValidationError('Invalid contract status');
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

    updates.push('updated_at = datetime(\'now\')');
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
        COALESCE(c.billing_name, c.contact_name) as client_name,
        COALESCE(c.billing_email, c.email) as client_email,
        t.name as template_name,
        t.type as template_type
       FROM active_contracts contracts
       LEFT JOIN active_projects p ON contracts.project_id = p.id
       LEFT JOIN active_clients c ON contracts.client_id = c.id
       LEFT JOIN contract_templates t ON contracts.template_id = t.id
       WHERE contracts.signature_token = ?`,
      [token]
    );

    if (!row) {
      return null;
    }

    return toContract(row as ContractRow);
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

  // ============================================
  // ROUTE-LEVEL DB ACCESS METHODS
  // ============================================

  /**
   * Get project with client info for PDF generation
   */
  async getProjectWithClientForPdf(projectId: number): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT p.*, COALESCE(c.billing_name, c.contact_name) as client_name,
              COALESCE(c.billing_email, c.email) as client_email,
              COALESCE(c.billing_company, c.company_name) as company_name,
              COALESCE(c.billing_phone, c.phone) as client_phone,
              c.address as client_address
       FROM active_projects p
       JOIN active_clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );
    return (row as Record<string, unknown>) || null;
  }

  /**
   * Get the latest active contract for a project (excludes cancelled)
   */
  async getLatestActiveContract(projectId: number): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const CONTRACT_COLUMNS = `
      id, template_id, project_id, client_id, content, status, variables,
      sent_at, signed_at, expires_at, signer_name, signer_email, signer_ip,
      signer_user_agent, signature_data, countersigned_at, countersigner_name,
      countersigner_email, countersigner_ip, countersigner_user_agent,
      countersignature_data, signed_pdf_path, parent_contract_id, renewal_at,
      renewal_reminder_sent_at, last_reminder_at, reminder_count,
      signature_token, signature_requested_at, signature_expires_at,
      created_at, updated_at
    `.replace(/\s+/g, ' ').trim();

    const row = await db.get(
      `SELECT ${CONTRACT_COLUMNS} FROM active_contracts WHERE project_id = ? AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );
    return (row as Record<string, unknown>) || null;
  }

  /**
   * Get the latest active contract ID for a project
   */
  async getLatestActiveContractId(projectId: number): Promise<number | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT id FROM active_contracts WHERE project_id = ? AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );
    if (!row) return null;
    return (row as Record<string, unknown>).id as number;
  }

  /**
   * Get latest active contract ID and status for a project
   */
  async getLatestActiveContractIdAndStatus(projectId: number): Promise<{ id: number; status: string } | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT id, status FROM active_contracts WHERE project_id = ? AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );
    if (!row) return null;
    const r = row as Record<string, unknown>;
    return { id: r.id as number, status: r.status as string };
  }

  /**
   * Save signed PDF path on the project record
   */
  async updateProjectSignedPdfPath(projectId: number, relativePath: string): Promise<void> {
    const db = getDatabase();
    await db.run('UPDATE projects SET contract_signed_pdf_path = ? WHERE id = ?', [
      relativePath,
      projectId
    ]);
  }

  /**
   * Save signed PDF path on a contract record
   */
  async updateContractSignedPdfPath(contractId: number, relativePath: string): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE contracts SET signed_pdf_path = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [relativePath, contractId]
    );
  }

  /**
   * Get project with client info for signature request
   */
  async getProjectWithClientForSignature(projectId: number): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT p.*, COALESCE(c.billing_email, c.email) as client_email,
              COALESCE(c.billing_name, c.contact_name, c.company_name) as client_name
       FROM active_projects p
       LEFT JOIN active_clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );
    return (row as Record<string, unknown>) || null;
  }

  /**
   * Store signature request token and expiry on the project
   */
  async storeProjectSignatureRequest(
    projectId: number,
    signatureToken: string,
    expiresAt: string
  ): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE projects SET
        contract_signature_token = ?,
        contract_signature_requested_at = datetime('now'),
        contract_signature_expires_at = ?
       WHERE id = ?`,
      [signatureToken, expiresAt, projectId]
    );
  }

  /**
   * Update contract with signature request details (Phase 3.3 normalization)
   */
  async updateContractSignatureRequest(
    contractId: number,
    signatureToken: string,
    expiresAt: string
  ): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE contracts SET
        signature_token = ?,
        signature_requested_at = datetime('now'),
        signature_expires_at = ?,
        status = 'sent',
        sent_at = datetime('now'),
        expires_at = ?,
        updated_at = datetime('now')
       WHERE id = ?`,
      [signatureToken, expiresAt, expiresAt, contractId]
    );
  }

  /**
   * Log a contract signature action to the audit log
   */
  async logSignatureAction(params: {
    projectId: number;
    contractId?: number | null;
    action: string;
    actorEmail?: string;
    actorIp?: string;
    actorUserAgent?: string;
    details?: string;
  }): Promise<void> {
    const db = getDatabase();
    if (params.contractId !== undefined) {
      await db.run(
        `INSERT INTO contract_signature_log (project_id, contract_id, action, actor_email, actor_ip, actor_user_agent, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          params.projectId,
          params.contractId ?? null,
          params.action,
          params.actorEmail || null,
          params.actorIp || null,
          params.actorUserAgent || null,
          params.details || null
        ]
      );
    } else {
      await db.run(
        `INSERT INTO contract_signature_log (project_id, action, actor_email, details)
         VALUES (?, ?, ?, ?)`,
        [
          params.projectId,
          params.action,
          params.actorEmail || null,
          params.details || null
        ]
      );
    }
  }

  /**
   * Get project by signature token (public, no auth)
   */
  async getProjectBySignatureToken(token: string): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT p.id, p.project_name, p.price, p.contract_signature_expires_at,
              p.contract_signed_at, COALESCE(c.billing_name, c.contact_name, c.company_name) as client_name,
              COALESCE(c.billing_email, c.email) as client_email
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.contract_signature_token = ?`,
      [token]
    );
    return (row as Record<string, unknown>) || null;
  }

  /**
   * Log a contract view event in the audit log
   */
  async logContractView(projectId: number, ip: string, userAgent: string): Promise<void> {
    const db = getDatabase();
    await db.run(
      `INSERT INTO contract_signature_log (project_id, action, actor_ip, actor_user_agent)
       VALUES (?, 'viewed', ?, ?)`,
      [projectId, ip, userAgent]
    );
  }

  /**
   * Mark a contract as viewed (if not already signed)
   */
  async markContractViewed(contractId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE contracts SET status = \'viewed\', updated_at = datetime(\'now\') WHERE id = ?',
      [contractId]
    );
  }

  /**
   * Get project by signature token with full signing fields
   */
  async getProjectByTokenForSigning(token: string): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT p.id, p.project_name, p.contract_signature_expires_at, p.contract_signed_at,
              COALESCE(c.billing_name, c.contact_name, c.company_name) as client_name,
              COALESCE(c.billing_email, c.email) as client_email
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.contract_signature_token = ?`,
      [token]
    );
    return (row as Record<string, unknown>) || null;
  }

  /**
   * Update project with client signature data
   */
  async updateProjectWithSignature(
    projectId: number,
    data: {
      signedAt: string;
      signerName: string;
      clientEmail: string;
      signerIp: string;
      signerUserAgent: string;
      signatureData: string;
    }
  ): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE projects SET
        contract_signed_at = ?,
        contract_signature_token = NULL,
        contract_signature_expires_at = NULL,
        contract_signer_name = ?,
        contract_signer_email = ?,
        contract_signer_ip = ?,
        contract_signer_user_agent = ?,
        contract_signature_data = ?
       WHERE id = ?`,
      [data.signedAt, data.signerName, data.clientEmail, data.signerIp, data.signerUserAgent, data.signatureData, projectId]
    );
  }

  /**
   * Update contract with client signature data (Phase 3.3 normalization)
   */
  async updateContractWithSignature(
    contractId: number,
    data: {
      signedAt: string;
      signerName: string;
      clientEmail: string;
      signerIp: string;
      signerUserAgent: string;
      signatureData: string;
    }
  ): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE contracts SET
        status = 'signed',
        signed_at = ?,
        signature_token = NULL,
        signature_expires_at = NULL,
        signer_name = ?,
        signer_email = ?,
        signer_ip = ?,
        signer_user_agent = ?,
        signature_data = ?,
        updated_at = datetime('now')
       WHERE id = ?`,
      [data.signedAt, data.signerName, data.clientEmail, data.signerIp, data.signerUserAgent, data.signatureData, contractId]
    );
  }

  /**
   * Get project for countersigning (admin only)
   */
  async getProjectForCountersign(projectId: number): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT id, project_name, contract_signed_at
       FROM active_projects
       WHERE id = ?`,
      [projectId]
    );
    return (row as Record<string, unknown>) || null;
  }

  /**
   * Update project with countersignature data
   */
  async updateProjectWithCountersignature(
    projectId: number,
    data: {
      countersignedAt: string;
      signerName: string;
      countersignerEmail: string;
      countersignerIp: string;
      countersignerUserAgent: string;
      signatureData: string | null;
    }
  ): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE projects SET
        contract_countersigned_at = ?,
        contract_countersigner_name = ?,
        contract_countersigner_email = ?,
        contract_countersigner_ip = ?,
        contract_countersigner_user_agent = ?,
        contract_countersignature_data = ?
       WHERE id = ?`,
      [
        data.countersignedAt,
        data.signerName,
        data.countersignerEmail,
        data.countersignerIp,
        data.countersignerUserAgent,
        data.signatureData,
        projectId
      ]
    );
  }

  /**
   * Update contract with countersignature data (Phase 3.3 normalization)
   */
  async updateContractWithCountersignature(
    contractId: number,
    data: {
      countersignedAt: string;
      signerName: string;
      countersignerEmail: string;
      countersignerIp: string;
      countersignerUserAgent: string;
      signatureData: string | null;
    }
  ): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE contracts SET
        status = 'signed',
        countersigned_at = ?,
        countersigner_name = ?,
        countersigner_email = ?,
        countersigner_ip = ?,
        countersigner_user_agent = ?,
        countersignature_data = ?,
        updated_at = datetime('now')
       WHERE id = ?`,
      [
        data.countersignedAt,
        data.signerName,
        data.countersignerEmail,
        data.countersignerIp,
        data.countersignerUserAgent,
        data.signatureData,
        contractId
      ]
    );
  }

  /**
   * Get project signature status fields
   */
  async getProjectSignatureStatus(projectId: number): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT contract_signed_at, contract_signature_requested_at, contract_signature_expires_at,
              contract_signer_name, contract_signer_email, contract_signer_ip,
              contract_countersigned_at, contract_countersigner_name, contract_countersigner_email,
              contract_countersigner_ip, contract_signed_pdf_path
       FROM active_projects WHERE id = ?`,
      [projectId]
    );
    return (row as Record<string, unknown>) || null;
  }

  /**
   * Get project with client info for contract distribution emails
   */
  async getProjectWithClientForDistribution(projectId: number): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT p.id, p.project_name, p.contract_signature_token, p.contract_signature_expires_at,
              COALESCE(c.billing_name, c.contact_name) as contact_name,
              COALESCE(c.billing_email, c.email) as email
       FROM active_projects p
       LEFT JOIN active_clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );
    return (row as Record<string, unknown>) || null;
  }

  /**
   * Get project with client info for renewal reminders (lighter query)
   */
  async getProjectWithClientForRenewal(projectId: number): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT p.project_name,
              COALESCE(c.billing_name, c.contact_name) as contact_name,
              COALESCE(c.billing_email, c.email) as email
       FROM active_projects p
       LEFT JOIN active_clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );
    return (row as Record<string, unknown>) || null;
  }

  /**
   * Generate and store a signature token for a project if one doesn't exist.
   * Returns the token.
   */
  async ensureProjectSignatureToken(projectId: number): Promise<string> {
    const db = getDatabase();
    const existing = await db.get(
      'SELECT contract_signature_token FROM projects WHERE id = ?',
      [projectId]
    );
    const existingToken = (existing as Record<string, unknown>)?.contract_signature_token as string | null;

    if (existingToken) return existingToken;

    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    const CONTRACT_SIGNATURE_EXPIRY_DAYS = 30;
    expiresAt.setDate(expiresAt.getDate() + CONTRACT_SIGNATURE_EXPIRY_DAYS);

    await db.run(
      'UPDATE projects SET contract_signature_token = ?, contract_signature_expires_at = ? WHERE id = ?',
      [token, expiresAt.toISOString(), projectId]
    );

    return token;
  }

  /**
   * Expire the project-level signature token and request
   */
  async expireProjectSignatureToken(projectId: number): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();
    await db.run(
      `UPDATE projects SET
        contract_signature_expires_at = ?,
        contract_signature_token = NULL
       WHERE id = ?`,
      [now, projectId]
    );
  }

  /**
   * Update contract reminder tracking fields
   */
  async updateContractReminder(contractId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE contracts SET last_reminder_at = datetime('now'), reminder_count = COALESCE(reminder_count, 0) + 1
       WHERE id = ?`,
      [contractId]
    );
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
  /**
   * Get all non-cancelled contracts for a client (portal view).
   */
  async getClientContracts(clientId: number): Promise<Record<string, unknown>[]> {
    const db = getDatabase();
    return db.all(`
      SELECT
        c.id,
        c.project_id as projectId,
        p.project_name as projectName,
        c.status,
        c.signed_at as signedAt,
        c.created_at as createdAt,
        c.expires_at as expiresAt
      FROM active_contracts c
      LEFT JOIN active_projects p ON c.project_id = p.id
      WHERE c.client_id = ?
        AND c.status != 'cancelled'
      ORDER BY c.created_at DESC
    `, [clientId]) as Promise<Record<string, unknown>[]>;
  }

  /**
   * Get the project_id for a contract (used for activity log isolation).
   */
  async getContractProjectId(contractId: number): Promise<number | null> {
    const db = getDatabase();
    const row = await db.get('SELECT project_id FROM active_contracts WHERE id = ?', [contractId]);
    if (!row) return null;
    return (row as Record<string, unknown>).project_id as number | null;
  }

  /**
   * Get activity log entries for a contract, filtered by both project_id and contract_id.
   */
  async getContractActivity(contractId: number, projectId: number | null): Promise<Record<string, unknown>[]> {
    const db = getDatabase();
    return db.all(
      `SELECT id, action, actor_email, actor_ip, actor_user_agent, details, created_at
       FROM contract_signature_log
       WHERE project_id = ? AND contract_id = ?
       ORDER BY created_at DESC`,
      [projectId, contractId]
    ) as Promise<Record<string, unknown>[]>;
  }

  /**
   * Fetch a contract for signing validation (includes project info).
   * Returns raw row with client_id, status, signed_at, project_name etc.
   */
  async getContractForSigning(contractId: number): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT c.id, c.project_id, c.client_id, c.status, c.signed_at,
              p.project_name
       FROM active_contracts c
       LEFT JOIN active_projects p ON c.project_id = p.id
       WHERE c.id = ?`,
      [contractId]
    );
    return (row as Record<string, unknown>) || null;
  }

  /**
   * Sign a contract from the portal (authenticated client).
   * Updates contract, dual-writes to project, and logs the action.
   */
  async signContractFromPortal(params: {
    contractId: number;
    projectId: number | null;
    signedAt: string;
    signerName: string;
    clientEmail: string;
    signerIp: string;
    signerUserAgent: string;
    signatureData: string;
  }): Promise<void> {
    const db = getDatabase();

    // Update contracts table
    await db.run(
      `UPDATE contracts SET
        status = 'signed',
        signed_at = ?,
        signer_name = ?,
        signer_email = ?,
        signer_ip = ?,
        signer_user_agent = ?,
        signature_data = ?,
        signature_token = NULL,
        signature_expires_at = NULL,
        updated_at = datetime('now')
       WHERE id = ?`,
      [params.signedAt, params.signerName, params.clientEmail, params.signerIp,
        params.signerUserAgent, params.signatureData, params.contractId]
    );

    // Dual-write: update projects table signature fields
    if (params.projectId) {
      await db.run(
        `UPDATE projects SET
          contract_signed_at = ?,
          contract_signature_token = NULL,
          contract_signature_expires_at = NULL,
          contract_signer_name = ?,
          contract_signer_email = ?,
          contract_signer_ip = ?,
          contract_signer_user_agent = ?,
          contract_signature_data = ?
         WHERE id = ?`,
        [params.signedAt, params.signerName, params.clientEmail, params.signerIp,
          params.signerUserAgent, params.signatureData, params.projectId]
      );
    }

    // Log to contract_signature_log
    await db.run(
      `INSERT INTO contract_signature_log (project_id, contract_id, action, actor_email, actor_ip, actor_user_agent, details)
       VALUES (?, ?, 'signed', ?, ?, ?, ?)`,
      [
        params.projectId || null,
        params.contractId,
        params.clientEmail,
        params.signerIp,
        params.signerUserAgent,
        JSON.stringify({ signerName: params.signerName, signedAt: params.signedAt, method: 'portal' })
      ]
    );
  }
}

export const contractService = new ContractService();
