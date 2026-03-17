/**
 * Deliverable Service
 * Handles deliverable management, versioning, comments, and review workflow
 */

import { getDatabase } from '../database/init.js';
import type { Database } from '../database/init.js';
import {
  Deliverable,
  DeliverableVersion,
  DeliverableComment,
  DesignElement,
  DeliverableReview
} from '../models/deliverable.js';
import { safeJsonParseArray } from '../utils/safe-json.js';

// ============================================
// DB Row Interfaces - Typed shapes for raw database rows
// ============================================

type QueryParam = string | number | boolean | null;

interface DeliverableRow {
  id: number;
  project_id: number;
  type: string;
  title: string;
  description: string;
  status: string;
  approval_status: string;
  round_number: number;
  created_by_id: number;
  reviewed_by_id: number | null;
  review_deadline: string | null;
  approved_at: string | null;
  locked: number | boolean;
  tags: string;
  archived_file_id: number | null;
  created_at: string;
  updated_at: string;
}

interface CommentRow {
  id: number;
  deliverable_id: number;
  author_id: number;
  comment_text: string;
  x_position: number | null;
  y_position: number | null;
  annotation_type: string;
  element_id: string | null;
  resolved: number | boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ReviewRow {
  id: number;
  deliverable_id: number;
  reviewer_id: number;
  decision: string;
  feedback: string | null;
  design_elements_reviewed: string;
  review_duration_minutes: number | null;
  created_at: string;
}

interface CreateDeliverableOptions {
  tags?: string;
  reviewDeadline?: string;
  roundNumber?: number;
}

interface ProjectDeliverablesOptions {
  status?: string;
  roundNumber?: number;
  limit?: number;
  offset?: number;
}

interface CommentOptions {
  x?: number;
  y?: number;
  annotationType?: string;
  elementId?: string;
}

interface CommentFilterOptions {
  resolved?: boolean;
  elementId?: string;
}

// ============================================
// Column Constants - Explicit column lists for SELECT queries
// ============================================

const DELIVERABLE_COLUMNS = `
  id, project_id, type, title, description, status, approval_status, round_number,
  created_by_id, reviewed_by_id, review_deadline, approved_at, locked, tags,
  archived_file_id, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const DELIVERABLE_VERSION_COLUMNS = `
  id, deliverable_id, version_number, file_path, file_name, file_size, file_type,
  uploaded_by_id, change_notes, created_at
`.replace(/\s+/g, ' ').trim();

const DELIVERABLE_COMMENT_COLUMNS = `
  id, deliverable_id, author_id, comment_text, x_position, y_position, annotation_type,
  element_id, resolved, resolved_at, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const DESIGN_ELEMENT_COLUMNS = `
  id, deliverable_id, name, description, approval_status, revision_count, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const DELIVERABLE_REVIEW_COLUMNS = `
  id, deliverable_id, reviewer_id, decision, feedback, design_elements_reviewed,
  review_duration_minutes, created_at
`.replace(/\s+/g, ' ').trim();

export class DeliverableService {
  private getDb(): Database {
    return getDatabase();
  }

  // ===== DELIVERABLE CRUD =====

  /**
   * Create a new deliverable
   */
  async createDeliverable(
    projectId: number,
    title: string,
    description: string,
    type: string,
    createdById: number,
    options?: CreateDeliverableOptions
  ): Promise<Deliverable> {
    const roundNumber = options?.roundNumber || 1;

    const result = await this.getDb().run(
      `INSERT INTO deliverables (project_id, type, title, description, created_by_id, round_number, tags, review_deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        type,
        title,
        description,
        createdById,
        roundNumber,
        options?.tags || '',
        options?.reviewDeadline || null
      ]
    );

    if (!result.lastID) throw new Error('Failed to insert deliverable');
    const deliverable = await this.getDeliverableById(result.lastID);
    if (!deliverable) throw new Error('Failed to create deliverable');
    return deliverable;
  }

  /**
   * Get deliverable by ID
   */
  async getDeliverableById(id: number): Promise<Deliverable | null> {
    const row = await this.getDb().get(`SELECT ${DELIVERABLE_COLUMNS} FROM deliverables WHERE id = ?`, [id]);
    if (!row) return null;
    return this.formatDeliverable(row as DeliverableRow);
  }

  /**
   * List deliverables for a project
   */
  async getProjectDeliverables(
    projectId: number,
    options?: ProjectDeliverablesOptions
  ): Promise<{ deliverables: Deliverable[]; total: number }> {
    let query = `SELECT ${DELIVERABLE_COLUMNS} FROM deliverables WHERE project_id = ?`;
    const params: QueryParam[] = [projectId];

    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    if (options?.roundNumber) {
      query += ' AND round_number = ?';
      params.push(options.roundNumber);
    }

    // Get total count
    const countResult = await this.getDb().get(
      `SELECT COUNT(*) as count FROM deliverables 
       WHERE project_id = ? 
       ${options?.status ? 'AND status = ?' : ''}
       ${options?.roundNumber ? 'AND round_number = ?' : ''}`,
      params
    );

    // Get paginated results
    query += ' ORDER BY created_at DESC';
    if (options?.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(Number(options.limit), Number(options?.offset || 0));
    }

    const rows = await this.getDb().all(query, params);
    return {
      deliverables: rows.map((row: unknown) => this.formatDeliverable(row as DeliverableRow)),
      total: Number(countResult?.count) || 0
    };
  }

  /**
   * Update deliverable
   */
  async updateDeliverable(id: number, updates: Partial<Deliverable>): Promise<Deliverable> {
    const existing = await this.getDeliverableById(id);
    if (!existing) throw new Error('Deliverable not found');

    const {
      title = existing.title,
      description = existing.description,
      status = existing.status,
      approval_status = existing.approval_status,
      review_deadline = existing.review_deadline,
      tags = existing.tags
    } = updates;

    await this.getDb().run(
      `UPDATE deliverables SET title=?, description=?, status=?, approval_status=?, review_deadline=?, tags=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [title, description, status, approval_status, review_deadline, tags, id]
    );

    const updated = await this.getDeliverableById(id);
    if (!updated) throw new Error('Failed to update deliverable');
    return updated;
  }

  /**
   * Lock deliverable (final approval)
   */
  async lockDeliverable(id: number, reviewedById: number): Promise<Deliverable> {
    await this.getDb().run(
      `UPDATE deliverables SET locked=1, status='approved', approval_status='approved', reviewed_by_id=?, approved_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [reviewedById, id]
    );

    const deliverable = await this.getDeliverableById(id);
    if (!deliverable) throw new Error('Deliverable not found');
    return deliverable;
  }

  /**
   * Update deliverable with archived file ID after archiving to Files tab
   */
  async setArchivedFileId(deliverableId: number, fileId: number): Promise<void> {
    await this.getDb().run(
      'UPDATE deliverables SET archived_file_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [fileId, deliverableId]
    );
  }

  /**
   * Get archived file ID for a deliverable
   */
  async getArchivedFileId(deliverableId: number): Promise<number | null> {
    const row = (await this.getDb().get('SELECT archived_file_id FROM deliverables WHERE id = ?', [
      deliverableId
    ])) as { archived_file_id: number | null } | undefined;
    return row?.archived_file_id ?? null;
  }

  /**
   * Request revision
   */
  async requestRevision(id: number, reason: string, reviewedById: number): Promise<Deliverable> {
    await this.getDb().run(
      `UPDATE deliverables SET status='revision_requested', approval_status='revision_needed', reviewed_by_id=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [reviewedById, id]
    );

    const deliverable = await this.getDeliverableById(id);
    if (!deliverable) throw new Error('Deliverable not found');
    return deliverable;
  }

  /**
   * Delete deliverable (soft delete)
   */
  async deleteDeliverable(id: number): Promise<void> {
    await this.getDb().run('UPDATE deliverables SET status=? WHERE id=?', ['archived', id]);
  }

  // ===== VERSION MANAGEMENT =====

  /**
   * Upload new version
   */
  async uploadVersion(
    deliverableId: number,
    filePath: string,
    fileName: string,
    fileSize: number,
    fileType: string,
    uploadedById: number,
    changeNotes?: string
  ): Promise<DeliverableVersion> {
    const deliverable = await this.getDeliverableById(deliverableId);
    if (!deliverable) throw new Error('Deliverable not found');

    // Get next version number
    const lastVersion = await this.getDb().get(
      'SELECT MAX(version_number) as max_version FROM deliverable_versions WHERE deliverable_id = ?',
      [deliverableId]
    );
    const nextVersion = (Number(lastVersion?.max_version) || 0) + 1;

    const result = await this.getDb().run(
      `INSERT INTO deliverable_versions (deliverable_id, version_number, file_path, file_name, file_size, file_type, uploaded_by_id, change_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deliverableId,
        nextVersion,
        filePath,
        fileName,
        fileSize,
        fileType,
        uploadedById,
        changeNotes || null
      ]
    );

    // Update deliverable status to pending review if it was draft
    if (deliverable.status === 'draft') {
      await this.updateDeliverable(deliverableId, { status: 'pending_review' });
    }

    if (!result.lastID) throw new Error('Failed to insert version');
    const version = await this.getVersionById(result.lastID);
    if (!version) throw new Error('Failed to create version');
    return version;
  }

  /**
   * Get version by ID
   */
  async getVersionById(id: number): Promise<DeliverableVersion | null> {
    const row = await this.getDb().get(`SELECT ${DELIVERABLE_VERSION_COLUMNS} FROM deliverable_versions WHERE id = ?`, [id]);
    if (!row) return null;
    return row as unknown as DeliverableVersion;
  }

  /**
   * Get all versions for deliverable
   */
  async getDeliverableVersions(deliverableId: number): Promise<DeliverableVersion[]> {
    const rows = await this.getDb().all(
      `SELECT ${DELIVERABLE_VERSION_COLUMNS} FROM deliverable_versions WHERE deliverable_id = ? ORDER BY version_number DESC`,
      [deliverableId]
    );
    return rows as unknown as DeliverableVersion[];
  }

  /**
   * Get latest version
   */
  async getLatestVersion(deliverableId: number): Promise<DeliverableVersion | null> {
    const row = await this.getDb().get(
      `SELECT ${DELIVERABLE_VERSION_COLUMNS} FROM deliverable_versions WHERE deliverable_id = ? ORDER BY version_number DESC LIMIT 1`,
      [deliverableId]
    );
    if (!row) return null;
    return row as unknown as DeliverableVersion;
  }

  // ===== COMMENTS & ANNOTATIONS =====

  /**
   * Add comment or annotation
   */
  async addComment(
    deliverableId: number,
    authorId: number,
    text: string,
    options?: CommentOptions
  ): Promise<DeliverableComment> {
    const result = await this.getDb().run(
      `INSERT INTO deliverable_comments (deliverable_id, author_id, comment_text, x_position, y_position, annotation_type, element_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        deliverableId,
        authorId,
        text,
        options?.x || null,
        options?.y || null,
        options?.annotationType || 'text',
        options?.elementId || null
      ]
    );

    if (!result.lastID) throw new Error('Failed to insert comment');
    const comment = await this.getCommentById(result.lastID);
    if (!comment) throw new Error('Failed to add comment');
    return comment;
  }

  /**
   * Get comment by ID
   */
  async getCommentById(id: number): Promise<DeliverableComment | null> {
    const row = await this.getDb().get(`SELECT ${DELIVERABLE_COMMENT_COLUMNS} FROM deliverable_comments WHERE id = ?`, [id]);
    if (!row) return null;
    return this.formatComment(row as CommentRow);
  }

  /**
   * Get all comments for deliverable
   */
  async getDeliverableComments(
    deliverableId: number,
    options?: CommentFilterOptions
  ): Promise<DeliverableComment[]> {
    let query = `SELECT ${DELIVERABLE_COMMENT_COLUMNS} FROM deliverable_comments WHERE deliverable_id = ?`;
    const params: QueryParam[] = [deliverableId];

    if (options?.resolved !== undefined) {
      query += ' AND resolved = ?';
      params.push(options.resolved ? 1 : 0);
    }

    if (options?.elementId) {
      query += ' AND element_id = ?';
      params.push(options.elementId);
    }

    query += ' ORDER BY created_at DESC';

    const rows = await this.getDb().all(query, params);
    return rows.map((row: unknown) => this.formatComment(row as CommentRow));
  }

  /**
   * Mark comment as resolved
   */
  async resolveComment(id: number): Promise<DeliverableComment> {
    await this.getDb().run(
      'UPDATE deliverable_comments SET resolved=1, resolved_at=CURRENT_TIMESTAMP WHERE id=?',
      [id]
    );

    const comment = await this.getCommentById(id);
    if (!comment) throw new Error('Comment not found');
    return comment;
  }

  /**
   * Delete comment
   */
  async deleteComment(id: number): Promise<void> {
    await this.getDb().run('DELETE FROM deliverable_comments WHERE id=?', [id]);
  }

  // ===== DESIGN ELEMENTS =====

  /**
   * Create design element
   */
  async createDesignElement(
    deliverableId: number,
    name: string,
    description?: string
  ): Promise<DesignElement> {
    const result = await this.getDb().run(
      `INSERT INTO design_elements (deliverable_id, name, description)
       VALUES (?, ?, ?)`,
      [deliverableId, name, description || null]
    );

    if (!result.lastID) throw new Error('Failed to insert design element');
    const element = await this.getDesignElementById(result.lastID);
    if (!element) throw new Error('Failed to create design element');
    return element;
  }

  /**
   * Get design element by ID
   */
  async getDesignElementById(id: number): Promise<DesignElement | null> {
    const row = await this.getDb().get(`SELECT ${DESIGN_ELEMENT_COLUMNS} FROM design_elements WHERE id = ?`, [id]);
    if (!row) return null;
    return row as unknown as DesignElement;
  }

  /**
   * Get all design elements for deliverable
   */
  async getDeliverableElements(deliverableId: number): Promise<DesignElement[]> {
    const rows = await this.getDb().all(
      `SELECT ${DESIGN_ELEMENT_COLUMNS} FROM design_elements WHERE deliverable_id = ? ORDER BY created_at ASC`,
      [deliverableId]
    );
    return rows as unknown as DesignElement[];
  }

  /**
   * Update element approval status
   */
  async updateElementApprovalStatus(
    elementId: number,
    status: 'pending' | 'approved' | 'revision_needed'
  ): Promise<DesignElement> {
    if (status === 'revision_needed') {
      await this.getDb().run(
        'UPDATE design_elements SET approval_status=?, revision_count=revision_count+1, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        [status, elementId]
      );
    } else {
      await this.getDb().run(
        'UPDATE design_elements SET approval_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        [status, elementId]
      );
    }

    const element = await this.getDesignElementById(elementId);
    if (!element) throw new Error('Design element not found');
    return element;
  }

  // ===== REVIEWS =====

  /**
   * Create review record
   */
  async createReview(
    deliverableId: number,
    reviewerId: number,
    decision: 'approved' | 'revision_needed' | 'rejected',
    feedback?: string,
    elementsReviewed?: number[]
  ): Promise<DeliverableReview> {
    const result = await this.getDb().run(
      `INSERT INTO deliverable_reviews (deliverable_id, reviewer_id, decision, feedback, design_elements_reviewed)
       VALUES (?, ?, ?, ?, ?)`,
      [
        deliverableId,
        reviewerId,
        decision,
        feedback || null,
        JSON.stringify(elementsReviewed || [])
      ]
    );

    if (!result.lastID) throw new Error('Failed to insert review');
    const review = await this.getReviewById(result.lastID);
    if (!review) throw new Error('Failed to create review');
    return review;
  }

  /**
   * Get review by ID
   */
  async getReviewById(id: number): Promise<DeliverableReview | null> {
    const row = await this.getDb().get(`SELECT ${DELIVERABLE_REVIEW_COLUMNS} FROM deliverable_reviews WHERE id = ?`, [id]);
    if (!row) return null;
    return this.formatReview(row as ReviewRow);
  }

  /**
   * Get all reviews for deliverable
   */
  async getDeliverableReviews(deliverableId: number): Promise<DeliverableReview[]> {
    const rows = await this.getDb().all(
      `SELECT ${DELIVERABLE_REVIEW_COLUMNS} FROM deliverable_reviews WHERE deliverable_id = ? ORDER BY created_at DESC`,
      [deliverableId]
    );
    return rows.map((row: unknown) => this.formatReview(row as ReviewRow));
  }

  // ===== HELPER METHODS =====

  private formatDeliverable(row: DeliverableRow): Deliverable {
    return {
      id: row.id,
      project_id: row.project_id,
      type: row.type as Deliverable['type'],
      title: row.title,
      description: row.description,
      status: row.status as Deliverable['status'],
      approval_status: row.approval_status as Deliverable['approval_status'],
      round_number: row.round_number,
      created_by_id: row.created_by_id,
      reviewed_by_id: row.reviewed_by_id,
      review_deadline: row.review_deadline,
      approved_at: row.approved_at,
      locked: Boolean(row.locked),
      tags: row.tags,
      archived_file_id: row.archived_file_id ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private formatComment(row: CommentRow): DeliverableComment {
    return {
      id: row.id,
      deliverable_id: row.deliverable_id,
      author_id: row.author_id,
      comment_text: row.comment_text,
      x_position: row.x_position,
      y_position: row.y_position,
      annotation_type: row.annotation_type as DeliverableComment['annotation_type'],
      element_id: row.element_id,
      resolved: Boolean(row.resolved),
      resolved_at: row.resolved_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private formatReview(row: ReviewRow): DeliverableReview {
    return {
      id: row.id,
      deliverable_id: row.deliverable_id,
      reviewer_id: row.reviewer_id,
      decision: row.decision as DeliverableReview['decision'],
      feedback: row.feedback ?? '',
      design_elements_reviewed: safeJsonParseArray(
        row.design_elements_reviewed,
        'design elements reviewed'
      ),
      review_duration_minutes: row.review_duration_minutes ?? 0,
      created_at: row.created_at
    };
  }

  // ===== CLIENT ACCESS =====

  /**
   * Get all deliverables for a client across all their projects
   */
  async getClientDeliverables(clientId: number): Promise<{
    id: number;
    title: string;
    type: string;
    status: string;
    approval_status: string;
    review_deadline: string | null;
    round_number: number;
    created_at: string;
    project_name: string;
  }[]> {
    return this.getDb().all(
      `SELECT d.id, d.title, d.type, d.status, d.approval_status,
              d.review_deadline, d.round_number, d.created_at,
              p.project_name
       FROM deliverables d
       JOIN projects p ON d.project_id = p.id
       WHERE p.client_id = ? AND d.deleted_at IS NULL
       ORDER BY d.created_at DESC`,
      [clientId]
    );
  }

  // ===== ADMIN LIST & UPDATE (route extraction) =====

  /**
   * List deliverables with project/client details for admin view.
   * Supports optional projectId and status filters.
   * Used by GET /api/admin/deliverables
   */
  async listAdminDeliverablesWithDetails(filters: {
    projectId?: number;
    status?: string;
  }): Promise<{
    deliverables: Record<string, unknown>[];
    stats: {
      total: number;
      pending: number;
      inProgress: number;
      completed: number;
      approved: number;
    };
  }> {
    const db = this.getDb();
    let query = `
      SELECT
        d.id,
        d.project_id as projectId,
        d.title,
        d.description,
        d.status,
        d.due_date as dueDate,
        d.completed_at as completedAt,
        d.created_at as createdAt,
        d.updated_at as updatedAt,
        p.project_name as projectName,
        COALESCE(c.billing_company, c.company_name) as clientName
      FROM deliverables d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.deleted_at IS NULL
        AND d.deleted_at IS NULL
    `;
    const params: (string | number)[] = [];

    if (filters.projectId) {
      query += ' AND d.project_id = ?';
      params.push(filters.projectId);
    }
    if (filters.status) {
      query += ' AND d.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY d.due_date ASC, d.created_at DESC';

    const deliverables = (await db.all(query, params)) as Record<
      string,
      unknown
    >[];

    const stats = {
      total: deliverables.length,
      pending: deliverables.filter((d) => d.status === 'pending').length,
      inProgress: deliverables.filter((d) => d.status === 'in_progress').length,
      completed: deliverables.filter((d) => d.status === 'completed').length,
      approved: deliverables.filter((d) => d.status === 'approved').length
    };

    return { deliverables, stats };
  }

  /**
   * Update a deliverable by ID with partial fields (admin route).
   * Returns the updated deliverable with project/client details.
   * Used by PUT /api/admin/deliverables/:id
   */
  async updateAdminDeliverable(
    id: number,
    fields: {
      status?: string;
      title?: string;
      description?: string;
      due_date?: string | null;
    }
  ): Promise<Record<string, unknown> | null> {
    const db = this.getDb();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (fields.status !== undefined) {
      updates.push('status = ?');
      values.push(fields.status);
    }
    if (fields.title !== undefined) {
      updates.push('title = ?');
      values.push(fields.title);
    }
    if (fields.description !== undefined) {
      updates.push('description = ?');
      values.push(fields.description);
    }
    if (fields.due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(fields.due_date);
    }

    if (updates.length === 0) return null;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.run(
      `UPDATE deliverables SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.get(
      `
      SELECT
        d.id,
        d.project_id as projectId,
        d.title,
        d.description,
        d.status,
        d.due_date as dueDate,
        d.completed_at as completedAt,
        d.created_at as createdAt,
        d.updated_at as updatedAt,
        p.project_name as projectName,
        COALESCE(c.billing_company, c.company_name) as clientName
      FROM deliverables d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE d.id = ?
    `,
      [id]
    );

    return (updated as Record<string, unknown>) ?? null;
  }

  /**
   * Check if a client can access a specific deliverable
   */
  async checkClientDeliverableAccess(
    deliverableId: number,
    clientId: number
  ): Promise<boolean> {
    const row = await this.getDb().get<{ project_id: number }>(
      `SELECT d.project_id FROM deliverables d
       JOIN projects p ON d.project_id = p.id
       WHERE d.id = ? AND p.client_id = ? AND d.deleted_at IS NULL`,
      [deliverableId, clientId]
    );
    return !!row;
  }
}

// Export singleton instance
let deliverableServiceInstance: DeliverableService;

export function getDeliverableService(): DeliverableService {
  if (!deliverableServiceInstance) {
    deliverableServiceInstance = new DeliverableService();
  }
  return deliverableServiceInstance;
}

export const deliverableService = {
  createDeliverable: (
    pid: number,
    title: string,
    desc: string,
    type: string,
    cid: number,
    opts?: CreateDeliverableOptions
  ) => getDeliverableService().createDeliverable(pid, title, desc, type, cid, opts),
  getDeliverableById: (id: number) => getDeliverableService().getDeliverableById(id),
  getProjectDeliverables: (pid: number, opts?: ProjectDeliverablesOptions) =>
    getDeliverableService().getProjectDeliverables(pid, opts),
  updateDeliverable: (id: number, updates: Partial<Deliverable>) =>
    getDeliverableService().updateDeliverable(id, updates),
  lockDeliverable: (id: number, rid: number) => getDeliverableService().lockDeliverable(id, rid),
  requestRevision: (id: number, reason: string, rid: number) =>
    getDeliverableService().requestRevision(id, reason, rid),
  deleteDeliverable: (id: number) => getDeliverableService().deleteDeliverable(id),
  uploadVersion: (
    did: number,
    path: string,
    name: string,
    size: number,
    type: string,
    uid: number,
    notes?: string
  ) => getDeliverableService().uploadVersion(did, path, name, size, type, uid, notes),
  getVersionById: (id: number) => getDeliverableService().getVersionById(id),
  getDeliverableVersions: (did: number) => getDeliverableService().getDeliverableVersions(did),
  getLatestVersion: (did: number) => getDeliverableService().getLatestVersion(did),
  addComment: (did: number, aid: number, text: string, opts?: CommentOptions) =>
    getDeliverableService().addComment(did, aid, text, opts),
  getCommentById: (id: number) => getDeliverableService().getCommentById(id),
  getDeliverableComments: (did: number, opts?: CommentFilterOptions) =>
    getDeliverableService().getDeliverableComments(did, opts),
  resolveComment: (id: number) => getDeliverableService().resolveComment(id),
  deleteComment: (id: number) => getDeliverableService().deleteComment(id),
  createDesignElement: (did: number, name: string, desc?: string) =>
    getDeliverableService().createDesignElement(did, name, desc),
  getDesignElementById: (id: number) => getDeliverableService().getDesignElementById(id),
  getDeliverableElements: (did: number) => getDeliverableService().getDeliverableElements(did),
  updateElementApprovalStatus: (eid: number, status: 'pending' | 'approved' | 'revision_needed') =>
    getDeliverableService().updateElementApprovalStatus(eid, status),
  createReview: (did: number, rid: number, decision: 'approved' | 'revision_needed' | 'rejected', feedback?: string, elements?: number[]) =>
    getDeliverableService().createReview(did, rid, decision, feedback, elements),
  getReviewById: (id: number) => getDeliverableService().getReviewById(id),
  getDeliverableReviews: (did: number) => getDeliverableService().getDeliverableReviews(did),
  setArchivedFileId: (did: number, fid: number) =>
    getDeliverableService().setArchivedFileId(did, fid),
  getArchivedFileId: (did: number) => getDeliverableService().getArchivedFileId(did),
  getClientDeliverables: (clientId: number) =>
    getDeliverableService().getClientDeliverables(clientId),
  checkClientDeliverableAccess: (deliverableId: number, clientId: number) =>
    getDeliverableService().checkClientDeliverableAccess(deliverableId, clientId),
  listAdminDeliverablesWithDetails: (filters: { projectId?: number; status?: string }) =>
    getDeliverableService().listAdminDeliverablesWithDetails(filters),
  updateAdminDeliverable: (
    id: number,
    fields: { status?: string; title?: string; description?: string; due_date?: string | null }
  ) => getDeliverableService().updateAdminDeliverable(id, fields)
};

export default deliverableService;
