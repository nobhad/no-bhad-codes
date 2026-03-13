/**
 * ===============================================
 * UNIT TESTS - DELIVERABLE SERVICE
 * ===============================================
 * @file tests/unit/services/deliverable-service.test.ts
 *
 * Tests for deliverable management including:
 * - CRUD operations
 * - Version management
 * - Comments and annotations
 * - Design elements
 * - Review workflow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn()
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb)
}));

vi.mock('../../../server/utils/safe-json', () => ({
  safeJsonParseArray: vi.fn((val: string) => {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  })
}));

// Import service after mocks
import { DeliverableService } from '../../../server/services/deliverable-service';

// Use a fresh instance per suite so the singleton doesn't bleed between tests
let service: DeliverableService;

// Shared mock row builders
const makeDeliverableRow = (overrides = {}) => ({
  id: 1,
  project_id: 10,
  type: 'design',
  title: 'Homepage Mockup',
  description: 'Full-page mockup',
  status: 'draft',
  approval_status: 'pending',
  round_number: 1,
  created_by_id: 5,
  reviewed_by_id: null,
  review_deadline: null,
  approved_at: null,
  locked: 0,
  tags: 'ui,homepage',
  archived_file_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeCommentRow = (overrides = {}) => ({
  id: 1,
  deliverable_id: 1,
  author_id: 2,
  comment_text: 'Great work!',
  x_position: null,
  y_position: null,
  annotation_type: 'text',
  element_id: null,
  resolved: 0,
  resolved_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeVersionRow = (overrides = {}) => ({
  id: 1,
  deliverable_id: 1,
  version_number: 1,
  file_path: '/uploads/file.pdf',
  file_name: 'file.pdf',
  file_size: 1024,
  file_type: 'application/pdf',
  uploaded_by_id: 5,
  change_notes: 'Initial upload',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeReviewRow = (overrides = {}) => ({
  id: 1,
  deliverable_id: 1,
  reviewer_id: 3,
  decision: 'approved',
  feedback: 'Looks good',
  design_elements_reviewed: JSON.stringify([1, 2]),
  review_duration_minutes: 15,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

describe('DeliverableService', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    service = new DeliverableService(mockDb as never);
  });

  // ===================================================
  // DELIVERABLE CRUD
  // ===================================================

  describe('createDeliverable', () => {
    it('creates a deliverable and returns formatted result', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeDeliverableRow());

      const result = await service.createDeliverable(10, 'Homepage Mockup', 'Full-page mockup', 'design', 5);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deliverables'),
        expect.arrayContaining([10, 'design', 'Homepage Mockup', 'Full-page mockup', 5, 1])
      );
      expect(result.id).toBe(1);
      expect(result.title).toBe('Homepage Mockup');
      expect(result.locked).toBe(false);
    });

    it('creates deliverable with custom options', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 2 });
      mockDb.get.mockResolvedValueOnce(makeDeliverableRow({
        id: 2,
        round_number: 2,
        tags: 'mobile',
        review_deadline: '2026-03-15'
      }));

      const result = await service.createDeliverable(
        10,
        'Mobile View',
        'Mobile layout',
        'design',
        5,
        { roundNumber: 2, tags: 'mobile', reviewDeadline: '2026-03-15' }
      );

      expect(result.round_number).toBe(2);
      expect(result.tags).toBe('mobile');
    });

    it('throws when insert fails to return lastID', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: undefined });

      await expect(
        service.createDeliverable(10, 'Title', 'Desc', 'design', 5)
      ).rejects.toThrow('Failed to insert deliverable');
    });

    it('throws when fetch after insert returns null', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 99 });
      mockDb.get.mockResolvedValueOnce(null);

      await expect(
        service.createDeliverable(10, 'Title', 'Desc', 'design', 5)
      ).rejects.toThrow('Failed to create deliverable');
    });
  });

  describe('getDeliverableById', () => {
    it('returns formatted deliverable when found', async () => {
      mockDb.get.mockResolvedValueOnce(makeDeliverableRow());

      const result = await service.getDeliverableById(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.locked).toBe(false);
    });

    it('returns null when deliverable not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await service.getDeliverableById(999);

      expect(result).toBeNull();
    });

    it('casts locked integer to boolean', async () => {
      mockDb.get.mockResolvedValueOnce(makeDeliverableRow({ locked: 1 }));

      const result = await service.getDeliverableById(1);

      expect(result!.locked).toBe(true);
    });
  });

  describe('getProjectDeliverables', () => {
    it('returns deliverables with total count', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 2 });
      mockDb.all.mockResolvedValueOnce([
        makeDeliverableRow({ id: 1 }),
        makeDeliverableRow({ id: 2 })
      ]);

      const result = await service.getProjectDeliverables(10);

      expect(result.total).toBe(2);
      expect(result.deliverables).toHaveLength(2);
    });

    it('filters by status when provided', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 1 });
      mockDb.all.mockResolvedValueOnce([makeDeliverableRow()]);

      await service.getProjectDeliverables(10, { status: 'draft' });

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND status = ?'),
        expect.arrayContaining(['draft'])
      );
    });

    it('filters by roundNumber when provided', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 1 });
      mockDb.all.mockResolvedValueOnce([makeDeliverableRow()]);

      await service.getProjectDeliverables(10, { roundNumber: 2 });

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND round_number = ?'),
        expect.arrayContaining([2])
      );
    });

    it('applies limit and offset when provided', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 10 });
      mockDb.all.mockResolvedValueOnce([makeDeliverableRow()]);

      await service.getProjectDeliverables(10, { limit: 5, offset: 0 });

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        expect.arrayContaining([5, 0])
      );
    });

    it('returns zero total when count result is null', async () => {
      mockDb.get.mockResolvedValueOnce(null);
      mockDb.all.mockResolvedValueOnce([]);

      const result = await service.getProjectDeliverables(10);

      expect(result.total).toBe(0);
    });
  });

  describe('updateDeliverable', () => {
    it('updates deliverable with new values', async () => {
      // First call: getDeliverableById (existing)
      mockDb.get.mockResolvedValueOnce(makeDeliverableRow());
      // Run update
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      // Second call: getDeliverableById (updated)
      mockDb.get.mockResolvedValueOnce(makeDeliverableRow({ title: 'Updated Title', status: 'pending_review' }));

      const result = await service.updateDeliverable(1, { title: 'Updated Title', status: 'pending_review' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE deliverables SET'),
        expect.any(Array)
      );
      expect(result.title).toBe('Updated Title');
    });

    it('throws when deliverable not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(service.updateDeliverable(999, { title: 'New' })).rejects.toThrow(
        'Deliverable not found'
      );
    });

    it('throws when fetch after update returns null', async () => {
      mockDb.get.mockResolvedValueOnce(makeDeliverableRow());
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(null);

      await expect(service.updateDeliverable(1, { title: 'New' })).rejects.toThrow(
        'Failed to update deliverable'
      );
    });
  });

  describe('lockDeliverable', () => {
    it('locks deliverable and marks as approved', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeDeliverableRow({
        locked: 1,
        status: 'approved',
        approval_status: 'approved',
        reviewed_by_id: 3
      }));

      const result = await service.lockDeliverable(1, 3);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('SET locked=1, status=\'approved\''),
        [3, 1]
      );
      expect(result.locked).toBe(true);
      expect(result.status).toBe('approved');
    });

    it('throws when deliverable not found after lock', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(null);

      await expect(service.lockDeliverable(999, 3)).rejects.toThrow('Deliverable not found');
    });
  });

  describe('setArchivedFileId', () => {
    it('updates archived file ID', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await service.setArchivedFileId(1, 42);

      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE deliverables SET archived_file_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [42, 1]
      );
    });
  });

  describe('getArchivedFileId', () => {
    it('returns archived file ID when set', async () => {
      mockDb.get.mockResolvedValueOnce({ archived_file_id: 42 });

      const result = await service.getArchivedFileId(1);

      expect(result).toBe(42);
    });

    it('returns null when no archived file', async () => {
      mockDb.get.mockResolvedValueOnce({ archived_file_id: null });

      const result = await service.getArchivedFileId(1);

      expect(result).toBeNull();
    });

    it('returns null when row not found', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      const result = await service.getArchivedFileId(999);

      expect(result).toBeNull();
    });
  });

  describe('requestRevision', () => {
    it('sets deliverable to revision_requested status', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeDeliverableRow({
        status: 'revision_requested',
        approval_status: 'revision_needed',
        reviewed_by_id: 3
      }));

      const result = await service.requestRevision(1, 'Needs more color', 3);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('status=\'revision_requested\''),
        [3, 1]
      );
      expect(result.status).toBe('revision_requested');
    });

    it('throws when deliverable not found after update', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(null);

      await expect(service.requestRevision(999, 'Reason', 3)).rejects.toThrow('Deliverable not found');
    });
  });

  describe('deleteDeliverable', () => {
    it('soft-deletes by setting status to archived', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await service.deleteDeliverable(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE deliverables SET status=? WHERE id=?',
        ['archived', 1]
      );
    });
  });

  // ===================================================
  // VERSION MANAGEMENT
  // ===================================================

  describe('uploadVersion', () => {
    it('creates a new version for an existing deliverable', async () => {
      // getDeliverableById - use pending_review status to skip the updateDeliverable call
      mockDb.get.mockResolvedValueOnce(makeDeliverableRow({ status: 'pending_review' }));
      // get max_version
      mockDb.get.mockResolvedValueOnce({ max_version: 1 });
      // insert version
      mockDb.run.mockResolvedValueOnce({ lastID: 5 });
      // getVersionById
      mockDb.get.mockResolvedValueOnce(makeVersionRow({ id: 5, version_number: 2 }));

      const result = await service.uploadVersion(1, '/uploads/v2.pdf', 'v2.pdf', 2048, 'application/pdf', 5, 'Second revision');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deliverable_versions'),
        expect.arrayContaining([1, 2, '/uploads/v2.pdf'])
      );
      expect(result.version_number).toBe(2);
    });

    it('auto-updates status to pending_review when deliverable is draft', async () => {
      // getDeliverableById (status: draft)
      mockDb.get.mockResolvedValueOnce(makeDeliverableRow({ status: 'draft' }));
      // get max_version
      mockDb.get.mockResolvedValueOnce({ max_version: null });
      // insert version
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });

      // updateDeliverable calls getDeliverableById + run + getDeliverableById
      mockDb.get.mockResolvedValueOnce(makeDeliverableRow({ status: 'draft' }));
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeDeliverableRow({ status: 'pending_review' }));

      // getVersionById
      mockDb.get.mockResolvedValueOnce(makeVersionRow({ id: 1, version_number: 1 }));

      await service.uploadVersion(1, '/uploads/v1.pdf', 'v1.pdf', 1024, 'application/pdf', 5);

      // Verify updateDeliverable was called for status change
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE deliverables SET'),
        expect.any(Array)
      );
    });

    it('throws when deliverable not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(
        service.uploadVersion(999, '/path', 'file.pdf', 100, 'application/pdf', 1)
      ).rejects.toThrow('Deliverable not found');
    });

    it('throws when insert fails to return lastID', async () => {
      // Use pending_review so updateDeliverable is not triggered
      mockDb.get.mockResolvedValueOnce(makeDeliverableRow({ status: 'pending_review' }));
      mockDb.get.mockResolvedValueOnce({ max_version: 0 });
      mockDb.run.mockResolvedValueOnce({ lastID: undefined });

      await expect(
        service.uploadVersion(1, '/path', 'file.pdf', 100, 'application/pdf', 1)
      ).rejects.toThrow('Failed to insert version');
    });
  });

  describe('getVersionById', () => {
    it('returns version when found', async () => {
      mockDb.get.mockResolvedValueOnce(makeVersionRow());

      const result = await service.getVersionById(1);

      expect(result).not.toBeNull();
      expect(result!.version_number).toBe(1);
    });

    it('returns null when not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await service.getVersionById(999);

      expect(result).toBeNull();
    });
  });

  describe('getDeliverableVersions', () => {
    it('returns all versions ordered by version_number desc', async () => {
      mockDb.all.mockResolvedValueOnce([
        makeVersionRow({ id: 2, version_number: 2 }),
        makeVersionRow({ id: 1, version_number: 1 })
      ]);

      const result = await service.getDeliverableVersions(1);

      expect(result).toHaveLength(2);
      expect(result[0].version_number).toBe(2);
    });

    it('returns empty array when no versions', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await service.getDeliverableVersions(1);

      expect(result).toEqual([]);
    });
  });

  describe('getLatestVersion', () => {
    it('returns the latest version', async () => {
      mockDb.get.mockResolvedValueOnce(makeVersionRow({ version_number: 3 }));

      const result = await service.getLatestVersion(1);

      expect(result!.version_number).toBe(3);
    });

    it('returns null when no versions exist', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await service.getLatestVersion(1);

      expect(result).toBeNull();
    });
  });

  // ===================================================
  // COMMENTS AND ANNOTATIONS
  // ===================================================

  describe('addComment', () => {
    it('adds a text comment', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeCommentRow());

      const result = await service.addComment(1, 2, 'Great work!');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deliverable_comments'),
        expect.arrayContaining([1, 2, 'Great work!'])
      );
      expect(result.comment_text).toBe('Great work!');
      expect(result.resolved).toBe(false);
    });

    it('adds an annotation with position', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 2 });
      mockDb.get.mockResolvedValueOnce(makeCommentRow({
        id: 2,
        x_position: 100,
        y_position: 200,
        annotation_type: 'arrow'
      }));

      const result = await service.addComment(1, 2, 'Fix this', {
        x: 100,
        y: 200,
        annotationType: 'arrow'
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deliverable_comments'),
        expect.arrayContaining([1, 2, 'Fix this', 100, 200, 'arrow'])
      );
      expect(result.x_position).toBe(100);
    });

    it('throws when insert fails to return lastID', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: undefined });

      await expect(service.addComment(1, 2, 'Text')).rejects.toThrow('Failed to insert comment');
    });

    it('throws when comment not found after insert', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(null);

      await expect(service.addComment(1, 2, 'Text')).rejects.toThrow('Failed to add comment');
    });
  });

  describe('getCommentById', () => {
    it('returns formatted comment', async () => {
      mockDb.get.mockResolvedValueOnce(makeCommentRow());

      const result = await service.getCommentById(1);

      expect(result).not.toBeNull();
      expect(result!.resolved).toBe(false);
    });

    it('returns null when not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await service.getCommentById(999);

      expect(result).toBeNull();
    });
  });

  describe('getDeliverableComments', () => {
    it('returns all comments for a deliverable', async () => {
      mockDb.all.mockResolvedValueOnce([makeCommentRow(), makeCommentRow({ id: 2 })]);

      const result = await service.getDeliverableComments(1);

      expect(result).toHaveLength(2);
    });

    it('filters by resolved status', async () => {
      mockDb.all.mockResolvedValueOnce([makeCommentRow({ resolved: 0 })]);

      await service.getDeliverableComments(1, { resolved: false });

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND resolved = ?'),
        expect.arrayContaining([0])
      );
    });

    it('filters by elementId', async () => {
      mockDb.all.mockResolvedValueOnce([makeCommentRow({ element_id: 'el-1' })]);

      await service.getDeliverableComments(1, { elementId: 'el-1' });

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND element_id = ?'),
        expect.arrayContaining(['el-1'])
      );
    });

    it('returns empty array when no comments', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await service.getDeliverableComments(1);

      expect(result).toEqual([]);
    });
  });

  describe('resolveComment', () => {
    it('marks comment as resolved', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeCommentRow({ resolved: 1 }));

      const result = await service.resolveComment(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE deliverable_comments SET resolved=1, resolved_at=CURRENT_TIMESTAMP WHERE id=?',
        [1]
      );
      expect(result.resolved).toBe(true);
    });

    it('throws when comment not found after resolve', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(null);

      await expect(service.resolveComment(999)).rejects.toThrow('Comment not found');
    });
  });

  describe('deleteComment', () => {
    it('permanently deletes a comment', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await service.deleteComment(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM deliverable_comments WHERE id=?',
        [1]
      );
    });
  });

  // ===================================================
  // DESIGN ELEMENTS
  // ===================================================

  describe('createDesignElement', () => {
    it('creates a design element', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        deliverable_id: 1,
        name: 'Hero Image',
        description: 'Large hero image',
        approval_status: 'pending',
        revision_count: 0,
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
      });

      const result = await service.createDesignElement(1, 'Hero Image', 'Large hero image');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO design_elements'),
        [1, 'Hero Image', 'Large hero image']
      );
      expect(result.name).toBe('Hero Image');
    });

    it('creates design element without description', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 2 });
      mockDb.get.mockResolvedValueOnce({
        id: 2,
        deliverable_id: 1,
        name: 'Button',
        description: null,
        approval_status: 'pending',
        revision_count: 0,
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
      });

      await service.createDesignElement(1, 'Button');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO design_elements'),
        [1, 'Button', null]
      );
    });

    it('throws when insert fails to return lastID', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: undefined });

      await expect(service.createDesignElement(1, 'Element')).rejects.toThrow(
        'Failed to insert design element'
      );
    });

    it('throws when element not found after insert', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(null);

      await expect(service.createDesignElement(1, 'Element')).rejects.toThrow(
        'Failed to create design element'
      );
    });
  });

  describe('getDesignElementById', () => {
    it('returns design element when found', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        deliverable_id: 1,
        name: 'Logo',
        description: null,
        approval_status: 'approved',
        revision_count: 1,
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
      });

      const result = await service.getDesignElementById(1);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Logo');
    });

    it('returns null when not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await service.getDesignElementById(999);

      expect(result).toBeNull();
    });
  });

  describe('getDeliverableElements', () => {
    it('returns all design elements for a deliverable', async () => {
      mockDb.all.mockResolvedValueOnce([
        { id: 1, deliverable_id: 1, name: 'Header', description: null, approval_status: 'pending', revision_count: 0, created_at: '2026-01-01', updated_at: '2026-01-01' },
        { id: 2, deliverable_id: 1, name: 'Footer', description: null, approval_status: 'pending', revision_count: 0, created_at: '2026-01-01', updated_at: '2026-01-01' }
      ]);

      const result = await service.getDeliverableElements(1);

      expect(result).toHaveLength(2);
    });

    it('returns empty array when no elements', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await service.getDeliverableElements(1);

      expect(result).toEqual([]);
    });
  });

  describe('updateElementApprovalStatus', () => {
    it('updates approval status to approved', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        deliverable_id: 1,
        name: 'Header',
        description: null,
        approval_status: 'approved',
        revision_count: 0,
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
      });

      const result = await service.updateElementApprovalStatus(1, 'approved');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE design_elements SET approval_status=?'),
        ['approved', 1]
      );
      expect(result.approval_status).toBe('approved');
    });

    it('increments revision_count when status is revision_needed', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        deliverable_id: 1,
        name: 'Header',
        description: null,
        approval_status: 'revision_needed',
        revision_count: 1,
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
      });

      await service.updateElementApprovalStatus(1, 'revision_needed');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('revision_count=revision_count+1'),
        ['revision_needed', 1]
      );
    });

    it('throws when element not found after update', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(null);

      await expect(service.updateElementApprovalStatus(999, 'approved')).rejects.toThrow(
        'Design element not found'
      );
    });
  });

  // ===================================================
  // REVIEWS
  // ===================================================

  describe('createReview', () => {
    it('creates a review record with approved decision', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeReviewRow());

      const result = await service.createReview(1, 3, 'approved', 'Looks great', [1, 2]);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deliverable_reviews'),
        expect.arrayContaining([1, 3, 'approved', 'Looks great', JSON.stringify([1, 2])])
      );
      expect(result.decision).toBe('approved');
    });

    it('creates review without optional fields', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 2 });
      mockDb.get.mockResolvedValueOnce(makeReviewRow({ id: 2, feedback: null, design_elements_reviewed: JSON.stringify([]) }));

      await service.createReview(1, 3, 'revision_needed');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deliverable_reviews'),
        expect.arrayContaining([1, 3, 'revision_needed', null, JSON.stringify([])])
      );
    });

    it('throws when insert fails to return lastID', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: undefined });

      await expect(service.createReview(1, 3, 'approved')).rejects.toThrow('Failed to insert review');
    });

    it('throws when review not found after insert', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(null);

      await expect(service.createReview(1, 3, 'approved')).rejects.toThrow('Failed to create review');
    });
  });

  describe('getReviewById', () => {
    it('returns formatted review', async () => {
      mockDb.get.mockResolvedValueOnce(makeReviewRow());

      const result = await service.getReviewById(1);

      expect(result).not.toBeNull();
      expect(result!.decision).toBe('approved');
      expect(result!.design_elements_reviewed).toEqual([1, 2]);
    });

    it('returns null when not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await service.getReviewById(999);

      expect(result).toBeNull();
    });
  });

  describe('getDeliverableReviews', () => {
    it('returns all reviews for a deliverable', async () => {
      mockDb.all.mockResolvedValueOnce([
        makeReviewRow({ id: 1 }),
        makeReviewRow({ id: 2, decision: 'revision_needed' })
      ]);

      const result = await service.getDeliverableReviews(1);

      expect(result).toHaveLength(2);
      expect(result[0].decision).toBe('approved');
      expect(result[1].decision).toBe('revision_needed');
    });

    it('returns empty array when no reviews', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await service.getDeliverableReviews(1);

      expect(result).toEqual([]);
    });
  });
});
