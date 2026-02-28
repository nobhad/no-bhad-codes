import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { emailService } from '../../services/email-service.js';
import { softDeleteService, SoftDeleteEntityType } from '../../services/soft-delete-service.js';
import { errorResponse, errorResponseWithPayload } from '../../utils/api-response.js';
import { getDatabase } from '../../database/init.js';

const router = express.Router();

/**
 * POST /api/admin/test-email - Send a test email to admin
 */
router.post(
  '/test-email',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const adminEmail = process.env.ADMIN_EMAIL || req.user?.email;
    if (!adminEmail) {
      return errorResponse(
        res,
        'Admin email not configured. Set ADMIN_EMAIL in environment.',
        400,
        'ADMIN_EMAIL_NOT_CONFIGURED'
      );
    }

    const result = await emailService.sendEmail({
      to: adminEmail,
      subject: 'No Bhad Codes - Test Email',
      text: 'This is a test email from the admin dashboard. Email service is working correctly.',
      html: '<p>This is a test email from the admin dashboard.</p><p>Email service is working correctly.</p>',
    });

    if (!result.success) {
      return errorResponse(
        res,
        result.message || 'Failed to send test email',
        500,
        'TEST_EMAIL_FAILED'
      );
    }

    res.json({
      success: true,
      message: 'Test email sent successfully',
      to: adminEmail,
    });
  })
);

// ============================================
// DELETED ITEMS MANAGEMENT (30-DAY RECOVERY)
// ============================================

/**
 * GET /api/admin/deleted-items - List all soft-deleted items
 * Optional query param: type (client, project, invoice, lead, proposal)
 */
router.get(
  '/deleted-items',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const typeParam = req.query.type as string | undefined;
    const entityType = typeParam as SoftDeleteEntityType | undefined;

    // Validate entity type if provided
    const validTypes: SoftDeleteEntityType[] = ['client', 'project', 'invoice', 'lead', 'proposal'];
    if (entityType && !validTypes.includes(entityType)) {
      return errorResponseWithPayload(res, 'Invalid entity type', 400, 'INVALID_TYPE', {
        validTypes,
      });
    }

    const [items, stats] = await Promise.all([
      softDeleteService.getDeletedItems(entityType),
      softDeleteService.getDeletedItemStats(),
    ]);

    // Transform to match frontend expected format
    // Frontend expects id to be "type-originalId" format for routing
    const transformedItems = items.map((item) => {
      // Calculate expiresAt from daysUntilPermanent
      const expiresAt = new Date(Date.now() + item.daysUntilPermanent * 24 * 60 * 60 * 1000).toISOString();
      return {
        id: `${item.entityType}-${item.id}`,
        type: item.entityType,
        name: item.name,
        description: '',
        deletedBy: item.deletedBy || 'Unknown',
        deletedAt: item.deletedAt,
        expiresAt,
        originalId: String(item.id),
      };
    });

    res.json({ items: transformedItems, stats });
  })
);

/**
 * GET /api/admin/deleted-items/stats - Get counts by entity type
 */
router.get(
  '/deleted-items/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const stats = await softDeleteService.getDeletedItemStats();
    res.json(stats);
  })
);

/**
 * DELETE /api/admin/deleted-items/empty - Empty trash (permanently delete all expired items)
 * IMPORTANT: This route must come BEFORE /:itemId routes
 */
router.delete(
  '/deleted-items/empty',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const { deleted, errors } = await softDeleteService.permanentlyDeleteExpired();

    res.json({
      success: errors.length === 0,
      message: `Trash emptied. Permanently deleted ${deleted.total} items.`,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
    });
  })
);

/**
 * POST /api/admin/deleted-items/cleanup - Manually trigger cleanup of expired items
 * Items older than 30 days will be permanently deleted
 */
router.post(
  '/deleted-items/cleanup',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const { deleted, errors } = await softDeleteService.permanentlyDeleteExpired();

    res.json({
      success: errors.length === 0,
      message: `Cleanup complete. Permanently deleted ${deleted.total} items.`,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
    });
  })
);

/**
 * POST /api/admin/deleted-items/bulk-restore - Bulk restore soft-deleted items
 * itemIds format: ["type-id", "type-id", ...] (e.g., ["client-123", "project-456"])
 */
router.post(
  '/deleted-items/bulk-restore',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { itemIds } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return errorResponse(res, 'itemIds array is required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const validTypes: SoftDeleteEntityType[] = ['client', 'project', 'invoice', 'lead', 'proposal'];
    let restored = 0;
    const errors: string[] = [];

    for (const itemId of itemIds) {
      const parts = (itemId as string).split('-');
      if (parts.length < 2) {
        errors.push(`Invalid item ID format: ${itemId}`);
        continue;
      }

      const entityType = parts[0] as SoftDeleteEntityType;
      const entityId = parseInt(parts.slice(1).join('-'), 10);

      if (!validTypes.includes(entityType)) {
        errors.push(`Invalid entity type: ${entityType}`);
        continue;
      }

      if (isNaN(entityId) || entityId <= 0) {
        errors.push(`Invalid entity ID: ${itemId}`);
        continue;
      }

      const result = await softDeleteService.restore(entityType, entityId);
      if (result.success) {
        restored++;
      } else {
        errors.push(`Failed to restore ${itemId}: ${result.message}`);
      }
    }

    res.json({
      success: errors.length === 0,
      restored,
      errors: errors.length > 0 ? errors : undefined,
    });
  })
);

/**
 * POST /api/admin/deleted-items/bulk-delete - Bulk permanently delete items
 * itemIds format: ["type-id", "type-id", ...] (e.g., ["client-123", "project-456"])
 */
router.post(
  '/deleted-items/bulk-delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { itemIds } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return errorResponse(res, 'itemIds array is required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const validTypes: SoftDeleteEntityType[] = ['client', 'project', 'invoice', 'lead', 'proposal'];
    let deleted = 0;
    const errors: string[] = [];

    for (const itemId of itemIds) {
      const parts = (itemId as string).split('-');
      if (parts.length < 2) {
        errors.push(`Invalid item ID format: ${itemId}`);
        continue;
      }

      const entityType = parts[0] as SoftDeleteEntityType;
      const entityId = parseInt(parts.slice(1).join('-'), 10);

      if (!validTypes.includes(entityType)) {
        errors.push(`Invalid entity type: ${entityType}`);
        continue;
      }

      if (isNaN(entityId) || entityId <= 0) {
        errors.push(`Invalid entity ID: ${itemId}`);
        continue;
      }

      const result = await softDeleteService.forceDelete(entityType, entityId);
      if (result.success) {
        deleted++;
      } else {
        errors.push(`Failed to delete ${itemId}: ${result.message}`);
      }
    }

    res.json({
      success: errors.length === 0,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
    });
  })
);

/**
 * POST /api/admin/deleted-items/:itemId/restore - Restore a soft-deleted item
 * itemId format: "type-id" (e.g., "client-123")
 */
router.post(
  '/deleted-items/:itemId/restore',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { itemId } = req.params;

    // Parse the composite ID (format: "type-id")
    const parts = itemId.split('-');
    if (parts.length < 2) {
      return errorResponse(res, 'Invalid item ID format', 400, 'INVALID_ID');
    }

    const entityType = parts[0] as SoftDeleteEntityType;
    const entityId = parseInt(parts.slice(1).join('-'), 10);

    // Validate entity type
    const validTypes: SoftDeleteEntityType[] = ['client', 'project', 'invoice', 'lead', 'proposal'];
    if (!validTypes.includes(entityType)) {
      return errorResponseWithPayload(res, 'Invalid entity type', 400, 'INVALID_TYPE', {
        validTypes,
      });
    }

    if (isNaN(entityId) || entityId <= 0) {
      return errorResponse(res, 'Invalid entity ID', 400, 'INVALID_ID');
    }

    const result = await softDeleteService.restore(entityType, entityId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
      });
    } else {
      errorResponse(res, result.message, 400, 'RESTORE_FAILED');
    }
  })
);

/**
 * DELETE /api/admin/deleted-items/:itemId - Permanently delete an item
 * itemId format: "type-id" (e.g., "client-123")
 */
router.delete(
  '/deleted-items/:itemId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { itemId } = req.params;

    // Parse the composite ID (format: "type-id")
    const parts = itemId.split('-');
    if (parts.length < 2) {
      return errorResponse(res, 'Invalid item ID format', 400, 'INVALID_ID');
    }

    const entityType = parts[0] as SoftDeleteEntityType;
    const entityId = parseInt(parts.slice(1).join('-'), 10);

    // Validate entity type
    const validTypes: SoftDeleteEntityType[] = ['client', 'project', 'invoice', 'lead', 'proposal'];
    if (!validTypes.includes(entityType)) {
      return errorResponseWithPayload(res, 'Invalid entity type', 400, 'INVALID_TYPE', {
        validTypes,
      });
    }

    if (isNaN(entityId) || entityId <= 0) {
      return errorResponse(res, 'Invalid entity ID', 400, 'INVALID_ID');
    }

    const result = await softDeleteService.forceDelete(entityType, entityId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
      });
    } else {
      errorResponse(res, result.message, 400, 'DELETE_FAILED');
    }
  })
);

// =====================================================
// CLIENTS MANAGEMENT
// =====================================================

/**
 * GET /api/admin/clients - List all clients
 */
router.get(
  '/clients',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    const clients = await db.all(`
      SELECT
        c.id,
        c.company_name as companyName,
        c.contact_name as contactName,
        c.email,
        c.phone,
        c.status,
        c.client_type as clientType,
        c.created_at as createdAt,
        c.updated_at as updatedAt,
        (SELECT COUNT(*) FROM projects WHERE client_id = c.id AND deleted_at IS NULL) as projectCount,
        (SELECT COUNT(*) FROM invoices WHERE client_id = c.id AND deleted_at IS NULL) as invoiceCount
      FROM clients c
      WHERE c.deleted_at IS NULL
      ORDER BY c.created_at DESC
    `);

    const stats = {
      total: clients.length,
      active: clients.filter((c: { status: string }) => c.status === 'active').length,
      pending: clients.filter((c: { status: string }) => c.status === 'pending').length,
      inactive: clients.filter((c: { status: string }) => c.status === 'inactive').length,
    };

    res.json({ clients, stats });
  })
);

// =====================================================
// CONTACTS MANAGEMENT
// =====================================================

/**
 * GET /api/admin/contacts - List all contacts across all clients
 */
router.get(
  '/contacts',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    // Get all contacts with client info
    const contacts = await db.all(`
      SELECT
        cc.id,
        cc.first_name as firstName,
        cc.last_name as lastName,
        cc.email,
        cc.phone,
        cc.role,
        cc.is_primary as isPrimary,
        CASE WHEN cc.is_primary = 1 THEN 'active' ELSE 'active' END as status,
        cc.client_id as clientId,
        c.company_name as company,
        c.company_name as clientName,
        cc.created_at as createdAt,
        cc.updated_at as updatedAt
      FROM client_contacts cc
      JOIN clients c ON cc.client_id = c.id
      WHERE c.deleted_at IS NULL
      ORDER BY cc.is_primary DESC, cc.created_at DESC
    `);

    // Calculate stats
    const stats = {
      total: contacts.length,
      active: contacts.length,
      primary: contacts.filter((c: { isPrimary: number }) => c.isPrimary === 1).length,
      withCompany: contacts.filter((c: { company: string | null }) => c.company).length,
    };

    // Transform isPrimary from 0/1 to boolean
    const transformedContacts = contacts.map((c: Record<string, unknown>) => ({
      ...c,
      isPrimary: c.isPrimary === 1,
    }));

    res.json({ contacts: transformedContacts, stats });
  })
);

/**
 * PATCH /api/admin/contacts/:contactId - Update a contact
 */
router.patch(
  '/contacts/:contactId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const contactId = parseInt(req.params.contactId);
    const { isPrimary, firstName, lastName, email, phone, role } = req.body;

    if (isNaN(contactId)) {
      return errorResponse(res, 'Invalid contact ID', 400, 'INVALID_ID');
    }

    const db = getDatabase();

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (isPrimary !== undefined) {
      // If setting as primary, first unset other primaries for this client
      if (isPrimary) {
        const contact = await db.get('SELECT client_id FROM client_contacts WHERE id = ?', [contactId]);
        if (contact) {
          await db.run('UPDATE client_contacts SET is_primary = 0 WHERE client_id = ?', [contact.client_id]);
        }
      }
      updates.push('is_primary = ?');
      values.push(isPrimary ? 1 : 0);
    }
    if (firstName !== undefined) {
      updates.push('first_name = ?');
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(lastName);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }

    if (updates.length === 0) {
      return errorResponse(res, 'No fields to update', 400, 'NO_FIELDS');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(contactId);

    await db.run(
      `UPDATE client_contacts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updatedContact = await db.get(
      'SELECT * FROM client_contacts WHERE id = ?',
      [contactId]
    );

    res.json({ success: true, contact: updatedContact });
  })
);

/**
 * POST /api/admin/contacts/bulk-delete - Bulk delete contacts
 */
router.post(
  '/contacts/bulk-delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { contactIds } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return errorResponse(res, 'contactIds array is required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const db = getDatabase();
    let deleted = 0;

    for (const contactId of contactIds) {
      const id = typeof contactId === 'string' ? parseInt(contactId, 10) : contactId;
      if (isNaN(id)) continue;

      const result = await db.run('DELETE FROM client_contacts WHERE id = ?', [id]);
      if (result.changes && result.changes > 0) {
        deleted++;
      }
    }

    res.json({ success: true, deleted });
  })
);

// =====================================================
// GLOBAL TASKS MANAGEMENT
// =====================================================

/**
 * POST /api/admin/tasks/bulk-delete - Bulk delete tasks
 */
router.post(
  '/tasks/bulk-delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return errorResponse(res, 'taskIds array is required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const db = getDatabase();
    let deleted = 0;

    for (const taskId of taskIds) {
      const id = typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;
      if (isNaN(id)) continue;

      const result = await db.run('DELETE FROM project_tasks WHERE id = ?', [id]);
      if (result.changes && result.changes > 0) {
        deleted++;
      }
    }

    res.json({ success: true, deleted });
  })
);

/**
 * PUT /api/admin/tasks/:taskId - Update a task
 */
router.put(
  '/tasks/:taskId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    const { title, description, status, priority, dueDate, assignedTo } = req.body;

    if (isNaN(taskId)) {
      return errorResponse(res, 'Invalid task ID', 400, 'INVALID_ID');
    }

    const db = getDatabase();

    // Build update query dynamically with whitelisted columns
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
    }
    if (dueDate !== undefined) {
      updates.push('due_date = ?');
      values.push(dueDate);
    }
    if (assignedTo !== undefined) {
      updates.push('assigned_to = ?');
      values.push(assignedTo);
    }

    if (updates.length === 0) {
      return errorResponse(res, 'No fields to update', 400, 'NO_FIELDS');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(taskId);

    await db.run(
      `UPDATE project_tasks SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updatedTask = await db.get('SELECT * FROM project_tasks WHERE id = ?', [taskId]);

    res.json({ success: true, task: updatedTask });
  })
);

// =====================================================
// FILES MANAGEMENT
// =====================================================

/**
 * GET /api/admin/files - List all files
 */
router.get(
  '/files',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();
    const { projectId, type } = req.query;

    let query = `
      SELECT
        f.id,
        f.filename,
        f.original_filename as originalFilename,
        f.file_path as filePath,
        f.file_size as fileSize,
        f.mime_type as mimeType,
        f.file_type as fileType,
        f.description,
        f.uploaded_by as uploadedBy,
        f.project_id as projectId,
        f.created_at as createdAt,
        p.project_name as projectName
      FROM files f
      LEFT JOIN projects p ON f.project_id = p.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (projectId) {
      query += ' AND f.project_id = ?';
      params.push(parseInt(projectId as string, 10));
    }
    if (type) {
      query += ' AND f.file_type = ?';
      params.push(type as string);
    }

    query += ' ORDER BY f.created_at DESC';

    const files = await db.all(query, params);

    const stats = {
      total: files.length,
      totalSize: files.reduce((sum: number, f: { fileSize: number }) => sum + (f.fileSize || 0), 0),
    };

    res.json({ files, stats });
  })
);

/**
 * DELETE /api/admin/files/:fileId - Delete a file
 */
router.delete(
  '/files/:fileId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.fileId);

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_ID');
    }

    const db = getDatabase();

    // Check if file exists
    const file = await db.get('SELECT * FROM files WHERE id = ?', [fileId]);
    if (!file) {
      return errorResponse(res, 'File not found', 404, 'NOT_FOUND');
    }

    // Delete from database (file system cleanup can be handled separately)
    await db.run('DELETE FROM files WHERE id = ?', [fileId]);

    res.json({ success: true, message: 'File deleted' });
  })
);

// =====================================================
// DELIVERABLES MANAGEMENT
// =====================================================

/**
 * GET /api/admin/deliverables - List all deliverables
 */
router.get(
  '/deliverables',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();
    const { projectId, status } = req.query;

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
        c.company_name as clientName
      FROM deliverables d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.deleted_at IS NULL
    `;
    const params: (string | number)[] = [];

    if (projectId) {
      query += ' AND d.project_id = ?';
      params.push(parseInt(projectId as string, 10));
    }
    if (status) {
      query += ' AND d.status = ?';
      params.push(status as string);
    }

    query += ' ORDER BY d.due_date ASC, d.created_at DESC';

    const deliverables = await db.all(query, params);

    const stats = {
      total: deliverables.length,
      pending: deliverables.filter((d: { status: string }) => d.status === 'pending').length,
      inProgress: deliverables.filter((d: { status: string }) => d.status === 'in_progress').length,
      completed: deliverables.filter((d: { status: string }) => d.status === 'completed').length,
      approved: deliverables.filter((d: { status: string }) => d.status === 'approved').length,
    };

    res.json({ deliverables, stats });
  })
);

/**
 * POST /api/admin/deliverables/bulk-delete - Bulk delete deliverables
 */
router.post(
  '/deliverables/bulk-delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { deliverableIds } = req.body;

    if (!deliverableIds || !Array.isArray(deliverableIds) || deliverableIds.length === 0) {
      return errorResponse(res, 'deliverableIds array is required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const db = getDatabase();
    let deleted = 0;

    for (const deliverableId of deliverableIds) {
      const id = typeof deliverableId === 'string' ? parseInt(deliverableId, 10) : deliverableId;
      if (isNaN(id)) continue;

      const result = await db.run('DELETE FROM deliverables WHERE id = ?', [id]);
      if (result.changes && result.changes > 0) {
        deleted++;
      }
    }

    res.json({ success: true, deleted });
  })
);

// =====================================================
// PROPOSALS MANAGEMENT
// =====================================================

/**
 * POST /api/admin/proposals/bulk-delete - Bulk delete proposals
 */
router.post(
  '/proposals/bulk-delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { proposalIds } = req.body;

    if (!proposalIds || !Array.isArray(proposalIds) || proposalIds.length === 0) {
      return errorResponse(res, 'proposalIds array is required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const db = getDatabase();
    let deleted = 0;

    for (const proposalId of proposalIds) {
      const id = typeof proposalId === 'string' ? parseInt(proposalId, 10) : proposalId;
      if (isNaN(id)) continue;

      // Soft delete proposal
      const result = await db.run(
        "UPDATE proposals SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
        [id]
      );
      if (result.changes && result.changes > 0) {
        deleted++;
      }
    }

    res.json({ success: true, deleted });
  })
);

// =====================================================
// ANALYTICS
// =====================================================

/**
 * GET /api/admin/analytics - Get analytics data
 */
router.get(
  '/analytics',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();
    const { range = '30d' } = req.query;

    // Calculate date range
    let daysBack = 30;
    if (range === '7d') daysBack = 7;
    else if (range === '90d') daysBack = 90;
    else if (range === '1y') daysBack = 365;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get revenue data
    const revenueData = await db.all(`
      SELECT
        DATE(paid_at) as date,
        SUM(total) as revenue,
        COUNT(*) as invoiceCount
      FROM invoices
      WHERE status = 'paid' AND paid_at >= ?
      GROUP BY DATE(paid_at)
      ORDER BY date ASC
    `, [startDateStr]);

    // Get project data
    const projectData = await db.all(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as projectCount
      FROM projects
      WHERE created_at >= ? AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [startDateStr]);

    // Get client data
    const clientData = await db.all(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as clientCount
      FROM clients
      WHERE created_at >= ? AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [startDateStr]);

    // Get summary stats
    const summary = await db.get(`
      SELECT
        (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status = 'paid' AND paid_at >= ?) as totalRevenue,
        (SELECT COUNT(*) FROM projects WHERE created_at >= ? AND deleted_at IS NULL) as newProjects,
        (SELECT COUNT(*) FROM clients WHERE created_at >= ? AND deleted_at IS NULL) as newClients,
        (SELECT COUNT(*) FROM invoices WHERE status = 'paid' AND paid_at >= ?) as paidInvoices
    `, [startDateStr, startDateStr, startDateStr, startDateStr]);

    res.json({
      range,
      summary,
      revenue: revenueData,
      projects: projectData,
      clients: clientData,
    });
  })
);

export default router;
