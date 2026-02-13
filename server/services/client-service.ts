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

// Type definitions
type SqlValue = string | number | boolean | null;

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

interface ContactRow {
  id: number;
  client_id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  role: string;
  is_primary: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

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

interface ActivityRow {
  id: number;
  client_id: number;
  activity_type: string;
  title: string;
  description?: string;
  metadata?: string;
  created_by?: string;
  created_at: string;
}

// =====================================================
// INTERFACES - Custom Fields
// =====================================================

export interface CustomField {
  id: number;
  fieldName: string;
  fieldLabel: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'url' | 'email' | 'phone';
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

interface CustomFieldRow {
  id: number;
  field_name: string;
  field_label: string;
  field_type: string;
  options?: string;
  is_required: number;
  placeholder?: string;
  default_value?: string;
  display_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface CustomFieldValueRow {
  id: number;
  client_id: number;
  field_id: number;
  field_name: string;
  field_label: string;
  field_type: string;
  field_value?: string;
  created_at: string;
  updated_at: string;
}

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

interface TagRow {
  id: number;
  name: string;
  color: string;
  description?: string;
  tag_type: string;
  created_at: string;
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

interface ClientNoteRow {
  id: number;
  client_id: number;
  author_user_id: number | null;
  author_name: string | null; // From JOIN with users table
  content: string;
  is_pinned: number;
  created_at: string;
  updated_at: string;
}

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
// HELPER FUNCTIONS
// =====================================================

function toContact(row: ContactRow): ClientContact {
  return {
    id: row.id,
    clientId: row.client_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    title: row.title,
    department: row.department,
    role: row.role as ClientContact['role'],
    isPrimary: Boolean(row.is_primary),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toActivity(row: ActivityRow): ClientActivity {
  return {
    id: row.id,
    clientId: row.client_id,
    activityType: row.activity_type,
    title: row.title,
    description: row.description,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function toCustomField(row: CustomFieldRow): CustomField {
  return {
    id: row.id,
    fieldName: row.field_name,
    fieldLabel: row.field_label,
    fieldType: row.field_type as CustomField['fieldType'],
    options: row.options ? JSON.parse(row.options) : undefined,
    isRequired: Boolean(row.is_required),
    placeholder: row.placeholder,
    defaultValue: row.default_value,
    displayOrder: row.display_order,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toCustomFieldValue(row: CustomFieldValueRow): CustomFieldValue {
  return {
    id: row.id,
    clientId: row.client_id,
    fieldId: row.field_id,
    fieldName: row.field_name,
    fieldLabel: row.field_label,
    fieldType: row.field_type,
    fieldValue: row.field_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    description: row.description,
    tagType: row.tag_type,
    createdAt: row.created_at
  };
}

function toClientNote(row: ClientNoteRow): ClientNote {
  return {
    id: row.id,
    clientId: row.client_id,
    author: row.author_name || 'Unknown',
    content: row.content,
    isPinned: Boolean(row.is_pinned),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// =====================================================
// CLIENT SERVICE CLASS
// =====================================================

class ClientService {
  // ===================================================
  // CONTACT MANAGEMENT
  // ===================================================

  /**
   * Create a new contact for a client
   */
  async createContact(clientId: number, data: ContactCreateData): Promise<ClientContact> {
    const db = getDatabase();

    // If this is marked as primary, unset other primary contacts
    if (data.isPrimary) {
      await db.run(
        'UPDATE client_contacts SET is_primary = 0 WHERE client_id = ?',
        [clientId]
      );
    }

    const result = await db.run(
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

    const contact = await db.get(
      'SELECT * FROM client_contacts WHERE id = ?',
      [result.lastID]
    ) as unknown as ContactRow | undefined;

    if (!contact) {
      throw new Error('Failed to create contact');
    }

    // Log activity
    await this.logActivity(clientId, {
      activityType: 'contact_added',
      title: `Added contact: ${data.firstName} ${data.lastName}`,
      metadata: { contactId: result.lastID },
      createdBy: 'admin'
    });

    return toContact(contact);
  }

  /**
   * Get all contacts for a client
   */
  async getContacts(clientId: number): Promise<ClientContact[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT * FROM client_contacts
       WHERE client_id = ?
       ORDER BY is_primary DESC, first_name ASC`,
      [clientId]
    ) as unknown as ContactRow[];
    return rows.map(toContact);
  }

  /**
   * Get a single contact by ID
   */
  async getContact(contactId: number): Promise<ClientContact | null> {
    const db = getDatabase();
    const row = await db.get(
      'SELECT * FROM client_contacts WHERE id = ?',
      [contactId]
    ) as unknown as ContactRow | undefined;
    return row ? toContact(row) : null;
  }

  /**
   * Update a contact
   */
  async updateContact(contactId: number, data: Partial<ContactCreateData>): Promise<ClientContact> {
    const db = getDatabase();

    // Get existing contact to know the client
    const existing = await db.get(
      'SELECT * FROM client_contacts WHERE id = ?',
      [contactId]
    ) as unknown as ContactRow | undefined;

    if (!existing) {
      throw new Error('Contact not found');
    }

    // If setting as primary, unset other primary contacts
    if (data.isPrimary) {
      await db.run(
        'UPDATE client_contacts SET is_primary = 0 WHERE client_id = ? AND id != ?',
        [existing.client_id, contactId]
      );
    }

    const updates: string[] = [];
    const values: SqlValue[] = [];

    if (data.firstName !== undefined) {
      updates.push('first_name = ?');
      values.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(data.lastName);
    }
    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email || null);
    }
    if (data.phone !== undefined) {
      updates.push('phone = ?');
      values.push(data.phone || null);
    }
    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title || null);
    }
    if (data.department !== undefined) {
      updates.push('department = ?');
      values.push(data.department || null);
    }
    if (data.role !== undefined) {
      updates.push('role = ?');
      values.push(data.role);
    }
    if (data.isPrimary !== undefined) {
      updates.push('is_primary = ?');
      values.push(data.isPrimary ? 1 : 0);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      values.push(data.notes || null);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(contactId);

      await db.run(
        `UPDATE client_contacts SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    const updated = await db.get(
      'SELECT * FROM client_contacts WHERE id = ?',
      [contactId]
    ) as unknown as ContactRow | undefined;

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
    const contact = await db.get(
      'SELECT * FROM client_contacts WHERE id = ?',
      [contactId]
    ) as unknown as ContactRow | undefined;

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
   * Set a contact as the primary contact for a client
   */
  async setPrimaryContact(clientId: number, contactId: number): Promise<void> {
    const db = getDatabase();

    // Unset all primary contacts for this client
    await db.run(
      'UPDATE client_contacts SET is_primary = 0 WHERE client_id = ?',
      [clientId]
    );

    // Set the specified contact as primary
    await db.run(
      'UPDATE client_contacts SET is_primary = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND client_id = ?',
      [contactId, clientId]
    );
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
    const createdByUserId = await userService.getUserIdByEmailOrName(activity.createdBy || 'system');

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
    await db.run(
      'UPDATE clients SET last_contact_date = DATE("now") WHERE id = ?',
      [clientId]
    );

    const row = await db.get(
      'SELECT * FROM client_activities WHERE id = ?',
      [result.lastID]
    ) as unknown as ActivityRow | undefined;

    if (!row) {
      throw new Error('Failed to create activity');
    }

    return toActivity(row);
  }

  /**
   * Get activity timeline for a client
   */
  async getActivityTimeline(clientId: number, filters?: ActivityFilters): Promise<ClientActivity[]> {
    const db = getDatabase();

    let query = 'SELECT * FROM client_activities WHERE client_id = ?';
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

    const rows = await db.all(query, params) as unknown as ActivityRow[];
    return rows.map(toActivity);
  }

  /**
   * Get recent activities across all clients
   */
  async getRecentActivities(limit: number = 50): Promise<(ClientActivity & { clientName?: string; companyName?: string })[]> {
    const db = getDatabase();

    const rows = await db.all(
      `SELECT ca.*, c.contact_name, c.company_name
       FROM client_activities ca
       JOIN clients c ON ca.client_id = c.id
       ORDER BY ca.created_at DESC
       LIMIT ?`,
      [limit]
    ) as unknown as (ActivityRow & { contact_name?: string; company_name?: string })[];

    return rows.map(row => ({
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
    const rows = await db.all(
      `SELECT cn.*, u.display_name as author_name
       FROM client_notes cn
       LEFT JOIN users u ON cn.author_user_id = u.id
       WHERE cn.client_id = ?
       ORDER BY cn.is_pinned DESC, cn.created_at DESC`,
      [clientId]
    ) as unknown as ClientNoteRow[];
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

    const note = await db.get(
      `SELECT cn.*, u.display_name as author_name
       FROM client_notes cn
       LEFT JOIN users u ON cn.author_user_id = u.id
       WHERE cn.id = ?`,
      [result.lastID]
    ) as unknown as ClientNoteRow | undefined;

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

    const note = await db.get(
      `SELECT cn.*, u.display_name as author_name
       FROM client_notes cn
       LEFT JOIN users u ON cn.author_user_id = u.id
       WHERE cn.id = ?`,
      [noteId]
    ) as unknown as ClientNoteRow | undefined;

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

    const field = await db.get(
      'SELECT * FROM client_custom_fields WHERE id = ?',
      [result.lastID]
    ) as unknown as CustomFieldRow | undefined;

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

    let query = 'SELECT * FROM client_custom_fields';
    if (!includeInactive) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY display_order ASC, field_label ASC';

    const rows = await db.all(query) as unknown as CustomFieldRow[];
    return rows.map(toCustomField);
  }

  /**
   * Update a custom field definition
   */
  async updateCustomField(fieldId: number, data: Partial<CustomFieldData> & { isActive?: boolean }): Promise<CustomField> {
    const db = getDatabase();

    const updates: string[] = [];
    const values: SqlValue[] = [];

    if (data.fieldLabel !== undefined) {
      updates.push('field_label = ?');
      values.push(data.fieldLabel);
    }
    if (data.options !== undefined) {
      updates.push('options = ?');
      values.push(data.options ? JSON.stringify(data.options) : null);
    }
    if (data.isRequired !== undefined) {
      updates.push('is_required = ?');
      values.push(data.isRequired ? 1 : 0);
    }
    if (data.placeholder !== undefined) {
      updates.push('placeholder = ?');
      values.push(data.placeholder || null);
    }
    if (data.defaultValue !== undefined) {
      updates.push('default_value = ?');
      values.push(data.defaultValue || null);
    }
    if (data.displayOrder !== undefined) {
      updates.push('display_order = ?');
      values.push(data.displayOrder);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(fieldId);

      await db.run(
        `UPDATE client_custom_fields SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    const field = await db.get(
      'SELECT * FROM client_custom_fields WHERE id = ?',
      [fieldId]
    ) as unknown as CustomFieldRow | undefined;

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
  async setCustomFieldValue(clientId: number, fieldId: number, value: string | null): Promise<void> {
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

    const rows = await db.all(
      `SELECT cfv.*, cf.field_name, cf.field_label, cf.field_type
       FROM client_custom_fields cf
       LEFT JOIN client_custom_field_values cfv ON cf.id = cfv.field_id AND cfv.client_id = ?
       WHERE cf.is_active = 1
       ORDER BY cf.display_order ASC`,
      [clientId]
    ) as unknown as CustomFieldValueRow[];

    return rows.map(toCustomFieldValue);
  }

  /**
   * Set multiple custom field values for a client
   */
  async setClientCustomFields(clientId: number, values: { fieldId: number; value: string | null }[]): Promise<void> {
    const db = getDatabase();

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
      [
        data.name,
        data.color || '#6b7280',
        data.description || null,
        data.tagType || 'client'
      ]
    );

    const tag = await db.get(
      'SELECT * FROM tags WHERE id = ?',
      [result.lastID]
    ) as unknown as TagRow | undefined;

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

    let query = 'SELECT * FROM tags';
    const params: SqlValue[] = [];

    if (tagType) {
      query += ' WHERE tag_type = ?';
      params.push(tagType);
    }

    query += ' ORDER BY name ASC';

    const rows = await db.all(query, params) as unknown as TagRow[];
    return rows.map(toTag);
  }

  /**
   * Update a tag
   */
  async updateTag(tagId: number, data: Partial<TagData>): Promise<Tag> {
    const db = getDatabase();

    const updates: string[] = [];
    const values: SqlValue[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      values.push(data.color);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description || null);
    }

    if (updates.length > 0) {
      values.push(tagId);
      await db.run(
        `UPDATE tags SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    const tag = await db.get(
      'SELECT * FROM tags WHERE id = ?',
      [tagId]
    ) as unknown as TagRow | undefined;

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

    await db.run(
      'INSERT OR IGNORE INTO client_tags (client_id, tag_id) VALUES (?, ?)',
      [clientId, tagId]
    );

    // Log activity
    const tag = await db.get('SELECT name FROM tags WHERE id = ?', [tagId]) as { name: string } | undefined;
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
    const tag = await db.get('SELECT name FROM tags WHERE id = ?', [tagId]) as { name: string } | undefined;

    await db.run(
      'DELETE FROM client_tags WHERE client_id = ? AND tag_id = ?',
      [clientId, tagId]
    );

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

    const rows = await db.all(
      `SELECT t.* FROM tags t
       JOIN client_tags ct ON t.id = ct.tag_id
       WHERE ct.client_id = ?
       ORDER BY t.name ASC`,
      [clientId]
    ) as unknown as TagRow[];

    return rows.map(toTag);
  }

  /**
   * Get all clients with a specific tag
   */
  async getClientsByTag(tagId: number): Promise<ClientRow[]> {
    const db = getDatabase();

    return await db.all(
      `SELECT c.* FROM clients c
       JOIN client_tags ct ON c.id = ct.client_id
       WHERE ct.tag_id = ?
       ORDER BY c.company_name ASC, c.contact_name ASC`,
      [tagId]
    ) as unknown as ClientRow[];
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
    const client = await db.get(
      'SELECT * FROM clients WHERE id = ?',
      [clientId]
    ) as unknown as ClientRow | undefined;

    if (!client) {
      throw new Error('Client not found');
    }

    // Calculate payment history score (0-25 points)
    const paymentData = await db.get(
      `SELECT
        COUNT(*) as total_invoices,
        SUM(CASE WHEN status = 'paid' AND (paid_date IS NULL OR paid_date <= due_date) THEN 1 ELSE 0 END) as paid_on_time,
        AVG(CASE WHEN status = 'paid' AND paid_date > due_date THEN julianday(paid_date) - julianday(due_date) ELSE 0 END) as avg_days_overdue
       FROM invoices
       WHERE client_id = ?`,
      [clientId]
    ) as { total_invoices: number; paid_on_time: number; avg_days_overdue: number } | undefined;

    let paymentScore = 25;
    if (paymentData && paymentData.total_invoices > 0) {
      const onTimeRate = paymentData.paid_on_time / paymentData.total_invoices;
      paymentScore = Math.round(onTimeRate * 25);
      // Penalize for average days overdue
      if (paymentData.avg_days_overdue > 0) {
        paymentScore = Math.max(0, paymentScore - Math.min(10, Math.floor(paymentData.avg_days_overdue / 7)));
      }
    }

    // Calculate engagement score (0-25 points)
    const messageData = await db.get(
      `SELECT COUNT(*) as message_count, MAX(created_at) as last_message
       FROM messages
       WHERE project_id IN (SELECT id FROM projects WHERE client_id = ?)`,
      [clientId]
    ) as { message_count: number; last_message: string | null } | undefined;

    let engagementScore = 25;
    if (messageData) {
      // Base score on message count
      engagementScore = Math.min(15, Math.floor(messageData.message_count / 5));
      // Add points for recent engagement
      if (messageData.last_message) {
        const daysSinceMessage = Math.floor(
          (Date.now() - new Date(messageData.last_message).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceMessage < 7) engagementScore += 10;
        else if (daysSinceMessage < 30) engagementScore += 5;
      }
    }

    // Calculate project success score (0-25 points)
    const projectData = await db.get(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'on-hold' THEN 1 ELSE 0 END) as on_hold
       FROM projects
       WHERE client_id = ?`,
      [clientId]
    ) as { total: number; completed: number; on_hold: number } | undefined;

    let projectScore = 25;
    if (projectData && projectData.total > 0) {
      const completionRate = projectData.completed / projectData.total;
      const onHoldRate = projectData.on_hold / projectData.total;
      projectScore = Math.round(completionRate * 20) + 5;
      projectScore = Math.max(0, projectScore - Math.round(onHoldRate * 10));
    }

    // Calculate communication score (0-25 points)
    const activityData = await db.get(
      `SELECT COUNT(*) as activity_count, MAX(created_at) as last_activity
       FROM client_activities
       WHERE client_id = ?`,
      [clientId]
    ) as { activity_count: number; last_activity: string | null } | undefined;

    let communicationScore = 25;
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

    return await db.all(
      `SELECT * FROM clients
       WHERE health_status IN ('at_risk', 'critical')
       ORDER BY health_score ASC`
    ) as unknown as ClientRow[];
  }

  /**
   * Get client lifetime value
   */
  async getClientLifetimeValue(clientId: number): Promise<number> {
    const db = getDatabase();

    const result = await db.get(
      `SELECT SUM(CAST(amount_paid AS DECIMAL)) as total
       FROM invoices
       WHERE client_id = ? AND status = 'paid'`,
      [clientId]
    ) as { total: number | string | null } | undefined;

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
    const projectStats = await db.get(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN LOWER(status) IN ('pending', 'active', 'in-progress', 'in-review') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END) as completed
       FROM projects
       WHERE client_id = ?`,
      [clientId]
    ) as { total: number; active: number; completed: number } | undefined;

    // Get invoice stats
    const invoiceStats = await db.get(
      `SELECT
        SUM(CAST(amount_total AS DECIMAL)) as invoiced,
        SUM(CASE WHEN status = 'paid' THEN CAST(amount_total AS DECIMAL) ELSE 0 END) as paid,
        SUM(CASE WHEN status NOT IN ('paid', 'cancelled', 'voided') THEN CAST(amount_total AS DECIMAL) - COALESCE(CAST(amount_paid AS DECIMAL), 0) ELSE 0 END) as outstanding
       FROM invoices
       WHERE client_id = ?`,
      [clientId]
    ) as { invoiced: number | string | null; paid: number | string | null; outstanding: number | string | null } | undefined;

    // Get average payment days
    const paymentDays = await db.get(
      `SELECT AVG(julianday(paid_date) - julianday(issued_date)) as avg_days
       FROM invoices
       WHERE client_id = ? AND status = 'paid' AND paid_date IS NOT NULL AND issued_date IS NOT NULL`,
      [clientId]
    ) as { avg_days: number | null } | undefined;

    // Get message count
    const messageCount = await db.get(
      `SELECT COUNT(*) as count
       FROM messages
       WHERE project_id IN (SELECT id FROM projects WHERE client_id = ?)`,
      [clientId]
    ) as { count: number } | undefined;

    // Get last activity date
    const lastActivity = await db.get(
      `SELECT MAX(created_at) as last_date
       FROM client_activities
       WHERE client_id = ?`,
      [clientId]
    ) as { last_date: string | null } | undefined;

    // Get lifetime value
    const ltv = await this.getClientLifetimeValue(clientId);

    return {
      totalProjects: projectStats?.total || 0,
      activeProjects: projectStats?.active || 0,
      completedProjects: projectStats?.completed || 0,
      totalInvoiced: invoiceStats?.invoiced ? parseFloat(String(invoiceStats.invoiced)) : 0,
      totalPaid: invoiceStats?.paid ? parseFloat(String(invoiceStats.paid)) : 0,
      totalOutstanding: invoiceStats?.outstanding ? parseFloat(String(invoiceStats.outstanding)) : 0,
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
  async updateCRMFields(clientId: number, data: {
    acquisitionSource?: string;
    industry?: string;
    companySize?: string;
    website?: string;
    nextFollowUpDate?: string;
    notes?: string;
    preferredContactMethod?: string;
  }): Promise<void> {
    const db = getDatabase();

    const updates: string[] = [];
    const values: SqlValue[] = [];

    if (data.acquisitionSource !== undefined) {
      updates.push('acquisition_source = ?');
      values.push(data.acquisitionSource || null);
    }
    if (data.industry !== undefined) {
      updates.push('industry = ?');
      values.push(data.industry || null);
    }
    if (data.companySize !== undefined) {
      updates.push('company_size = ?');
      values.push(data.companySize || null);
    }
    if (data.website !== undefined) {
      updates.push('website = ?');
      values.push(data.website || null);
    }
    if (data.nextFollowUpDate !== undefined) {
      updates.push('next_follow_up_date = ?');
      values.push(data.nextFollowUpDate || null);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      values.push(data.notes || null);
    }
    if (data.preferredContactMethod !== undefined) {
      updates.push('preferred_contact_method = ?');
      values.push(data.preferredContactMethod || null);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(clientId);

      await db.run(
        `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }
  }

  /**
   * Get clients due for follow-up
   */
  async getClientsForFollowUp(): Promise<ClientRow[]> {
    const db = getDatabase();

    return await db.all(
      `SELECT * FROM clients
       WHERE next_follow_up_date IS NOT NULL
         AND next_follow_up_date <= DATE('now')
         AND status = 'active'
       ORDER BY next_follow_up_date ASC`
    ) as unknown as ClientRow[];
  }
}

// Export singleton instance
export const clientService = new ClientService();
export default clientService;
