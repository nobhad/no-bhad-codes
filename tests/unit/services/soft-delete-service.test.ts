/**
 * ===============================================
 * UNIT TESTS - SOFT DELETE SERVICE
 * ===============================================
 * @file tests/unit/services/soft-delete-service.test.ts
 *
 * Tests for soft delete service including:
 * - Client soft delete (cascade)
 * - Project soft delete (cascade)
 * - Invoice soft delete (paid block)
 * - Lead soft delete
 * - Proposal soft delete
 * - Generic soft delete
 * - Bulk soft delete
 * - Restore operations
 * - Query deleted items
 * - Permanent delete cleanup
 * - Force delete
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn()
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb)
}));

vi.mock('../../../server/services/audit-logger', () => ({
  auditLogger: {
    log: vi.fn().mockResolvedValue(undefined),
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Import service after mocks
import { softDeleteService } from '../../../server/services/soft-delete-service';

// =====================================================
// HELPERS
// =====================================================

function makeRunResult(changes = 0) {
  return { changes, lastID: 0 };
}

// =====================================================
// CLIENT SOFT DELETE
// =====================================================

describe('SoftDeleteService - softDeleteClient', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    mockDb.run.mockResolvedValue(makeRunResult());
  });

  it('returns failure when client not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const result = await softDeleteService.softDeleteClient(99, 'admin@test.com');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Client not found or already deleted');
  });

  it('soft deletes a client with no projects', async () => {
    const mockClient = { id: 1, company_name: 'Acme Corp', contact_name: null, email: 'acme@test.com' };
    mockDb.get.mockResolvedValueOnce(mockClient);
    mockDb.all.mockResolvedValueOnce([]); // no projects
    mockDb.run.mockResolvedValue(makeRunResult(0));

    const result = await softDeleteService.softDeleteClient(1, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Acme Corp');
    expect(result.message).toContain('30 days');
    expect(result.affectedItems?.clients).toBe(1);
    expect(result.affectedItems?.projects).toBe(0);
  });

  it('soft deletes a client and cascades to projects and proposals', async () => {
    const mockClient = { id: 1, company_name: null, contact_name: 'Jane Doe', email: 'jane@test.com' };
    const mockProjects = [{ id: 10 }, { id: 11 }];

    mockDb.get.mockResolvedValueOnce(mockClient);
    mockDb.all.mockResolvedValueOnce(mockProjects);
    // proposalResult for project proposals
    mockDb.run.mockResolvedValueOnce(makeRunResult(3));
    // projects batch update
    mockDb.run.mockResolvedValueOnce(makeRunResult(2));
    // direct proposals
    mockDb.run.mockResolvedValueOnce(makeRunResult(1));
    // void invoices
    mockDb.run.mockResolvedValueOnce(makeRunResult(2));
    // client soft delete
    mockDb.run.mockResolvedValueOnce(makeRunResult(1));

    const result = await softDeleteService.softDeleteClient(1, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(result.affectedItems?.projects).toBe(2);
    expect(result.affectedItems?.proposals).toBe(4); // 3 + 1
    expect(result.affectedItems?.invoices).toBe(2);
    // Client update should be called (4 run calls minimum)
    expect(mockDb.run).toHaveBeenCalled();
  });

  it('uses contact_name when company_name is absent', async () => {
    const mockClient = { id: 2, company_name: null, contact_name: 'Bob Smith', email: 'bob@test.com' };
    mockDb.get.mockResolvedValueOnce(mockClient);
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.run.mockResolvedValue(makeRunResult(0));

    const result = await softDeleteService.softDeleteClient(2, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Bob Smith');
  });

  it('uses email when both company_name and contact_name are absent', async () => {
    const mockClient = { id: 3, company_name: null, contact_name: null, email: 'email@test.com' };
    mockDb.get.mockResolvedValueOnce(mockClient);
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.run.mockResolvedValue(makeRunResult(0));

    const result = await softDeleteService.softDeleteClient(3, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(result.message).toContain('email@test.com');
  });

  it('throws and logs on database error', async () => {
    mockDb.get.mockRejectedValueOnce(new Error('DB connection failed'));

    await expect(softDeleteService.softDeleteClient(1, 'admin@test.com')).rejects.toThrow('DB connection failed');
  });
});

// =====================================================
// PROJECT SOFT DELETE
// =====================================================

describe('SoftDeleteService - softDeleteProject', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    mockDb.run.mockResolvedValue(makeRunResult());
  });

  it('returns failure when project not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const result = await softDeleteService.softDeleteProject(99, 'admin@test.com');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Project not found or already deleted');
  });

  it('soft deletes a project and cascades to proposals', async () => {
    const mockProject = { id: 5, name: 'Website Redesign', client_id: 1 };
    mockDb.get.mockResolvedValueOnce(mockProject);
    mockDb.run.mockResolvedValueOnce(makeRunResult(2)); // proposals
    mockDb.run.mockResolvedValueOnce(makeRunResult(1)); // project

    const result = await softDeleteService.softDeleteProject(5, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Website Redesign');
    expect(result.affectedItems?.projects).toBe(1);
    expect(result.affectedItems?.proposals).toBe(2);
  });

  it('skips audit log when isChildDelete is true', async () => {
    const { auditLogger } = await import('../../../server/services/audit-logger');
    vi.mocked(auditLogger.log).mockClear();

    const mockProject = { id: 5, name: 'Child Project', client_id: 1 };
    mockDb.get.mockResolvedValueOnce(mockProject);
    mockDb.run.mockResolvedValue(makeRunResult(0));

    await softDeleteService.softDeleteProject(5, 'admin@test.com', true);

    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('logs audit when isChildDelete is false (default)', async () => {
    const { auditLogger } = await import('../../../server/services/audit-logger');
    vi.mocked(auditLogger.log).mockClear();

    const mockProject = { id: 6, name: 'Top-level Project', client_id: 2 };
    mockDb.get.mockResolvedValueOnce(mockProject);
    mockDb.run.mockResolvedValue(makeRunResult(0));

    await softDeleteService.softDeleteProject(6, 'admin@test.com');

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'project_deleted', entityId: '6' })
    );
  });

  it('throws and logs on database error', async () => {
    mockDb.get.mockRejectedValueOnce(new Error('Project DB error'));

    await expect(softDeleteService.softDeleteProject(1, 'admin@test.com')).rejects.toThrow('Project DB error');
  });
});

// =====================================================
// INVOICE SOFT DELETE
// =====================================================

describe('SoftDeleteService - softDeleteInvoice', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.run.mockReset();
    mockDb.run.mockResolvedValue(makeRunResult());
  });

  it('returns failure when invoice not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const result = await softDeleteService.softDeleteInvoice(99, 'admin@test.com');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invoice not found or already deleted');
  });

  it('blocks deletion of paid invoices', async () => {
    const mockInvoice = { id: 1, invoice_number: 'INV-001', status: 'paid', client_id: 1 };
    mockDb.get.mockResolvedValueOnce(mockInvoice);

    const result = await softDeleteService.softDeleteInvoice(1, 'admin@test.com');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Cannot delete paid invoices');
  });

  it('voids a draft invoice before soft deleting', async () => {
    const mockInvoice = { id: 2, invoice_number: 'INV-002', status: 'draft', client_id: 1 };
    mockDb.get.mockResolvedValueOnce(mockInvoice);

    const result = await softDeleteService.softDeleteInvoice(2, 'admin@test.com');

    expect(result.success).toBe(true);
    // Should call run twice: void + soft delete
    expect(mockDb.run).toHaveBeenCalledTimes(2);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('status = \'voided\''),
      expect.anything()
    );
  });

  it('skips void step if already voided', async () => {
    const mockInvoice = { id: 3, invoice_number: 'INV-003', status: 'voided', client_id: 1 };
    mockDb.get.mockResolvedValueOnce(mockInvoice);

    const result = await softDeleteService.softDeleteInvoice(3, 'admin@test.com');

    expect(result.success).toBe(true);
    // Should call run once: soft delete only (skip void)
    expect(mockDb.run).toHaveBeenCalledTimes(1);
  });

  it('skips void step if already cancelled', async () => {
    const mockInvoice = { id: 4, invoice_number: 'INV-004', status: 'cancelled', client_id: 1 };
    mockDb.get.mockResolvedValueOnce(mockInvoice);

    const result = await softDeleteService.softDeleteInvoice(4, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(mockDb.run).toHaveBeenCalledTimes(1);
  });

  it('returns correct affectedItems', async () => {
    const mockInvoice = { id: 5, invoice_number: 'INV-005', status: 'draft', client_id: 1 };
    mockDb.get.mockResolvedValueOnce(mockInvoice);

    const result = await softDeleteService.softDeleteInvoice(5, 'admin@test.com');

    expect(result.affectedItems).toEqual({ clients: 0, projects: 0, invoices: 1, proposals: 0 });
  });

  it('throws on database error', async () => {
    mockDb.get.mockRejectedValueOnce(new Error('Invoice DB error'));

    await expect(softDeleteService.softDeleteInvoice(1, 'admin@test.com')).rejects.toThrow('Invoice DB error');
  });
});

// =====================================================
// LEAD SOFT DELETE
// =====================================================

describe('SoftDeleteService - softDeleteLead', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.run.mockReset();
    mockDb.run.mockResolvedValue(makeRunResult());
  });

  it('returns failure when lead not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const result = await softDeleteService.softDeleteLead(99, 'admin@test.com');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Lead not found or already deleted');
  });

  it('soft deletes a lead using project_name', async () => {
    const mockLead = { id: 7, project_name: 'New Client Lead', company_name: null, contact_name: null, email: null };
    mockDb.get.mockResolvedValueOnce(mockLead);

    const result = await softDeleteService.softDeleteLead(7, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(result.message).toContain('New Client Lead');
  });

  it('falls back to company_name when project_name is missing', async () => {
    const mockLead = { id: 8, project_name: null, company_name: 'Big Corp', contact_name: null, email: null };
    mockDb.get.mockResolvedValueOnce(mockLead);

    const result = await softDeleteService.softDeleteLead(8, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Big Corp');
  });

  it('falls back to contact_name when project_name and company_name are missing', async () => {
    const mockLead = { id: 9, project_name: null, company_name: null, contact_name: 'Alice', email: null };
    mockDb.get.mockResolvedValueOnce(mockLead);

    const result = await softDeleteService.softDeleteLead(9, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Alice');
  });

  it('falls back to Lead #id when all name fields are missing', async () => {
    const mockLead = { id: 10, project_name: null, company_name: null, contact_name: null, email: null };
    mockDb.get.mockResolvedValueOnce(mockLead);

    const result = await softDeleteService.softDeleteLead(10, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Lead #10');
  });

  it('throws on database error', async () => {
    mockDb.get.mockRejectedValueOnce(new Error('Lead DB error'));

    await expect(softDeleteService.softDeleteLead(1, 'admin@test.com')).rejects.toThrow('Lead DB error');
  });
});

// =====================================================
// PROPOSAL SOFT DELETE
// =====================================================

describe('SoftDeleteService - softDeleteProposal', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.run.mockReset();
    mockDb.run.mockResolvedValue(makeRunResult());
  });

  it('returns failure when proposal not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const result = await softDeleteService.softDeleteProposal(99, 'admin@test.com');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Proposal not found or already deleted');
  });

  it('soft deletes a proposal with a title', async () => {
    const mockProposal = { id: 12, title: 'Q1 Proposal', client_id: 1 };
    mockDb.get.mockResolvedValueOnce(mockProposal);

    const result = await softDeleteService.softDeleteProposal(12, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Q1 Proposal');
    expect(result.affectedItems).toEqual({ clients: 0, projects: 0, invoices: 0, proposals: 1 });
  });

  it('falls back to Proposal #id when title is absent', async () => {
    const mockProposal = { id: 13, title: null, client_id: 2 };
    mockDb.get.mockResolvedValueOnce(mockProposal);

    const result = await softDeleteService.softDeleteProposal(13, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Proposal #13');
  });

  it('throws on database error', async () => {
    mockDb.get.mockRejectedValueOnce(new Error('Proposal DB error'));

    await expect(softDeleteService.softDeleteProposal(1, 'admin@test.com')).rejects.toThrow('Proposal DB error');
  });
});

// =====================================================
// GENERIC SOFT DELETE
// =====================================================

describe('SoftDeleteService - softDelete (generic)', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.run.mockReset();
    mockDb.run.mockResolvedValue(makeRunResult());
  });

  it('returns failure when entity not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const result = await softDeleteService.softDelete('task', 99, 'admin@test.com');

    expect(result.success).toBe(false);
    expect(result.message).toContain('task not found or already deleted');
  });

  it('soft deletes a task', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 5 });

    const result = await softDeleteService.softDelete('task', 5, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(result.message).toContain('trash');
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('project_tasks'),
      expect.anything()
    );
  });

  it('soft deletes a milestone', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 3 });

    const result = await softDeleteService.softDelete('milestone', 3, 'admin@test.com');

    expect(result.success).toBe(true);
  });

  it('soft deletes a file', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 20 });

    const result = await softDeleteService.softDelete('file', 20, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(result.message).toContain('30 days');
  });

  it('soft deletes a contact', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 8 });

    const result = await softDeleteService.softDelete('contact', 8, 'admin@test.com');

    expect(result.success).toBe(true);
  });

  it('throws on database error', async () => {
    mockDb.get.mockRejectedValueOnce(new Error('Generic DB error'));

    await expect(softDeleteService.softDelete('task', 1, 'admin@test.com')).rejects.toThrow('Generic DB error');
  });
});

// =====================================================
// BULK SOFT DELETE
// =====================================================

describe('SoftDeleteService - bulkSoftDelete', () => {
  beforeEach(() => {
    mockDb.run.mockReset();
    mockDb.run.mockResolvedValue(makeRunResult());
  });

  it('returns 0 deleted when entityIds is empty', async () => {
    const result = await softDeleteService.bulkSoftDelete('task', [], 'admin@test.com');

    expect(result.deleted).toBe(0);
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('bulk soft deletes multiple tasks', async () => {
    mockDb.run.mockResolvedValueOnce(makeRunResult(3));

    const result = await softDeleteService.bulkSoftDelete('task', [1, 2, 3], 'admin@test.com');

    expect(result.deleted).toBe(3);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('project_tasks'),
      expect.arrayContaining([1, 2, 3])
    );
  });

  it('does not log audit when nothing was deleted', async () => {
    const { auditLogger } = await import('../../../server/services/audit-logger');
    vi.mocked(auditLogger.log).mockClear();
    mockDb.run.mockResolvedValueOnce(makeRunResult(0));

    const result = await softDeleteService.bulkSoftDelete('task', [99, 100], 'admin@test.com');

    expect(result.deleted).toBe(0);
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('logs audit when items are deleted', async () => {
    const { auditLogger } = await import('../../../server/services/audit-logger');
    vi.mocked(auditLogger.log).mockClear();
    mockDb.run.mockResolvedValueOnce(makeRunResult(2));

    await softDeleteService.bulkSoftDelete('milestone', [10, 11], 'admin@test.com');

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'milestone_bulk_deleted' })
    );
  });

  it('handles undefined changes gracefully (returns 0)', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: undefined });

    const result = await softDeleteService.bulkSoftDelete('file', [1], 'admin@test.com');

    expect(result.deleted).toBe(0);
  });
});

// =====================================================
// RESTORE
// =====================================================

describe('SoftDeleteService - restore', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.run.mockReset();
    mockDb.run.mockResolvedValue(makeRunResult());
  });

  it('returns failure when entity not found or not deleted', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const result = await softDeleteService.restore('task', 99);

    expect(result.success).toBe(false);
    expect(result.message).toContain('task not found or not deleted');
  });

  it('restores a generic entity (non-invoice)', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 5, deleted_at: '2026-01-01T00:00:00Z' });

    const result = await softDeleteService.restore('task', 5);

    expect(result.success).toBe(true);
    expect(result.message).toContain('restored successfully');
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('project_tasks'),
      expect.anything()
    );
  });

  it('restores a voided invoice and sets status to draft', async () => {
    // First get: entity exists and is deleted
    mockDb.get.mockResolvedValueOnce({ id: 3, deleted_at: '2026-01-01T00:00:00Z' });
    // Second get: invoice status
    mockDb.get.mockResolvedValueOnce({ id: 3, status: 'voided' });

    const result = await softDeleteService.restore('invoice', 3);

    expect(result.success).toBe(true);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('status = \'draft\''),
      expect.anything()
    );
  });

  it('restores a non-voided invoice without changing status', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 4, deleted_at: '2026-01-01T00:00:00Z' });
    mockDb.get.mockResolvedValueOnce({ id: 4, status: 'draft' });

    const result = await softDeleteService.restore('invoice', 4);

    expect(result.success).toBe(true);
    // Should NOT set status to draft since it wasn't voided
    expect(mockDb.run).not.toHaveBeenCalledWith(
      expect.stringContaining('status = \'draft\''),
      expect.anything()
    );
  });

  it('throws on database error', async () => {
    mockDb.get.mockRejectedValueOnce(new Error('Restore DB error'));

    await expect(softDeleteService.restore('task', 1)).rejects.toThrow('Restore DB error');
  });
});

// =====================================================
// GET DELETED ITEMS
// =====================================================

describe('SoftDeleteService - getDeletedItems', () => {
  beforeEach(() => {
    mockDb.all.mockReset();
    mockDb.all.mockResolvedValue([]);
  });

  it('returns empty array when no deleted items exist', async () => {
    const result = await softDeleteService.getDeletedItems();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns deleted items for a specific entity type', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 1, name: 'Deleted Client', deleted_at: '2026-01-10T00:00:00Z', deleted_by: 'admin@test.com', days_remaining: 20 }
    ]);

    const result = await softDeleteService.getDeletedItems('client');

    expect(result).toHaveLength(1);
    expect(result[0].entityType).toBe('client');
    expect(result[0].name).toBe('Deleted Client');
    expect(result[0].daysUntilPermanent).toBe(20);
    expect(result[0].canRestore).toBe(true);
  });

  it('sets canRestore=false when days_remaining is 0 or negative', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 2, name: 'Old Item', deleted_at: '2025-11-01T00:00:00Z', deleted_by: 'admin@test.com', days_remaining: -5 }
    ]);

    const result = await softDeleteService.getDeletedItems('project');

    expect(result[0].daysUntilPermanent).toBe(0); // Math.max(0, -5)
    expect(result[0].canRestore).toBe(false);
  });

  it('defaults deletedBy to "system" when null', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 3, name: 'Auto-deleted', deleted_at: '2026-01-05T00:00:00Z', deleted_by: null, days_remaining: 10 }
    ]);

    const result = await softDeleteService.getDeletedItems('invoice');

    expect(result[0].deletedBy).toBe('system');
  });

  it('queries all entity types when no filter is provided', async () => {
    // Called once per entity type (14 types)
    mockDb.all.mockResolvedValue([]);

    await softDeleteService.getDeletedItems();

    // 14 entity types should result in 14 db.all calls
    expect(mockDb.all).toHaveBeenCalledTimes(14);
  });

  it('sorts results by deletion date descending', async () => {
    // Two calls for two entity types when filtering by 'client' only returns 1 call
    // Test with single type to keep it deterministic
    mockDb.all.mockResolvedValueOnce([
      { id: 1, name: 'Older', deleted_at: '2026-01-01T00:00:00Z', deleted_by: 'a', days_remaining: 25 },
      { id: 2, name: 'Newer', deleted_at: '2026-01-15T00:00:00Z', deleted_by: 'a', days_remaining: 10 }
    ]);

    const result = await softDeleteService.getDeletedItems('client');

    // More recent date should come first after sort
    expect(result[0].deletedAt).toBe('2026-01-15T00:00:00Z');
    expect(result[1].deletedAt).toBe('2026-01-01T00:00:00Z');
  });
});

// =====================================================
// GET DELETED ITEM STATS
// =====================================================

describe('SoftDeleteService - getDeletedItemStats', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
  });

  it('returns stats with all zeros when nothing is deleted', async () => {
    mockDb.get.mockResolvedValue({ count: 0 });

    const stats = await softDeleteService.getDeletedItemStats();

    expect(stats.clients).toBe(0);
    expect(stats.projects).toBe(0);
    expect(stats.invoices).toBe(0);
    expect(stats.leads).toBe(0);
    expect(stats.proposals).toBe(0);
    expect(stats.total).toBe(0);
  });

  it('correctly aggregates counts from all entity types', async () => {
    // Returns a different count per entity type query
    const counts = [2, 3, 1, 0, 4, 1, 2, 0, 1, 3, 2, 1, 0, 2];
    let idx = 0;
    mockDb.get.mockImplementation(() => Promise.resolve({ count: counts[idx++] ?? 0 }));

    const stats = await softDeleteService.getDeletedItemStats();

    // total = sum of all counts
    const expectedTotal = counts.reduce((a, b) => a + b, 0);
    expect(stats.total).toBe(expectedTotal);
  });
});

// =====================================================
// PERMANENTLY DELETE EXPIRED
// =====================================================

describe('SoftDeleteService - permanentlyDeleteExpired', () => {
  beforeEach(() => {
    mockDb.run.mockReset();
    mockDb.get.mockReset();
    mockDb.run.mockResolvedValue(makeRunResult(0));
    mockDb.get.mockResolvedValue({ count: 0 });
  });

  it('returns deleted counts of zero when nothing is expired', async () => {
    const result = await softDeleteService.permanentlyDeleteExpired();

    expect(result.deleted.total).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('returns counts when items are permanently deleted', async () => {
    // Most runs return 0, but proposals and invoices return non-zero
    let runCallCount = 0;
    mockDb.run.mockImplementation(() => {
      runCallCount++;
      // proposal deletion (2nd run call)
      if (runCallCount === 2) return Promise.resolve(makeRunResult(3));
      // invoice deletion (4th run call)
      if (runCallCount === 4) return Promise.resolve(makeRunResult(2));
      return Promise.resolve(makeRunResult(0));
    });

    const result = await softDeleteService.permanentlyDeleteExpired(30);

    expect(result.deleted.proposals).toBe(3);
    expect(result.deleted.invoices).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts custom retention days', async () => {
    mockDb.run.mockResolvedValue(makeRunResult(0));
    mockDb.get.mockResolvedValue({ count: 0 });

    const result = await softDeleteService.permanentlyDeleteExpired(7);

    expect(result.errors).toHaveLength(0);
  });

  it('returns errors array with message on failure', async () => {
    mockDb.run.mockRejectedValueOnce(new Error('Cleanup failed'));

    const result = await softDeleteService.permanentlyDeleteExpired();

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBe('Cleanup failed');
  });

  it('logs audit when items were permanently deleted', async () => {
    const { auditLogger } = await import('../../../server/services/audit-logger');
    vi.mocked(auditLogger.log).mockClear();

    let runCallCount = 0;
    mockDb.run.mockImplementation(() => {
      runCallCount++;
      if (runCallCount === 2) return Promise.resolve(makeRunResult(5)); // proposals
      return Promise.resolve(makeRunResult(0));
    });
    mockDb.get.mockResolvedValue({ count: 0 });

    await softDeleteService.permanentlyDeleteExpired();

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'permanent_delete_cleanup' })
    );
  });
});

// =====================================================
// FORCE DELETE
// =====================================================

describe('SoftDeleteService - forceDelete', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    mockDb.run.mockResolvedValue(makeRunResult());
  });

  it('returns failure when entity not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const result = await softDeleteService.forceDelete('task', 99);

    expect(result.success).toBe(false);
    expect(result.message).toContain('task not found');
  });

  it('force deletes a task (simple entity)', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 5, deleted_at: '2026-01-01T00:00:00Z' });

    const result = await softDeleteService.forceDelete('task', 5);

    expect(result.success).toBe(true);
    expect(result.message).toContain('permanently deleted');
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM project_tasks'),
      expect.anything()
    );
  });

  it('force deletes an invoice (cleans up invoice items first)', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 10, deleted_at: '2026-01-01T00:00:00Z' });

    const result = await softDeleteService.forceDelete('invoice', 10);

    expect(result.success).toBe(true);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('invoice_items'),
      expect.anything()
    );
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM invoices'),
      expect.anything()
    );
  });

  it('force deletes a proposal (cleans up proposal items first)', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 11, deleted_at: '2026-01-01T00:00:00Z' });

    const result = await softDeleteService.forceDelete('proposal', 11);

    expect(result.success).toBe(true);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('proposal_items'),
      expect.anything()
    );
  });

  it('force deletes a project and all its children', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 20, deleted_at: '2026-01-01T00:00:00Z' });

    const result = await softDeleteService.forceDelete('project', 20);

    expect(result.success).toBe(true);
    // Should delete milestones, tasks, messages, files, proposals
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('project_milestones'),
      expect.anything()
    );
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('project_tasks'),
      expect.anything()
    );
  });

  it('force deletes a client and all related children', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 1, deleted_at: '2026-01-01T00:00:00Z' });
    // Return projects for the cascade loop
    mockDb.all.mockResolvedValueOnce([{ id: 5 }, { id: 6 }]);

    const result = await softDeleteService.forceDelete('client', 1);

    expect(result.success).toBe(true);
    // Should delete contacts, activities, notes, tags, custom fields, proposals, invoices, projects
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('client_contacts'),
      expect.anything()
    );
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('client_activities'),
      expect.anything()
    );
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM clients'),
      expect.anything()
    );
  });

  it('throws on database error', async () => {
    mockDb.get.mockRejectedValueOnce(new Error('Force delete DB error'));

    await expect(softDeleteService.forceDelete('task', 1)).rejects.toThrow('Force delete DB error');
  });
});
