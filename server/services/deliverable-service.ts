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

export class DeliverableService {
  private db: Database;

  constructor(db?: Database) {
    if (!db) {
      this.db = getDatabase();
    } else {
      this.db = db;
    }
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
    options?: { tags?: string; reviewDeadline?: string; roundNumber?: number }
  ): Promise<Deliverable> {
    const roundNumber = options?.roundNumber || 1;

    const result = await this.db.run(
      `INSERT INTO deliverables (project_id, type, title, description, created_by_id, round_number, tags, review_deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectId, type, title, description, createdById, roundNumber, options?.tags || '', options?.reviewDeadline || null]
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
    const row = await this.db.get('SELECT * FROM deliverables WHERE id = ?', [id]);
    if (!row) return null;
    return this.formatDeliverable(row);
  }

  /**
   * List deliverables for a project
   */
  async getProjectDeliverables(
    projectId: number,
    options?: { status?: string; roundNumber?: number; limit?: number; offset?: number }
  ): Promise<{ deliverables: Deliverable[]; total: number }> {
    let query = 'SELECT * FROM deliverables WHERE project_id = ?';
    const params: any[] = [projectId];

    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    if (options?.roundNumber) {
      query += ' AND round_number = ?';
      params.push(options.roundNumber);
    }

    // Get total count
    const countResult = await this.db.get(
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
      params.push(options.limit as any, (options?.offset || 0) as any);
    }

    const rows = await this.db.all(query, params);
    return {
      deliverables: rows.map((row: any) => this.formatDeliverable(row)),
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

    await this.db.run(
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
    await this.db.run(
      `UPDATE deliverables SET locked=1, status='approved', approval_status='approved', reviewed_by_id=?, approved_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [reviewedById, id]
    );

    const deliverable = await this.getDeliverableById(id);
    if (!deliverable) throw new Error('Deliverable not found');
    return deliverable;
  }

  /**
   * Request revision
   */
  async requestRevision(id: number, reason: string, reviewedById: number): Promise<Deliverable> {
    await this.db.run(
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
    await this.db.run('UPDATE deliverables SET status=? WHERE id=?', ['archived', id]);
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
    const lastVersion = await this.db.get(
      'SELECT MAX(version_number) as max_version FROM deliverable_versions WHERE deliverable_id = ?',
      [deliverableId]
    );
    const nextVersion = (Number(lastVersion?.max_version) || 0) + 1;

    const result = await this.db.run(
      `INSERT INTO deliverable_versions (deliverable_id, version_number, file_path, file_name, file_size, file_type, uploaded_by_id, change_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [deliverableId, nextVersion, filePath, fileName, fileSize, fileType, uploadedById, changeNotes || null]
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
    const row = await this.db.get('SELECT * FROM deliverable_versions WHERE id = ?', [id]);
    if (!row) return null;
    return row as unknown as DeliverableVersion;
  }

  /**
   * Get all versions for deliverable
   */
  async getDeliverableVersions(deliverableId: number): Promise<DeliverableVersion[]> {
    const rows = await this.db.all(
      'SELECT * FROM deliverable_versions WHERE deliverable_id = ? ORDER BY version_number DESC',
      [deliverableId]
    );
    return rows as unknown as DeliverableVersion[];
  }

  /**
   * Get latest version
   */
  async getLatestVersion(deliverableId: number): Promise<DeliverableVersion | null> {
    const row = await this.db.get(
      'SELECT * FROM deliverable_versions WHERE deliverable_id = ? ORDER BY version_number DESC LIMIT 1',
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
    options?: { x?: number; y?: number; annotationType?: string; elementId?: string }
  ): Promise<DeliverableComment> {
    const result = await this.db.run(
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
    const row = await this.db.get('SELECT * FROM deliverable_comments WHERE id = ?', [id]);
    if (!row) return null;
    return this.formatComment(row);
  }

  /**
   * Get all comments for deliverable
   */
  async getDeliverableComments(
    deliverableId: number,
    options?: { resolved?: boolean; elementId?: string }
  ): Promise<DeliverableComment[]> {
    let query = 'SELECT * FROM deliverable_comments WHERE deliverable_id = ?';
    const params: any[] = [deliverableId];

    if (options?.resolved !== undefined) {
      query += ' AND resolved = ?';
      params.push(options.resolved ? 1 : 0);
    }

    if (options?.elementId) {
      query += ' AND element_id = ?';
      params.push(options.elementId);
    }

    query += ' ORDER BY created_at DESC';

    const rows = await this.db.all(query, params);
    return rows.map((row: any) => this.formatComment(row));
  }

  /**
   * Mark comment as resolved
   */
  async resolveComment(id: number): Promise<DeliverableComment> {
    await this.db.run(
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
    await this.db.run('DELETE FROM deliverable_comments WHERE id=?', [id]);
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
    const result = await this.db.run(
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
    const row = await this.db.get('SELECT * FROM design_elements WHERE id = ?', [id]);
    if (!row) return null;
    return row as unknown as DesignElement;
  }

  /**
   * Get all design elements for deliverable
   */
  async getDeliverableElements(deliverableId: number): Promise<DesignElement[]> {
    const rows = await this.db.all(
      'SELECT * FROM design_elements WHERE deliverable_id = ? ORDER BY created_at ASC',
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
      await this.db.run(
        'UPDATE design_elements SET approval_status=?, revision_count=revision_count+1, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        [status, elementId]
      );
    } else {
      await this.db.run(
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
    const result = await this.db.run(
      `INSERT INTO deliverable_reviews (deliverable_id, reviewer_id, decision, feedback, design_elements_reviewed)
       VALUES (?, ?, ?, ?, ?)`,
      [deliverableId, reviewerId, decision, feedback || null, JSON.stringify(elementsReviewed || [])]
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
    const row = await this.db.get('SELECT * FROM deliverable_reviews WHERE id = ?', [id]);
    if (!row) return null;
    return this.formatReview(row);
  }

  /**
   * Get all reviews for deliverable
   */
  async getDeliverableReviews(deliverableId: number): Promise<DeliverableReview[]> {
    const rows = await this.db.all(
      'SELECT * FROM deliverable_reviews WHERE deliverable_id = ? ORDER BY created_at DESC',
      [deliverableId]
    );
    return rows.map((row: any) => this.formatReview(row));
  }

  // ===== HELPER METHODS =====

  private formatDeliverable(row: any): Deliverable {
    return {
      id: row.id,
      project_id: row.project_id,
      type: row.type,
      title: row.title,
      description: row.description,
      status: row.status,
      approval_status: row.approval_status,
      round_number: row.round_number,
      created_by_id: row.created_by_id,
      reviewed_by_id: row.reviewed_by_id,
      review_deadline: row.review_deadline,
      approved_at: row.approved_at,
      locked: Boolean(row.locked),
      tags: row.tags,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private formatComment(row: any): DeliverableComment {
    return {
      id: row.id,
      deliverable_id: row.deliverable_id,
      author_id: row.author_id,
      comment_text: row.comment_text,
      x_position: row.x_position,
      y_position: row.y_position,
      annotation_type: row.annotation_type,
      element_id: row.element_id,
      resolved: Boolean(row.resolved),
      resolved_at: row.resolved_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private formatReview(row: any): DeliverableReview {
    return {
      id: row.id,
      deliverable_id: row.deliverable_id,
      reviewer_id: row.reviewer_id,
      decision: row.decision,
      feedback: row.feedback,
      design_elements_reviewed: row.design_elements_reviewed ? JSON.parse(row.design_elements_reviewed) : [],
      review_duration_minutes: row.review_duration_minutes,
      created_at: row.created_at
    };
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
  createDeliverable: (pid: number, title: string, desc: string, type: string, cid: number, opts?: any) =>
    getDeliverableService().createDeliverable(pid, title, desc, type, cid, opts),
  getDeliverableById: (id: number) => getDeliverableService().getDeliverableById(id),
  getProjectDeliverables: (pid: number, opts?: any) => getDeliverableService().getProjectDeliverables(pid, opts),
  updateDeliverable: (id: number, updates: any) => getDeliverableService().updateDeliverable(id, updates),
  lockDeliverable: (id: number, rid: number) => getDeliverableService().lockDeliverable(id, rid),
  requestRevision: (id: number, reason: string, rid: number) => getDeliverableService().requestRevision(id, reason, rid),
  deleteDeliverable: (id: number) => getDeliverableService().deleteDeliverable(id),
  uploadVersion: (did: number, path: string, name: string, size: number, type: string, uid: number, notes?: string) =>
    getDeliverableService().uploadVersion(did, path, name, size, type, uid, notes),
  getVersionById: (id: number) => getDeliverableService().getVersionById(id),
  getDeliverableVersions: (did: number) => getDeliverableService().getDeliverableVersions(did),
  getLatestVersion: (did: number) => getDeliverableService().getLatestVersion(did),
  addComment: (did: number, aid: number, text: string, opts?: any) =>
    getDeliverableService().addComment(did, aid, text, opts),
  getCommentById: (id: number) => getDeliverableService().getCommentById(id),
  getDeliverableComments: (did: number, opts?: any) => getDeliverableService().getDeliverableComments(did, opts),
  resolveComment: (id: number) => getDeliverableService().resolveComment(id),
  deleteComment: (id: number) => getDeliverableService().deleteComment(id),
  createDesignElement: (did: number, name: string, desc?: string) =>
    getDeliverableService().createDesignElement(did, name, desc),
  getDesignElementById: (id: number) => getDeliverableService().getDesignElementById(id),
  getDeliverableElements: (did: number) => getDeliverableService().getDeliverableElements(did),
  updateElementApprovalStatus: (eid: number, status: any) =>
    getDeliverableService().updateElementApprovalStatus(eid, status),
  createReview: (did: number, rid: number, decision: any, feedback?: string, elements?: number[]) =>
    getDeliverableService().createReview(did, rid, decision, feedback, elements),
  getReviewById: (id: number) => getDeliverableService().getReviewById(id),
  getDeliverableReviews: (did: number) => getDeliverableService().getDeliverableReviews(did)
};

export default deliverableService;
