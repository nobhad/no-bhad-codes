/**
 * ===============================================
 * EMAIL TEMPLATE SERVICE
 * ===============================================
 * @file server/services/email-template-service.ts
 *
 * Manages email templates stored in the database,
 * including CRUD operations, versioning, and preview.
 */

import { getDatabase, type SqlParam } from '../database/init.js';

// ============================================
// TYPES
// ============================================

export interface EmailTemplate {
  id: number;
  name: string;
  description: string | null;
  category: EmailTemplateCategory;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: TemplateVariable[];
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  name: string;
  description: string;
}

export interface EmailTemplateVersion {
  id: number;
  template_id: number;
  version: number;
  subject: string;
  body_html: string;
  body_text: string | null;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
}

export interface EmailSendLog {
  id: number;
  template_id: number | null;
  template_name: string | null;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  sent_at: string | null;
  created_at: string;
}

export type EmailTemplateCategory =
  | 'notification'
  | 'invoice'
  | 'contract'
  | 'project'
  | 'reminder'
  | 'general';

export interface CreateTemplateData {
  name: string;
  description?: string;
  category?: EmailTemplateCategory;
  subject: string;
  body_html: string;
  body_text?: string;
  variables?: TemplateVariable[];
  is_active?: boolean;
}

export interface UpdateTemplateData {
  name?: string;
  description?: string;
  category?: EmailTemplateCategory;
  subject?: string;
  body_html?: string;
  body_text?: string;
  variables?: TemplateVariable[];
  is_active?: boolean;
}

export interface PreviewData {
  subject: string;
  body_html: string;
  body_text: string | null;
}

// ============================================
// EMAIL TEMPLATE SERVICE CLASS
// ============================================

class EmailTemplateService {

  // ============================================
  // TEMPLATE CRUD
  // ============================================

  /**
   * Get all email templates
   */
  async getTemplates(category?: EmailTemplateCategory): Promise<EmailTemplate[]> {
    const db = getDatabase();

    let query = 'SELECT * FROM email_templates';
    const params: SqlParam[] = [];

    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }

    query += ' ORDER BY category, name';

    const templates = await db.all(query, params) as unknown[];
    return templates.map(t => this.parseTemplate(t as Record<string, unknown>));
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(id: number): Promise<EmailTemplate | null> {
    const db = getDatabase();
    const template = await db.get(
      'SELECT * FROM email_templates WHERE id = ?',
      [id]
    ) as Record<string, unknown> | undefined;

    return template ? this.parseTemplate(template) : null;
  }

  /**
   * Get a template by name
   */
  async getTemplateByName(name: string): Promise<EmailTemplate | null> {
    const db = getDatabase();
    const template = await db.get(
      'SELECT * FROM email_templates WHERE name = ?',
      [name]
    ) as Record<string, unknown> | undefined;

    return template ? this.parseTemplate(template) : null;
  }

  /**
   * Create a new email template
   */
  async createTemplate(data: CreateTemplateData, changedBy?: string): Promise<EmailTemplate> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO email_templates (name, description, category, subject, body_html, body_text, variables, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.description || null,
        data.category || 'general',
        data.subject,
        data.body_html,
        data.body_text || null,
        JSON.stringify(data.variables || []),
        data.is_active !== false
      ]
    );

    if (!result.lastID) {
      throw new Error('Failed to create template');
    }

    const template = await this.getTemplate(result.lastID);
    if (!template) {
      throw new Error('Failed to create template');
    }

    // Create initial version
    await this.createVersion(template.id, template, changedBy, 'Initial version');

    return template;
  }

  /**
   * Update an existing email template
   */
  async updateTemplate(
    id: number,
    data: UpdateTemplateData,
    changedBy?: string,
    changeReason?: string
  ): Promise<EmailTemplate | null> {
    const db = getDatabase();

    const existing = await this.getTemplate(id);
    if (!existing) return null;

    // Don't allow changing name of system templates
    if (existing.is_system && data.name && data.name !== existing.name) {
      throw new Error('Cannot change the name of a system template');
    }

    const updates: string[] = [];
    const params: SqlParam[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.category !== undefined) {
      updates.push('category = ?');
      params.push(data.category);
    }
    if (data.subject !== undefined) {
      updates.push('subject = ?');
      params.push(data.subject);
    }
    if (data.body_html !== undefined) {
      updates.push('body_html = ?');
      params.push(data.body_html);
    }
    if (data.body_text !== undefined) {
      updates.push('body_text = ?');
      params.push(data.body_text);
    }
    if (data.variables !== undefined) {
      updates.push('variables = ?');
      params.push(JSON.stringify(data.variables));
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(data.is_active);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.run(
      `UPDATE email_templates SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const updated = await this.getTemplate(id);

    // Create version if content changed
    if (data.subject !== undefined || data.body_html !== undefined || data.body_text !== undefined) {
      await this.createVersion(id, updated!, changedBy, changeReason);
    }

    return updated;
  }

  /**
   * Delete an email template
   */
  async deleteTemplate(id: number): Promise<boolean> {
    const db = getDatabase();

    const template = await this.getTemplate(id);
    if (!template) return false;

    if (template.is_system) {
      throw new Error('Cannot delete a system template');
    }

    await db.run('DELETE FROM email_templates WHERE id = ?', [id]);
    return true;
  }

  // ============================================
  // VERSIONING
  // ============================================

  /**
   * Get version history for a template
   */
  async getVersions(templateId: number): Promise<EmailTemplateVersion[]> {
    const db = getDatabase();
    const versions = await db.all(
      `SELECT * FROM email_template_versions
       WHERE template_id = ?
       ORDER BY version DESC`,
      [templateId]
    ) as unknown[];

    return versions as EmailTemplateVersion[];
  }

  /**
   * Get a specific version
   */
  async getVersion(templateId: number, version: number): Promise<EmailTemplateVersion | null> {
    const db = getDatabase();
    const v = await db.get(
      `SELECT * FROM email_template_versions
       WHERE template_id = ? AND version = ?`,
      [templateId, version]
    ) as EmailTemplateVersion | undefined;

    return v || null;
  }

  /**
   * Restore a previous version
   */
  async restoreVersion(
    templateId: number,
    version: number,
    changedBy?: string
  ): Promise<EmailTemplate | null> {
    const v = await this.getVersion(templateId, version);
    if (!v) return null;

    return this.updateTemplate(
      templateId,
      {
        subject: v.subject,
        body_html: v.body_html,
        body_text: v.body_text || undefined
      },
      changedBy,
      `Restored from version ${version}`
    );
  }

  /**
   * Create a new version entry
   */
  private async createVersion(
    templateId: number,
    template: EmailTemplate,
    changedBy?: string,
    changeReason?: string
  ): Promise<void> {
    const db = getDatabase();

    // Get the next version number
    const lastVersion = await db.get(
      'SELECT MAX(version) as max_version FROM email_template_versions WHERE template_id = ?',
      [templateId]
    ) as { max_version: number | null } | undefined;

    const nextVersion = (lastVersion?.max_version || 0) + 1;

    await db.run(
      `INSERT INTO email_template_versions (template_id, version, subject, body_html, body_text, changed_by, change_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        templateId,
        nextVersion,
        template.subject,
        template.body_html,
        template.body_text,
        changedBy || null,
        changeReason || null
      ]
    );
  }

  // ============================================
  // PREVIEW AND VARIABLE INTERPOLATION
  // ============================================

  /**
   * Preview a template with sample data
   */
  async previewTemplate(
    templateId: number,
    sampleData: Record<string, unknown>
  ): Promise<PreviewData | null> {
    const template = await this.getTemplate(templateId);
    if (!template) return null;

    return {
      subject: this.interpolate(template.subject, sampleData),
      body_html: this.interpolate(template.body_html, sampleData),
      body_text: template.body_text ? this.interpolate(template.body_text, sampleData) : null
    };
  }

  /**
   * Preview with raw content (for editing before save)
   */
  previewContent(
    subject: string,
    bodyHtml: string,
    bodyText: string | null,
    sampleData: Record<string, unknown>
  ): PreviewData {
    return {
      subject: this.interpolate(subject, sampleData),
      body_html: this.interpolate(bodyHtml, sampleData),
      body_text: bodyText ? this.interpolate(bodyText, sampleData) : null
    };
  }

  /**
   * Interpolate variables in a template string
   * Supports {{variable.path}} syntax
   */
  interpolate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Generate sample data for all variables in a template
   */
  generateSampleData(variables: TemplateVariable[]): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    for (const variable of variables) {
      const parts = variable.name.split('.');
      let current = data;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]] as Record<string, unknown>;
      }

      const lastPart = parts[parts.length - 1];
      current[lastPart] = this.generateSampleValue(variable.name, variable.description);
    }

    return data;
  }

  /**
   * Generate a sample value based on variable name
   */
  private generateSampleValue(name: string, _description: string): string {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('email')) return 'client@example.com';
    if (lowerName.includes('name') && lowerName.includes('client')) return 'John Smith';
    if (lowerName.includes('name') && lowerName.includes('company')) return 'Acme Corp';
    if (lowerName.includes('name') && lowerName.includes('project')) return 'Website Redesign';
    if (lowerName.includes('name')) return 'Sample Name';
    if (lowerName.includes('url')) return 'https://example.com/action';
    if (lowerName.includes('amount')) return '$1,500.00';
    if (lowerName.includes('date')) return 'January 15, 2026';
    if (lowerName.includes('number')) return 'INV-2026-001';
    if (lowerName.includes('status')) return 'Active';
    if (lowerName.includes('message')) return 'This is a sample message for preview purposes.';
    if (lowerName.includes('hours')) return '24';

    return `[${name}]`;
  }

  // ============================================
  // SEND LOGGING
  // ============================================

  /**
   * Log an email send attempt
   */
  async logSend(
    templateName: string | null,
    recipientEmail: string,
    recipientName: string | null,
    subject: string,
    status: 'pending' | 'sent' | 'failed',
    errorMessage?: string,
    metadata?: Record<string, unknown>
  ): Promise<number> {
    const db = getDatabase();

    // Get template ID if name provided
    let templateId: number | null = null;
    if (templateName) {
      const template = await this.getTemplateByName(templateName);
      templateId = template?.id || null;
    }

    const result = await db.run(
      `INSERT INTO email_send_logs (template_id, template_name, recipient_email, recipient_name, subject, status, error_message, metadata, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        templateId,
        templateName,
        recipientEmail,
        recipientName,
        subject,
        status,
        errorMessage || null,
        metadata ? JSON.stringify(metadata) : null,
        status === 'sent' ? new Date().toISOString() : null
      ]
    );

    if (!result.lastID) {
      throw new Error('Failed to log email send');
    }

    return result.lastID;
  }

  /**
   * Update send log status
   */
  async updateSendLog(
    id: number,
    status: 'sent' | 'failed' | 'bounced',
    errorMessage?: string
  ): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE email_send_logs
       SET status = ?, error_message = ?, sent_at = ?
       WHERE id = ?`,
      [
        status,
        errorMessage || null,
        status === 'sent' ? new Date().toISOString() : null,
        id
      ]
    );
  }

  /**
   * Get send logs
   */
  async getSendLogs(
    options: {
      templateId?: number;
      recipientEmail?: string;
      status?: string;
      limit?: number;
    } = {}
  ): Promise<EmailSendLog[]> {
    const db = getDatabase();

    let query = 'SELECT * FROM email_send_logs WHERE 1=1';
    const params: SqlParam[] = [];

    if (options.templateId) {
      query += ' AND template_id = ?';
      params.push(options.templateId);
    }
    if (options.recipientEmail) {
      query += ' AND recipient_email = ?';
      params.push(options.recipientEmail);
    }
    if (options.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const logs = await db.all(query, params) as unknown[];
    return logs.map(log => {
      const l = log as Record<string, unknown>;
      return {
        ...l,
        metadata: l.metadata ? JSON.parse(l.metadata as string) : null
      } as EmailSendLog;
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Parse database row into EmailTemplate
   */
  private parseTemplate(row: Record<string, unknown>): EmailTemplate {
    return {
      id: row.id as number,
      name: row.name as string,
      description: row.description as string | null,
      category: row.category as EmailTemplateCategory,
      subject: row.subject as string,
      body_html: row.body_html as string,
      body_text: row.body_text as string | null,
      variables: row.variables ? JSON.parse(row.variables as string) : [],
      is_active: Boolean(row.is_active),
      is_system: Boolean(row.is_system),
      created_at: row.created_at as string,
      updated_at: row.updated_at as string
    };
  }

  /**
   * Get available template categories
   */
  getCategories(): { value: EmailTemplateCategory; label: string }[] {
    return [
      { value: 'notification', label: 'Notification' },
      { value: 'invoice', label: 'Invoice' },
      { value: 'contract', label: 'Contract' },
      { value: 'project', label: 'Project' },
      { value: 'reminder', label: 'Reminder' },
      { value: 'general', label: 'General' }
    ];
  }
}

// Export singleton instance
export const emailTemplateService = new EmailTemplateService();
