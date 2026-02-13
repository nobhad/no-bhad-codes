/**
 * ===============================================
 * SOFT DELETE SERVICE
 * ===============================================
 * @file server/services/soft-delete-service.ts
 *
 * Provides 30-day soft delete recovery for main entities:
 * - Clients (cascades to projects, proposals; voids unpaid invoices)
 * - Projects (cascades to proposals)
 * - Invoices (blocks paid invoices from deletion)
 * - Leads (projects with status='pending' or 'new' - since migration 086)
 * - Proposals (proposal_requests)
 */

import { getDatabase } from '../database/init.js';
import { auditLogger } from './audit-logger.js';
import { logger } from './logger.js';

// =====================================================
// TYPES
// =====================================================

export type SoftDeleteEntityType = 'client' | 'project' | 'invoice' | 'lead' | 'proposal';

export interface DeletedItem {
  id: number;
  entityType: SoftDeleteEntityType;
  name: string;
  deletedAt: string;
  deletedBy: string;
  daysUntilPermanent: number;
  canRestore: boolean;
  metadata?: Record<string, unknown>;
}

export interface DeletedItemStats {
  clients: number;
  projects: number;
  invoices: number;
  leads: number;
  proposals: number;
  total: number;
}

interface SoftDeleteResult {
  success: boolean;
  message: string;
  affectedItems?: {
    clients: number;
    projects: number;
    invoices: number;
    proposals: number;
  };
}

// =====================================================
// HELPER CONSTANTS
// =====================================================

const RETENTION_DAYS = 30;

// Table mappings for entity types
// Note: 'lead' now maps to 'projects' with status filter (since migration 086)
const TABLE_MAP: Record<SoftDeleteEntityType, string> = {
  client: 'clients',
  project: 'projects',
  invoice: 'invoices',
  lead: 'projects', // Leads are projects with status IN ('pending', 'new')
  proposal: 'proposal_requests'
};

// =====================================================
// SOFT DELETE SERVICE CLASS
// =====================================================

class SoftDeleteService {
  // ===================================================
  // CLIENT SOFT DELETE (CASCADE)
  // ===================================================

  /**
   * Soft delete a client and cascade to related entities
   * - Cascade deletes: projects, proposals
   * - Voids unpaid invoices (does NOT delete paid invoices)
   */
  async softDeleteClient(clientId: number, deletedBy: string): Promise<SoftDeleteResult> {
    const db = getDatabase();
    const now = new Date().toISOString();

    try {
      // Verify client exists and isn't already deleted
      const client = await db.get(
        'SELECT id, company_name, contact_name, email FROM clients WHERE id = ? AND deleted_at IS NULL',
        [clientId]
      ) as { id: number; company_name?: string; contact_name?: string; email: string } | undefined;

      if (!client) {
        return { success: false, message: 'Client not found or already deleted' };
      }

      // Count affected items for reporting
      const affectedItems = {
        clients: 1,
        projects: 0,
        invoices: 0,
        proposals: 0
      };

      // 1. Soft delete associated projects and their proposals using batch operations
      const projects = await db.all(
        'SELECT id FROM projects WHERE client_id = ? AND deleted_at IS NULL',
        [clientId]
      ) as { id: number }[];

      if (projects.length > 0) {
        const projectIds = projects.map(p => p.id);

        // Batch soft delete proposals for all projects in one query
        const proposalResult = await db.run(
          `UPDATE proposal_requests
           SET deleted_at = ?, deleted_by = ?
           WHERE project_id IN (${projectIds.join(',')}) AND deleted_at IS NULL`,
          [now, deletedBy]
        );
        affectedItems.proposals += proposalResult.changes || 0;

        // Batch soft delete all projects in one query
        await db.run(
          `UPDATE projects SET deleted_at = ?, deleted_by = ?
           WHERE id IN (${projectIds.join(',')})`,
          [now, deletedBy]
        );
        affectedItems.projects = projectIds.length;
      }

      // 2. Soft delete proposals directly linked to client (not through projects)
      const directProposals = await db.run(
        `UPDATE proposal_requests
         SET deleted_at = ?, deleted_by = ?
         WHERE client_id = ? AND deleted_at IS NULL`,
        [now, deletedBy, clientId]
      );
      affectedItems.proposals += directProposals.changes || 0;

      // 3. Void unpaid invoices (do NOT delete paid invoices)
      const voidResult = await db.run(
        `UPDATE invoices
         SET status = 'voided', deleted_at = ?, deleted_by = ?
         WHERE client_id = ? AND status NOT IN ('paid', 'voided', 'cancelled') AND deleted_at IS NULL`,
        [now, deletedBy, clientId]
      );
      affectedItems.invoices = voidResult.changes || 0;

      // 4. Soft delete the client
      await db.run(
        'UPDATE clients SET deleted_at = ?, deleted_by = ? WHERE id = ?',
        [now, deletedBy, clientId]
      );

      // Log the action
      const clientName = client.company_name || client.contact_name || client.email;
      await auditLogger.log({
        action: 'client_deleted',
        entityType: 'client',
        entityId: String(clientId),
        entityName: clientName,
        userId: 0,
        userEmail: deletedBy,
        userType: 'admin',
        metadata: { cascadeAffected: affectedItems },
        ipAddress: 'system',
        userAgent: 'soft-delete-service'
      });

      logger.info(`Soft deleted client ${clientId} (${clientName}) and ${affectedItems.projects} projects, ${affectedItems.proposals} proposals, voided ${affectedItems.invoices} invoices`);

      return {
        success: true,
        message: `Client "${clientName}" moved to trash. Will be permanently deleted in ${RETENTION_DAYS} days.`,
        affectedItems
      };
    } catch (error) {
      logger.error('Error soft deleting client:', { error: error instanceof Error ? error : new Error(String(error)) });
      throw error;
    }
  }

  // ===================================================
  // PROJECT SOFT DELETE (CASCADE)
  // ===================================================

  /**
   * Soft delete a project and cascade to proposals
   * Does NOT delete invoices - they remain attached to the client
   */
  async softDeleteProject(projectId: number, deletedBy: string, isChildDelete = false): Promise<SoftDeleteResult> {
    const db = getDatabase();
    const now = new Date().toISOString();

    try {
      // Verify project exists and isn't already deleted
      const project = await db.get(
        'SELECT id, project_name as name, client_id FROM projects WHERE id = ? AND deleted_at IS NULL',
        [projectId]
      ) as { id: number; name: string; client_id: number } | undefined;

      if (!project) {
        return { success: false, message: 'Project not found or already deleted' };
      }

      const affectedItems = {
        clients: 0,
        projects: 1,
        invoices: 0,
        proposals: 0
      };

      // 1. Soft delete associated proposals
      const proposalResult = await db.run(
        `UPDATE proposal_requests
         SET deleted_at = ?, deleted_by = ?
         WHERE project_id = ? AND deleted_at IS NULL`,
        [now, deletedBy, projectId]
      );
      affectedItems.proposals = proposalResult.changes || 0;

      // 2. Soft delete the project
      await db.run(
        'UPDATE projects SET deleted_at = ?, deleted_by = ? WHERE id = ?',
        [now, deletedBy, projectId]
      );

      // Log the action (only if not a child delete to avoid duplicate logs)
      if (!isChildDelete) {
        await auditLogger.log({
          action: 'project_deleted',
          entityType: 'project',
          entityId: String(projectId),
          entityName: project.name,
          userId: 0,
          userEmail: deletedBy,
          userType: 'admin',
          metadata: { clientId: project.client_id, cascadeAffected: affectedItems },
          ipAddress: 'system',
          userAgent: 'soft-delete-service'
        });

        logger.info(`Soft deleted project ${projectId} (${project.name}) and ${affectedItems.proposals} proposals`);
      }

      return {
        success: true,
        message: `Project "${project.name}" moved to trash. Will be permanently deleted in ${RETENTION_DAYS} days.`,
        affectedItems
      };
    } catch (error) {
      logger.error('Error soft deleting project:', { error: error instanceof Error ? error : new Error(String(error)) });
      throw error;
    }
  }

  // ===================================================
  // INVOICE SOFT DELETE
  // ===================================================

  /**
   * Soft delete an invoice
   * BLOCKS deletion of paid invoices (returns error)
   * Voids unpaid invoices before soft deleting
   */
  async softDeleteInvoice(invoiceId: number, deletedBy: string): Promise<SoftDeleteResult> {
    const db = getDatabase();
    const now = new Date().toISOString();

    try {
      // Verify invoice exists and check status
      const invoice = await db.get(
        'SELECT id, invoice_number, status, client_id FROM invoices WHERE id = ? AND deleted_at IS NULL',
        [invoiceId]
      ) as { id: number; invoice_number: string; status: string; client_id: number } | undefined;

      if (!invoice) {
        return { success: false, message: 'Invoice not found or already deleted' };
      }

      // Block deletion of paid invoices - they must be kept for accounting
      if (invoice.status === 'paid') {
        return {
          success: false,
          message: 'Cannot delete paid invoices. They must be retained for accounting records.'
        };
      }

      // Void the invoice if it's not already voided/cancelled, then soft delete
      if (invoice.status !== 'voided' && invoice.status !== 'cancelled') {
        await db.run(
          'UPDATE invoices SET status = \'voided\' WHERE id = ?',
          [invoiceId]
        );
      }

      // Soft delete the invoice
      await db.run(
        'UPDATE invoices SET deleted_at = ?, deleted_by = ? WHERE id = ?',
        [now, deletedBy, invoiceId]
      );

      await auditLogger.log({
        action: 'invoice_deleted',
        entityType: 'invoice',
        entityId: String(invoiceId),
        entityName: invoice.invoice_number,
        userId: 0,
        userEmail: deletedBy,
        userType: 'admin',
        metadata: { previousStatus: invoice.status, clientId: invoice.client_id },
        ipAddress: 'system',
        userAgent: 'soft-delete-service'
      });

      logger.info(`Soft deleted invoice ${invoiceId} (${invoice.invoice_number})`);

      return {
        success: true,
        message: `Invoice "${invoice.invoice_number}" voided and moved to trash. Will be permanently deleted in ${RETENTION_DAYS} days.`,
        affectedItems: { clients: 0, projects: 0, invoices: 1, proposals: 0 }
      };
    } catch (error) {
      logger.error('Error soft deleting invoice:', { error: error instanceof Error ? error : new Error(String(error)) });
      throw error;
    }
  }

  // ===================================================
  // LEAD SOFT DELETE
  // ===================================================

  /**
   * Soft delete a lead (projects with status='pending' or 'new')
   * Standalone deletion, no cascades
   * Note: Since migration 086, leads are stored in projects table
   */
  async softDeleteLead(leadId: number, deletedBy: string): Promise<SoftDeleteResult> {
    const db = getDatabase();
    const now = new Date().toISOString();

    try {
      // Query projects table - leads are projects with pending/new status
      const lead = await db.get(
        `SELECT p.id, p.project_name, c.company_name, c.contact_name, c.email
         FROM projects p
         LEFT JOIN clients c ON p.client_id = c.id
         WHERE p.id = ? AND p.status IN ('pending', 'new') AND p.deleted_at IS NULL`,
        [leadId]
      ) as { id: number; project_name?: string; company_name?: string; contact_name?: string; email?: string } | undefined;

      if (!lead) {
        return { success: false, message: 'Lead not found or already deleted' };
      }

      await db.run(
        'UPDATE projects SET deleted_at = ?, deleted_by = ? WHERE id = ?',
        [now, deletedBy, leadId]
      );

      const leadName = lead.project_name || lead.company_name || lead.contact_name || lead.email || `Lead #${leadId}`;

      await auditLogger.log({
        action: 'lead_deleted',
        entityType: 'lead',
        entityId: String(leadId),
        entityName: leadName,
        userId: 0,
        userEmail: deletedBy,
        userType: 'admin',
        metadata: {},
        ipAddress: 'system',
        userAgent: 'soft-delete-service'
      });

      logger.info(`Soft deleted lead ${leadId} (${leadName})`);

      return {
        success: true,
        message: `Lead "${leadName}" moved to trash. Will be permanently deleted in ${RETENTION_DAYS} days.`,
        affectedItems: { clients: 0, projects: 0, invoices: 0, proposals: 0 }
      };
    } catch (error) {
      logger.error('Error soft deleting lead:', { error: error instanceof Error ? error : new Error(String(error)) });
      throw error;
    }
  }

  // ===================================================
  // PROPOSAL SOFT DELETE
  // ===================================================

  /**
   * Soft delete a proposal (proposal_requests)
   * Standalone deletion, no cascades
   */
  async softDeleteProposal(proposalId: number, deletedBy: string): Promise<SoftDeleteResult> {
    const db = getDatabase();
    const now = new Date().toISOString();

    try {
      const proposal = await db.get(
        'SELECT id, title, client_id FROM proposal_requests WHERE id = ? AND deleted_at IS NULL',
        [proposalId]
      ) as { id: number; title?: string; client_id?: number } | undefined;

      if (!proposal) {
        return { success: false, message: 'Proposal not found or already deleted' };
      }

      await db.run(
        'UPDATE proposal_requests SET deleted_at = ?, deleted_by = ? WHERE id = ?',
        [now, deletedBy, proposalId]
      );

      const proposalName = proposal.title || `Proposal #${proposalId}`;

      await auditLogger.log({
        action: 'proposal_deleted',
        entityType: 'proposal',
        entityId: String(proposalId),
        entityName: proposalName,
        userId: 0,
        userEmail: deletedBy,
        userType: 'admin',
        metadata: { clientId: proposal.client_id },
        ipAddress: 'system',
        userAgent: 'soft-delete-service'
      });

      logger.info(`Soft deleted proposal ${proposalId} (${proposalName})`);

      return {
        success: true,
        message: `Proposal "${proposalName}" moved to trash. Will be permanently deleted in ${RETENTION_DAYS} days.`,
        affectedItems: { clients: 0, projects: 0, invoices: 0, proposals: 1 }
      };
    } catch (error) {
      logger.error('Error soft deleting proposal:', { error: error instanceof Error ? error : new Error(String(error)) });
      throw error;
    }
  }

  // ===================================================
  // RESTORE OPERATIONS
  // ===================================================

  /**
   * Restore a soft-deleted entity
   * Note: Does NOT restore child entities that were cascade-deleted
   */
  async restore(entityType: SoftDeleteEntityType, entityId: number): Promise<SoftDeleteResult> {
    const db = getDatabase();
    const table = TABLE_MAP[entityType];

    try {
      // Verify entity exists and is deleted
      const entity = await db.get(
        `SELECT id, deleted_at FROM ${table} WHERE id = ? AND deleted_at IS NOT NULL`,
        [entityId]
      );

      if (!entity) {
        return { success: false, message: `${entityType} not found or not deleted` };
      }

      // For invoices, we need to handle the voided status
      if (entityType === 'invoice') {
        // Get the invoice to check if we need to update status
        const invoice = await db.get(
          'SELECT id, status FROM invoices WHERE id = ?',
          [entityId]
        ) as { id: number; status: string } | undefined;

        // If it was voided as part of deletion, set to draft
        if (invoice && invoice.status === 'voided') {
          await db.run(
            'UPDATE invoices SET status = \'draft\', deleted_at = NULL, deleted_by = NULL WHERE id = ?',
            [entityId]
          );
        } else {
          await db.run(
            'UPDATE invoices SET deleted_at = NULL, deleted_by = NULL WHERE id = ?',
            [entityId]
          );
        }
      } else {
        await db.run(
          `UPDATE ${table} SET deleted_at = NULL, deleted_by = NULL WHERE id = ?`,
          [entityId]
        );
      }

      await auditLogger.log({
        action: `${entityType}_restored`,
        entityType,
        entityId: String(entityId),
        entityName: `${entityType} #${entityId}`,
        userId: 0,
        userEmail: 'admin',
        userType: 'admin',
        metadata: {},
        ipAddress: 'system',
        userAgent: 'soft-delete-service'
      });

      logger.info(`Restored ${entityType} ${entityId}`);

      return {
        success: true,
        message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} restored successfully. Note: Related items that were deleted may need to be restored separately.`
      };
    } catch (error) {
      logger.error(`Error restoring ${entityType}:`, { error: error instanceof Error ? error : new Error(String(error)) });
      throw error;
    }
  }

  // ===================================================
  // QUERY DELETED ITEMS
  // ===================================================

  /**
   * Get all deleted items with days until permanent deletion
   */
  async getDeletedItems(entityType?: SoftDeleteEntityType): Promise<DeletedItem[]> {
    const db = getDatabase();
    const items: DeletedItem[] = [];

    const types = entityType ? [entityType] : ['client', 'project', 'invoice', 'lead', 'proposal'] as SoftDeleteEntityType[];

    for (const type of types) {
      const table = TABLE_MAP[type];
      let nameColumn: string;

      // Determine the name column for each entity type
      switch (type) {
      case 'client':
        nameColumn = 'COALESCE(company_name, contact_name, email, \'Unknown Client\')';
        break;
      case 'project':
        nameColumn = 'COALESCE(project_name, \'Unnamed Project\')';
        break;
      case 'invoice':
        nameColumn = 'COALESCE(invoice_number, \'Unknown Invoice\')';
        break;
      case 'lead':
        nameColumn = 'COALESCE(company_name, contact_name, contact_email, \'Unknown Lead\')';
        break;
      case 'proposal':
        nameColumn = 'COALESCE(title, \'Unnamed Proposal\')';
        break;
      default:
        nameColumn = '\'Unknown\'';
      }

      const rows = await db.all(
        `SELECT
          id,
          ${nameColumn} as name,
          deleted_at,
          deleted_by,
          CAST(julianday(datetime(deleted_at, '+${RETENTION_DAYS} days')) - julianday('now') AS INTEGER) as days_remaining
         FROM ${table}
         WHERE deleted_at IS NOT NULL
         ORDER BY deleted_at DESC`
      ) as { id: number; name: string; deleted_at: string; deleted_by: string; days_remaining: number }[];

      for (const row of rows) {
        items.push({
          id: row.id,
          entityType: type,
          name: row.name,
          deletedAt: row.deleted_at,
          deletedBy: row.deleted_by || 'system',
          daysUntilPermanent: Math.max(0, row.days_remaining),
          canRestore: row.days_remaining > 0
        });
      }
    }

    // Sort by deletion date (most recent first)
    items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

    return items;
  }

  /**
   * Get counts of deleted items by entity type
   */
  async getDeletedItemStats(): Promise<DeletedItemStats> {
    const db = getDatabase();

    const stats: DeletedItemStats = {
      clients: 0,
      projects: 0,
      invoices: 0,
      leads: 0,
      proposals: 0,
      total: 0
    };

    // Count each type
    const clientCount = await db.get(
      'SELECT COUNT(*) as count FROM clients WHERE deleted_at IS NOT NULL'
    ) as { count: number };
    stats.clients = clientCount.count;

    const projectCount = await db.get(
      'SELECT COUNT(*) as count FROM projects WHERE deleted_at IS NOT NULL'
    ) as { count: number };
    stats.projects = projectCount.count;

    const invoiceCount = await db.get(
      'SELECT COUNT(*) as count FROM invoices WHERE deleted_at IS NOT NULL'
    ) as { count: number };
    stats.invoices = invoiceCount.count;

    // Leads are now projects with pending/new status (since migration 086)
    const leadCount = await db.get(
      `SELECT COUNT(*) as count FROM projects
       WHERE status IN ('pending', 'new') AND deleted_at IS NOT NULL`
    ) as { count: number };
    stats.leads = leadCount.count;

    const proposalCount = await db.get(
      'SELECT COUNT(*) as count FROM proposal_requests WHERE deleted_at IS NOT NULL'
    ) as { count: number };
    stats.proposals = proposalCount.count;

    stats.total = stats.clients + stats.projects + stats.invoices + stats.leads + stats.proposals;

    return stats;
  }

  // ===================================================
  // PERMANENT DELETE (CLEANUP)
  // ===================================================

  /**
   * Permanently delete items older than retention period
   * Called by scheduler service daily
   */
  async permanentlyDeleteExpired(retentionDays: number = RETENTION_DAYS): Promise<{
    deleted: DeletedItemStats;
    errors: string[];
  }> {
    const db = getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateStr = cutoffDate.toISOString();

    const deleted: DeletedItemStats = {
      clients: 0,
      projects: 0,
      invoices: 0,
      leads: 0,
      proposals: 0,
      total: 0
    };
    const errors: string[] = [];

    try {
      // Delete in order to respect foreign key constraints:
      // 1. Proposal items (if any child tables exist)
      // 2. Proposals
      // 3. Invoice items
      // 4. Invoices
      // 5. Project children (milestones, tasks, files, etc.)
      // 6. Projects
      // 7. Leads
      // 8. Client children (contacts, activities, notes, etc.)
      // 9. Clients

      // 1. Delete proposal items (proposal_items table)
      await db.run(
        `DELETE FROM proposal_items
         WHERE proposal_id IN (
           SELECT id FROM proposal_requests
           WHERE deleted_at IS NOT NULL AND deleted_at < ?
         )`,
        [cutoffDateStr]
      );

      // 2. Delete proposals
      const proposalResult = await db.run(
        'DELETE FROM proposal_requests WHERE deleted_at IS NOT NULL AND deleted_at < ?',
        [cutoffDateStr]
      );
      deleted.proposals = proposalResult.changes || 0;

      // 3. Delete invoice items
      await db.run(
        `DELETE FROM invoice_items
         WHERE invoice_id IN (
           SELECT id FROM invoices
           WHERE deleted_at IS NOT NULL AND deleted_at < ?
         )`,
        [cutoffDateStr]
      );

      // 4. Delete invoices
      const invoiceResult = await db.run(
        'DELETE FROM invoices WHERE deleted_at IS NOT NULL AND deleted_at < ?',
        [cutoffDateStr]
      );
      deleted.invoices = invoiceResult.changes || 0;

      // 5. Delete project children
      // Milestones
      await db.run(
        `DELETE FROM project_milestones
         WHERE project_id IN (
           SELECT id FROM projects
           WHERE deleted_at IS NOT NULL AND deleted_at < ?
         )`,
        [cutoffDateStr]
      );

      // Tasks
      await db.run(
        `DELETE FROM project_tasks
         WHERE project_id IN (
           SELECT id FROM projects
           WHERE deleted_at IS NOT NULL AND deleted_at < ?
         )`,
        [cutoffDateStr]
      );

      // Messages
      await db.run(
        `DELETE FROM messages
         WHERE project_id IN (
           SELECT id FROM projects
           WHERE deleted_at IS NOT NULL AND deleted_at < ?
         )`,
        [cutoffDateStr]
      );

      // Files
      await db.run(
        `DELETE FROM files
         WHERE project_id IN (
           SELECT id FROM projects
           WHERE deleted_at IS NOT NULL AND deleted_at < ?
         )`,
        [cutoffDateStr]
      );

      // 6. Delete projects
      const projectResult = await db.run(
        'DELETE FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < ?',
        [cutoffDateStr]
      );
      deleted.projects = projectResult.changes || 0;

      // 7. Delete leads (leads are projects with pending/new status - since migration 086)
      // Note: Lead deletion is handled by the projects deletion above
      // Count leads separately for reporting
      const leadCount = await db.get(
        `SELECT COUNT(*) as count FROM projects
         WHERE status IN ('pending', 'new')
         AND deleted_at IS NOT NULL AND deleted_at < ?`,
        [cutoffDateStr]
      ) as { count: number };
      deleted.leads = leadCount.count;
      // Note: Actual deletion happens in step 6 (projects deletion)

      // 8. Delete client children
      // Contacts
      await db.run(
        `DELETE FROM client_contacts
         WHERE client_id IN (
           SELECT id FROM clients
           WHERE deleted_at IS NOT NULL AND deleted_at < ?
         )`,
        [cutoffDateStr]
      );

      // Activities
      await db.run(
        `DELETE FROM client_activities
         WHERE client_id IN (
           SELECT id FROM clients
           WHERE deleted_at IS NOT NULL AND deleted_at < ?
         )`,
        [cutoffDateStr]
      );

      // Notes
      await db.run(
        `DELETE FROM client_notes
         WHERE client_id IN (
           SELECT id FROM clients
           WHERE deleted_at IS NOT NULL AND deleted_at < ?
         )`,
        [cutoffDateStr]
      );

      // Tags
      await db.run(
        `DELETE FROM client_tags
         WHERE client_id IN (
           SELECT id FROM clients
           WHERE deleted_at IS NOT NULL AND deleted_at < ?
         )`,
        [cutoffDateStr]
      );

      // Custom field values
      await db.run(
        `DELETE FROM client_custom_field_values
         WHERE client_id IN (
           SELECT id FROM clients
           WHERE deleted_at IS NOT NULL AND deleted_at < ?
         )`,
        [cutoffDateStr]
      );

      // 9. Delete clients
      const clientResult = await db.run(
        'DELETE FROM clients WHERE deleted_at IS NOT NULL AND deleted_at < ?',
        [cutoffDateStr]
      );
      deleted.clients = clientResult.changes || 0;

      deleted.total = deleted.clients + deleted.projects + deleted.invoices + deleted.leads + deleted.proposals;

      if (deleted.total > 0) {
        await auditLogger.log({
          action: 'permanent_delete_cleanup',
          entityType: 'system',
          entityId: 'cleanup',
          entityName: 'Soft Delete Cleanup',
          userId: 0,
          userEmail: 'system',
          userType: 'admin',
          metadata: { retentionDays, deleted },
          ipAddress: 'system',
          userAgent: 'scheduler-service'
        });

        logger.info(`Permanently deleted ${deleted.total} items (${deleted.clients} clients, ${deleted.projects} projects, ${deleted.invoices} invoices, ${deleted.leads} leads, ${deleted.proposals} proposals)`);
      }

      return { deleted, errors };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(errorMsg);
      logger.error('Error in permanent delete cleanup:', { error: error instanceof Error ? error : new Error(String(error)) });
      return { deleted, errors };
    }
  }

  /**
   * Force permanent delete a specific item (admin only)
   */
  async forceDelete(entityType: SoftDeleteEntityType, entityId: number): Promise<SoftDeleteResult> {
    const db = getDatabase();
    const table = TABLE_MAP[entityType];

    try {
      // First verify the item exists
      const entity = await db.get(
        `SELECT id, deleted_at FROM ${table} WHERE id = ?`,
        [entityId]
      );

      if (!entity) {
        return { success: false, message: `${entityType} not found` };
      }

      // For clients and projects, we need to handle child records first
      if (entityType === 'client') {
        // Delete all client children
        await db.run('DELETE FROM client_contacts WHERE client_id = ?', [entityId]);
        await db.run('DELETE FROM client_activities WHERE client_id = ?', [entityId]);
        await db.run('DELETE FROM client_notes WHERE client_id = ?', [entityId]);
        await db.run('DELETE FROM client_tags WHERE client_id = ?', [entityId]);
        await db.run('DELETE FROM client_custom_field_values WHERE client_id = ?', [entityId]);

        // Delete related proposals
        await db.run(
          'DELETE FROM proposal_items WHERE proposal_id IN (SELECT id FROM proposal_requests WHERE client_id = ?)',
          [entityId]
        );
        await db.run('DELETE FROM proposal_requests WHERE client_id = ?', [entityId]);

        // Delete related invoices (items first)
        await db.run(
          'DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE client_id = ?)',
          [entityId]
        );
        await db.run('DELETE FROM invoices WHERE client_id = ?', [entityId]);

        // Delete related projects and their children
        const projects = await db.all('SELECT id FROM projects WHERE client_id = ?', [entityId]) as { id: number }[];
        for (const project of projects) {
          await db.run('DELETE FROM project_milestones WHERE project_id = ?', [project.id]);
          await db.run('DELETE FROM project_tasks WHERE project_id = ?', [project.id]);
          await db.run('DELETE FROM messages WHERE project_id = ?', [project.id]);
          await db.run('DELETE FROM files WHERE project_id = ?', [project.id]);
        }
        await db.run('DELETE FROM projects WHERE client_id = ?', [entityId]);
      } else if (entityType === 'project') {
        // Delete all project children
        await db.run('DELETE FROM project_milestones WHERE project_id = ?', [entityId]);
        await db.run('DELETE FROM project_tasks WHERE project_id = ?', [entityId]);
        await db.run('DELETE FROM messages WHERE project_id = ?', [entityId]);
        await db.run('DELETE FROM files WHERE project_id = ?', [entityId]);
        await db.run(
          'DELETE FROM proposal_items WHERE proposal_id IN (SELECT id FROM proposal_requests WHERE project_id = ?)',
          [entityId]
        );
        await db.run('DELETE FROM proposal_requests WHERE project_id = ?', [entityId]);
      } else if (entityType === 'invoice') {
        await db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [entityId]);
      } else if (entityType === 'proposal') {
        await db.run('DELETE FROM proposal_items WHERE proposal_id = ?', [entityId]);
      }

      // Finally delete the entity itself
      await db.run(`DELETE FROM ${table} WHERE id = ?`, [entityId]);

      await auditLogger.log({
        action: `${entityType}_force_deleted`,
        entityType,
        entityId: String(entityId),
        entityName: `${entityType} #${entityId}`,
        userId: 0,
        userEmail: 'admin',
        userType: 'admin',
        metadata: {},
        ipAddress: 'system',
        userAgent: 'soft-delete-service'
      });

      logger.info(`Force deleted ${entityType} ${entityId}`);

      return {
        success: true,
        message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} permanently deleted.`
      };
    } catch (error) {
      logger.error(`Error force deleting ${entityType}:`, { error: error instanceof Error ? error : new Error(String(error)) });
      throw error;
    }
  }
}

// Export singleton instance
export const softDeleteService = new SoftDeleteService();
export default softDeleteService;
