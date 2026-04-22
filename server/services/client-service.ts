/**
 * ===============================================
 * CLIENT MANAGEMENT SERVICE
 * ===============================================
 * @file server/services/client-service.ts
 *
 * CRM-grade client management service with contacts, activities,
 * custom fields, tags, and health scoring.
 */

import { getDatabase } from '../database/init.js';
import { userService } from './user-service.js';
import {
  toContact,
  toActivity,
  toCustomField,
  toCustomFieldValue,
  toTag,
  toClientNote,
  type ContactRow,
  type ActivityRow,
  type CustomFieldRow,
  type CustomFieldValueRow,
  type TagRow,
  type ClientNoteRow
} from '../database/entities/index.js';
import { buildSafeUpdate, type SqlValue } from '../database/query-helpers.js';

// =====================================================
// INTERFACES - Contacts
// =====================================================

export interface ClientContact {
  id: number;
  clientId: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  role: 'primary' | 'billing' | 'technical' | 'decision_maker' | 'general';
  isPrimary: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactCreateData {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  role?: ClientContact['role'];
  isPrimary?: boolean;
  notes?: string;
}

// ContactRow imported from entities

// =====================================================
// INTERFACES - Activities
// =====================================================

export interface ClientActivity {
  id: number;
  clientId: number;
  activityType: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
}

export interface ActivityData {
  activityType: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface ActivityFilters {
  activityType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// ActivityRow imported from entities

// =====================================================
// INTERFACES - Custom Fields
// =====================================================

export interface CustomField {
  id: number;
  fieldName: string;
  fieldLabel: string;
  fieldType:
    | 'text'
    | 'number'
    | 'date'
    | 'select'
    | 'multiselect'
    | 'boolean'
    | 'url'
    | 'email'
    | 'phone';
  options?: string[];
  isRequired: boolean;
  placeholder?: string;
  defaultValue?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldData {
  fieldName: string;
  fieldLabel: string;
  fieldType: CustomField['fieldType'];
  options?: string[];
  isRequired?: boolean;
  placeholder?: string;
  defaultValue?: string;
  displayOrder?: number;
}

export interface CustomFieldValue {
  id: number;
  clientId: number;
  fieldId: number;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  fieldValue?: string;
  createdAt: string;
  updatedAt: string;
}

// CustomFieldRow and CustomFieldValueRow imported from entities

// =====================================================
// INTERFACES - Tags
// =====================================================

export interface Tag {
  id: number;
  name: string;
  color: string;
  description?: string;
  tagType: string;
  createdAt: string;
}

export interface TagData {
  name: string;
  color?: string;
  description?: string;
  tagType?: string;
}

// TagRow imported from entities

// =====================================================
// INTERFACES - Admin Listing
// =====================================================

export interface AdminClientRow {
  id: number;
  companyName: string | null;
  contactName: string;
  email: string;
  phone: string | null;
  status: string;
  clientType: string | null;
  createdAt: string;
  updatedAt: string;
  projectCount: number;
  invoiceCount: number;
}

export interface AdminClientStats {
  total: number;
  active: number;
  pending: number;
  inactive: number;
}

export interface AdminClientListRow {
  id: number;
  company_name: string | null;
  contact_name: string | null;
  email: string;
  phone: string | null;
  status: string;
  client_type: string | null;
  health_score: number | null;
  health_status: string | null;
  created_at: string;
  updated_at: string;
  project_count: number;
}

export interface AllClientTagRow {
  client_id: number;
  id: number;
  name: string;
  color: string | null;
}

export interface CreateClientData {
  email: string;
  password_hash: string;
  company_name?: string;
  contact_name?: string;
  phone?: string;
  client_type?: string;
  status?: string;
}

export interface InviteClientRow {
  id: number;
  email: string;
  contact_name: string | null;
  status: string;
}

// =====================================================
// INTERFACES - Health Scoring & Stats
// =====================================================

export interface ClientHealthScore {
  score: number;
  status: 'healthy' | 'at_risk' | 'critical';
  factors: {
    paymentHistory: number;
    engagement: number;
    projectSuccess: number;
    communicationScore: number;
  };
  lastCalculated: string;
}

export interface ClientStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  averagePaymentDays: number;
  lifetimeValue: number;
  messageCount: number;
  lastActivityDate?: string;
}

export interface ClientNote {
  id: number;
  clientId: number;
  author: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// ClientNoteRow imported from entities

interface ClientRow {
  id: number;
  email: string;
  company_name?: string;
  contact_name?: string;
  phone?: string;
  status: string;
  health_score?: number;
  health_status?: string;
  lifetime_value?: number | string;
  acquisition_source?: string;
  industry?: string;
  company_size?: string;
  website?: string;
  last_contact_date?: string;
  next_follow_up_date?: string;
  notes?: string;
  preferred_contact_method?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// HELPER FUNCTIONS - Imported from database/entities
// =====================================================
// toContact, toActivity, toCustomField, toCustomFieldValue,
// toTag, toClientNote are imported from '../database/entities/index.js'

// =====================================================
// COLUMN CONSTANTS - Explicit column lists for SELECT queries
// =====================================================

const CLIENT_COLUMNS = `
  id, email, password_hash, company_name, contact_name, phone, status, created_at, updated_at,
  billing_company, billing_address, billing_address2, billing_city, billing_state, billing_zip, billing_country,
  billing_name, is_admin, invitation_token, invitation_expires_at, invitation_sent_at, last_login_at,
  magic_link_token, magic_link_expires_at, client_type, notes, industry, website,
  health_score, health_status, lifetime_value, acquisition_source, company_size,
  last_contact_date, next_follow_up_date, preferred_contact_method,
  deleted_at, deleted_by
`.replace(/\s+/g, ' ').trim();

const CLIENT_CONTACT_COLUMNS = `
  id, client_id, first_name, last_name, email, phone, title, department,
  role, is_primary, notes, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const CLIENT_ACTIVITY_COLUMNS = `
  id, client_id, activity_type, title, description, metadata, created_by, created_at
`.replace(/\s+/g, ' ').trim();

const CLIENT_CUSTOM_FIELD_COLUMNS = `
  id, field_name, field_label, field_type, options, is_required, placeholder,
  default_value, display_order, is_active, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const TAG_COLUMNS = `
  id, name, color, description, tag_type, created_at
`.replace(/\s+/g, ' ').trim();

// =====================================================
// INTERFACES - Client "Me" (Self-Service) Queries
// =====================================================

export interface ClientProfile {
  id: number;
  email: string;
  company_name?: string;
  contact_name?: string;
  phone?: string;
  status: string;
  client_type?: string;
  billing_name?: string;
  billing_company?: string;
  billing_address?: string;
  billing_address2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_zip?: string;
  billing_country?: string;
  billing_phone?: string;
  billing_email?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientProfileBasic {
  id: number;
  email: string;
  company_name?: string;
  contact_name?: string;
  phone?: string;
  client_type?: string;
}

export interface ClientBilling {
  billing_name?: string;
  company?: string;
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
}

export interface ClientPasswordHash {
  password_hash: string;
  [key: string]: unknown;
}

export interface ClientProjectSummary {
  id: number;
  project_name: string;
  status: string;
  progress?: number;
  start_date?: string;
  end_date?: string;
  preview_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardActivityItem {
  type: string;
  title: string;
  context: string;
  date: string;
  entity_id?: number;
}

export interface CurrentDeliverableRow {
  id: number;
  title: string;
  status: string;
  type: string;
  project_id: number;
}

export interface CountResult {
  count: number;
}

export interface BalanceResult {
  balance: number;
}

export interface ContactUpdateFields {
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  department?: string | null;
  role?: string;
  notes?: string | null;
}

// =====================================================
// CLIENT SERVICE CLASS
// =====================================================

class ClientService {
  // ===================================================
  // CLIENT "ME" (SELF-SERVICE) QUERIES
  // ===================================================

  /**
   * Get full client profile by ID (for GET /me)
   */
  async getClientProfile(clientId: number): Promise<ClientProfile | undefined> {
    const db = getDatabase();
    return db.get(
      `SELECT id, email, company_name, contact_name, phone, status, client_type,
              billing_name, billing_company, billing_address, billing_address2, billing_city,
              billing_state, billing_zip, billing_country, billing_phone, billing_email,
              created_at, updated_at
       FROM active_clients WHERE id = ?`,
      [clientId]
    ) as Promise<ClientProfile | undefined>;
  }

  /**
   * Update client profile fields (contact_name, company_name, phone)
   */
  async updateClientProfile(
    clientId: number,
    data: { contact_name?: string | null; company_name?: string | null; phone?: string | null }
  ): Promise<void> {
    const db = getDatabase();
    // Only update fields that were actually sent — prevents wiping unrelated fields
    const setClauses: string[] = [];
    const params: (string | null)[] = [];

    if ('contact_name' in data) { setClauses.push('contact_name = ?'); params.push(data.contact_name || null); }
    if ('company_name' in data) { setClauses.push('company_name = ?'); params.push(data.company_name || null); }
    if ('phone' in data) { setClauses.push('phone = ?'); params.push(data.phone || null); }

    if (setClauses.length === 0) return;

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(clientId as unknown as string);

    await db.run(`UPDATE clients SET ${setClauses.join(', ')} WHERE id = ?`, params);
  }

  /**
   * Get basic client profile after update (for PUT /me response)
   */
  async getClientProfileBasic(clientId: number): Promise<ClientProfileBasic | undefined> {
    const db = getDatabase();
    return db.get(
      'SELECT id, email, company_name, contact_name, phone, client_type FROM active_clients WHERE id = ?',
      [clientId]
    ) as Promise<ClientProfileBasic | undefined>;
  }

  /**
   * Get client password hash for verification (for PUT /me/password)
   */
  async getClientPasswordHash(clientId: number): Promise<ClientPasswordHash | undefined> {
    const db = getDatabase();
    return db.get(
      'SELECT password_hash FROM active_clients WHERE id = ?',
      [clientId]
    ) as Promise<ClientPasswordHash | undefined>;
  }

  /**
   * Update client password hash
   */
  async updateClientPassword(clientId: number, newHash: string): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE clients SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newHash, clientId]
    );
  }

  /**
   * Get client billing information (for GET /me/billing)
   */
  async getClientBilling(clientId: number): Promise<ClientBilling | undefined> {
    const db = getDatabase();
    return db.get(
      `SELECT
         billing_name, billing_company as company,
         billing_address as address, billing_address2 as address2,
         billing_city as city, billing_state as state,
         billing_zip as zip, billing_country as country,
         billing_phone as phone, billing_email as email
       FROM active_clients WHERE id = ?`,
      [clientId]
    ) as Promise<ClientBilling | undefined>;
  }

  /**
   * Update client billing information (for PUT /me/billing)
   */
  async updateClientBilling(
    clientId: number,
    data: {
      billing_name?: string | null;
      company?: string | null;
      address?: string | null;
      address2?: string | null;
      city?: string | null;
      state?: string | null;
      zip?: string | null;
      country?: string | null;
      phone?: string | null;
      email?: string | null;
    }
  ): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE clients SET
         billing_name = ?,
         billing_company = ?,
         billing_address = ?,
         billing_address2 = ?,
         billing_city = ?,
         billing_state = ?,
         billing_zip = ?,
         billing_country = ?,
         billing_phone = ?,
         billing_email = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.billing_name || null,
        data.company || null,
        data.address || null,
        data.address2 || null,
        data.city || null,
        data.state || null,
        data.zip || null,
        data.country || null,
        data.phone || null,
        data.email || null,
        clientId
      ]
    );
  }

  /**
   * Get all projects for a client (for dashboard)
   */
  async getClientProjects(clientId: number): Promise<ClientProjectSummary[]> {
    const db = getDatabase();
    return db.all(
      `SELECT id, project_name, status, progress,
              start_date, estimated_end_date as end_date, preview_url,
              created_at, updated_at
       FROM active_projects WHERE client_id = ?
       ORDER BY
         CASE WHEN status IN ('active', 'in-progress', 'in-review') THEN 0 ELSE 1 END,
         updated_at DESC`,
      [clientId]
    ) as Promise<ClientProjectSummary[]>;
  }

  /**
   * Get count of pending invoices for a client
   */
  async getPendingInvoiceCount(clientId: number): Promise<number> {
    const db = getDatabase();
    const result = await db.get(
      `SELECT COUNT(*) as count FROM active_invoices
       WHERE client_id = ? AND status IN ('sent', 'viewed', 'partial', 'overdue')`,
      [clientId]
    ) as CountResult | undefined;
    return result?.count || 0;
  }

  /**
   * Get count of unread messages for a client
   */
  async getUnreadMessageCount(clientId: number): Promise<number> {
    const db = getDatabase();
    const result = await db.get(
      `SELECT COUNT(*) as count FROM active_messages m
       JOIN active_message_threads t ON m.thread_id = t.id
       WHERE t.client_id = ? AND m.read_at IS NULL AND m.sender_type = 'admin'`,
      [clientId]
    ) as CountResult | undefined;
    return result?.count || 0;
  }

  /**
   * Get recent activity feed for a client dashboard
   */
  async getClientRecentActivity(clientId: number): Promise<DashboardActivityItem[]> {
    const db = getDatabase();
    return db.all(
      `SELECT type, title, context, date, entity_id FROM (
        -- Project updates
        SELECT
          'project_update' as type,
          pu.title as title,
          p.project_name as context,
          pu.created_at as date,
          CAST(NULL as INTEGER) as entity_id
        FROM project_updates pu
        JOIN active_projects p ON pu.project_id = p.id
        WHERE p.client_id = ?

        UNION ALL

        -- Messages received
        SELECT
          'message' as type,
          'New message received' as title,
          t.subject as context,
          m.created_at as date,
          t.id as entity_id
        FROM active_messages m
        JOIN active_message_threads t ON m.thread_id = t.id
        WHERE t.client_id = ? AND m.sender_type = 'admin'

        UNION ALL

        -- Invoices
        SELECT
          'invoice' as type,
          CASE
            WHEN i.status = 'sent' THEN 'Invoice sent'
            WHEN i.status = 'paid' THEN 'Invoice paid'
            WHEN i.status = 'overdue' THEN 'Invoice overdue'
            WHEN i.status = 'viewed' THEN 'Invoice viewed'
            ELSE 'Invoice updated'
          END as title,
          i.invoice_number as context,
          i.updated_at as date,
          i.id as entity_id
        FROM active_invoices i
        WHERE i.client_id = ?

        UNION ALL

        -- Files uploaded
        SELECT
          'file' as type,
          'File uploaded' as title,
          f.original_filename as context,
          f.created_at as date,
          f.id as entity_id
        FROM files f
        JOIN active_projects p ON f.project_id = p.id
        WHERE p.client_id = ? AND f.deleted_at IS NULL

        UNION ALL

        -- Document requests
        SELECT
          'document_request' as type,
          CASE
            WHEN dr.status = 'requested' THEN 'Document requested'
            WHEN dr.status = 'approved' THEN 'Document approved'
            WHEN dr.status = 'rejected' THEN 'Document rejected'
            WHEN dr.status = 'under_review' THEN 'Document under review'
            ELSE 'Document request updated'
          END as title,
          dr.title as context,
          dr.updated_at as date,
          dr.id as entity_id
        FROM active_document_requests dr
        WHERE dr.client_id = ?

        UNION ALL

        -- Contracts
        SELECT
          'contract' as type,
          CASE
            WHEN c.status = 'sent' THEN 'Contract sent for signature'
            WHEN c.status = 'signed' THEN 'Contract signed'
            WHEN c.status = 'expired' THEN 'Contract expired'
            WHEN c.countersigned_at IS NOT NULL THEN 'Contract countersigned'
            ELSE 'Contract updated'
          END as title,
          p.project_name as context,
          COALESCE(c.signed_at, c.sent_at, c.updated_at) as date,
          c.id as entity_id
        FROM active_contracts c
        JOIN active_projects p ON c.project_id = p.id
        WHERE c.client_id = ?
      ) AS activity
      ORDER BY date DESC
      LIMIT 10`,
      [clientId, clientId, clientId, clientId, clientId, clientId]
    ) as Promise<DashboardActivityItem[]>;
  }

  /**
   * Get count of pending document requests for a client
   */
  async getPendingDocRequestCount(clientId: number): Promise<number> {
    const db = getDatabase();
    const result = await db.get(
      `SELECT COUNT(*) as count FROM active_document_requests
       WHERE client_id = ? AND status IN ('requested', 'rejected')`,
      [clientId]
    ) as CountResult | undefined;
    return result?.count || 0;
  }

  /**
   * Get count of pending contracts (sent but not signed)
   */
  async getPendingContractCount(clientId: number): Promise<number> {
    const db = getDatabase();
    const result = await db.get(
      `SELECT COUNT(*) as count FROM active_contracts
       WHERE client_id = ? AND status = 'sent'`,
      [clientId]
    ) as CountResult | undefined;
    return result?.count || 0;
  }

  /**
   * Get count of pending questionnaires for a client
   */
  async getPendingQuestionnaireCount(clientId: number): Promise<number> {
    const db = getDatabase();
    const result = await db.get(
      `SELECT COUNT(*) as count FROM questionnaire_responses qr
       JOIN active_projects p ON qr.project_id = p.id
       WHERE p.client_id = ? AND qr.status IN ('pending', 'in_progress')`,
      [clientId]
    ) as CountResult | undefined;
    return result?.count || 0;
  }

  /**
   * Get count of pending approvals (deliverables awaiting client approval)
   */
  async getPendingApprovalCount(clientId: number): Promise<number> {
    const db = getDatabase();
    const result = await db.get(
      `SELECT COUNT(*) as count FROM deliverables d
       JOIN active_projects p ON d.project_id = p.id
       WHERE p.client_id = ? AND d.approval_status = 'pending' AND d.deleted_at IS NULL`,
      [clientId]
    ) as CountResult | undefined;
    return result?.count || 0;
  }

  /**
   * Get outstanding balance for a client
   */
  async getOutstandingBalance(clientId: number): Promise<number> {
    const db = getDatabase();
    const result = await db.get(
      `SELECT COALESCE(SUM(amount_total - COALESCE(amount_paid, 0)), 0) as balance
       FROM active_invoices
       WHERE client_id = ? AND status IN ('sent', 'viewed', 'partial', 'overdue')`,
      [clientId]
    ) as BalanceResult | undefined;
    return result?.balance || 0;
  }

  /**
   * Get count of deliverables in review for a client
   */
  async getDeliverablesInReviewCount(clientId: number): Promise<number> {
    const db = getDatabase();
    const result = await db.get(
      `SELECT COUNT(*) as count FROM deliverables d
       JOIN active_projects p ON d.project_id = p.id
       WHERE p.client_id = ? AND d.status = 'in_review' AND d.deleted_at IS NULL`,
      [clientId]
    ) as CountResult | undefined;
    return result?.count || 0;
  }

  /**
   * Get the current active deliverable or milestone for a client
   */
  async getCurrentDeliverable(clientId: number): Promise<CurrentDeliverableRow | undefined> {
    const db = getDatabase();
    return db.get(
      `SELECT id, title, status, type, project_id FROM (
        -- Deliverables (design review system)
        SELECT d.id, d.title, d.status, d.type, p.id as project_id, d.updated_at
        FROM deliverables d
        JOIN active_projects p ON d.project_id = p.id
        WHERE p.client_id = ? AND d.deleted_at IS NULL
          AND d.status IN ('in_progress', 'in_review')

        UNION ALL

        -- Milestones (project milestones)
        SELECT m.id, m.title, m.status, 'milestone' as type, p.id as project_id, m.updated_at
        FROM milestones m
        JOIN active_projects p ON m.project_id = p.id
        WHERE p.client_id = ? AND m.deleted_at IS NULL
          AND m.status = 'in_progress'
      )
      ORDER BY
        CASE WHEN status = 'in_progress' THEN 0 ELSE 1 END,
        updated_at DESC
      LIMIT 1`,
      [clientId, clientId]
    ) as Promise<CurrentDeliverableRow | undefined>;
  }

  /**
   * Get all contacts for a client (self-service, includes deleted_at filter)
   */
  async getClientOwnContacts(clientId: number): Promise<Record<string, unknown>[]> {
    const db = getDatabase();
    const CONTACT_COLUMNS = 'id, client_id, first_name, last_name, email, phone, title, department, role, is_primary, notes, created_at, updated_at';
    return db.all(
      `SELECT ${CONTACT_COLUMNS} FROM client_contacts WHERE client_id = ? AND deleted_at IS NULL ORDER BY is_primary DESC, first_name ASC`,
      [clientId]
    ) as Promise<Record<string, unknown>[]>;
  }

  /**
   * Insert a new client contact (self-service)
   */
  async insertClientContact(
    clientId: number,
    data: {
      first_name: string;
      last_name: string;
      email?: string | null;
      phone?: string | null;
      title?: string | null;
      department?: string | null;
      role?: string;
      notes?: string | null;
    }
  ): Promise<Record<string, unknown> | undefined> {
    const db = getDatabase();
    const CONTACT_COLUMNS = 'id, client_id, first_name, last_name, email, phone, title, department, role, is_primary, notes, created_at, updated_at';

    const result = await db.run(
      `INSERT INTO client_contacts (client_id, first_name, last_name, email, phone, title, department, role, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clientId, data.first_name, data.last_name, data.email || null, data.phone || null, data.title || null, data.department || null, data.role || 'general', data.notes || null]
    );

    return db.get(
      `SELECT ${CONTACT_COLUMNS} FROM client_contacts WHERE id = ?`,
      [result.lastID]
    ) as Promise<Record<string, unknown> | undefined>;
  }

  /**
   * Verify contact ownership by client
   */
  async verifyContactOwnership(contactId: number, clientId: number): Promise<boolean> {
    const db = getDatabase();
    const existing = await db.get(
      'SELECT id FROM client_contacts WHERE id = ? AND client_id = ?',
      [contactId, clientId]
    );
    return !!existing;
  }

  /**
   * Verify contact ownership (with soft-delete check)
   */
  async verifyContactOwnershipActive(contactId: number, clientId: number): Promise<boolean> {
    const db = getDatabase();
    const existing = await db.get(
      'SELECT id FROM client_contacts WHERE id = ? AND client_id = ? AND deleted_at IS NULL',
      [contactId, clientId]
    );
    return !!existing;
  }

  /**
   * Update a client contact with dynamic fields
   */
  async updateClientContact(
    contactId: number,
    clientId: number,
    fields: ContactUpdateFields
  ): Promise<Record<string, unknown> | undefined> {
    const db = getDatabase();
    const CONTACT_COLUMNS = 'id, client_id, first_name, last_name, email, phone, title, department, role, is_primary, notes, created_at, updated_at';

    const updates: string[] = [];
    const values: (string | number | boolean | null | undefined)[] = [];

    if (fields.first_name !== undefined) { updates.push('first_name = ?'); values.push(fields.first_name); }
    if (fields.last_name !== undefined) { updates.push('last_name = ?'); values.push(fields.last_name); }
    if (fields.email !== undefined) { updates.push('email = ?'); values.push(fields.email); }
    if (fields.phone !== undefined) { updates.push('phone = ?'); values.push(fields.phone); }
    if (fields.title !== undefined) { updates.push('title = ?'); values.push(fields.title); }
    if (fields.department !== undefined) { updates.push('department = ?'); values.push(fields.department); }
    if (fields.role !== undefined) { updates.push('role = ?'); values.push(fields.role); }
    if (fields.notes !== undefined) { updates.push('notes = ?'); values.push(fields.notes); }

    if (updates.length === 0) {
      return undefined;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(contactId, clientId);

    await db.run(
      `UPDATE client_contacts SET ${updates.join(', ')} WHERE id = ? AND client_id = ?`,
      values
    );

    return db.get(
      `SELECT ${CONTACT_COLUMNS} FROM client_contacts WHERE id = ?`,
      [contactId]
    ) as Promise<Record<string, unknown> | undefined>;
  }
  // ===================================================
  // CONTACT MANAGEMENT
  // ===================================================

  /**
   * Create a new contact for a client.
   *
   * When the new contact is marked primary we first unset every other
   * primary flag, then insert the new row. Wrapped in a transaction so
   * a crash between the two can't leave the client with zero primary
   * contacts (previous primary unset, new one never inserted).
   */
  async createContact(clientId: number, data: ContactCreateData): Promise<ClientContact> {
    const db = getDatabase();

    const newContactId = await db.transaction(async (ctx) => {
      if (data.isPrimary) {
        await ctx.run('UPDATE client_contacts SET is_primary = 0 WHERE client_id = ?', [clientId]);
      }

      const result = await ctx.run(
        `INSERT INTO client_contacts (
          client_id, first_name, last_name, email, phone, title,
          department, role, is_primary, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clientId,
          data.firstName,
          data.lastName,
          data.email || null,
          data.phone || null,
          data.title || null,
          data.department || null,
          data.role || 'general',
          data.isPrimary ? 1 : 0,
          data.notes || null
        ]
      );

      return result.lastID;
    });

    const contact = (await db.get(`SELECT ${CLIENT_CONTACT_COLUMNS} FROM client_contacts WHERE id = ?`, [
      newContactId
    ])) as unknown as ContactRow | undefined;

    if (!contact) {
      throw new Error('Failed to create contact');
    }

    // Log activity
    await this.logActivity(clientId, {
      activityType: 'contact_added',
      title: `Added contact: ${data.firstName} ${data.lastName}`,
      metadata: { contactId: newContactId },
      createdBy: 'admin'
    });

    return toContact(contact);
  }

  /**
   * Get all contacts for a client
   */
  async getContacts(clientId: number): Promise<ClientContact[]> {
    const db = getDatabase();
    const rows = (await db.all(
      `SELECT ${CLIENT_CONTACT_COLUMNS} FROM client_contacts
       WHERE client_id = ? AND deleted_at IS NULL
       ORDER BY is_primary DESC, first_name ASC`,
      [clientId]
    )) as unknown as ContactRow[];
    return rows.map(toContact);
  }

  /**
   * Get a single contact by ID
   */
  async getContact(contactId: number): Promise<ClientContact | null> {
    const db = getDatabase();
    const row = (await db.get(`SELECT ${CLIENT_CONTACT_COLUMNS} FROM client_contacts WHERE id = ?`, [
      contactId
    ])) as unknown as ContactRow | undefined;
    return row ? toContact(row) : null;
  }

  /**
   * Update a contact
   */
  async updateContact(contactId: number, data: Partial<ContactCreateData>): Promise<ClientContact> {
    const db = getDatabase();

    // Get existing contact to know the client
    const existing = (await db.get(`SELECT ${CLIENT_CONTACT_COLUMNS} FROM client_contacts WHERE id = ?`, [
      contactId
    ])) as unknown as ContactRow | undefined;

    if (!existing) {
      throw new Error('Contact not found');
    }

    const ALLOWED_FIELDS = [
      'first_name', 'last_name', 'email', 'phone', 'title',
      'department', 'role', 'is_primary', 'notes'
    ] as const;

    const fieldUpdates: Record<string, SqlValue> = {};
    if (data.firstName !== undefined) fieldUpdates.first_name = data.firstName;
    if (data.lastName !== undefined) fieldUpdates.last_name = data.lastName;
    if (data.email !== undefined) fieldUpdates.email = data.email || null;
    if (data.phone !== undefined) fieldUpdates.phone = data.phone || null;
    if (data.title !== undefined) fieldUpdates.title = data.title || null;
    if (data.department !== undefined) fieldUpdates.department = data.department || null;
    if (data.role !== undefined) fieldUpdates.role = data.role;
    if (data.isPrimary !== undefined) fieldUpdates.is_primary = data.isPrimary ? 1 : 0;
    if (data.notes !== undefined) fieldUpdates.notes = data.notes || null;

    const { setClause, params } = buildSafeUpdate(fieldUpdates, ALLOWED_FIELDS);

    // Wrap the unset-others + update pair so a crash between them
    // can't leave the client with no primary contact at all.
    await db.transaction(async (ctx) => {
      if (data.isPrimary) {
        await ctx.run('UPDATE client_contacts SET is_primary = 0 WHERE client_id = ? AND id != ?', [
          existing.client_id,
          contactId
        ]);
      }

      if (setClause) {
        await ctx.run(
          `UPDATE client_contacts SET ${setClause} WHERE id = ?`,
          [...params, contactId]
        );
      }
    });

    const updated = (await db.get(`SELECT ${CLIENT_CONTACT_COLUMNS} FROM client_contacts WHERE id = ?`, [
      contactId
    ])) as unknown as ContactRow | undefined;

    if (!updated) {
      throw new Error('Contact not found after update');
    }

    return toContact(updated);
  }

  /**
   * Delete a contact
   */
  async deleteContact(contactId: number): Promise<void> {
    const db = getDatabase();

    // Get contact info for activity log
    const contact = (await db.get(`SELECT ${CLIENT_CONTACT_COLUMNS} FROM client_contacts WHERE id = ?`, [
      contactId
    ])) as unknown as ContactRow | undefined;

    if (!contact) {
      throw new Error('Contact not found');
    }

    await db.run('DELETE FROM client_contacts WHERE id = ?', [contactId]);

    // Log activity
    await this.logActivity(contact.client_id, {
      activityType: 'contact_removed',
      title: `Removed contact: ${contact.first_name} ${contact.last_name}`,
      metadata: { contactId },
      createdBy: 'admin'
    });
  }

  /**
   * Set a contact as the primary contact for a client.
   *
   * Wrapped in a transaction so the unset-all, set-new, and sync to
   * clients.contact_name either all happen or none do. A crash
   * mid-flight would otherwise leave the client either with no
   * primary contact or with clients.contact_name pointing to a
   * different person than the actual primary row.
   */
  async setPrimaryContact(clientId: number, contactId: number): Promise<void> {
    const db = getDatabase();

    await db.transaction(async (ctx) => {
      await ctx.run('UPDATE client_contacts SET is_primary = 0 WHERE client_id = ?', [clientId]);

      await ctx.run(
        'UPDATE client_contacts SET is_primary = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND client_id = ?',
        [contactId, clientId]
      );

      const contact = (await ctx.get(
        'SELECT first_name, last_name FROM client_contacts WHERE id = ? AND client_id = ?',
        [contactId, clientId]
      )) as { first_name: string; last_name: string } | undefined;

      if (contact) {
        const fullName = `${contact.first_name} ${contact.last_name}`.trim();
        await ctx.run(
          'UPDATE clients SET contact_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [fullName, clientId]
        );
      }
    });
  }

  // ===================================================
  // ACTIVITY TIMELINE
  // ===================================================

  /**
   * Log an activity for a client
   */
  async logActivity(clientId: number, activity: ActivityData): Promise<ClientActivity> {
    const db = getDatabase();

    // Look up user ID for created_by
    const createdByUserId = await userService.getUserIdByEmailOrName(
      activity.createdBy || 'system'
    );

    const result = await db.run(
      `INSERT INTO client_activities (
        client_id, activity_type, title, description, metadata, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        activity.activityType,
        activity.title,
        activity.description || null,
        activity.metadata ? JSON.stringify(activity.metadata) : null,
        createdByUserId
      ]
    );

    // Update client's last contact date
    await db.run('UPDATE clients SET last_contact_date = DATE("now") WHERE id = ?', [clientId]);

    const row = (await db.get(`SELECT ${CLIENT_ACTIVITY_COLUMNS} FROM client_activities WHERE id = ?`, [
      result.lastID
    ])) as unknown as ActivityRow | undefined;

    if (!row) {
      throw new Error('Failed to create activity');
    }

    return toActivity(row);
  }

  /**
   * Get activity timeline for a client
   */
  async getActivityTimeline(
    clientId: number,
    filters?: ActivityFilters
  ): Promise<ClientActivity[]> {
    const db = getDatabase();

    let query = `SELECT ${CLIENT_ACTIVITY_COLUMNS} FROM client_activities WHERE client_id = ?`;
    const params: SqlValue[] = [clientId];

    if (filters?.activityType) {
      query += ' AND activity_type = ?';
      params.push(filters.activityType);
    }

    if (filters?.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const rows = (await db.all(query, params)) as unknown as ActivityRow[];
    return rows.map(toActivity);
  }

  /**
   * Get recent activities across all clients
   */
  async getRecentActivities(
    limit: number = 50
  ): Promise<(ClientActivity & { clientName?: string; companyName?: string })[]> {
    const db = getDatabase();

    const rows = (await db.all(
      `SELECT ca.*, c.contact_name, c.company_name
       FROM client_activities ca
       JOIN active_clients c ON ca.client_id = c.id
       ORDER BY ca.created_at DESC
       LIMIT ?`,
      [limit]
    )) as unknown as (ActivityRow & { contact_name?: string; company_name?: string })[];

    return rows.map((row) => ({
      ...toActivity(row),
      clientName: row.contact_name,
      companyName: row.company_name
    }));
  }

  // ===================================================
  // NOTES
  // ===================================================

  /**
   * Get notes for a client
   */
  async getNotes(clientId: number): Promise<ClientNote[]> {
    const db = getDatabase();
    const rows = (await db.all(
      `SELECT cn.*, u.display_name as author_name
       FROM client_notes cn
       LEFT JOIN users u ON cn.author_user_id = u.id
       WHERE cn.client_id = ?
       ORDER BY cn.is_pinned DESC, cn.created_at DESC`,
      [clientId]
    )) as unknown as ClientNoteRow[];
    return rows.map(toClientNote);
  }

  /**
   * Add a note to a client
   */
  async addNote(clientId: number, author: string, content: string): Promise<ClientNote> {
    const db = getDatabase();

    // Look up user ID for author
    const authorUserId = await userService.getUserIdByEmailOrName(author);

    const result = await db.run(
      'INSERT INTO client_notes (client_id, author_user_id, content) VALUES (?, ?, ?)',
      [clientId, authorUserId, content]
    );

    const note = (await db.get(
      `SELECT cn.*, u.display_name as author_name
       FROM client_notes cn
       LEFT JOIN users u ON cn.author_user_id = u.id
       WHERE cn.id = ?`,
      [result.lastID]
    )) as unknown as ClientNoteRow | undefined;

    if (!note) {
      throw new Error('Failed to create note');
    }

    return toClientNote(note);
  }

  /**
   * Update a note (e.g. is_pinned)
   */
  async updateNote(noteId: number, data: { isPinned?: boolean }): Promise<ClientNote> {
    const db = getDatabase();

    if (data.isPinned !== undefined) {
      await db.run(
        'UPDATE client_notes SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [data.isPinned ? 1 : 0, noteId]
      );
    }

    const note = (await db.get(
      `SELECT cn.*, u.display_name as author_name
       FROM client_notes cn
       LEFT JOIN users u ON cn.author_user_id = u.id
       WHERE cn.id = ?`,
      [noteId]
    )) as unknown as ClientNoteRow | undefined;

    if (!note) {
      throw new Error('Note not found');
    }

    return toClientNote(note);
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM client_notes WHERE id = ?', [noteId]);
  }

  // ===================================================
  // CUSTOM FIELDS
  // ===================================================

  /**
   * Create a custom field definition
   */
  async createCustomField(data: CustomFieldData): Promise<CustomField> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO client_custom_fields (
        field_name, field_label, field_type, options, is_required,
        placeholder, default_value, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.fieldName,
        data.fieldLabel,
        data.fieldType,
        data.options ? JSON.stringify(data.options) : null,
        data.isRequired ? 1 : 0,
        data.placeholder || null,
        data.defaultValue || null,
        data.displayOrder || 0
      ]
    );

    const field = (await db.get(`SELECT ${CLIENT_CUSTOM_FIELD_COLUMNS} FROM client_custom_fields WHERE id = ?`, [
      result.lastID
    ])) as unknown as CustomFieldRow | undefined;

    if (!field) {
      throw new Error('Failed to create custom field');
    }

    return toCustomField(field);
  }

  /**
   * Get all custom field definitions
   */
  async getCustomFields(includeInactive: boolean = false): Promise<CustomField[]> {
    const db = getDatabase();

    let query = `SELECT ${CLIENT_CUSTOM_FIELD_COLUMNS} FROM client_custom_fields`;
    if (!includeInactive) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY display_order ASC, field_label ASC';

    const rows = (await db.all(query)) as unknown as CustomFieldRow[];
    return rows.map(toCustomField);
  }

  /**
   * Update a custom field definition
   */
  async updateCustomField(
    fieldId: number,
    data: Partial<CustomFieldData> & { isActive?: boolean }
  ): Promise<CustomField> {
    const db = getDatabase();

    const ALLOWED_FIELDS = [
      'field_label', 'options', 'is_required', 'placeholder',
      'default_value', 'display_order', 'is_active'
    ] as const;

    const fieldUpdates: Record<string, SqlValue> = {};
    if (data.fieldLabel !== undefined) fieldUpdates.field_label = data.fieldLabel;
    if (data.options !== undefined) fieldUpdates.options = data.options ? JSON.stringify(data.options) : null;
    if (data.isRequired !== undefined) fieldUpdates.is_required = data.isRequired ? 1 : 0;
    if (data.placeholder !== undefined) fieldUpdates.placeholder = data.placeholder || null;
    if (data.defaultValue !== undefined) fieldUpdates.default_value = data.defaultValue || null;
    if (data.displayOrder !== undefined) fieldUpdates.display_order = data.displayOrder;
    if (data.isActive !== undefined) fieldUpdates.is_active = data.isActive ? 1 : 0;

    const { setClause, params } = buildSafeUpdate(fieldUpdates, ALLOWED_FIELDS);

    if (setClause) {
      await db.run(
        `UPDATE client_custom_fields SET ${setClause} WHERE id = ?`,
        [...params, fieldId]
      );
    }

    const field = (await db.get(`SELECT ${CLIENT_CUSTOM_FIELD_COLUMNS} FROM client_custom_fields WHERE id = ?`, [
      fieldId
    ])) as unknown as CustomFieldRow | undefined;

    if (!field) {
      throw new Error('Custom field not found');
    }

    return toCustomField(field);
  }

  /**
   * Delete a custom field (marks as inactive)
   */
  async deleteCustomField(fieldId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE client_custom_fields SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [fieldId]
    );
  }

  /**
   * Set a custom field value for a client
   */
  async setCustomFieldValue(
    clientId: number,
    fieldId: number,
    value: string | null
  ): Promise<void> {
    const db = getDatabase();

    await db.run(
      `INSERT INTO client_custom_field_values (client_id, field_id, field_value)
       VALUES (?, ?, ?)
       ON CONFLICT(client_id, field_id) DO UPDATE SET
         field_value = excluded.field_value,
         updated_at = CURRENT_TIMESTAMP`,
      [clientId, fieldId, value]
    );
  }

  /**
   * Get all custom field values for a client
   */
  async getClientCustomFields(clientId: number): Promise<CustomFieldValue[]> {
    const db = getDatabase();

    const rows = (await db.all(
      `SELECT cfv.*, cf.field_name, cf.field_label, cf.field_type
       FROM client_custom_fields cf
       LEFT JOIN client_custom_field_values cfv ON cf.id = cfv.field_id AND cfv.client_id = ?
       WHERE cf.is_active = 1
       ORDER BY cf.display_order ASC`,
      [clientId]
    )) as unknown as CustomFieldValueRow[];

    return rows.map(toCustomFieldValue);
  }

  /**
   * Set multiple custom field values for a client
   */
  async setClientCustomFields(
    clientId: number,
    values: { fieldId: number; value: string | null }[]
  ): Promise<void> {
    for (const { fieldId, value } of values) {
      await this.setCustomFieldValue(clientId, fieldId, value);
    }
  }

  // ===================================================
  // TAGS & SEGMENTATION
  // ===================================================

  /**
   * Create a new tag
   */
  async createTag(data: TagData): Promise<Tag> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO tags (name, color, description, tag_type)
       VALUES (?, ?, ?, ?)`,
      [data.name, data.color || '#6b7280', data.description || null, data.tagType || 'client']
    );

    const tag = (await db.get(`SELECT ${TAG_COLUMNS} FROM tags WHERE id = ?`, [result.lastID])) as unknown as
      | TagRow
      | undefined;

    if (!tag) {
      throw new Error('Failed to create tag');
    }

    return toTag(tag);
  }

  /**
   * Get all tags
   */
  async getTags(tagType?: string): Promise<Tag[]> {
    const db = getDatabase();

    let query = `SELECT ${TAG_COLUMNS} FROM tags`;
    const params: SqlValue[] = [];

    if (tagType) {
      query += ' WHERE tag_type = ?';
      params.push(tagType);
    }

    query += ' ORDER BY name ASC';

    const rows = (await db.all(query, params)) as unknown as TagRow[];
    return rows.map(toTag);
  }

  /**
   * Update a tag
   */
  async updateTag(tagId: number, data: Partial<TagData>): Promise<Tag> {
    const db = getDatabase();

    const ALLOWED_FIELDS = ['name', 'color', 'description'] as const;

    const fieldUpdates: Record<string, SqlValue> = {};
    if (data.name !== undefined) fieldUpdates.name = data.name;
    if (data.color !== undefined) fieldUpdates.color = data.color;
    if (data.description !== undefined) fieldUpdates.description = data.description || null;

    const { setClause, params } = buildSafeUpdate(fieldUpdates, ALLOWED_FIELDS, { addTimestamp: false });

    if (setClause) {
      await db.run(`UPDATE tags SET ${setClause} WHERE id = ?`, [...params, tagId]);
    }

    const tag = (await db.get(`SELECT ${TAG_COLUMNS} FROM tags WHERE id = ?`, [tagId])) as unknown as
      | TagRow
      | undefined;

    if (!tag) {
      throw new Error('Tag not found');
    }

    return toTag(tag);
  }

  /**
   * Delete a tag
   */
  async deleteTag(tagId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM tags WHERE id = ?', [tagId]);
  }

  /**
   * Add a tag to a client
   */
  async addTagToClient(clientId: number, tagId: number): Promise<void> {
    const db = getDatabase();

    await db.run('INSERT OR IGNORE INTO client_tags (client_id, tag_id) VALUES (?, ?)', [
      clientId,
      tagId
    ]);

    // Log activity
    const tag = (await db.get('SELECT name FROM tags WHERE id = ?', [tagId])) as
      | { name: string }
      | undefined;
    if (tag) {
      await this.logActivity(clientId, {
        activityType: 'tag_added',
        title: `Added tag: ${tag.name}`,
        metadata: { tagId },
        createdBy: 'admin'
      });
    }
  }

  /**
   * Remove a tag from a client
   */
  async removeTagFromClient(clientId: number, tagId: number): Promise<void> {
    const db = getDatabase();

    // Get tag name for activity log
    const tag = (await db.get('SELECT name FROM tags WHERE id = ?', [tagId])) as
      | { name: string }
      | undefined;

    await db.run('DELETE FROM client_tags WHERE client_id = ? AND tag_id = ?', [clientId, tagId]);

    // Log activity
    if (tag) {
      await this.logActivity(clientId, {
        activityType: 'tag_removed',
        title: `Removed tag: ${tag.name}`,
        metadata: { tagId },
        createdBy: 'admin'
      });
    }
  }

  /**
   * Get all tags for a client
   */
  async getClientTags(clientId: number): Promise<Tag[]> {
    const db = getDatabase();

    const rows = (await db.all(
      `SELECT t.* FROM tags t
       JOIN client_tags ct ON t.id = ct.tag_id
       WHERE ct.client_id = ?
       ORDER BY t.name ASC`,
      [clientId]
    )) as unknown as TagRow[];

    return rows.map(toTag);
  }

  /**
   * Get all clients with a specific tag
   */
  async getClientsByTag(tagId: number): Promise<ClientRow[]> {
    const db = getDatabase();

    return (await db.all(
      `SELECT c.* FROM active_clients c
       JOIN client_tags ct ON c.id = ct.client_id
       WHERE ct.tag_id = ?
       ORDER BY c.company_name ASC, c.contact_name ASC`,
      [tagId]
    )) as unknown as ClientRow[];
  }

  // ===================================================
  // HEALTH SCORING
  // ===================================================

  /**
   * Calculate health score for a client
   */
  async calculateHealthScore(clientId: number): Promise<ClientHealthScore> {
    const db = getDatabase();

    // Get client data
    const client = (await db.get(`SELECT ${CLIENT_COLUMNS} FROM active_clients WHERE id = ?`, [clientId])) as unknown as
      | ClientRow
      | undefined;

    if (!client) {
      throw new Error('Client not found');
    }

    // Calculate payment history score (0-25 points)
    let paymentScore = 25;
    try {
      const paymentData = (await db.get(
        `SELECT
          COUNT(*) as total_invoices,
          SUM(CASE WHEN status = 'paid' AND (paid_date IS NULL OR paid_date <= due_date) THEN 1 ELSE 0 END) as paid_on_time,
          AVG(CASE WHEN status = 'paid' AND paid_date > due_date THEN julianday(paid_date) - julianday(due_date) ELSE 0 END) as avg_days_overdue
         FROM active_invoices
         WHERE client_id = ?`,
        [clientId]
      )) as { total_invoices: number; paid_on_time: number; avg_days_overdue: number } | undefined;

      if (paymentData && paymentData.total_invoices > 0) {
        const onTimeRate = paymentData.paid_on_time / paymentData.total_invoices;
        paymentScore = Math.round(onTimeRate * 25);
        if (paymentData.avg_days_overdue > 0) {
          paymentScore = Math.max(
            0,
            paymentScore - Math.min(10, Math.floor(paymentData.avg_days_overdue / 7))
          );
        }
      }
    } catch {
      paymentScore = 25;
    }

    // Calculate engagement score (0-25 points)
    let engagementScore = 25;
    try {
      const messageData = (await db.get(
        `SELECT COUNT(*) as message_count, MAX(created_at) as last_message
         FROM active_messages
         WHERE project_id IN (SELECT id FROM active_projects WHERE client_id = ?)`,
        [clientId]
      )) as { message_count: number; last_message: string | null } | undefined;

      if (messageData) {
        engagementScore = Math.min(15, Math.floor(messageData.message_count / 5));
        if (messageData.last_message) {
          const daysSinceMessage = Math.floor(
            (Date.now() - new Date(messageData.last_message).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceMessage < 7) engagementScore += 10;
          else if (daysSinceMessage < 30) engagementScore += 5;
        }
      }
    } catch {
      engagementScore = 25;
    }

    // Calculate project success score (0-25 points)
    let projectScore = 25;
    try {
      const projectData = (await db.get(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'on-hold' THEN 1 ELSE 0 END) as on_hold
         FROM active_projects
         WHERE client_id = ?`,
        [clientId]
      )) as { total: number; completed: number; on_hold: number } | undefined;

      if (projectData && projectData.total > 0) {
        const completionRate = projectData.completed / projectData.total;
        const onHoldRate = projectData.on_hold / projectData.total;
        projectScore = Math.round(completionRate * 20) + 5;
        projectScore = Math.max(0, projectScore - Math.round(onHoldRate * 10));
      }
    } catch {
      projectScore = 25;
    }

    // Calculate communication score (0-25 points)
    let communicationScore = 25;
    try {
      const activityData = (await db.get(
        `SELECT COUNT(*) as activity_count, MAX(created_at) as last_activity
         FROM client_activities
         WHERE client_id = ?`,
        [clientId]
      )) as { activity_count: number; last_activity: string | null } | undefined;

      if (activityData && activityData.activity_count > 0) {
        communicationScore = Math.min(15, Math.floor(activityData.activity_count / 3));
        if (activityData.last_activity) {
          const daysSinceActivity = Math.floor(
            (Date.now() - new Date(activityData.last_activity).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceActivity < 7) communicationScore += 10;
          else if (daysSinceActivity < 30) communicationScore += 5;
        }
      }
    } catch {
      communicationScore = 25;
    }

    // Calculate total score
    const totalScore = paymentScore + engagementScore + projectScore + communicationScore;

    // Determine health status
    let status: 'healthy' | 'at_risk' | 'critical';
    if (totalScore >= 70) {
      status = 'healthy';
    } else if (totalScore >= 40) {
      status = 'at_risk';
    } else {
      status = 'critical';
    }

    // Update client record
    await db.run(
      'UPDATE clients SET health_score = ?, health_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [totalScore, status, clientId]
    );

    return {
      score: totalScore,
      status,
      factors: {
        paymentHistory: paymentScore,
        engagement: engagementScore,
        projectSuccess: projectScore,
        communicationScore
      },
      lastCalculated: new Date().toISOString()
    };
  }

  /**
   * Update health status for a client
   */
  async updateHealthStatus(clientId: number): Promise<ClientHealthScore> {
    return this.calculateHealthScore(clientId);
  }

  /**
   * Get all at-risk clients
   */
  async getAtRiskClients(): Promise<ClientRow[]> {
    const db = getDatabase();

    return (await db.all(
      `SELECT ${CLIENT_COLUMNS} FROM active_clients
       WHERE health_status IN ('at_risk', 'critical')
       ORDER BY health_score ASC`
    )) as unknown as ClientRow[];
  }

  /**
   * Get client lifetime value
   */
  async getClientLifetimeValue(clientId: number): Promise<number> {
    const db = getDatabase();

    const result = (await db.get(
      `SELECT SUM(CAST(amount_paid AS DECIMAL)) as total
       FROM active_invoices
       WHERE client_id = ? AND status = 'paid'`,
      [clientId]
    )) as { total: number | string | null } | undefined;

    const ltv = result?.total ? parseFloat(String(result.total)) : 0;

    // Update client record
    await db.run(
      'UPDATE clients SET lifetime_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [ltv, clientId]
    );

    return ltv;
  }

  /**
   * Get comprehensive stats for a client
   */
  async getClientStats(clientId: number): Promise<ClientStats> {
    const db = getDatabase();

    // Get project stats (use LOWER for case-insensitive comparison)
    const projectStats = (await db.get(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN LOWER(status) IN ('pending', 'active', 'in-progress', 'in-review') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END) as completed
       FROM active_projects
       WHERE client_id = ?`,
      [clientId]
    )) as { total: number; active: number; completed: number } | undefined;

    // Get invoice stats
    const invoiceStats = (await db.get(
      `SELECT
        SUM(CAST(amount_total AS DECIMAL)) as invoiced,
        SUM(CASE WHEN status = 'paid' THEN CAST(amount_total AS DECIMAL) ELSE 0 END) as paid,
        SUM(CASE WHEN status NOT IN ('paid', 'cancelled', 'voided') THEN CAST(amount_total AS DECIMAL) - COALESCE(CAST(amount_paid AS DECIMAL), 0) ELSE 0 END) as outstanding
       FROM active_invoices
       WHERE client_id = ?`,
      [clientId]
    )) as
      | {
          invoiced: number | string | null;
          paid: number | string | null;
          outstanding: number | string | null;
        }
      | undefined;

    // Get average payment days
    const paymentDays = (await db.get(
      `SELECT AVG(julianday(paid_date) - julianday(issued_date)) as avg_days
       FROM active_invoices
       WHERE client_id = ? AND status = 'paid' AND paid_date IS NOT NULL AND issued_date IS NOT NULL`,
      [clientId]
    )) as { avg_days: number | null } | undefined;

    // Get message count
    const messageCount = (await db.get(
      `SELECT COUNT(*) as count
       FROM active_messages
       WHERE project_id IN (SELECT id FROM active_projects WHERE client_id = ?)`,
      [clientId]
    )) as { count: number } | undefined;

    // Get last activity date
    const lastActivity = (await db.get(
      `SELECT MAX(created_at) as last_date
       FROM client_activities
       WHERE client_id = ?`,
      [clientId]
    )) as { last_date: string | null } | undefined;

    // Get lifetime value
    const ltv = await this.getClientLifetimeValue(clientId);

    return {
      totalProjects: projectStats?.total || 0,
      activeProjects: projectStats?.active || 0,
      completedProjects: projectStats?.completed || 0,
      totalInvoiced: invoiceStats?.invoiced ? parseFloat(String(invoiceStats.invoiced)) : 0,
      totalPaid: invoiceStats?.paid ? parseFloat(String(invoiceStats.paid)) : 0,
      totalOutstanding: invoiceStats?.outstanding
        ? parseFloat(String(invoiceStats.outstanding))
        : 0,
      averagePaymentDays: paymentDays?.avg_days ? Math.round(paymentDays.avg_days) : 0,
      lifetimeValue: ltv,
      messageCount: messageCount?.count || 0,
      lastActivityDate: lastActivity?.last_date ?? undefined
    };
  }

  // ===================================================
  // CRM FIELDS UPDATE
  // ===================================================

  /**
   * Update CRM-specific fields for a client
   */
  async updateCRMFields(
    clientId: number,
    data: {
      acquisitionSource?: string;
      industry?: string;
      companySize?: string;
      website?: string;
      nextFollowUpDate?: string;
      notes?: string;
      preferredContactMethod?: string;
    }
  ): Promise<void> {
    const db = getDatabase();

    const ALLOWED_FIELDS = [
      'acquisition_source', 'industry', 'company_size', 'website',
      'next_follow_up_date', 'notes', 'preferred_contact_method'
    ] as const;

    const fieldUpdates: Record<string, SqlValue> = {};
    if (data.acquisitionSource !== undefined) fieldUpdates.acquisition_source = data.acquisitionSource || null;
    if (data.industry !== undefined) fieldUpdates.industry = data.industry || null;
    if (data.companySize !== undefined) fieldUpdates.company_size = data.companySize || null;
    if (data.website !== undefined) fieldUpdates.website = data.website || null;
    if (data.nextFollowUpDate !== undefined) fieldUpdates.next_follow_up_date = data.nextFollowUpDate || null;
    if (data.notes !== undefined) fieldUpdates.notes = data.notes || null;
    if (data.preferredContactMethod !== undefined) fieldUpdates.preferred_contact_method = data.preferredContactMethod || null;

    const { setClause, params } = buildSafeUpdate(fieldUpdates, ALLOWED_FIELDS);

    if (setClause) {
      await db.run(`UPDATE clients SET ${setClause} WHERE id = ?`, [...params, clientId]);
    }
  }

  /**
   * Get clients due for follow-up
   */
  /**
   * Get all clients with project/invoice counts for the admin listing page.
   */
  async getAdminClientListing(): Promise<{
    clients: AdminClientRow[];
    stats: AdminClientStats;
  }> {
    const db = getDatabase();

    const clients = await db.all<AdminClientRow>(`
      SELECT
        c.id,
        c.company_name as companyName,
        c.contact_name as contactName,
        c.email,
        c.phone,
        c.status,
        c.client_type as clientType,
        c.created_at as createdAt,
        c.updated_at as updatedAt,
        (SELECT COUNT(*) FROM projects WHERE client_id = c.id AND deleted_at IS NULL) as projectCount,
        (SELECT COUNT(*) FROM invoices WHERE client_id = c.id AND deleted_at IS NULL) as invoiceCount
      FROM clients c
      WHERE c.deleted_at IS NULL
      ORDER BY c.created_at DESC
    `);

    const stats: AdminClientStats = {
      total: clients.length,
      active: clients.filter((c) => c.status === 'active').length,
      pending: clients.filter((c) => c.status === 'pending').length,
      inactive: clients.filter((c) => c.status === 'inactive').length
    };

    return { clients, stats };
  }

  async getClientsForFollowUp(): Promise<ClientRow[]> {
    const db = getDatabase();

    return (await db.all(
      `SELECT ${CLIENT_COLUMNS} FROM active_clients
       WHERE next_follow_up_date IS NOT NULL
         AND next_follow_up_date <= DATE('now')
         AND status = 'active'
       ORDER BY next_follow_up_date ASC`
    )) as unknown as ClientRow[];
  }
  // =====================================================
  // NOTIFICATION HISTORY
  // =====================================================

  /**
   * Get notification history for a client
   */
  async getClientNotificationHistory(
    clientId: number,
    limit: number
  ): Promise<Record<string, unknown>[]> {
    const db = getDatabase();
    const notifications = await db.all(
      `SELECT id, type, title, message, is_read, created_at, data
       FROM notification_history
       WHERE user_id = ? AND user_type = 'client'
       ORDER BY created_at DESC
       LIMIT ?`,
      [clientId, limit]
    );
    return notifications as Record<string, unknown>[];
  }

  /**
   * Mark a single notification as read for a client.
   * Returns the number of rows changed.
   */
  async markClientNotificationRead(
    notificationId: number,
    clientId: number
  ): Promise<number> {
    const db = getDatabase();
    const result = await db.run(
      `UPDATE notification_history
       SET is_read = 1, read_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND user_type = 'client'`,
      [notificationId, clientId]
    );
    return result.changes ?? 0;
  }

  /**
   * Mark all unread notifications as read for a client
   */
  async markAllClientNotificationsRead(clientId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE notification_history
       SET is_read = 1, read_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND user_type = 'client' AND is_read = 0`,
      [clientId]
    );
  }

  // ===================================================
  // ADMIN CORE ROUTE HELPERS
  // ===================================================

  /**
   * Get flat client list for admin route (without stats wrapper).
   * Returns raw rows with id, company_name, contact_name, email, etc.
   */
  async getAdminClientList(): Promise<AdminClientListRow[]> {
    const db = getDatabase();
    return db.all<AdminClientListRow>(`
      SELECT
        c.id,
        c.company_name,
        c.contact_name,
        c.email,
        c.phone,
        c.status,
        c.client_type,
        c.health_score,
        c.health_status,
        c.created_at,
        c.updated_at,
        (SELECT COUNT(*) FROM projects WHERE client_id = c.id AND deleted_at IS NULL) as project_count
      FROM clients c
      WHERE c.deleted_at IS NULL
      ORDER BY c.created_at DESC
    `);
  }

  /**
   * Get all client-tag associations for bulk tag lookup.
   */
  async getAllClientTags(): Promise<AllClientTagRow[]> {
    const db = getDatabase();
    return db.all<AllClientTagRow>(`
      SELECT ct.client_id, t.id, t.name, t.color
      FROM client_tags ct
      JOIN tags t ON t.id = ct.tag_id
      ORDER BY t.name ASC
    `);
  }

  /**
   * Get single client detail for admin view (full profile).
   */
  async getAdminClientDetail(clientId: number): Promise<ClientProfile | undefined> {
    const db = getDatabase();
    return db.get<ClientProfile>(
      `SELECT id, email, company_name, contact_name, phone, status, client_type,
              billing_name, billing_company, billing_address, billing_address2,
              billing_phone, billing_email,
              billing_city, billing_state, billing_zip, billing_country,
              created_at, updated_at
       FROM clients WHERE id = ? AND deleted_at IS NULL`,
      [clientId]
    );
  }

  /**
   * Get client projects for admin detail view (aliased column names).
   */
  async getAdminClientProjectsAliased(clientId: number): Promise<ClientProjectSummary[]> {
    return this.getClientProjects(clientId);
  }

  /**
   * Check if an email is already registered. Optionally exclude a client ID.
   */
  async emailExists(email: string, excludeClientId?: number): Promise<boolean> {
    const db = getDatabase();
    const query = excludeClientId
      ? 'SELECT 1 FROM clients WHERE email = ? AND id != ? AND deleted_at IS NULL LIMIT 1'
      : 'SELECT 1 FROM clients WHERE email = ? AND deleted_at IS NULL LIMIT 1';
    const params = excludeClientId ? [email, excludeClientId] : [email];
    const row = await db.get(query, params);
    return !!row;
  }

  /**
   * Create a new client and return the inserted row.
   */
  async createClient(data: CreateClientData): Promise<ClientProfile | undefined> {
    const db = getDatabase();
    const result = await db.run(
      `INSERT INTO clients (email, password_hash, company_name, contact_name, phone, client_type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        data.email,
        data.password_hash,
        data.company_name || null,
        data.contact_name || null,
        data.phone || null,
        data.client_type || null,
        data.status || 'pending'
      ]
    );
    if (!result.lastID) return undefined;
    return this.getAdminClientDetail(result.lastID);
  }

  /**
   * Update client fields using raw SET clauses and values array.
   * Returns the updated client row.
   */
  async updateClientFields(
    clientId: number,
    setClauses: string[],
    values: SqlValue[]
  ): Promise<ClientProfile | undefined> {
    const db = getDatabase();
    const setString = [...setClauses, 'updated_at = CURRENT_TIMESTAMP'].join(', ');
    await db.run(
      `UPDATE clients SET ${setString} WHERE id = ? AND deleted_at IS NULL`,
      [...values, clientId]
    );
    return this.getAdminClientDetail(clientId);
  }

  /**
   * Get admin-facing project list for a client (same as getClientProjects).
   */
  async getAdminClientProjects(clientId: number): Promise<ClientProjectSummary[]> {
    return this.getClientProjects(clientId);
  }

  /**
   * Get minimal client info needed for sending an invitation.
   */
  async getClientForInvite(clientId: number): Promise<InviteClientRow | undefined> {
    const db = getDatabase();
    return db.get<InviteClientRow>(
      'SELECT id, email, contact_name, status FROM clients WHERE id = ? AND deleted_at IS NULL',
      [clientId]
    );
  }

  /**
   * Set invitation token and expiry on a client record.
   */
  async setInvitationToken(
    clientId: number,
    token: string,
    expiresAt: string
  ): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE clients
       SET invitation_token = ?, invitation_expires_at = ?, invitation_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [token, expiresAt, clientId]
    );
  }
  // =====================================================
  // ADMIN-WIDE CONTACT QUERIES
  // =====================================================

  /**
   * Get all explicit client_contacts with company info (admin CRM view).
   */
  async getAllExplicitContacts(): Promise<Record<string, unknown>[]> {
    const db = getDatabase();
    return db.all(`
      SELECT
        cc.id,
        cc.first_name as firstName,
        cc.last_name as lastName,
        cc.email,
        cc.phone,
        cc.role,
        cc.is_primary as isPrimary,
        'active' as status,
        cc.client_id as clientId,
        c.company_name as company,
        c.company_name as clientName,
        cc.created_at as createdAt,
        cc.updated_at as updatedAt
      FROM client_contacts cc
      JOIN clients c ON cc.client_id = c.id
      WHERE c.deleted_at IS NULL
        AND cc.deleted_at IS NULL
      ORDER BY cc.is_primary DESC, cc.created_at DESC
    `) as Promise<Record<string, unknown>[]>;
  }

  /**
   * Get all client records for the admin contacts view.
   */
  async getAllClientContactRecords(): Promise<Record<string, unknown>[]> {
    const db = getDatabase();
    return db.all(`
      SELECT
        c.id,
        c.contact_name,
        c.email,
        c.phone,
        c.company_name as company,
        c.status,
        c.created_at as createdAt,
        c.updated_at as updatedAt
      FROM clients c
      WHERE c.deleted_at IS NULL
    `) as Promise<Record<string, unknown>[]>;
  }

  /**
   * Update a client_contact record by ID (admin contacts endpoint).
   * Also handles setting is_primary across the same client's contacts.
   */
  async updateContactAdmin(
    contactId: number,
    data: { isPrimary?: boolean; firstName?: string; lastName?: string; email?: string; phone?: string; role?: string }
  ): Promise<Record<string, unknown> | undefined> {
    const db = getDatabase();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.isPrimary !== undefined) {
      if (data.isPrimary) {
        const contact = await db.get('SELECT client_id FROM client_contacts WHERE id = ?', [contactId]);
        if (contact) {
          await db.run('UPDATE client_contacts SET is_primary = 0 WHERE client_id = ?', [(contact as Record<string, unknown>).client_id as number]);
        }
      }
      updates.push('is_primary = ?');
      values.push(data.isPrimary ? 1 : 0);
    }
    if (data.firstName !== undefined) { updates.push('first_name = ?'); values.push(data.firstName); }
    if (data.lastName !== undefined) { updates.push('last_name = ?'); values.push(data.lastName); }
    if (data.email !== undefined) { updates.push('email = ?'); values.push(data.email); }
    if (data.phone !== undefined) { updates.push('phone = ?'); values.push(data.phone); }
    if (data.role !== undefined) { updates.push('role = ?'); values.push(data.role); }

    if (updates.length === 0) return undefined;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(contactId);

    const CONTACT_UPDATE_COLUMNS = `
      id, client_id, first_name, last_name, email, phone, title, department,
      role, is_primary, notes, created_at, updated_at
    `.replace(/\\s+/g, ' ').trim();

    await db.run(
      `UPDATE client_contacts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return db.get(
      `SELECT ${CONTACT_UPDATE_COLUMNS} FROM client_contacts WHERE id = ?`,
      [contactId]
    ) as Promise<Record<string, unknown> | undefined>;
  }
}

// Export singleton instance
export const clientService = new ClientService();
export default clientService;
