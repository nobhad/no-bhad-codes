/**
 * ===============================================
 * CONTENT REQUEST SERVICE
 * ===============================================
 * @file server/services/content-request-service.ts
 *
 * Service for managing content request checklists and items.
 * Clients submit text, files, URLs, or structured data per item.
 */

import { getDatabase } from '../database/init.js';
import {
  CHECKLIST_COLUMNS_WITH_JOINS,
  ITEM_COLUMNS,
  TEMPLATE_COLUMNS,
  toContentChecklist,
  toContentItem,
  toContentRequestTemplate,
  type ContentChecklist,
  type ContentChecklistRow,
  type ContentItem,
  type ContentItemRow,
  type ContentRequestTemplate,
  type ContentRequestTemplateRow,
  type ContentRequestTemplateItem,
  type CompletionStats
} from '../database/entities/content-request.js';
import type { ContentType, ContentCategory } from '../config/constants.js';
import { logger } from './logger.js';

// =====================================================
// TYPES
// =====================================================

export interface CreateChecklistData {
  name: string;
  description?: string;
}

export interface CreateItemData {
  title: string;
  description?: string;
  contentType: ContentType;
  category?: ContentCategory;
  isRequired?: boolean;
  dueDate?: string;
  sortOrder?: number;
}

// =====================================================
// JOIN CLAUSES
// =====================================================

const CHECKLIST_JOINS = `
  FROM content_request_checklists crc
  LEFT JOIN projects p ON crc.project_id = p.id
  LEFT JOIN clients c ON crc.client_id = c.id
`.replace(/\s+/g, ' ').trim();

const ITEM_FROM = 'FROM content_request_items cri';

// =====================================================
// SERVICE
// =====================================================

class ContentRequestService {

  // -----------------------------------------------
  // CHECKLIST CRUD
  // -----------------------------------------------

  async createChecklist(
    projectId: number,
    clientId: number,
    data: CreateChecklistData,
    items?: CreateItemData[]
  ): Promise<ContentChecklist> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO content_request_checklists (project_id, client_id, name, description)
       VALUES (?, ?, ?, ?)`,
      [projectId, clientId, data.name, data.description || null]
    );

    const checklistId = result.lastID!;

    if (items && items.length > 0) {
      for (const [index, item] of items.entries()) {
        await db.run(
          `INSERT INTO content_request_items
            (checklist_id, project_id, client_id, title, description, content_type, category, is_required, due_date, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            checklistId, projectId, clientId,
            item.title, item.description || null,
            item.contentType, item.category || 'other',
            item.isRequired !== false ? 1 : 0,
            item.dueDate || null,
            item.sortOrder ?? index
          ]
        );
      }
    }

    await logger.info(`Created content checklist ${checklistId} with ${items?.length || 0} items`, {
      category: 'CONTENT_REQUEST'
    });

    return this.getChecklist(checklistId) as Promise<ContentChecklist>;
  }

  async createFromTemplate(
    projectId: number,
    clientId: number,
    templateId: number,
    startDate?: string
  ): Promise<ContentChecklist> {
    const template = await this.getTemplate(templateId);
    if (!template) throw new Error('Template not found');

    const baseDate = startDate ? new Date(startDate) : new Date();

    const items: CreateItemData[] = template.items.map((item: ContentRequestTemplateItem, index: number) => {
      let dueDate: string | undefined;
      if (item.due_offset_days) {
        const due = new Date(baseDate);
        due.setDate(due.getDate() + item.due_offset_days);
        dueDate = due.toISOString().split('T')[0];
      }

      return {
        title: item.title,
        description: item.description,
        contentType: item.content_type,
        category: item.category || 'other',
        isRequired: item.is_required,
        dueDate,
        sortOrder: index
      };
    });

    return this.createChecklist(projectId, clientId, {
      name: template.name,
      description: template.description || undefined
    }, items);
  }

  async getChecklist(id: number): Promise<ContentChecklist | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT ${CHECKLIST_COLUMNS_WITH_JOINS} ${CHECKLIST_JOINS} WHERE crc.id = ?`,
      [id]
    );
    if (!row) return null;

    const checklist = toContentChecklist(row as unknown as ContentChecklistRow);
    checklist.items = await this.getItemsByChecklist(id);
    checklist.completionStats = this.calculateStats(checklist.items);
    return checklist;
  }

  async getByProject(projectId: number): Promise<ContentChecklist[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT ${CHECKLIST_COLUMNS_WITH_JOINS} ${CHECKLIST_JOINS}
       WHERE crc.project_id = ? ORDER BY crc.created_at DESC`,
      [projectId]
    );

    const checklists = (rows as unknown as ContentChecklistRow[]).map(toContentChecklist);
    for (const checklist of checklists) {
      checklist.items = await this.getItemsByChecklist(checklist.id);
      checklist.completionStats = this.calculateStats(checklist.items);
    }
    return checklists;
  }

  async getByClient(clientId: number): Promise<ContentChecklist[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT ${CHECKLIST_COLUMNS_WITH_JOINS} ${CHECKLIST_JOINS}
       WHERE crc.client_id = ? AND crc.status = 'active' ORDER BY crc.created_at DESC`,
      [clientId]
    );

    const checklists = (rows as unknown as ContentChecklistRow[]).map(toContentChecklist);
    for (const checklist of checklists) {
      checklist.items = await this.getItemsByChecklist(checklist.id);
      checklist.completionStats = this.calculateStats(checklist.items);
    }
    return checklists;
  }

  async updateChecklist(
    id: number,
    data: Partial<{ name: string; description: string; status: string }>
  ): Promise<ContentChecklist> {
    const db = getDatabase();
    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
      if (data.status === 'completed') updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(String(id));
      await db.run(`UPDATE content_request_checklists SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return this.getChecklist(id) as Promise<ContentChecklist>;
  }

  async deleteChecklist(id: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM content_request_checklists WHERE id = ?', [id]);
  }

  // -----------------------------------------------
  // ITEM CRUD
  // -----------------------------------------------

  async getItemsByChecklist(checklistId: number): Promise<ContentItem[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE cri.checklist_id = ? ORDER BY cri.sort_order`,
      [checklistId]
    );
    return (rows as unknown as ContentItemRow[]).map(toContentItem);
  }

  async addItem(checklistId: number, projectId: number, clientId: number, data: CreateItemData): Promise<ContentItem> {
    const db = getDatabase();
    const result = await db.run(
      `INSERT INTO content_request_items
        (checklist_id, project_id, client_id, title, description, content_type, category, is_required, due_date, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        checklistId, projectId, clientId,
        data.title, data.description || null,
        data.contentType, data.category || 'other',
        data.isRequired !== false ? 1 : 0,
        data.dueDate || null,
        data.sortOrder ?? 0
      ]
    );

    const row = await db.get(`SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE cri.id = ?`, [result.lastID]);
    return toContentItem(row as unknown as ContentItemRow);
  }

  async updateItem(
    itemId: number,
    data: Partial<{ title: string; description: string; dueDate: string; isRequired: boolean; sortOrder: number; adminNotes: string }>
  ): Promise<ContentItem> {
    const db = getDatabase();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.title !== undefined) { updates.push('title = ?'); values.push(data.title); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    if (data.dueDate !== undefined) { updates.push('due_date = ?'); values.push(data.dueDate); }
    if (data.isRequired !== undefined) { updates.push('is_required = ?'); values.push(data.isRequired ? 1 : 0); }
    if (data.sortOrder !== undefined) { updates.push('sort_order = ?'); values.push(data.sortOrder); }
    if (data.adminNotes !== undefined) { updates.push('admin_notes = ?'); values.push(data.adminNotes); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(itemId);
      await db.run(`UPDATE content_request_items SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    const row = await db.get(`SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE cri.id = ?`, [itemId]);
    if (!row) throw new Error('Item not found');
    return toContentItem(row as unknown as ContentItemRow);
  }

  async deleteItem(itemId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM content_request_items WHERE id = ?', [itemId]);
  }

  // -----------------------------------------------
  // CLIENT SUBMISSIONS
  // -----------------------------------------------

  async submitText(itemId: number, text: string): Promise<ContentItem> {
    const db = getDatabase();
    await db.run(
      `UPDATE content_request_items SET
        text_content = ?, status = 'submitted', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [text, itemId]
    );
    const row = await db.get(`SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE cri.id = ?`, [itemId]);
    return toContentItem(row as unknown as ContentItemRow);
  }

  async submitFile(itemId: number, fileId: number): Promise<ContentItem> {
    const db = getDatabase();
    await db.run(
      `UPDATE content_request_items SET
        file_id = ?, status = 'submitted', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [fileId, itemId]
    );
    const row = await db.get(`SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE cri.id = ?`, [itemId]);
    return toContentItem(row as unknown as ContentItemRow);
  }

  async submitUrl(itemId: number, url: string): Promise<ContentItem> {
    const db = getDatabase();
    await db.run(
      `UPDATE content_request_items SET
        text_content = ?, status = 'submitted', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [url, itemId]
    );
    const row = await db.get(`SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE cri.id = ?`, [itemId]);
    return toContentItem(row as unknown as ContentItemRow);
  }

  async submitStructured(itemId: number, data: Record<string, unknown>): Promise<ContentItem> {
    const db = getDatabase();
    await db.run(
      `UPDATE content_request_items SET
        structured_data = ?, status = 'submitted', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(data), itemId]
    );
    const row = await db.get(`SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE cri.id = ?`, [itemId]);
    return toContentItem(row as unknown as ContentItemRow);
  }

  // -----------------------------------------------
  // ADMIN REVIEW
  // -----------------------------------------------

  async acceptItem(itemId: number): Promise<ContentItem> {
    const db = getDatabase();
    await db.run(
      `UPDATE content_request_items SET
        status = 'accepted', reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [itemId]
    );
    const row = await db.get(`SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE cri.id = ?`, [itemId]);
    return toContentItem(row as unknown as ContentItemRow);
  }

  async requestRevision(itemId: number, notes: string): Promise<ContentItem> {
    const db = getDatabase();
    await db.run(
      `UPDATE content_request_items SET
        status = 'revision_needed', admin_notes = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [notes, itemId]
    );
    const row = await db.get(`SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE cri.id = ?`, [itemId]);
    return toContentItem(row as unknown as ContentItemRow);
  }

  // -----------------------------------------------
  // STATS
  // -----------------------------------------------

  calculateStats(items: ContentItem[]): CompletionStats {
    const total = items.length;
    const pending = items.filter((i) => i.status === 'pending').length;
    const submitted = items.filter((i) => i.status === 'submitted').length;
    const accepted = items.filter((i) => i.status === 'accepted').length;
    const revisionNeeded = items.filter((i) => i.status === 'revision_needed').length;
    const completionPercent = total > 0 ? Math.round((accepted / total) * 100) : 0;

    return { total, pending, submitted, accepted, revisionNeeded, completionPercent };
  }

  async getAdminOverview(): Promise<ContentChecklist[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT ${CHECKLIST_COLUMNS_WITH_JOINS} ${CHECKLIST_JOINS}
       WHERE crc.status = 'active' ORDER BY crc.created_at DESC`
    );

    const checklists = (rows as unknown as ContentChecklistRow[]).map(toContentChecklist);
    for (const checklist of checklists) {
      checklist.items = await this.getItemsByChecklist(checklist.id);
      checklist.completionStats = this.calculateStats(checklist.items);
    }
    return checklists;
  }

  // -----------------------------------------------
  // TEMPLATES
  // -----------------------------------------------

  async getTemplates(includeInactive?: boolean): Promise<ContentRequestTemplate[]> {
    const db = getDatabase();
    let query = `SELECT ${TEMPLATE_COLUMNS} FROM content_request_templates`;
    if (!includeInactive) query += ' WHERE is_active = 1';
    query += ' ORDER BY name';
    const rows = await db.all(query);
    return (rows as unknown as ContentRequestTemplateRow[]).map(toContentRequestTemplate);
  }

  async getTemplate(id: number): Promise<ContentRequestTemplate | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT ${TEMPLATE_COLUMNS} FROM content_request_templates WHERE id = ?`,
      [id]
    );
    if (!row) return null;
    return toContentRequestTemplate(row as unknown as ContentRequestTemplateRow);
  }

  async createTemplate(data: {
    name: string;
    description?: string;
    items: ContentRequestTemplateItem[];
    projectType?: string;
  }): Promise<ContentRequestTemplate> {
    const db = getDatabase();
    const result = await db.run(
      `INSERT INTO content_request_templates (name, description, items, project_type)
       VALUES (?, ?, ?, ?)`,
      [data.name, data.description || null, JSON.stringify(data.items), data.projectType || null]
    );

    return this.getTemplate(result.lastID!) as Promise<ContentRequestTemplate>;
  }

  async updateTemplate(
    id: number,
    data: Partial<{ name: string; description: string; items: ContentRequestTemplateItem[]; projectType: string; isActive: boolean }>
  ): Promise<ContentRequestTemplate> {
    const db = getDatabase();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    if (data.items !== undefined) { updates.push('items = ?'); values.push(JSON.stringify(data.items)); }
    if (data.projectType !== undefined) { updates.push('project_type = ?'); values.push(data.projectType); }
    if (data.isActive !== undefined) { updates.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      await db.run(`UPDATE content_request_templates SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return this.getTemplate(id) as Promise<ContentRequestTemplate>;
  }

  async deleteTemplate(id: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM content_request_templates WHERE id = ?', [id]);
  }
}

export const contentRequestService = new ContentRequestService();
export default contentRequestService;
