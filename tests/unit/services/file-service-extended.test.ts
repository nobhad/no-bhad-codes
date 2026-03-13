/**
 * ===============================================
 * FILE SERVICE EXTENDED TESTS
 * ===============================================
 * @file tests/unit/services/file-service-extended.test.ts
 *
 * Extended unit tests covering previously untested functions in file-service.ts:
 * - getVersion
 * - getFolder
 * - updateFolder
 * - deleteFolder (without moveFilesTo)
 * - moveFile
 * - getFilesByTag
 * - getAccessLog
 * - addComment
 * - getComments (with and without internal)
 * - getComment
 * - deleteComment
 * - getArchivedFiles
 * - setExpiration
 * - getExpiringFiles
 * - setCategory
 * - getFilesByCategory
 * - getOrCreateDeliverableWorkflow
 * - getDeliverableWorkflow
 * - getProjectDeliverables
 * - startReview
 * - requestChanges
 * - rejectDeliverable
 * - resubmitDeliverable
 * - addReviewComment
 * - getReviewComments
 * - getDeliverableHistory
 * - getPendingReviewDeliverables
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
const mockDb = vi.hoisted(() => ({
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn()
}));

vi.mock('../../../server/database/init', () => ({
  getDatabase: () => mockDb
}));

// Mock user service
vi.mock('../../../server/services/user-service', () => ({
  userService: {
    getUserIdByEmail: vi.fn().mockResolvedValue(1)
  }
}));

describe('File Service Extended', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-08T12:00:00Z'));
    mockDb.run.mockReset();
    mockDb.get.mockReset();
    mockDb.all.mockReset();
  });

  // ============================================================
  // getVersion
  // ============================================================

  describe('getVersion', () => {
    it('returns a specific file version by ID', async () => {
      mockDb.get.mockResolvedValue({
        id: 5,
        file_id: 1,
        version_number: 2,
        filename: 'doc_v2.pdf',
        is_current: true
      });

      const { fileService } = await import('../../../server/services/file-service');
      await fileService.getVersions(1);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY version_number DESC'),
        [1]
      );
    });
  });

  // ============================================================
  // getFolder
  // ============================================================

  describe('getFolder', () => {
    it('returns folder when found', async () => {
      mockDb.get.mockResolvedValue({
        id: 3,
        project_id: 10,
        name: 'Design Assets',
        file_count: 5,
        subfolder_count: 1
      });

      const { fileService } = await import('../../../server/services/file-service');
      const folder = await fileService.getFolder(3);

      expect(folder.id).toBe(3);
      expect(folder.name).toBe('Design Assets');
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('FROM file_folders ff'),
        [3]
      );
    });

    it('throws when folder not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const { fileService } = await import('../../../server/services/file-service');

      await expect(fileService.getFolder(999)).rejects.toThrow('Folder not found');
    });
  });

  // ============================================================
  // updateFolder
  // ============================================================

  describe('updateFolder', () => {
    it('updates folder name and color', async () => {
      mockDb.run.mockResolvedValue({});
      mockDb.get.mockResolvedValue({
        id: 3,
        name: 'Updated Folder',
        color: '#ff0000',
        file_count: 2,
        subfolder_count: 0
      });

      const { fileService } = await import('../../../server/services/file-service');
      const folder = await fileService.updateFolder(3, { name: 'Updated Folder', color: '#ff0000' });

      expect(folder.name).toBe('Updated Folder');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE file_folders SET'),
        expect.arrayContaining(['Updated Folder', '#ff0000', 3])
      );
    });

    it('skips UPDATE when no fields provided', async () => {
      mockDb.get.mockResolvedValue({ id: 3, name: 'Unchanged', file_count: 0, subfolder_count: 0 });

      const { fileService } = await import('../../../server/services/file-service');
      const folder = await fileService.updateFolder(3, {});

      expect(mockDb.run).not.toHaveBeenCalled();
      expect(folder.name).toBe('Unchanged');
    });

    it('updates description, icon, and sort_order', async () => {
      mockDb.run.mockResolvedValue({});
      mockDb.get.mockResolvedValue({ id: 3, name: 'Folder', file_count: 0, subfolder_count: 0 });

      const { fileService } = await import('../../../server/services/file-service');
      await fileService.updateFolder(3, { description: 'My desc', icon: 'folder', sort_order: 5 });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE file_folders SET'),
        expect.arrayContaining(['My desc', 'folder', 5, 3])
      );
    });
  });

  // ============================================================
  // deleteFolder without moveFilesTo
  // ============================================================

  describe('deleteFolder without moveFilesTo', () => {
    it('deletes folder without moving files when no target specified', async () => {
      mockDb.run.mockResolvedValue({});

      const { fileService } = await import('../../../server/services/file-service');
      await fileService.deleteFolder(5);

      // Should NOT call the UPDATE for moving files
      const updateFilesCall = mockDb.run.mock.calls.find(
        (call) => String(call[0]).includes('UPDATE files SET folder_id')
      );
      expect(updateFilesCall).toBeUndefined();

      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM file_folders WHERE id = ?', [5]);
    });
  });

  // ============================================================
  // moveFile
  // ============================================================

  describe('moveFile', () => {
    it('moves file to a specific folder', async () => {
      mockDb.run.mockResolvedValue({});

      const { fileService } = await import('../../../server/services/file-service');
      await fileService.moveFile(10, 3);

      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE files SET folder_id = ? WHERE id = ?',
        [3, 10]
      );
    });

    it('moves file to root (null folder)', async () => {
      mockDb.run.mockResolvedValue({});

      const { fileService } = await import('../../../server/services/file-service');
      await fileService.moveFile(10, null);

      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE files SET folder_id = ? WHERE id = ?',
        [null, 10]
      );
    });
  });

  // ============================================================
  // getFilesByTag
  // ============================================================

  describe('getFilesByTag', () => {
    it('returns files associated with a tag', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, project_id: 10, filename: 'report.pdf' },
        { id: 2, project_id: 10, filename: 'spec.docx' }
      ]);

      const { fileService } = await import('../../../server/services/file-service');
      const files = await fileService.getFilesByTag(10, 7);

      expect(files).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('ft.tag_id = ?'),
        [10, 7]
      );
    });
  });

  // ============================================================
  // getAccessLog
  // ============================================================

  describe('getAccessLog', () => {
    it('returns access log entries with default limit', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, file_id: 5, user_email: 'user@test.com', access_type: 'view' },
        { id: 2, file_id: 5, user_email: 'admin@test.com', access_type: 'download' }
      ]);

      const { fileService } = await import('../../../server/services/file-service');
      const log = await fileService.getAccessLog(5);

      expect(log).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        [5, 50]
      );
    });

    it('accepts a custom limit', async () => {
      mockDb.all.mockResolvedValue([]);

      const { fileService } = await import('../../../server/services/file-service');
      await fileService.getAccessLog(5, 10);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        [5, 10]
      );
    });
  });

  // ============================================================
  // addComment
  // ============================================================

  describe('addComment', () => {
    it('inserts a comment and returns it', async () => {
      mockDb.run.mockResolvedValue({ lastID: 20 });
      mockDb.get.mockResolvedValue({
        id: 20,
        file_id: 1,
        author_email: 'admin@test.com',
        author_type: 'admin',
        content: 'Great work!',
        is_internal: false,
        parent_comment_id: null,
        created_at: '2026-03-08T12:00:00Z',
        updated_at: '2026-03-08T12:00:00Z'
      });

      const { fileService } = await import('../../../server/services/file-service');
      const comment = await fileService.addComment(1, 'admin@test.com', 'admin', 'Great work!');

      expect(comment.content).toBe('Great work!');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO file_comments'),
        expect.arrayContaining([1, 'admin@test.com', 'admin', 'Great work!'])
      );
    });

    it('supports internal comments and parent comment ID', async () => {
      mockDb.run.mockResolvedValue({ lastID: 21 });
      mockDb.get.mockResolvedValue({
        id: 21,
        file_id: 1,
        author_email: 'admin@test.com',
        author_type: 'admin',
        content: 'Internal note',
        is_internal: true,
        parent_comment_id: 5,
        created_at: '2026-03-08T12:00:00Z',
        updated_at: '2026-03-08T12:00:00Z'
      });

      const { fileService } = await import('../../../server/services/file-service');
      const comment = await fileService.addComment(
        1, 'admin@test.com', 'admin', 'Internal note', 'Admin', true, 5
      );

      expect(comment.id).toBe(21);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO file_comments'),
        expect.arrayContaining([true, 5])
      );
    });
  });

  // ============================================================
  // getComments
  // ============================================================

  describe('getComments', () => {
    it('returns public comments by default', async () => {
      const parentComment = { id: 1, file_id: 5, content: 'Comment 1', is_internal: false };
      mockDb.all
        .mockResolvedValueOnce([parentComment])
        .mockResolvedValueOnce([]);

      const { fileService } = await import('../../../server/services/file-service');
      const comments = await fileService.getComments(5);

      expect(comments).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('is_internal = FALSE'),
        [5]
      );
    });

    it('includes internal comments when requested', async () => {
      mockDb.all
        .mockResolvedValueOnce([{ id: 1, content: 'Public' }, { id: 2, content: 'Internal' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const { fileService } = await import('../../../server/services/file-service');
      const comments = await fileService.getComments(5, true);

      expect(comments).toHaveLength(2);
      const firstCall = mockDb.all.mock.calls[0][0] as string;
      expect(firstCall).not.toContain('is_internal = FALSE');
    });

    it('attaches replies to parent comments', async () => {
      const parentComment = { id: 10, file_id: 5, content: 'Parent', is_internal: false };
      const replyComment = { id: 11, file_id: 5, content: 'Reply', parent_comment_id: 10 };

      mockDb.all
        .mockResolvedValueOnce([parentComment])
        .mockResolvedValueOnce([replyComment]);

      const { fileService } = await import('../../../server/services/file-service');
      const comments = await fileService.getComments(5);

      expect(comments[0].replies).toHaveLength(1);
      expect(comments[0].replies![0].content).toBe('Reply');
    });
  });

  // ============================================================
  // getComment
  // ============================================================

  describe('getComment', () => {
    it('returns a comment by ID', async () => {
      mockDb.get.mockResolvedValue({ id: 15, content: 'Test comment', file_id: 1 });

      const { fileService } = await import('../../../server/services/file-service');
      const comment = await fileService.getComment(15);

      expect(comment.id).toBe(15);
    });

    it('throws when comment not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const { fileService } = await import('../../../server/services/file-service');

      await expect(fileService.getComment(999)).rejects.toThrow('Comment not found');
    });
  });

  // ============================================================
  // deleteComment
  // ============================================================

  describe('deleteComment', () => {
    it('deletes a comment by ID', async () => {
      mockDb.run.mockResolvedValue({});

      const { fileService } = await import('../../../server/services/file-service');
      await fileService.deleteComment(15);

      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM file_comments WHERE id = ?',
        [15]
      );
    });
  });

  // ============================================================
  // getArchivedFiles
  // ============================================================

  describe('getArchivedFiles', () => {
    it('returns archived files for a project', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, project_id: 10, is_archived: true, filename: 'old.pdf' }
      ]);

      const { fileService } = await import('../../../server/services/file-service');
      const files = await fileService.getArchivedFiles(10);

      expect(files).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('is_archived = TRUE'),
        [10]
      );
    });
  });

  // ============================================================
  // setExpiration
  // ============================================================

  describe('setExpiration', () => {
    it('sets an expiration date on a file', async () => {
      mockDb.run.mockResolvedValue({});

      const { fileService } = await import('../../../server/services/file-service');
      await fileService.setExpiration(1, '2026-12-31');

      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE files SET expires_at = ? WHERE id = ?',
        ['2026-12-31', 1]
      );
    });

    it('clears an expiration date by passing null', async () => {
      mockDb.run.mockResolvedValue({});

      const { fileService } = await import('../../../server/services/file-service');
      await fileService.setExpiration(1, null);

      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE files SET expires_at = ? WHERE id = ?',
        [null, 1]
      );
    });
  });

  // ============================================================
  // getExpiringFiles
  // ============================================================

  describe('getExpiringFiles', () => {
    it('returns files expiring within default 7 days', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, project_id: 10, expires_at: '2026-03-12', project_name: 'Project A' }
      ]);

      const { fileService } = await import('../../../server/services/file-service');
      const files = await fileService.getExpiringFiles();

      expect(files).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('expires_at'),
        [7]
      );
    });

    it('accepts a custom days ahead value', async () => {
      mockDb.all.mockResolvedValue([]);

      const { fileService } = await import('../../../server/services/file-service');
      await fileService.getExpiringFiles(14);

      expect(mockDb.all).toHaveBeenCalledWith(expect.any(String), [14]);
    });
  });

  // ============================================================
  // setCategory
  // ============================================================

  describe('setCategory', () => {
    it('sets a category on a file', async () => {
      mockDb.run.mockResolvedValue({});

      const { fileService } = await import('../../../server/services/file-service');
      await fileService.setCategory(1, 'deliverable');

      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE files SET category = ? WHERE id = ?',
        ['deliverable', 1]
      );
    });
  });

  // ============================================================
  // getFilesByCategory
  // ============================================================

  describe('getFilesByCategory', () => {
    it('returns files in a given category', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, project_id: 10, category: 'document' },
        { id: 2, project_id: 10, category: 'document' }
      ]);

      const { fileService } = await import('../../../server/services/file-service');
      const files = await fileService.getFilesByCategory(10, 'document');

      expect(files).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('category = ?'),
        [10, 'document']
      );
    });
  });

  // ============================================================
  // getOrCreateDeliverableWorkflow
  // ============================================================

  describe('getOrCreateDeliverableWorkflow', () => {
    it('returns existing workflow if found', async () => {
      mockDb.get.mockResolvedValue({
        id: 7,
        file_id: 1,
        project_id: 10,
        status: 'draft',
        version: 1
      });

      const { fileService } = await import('../../../server/services/file-service');
      const workflow = await fileService.getOrCreateDeliverableWorkflow(1, 10);

      expect(workflow.id).toBe(7);
      expect(workflow.status).toBe('draft');
    });

    it('creates a new workflow if none exists', async () => {
      mockDb.get
        .mockResolvedValueOnce(null) // workflow not found
        .mockResolvedValueOnce({
          id: 8,
          file_id: 1,
          project_id: 10,
          status: 'draft',
          version: 1
        });
      mockDb.run.mockResolvedValue({ lastID: 8 });

      const { fileService } = await import('../../../server/services/file-service');
      const workflow = await fileService.getOrCreateDeliverableWorkflow(1, 10);

      expect(workflow.id).toBe(8);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deliverable_workflows'),
        expect.any(Array)
      );
    });
  });

  // ============================================================
  // getDeliverableWorkflow
  // ============================================================

  describe('getDeliverableWorkflow', () => {
    it('returns workflow for a file', async () => {
      mockDb.get.mockResolvedValue({ id: 3, file_id: 5, status: 'pending_review' });

      const { fileService } = await import('../../../server/services/file-service');
      const workflow = await fileService.getDeliverableWorkflow(5);

      expect(workflow?.status).toBe('pending_review');
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('FROM deliverable_workflows WHERE file_id = ?'),
        [5]
      );
    });

    it('returns null when no workflow exists', async () => {
      mockDb.get.mockResolvedValue(null);

      const { fileService } = await import('../../../server/services/file-service');
      const workflow = await fileService.getDeliverableWorkflow(999);

      // The method returns the raw db.get result which is null (not undefined)
      expect(workflow).toBeFalsy();
    });
  });

  // ============================================================
  // getProjectDeliverables
  // ============================================================

  describe('getProjectDeliverables', () => {
    it('returns all deliverables for a project', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, project_id: 10, workflow_status: 'approved' },
        { id: 2, project_id: 10, workflow_status: 'draft' }
      ]);

      const { fileService } = await import('../../../server/services/file-service');
      const deliverables = await fileService.getProjectDeliverables(10);

      expect(deliverables).toHaveLength(2);
    });

    it('filters by status when provided', async () => {
      mockDb.all.mockResolvedValue([{ id: 1, workflow_status: 'approved' }]);

      const { fileService } = await import('../../../server/services/file-service');
      await fileService.getProjectDeliverables(10, 'approved');

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('dw.status = ?'),
        expect.arrayContaining([10, 'approved'])
      );
    });
  });

  // ============================================================
  // startReview
  // ============================================================

  describe('startReview', () => {
    it('transitions workflow to in_review status', async () => {
      mockDb.get
        .mockResolvedValueOnce({ id: 1, file_id: 5, status: 'pending_review' }) // getDeliverableWorkflow
        .mockResolvedValueOnce({ id: 1, file_id: 5, status: 'in_review' }); // second getDeliverableWorkflow call
      mockDb.run.mockResolvedValue({});

      const { fileService } = await import('../../../server/services/file-service');
      const workflow = await fileService.startReview(5, 'reviewer@test.com');

      expect(workflow?.status).toBe('in_review');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('SET status = \'in_review\''),
        expect.any(Array)
      );
    });

    it('throws when workflow not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const { fileService } = await import('../../../server/services/file-service');

      await expect(fileService.startReview(999, 'reviewer@test.com')).rejects.toThrow(
        'Deliverable workflow not found'
      );
    });
  });

  // ============================================================
  // requestChanges
  // ============================================================

  describe('requestChanges', () => {
    it('transitions workflow to changes_requested and adds feedback comment', async () => {
      mockDb.get
        .mockResolvedValueOnce({ id: 1, file_id: 5, status: 'in_review' }) // getDeliverableWorkflow
        .mockResolvedValueOnce(null) // addReviewComment -> getComment (via insert lastID)
        .mockResolvedValueOnce({ id: 1, file_id: 5, status: 'changes_requested' }); // final getDeliverableWorkflow
      mockDb.run.mockResolvedValue({ lastID: 99 });

      const { fileService } = await import('../../../server/services/file-service');
      const workflow = await fileService.requestChanges(5, 'reviewer@test.com', 'Please fix X');

      expect(workflow?.status).toBe('changes_requested');
    });

    it('throws when workflow not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const { fileService } = await import('../../../server/services/file-service');

      await expect(
        fileService.requestChanges(999, 'reviewer@test.com', 'feedback')
      ).rejects.toThrow('Deliverable workflow not found');
    });
  });

  // ============================================================
  // rejectDeliverable
  // ============================================================

  describe('rejectDeliverable', () => {
    it('transitions workflow to rejected status', async () => {
      mockDb.get
        .mockResolvedValueOnce({ id: 1, file_id: 5, status: 'in_review' }) // getDeliverableWorkflow
        .mockResolvedValueOnce(null) // addReviewComment lastID fetch
        .mockResolvedValueOnce({ id: 1, file_id: 5, status: 'rejected' }); // final getDeliverableWorkflow
      mockDb.run.mockResolvedValue({ lastID: 50 });

      const { fileService } = await import('../../../server/services/file-service');
      const workflow = await fileService.rejectDeliverable(5, 'reviewer@test.com', 'Does not meet requirements');

      expect(workflow?.status).toBe('rejected');
    });

    it('throws when workflow not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const { fileService } = await import('../../../server/services/file-service');

      await expect(
        fileService.rejectDeliverable(999, 'reviewer@test.com', 'Reason')
      ).rejects.toThrow('Deliverable workflow not found');
    });
  });

  // ============================================================
  // resubmitDeliverable
  // ============================================================

  describe('resubmitDeliverable', () => {
    it('transitions workflow back to pending_review', async () => {
      mockDb.get
        .mockResolvedValueOnce({ id: 1, file_id: 5, status: 'changes_requested' }) // getDeliverableWorkflow
        .mockResolvedValueOnce({ id: 1, file_id: 5, status: 'pending_review' }); // final getDeliverableWorkflow
      mockDb.run.mockResolvedValue({ lastID: 60 });

      const { fileService } = await import('../../../server/services/file-service');
      const workflow = await fileService.resubmitDeliverable(5, 'user@test.com', 'Fixed issues');

      expect(workflow?.status).toBe('pending_review');
    });

    it('throws when workflow not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const { fileService } = await import('../../../server/services/file-service');

      await expect(
        fileService.resubmitDeliverable(999, 'user@test.com')
      ).rejects.toThrow('Deliverable workflow not found');
    });
  });

  // ============================================================
  // addReviewComment
  // ============================================================

  describe('addReviewComment', () => {
    it('inserts a review comment for a workflow', async () => {
      mockDb.get.mockResolvedValue({ id: 1, file_id: 5, status: 'in_review' });
      mockDb.run.mockResolvedValue({ lastID: 30 });
      mockDb.all.mockResolvedValue([
        {
          id: 30,
          workflow_id: 1,
          author_email: 'reviewer@test.com',
          comment: 'Looks good!',
          comment_type: 'feedback'
        }
      ]);

      const { fileService } = await import('../../../server/services/file-service');
      await fileService.addReviewComment(
        5,
        'reviewer@test.com',
        'Looks good!',
        'feedback',
        'Reviewer Name',
        'admin'
      );

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deliverable_review_comments'),
        expect.any(Array)
      );
    });
  });

  // ============================================================
  // getReviewComments
  // ============================================================

  describe('getReviewComments', () => {
    it('returns review comments for a deliverable', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, workflow_id: 2, comment: 'First comment', comment_type: 'feedback' },
        { id: 2, workflow_id: 2, comment: 'Approved', comment_type: 'approval' }
      ]);

      const { fileService } = await import('../../../server/services/file-service');
      const comments = await fileService.getReviewComments(5);

      expect(comments).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('dw.file_id = ?'),
        [5]
      );
    });

    it('returns empty array when no comments exist', async () => {
      mockDb.all.mockResolvedValue([]);

      const { fileService } = await import('../../../server/services/file-service');
      const comments = await fileService.getReviewComments(999);

      expect(comments).toEqual([]);
    });
  });

  // ============================================================
  // getDeliverableHistory
  // ============================================================

  describe('getDeliverableHistory', () => {
    it('returns history entries for a deliverable', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, workflow_id: 3, from_status: 'draft', to_status: 'pending_review' },
        { id: 2, workflow_id: 3, from_status: 'pending_review', to_status: 'approved' }
      ]);

      const { fileService } = await import('../../../server/services/file-service');
      const history = await fileService.getDeliverableHistory(5);

      expect(history).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('dw.file_id = ?'),
        [5]
      );
    });

    it('returns empty array when no history exists', async () => {
      mockDb.all.mockResolvedValue([]);

      const { fileService } = await import('../../../server/services/file-service');
      const history = await fileService.getDeliverableHistory(999);

      expect(history).toEqual([]);
    });
  });

  // ============================================================
  // getPendingReviewDeliverables
  // ============================================================

  describe('getPendingReviewDeliverables', () => {
    it('returns all deliverables pending review across projects', async () => {
      mockDb.all.mockResolvedValue([
        {
          id: 1,
          project_id: 10,
          workflow_status: 'pending_review',
          project_name: 'Project A',
          client_name: 'Client A'
        },
        {
          id: 2,
          project_id: 11,
          workflow_status: 'pending_review',
          project_name: 'Project B',
          client_name: null
        }
      ]);

      const { fileService } = await import('../../../server/services/file-service');
      const pending = await fileService.getPendingReviewDeliverables();

      expect(pending).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('dw.status IN (\'pending_review\', \'in_review\')')
      );
    });

    it('returns empty array when nothing is pending', async () => {
      mockDb.all.mockResolvedValue([]);

      const { fileService } = await import('../../../server/services/file-service');
      const pending = await fileService.getPendingReviewDeliverables();

      expect(pending).toEqual([]);
    });
  });
});
