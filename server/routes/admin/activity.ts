import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { getDatabase } from '../../database/init.js';

const router = express.Router();

/**
 * GET /api/admin/recent-activity - Get consolidated recent activity feed
 *
 * Returns recent activity across all entity types:
 * - Leads (new inquiries)
 * - Invoices (sent, paid, overdue)
 * - Messages (new messages)
 * - Document requests (requested, uploaded, reviewed)
 * - Contracts (sent, signed)
 * - Project updates
 * - File uploads
 */
router.get(
  '/recent-activity',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    const recentActivity = await db.all(
      `SELECT * FROM (
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
        WHERE f.created_at IS NOT NULL
      )
      ORDER BY date DESC
      LIMIT 20`
    );

    // Get client names for activities that have client_id
    const clientIds = [...new Set(recentActivity.filter((a: Record<string, unknown>) => a.client_id).map((a: Record<string, unknown>) => a.client_id as number))];
    const clientMap: Record<number, string> = {};

    if (clientIds.length > 0) {
      const placeholders = clientIds.map(() => '?').join(',');
      const clients = await db.all(
        `SELECT id, COALESCE(company_name, contact_name) as name FROM clients WHERE id IN (${placeholders})`,
        clientIds as number[]
      );
      clients.forEach((c: Record<string, unknown>) => {
        clientMap[c.id as number] = c.name as string;
      });
    }

    res.json({
      success: true,
      recentActivity: recentActivity.map((item: Record<string, unknown>) => ({
        type: item.type,
        title: item.title,
        context: item.context,
        date: item.date,
        entityId: item.entity_id,
        clientId: item.client_id,
        clientName: item.client_id ? clientMap[item.client_id as number] : null
      }))
    });
  })
);

export default router;
