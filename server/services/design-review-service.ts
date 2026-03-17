/**
 * ===============================================
 * DESIGN REVIEW SERVICE
 * ===============================================
 * @file server/services/design-review-service.ts
 *
 * Service layer for design review queries.
 * Design reviews are deliverables in review-related statuses.
 */

import { getDatabase } from '../database/init.js';

// =====================================================
// INTERFACES
// =====================================================

export interface DesignReviewListItem {
  id: number;
  title: string;
  description: string | null;
  projectId: number;
  projectName: string;
  clientId: number;
  clientName: string;
  status: string;
  version: number;
  comments: number;
  attachments: number;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
}

export interface DesignReviewDetail {
  id: number;
  title: string;
  description: string | null;
  projectId: number;
  projectName: string;
  clientId: number;
  clientName: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
}

export interface DesignReviewAttachment {
  id: number;
  filename: string;
  filePath: string;
  fileSize: number;
  createdAt: string;
}

// Column list for deliverables SELECT
const DELIVERABLE_COLUMNS = `
  id, project_id, type, title, description, status, approval_status, round_number,
  created_by_id, reviewed_by_id, review_deadline, approved_at, locked, tags,
  archived_file_id, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

// Frontend-to-DB status mapping
const STATUS_TO_DB: Record<string, string> = {
  'pending': 'ready_for_review',
  'in-review': 'in_progress',
  'approved': 'approved',
  'revision-requested': 'revision_requested',
  'rejected': 'rejected'
};

// =====================================================
// SERVICE CLASS
// =====================================================

class DesignReviewService {
  /**
   * Get all design reviews, optionally filtered by project
   */
  async getAll(projectId?: string | number): Promise<DesignReviewListItem[]> {
    const db = getDatabase();

    let whereClause = 'WHERE d.status IN (\'ready_for_review\', \'revision_requested\', \'approved\') AND d.deleted_at IS NULL AND p.deleted_at IS NULL AND c.deleted_at IS NULL';
    const params: (string | number)[] = [];

    if (projectId) {
      whereClause += ' AND d.project_id = ?';
      params.push(String(projectId));
    }

    return db.all(`
      SELECT
        d.id,
        d.name as title,
        d.description,
        d.project_id as projectId,
        p.project_name as projectName,
        p.client_id as clientId,
        COALESCE(c.company_name, c.contact_name) as clientName,
        CASE
          WHEN d.status = 'ready_for_review' THEN 'pending'
          WHEN d.status = 'revision_requested' THEN 'revision-requested'
          WHEN d.status = 'approved' THEN 'approved'
          ELSE d.status
        END as status,
        COALESCE(d.revision_count, 1) as version,
        0 as comments,
        (SELECT COUNT(*) FROM files f WHERE f.entity_type = 'deliverable' AND f.entity_id = d.id AND f.deleted_at IS NULL) as attachments,
        d.created_at as createdAt,
        d.updated_at as updatedAt,
        d.due_date as dueDate
      FROM deliverables d
      JOIN projects p ON d.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      ${whereClause}
      ORDER BY d.updated_at DESC
    `, params) as Promise<DesignReviewListItem[]>;
  }

  /**
   * Get a single design review by ID
   */
  async getById(reviewId: number): Promise<DesignReviewDetail | undefined> {
    const db = getDatabase();

    return db.get(`
      SELECT
        d.id,
        d.name as title,
        d.description,
        d.project_id as projectId,
        p.project_name as projectName,
        p.client_id as clientId,
        COALESCE(c.company_name, c.contact_name) as clientName,
        d.status,
        COALESCE(d.revision_count, 1) as version,
        d.created_at as createdAt,
        d.updated_at as updatedAt,
        d.due_date as dueDate
      FROM deliverables d
      JOIN projects p ON d.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE d.id = ?
    `, [reviewId]) as Promise<DesignReviewDetail | undefined>;
  }

  /**
   * Get attachments for a design review
   */
  async getAttachments(reviewId: number): Promise<DesignReviewAttachment[]> {
    const db = getDatabase();

    return db.all(`
      SELECT id, filename, file_path as filePath, file_size as fileSize, created_at as createdAt
      FROM files
      WHERE entity_type = 'deliverable' AND entity_id = ? AND deleted_at IS NULL
    `, [reviewId]) as Promise<DesignReviewAttachment[]>;
  }

  /**
   * Create a new design review (deliverable)
   */
  async create(data: {
    projectId: number;
    title: string;
    description?: string | null;
    type?: string;
    reviewDeadline?: string | null;
  }): Promise<Record<string, unknown> | undefined> {
    const db = getDatabase();
    const result = await db.run(`
      INSERT INTO deliverables (project_id, title, description, type, status, review_deadline)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `, [data.projectId, data.title, data.description || null, data.type || 'design', data.reviewDeadline || null]);

    return db.get(
      `SELECT ${DELIVERABLE_COLUMNS} FROM deliverables WHERE id = ?`,
      [result.lastID]
    ) as Promise<Record<string, unknown> | undefined>;
  }

  /**
   * Update the status of a design review
   * Maps frontend status strings to database status values
   */
  async updateStatus(reviewId: number, status: string): Promise<Record<string, unknown> | undefined> {
    const db = getDatabase();
    const dbStatus = STATUS_TO_DB[status] || status;

    await db.run(`
      UPDATE deliverables
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [dbStatus, reviewId]);

    return db.get(
      `SELECT ${DELIVERABLE_COLUMNS} FROM deliverables WHERE id = ?`,
      [reviewId]
    ) as Promise<Record<string, unknown> | undefined>;
  }
}

// Export singleton instance
export const designReviewService = new DesignReviewService();
export default designReviewService;
