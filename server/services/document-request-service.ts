/**
 * ===============================================
 * DOCUMENT REQUEST SERVICE
 * ===============================================
 * @file server/services/document-request-service.ts
 *
 * Service for managing document requests from admin to clients.
 */

import { getDatabase } from '../database/init.js';

// =====================================================
// TYPES
// =====================================================

export type DocumentType =
  | 'general'
  | 'contract'
  | 'invoice'
  | 'asset'
  | 'source'
  | 'deliverable'
  | 'identification'
  | 'other';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export type RequestStatus =
  | 'requested'
  | 'viewed'
  | 'uploaded'
  | 'under_review'
  | 'approved'
  | 'rejected';

export interface DocumentRequest {
  id: number;
  client_id: number;
  project_id?: number;
  requested_by: string;
  title: string;
  description?: string;
  document_type: DocumentType;
  priority: Priority;
  status: RequestStatus;
  due_date?: string;
  file_id?: number;
  uploaded_by?: string;
  uploaded_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  rejection_reason?: string;
  is_required: boolean;
  reminder_sent_at?: string;
  reminder_count: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  client_name?: string;
  project_name?: string;
  file_name?: string;
}

export interface DocumentRequestTemplate {
  id: number;
  name: string;
  title: string;
  description?: string;
  document_type: DocumentType;
  is_required: boolean;
  days_until_due: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRequestHistory {
  id: number;
  request_id: number;
  action: string;
  old_status?: string;
  new_status?: string;
  actor_email: string;
  actor_type: 'admin' | 'client' | 'system';
  notes?: string;
  created_at: string;
}

interface CreateRequestData {
  client_id: number;
  project_id?: number;
  requested_by: string;
  title: string;
  description?: string;
  document_type?: DocumentType;
  priority?: Priority;
  due_date?: string;
  is_required?: boolean;
}

// =====================================================
// SERVICE CLASS
// =====================================================

class DocumentRequestService {
  // =====================================================
  // REQUEST MANAGEMENT
  // =====================================================

  /**
   * Create a new document request
   */
  async createRequest(data: CreateRequestData): Promise<DocumentRequest> {
    const db = await getDatabase();

    const result = await db.run(
      `INSERT INTO document_requests
       (client_id, project_id, requested_by, title, description, document_type, priority, due_date, is_required)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.client_id,
        data.project_id || null,
        data.requested_by,
        data.title,
        data.description || null,
        data.document_type || 'general',
        data.priority || 'normal',
        data.due_date || null,
        data.is_required !== false ? 1 : 0
      ]
    );

    const requestId = result.lastID!;

    // Log creation history
    await this.logHistory(requestId, 'created', undefined, 'requested', data.requested_by, 'admin');

    return this.getRequest(requestId) as Promise<DocumentRequest>;
  }

  /**
   * Create multiple requests from templates
   */
  async createFromTemplates(
    clientId: number,
    templateIds: number[],
    requestedBy: string,
    projectId?: number
  ): Promise<DocumentRequest[]> {
    const requests: DocumentRequest[] = [];

    for (const templateId of templateIds) {
      const template = await this.getTemplate(templateId);
      if (!template) continue;

      // Calculate due date from template
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + template.days_until_due);

      const request = await this.createRequest({
        client_id: clientId,
        project_id: projectId,
        requested_by: requestedBy,
        title: template.title,
        description: template.description,
        document_type: template.document_type,
        is_required: template.is_required,
        due_date: dueDate.toISOString().split('T')[0]
      });

      requests.push(request);
    }

    return requests;
  }

  /**
   * Get a document request by ID
   */
  async getRequest(id: number): Promise<DocumentRequest | null> {
    const db = await getDatabase();

    const request = await db.get(
      `SELECT dr.*,
              COALESCE(c.company_name, c.contact_name) as client_name,
              p.project_name as project_name,
              f.original_filename as file_name
       FROM document_requests dr
       LEFT JOIN clients c ON dr.client_id = c.id
       LEFT JOIN projects p ON dr.project_id = p.id
       LEFT JOIN files f ON dr.file_id = f.id
       WHERE dr.id = ?`,
      [id]
    );

    return (request as unknown as DocumentRequest) || null;
  }

  /**
   * Get all requests for a client
   */
  async getClientRequests(
    clientId: number,
    status?: RequestStatus
  ): Promise<DocumentRequest[]> {
    const db = await getDatabase();

    let query = `
      SELECT dr.*,
             p.project_name as project_name,
             f.original_filename as file_name
      FROM document_requests dr
      LEFT JOIN projects p ON dr.project_id = p.id
      LEFT JOIN files f ON dr.file_id = f.id
      WHERE dr.client_id = ?
    `;
    const params: (number | string)[] = [clientId];

    if (status) {
      query += ' AND dr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY CASE WHEN dr.due_date IS NULL THEN 1 ELSE 0 END, dr.due_date ASC, dr.created_at DESC';

    const requests = await db.all(query, params);
    return requests as unknown as DocumentRequest[];
  }

  /**
   * Get all pending requests (admin view)
   */
  async getPendingRequests(): Promise<DocumentRequest[]> {
    const db = await getDatabase();

    const requests = await db.all(
      `SELECT dr.*,
              COALESCE(c.company_name, c.contact_name) as client_name,
              p.project_name as project_name,
              f.original_filename as file_name
       FROM document_requests dr
       LEFT JOIN clients c ON dr.client_id = c.id
       LEFT JOIN projects p ON dr.project_id = p.id
       LEFT JOIN files f ON dr.file_id = f.id
       WHERE dr.status IN ('requested', 'viewed', 'uploaded', 'under_review')
       ORDER BY
         CASE dr.priority
           WHEN 'urgent' THEN 1
           WHEN 'high' THEN 2
           WHEN 'normal' THEN 3
           WHEN 'low' THEN 4
         END,
         CASE WHEN dr.due_date IS NULL THEN 1 ELSE 0 END,
         dr.due_date ASC,
         dr.created_at DESC`
    );

    return requests as unknown as DocumentRequest[];
  }

  /**
   * Get requests needing review (status = uploaded)
   */
  async getRequestsForReview(): Promise<DocumentRequest[]> {
    const db = await getDatabase();

    const requests = await db.all(
      `SELECT dr.*,
              COALESCE(c.company_name, c.contact_name) as client_name,
              p.project_name as project_name,
              f.original_filename as file_name
       FROM document_requests dr
       LEFT JOIN clients c ON dr.client_id = c.id
       LEFT JOIN projects p ON dr.project_id = p.id
       LEFT JOIN files f ON dr.file_id = f.id
       WHERE dr.status = 'uploaded'
       ORDER BY dr.uploaded_at ASC`
    );

    return requests as unknown as DocumentRequest[];
  }

  /**
   * Mark request as viewed by client
   */
  async markViewed(id: number, viewerEmail: string): Promise<DocumentRequest> {
    const db = await getDatabase();
    const request = await this.getRequest(id);

    if (!request) {
      throw new Error('Document request not found');
    }

    // Only update if currently in 'requested' status
    if (request.status === 'requested') {
      await db.run(
        `UPDATE document_requests SET status = 'viewed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id]
      );

      await this.logHistory(id, 'viewed', 'requested', 'viewed', viewerEmail, 'client');
    }

    return this.getRequest(id) as Promise<DocumentRequest>;
  }

  /**
   * Upload a file for a document request
   */
  async uploadDocument(
    id: number,
    fileId: number,
    uploaderEmail: string
  ): Promise<DocumentRequest> {
    const db = await getDatabase();
    const request = await this.getRequest(id);

    if (!request) {
      throw new Error('Document request not found');
    }

    const oldStatus = request.status;

    await db.run(
      `UPDATE document_requests
       SET status = 'uploaded',
           file_id = ?,
           uploaded_by = ?,
           uploaded_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [fileId, uploaderEmail, id]
    );

    await this.logHistory(id, 'uploaded', oldStatus, 'uploaded', uploaderEmail, 'client');

    return this.getRequest(id) as Promise<DocumentRequest>;
  }

  /**
   * Start review of uploaded document
   */
  async startReview(id: number, reviewerEmail: string): Promise<DocumentRequest> {
    const db = await getDatabase();
    const request = await this.getRequest(id);

    if (!request) {
      throw new Error('Document request not found');
    }

    if (request.status !== 'uploaded') {
      throw new Error('Request must be uploaded before review');
    }

    await db.run(
      `UPDATE document_requests
       SET status = 'under_review',
           reviewed_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reviewerEmail, id]
    );

    await this.logHistory(id, 'review_started', 'uploaded', 'under_review', reviewerEmail, 'admin');

    return this.getRequest(id) as Promise<DocumentRequest>;
  }

  /**
   * Approve a document request
   */
  async approveRequest(
    id: number,
    reviewerEmail: string,
    notes?: string
  ): Promise<DocumentRequest> {
    const db = await getDatabase();
    const request = await this.getRequest(id);

    if (!request) {
      throw new Error('Document request not found');
    }

    const oldStatus = request.status;

    await db.run(
      `UPDATE document_requests
       SET status = 'approved',
           reviewed_by = ?,
           reviewed_at = CURRENT_TIMESTAMP,
           review_notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reviewerEmail, notes || null, id]
    );

    await this.logHistory(id, 'approved', oldStatus, 'approved', reviewerEmail, 'admin', notes);

    return this.getRequest(id) as Promise<DocumentRequest>;
  }

  /**
   * Reject a document request
   */
  async rejectRequest(
    id: number,
    reviewerEmail: string,
    reason: string
  ): Promise<DocumentRequest> {
    const db = await getDatabase();
    const request = await this.getRequest(id);

    if (!request) {
      throw new Error('Document request not found');
    }

    const oldStatus = request.status;

    await db.run(
      `UPDATE document_requests
       SET status = 'rejected',
           reviewed_by = ?,
           reviewed_at = CURRENT_TIMESTAMP,
           rejection_reason = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reviewerEmail, reason, id]
    );

    await this.logHistory(id, 'rejected', oldStatus, 'rejected', reviewerEmail, 'admin', reason);

    return this.getRequest(id) as Promise<DocumentRequest>;
  }

  /**
   * Delete a document request
   */
  async deleteRequest(id: number): Promise<void> {
    const db = await getDatabase();
    await db.run('DELETE FROM document_requests WHERE id = ?', [id]);
  }

  /**
   * Send reminder for a document request
   */
  async sendReminder(id: number): Promise<DocumentRequest> {
    const db = await getDatabase();
    const request = await this.getRequest(id);

    if (!request) {
      throw new Error('Document request not found');
    }

    await db.run(
      `UPDATE document_requests
       SET reminder_sent_at = CURRENT_TIMESTAMP,
           reminder_count = reminder_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );

    await this.logHistory(id, 'reminder_sent', request.status, request.status, 'system', 'system');

    return this.getRequest(id) as Promise<DocumentRequest>;
  }

  /**
   * Get overdue requests
   */
  async getOverdueRequests(): Promise<DocumentRequest[]> {
    const db = await getDatabase();

    const requests = await db.all(
      `SELECT dr.*,
              COALESCE(c.company_name, c.contact_name) as client_name,
              p.project_name as project_name
       FROM document_requests dr
       LEFT JOIN clients c ON dr.client_id = c.id
       LEFT JOIN projects p ON dr.project_id = p.id
       WHERE dr.status IN ('requested', 'viewed')
         AND dr.due_date < date('now')
       ORDER BY dr.due_date ASC`
    );

    return requests as unknown as DocumentRequest[];
  }

  // =====================================================
  // TEMPLATES
  // =====================================================

  /**
   * Get all templates
   */
  async getTemplates(): Promise<DocumentRequestTemplate[]> {
    const db = await getDatabase();
    const templates = await db.all(
      'SELECT * FROM document_request_templates ORDER BY name'
    );
    return templates as unknown as DocumentRequestTemplate[];
  }

  /**
   * Get a template by ID
   */
  async getTemplate(id: number): Promise<DocumentRequestTemplate | null> {
    const db = await getDatabase();
    const template = await db.get(
      'SELECT * FROM document_request_templates WHERE id = ?',
      [id]
    );
    return (template as unknown as DocumentRequestTemplate) || null;
  }

  /**
   * Create a new template
   */
  async createTemplate(data: {
    name: string;
    title: string;
    description?: string;
    document_type?: DocumentType;
    is_required?: boolean;
    days_until_due?: number;
    created_by?: string;
  }): Promise<DocumentRequestTemplate> {
    const db = await getDatabase();

    const result = await db.run(
      `INSERT INTO document_request_templates
       (name, title, description, document_type, is_required, days_until_due, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.title,
        data.description || null,
        data.document_type || 'general',
        data.is_required !== false ? 1 : 0,
        data.days_until_due || 7,
        data.created_by || null
      ]
    );

    return this.getTemplate(result.lastID!) as Promise<DocumentRequestTemplate>;
  }

  /**
   * Update a template
   */
  async updateTemplate(
    id: number,
    data: Partial<DocumentRequestTemplate>
  ): Promise<DocumentRequestTemplate | null> {
    const db = await getDatabase();
    const template = await this.getTemplate(id);

    if (!template) {
      return null;
    }

    await db.run(
      `UPDATE document_request_templates
       SET name = ?,
           title = ?,
           description = ?,
           document_type = ?,
           is_required = ?,
           days_until_due = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.name || template.name,
        data.title || template.title,
        data.description !== undefined ? data.description : template.description,
        data.document_type || template.document_type,
        data.is_required !== undefined ? (data.is_required ? 1 : 0) : (template.is_required ? 1 : 0),
        data.days_until_due || template.days_until_due,
        id
      ]
    );

    return this.getTemplate(id);
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: number): Promise<void> {
    const db = await getDatabase();
    await db.run('DELETE FROM document_request_templates WHERE id = ?', [id]);
  }

  // =====================================================
  // HISTORY
  // =====================================================

  /**
   * Log an action to history
   */
  private async logHistory(
    requestId: number,
    action: string,
    oldStatus: string | undefined,
    newStatus: string,
    actorEmail: string,
    actorType: 'admin' | 'client' | 'system',
    notes?: string
  ): Promise<void> {
    const db = await getDatabase();

    await db.run(
      `INSERT INTO document_request_history
       (request_id, action, old_status, new_status, actor_email, actor_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [requestId, action, oldStatus || null, newStatus, actorEmail, actorType, notes || null]
    );
  }

  /**
   * Get history for a request
   */
  async getRequestHistory(requestId: number): Promise<DocumentRequestHistory[]> {
    const db = await getDatabase();

    const history = await db.all(
      `SELECT * FROM document_request_history
       WHERE request_id = ?
       ORDER BY created_at DESC`,
      [requestId]
    );

    return history as unknown as DocumentRequestHistory[];
  }

  // =====================================================
  // STATS
  // =====================================================

  /**
   * Get document request stats for a client
   */
  async getClientStats(clientId: number): Promise<{
    total: number;
    pending: number;
    uploaded: number;
    approved: number;
    rejected: number;
    overdue: number;
  }> {
    const db = await getDatabase();

    const stats = await db.get(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status IN ('requested', 'viewed') THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'uploaded' THEN 1 ELSE 0 END) as uploaded,
         SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
         SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
         SUM(CASE WHEN status IN ('requested', 'viewed') AND due_date < date('now') THEN 1 ELSE 0 END) as overdue
       FROM document_requests
       WHERE client_id = ?`,
      [clientId]
    ) as { total: number; pending: number; uploaded: number; approved: number; rejected: number; overdue: number };

    return {
      total: stats?.total || 0,
      pending: stats?.pending || 0,
      uploaded: stats?.uploaded || 0,
      approved: stats?.approved || 0,
      rejected: stats?.rejected || 0,
      overdue: stats?.overdue || 0
    };
  }
}

// Export singleton instance
export const documentRequestService = new DocumentRequestService();
