/**
 * ===============================================
 * FILE SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/file-service.test.ts
 *
 * Unit tests for file management service.
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

describe('File Service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T12:00:00Z'));
    mockDb.run.mockReset();
    mockDb.get.mockReset();
    mockDb.all.mockReset();
  });

  describe('getFileById', () => {
    it('returns file when found', async () => {
      mockDb.get.mockResolvedValue({
        id: 1,
        project_id: 10,
        filename: 'test.pdf'
      });

      const { fileService } = await import('../../../server/services/file-service');
      const file = await fileService.getFileById(1);

      expect(file).toMatchObject({ id: 1, project_id: 10 });
      expect(mockDb.get).toHaveBeenCalledWith(
        'SELECT * FROM files WHERE id = ?',
        [1]
      );
    });

    it('returns null when file not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const { fileService } = await import('../../../server/services/file-service');
      const file = await fileService.getFileById(999);

      expect(file).toBeNull();
    });
  });

  describe('Version Management', () => {
    describe('uploadNewVersion', () => {
      it('creates new version and updates main file', async () => {
        mockDb.get.mockResolvedValue({ version: 1 });
        mockDb.run.mockResolvedValue({ lastID: 1 });

        // Mock for getVersion call
        mockDb.get
          .mockResolvedValueOnce({ version: 1 })
          .mockResolvedValueOnce({
            id: 1,
            file_id: 1,
            version_number: 2,
            filename: 'test_v2.pdf'
          });

        const { fileService } = await import('../../../server/services/file-service');

        const version = await fileService.uploadNewVersion(1, {
          filename: 'test_v2.pdf',
          original_filename: 'test.pdf',
          file_path: '/uploads/test_v2.pdf',
          file_size: 1024,
          uploaded_by: 'admin@test.com',
          comment: 'Updated version'
        });

        expect(version.version_number).toBe(2);

        // Should mark existing versions as not current
        expect(mockDb.run).toHaveBeenCalledWith(
          'UPDATE file_versions SET is_current = FALSE WHERE file_id = ?',
          [1]
        );

        // Should insert new version
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO file_versions'),
          expect.arrayContaining([1, 2, 'test_v2.pdf'])
        );

        // Should update main file
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE files SET'),
          expect.arrayContaining([2, 'test_v2.pdf', 1])
        );
      });

      it('throws error when file not found', async () => {
        mockDb.get.mockResolvedValue(null);

        const { fileService } = await import('../../../server/services/file-service');

        await expect(fileService.uploadNewVersion(999, {
          filename: 'test.pdf',
          original_filename: 'test.pdf',
          file_path: '/uploads/test.pdf'
        })).rejects.toThrow('File not found');
      });
    });

    describe('getVersions', () => {
      it('returns all versions ordered by version number', async () => {
        mockDb.all.mockResolvedValue([
          { id: 2, version_number: 2, is_current: true },
          { id: 1, version_number: 1, is_current: false }
        ]);

        const { fileService } = await import('../../../server/services/file-service');
        const versions = await fileService.getVersions(1);

        expect(versions).toHaveLength(2);
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY version_number DESC'),
          [1]
        );
      });
    });

    describe('restoreVersion', () => {
      it('creates new version from restored version', async () => {
        // Mock version to restore
        mockDb.get.mockResolvedValueOnce({
          id: 1,
          file_id: 1,
          version_number: 1,
          filename: 'original.pdf',
          original_filename: 'original.pdf',
          file_path: '/uploads/original.pdf',
          file_size: 512,
          mime_type: 'application/pdf',
          uploaded_by: 'admin@test.com'
        });

        // Mock for uploadNewVersion
        mockDb.get.mockResolvedValueOnce({ version: 2 });
        mockDb.run.mockResolvedValue({ lastID: 3 });
        mockDb.get.mockResolvedValueOnce({
          id: 3,
          file_id: 1,
          version_number: 3,
          filename: 'original.pdf',
          comment: 'Restored from version 1'
        });

        const { fileService } = await import('../../../server/services/file-service');
        const restored = await fileService.restoreVersion(1, 1);

        expect(restored.version_number).toBe(3);
        expect(restored.comment).toContain('Restored from version 1');
      });
    });
  });

  describe('Folder Management', () => {
    describe('createFolder', () => {
      it('creates folder with default values', async () => {
        mockDb.get
          .mockResolvedValueOnce(null) // No existing folder
          .mockResolvedValueOnce({ max_order: 0 }) // Max sort order
          .mockResolvedValueOnce({ id: 1, name: 'New Folder' }); // Created folder

        mockDb.run.mockResolvedValue({ lastID: 1 });

        const { fileService } = await import('../../../server/services/file-service');
        const folder = await fileService.createFolder(10, { name: 'New Folder' });

        expect(folder.name).toBe('New Folder');
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO file_folders'),
          expect.arrayContaining([10, 'New Folder'])
        );
      });

      it('throws error for duplicate folder name', async () => {
        mockDb.get.mockResolvedValueOnce({ id: 1 }); // Existing folder

        const { fileService } = await import('../../../server/services/file-service');

        await expect(fileService.createFolder(10, { name: 'Existing' }))
          .rejects.toThrow('Folder with this name already exists');
      });
    });

    describe('getFolders', () => {
      it('returns folders with counts', async () => {
        mockDb.all.mockResolvedValue([
          { id: 1, name: 'Folder 1', file_count: 5, subfolder_count: 2 }
        ]);

        const { fileService } = await import('../../../server/services/file-service');
        const folders = await fileService.getFolders(10);

        expect(folders[0].file_count).toBe(5);
        expect(folders[0].subfolder_count).toBe(2);
      });

      it('filters by parent folder', async () => {
        mockDb.all.mockResolvedValue([]);

        const { fileService } = await import('../../../server/services/file-service');
        await fileService.getFolders(10, 5);

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('parent_folder_id IS ?'),
          [10, 5]
        );
      });
    });

    describe('moveFolder', () => {
      it('prevents circular reference', async () => {
        // Folder 1 trying to move into folder 2, which is a child of folder 1
        mockDb.get.mockResolvedValueOnce({ parent_folder_id: 1 }); // Folder 2 parent is 1

        const { fileService } = await import('../../../server/services/file-service');

        await expect(fileService.moveFolder(1, 2))
          .rejects.toThrow('Cannot move folder into its own subfolder');
      });

      it('updates parent folder id', async () => {
        mockDb.get.mockResolvedValue({ parent_folder_id: null }); // No circular reference
        mockDb.run.mockResolvedValue({});

        const { fileService } = await import('../../../server/services/file-service');
        await fileService.moveFolder(1, 5);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE file_folders SET parent_folder_id = ?'),
          [5, 1]
        );
      });
    });

    describe('deleteFolder', () => {
      it('moves files before deleting', async () => {
        mockDb.run.mockResolvedValue({});

        const { fileService } = await import('../../../server/services/file-service');
        await fileService.deleteFolder(1, 2);

        expect(mockDb.run).toHaveBeenCalledWith(
          'UPDATE files SET folder_id = ? WHERE folder_id = ?',
          [2, 1]
        );
        expect(mockDb.run).toHaveBeenCalledWith(
          'DELETE FROM file_folders WHERE id = ?',
          [1]
        );
      });
    });
  });

  describe('File Tags', () => {
    describe('addTag', () => {
      it('inserts tag association', async () => {
        mockDb.run.mockResolvedValue({});

        const { fileService } = await import('../../../server/services/file-service');
        await fileService.addTag(1, 5);

        expect(mockDb.run).toHaveBeenCalledWith(
          'INSERT OR IGNORE INTO file_tags (file_id, tag_id) VALUES (?, ?)',
          [1, 5]
        );
      });
    });

    describe('removeTag', () => {
      it('deletes tag association', async () => {
        mockDb.run.mockResolvedValue({});

        const { fileService } = await import('../../../server/services/file-service');
        await fileService.removeTag(1, 5);

        expect(mockDb.run).toHaveBeenCalledWith(
          'DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?',
          [1, 5]
        );
      });
    });

    describe('getFileTags', () => {
      it('returns tags for a file', async () => {
        mockDb.all.mockResolvedValue([
          { id: 1, name: 'Important', color: '#ff0000' }
        ]);

        const { fileService } = await import('../../../server/services/file-service');
        const tags = await fileService.getFileTags(1);

        expect(tags).toHaveLength(1);
        expect(tags[0].name).toBe('Important');
      });
    });
  });

  describe('Access Tracking', () => {
    describe('logAccess', () => {
      it('inserts access log and updates file counters', async () => {
        mockDb.run.mockResolvedValue({});

        const { fileService } = await import('../../../server/services/file-service');
        await fileService.logAccess(1, 'user@test.com', 'client', 'download', '192.168.1.1', 'Chrome');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO file_access_log'),
          [1, 'user@test.com', 'client', 'download', '192.168.1.1', 'Chrome']
        );

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE files SET download_count'),
          [1]
        );
      });
    });

    describe('getAccessStats', () => {
      it('returns aggregated access statistics', async () => {
        mockDb.get.mockResolvedValue({
          total_views: 100,
          total_downloads: 25,
          unique_viewers: 10,
          last_accessed: '2026-02-10T12:00:00Z'
        });

        const { fileService } = await import('../../../server/services/file-service');
        const stats = await fileService.getAccessStats(1);

        expect(stats.total_views).toBe(100);
        expect(stats.total_downloads).toBe(25);
        expect(stats.unique_viewers).toBe(10);
      });
    });
  });

  describe('File Archiving', () => {
    describe('archiveFile', () => {
      it('sets archived flags', async () => {
        mockDb.run.mockResolvedValue({});

        const { fileService } = await import('../../../server/services/file-service');
        await fileService.archiveFile(1, 'admin@test.com');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('SET is_archived = TRUE'),
          ['admin@test.com', 1]
        );
      });
    });

    describe('restoreFile', () => {
      it('clears archived flags', async () => {
        mockDb.run.mockResolvedValue({});

        const { fileService } = await import('../../../server/services/file-service');
        await fileService.restoreFile(1);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('SET is_archived = FALSE'),
          [1]
        );
      });
    });

    describe('processExpiredFiles', () => {
      it('archives files past expiration date', async () => {
        mockDb.run.mockResolvedValue({ changes: 5 });

        const { fileService } = await import('../../../server/services/file-service');
        const count = await fileService.processExpiredFiles();

        expect(count).toBe(5);
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('WHERE expires_at IS NOT NULL AND expires_at <= datetime')
        );
      });
    });
  });

  describe('File Locking', () => {
    describe('lockFile', () => {
      it('locks unlocked file', async () => {
        mockDb.get.mockResolvedValue({ is_locked: false });
        mockDb.run.mockResolvedValue({});

        const { fileService } = await import('../../../server/services/file-service');
        await fileService.lockFile(1, 'admin@test.com');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('SET is_locked = TRUE'),
          ['admin@test.com', 1]
        );
      });

      it('throws error if already locked', async () => {
        mockDb.get.mockResolvedValue({ is_locked: true, locked_by: 'other@test.com' });

        const { fileService } = await import('../../../server/services/file-service');

        await expect(fileService.lockFile(1, 'admin@test.com'))
          .rejects.toThrow('File is already locked by other@test.com');
      });
    });

    describe('unlockFile', () => {
      it('allows user who locked to unlock', async () => {
        mockDb.get.mockResolvedValue({ locked_by: 'admin@test.com' });
        mockDb.run.mockResolvedValue({});

        const { fileService } = await import('../../../server/services/file-service');
        await fileService.unlockFile(1, 'admin@test.com');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('SET is_locked = FALSE'),
          [1]
        );
      });

      it('allows admin to unlock any file', async () => {
        mockDb.get.mockResolvedValue({ locked_by: 'other@test.com' });
        mockDb.run.mockResolvedValue({});

        const { fileService } = await import('../../../server/services/file-service');
        await fileService.unlockFile(1, 'admin@test.com', true);

        expect(mockDb.run).toHaveBeenCalled();
      });

      it('throws error for non-owner non-admin', async () => {
        mockDb.get.mockResolvedValue({ locked_by: 'other@test.com' });

        const { fileService } = await import('../../../server/services/file-service');

        await expect(fileService.unlockFile(1, 'user@test.com', false))
          .rejects.toThrow('Only the user who locked the file or an admin can unlock it');
      });
    });
  });

  describe('File Statistics', () => {
    describe('getFileStats', () => {
      it('returns comprehensive file statistics', async () => {
        mockDb.get.mockResolvedValue({
          total_files: 50,
          total_size: 1024000,
          archived_count: 5,
          recent_uploads: 10,
          expiring_soon: 2
        });
        mockDb.all
          .mockResolvedValueOnce([{ category: 'document', count: 30 }, { category: 'image', count: 20 }])
          .mockResolvedValueOnce([{ file_type: 'pdf', count: 25 }, { file_type: 'png', count: 15 }]);

        const { fileService } = await import('../../../server/services/file-service');
        const stats = await fileService.getFileStats(10);

        expect(stats.total_files).toBe(50);
        expect(stats.by_category.document).toBe(30);
        expect(stats.by_type.pdf).toBe(25);
      });
    });
  });

  describe('File Search', () => {
    describe('searchFiles', () => {
      it('searches by filename and description', async () => {
        mockDb.all.mockResolvedValue([
          { id: 1, original_filename: 'report.pdf' }
        ]);

        const { fileService } = await import('../../../server/services/file-service');
        const results = await fileService.searchFiles(10, 'report');

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('original_filename LIKE ?'),
          expect.arrayContaining([10, '%report%', '%report%'])
        );
      });

      it('filters by category', async () => {
        mockDb.all.mockResolvedValue([]);

        const { fileService } = await import('../../../server/services/file-service');
        await fileService.searchFiles(10, 'test', { category: 'document' });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('category = ?'),
          expect.arrayContaining(['document'])
        );
      });

      it('includes archived when specified', async () => {
        mockDb.all.mockResolvedValue([]);

        const { fileService } = await import('../../../server/services/file-service');
        await fileService.searchFiles(10, 'test', { include_archived: true });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.not.stringContaining('is_archived = FALSE'),
          expect.any(Array)
        );
      });
    });
  });

  describe('Deliverable Workflow', () => {
    describe('submitForReview', () => {
      it('updates workflow status to pending_review', async () => {
        mockDb.get
          .mockResolvedValueOnce({ id: 1, project_id: 10 }) // File
          .mockResolvedValueOnce({ id: 1, status: 'draft' }) // Existing workflow
          .mockResolvedValueOnce({ id: 1, status: 'pending_review' }); // Updated workflow

        mockDb.run.mockResolvedValue({});

        const { fileService } = await import('../../../server/services/file-service');
        const workflow = await fileService.submitForReview(1, 'user@test.com', 'Ready for review');

        expect(workflow.status).toBe('pending_review');
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining("SET status = 'pending_review'"),
          expect.any(Array)
        );
      });
    });

    describe('approveDeliverable', () => {
      it('updates workflow status to approved', async () => {
        // Track call count to return different values
        let getCallCount = 0;
        mockDb.get.mockImplementation(() => {
          getCallCount++;
          if (getCallCount === 1) {
            // First call: return workflow for validation
            return Promise.resolve({ id: 1, file_id: 1, status: 'in_review' });
          }
          // Subsequent calls: return updated workflow
          return Promise.resolve({ id: 1, file_id: 1, status: 'approved', approved_by: 'admin@test.com' });
        });

        mockDb.run.mockResolvedValue({});

        const { fileService } = await import('../../../server/services/file-service');
        const workflow = await fileService.approveDeliverable(1, 'admin@test.com', 'Looks great!');

        expect(workflow?.status).toBe('approved');
      });

      it('throws error when workflow not found', async () => {
        mockDb.get.mockResolvedValue(null);

        const { fileService } = await import('../../../server/services/file-service');

        await expect(fileService.approveDeliverable(999, 'admin@test.com'))
          .rejects.toThrow('Deliverable workflow not found');
      });
    });

    describe('getDeliverableStats', () => {
      it('returns status counts', async () => {
        mockDb.all.mockResolvedValue([
          { status: 'draft', count: 5 },
          { status: 'approved', count: 10 },
          { status: 'pending_review', count: 3 }
        ]);

        const { fileService } = await import('../../../server/services/file-service');
        const stats = await fileService.getDeliverableStats(10);

        expect(stats.total).toBe(18);
        expect(stats.draft).toBe(5);
        expect(stats.approved).toBe(10);
        expect(stats.pending_review).toBe(3);
      });
    });
  });

  describe('createFileFromDeliverable', () => {
    it('creates file entry from approved deliverable', async () => {
      mockDb.run.mockResolvedValue({ lastID: 100 });
      mockDb.get.mockResolvedValue({
        id: 100,
        project_id: 10,
        category: 'deliverable',
        shared_with_client: true
      });

      const { fileService } = await import('../../../server/services/file-service');
      const file = await fileService.createFileFromDeliverable({
        projectId: 10,
        deliverableId: 5,
        deliverableTitle: 'Final Design',
        filePath: '/uploads/design.pdf',
        fileName: 'design.pdf',
        fileSize: 2048,
        fileType: 'application/pdf',
        uploadedBy: 'admin@test.com'
      });

      expect(file.id).toBe(100);
      // The SQL uses 'deliverable' as a literal value and TRUE for shared_with_client
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("'deliverable'"),
        expect.any(Array)
      );
    });

    it('detects file type from mime type', async () => {
      mockDb.run.mockResolvedValue({ lastID: 101 });
      mockDb.get.mockResolvedValue({ id: 101, project_id: 10 });

      const { fileService } = await import('../../../server/services/file-service');
      await fileService.createFileFromDeliverable({
        projectId: 10,
        deliverableId: 5,
        deliverableTitle: 'Image',
        filePath: '/uploads/image.png',
        fileName: 'image.png',
        fileSize: 1024,
        fileType: 'image/png',
        uploadedBy: 'admin@test.com'
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['image'])
      );
    });
  });
});
