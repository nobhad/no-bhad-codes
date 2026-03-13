/**
 * ===============================================
 * ACTIVITY SERVICE
 * ===============================================
 * @file server/services/activity-service.ts
 *
 * Service for fetching consolidated recent activity feed
 * across all entity types for the admin dashboard.
 */

import { getDatabase } from '../database/init.js';

// =====================================================
// TYPES
// =====================================================

export interface ActivityItem {
  type: string;
  title: string;
  context: string | null;
  date: string | null;
  entityId: number | null;
  clientId: number | null;
  clientName: string | null;
}

interface RawActivityRow {
  type: string;
  title: string;
  context: string | null;
  date: string | null;
  entity_id: number | null;
  client_id: number | null;
}

interface ClientNameRow {
  id: number;
  name: string;
}

// =====================================================
// CONSTANTS
// =====================================================

const DEFAULT_ACTIVITY_LIMIT = 20;

const RECENT_ACTIVITY_QUERY = `SELECT * FROM (
  -- New leads/intakes
  SELECT
    'lead' as type,
    'New inquiry received' as title,
    COALESCE(p.project_name, c.company_name, c.contact_name, c.email) as context,
    p.created_at as date,
    p.id as entity_id,
    p.client_id as client_id
  FROM projects p
  LEFT JOIN clients c ON p.client_id = c.id
  WHERE p.status IN ('pending', 'new') AND p.created_at IS NOT NULL

  UNION ALL

  -- Invoices
  SELECT
    'invoice' as type,
    CASE
      WHEN status = 'sent' THEN 'Invoice sent'
      WHEN status = 'paid' THEN 'Invoice paid'
      WHEN status = 'overdue' THEN 'Invoice overdue'
      WHEN status = 'viewed' THEN 'Invoice viewed'
      ELSE 'Invoice updated'
    END as title,
    invoice_number as context,
    updated_at as date,
    id as entity_id,
    client_id
  FROM invoices
  WHERE updated_at IS NOT NULL

  UNION ALL

  -- Messages
  SELECT
    'message' as type,
    CASE
      WHEN m.sender_type = 'client' THEN 'New message from client'
      ELSE 'Message sent'
    END as title,
    t.subject as context,
    m.created_at as date,
    t.id as entity_id,
    t.client_id
  FROM messages m
  JOIN message_threads t ON m.thread_id = t.id
  WHERE m.created_at IS NOT NULL

  UNION ALL

  -- Document requests
  SELECT
    'document_request' as type,
    CASE
      WHEN status = 'requested' THEN 'Document requested'
      WHEN status = 'uploaded' THEN 'Document uploaded by client'
      WHEN status = 'approved' THEN 'Document approved'
      WHEN status = 'rejected' THEN 'Document rejected'
      ELSE 'Document request updated'
    END as title,
    title as context,
    updated_at as date,
    id as entity_id,
    client_id
  FROM document_requests
  WHERE updated_at IS NOT NULL

  UNION ALL

  -- Contracts
  SELECT
    'contract' as type,
    CASE
      WHEN status = 'sent' THEN 'Contract sent for signature'
      WHEN status = 'signed' THEN 'Contract signed by client'
      WHEN countersigned_at IS NOT NULL THEN 'Contract countersigned'
      ELSE 'Contract updated'
    END as title,
    (SELECT project_name FROM projects WHERE id = contracts.project_id) as context,
    COALESCE(signed_at, sent_at, updated_at) as date,
    id as entity_id,
    client_id
  FROM contracts
  WHERE status != 'draft'

  UNION ALL

  -- Project updates
  SELECT
    'project_update' as type,
    pu.title as title,
    p.project_name as context,
    pu.created_at as date,
    p.id as entity_id,
    p.client_id
  FROM project_updates pu
  JOIN projects p ON pu.project_id = p.id
  WHERE pu.created_at IS NOT NULL

  UNION ALL

  -- Files uploaded
  SELECT
    'file' as type,
    'File uploaded' as title,
    f.original_filename as context,
    f.created_at as date,
    f.id as entity_id,
    p.client_id
  FROM files f
  JOIN projects p ON f.project_id = p.id
  WHERE f.created_at IS NOT NULL AND f.deleted_at IS NULL
)
ORDER BY date DESC
LIMIT ?`;

// =====================================================
// SERVICE CLASS
// =====================================================

class ActivityService {
  /**
   * Get consolidated recent activity feed across all entity types.
   */
  async getRecentActivity(limit: number = DEFAULT_ACTIVITY_LIMIT): Promise<ActivityItem[]> {
    const db = getDatabase();

    const recentActivity = await db.all<RawActivityRow>(RECENT_ACTIVITY_QUERY, [limit]);

    const clientMap = await this.buildClientNameMap(recentActivity);

    return recentActivity.map((item) => ({
      type: item.type,
      title: item.title,
      context: item.context,
      date: item.date,
      entityId: item.entity_id,
      clientId: item.client_id,
      clientName: item.client_id ? clientMap[item.client_id] : null
    }));
  }

  /**
   * Build a map of client IDs to display names for a set of activity rows.
   */
  private async buildClientNameMap(
    activities: RawActivityRow[]
  ): Promise<Record<number, string>> {
    const clientIds = [
      ...new Set(
        activities
          .filter((a) => a.client_id)
          .map((a) => a.client_id as number)
      )
    ];

    const clientMap: Record<number, string> = {};

    if (clientIds.length === 0) return clientMap;

    const db = getDatabase();
    const placeholders = clientIds.map(() => '?').join(',');
    const clients = await db.all<ClientNameRow>(
      `SELECT id, COALESCE(company_name, contact_name) as name FROM clients WHERE id IN (${placeholders})`,
      clientIds as number[]
    );

    clients.forEach((c) => {
      clientMap[c.id] = c.name;
    });

    return clientMap;
  }
}

export const activityService = new ActivityService();
