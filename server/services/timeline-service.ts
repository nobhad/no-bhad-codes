/**
 * ===============================================
 * TIMELINE SERVICE
 * ===============================================
 * @file server/services/timeline-service.ts
 *
 * Service for aggregating project activities into a timeline view.
 */

import { getDatabase } from '../database/init.js';

// =====================================================
// TYPES
// =====================================================

export type TimelineEventType =
  | 'project_created'
  | 'project_update'
  | 'milestone'
  | 'task_completed'
  | 'file_uploaded'
  | 'message_sent'
  | 'invoice_created'
  | 'invoice_paid'
  | 'proposal_sent'
  | 'contract_signed'
  | 'deliverable_submitted'
  | 'deliverable_approved'
  | 'document_requested'
  | 'document_uploaded';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  project_id?: number;
  project_name?: string;
  entity_id?: number;
  entity_type?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  actor_name?: string;
  actor_type?: 'client' | 'admin' | 'system';
}

// =====================================================
// SERVICE CLASS
// =====================================================

class TimelineService {
  /**
   * Get timeline events for a client
   */
  async getClientTimeline(
    clientId: number,
    options: {
      projectId?: number;
      limit?: number;
      offset?: number;
      types?: TimelineEventType[];
    } = {}
  ): Promise<{ events: TimelineEvent[]; total: number }> {
    const { projectId, limit = 50, offset = 0, types } = options;
    const db = await getDatabase();

    // Build where clauses for project filter
    const projectClause = projectId ? 'AND p.id = ?' : '';
    const projectParams = projectId ? [projectId] : [];

    // Aggregate events from multiple sources
    const queries: Promise<any[]>[] = [];

    // 1. Project updates/milestones
    if (!types || types.includes('project_update') || types.includes('milestone')) {
      queries.push(
        db.all(
          `SELECT
            'project_update' as type,
            'project_update_' || p.id as id,
            'Project Updated' as title,
            p.name as project_name,
            p.id as project_id,
            p.status as description,
            p.updated_at as created_at,
            'system' as actor_type,
            'System' as actor_name
          FROM projects p
          WHERE p.client_id = ? ${projectClause}
          ORDER BY p.updated_at DESC`,
          [clientId, ...projectParams]
        )
      );
    }

    // 2. Files uploaded
    if (!types || types.includes('file_uploaded')) {
      queries.push(
        db.all(
          `SELECT
            'file_uploaded' as type,
            'file_' || f.id as id,
            'File Uploaded' as title,
            f.original_filename as description,
            p.name as project_name,
            f.project_id as project_id,
            f.id as entity_id,
            'file' as entity_type,
            f.created_at as created_at,
            CASE WHEN f.uploaded_by = ? THEN 'client' ELSE 'admin' END as actor_type,
            f.uploaded_by as actor_name
          FROM files f
          JOIN projects p ON f.project_id = p.id
          WHERE p.client_id = ? ${projectClause}
          ORDER BY f.created_at DESC`,
          [clientId, clientId, ...projectParams]
        )
      );
    }

    // 3. Messages
    if (!types || types.includes('message_sent')) {
      queries.push(
        db.all(
          `SELECT
            'message_sent' as type,
            'message_' || m.id as id,
            CASE WHEN m.sender_type = 'client' THEN 'Message Sent' ELSE 'Message Received' END as title,
            SUBSTR(m.content, 1, 100) as description,
            p.name as project_name,
            m.project_id as project_id,
            m.id as entity_id,
            'message' as entity_type,
            m.created_at as created_at,
            CASE WHEN m.sender_type = 'client' THEN 'client' ELSE 'admin' END as actor_type,
            m.sender_name as actor_name
          FROM messages m
          JOIN projects p ON m.project_id = p.id
          WHERE p.client_id = ? ${projectClause}
          ORDER BY m.created_at DESC`,
          [clientId, ...projectParams]
        )
      );
    }

    // 4. Invoices
    if (!types || types.includes('invoice_created') || types.includes('invoice_paid')) {
      queries.push(
        db.all(
          `SELECT
            CASE WHEN i.status = 'paid' THEN 'invoice_paid' ELSE 'invoice_created' END as type,
            'invoice_' || i.id as id,
            CASE WHEN i.status = 'paid' THEN 'Invoice Paid' ELSE 'Invoice Created' END as title,
            i.invoice_number || ' - $' || printf("%.2f", i.total) as description,
            p.name as project_name,
            i.project_id as project_id,
            i.id as entity_id,
            'invoice' as entity_type,
            CASE WHEN i.status = 'paid' THEN i.paid_at ELSE i.created_at END as created_at,
            'admin' as actor_type,
            'System' as actor_name
          FROM invoices i
          LEFT JOIN projects p ON i.project_id = p.id
          WHERE i.client_id = ? ${projectClause}
          ORDER BY i.created_at DESC`,
          [clientId, ...projectParams]
        )
      );
    }

    // 5. Document requests
    if (!types || types.includes('document_requested') || types.includes('document_uploaded')) {
      queries.push(
        db.all(
          `SELECT
            CASE
              WHEN dr.status = 'uploaded' THEN 'document_uploaded'
              WHEN dr.status = 'approved' THEN 'deliverable_approved'
              ELSE 'document_requested'
            END as type,
            'doc_request_' || dr.id as id,
            CASE
              WHEN dr.status = 'uploaded' THEN 'Document Uploaded'
              WHEN dr.status = 'approved' THEN 'Document Approved'
              ELSE 'Document Requested'
            END as title,
            dr.title as description,
            p.name as project_name,
            dr.project_id as project_id,
            dr.id as entity_id,
            'document_request' as entity_type,
            COALESCE(dr.uploaded_at, dr.created_at) as created_at,
            CASE
              WHEN dr.status = 'uploaded' THEN 'client'
              ELSE 'admin'
            END as actor_type,
            COALESCE(dr.uploaded_by, dr.requested_by) as actor_name
          FROM document_requests dr
          LEFT JOIN projects p ON dr.project_id = p.id
          WHERE dr.client_id = ? ${projectClause}
          ORDER BY dr.created_at DESC`,
          [clientId, ...projectParams]
        ).catch(() => []) // Gracefully handle if table doesn't exist
      );
    }

    // 6. Deliverable workflows
    if (!types || types.includes('deliverable_submitted') || types.includes('deliverable_approved')) {
      queries.push(
        db.all(
          `SELECT
            CASE
              WHEN dw.status = 'approved' THEN 'deliverable_approved'
              ELSE 'deliverable_submitted'
            END as type,
            'deliverable_' || dw.id as id,
            CASE
              WHEN dw.status = 'approved' THEN 'Deliverable Approved'
              ELSE 'Deliverable Submitted'
            END as title,
            f.original_filename as description,
            p.name as project_name,
            dw.project_id as project_id,
            dw.file_id as entity_id,
            'deliverable' as entity_type,
            COALESCE(dw.approved_at, dw.submitted_at) as created_at,
            CASE
              WHEN dw.status = 'approved' THEN 'admin'
              ELSE 'admin'
            END as actor_type,
            COALESCE(dw.approved_by, dw.submitted_by) as actor_name
          FROM deliverable_workflows dw
          JOIN files f ON dw.file_id = f.id
          JOIN projects p ON dw.project_id = p.id
          WHERE p.client_id = ? ${projectClause}
          ORDER BY dw.created_at DESC`,
          [clientId, ...projectParams]
        ).catch(() => []) // Gracefully handle if table doesn't exist
      );
    }

    // Execute all queries in parallel
    const results = await Promise.all(queries);

    // Flatten and sort all events by date
    let allEvents: TimelineEvent[] = results.flat().map((event) => ({
      id: event.id,
      type: event.type,
      title: event.title,
      description: event.description,
      project_id: event.project_id,
      project_name: event.project_name,
      entity_id: event.entity_id,
      entity_type: event.entity_type,
      created_at: event.created_at,
      actor_name: event.actor_name,
      actor_type: event.actor_type
    }));

    // Filter by types if specified
    if (types && types.length > 0) {
      allEvents = allEvents.filter((e) => types.includes(e.type));
    }

    // Sort by date descending
    allEvents.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const total = allEvents.length;

    // Apply pagination
    const paginatedEvents = allEvents.slice(offset, offset + limit);

    return { events: paginatedEvents, total };
  }

  /**
   * Get timeline events for a specific project
   */
  async getProjectTimeline(
    projectId: number,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ events: TimelineEvent[]; total: number }> {
    const db = await getDatabase();

    // Get client ID for the project
    const project = await db.get('SELECT client_id FROM projects WHERE id = ?', [projectId]) as { client_id: number } | undefined;

    if (!project) {
      return { events: [], total: 0 };
    }

    return this.getClientTimeline(project.client_id, {
      projectId,
      limit: options.limit,
      offset: options.offset
    });
  }

  /**
   * Get recent activity summary for dashboard
   */
  async getRecentActivitySummary(
    clientId: number,
    days: number = 7
  ): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    recentEvents: TimelineEvent[];
  }> {
    const { events, total } = await this.getClientTimeline(clientId, { limit: 100 });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentEvents = events.filter(
      (e) => new Date(e.created_at) >= cutoffDate
    );

    // Count by type
    const byType: Record<string, number> = {};
    for (const event of recentEvents) {
      byType[event.type] = (byType[event.type] || 0) + 1;
    }

    return {
      totalEvents: recentEvents.length,
      byType,
      recentEvents: recentEvents.slice(0, 10)
    };
  }
}

// Export singleton instance
export const timelineService = new TimelineService();
