/**
 * ===============================================
 * PROPOSAL SERVICE
 * ===============================================
 * @file server/services/proposal-service.ts
 *
 * Service for advanced proposal management:
 * - Templates
 * - Versioning
 * - E-signatures
 * - Comments/Collaboration
 * - Activity tracking
 * - Custom items
 * - Discounts
 * - Expiration & reminders
 */

import { getDatabase } from '../database/init.js';
import { getString, getNumber } from '../database/row-helpers.js';
import * as crypto from 'crypto';
import { logger } from './logger.js';
import { getBaseUrl } from '../config/environment.js';
import {
  validateJsonSchema,
  validateLineItems,
  tierStructureSchema
} from '../../shared/validation/validators.js';
import {
  emailService,
  isClientActivated,
  type ProposalSignedData,
  type ProposalSignedClientData
} from './email-service.js';
import {
  type ProposalTemplate,
  type ProposalVersion,
  type ProposalSignature,
  type ProposalComment,
  type ProposalActivity,
  type ProposalCustomItem,
  type SignatureRequest,
  type ProposalTemplateRow,
  type ProposalVersionRow,
  type ProposalSignatureRow,
  type ProposalCommentRow,
  type ProposalActivityRow,
  type ProposalCustomItemRow,
  type SignatureRequestRow,
  toProposalTemplate,
  toProposalVersion,
  toProposalSignature,
  toProposalComment,
  toProposalActivity,
  toProposalCustomItem,
  toSignatureRequest
} from '../database/entities/index.js';

interface TemplateCreateData {
  name: string;
  description?: string;
  projectType?: string;
  tierStructure?: object;
  defaultLineItems?: object[];
  termsAndConditions?: string;
  validityDays?: number;
  isDefault?: boolean;
}

interface SignatureData {
  signerName: string;
  signerEmail: string;
  signerTitle?: string;
  signerCompany?: string;
  signatureMethod: 'drawn' | 'typed' | 'uploaded';
  signatureData: string;
  ipAddress?: string;
  userAgent?: string;
}

interface CustomItemData {
  itemType?: string;
  description: string;
  quantity?: number;
  unitPrice: number;
  unitLabel?: string;
  category?: string;
  isTaxable?: boolean;
  isOptional?: boolean;
  sortOrder?: number;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// =====================================================
// COLUMN CONSTANTS - Explicit column lists for SELECT queries
// =====================================================

const PROPOSAL_REQUEST_COLUMNS = `
  id, project_id, client_id, project_type, selected_tier, base_price, final_price,
  maintenance_option, status, client_notes, admin_notes, created_at, reviewed_at, reviewed_by
`.replace(/\s+/g, ' ').trim();

const PROPOSAL_TEMPLATE_COLUMNS = `
  id, name, description, project_type, tier_structure, default_line_items,
  terms_and_conditions, validity_days, is_default, is_active, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const PROPOSAL_VERSION_COLUMNS = `
  id, proposal_id, version_number, tier_data, features_data, pricing_data,
  notes, created_by, created_at
`.replace(/\s+/g, ' ').trim();

const PROPOSAL_SIGNATURE_COLUMNS = `
  id, proposal_id, signer_name, signer_email, signer_title, signer_company,
  signature_method, signature_data, ip_address, user_agent, signed_at
`.replace(/\s+/g, ' ').trim();

const PROPOSAL_COMMENT_COLUMNS = `
  id, proposal_id, author_type, author_name, author_email, content, is_internal,
  parent_comment_id, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const PROPOSAL_ACTIVITY_COLUMNS = `
  id, proposal_id, activity_type, actor, actor_type, metadata, ip_address,
  user_agent, created_at
`.replace(/\s+/g, ' ').trim();

const PROPOSAL_CUSTOM_ITEM_COLUMNS = `
  id, proposal_id, item_type, description, quantity, unit_price, unit_label,
  category, is_taxable, is_optional, sort_order, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const SIGNATURE_REQUEST_COLUMNS = `
  id, proposal_id, signer_email, signer_name, request_token, status, sent_at,
  viewed_at, signed_at, declined_at, decline_reason, expires_at, reminder_count,
  last_reminder_at, created_at
`.replace(/\s+/g, ' ').trim();

const PROPOSAL_FEATURE_SELECTION_COLUMNS = `
  id, proposal_request_id, feature_id, feature_name, feature_price, feature_category,
  is_included_in_tier, is_addon, created_at
`.replace(/\s+/g, ' ').trim();

// =====================================================
// PROPOSAL SERVICE CLASS
// =====================================================

class ProposalService {
  // =====================================================
  // TEMPLATE METHODS
  // =====================================================

  /**
   * Create a new proposal template
   */
  async createTemplate(data: TemplateCreateData): Promise<ProposalTemplate> {
    const db = getDatabase();

    // Validate JSON fields
    if (data.tierStructure) {
      const tierResult = validateJsonSchema(
        data.tierStructure,
        tierStructureSchema,
        'Tier structure'
      );
      if (!tierResult.isValid) {
        throw new Error(tierResult.error);
      }
    }

    if (data.defaultLineItems) {
      const lineItemsResult = validateLineItems(data.defaultLineItems, 'Default line items');
      if (!lineItemsResult.isValid) {
        throw new Error(lineItemsResult.error);
      }
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await db.run('UPDATE proposal_templates SET is_default = FALSE WHERE project_type = ?', [
        data.projectType
      ]);
    }

    const result = await db.run(
      `INSERT INTO proposal_templates (
        name, description, project_type, tier_structure, default_line_items,
        terms_and_conditions, validity_days, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        data.name,
        data.description || null,
        data.projectType || null,
        data.tierStructure ? JSON.stringify(data.tierStructure) : null,
        data.defaultLineItems ? JSON.stringify(data.defaultLineItems) : null,
        data.termsAndConditions || null,
        data.validityDays || 30,
        data.isDefault ? 1 : 0
      ]
    );

    return this.getTemplate(result.lastID!);
  }

  /**
   * Get all proposal templates
   */
  async getTemplates(projectType?: string): Promise<ProposalTemplate[]> {
    const db = getDatabase();

    let query = `SELECT ${PROPOSAL_TEMPLATE_COLUMNS} FROM proposal_templates WHERE is_active = TRUE`;
    const params: string[] = [];

    if (projectType) {
      query += ' AND project_type = ?';
      params.push(projectType);
    }

    query += ' ORDER BY is_default DESC, name ASC';

    const rows = await db.all(query, params);
    return rows.map((row) => toProposalTemplate(row as ProposalTemplateRow));
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(templateId: number): Promise<ProposalTemplate> {
    const db = getDatabase();
    const row = await db.get(`SELECT ${PROPOSAL_TEMPLATE_COLUMNS} FROM proposal_templates WHERE id = ?`, [templateId]);

    if (!row) {
      throw new Error('Template not found');
    }

    return toProposalTemplate(row as ProposalTemplateRow);
  }

  /**
   * Update a template
   */
  async updateTemplate(
    templateId: number,
    data: Partial<TemplateCreateData>
  ): Promise<ProposalTemplate> {
    const db = getDatabase();

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description || null);
    }
    if (data.projectType !== undefined) {
      updates.push('project_type = ?');
      params.push(data.projectType || null);
    }
    if (data.tierStructure !== undefined) {
      updates.push('tier_structure = ?');
      params.push(data.tierStructure ? JSON.stringify(data.tierStructure) : null);
    }
    if (data.defaultLineItems !== undefined) {
      updates.push('default_line_items = ?');
      params.push(data.defaultLineItems ? JSON.stringify(data.defaultLineItems) : null);
    }
    if (data.termsAndConditions !== undefined) {
      updates.push('terms_and_conditions = ?');
      params.push(data.termsAndConditions || null);
    }
    if (data.validityDays !== undefined) {
      updates.push('validity_days = ?');
      params.push(data.validityDays);
    }
    if (data.isDefault !== undefined) {
      // Unset other defaults first
      if (data.isDefault) {
        const template = await this.getTemplate(templateId);
        await db.run('UPDATE proposal_templates SET is_default = FALSE WHERE project_type = ?', [
          template.projectType
        ]);
      }
      updates.push('is_default = ?');
      params.push(data.isDefault ? 1 : 0);
    }

    updates.push('updated_at = datetime(\'now\')');
    params.push(templateId);

    await db.run(`UPDATE proposal_templates SET ${updates.join(', ')} WHERE id = ?`, params);

    return this.getTemplate(templateId);
  }

  /**
   * Delete a template (soft delete by setting inactive)
   */
  async deleteTemplate(templateId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE proposal_templates SET is_active = FALSE, updated_at = datetime(\'now\') WHERE id = ?',
      [templateId]
    );
  }

  // =====================================================
  // VERSIONING METHODS
  // =====================================================

  /**
   * Create a new version of a proposal
   */
  async createVersion(
    proposalId: number,
    createdBy?: string,
    notes?: string
  ): Promise<ProposalVersion> {
    const db = getDatabase();

    // Get current proposal data
    const proposal = await db.get(`SELECT ${PROPOSAL_REQUEST_COLUMNS} FROM proposal_requests WHERE id = ?`, [proposalId]);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    // Get current features
    const features = await db.all(
      `SELECT ${PROPOSAL_FEATURE_SELECTION_COLUMNS} FROM proposal_feature_selections WHERE proposal_request_id = ?`,
      [proposalId]
    );

    // Get current version number
    const lastVersion = await db.get(
      'SELECT MAX(version_number) as max FROM proposal_versions WHERE proposal_id = ?',
      [proposalId]
    );
    const newVersionNumber = (((lastVersion as Record<string, unknown>)?.max as number) || 0) + 1;

    const p = proposal as Record<string, unknown>;

    const result = await db.run(
      `INSERT INTO proposal_versions (
        proposal_id, version_number, tier_data, features_data, pricing_data,
        notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        proposalId,
        newVersionNumber,
        JSON.stringify({
          selectedTier: getString(p, 'selected_tier'),
          maintenanceOption: p.maintenance_option
        }),
        JSON.stringify(features),
        JSON.stringify({
          basePrice: getNumber(p, 'base_price'),
          finalPrice: getNumber(p, 'final_price'),
          discountType: p.discount_type,
          discountValue: p.discount_value,
          taxRate: p.tax_rate,
          subtotal: p.subtotal,
          taxAmount: p.tax_amount
        }),
        notes || null,
        createdBy || null
      ]
    );

    // Update proposal version number
    await db.run('UPDATE proposal_requests SET version_number = ? WHERE id = ?', [
      newVersionNumber,
      proposalId
    ]);

    return this.getVersion(result.lastID!);
  }

  /**
   * Get all versions of a proposal
   */
  async getVersions(proposalId: number): Promise<ProposalVersion[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT ${PROPOSAL_VERSION_COLUMNS} FROM proposal_versions WHERE proposal_id = ? ORDER BY version_number DESC`,
      [proposalId]
    );
    return rows.map((row) => toProposalVersion(row as ProposalVersionRow));
  }

  /**
   * Get a specific version
   */
  async getVersion(versionId: number): Promise<ProposalVersion> {
    const db = getDatabase();
    const row = await db.get(`SELECT ${PROPOSAL_VERSION_COLUMNS} FROM proposal_versions WHERE id = ?`, [versionId]);

    if (!row) {
      throw new Error('Version not found');
    }

    return toProposalVersion(row as ProposalVersionRow);
  }

  /**
   * Restore a previous version
   */
  async restoreVersion(proposalId: number, versionId: number): Promise<void> {
    const db = getDatabase();

    const version = await this.getVersion(versionId);
    if (version.proposalId !== proposalId) {
      throw new Error('Version does not belong to this proposal');
    }

    await db.transaction(async (ctx) => {
      // Update proposal with version data
      const pricing = (version.pricingData as Record<string, unknown>) || {};
      const tier = (version.tierData as Record<string, unknown>) || {};

      await ctx.run(
        `UPDATE proposal_requests SET
          selected_tier = ?,
          maintenance_option = ?,
          base_price = ?,
          final_price = ?,
          discount_type = ?,
          discount_value = ?,
          tax_rate = ?,
          subtotal = ?,
          tax_amount = ?
        WHERE id = ?`,
        [
          tier.selectedTier as string | null,
          tier.maintenanceOption as string | null,
          pricing.basePrice as number | null,
          pricing.finalPrice as number | null,
          pricing.discountType as string | null,
          pricing.discountValue as number | null,
          pricing.taxRate as number | null,
          pricing.subtotal as number | null,
          pricing.taxAmount as number | null,
          proposalId
        ]
      );

      // Restore features
      await ctx.run('DELETE FROM proposal_feature_selections WHERE proposal_request_id = ?', [
        proposalId
      ]);

      if (version.featuresData && Array.isArray(version.featuresData)) {
        for (const feature of version.featuresData) {
          const f = feature as Record<string, unknown>;
          await ctx.run(
            `INSERT INTO proposal_feature_selections (
              proposal_request_id, feature_id, feature_name, feature_price,
              feature_category, is_included_in_tier, is_addon
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              proposalId,
              f.feature_id as number | null,
              f.feature_name as string | null,
              f.feature_price as number | null,
              f.feature_category as string | null,
              f.is_included_in_tier as number | boolean | null,
              f.is_addon as number | boolean | null
            ]
          );
        }
      }
    });

    // Log activity
    await this.logActivity(proposalId, 'version_restored', 'system', 'system', {
      restoredVersionId: versionId,
      restoredVersionNumber: version.versionNumber
    });
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    versionId1: number,
    versionId2: number
  ): Promise<{
    version1: ProposalVersion;
    version2: ProposalVersion;
    differences: object;
  }> {
    const version1 = await this.getVersion(versionId1);
    const version2 = await this.getVersion(versionId2);

    const differences: Record<string, { v1: unknown; v2: unknown }> = {};

    // Compare pricing
    const p1 = (version1.pricingData as Record<string, unknown>) || {};
    const p2 = (version2.pricingData as Record<string, unknown>) || {};

    for (const key of ['basePrice', 'finalPrice', 'discountType', 'discountValue', 'taxRate']) {
      if (p1[key] !== p2[key]) {
        differences[key] = { v1: p1[key], v2: p2[key] };
      }
    }

    // Compare tier
    const t1 = (version1.tierData as Record<string, unknown>) || {};
    const t2 = (version2.tierData as Record<string, unknown>) || {};

    if (t1.selectedTier !== t2.selectedTier) {
      differences['selectedTier'] = { v1: t1.selectedTier, v2: t2.selectedTier };
    }

    // Compare feature counts
    const f1 = version1.featuresData || [];
    const f2 = version2.featuresData || [];

    if (f1.length !== f2.length) {
      differences['featureCount'] = { v1: f1.length, v2: f2.length };
    }

    return { version1, version2, differences };
  }

  // =====================================================
  // E-SIGNATURE METHODS
  // =====================================================

  /**
   * Request a signature on a proposal
   */
  async requestSignature(
    proposalId: number,
    signerEmail: string,
    signerName?: string,
    expiresInDays = 7
  ): Promise<SignatureRequest> {
    const db = getDatabase();

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const result = await db.run(
      `INSERT INTO signature_requests (
        proposal_id, signer_email, signer_name, request_token, status,
        expires_at, sent_at, created_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))`,
      [proposalId, signerEmail, signerName || null, token, expiresAt.toISOString()]
    );

    // Update proposal to require signature
    await db.run('UPDATE proposal_requests SET requires_signature = TRUE WHERE id = ?', [
      proposalId
    ]);

    // Log activity
    await this.logActivity(proposalId, 'signature_requested', 'system', 'system', {
      signerEmail,
      requestId: result.lastID
    });

    return this.getSignatureRequest(result.lastID!);
  }

  /**
   * Get signature request by ID
   */
  async getSignatureRequest(requestId: number): Promise<SignatureRequest> {
    const db = getDatabase();
    const row = await db.get(`SELECT ${SIGNATURE_REQUEST_COLUMNS} FROM signature_requests WHERE id = ?`, [requestId]);

    if (!row) {
      throw new Error('Signature request not found');
    }

    return toSignatureRequest(row as SignatureRequestRow);
  }

  /**
   * Get signature request by token
   */
  async getSignatureRequestByToken(token: string): Promise<SignatureRequest | null> {
    const db = getDatabase();
    const row = await db.get(`SELECT ${SIGNATURE_REQUEST_COLUMNS} FROM signature_requests WHERE request_token = ?`, [token]);

    if (!row) {
      return null;
    }

    return toSignatureRequest(row as SignatureRequestRow);
  }

  /**
   * Record a signature
   */
  async recordSignature(proposalId: number, data: SignatureData): Promise<ProposalSignature> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO proposal_signatures (
        proposal_id, signer_name, signer_email, signer_title, signer_company,
        signature_method, signature_data, ip_address, user_agent, signed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        proposalId,
        data.signerName,
        data.signerEmail,
        data.signerTitle || null,
        data.signerCompany || null,
        data.signatureMethod,
        data.signatureData,
        data.ipAddress || null,
        data.userAgent || null
      ]
    );

    // Update proposal as signed and legally binding
    await db.run(
      `UPDATE proposal_requests SET
        signed_at = datetime('now'),
        is_legally_binding = TRUE,
        terms_accepted_at = datetime('now'),
        status = 'accepted'
       WHERE id = ?`,
      [proposalId]
    );

    // Update signature request if exists
    await db.run(
      `UPDATE signature_requests SET
        status = 'signed', signed_at = datetime('now')
       WHERE proposal_id = ? AND signer_email = ? AND status IN ('pending', 'viewed')`,
      [proposalId, data.signerEmail]
    );

    // Log activity
    await this.logActivity(
      proposalId,
      'signed',
      data.signerName,
      'client',
      {
        signatureMethod: data.signatureMethod,
        signerEmail: data.signerEmail
      },
      data.ipAddress,
      data.userAgent
    );

    // Send admin notification with tier info
    await this.sendProposalSignedNotification(proposalId, data);

    return this.getSignature(result.lastID!);
  }

  /**
   * Send notification to admin when proposal is signed
   */
  private async sendProposalSignedNotification(
    proposalId: number,
    signatureData: SignatureData
  ): Promise<void> {
    const db = getDatabase();

    try {
      // Get proposal with project and client details
      const proposal = await db.get(
        `
        SELECT
          pr.*,
          p.project_name as project_name,
          p.project_type,
          COALESCE(c.contact_name, c.company_name) as client_name,
          c.company_name,
          c.email as client_email
        FROM proposal_requests pr
        LEFT JOIN projects p ON pr.project_id = p.id
        LEFT JOIN clients c ON pr.client_id = c.id
        WHERE pr.id = ?
      `,
        [proposalId]
      );

      if (!proposal) {
        logger.error(`[PROPOSAL] Cannot send notification - proposal not found: ${proposalId}`);
        return;
      }

      const p = proposal as Record<string, unknown>;

      // Get add-on features
      const features = await db.all(
        `
        SELECT feature_name, feature_price
        FROM proposal_feature_selections
        WHERE proposal_request_id = ? AND is_addon = TRUE
      `,
        [proposalId]
      );

      // Map tier to display name
      const tierNames: Record<string, string> = {
        good: 'Good',
        better: 'Better',
        best: 'Best'
      };

      const selectedTier = getString(p, 'selected_tier') as 'good' | 'better' | 'best';
      const tierName = tierNames[selectedTier] || selectedTier;

      // Format price
      const finalPrice = getNumber(p, 'final_price') || 0;
      const formattedPrice = finalPrice.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });

      // Format signed timestamp
      const signedAt = new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      // Build notification data
      const notificationData: ProposalSignedData = {
        clientName: getString(p, 'client_name') || 'Unknown Client',
        companyName: p.company_name as string | undefined,
        projectName: getString(p, 'project_name') || 'Untitled Project',
        projectType: getString(p, 'project_type') || 'General',
        projectId: getNumber(p, 'project_id') || proposalId,
        selectedTier,
        tierName,
        finalPrice: formattedPrice,
        maintenanceOption: p.maintenance_option as string | undefined,
        addedFeatures: features.map((f) => ({
          name: getString(f as Record<string, unknown>, 'feature_name'),
          price: (getNumber(f as Record<string, unknown>, 'feature_price') || 0).toLocaleString()
        })),
        signerName: signatureData.signerName,
        signerEmail: signatureData.signerEmail,
        signedAt,
        ipAddress: signatureData.ipAddress || 'Unknown'
      };

      // Send admin notification
      const adminResult = await emailService.sendProposalSignedNotification(notificationData);

      if (adminResult.success) {
        logger.info(`[PROPOSAL] Admin notification sent for proposal: ${proposalId}`);
      } else {
        logger.error(`[PROPOSAL] Failed to send admin notification: ${adminResult.message}`);
      }

      // Send client confirmation email only if client account is activated
      const clientId = getNumber(p, 'client_id');
      const isActivated = clientId ? await isClientActivated(clientId) : false;

      if (isActivated) {
        const baseUrl = getBaseUrl();
        const clientData: ProposalSignedClientData = {
          ...notificationData,
          portalUrl: `${baseUrl}/client/portal`,
          supportEmail:
            process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL || 'support@nobhadcodes.com'
        };

        const clientResult = await emailService.sendProposalSignedClientConfirmation(clientData);

        if (clientResult.success) {
          logger.info(`[PROPOSAL] Client confirmation sent for proposal: ${proposalId}`);
        } else {
          logger.error(`[PROPOSAL] Failed to send client confirmation: ${clientResult.message}`);
        }
      } else {
        logger.info(
          `[PROPOSAL] Skipping client confirmation email for proposal ${proposalId} - client account not activated`
        );
      }
    } catch (error) {
      logger.error('[PROPOSAL] Error sending proposal signed notifications:', {
        error: error instanceof Error ? error : undefined
      });
    }
  }

  /**
   * Get signature by ID
   */
  async getSignature(signatureId: number): Promise<ProposalSignature> {
    const db = getDatabase();
    const row = await db.get(`SELECT ${PROPOSAL_SIGNATURE_COLUMNS} FROM proposal_signatures WHERE id = ?`, [signatureId]);

    if (!row) {
      throw new Error('Signature not found');
    }

    return toProposalSignature(row as ProposalSignatureRow);
  }

  /**
   * Get all signatures for a proposal
   */
  async getProposalSignatures(proposalId: number): Promise<ProposalSignature[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT ${PROPOSAL_SIGNATURE_COLUMNS} FROM proposal_signatures WHERE proposal_id = ? ORDER BY signed_at DESC`,
      [proposalId]
    );
    return rows.map((row) => toProposalSignature(row as ProposalSignatureRow));
  }

  /**
   * Get signature status for a proposal
   */
  async getSignatureStatus(proposalId: number): Promise<{
    requiresSignature: boolean;
    isSigned: boolean;
    signatures: ProposalSignature[];
    pendingRequests: SignatureRequest[];
  }> {
    const db = getDatabase();

    const proposal = await db.get(
      'SELECT requires_signature, signed_at FROM proposal_requests WHERE id = ?',
      [proposalId]
    );
    const p = proposal as Record<string, unknown>;

    const signatures = await this.getProposalSignatures(proposalId);

    const pendingRows = await db.all(
      '`SELECT ${SIGNATURE_REQUEST_COLUMNS} FROM signature_requests WHERE proposal_id = ? AND status IN (\'pending\', \'viewed\')`',
      [proposalId]
    );
    const pendingRequests = pendingRows.map((row) =>
      toSignatureRequest(row as SignatureRequestRow)
    );

    return {
      requiresSignature: Boolean(p.requires_signature),
      isSigned: p.signed_at !== null,
      signatures,
      pendingRequests
    };
  }

  /**
   * Mark signature request as viewed
   */
  async markSignatureViewed(token: string): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE signature_requests SET
        status = CASE WHEN status = 'pending' THEN 'viewed' ELSE status END,
        viewed_at = COALESCE(viewed_at, datetime('now'))
       WHERE request_token = ?`,
      [token]
    );
  }

  /**
   * Decline signature
   */
  async declineSignature(token: string, reason?: string): Promise<void> {
    const db = getDatabase();

    const request = await this.getSignatureRequestByToken(token);
    if (!request) {
      throw new Error('Signature request not found');
    }

    await db.run(
      `UPDATE signature_requests SET
        status = 'declined', declined_at = datetime('now'), decline_reason = ?
       WHERE request_token = ?`,
      [reason || null, token]
    );

    // Log activity
    await this.logActivity(
      request.proposalId,
      'signature_declined',
      request.signerName || request.signerEmail,
      'client',
      {
        reason
      }
    );
  }

  // =====================================================
  // COMMENT METHODS
  // =====================================================

  /**
   * Add a comment to a proposal
   */
  async addComment(
    proposalId: number,
    authorType: 'admin' | 'client',
    authorName: string,
    content: string,
    authorEmail?: string,
    isInternal = false,
    parentCommentId?: number
  ): Promise<ProposalComment> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO proposal_comments (
        proposal_id, author_type, author_name, author_email, content,
        is_internal, parent_comment_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        proposalId,
        authorType,
        authorName,
        authorEmail || null,
        content,
        isInternal ? 1 : 0,
        parentCommentId || null
      ]
    );

    // Log activity
    await this.logActivity(proposalId, 'commented', authorName, authorType, {
      commentId: result.lastID,
      isInternal
    });

    return this.getComment(result.lastID!);
  }

  /**
   * Get a comment by ID
   */
  async getComment(commentId: number): Promise<ProposalComment> {
    const db = getDatabase();
    const row = await db.get(`SELECT ${PROPOSAL_COMMENT_COLUMNS} FROM proposal_comments WHERE id = ?`, [commentId]);

    if (!row) {
      throw new Error('Comment not found');
    }

    return toProposalComment(row as ProposalCommentRow);
  }

  /**
   * Get all comments for a proposal
   */
  async getComments(proposalId: number, includeInternal = false): Promise<ProposalComment[]> {
    const db = getDatabase();

    let query = `SELECT ${PROPOSAL_COMMENT_COLUMNS} FROM proposal_comments WHERE proposal_id = ?`;
    if (!includeInternal) {
      query += ' AND is_internal = FALSE';
    }
    query += ' ORDER BY created_at ASC';

    const rows = await db.all(query, [proposalId]);
    const comments = rows.map((row) => toProposalComment(row as ProposalCommentRow));

    // Build threaded structure
    const rootComments: ProposalComment[] = [];
    const commentMap = new Map<number, ProposalComment>();

    for (const comment of comments) {
      commentMap.set(comment.id, comment);
      comment.replies = [];
    }

    for (const comment of comments) {
      if (comment.parentCommentId) {
        const parent = commentMap.get(comment.parentCommentId);
        if (parent) {
          parent.replies!.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    }

    return rootComments;
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM proposal_comments WHERE id = ?', [commentId]);
  }

  // =====================================================
  // ACTIVITY METHODS
  // =====================================================

  /**
   * Log an activity
   */
  async logActivity(
    proposalId: number,
    activityType: string,
    actor?: string,
    actorType?: string,
    metadata?: object,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const db = getDatabase();

    await db.run(
      `INSERT INTO proposal_activities (
        proposal_id, activity_type, actor, actor_type, metadata,
        ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        proposalId,
        activityType,
        actor || null,
        actorType || null,
        metadata ? JSON.stringify(metadata) : null,
        ipAddress || null,
        userAgent || null
      ]
    );
  }

  /**
   * Get activities for a proposal
   */
  async getActivities(proposalId: number, limit = 50): Promise<ProposalActivity[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT ${PROPOSAL_ACTIVITY_COLUMNS} FROM proposal_activities WHERE proposal_id = ? ORDER BY created_at DESC LIMIT ?`,
      [proposalId, limit]
    );
    return rows.map((row) => toProposalActivity(row as ProposalActivityRow));
  }

  /**
   * Track a proposal view
   */
  async trackView(proposalId: number, ipAddress?: string, userAgent?: string): Promise<void> {
    const db = getDatabase();

    // Update view count
    await db.run(
      `UPDATE proposal_requests SET
        view_count = view_count + 1,
        last_viewed_at = datetime('now')
       WHERE id = ?`,
      [proposalId]
    );

    // Log activity
    await this.logActivity(proposalId, 'viewed', undefined, undefined, {}, ipAddress, userAgent);
  }

  // =====================================================
  // CUSTOM ITEM METHODS
  // =====================================================

  /**
   * Add a custom item to a proposal
   */
  async addCustomItem(proposalId: number, data: CustomItemData): Promise<ProposalCustomItem> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO proposal_custom_items (
        proposal_id, item_type, description, quantity, unit_price,
        unit_label, category, is_taxable, is_optional, sort_order,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        proposalId,
        data.itemType || 'service',
        data.description,
        data.quantity || 1,
        data.unitPrice,
        data.unitLabel || null,
        data.category || null,
        data.isTaxable !== false ? 1 : 0,
        data.isOptional ? 1 : 0,
        data.sortOrder || 0
      ]
    );

    // Recalculate totals
    await this.recalculateTotals(proposalId);

    return this.getCustomItem(result.lastID!);
  }

  /**
   * Get a custom item by ID
   */
  async getCustomItem(itemId: number): Promise<ProposalCustomItem> {
    const db = getDatabase();
    const row = await db.get(`SELECT ${PROPOSAL_CUSTOM_ITEM_COLUMNS} FROM proposal_custom_items WHERE id = ?`, [itemId]);

    if (!row) {
      throw new Error('Custom item not found');
    }

    return toProposalCustomItem(row as ProposalCustomItemRow);
  }

  /**
   * Get all custom items for a proposal
   */
  async getCustomItems(proposalId: number): Promise<ProposalCustomItem[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT ${PROPOSAL_CUSTOM_ITEM_COLUMNS} FROM proposal_custom_items WHERE proposal_id = ? ORDER BY sort_order ASC`,
      [proposalId]
    );
    return rows.map((row) => toProposalCustomItem(row as ProposalCustomItemRow));
  }

  /**
   * Update a custom item
   */
  async updateCustomItem(
    itemId: number,
    data: Partial<CustomItemData>
  ): Promise<ProposalCustomItem> {
    const db = getDatabase();

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (data.itemType !== undefined) {
      updates.push('item_type = ?');
      params.push(data.itemType);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.quantity !== undefined) {
      updates.push('quantity = ?');
      params.push(data.quantity);
    }
    if (data.unitPrice !== undefined) {
      updates.push('unit_price = ?');
      params.push(data.unitPrice);
    }
    if (data.unitLabel !== undefined) {
      updates.push('unit_label = ?');
      params.push(data.unitLabel || null);
    }
    if (data.category !== undefined) {
      updates.push('category = ?');
      params.push(data.category || null);
    }
    if (data.isTaxable !== undefined) {
      updates.push('is_taxable = ?');
      params.push(data.isTaxable ? 1 : 0);
    }
    if (data.isOptional !== undefined) {
      updates.push('is_optional = ?');
      params.push(data.isOptional ? 1 : 0);
    }
    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(data.sortOrder);
    }

    updates.push('updated_at = datetime(\'now\')');
    params.push(itemId);

    await db.run(`UPDATE proposal_custom_items SET ${updates.join(', ')} WHERE id = ?`, params);

    // Get item to recalculate
    const item = await this.getCustomItem(itemId);
    await this.recalculateTotals(item.proposalId);

    return item;
  }

  /**
   * Delete a custom item
   */
  async deleteCustomItem(itemId: number): Promise<void> {
    const db = getDatabase();

    // Get proposalId first
    const item = await this.getCustomItem(itemId);

    await db.run('DELETE FROM proposal_custom_items WHERE id = ?', [itemId]);

    // Recalculate totals
    await this.recalculateTotals(item.proposalId);
  }

  // =====================================================
  // DISCOUNT METHODS
  // =====================================================

  /**
   * Apply a discount to a proposal
   */
  async applyDiscount(
    proposalId: number,
    type: 'percentage' | 'fixed',
    value: number,
    reason?: string
  ): Promise<void> {
    const db = getDatabase();

    await db.run(
      `UPDATE proposal_requests SET
        discount_type = ?,
        discount_value = ?,
        discount_reason = ?
       WHERE id = ?`,
      [type, value, reason || null, proposalId]
    );

    // Recalculate totals
    await this.recalculateTotals(proposalId);

    // Log activity
    await this.logActivity(proposalId, 'discount_applied', 'system', 'admin', {
      discountType: type,
      discountValue: value,
      reason
    });
  }

  /**
   * Remove discount from a proposal
   */
  async removeDiscount(proposalId: number): Promise<void> {
    const db = getDatabase();

    await db.run(
      `UPDATE proposal_requests SET
        discount_type = NULL,
        discount_value = 0,
        discount_reason = NULL
       WHERE id = ?`,
      [proposalId]
    );

    // Recalculate totals
    await this.recalculateTotals(proposalId);

    // Log activity
    await this.logActivity(proposalId, 'discount_removed', 'system', 'admin');
  }

  /**
   * Recalculate proposal totals
   */
  async recalculateTotals(proposalId: number): Promise<void> {
    const db = getDatabase();

    // Get proposal
    const proposal = await db.get(`SELECT ${PROPOSAL_REQUEST_COLUMNS} FROM proposal_requests WHERE id = ?`, [proposalId]);
    if (!proposal) return;

    const p = proposal as Record<string, unknown>;

    // Get feature selections
    const features = await db.all(
      'SELECT feature_price FROM proposal_feature_selections WHERE proposal_request_id = ?',
      [proposalId]
    );

    // Get custom items (non-optional only)
    const customItems = await db.all(
      'SELECT quantity, unit_price, is_taxable FROM proposal_custom_items WHERE proposal_id = ? AND is_optional = FALSE',
      [proposalId]
    );

    // Calculate subtotal
    let subtotal = getNumber(p, 'base_price') || 0;

    // Add feature prices (add-ons)
    for (const f of features) {
      const fr = f as Record<string, unknown>;
      subtotal += getNumber(fr, 'feature_price') || 0;
    }

    // Add custom items
    for (const item of customItems) {
      const i = item as Record<string, unknown>;
      subtotal += (getNumber(i, 'quantity') || 1) * (getNumber(i, 'unit_price') || 0);
    }

    // Apply discount
    let discountAmount = 0;
    const discountType = p.discount_type as string;
    const discountValue = getNumber(p, 'discount_value') || 0;

    if (discountType === 'percentage') {
      discountAmount = subtotal * (discountValue / 100);
    } else if (discountType === 'fixed') {
      discountAmount = discountValue;
    }

    const afterDiscount = subtotal - discountAmount;

    // Calculate tax
    const taxRate = getNumber(p, 'tax_rate') || 0;
    const taxAmount = afterDiscount * (taxRate / 100);

    const finalPrice = afterDiscount + taxAmount;

    // Update proposal
    await db.run(
      `UPDATE proposal_requests SET
        subtotal = ?,
        tax_amount = ?,
        final_price = ?
       WHERE id = ?`,
      [subtotal, taxAmount, finalPrice, proposalId]
    );
  }

  // =====================================================
  // EXPIRATION & REMINDER METHODS
  // =====================================================

  /**
   * Set expiration date for a proposal
   */
  async setExpiration(proposalId: number, expirationDate: string): Promise<void> {
    const db = getDatabase();

    await db.run('UPDATE proposal_requests SET expiration_date = ? WHERE id = ?', [
      expirationDate,
      proposalId
    ]);
  }

  /**
   * Process expired proposals
   */
  async processExpiredProposals(): Promise<number> {
    const db = getDatabase();

    const result = await db.run(
      `UPDATE proposal_requests SET
        status = 'rejected',
        rejected_at = datetime('now'),
        rejection_reason = 'Expired'
       WHERE expiration_date < date('now')
         AND status IN ('pending', 'reviewed')
         AND signed_at IS NULL`,
      []
    );

    return result.changes || 0;
  }

  /**
   * Get proposals due for reminder
   */
  async getProposalsDueForReminder(daysOld: number): Promise<number[]> {
    const db = getDatabase();

    const rows = await db.all(
      `SELECT id FROM proposal_requests
       WHERE status = 'pending'
         AND signed_at IS NULL
         AND sent_at IS NOT NULL
         AND (reminder_sent_at IS NULL OR reminder_sent_at < datetime('now', '-7 days'))
         AND created_at < datetime('now', '-' || ? || ' days')
         AND (expiration_date IS NULL OR expiration_date > date('now'))`,
      [daysOld]
    );

    return rows.map((row) => getNumber(row as Record<string, unknown>, 'id'));
  }

  /**
   * Mark proposal reminder sent
   */
  async markReminderSent(proposalId: number): Promise<void> {
    const db = getDatabase();

    await db.run('UPDATE proposal_requests SET reminder_sent_at = datetime(\'now\') WHERE id = ?', [
      proposalId
    ]);

    await this.logActivity(proposalId, 'reminder_sent', 'system', 'system');
  }

  /**
   * Mark proposal as sent
   */
  async markProposalSent(proposalId: number, sentBy: string): Promise<void> {
    const db = getDatabase();

    // Get proposal for validity days
    const proposal = await db.get('SELECT validity_days FROM proposal_requests WHERE id = ?', [
      proposalId
    ]);
    const validityDays = (proposal as Record<string, unknown>)?.validity_days || 30;

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + (validityDays as number));

    await db.run(
      `UPDATE proposal_requests SET
        sent_at = datetime('now'),
        sent_by = ?,
        expiration_date = ?
       WHERE id = ?`,
      [sentBy, expirationDate.toISOString().split('T')[0], proposalId]
    );

    await this.logActivity(proposalId, 'sent', sentBy, 'admin');
  }

  /**
   * Generate access token for client viewing
   */
  async generateAccessToken(proposalId: number): Promise<string> {
    const db = getDatabase();
    const token = generateToken();

    await db.run('UPDATE proposal_requests SET access_token = ? WHERE id = ?', [token, proposalId]);

    return token;
  }

  /**
   * Get proposal by access token
   */
  async getProposalByAccessToken(token: string): Promise<number | null> {
    const db = getDatabase();
    const row = await db.get('SELECT id FROM proposal_requests WHERE access_token = ?', [token]);

    if (!row) {
      return null;
    }

    return getNumber(row as Record<string, unknown>, 'id');
  }
}

// Export singleton instance
export const proposalService = new ProposalService();
export default proposalService;
