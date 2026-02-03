/**
 * ===============================================
 * FILE SERVICE
 * ===============================================
 * Handles file versioning, folders, tags, access tracking,
 * comments, archiving, and file organization.
 */

import { getDatabase } from '../database/init.js';

// ============================================
// Types
// ============================================

interface FileVersion {
  id: number;
  file_id: number;
  version_number: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  comment: string | null;
  is_current: boolean;
  created_at: string;
}

interface FileFolder {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  parent_folder_id: number | null;
  color: string;
  icon: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  file_count?: number;
  subfolder_count?: number;
}

interface FileComment {
  id: number;
  file_id: number;
  author_email: string;
  author_type: 'admin' | 'client';
  author_name: string | null;
  content: string;
  is_internal: boolean;
  parent_comment_id: number | null;
  created_at: string;
  updated_at: string;
  replies?: FileComment[];
}

interface FileAccessLog {
  id: number;
  file_id: number;
  user_email: string;
  user_type: 'admin' | 'client';
  access_type: 'view' | 'download' | 'preview';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface FileStats {
  total_files: number;
  total_size: number;
  by_category: Record<string, number>;
  by_type: Record<string, number>;
  recent_uploads: number;
  archived_count: number;
  expiring_soon: number;
}

type FileCategory = 'general' | 'deliverable' | 'source' | 'asset' | 'document' | 'contract' | 'invoice';

// ============================================
// File Service Class
// ============================================

class FileService {
  // ============================================
  // FILE RETRIEVAL
  // ============================================

  /**
   * Get a file by its ID
   */
  async getFileById(fileId: number): Promise<{ id: number; project_id: number; [key: string]: unknown } | null> {
    const db = getDatabase();
    const file = await db.get('SELECT * FROM files WHERE id = ?', [fileId]);
    return file as { id: number; project_id: number; [key: string]: unknown } | null;
  }

  // ============================================
  // VERSION MANAGEMENT
  // ============================================

  /**
   * Upload a new version of a file
   */
  async uploadNewVersion(
    fileId: number,
    versionData: {
      filename: string;
      original_filename: string;
      file_path: string;
      file_size?: number;
      mime_type?: string;
      uploaded_by?: string;
      comment?: string;
    }
  ): Promise<FileVersion> {
    const db = getDatabase();

    // Get current version number
    const file = await db.get('SELECT version FROM files WHERE id = ?', [fileId]);
    if (!file) {
      throw new Error('File not found');
    }

    const newVersionNumber = (Number(file.version) || 1) + 1;

    // Mark all existing versions as not current
    await db.run(
      'UPDATE file_versions SET is_current = FALSE WHERE file_id = ?',
      [fileId]
    );

    // Insert new version
    const result = await db.run(
      `INSERT INTO file_versions (
        file_id, version_number, filename, original_filename, file_path,
        file_size, mime_type, uploaded_by, comment, is_current
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        fileId,
        newVersionNumber,
        versionData.filename,
        versionData.original_filename,
        versionData.file_path,
        versionData.file_size || null,
        versionData.mime_type || null,
        versionData.uploaded_by || null,
        versionData.comment || null
      ]
    );

    // Update main file record
    await db.run(
      `UPDATE files SET
        version = ?,
        filename = ?,
        original_filename = ?,
        file_path = ?,
        file_size = ?,
        mime_type = ?
      WHERE id = ?`,
      [
        newVersionNumber,
        versionData.filename,
        versionData.original_filename,
        versionData.file_path,
        versionData.file_size || null,
        versionData.mime_type || null,
        fileId
      ]
    );

    return this.getVersion(result.lastID!);
  }

  /**
   * Get all versions of a file
   */
  async getVersions(fileId: number): Promise<FileVersion[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT * FROM file_versions
       WHERE file_id = ?
       ORDER BY version_number DESC`,
      [fileId]
    );
    return rows as unknown as FileVersion[];
  }

  /**
   * Get a specific version
   */
  async getVersion(versionId: number): Promise<FileVersion> {
    const db = getDatabase();
    const version = await db.get(
      'SELECT * FROM file_versions WHERE id = ?',
      [versionId]
    );
    if (!version) {
      throw new Error('Version not found');
    }
    return version as unknown as FileVersion;
  }

  /**
   * Restore a previous version
   */
  async restoreVersion(fileId: number, versionId: number): Promise<FileVersion> {
    const db = getDatabase();

    const version = await db.get(
      'SELECT * FROM file_versions WHERE id = ? AND file_id = ?',
      [versionId, fileId]
    );
    if (!version) {
      throw new Error('Version not found');
    }

    // Create a new version from the restored one
    return this.uploadNewVersion(fileId, {
      filename: String(version.filename),
      original_filename: String(version.original_filename),
      file_path: String(version.file_path),
      file_size: version.file_size as number | undefined,
      mime_type: version.mime_type as string | undefined,
      uploaded_by: version.uploaded_by as string | undefined,
      comment: `Restored from version ${version.version_number}`
    });
  }

  // ============================================
  // FOLDER MANAGEMENT
  // ============================================

  /**
   * Create a new folder
   */
  async createFolder(
    projectId: number,
    data: {
      name: string;
      description?: string;
      parent_folder_id?: number;
      color?: string;
      icon?: string;
      created_by?: string;
    }
  ): Promise<FileFolder> {
    const db = getDatabase();

    // Check for duplicate name in same parent
    const existing = await db.get(
      `SELECT id FROM file_folders
       WHERE project_id = ? AND name = ? AND parent_folder_id IS ?`,
      [projectId, data.name, data.parent_folder_id || null]
    );
    if (existing) {
      throw new Error('Folder with this name already exists');
    }

    // Get next sort order
    const maxOrder = await db.get(
      `SELECT MAX(sort_order) as max_order FROM file_folders
       WHERE project_id = ? AND parent_folder_id IS ?`,
      [projectId, data.parent_folder_id || null]
    );

    const result = await db.run(
      `INSERT INTO file_folders (
        project_id, name, description, parent_folder_id, color, icon, sort_order, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        data.name,
        data.description || null,
        data.parent_folder_id || null,
        data.color || '#6b7280',
        data.icon || 'folder',
        (Number(maxOrder?.max_order) || 0) + 1,
        data.created_by || null
      ]
    );

    return this.getFolder(result.lastID!);
  }

  /**
   * Get all folders for a project
   */
  async getFolders(projectId: number, parentId?: number): Promise<FileFolder[]> {
    const db = getDatabase();

    let query = `
      SELECT ff.*,
        (SELECT COUNT(*) FROM files WHERE folder_id = ff.id) as file_count,
        (SELECT COUNT(*) FROM file_folders WHERE parent_folder_id = ff.id) as subfolder_count
      FROM file_folders ff
      WHERE ff.project_id = ?
    `;
    const params: (number | null)[] = [projectId];

    if (parentId !== undefined) {
      query += ' AND ff.parent_folder_id IS ?';
      params.push(parentId || null);
    }

    query += ' ORDER BY ff.sort_order, ff.name';

    const rows = await db.all(query, params);
    return rows as unknown as FileFolder[];
  }

  /**
   * Get a single folder
   */
  async getFolder(folderId: number): Promise<FileFolder> {
    const db = getDatabase();
    const folder = await db.get(
      `SELECT ff.*,
        (SELECT COUNT(*) FROM files WHERE folder_id = ff.id) as file_count,
        (SELECT COUNT(*) FROM file_folders WHERE parent_folder_id = ff.id) as subfolder_count
      FROM file_folders ff
      WHERE ff.id = ?`,
      [folderId]
    );
    if (!folder) {
      throw new Error('Folder not found');
    }
    return folder as unknown as FileFolder;
  }

  /**
   * Update a folder
   */
  async updateFolder(
    folderId: number,
    data: Partial<{
      name: string;
      description: string;
      color: string;
      icon: string;
      sort_order: number;
    }>
  ): Promise<FileFolder> {
    const db = getDatabase();

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      values.push(data.color);
    }
    if (data.icon !== undefined) {
      updates.push('icon = ?');
      values.push(data.icon);
    }
    if (data.sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(data.sort_order);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(folderId);
      await db.run(
        `UPDATE file_folders SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return this.getFolder(folderId);
  }

  /**
   * Delete a folder
   */
  async deleteFolder(folderId: number, moveFilesTo?: number): Promise<void> {
    const db = getDatabase();

    // Move files to another folder or root if specified
    if (moveFilesTo !== undefined) {
      await db.run(
        'UPDATE files SET folder_id = ? WHERE folder_id = ?',
        [moveFilesTo || null, folderId]
      );
    }

    // Delete folder (cascade will handle subfolders)
    await db.run('DELETE FROM file_folders WHERE id = ?', [folderId]);
  }

  /**
   * Move a file to a folder
   */
  async moveFile(fileId: number, folderId: number | null): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE files SET folder_id = ? WHERE id = ?',
      [folderId, fileId]
    );
  }

  /**
   * Move a folder to a new parent
   */
  async moveFolder(folderId: number, newParentId: number | null): Promise<void> {
    const db = getDatabase();

    // Check for circular reference
    if (newParentId) {
      let parentId: number | null = newParentId;
      while (parentId) {
        if (parentId === folderId) {
          throw new Error('Cannot move folder into its own subfolder');
        }
        const parent = await db.get(
          'SELECT parent_folder_id FROM file_folders WHERE id = ?',
          [parentId]
        );
        parentId = (parent?.parent_folder_id as number | null) ?? null;
      }
    }

    await db.run(
      'UPDATE file_folders SET parent_folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newParentId, folderId]
    );
  }

  // ============================================
  // FILE TAGS
  // ============================================

  /**
   * Add a tag to a file
   */
  async addTag(fileId: number, tagId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'INSERT OR IGNORE INTO file_tags (file_id, tag_id) VALUES (?, ?)',
      [fileId, tagId]
    );
  }

  /**
   * Remove a tag from a file
   */
  async removeTag(fileId: number, tagId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      'DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?',
      [fileId, tagId]
    );
  }

  /**
   * Get tags for a file
   */
  async getFileTags(fileId: number): Promise<{ id: number; name: string; color: string }[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT t.id, t.name, t.color
       FROM tags t
       JOIN file_tags ft ON t.id = ft.tag_id
       WHERE ft.file_id = ?
       ORDER BY t.name`,
      [fileId]
    );
    return rows as unknown as { id: number; name: string; color: string }[];
  }

  /**
   * Get files by tag
   */
  async getFilesByTag(projectId: number, tagId: number): Promise<any[]> {
    const db = getDatabase();
    return db.all(
      `SELECT f.*
       FROM files f
       JOIN file_tags ft ON f.id = ft.file_id
       WHERE f.project_id = ? AND ft.tag_id = ?
       ORDER BY f.created_at DESC`,
      [projectId, tagId]
    );
  }

  // ============================================
  // ACCESS TRACKING
  // ============================================

  /**
   * Log file access
   */
  async logAccess(
    fileId: number,
    userEmail: string,
    userType: 'admin' | 'client',
    accessType: 'view' | 'download' | 'preview',
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const db = getDatabase();

    await db.run(
      `INSERT INTO file_access_log (file_id, user_email, user_type, access_type, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fileId, userEmail, userType, accessType, ipAddress || null, userAgent || null]
    );

    // Update file access count
    const countField = accessType === 'download' ? 'download_count' : 'access_count';
    await db.run(
      `UPDATE files SET ${countField} = ${countField} + 1, last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [fileId]
    );
  }

  /**
   * Get access log for a file
   */
  async getAccessLog(fileId: number, limit: number = 50): Promise<FileAccessLog[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT * FROM file_access_log
       WHERE file_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [fileId, limit]
    );
    return rows as unknown as FileAccessLog[];
  }

  /**
   * Get access stats for a file
   */
  async getAccessStats(fileId: number): Promise<{
    total_views: number;
    total_downloads: number;
    unique_viewers: number;
    last_accessed: string | null;
  }> {
    const db = getDatabase();
    const stats = await db.get(
      `SELECT
        COUNT(CASE WHEN access_type IN ('view', 'preview') THEN 1 END) as total_views,
        COUNT(CASE WHEN access_type = 'download' THEN 1 END) as total_downloads,
        COUNT(DISTINCT user_email) as unique_viewers,
        MAX(created_at) as last_accessed
      FROM file_access_log
      WHERE file_id = ?`,
      [fileId]
    );
    return {
      total_views: Number(stats?.total_views ?? 0),
      total_downloads: Number(stats?.total_downloads ?? 0),
      unique_viewers: Number(stats?.unique_viewers ?? 0),
      last_accessed: (stats?.last_accessed as string | null) ?? null
    };
  }

  // ============================================
  // FILE COMMENTS
  // ============================================

  /**
   * Add a comment to a file
   */
  async addComment(
    fileId: number,
    authorEmail: string,
    authorType: 'admin' | 'client',
    content: string,
    authorName?: string,
    isInternal: boolean = false,
    parentCommentId?: number
  ): Promise<FileComment> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO file_comments (file_id, author_email, author_type, author_name, content, is_internal, parent_comment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [fileId, authorEmail, authorType, authorName || null, content, isInternal, parentCommentId || null]
    );

    return this.getComment(result.lastID!);
  }

  /**
   * Get comments for a file
   */
  async getComments(fileId: number, includeInternal: boolean = false): Promise<FileComment[]> {
    const db = getDatabase();

    let query = `
      SELECT * FROM file_comments
      WHERE file_id = ? AND parent_comment_id IS NULL
    `;
    if (!includeInternal) {
      query += ' AND is_internal = FALSE';
    }
    query += ' ORDER BY created_at ASC';

    const comments = await db.all(query, [fileId]);

    // Get replies for each comment
    for (const comment of comments) {
      let replyQuery = `
        SELECT * FROM file_comments
        WHERE parent_comment_id = ?
      `;
      if (!includeInternal) {
        replyQuery += ' AND is_internal = FALSE';
      }
      replyQuery += ' ORDER BY created_at ASC';

      comment.replies = await db.all(replyQuery, [comment.id as number]);
    }

    return comments as unknown as FileComment[];
  }

  /**
   * Get a single comment
   */
  async getComment(commentId: number): Promise<FileComment> {
    const db = getDatabase();
    const comment = await db.get(
      'SELECT * FROM file_comments WHERE id = ?',
      [commentId]
    );
    if (!comment) {
      throw new Error('Comment not found');
    }
    return comment as unknown as FileComment;
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM file_comments WHERE id = ?', [commentId]);
  }

  // ============================================
  // FILE ARCHIVING & EXPIRATION
  // ============================================

  /**
   * Archive a file
   */
  async archiveFile(fileId: number, archivedBy: string): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE files SET is_archived = TRUE, archived_at = CURRENT_TIMESTAMP, archived_by = ? WHERE id = ?`,
      [archivedBy, fileId]
    );
  }

  /**
   * Restore a file from archive
   */
  async restoreFile(fileId: number): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE files SET is_archived = FALSE, archived_at = NULL, archived_by = NULL WHERE id = ?`,
      [fileId]
    );
  }

  /**
   * Get archived files for a project
   */
  async getArchivedFiles(projectId: number): Promise<any[]> {
    const db = getDatabase();
    return db.all(
      `SELECT * FROM files WHERE project_id = ? AND is_archived = TRUE ORDER BY archived_at DESC`,
      [projectId]
    );
  }

  /**
   * Set file expiration
   */
  async setExpiration(fileId: number, expiresAt: string | null): Promise<void> {
    const db = getDatabase();
    await db.run(
      'UPDATE files SET expires_at = ? WHERE id = ?',
      [expiresAt, fileId]
    );
  }

  /**
   * Get files expiring soon
   */
  async getExpiringFiles(daysAhead: number = 7): Promise<any[]> {
    const db = getDatabase();
    return db.all(
      `SELECT f.*, p.project_name
       FROM files f
       JOIN projects p ON f.project_id = p.id
       WHERE f.expires_at IS NOT NULL
       AND f.expires_at <= datetime('now', '+' || ? || ' days')
       AND f.expires_at > datetime('now')
       AND f.is_archived = FALSE
       ORDER BY f.expires_at ASC`,
      [daysAhead]
    );
  }

  /**
   * Process expired files (archive them)
   */
  async processExpiredFiles(): Promise<number> {
    const db = getDatabase();
    const result = await db.run(
      `UPDATE files SET is_archived = TRUE, archived_at = CURRENT_TIMESTAMP, archived_by = 'system'
       WHERE expires_at IS NOT NULL AND expires_at <= datetime('now') AND is_archived = FALSE`
    );
    return result.changes || 0;
  }

  // ============================================
  // FILE LOCKING
  // ============================================

  /**
   * Lock a file for editing
   */
  async lockFile(fileId: number, lockedBy: string): Promise<void> {
    const db = getDatabase();

    const file = await db.get('SELECT is_locked, locked_by FROM files WHERE id = ?', [fileId]);
    if (file?.is_locked) {
      throw new Error(`File is already locked by ${file.locked_by}`);
    }

    await db.run(
      `UPDATE files SET is_locked = TRUE, locked_by = ?, locked_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [lockedBy, fileId]
    );
  }

  /**
   * Unlock a file
   */
  async unlockFile(fileId: number, userEmail: string, isAdmin: boolean = false): Promise<void> {
    const db = getDatabase();

    const file = await db.get('SELECT locked_by FROM files WHERE id = ?', [fileId]);
    if (file?.locked_by !== userEmail && !isAdmin) {
      throw new Error('Only the user who locked the file or an admin can unlock it');
    }

    await db.run(
      `UPDATE files SET is_locked = FALSE, locked_by = NULL, locked_at = NULL WHERE id = ?`,
      [fileId]
    );
  }

  // ============================================
  // FILE CATEGORY
  // ============================================

  /**
   * Set file category
   */
  async setCategory(fileId: number, category: FileCategory): Promise<void> {
    const db = getDatabase();
    await db.run('UPDATE files SET category = ? WHERE id = ?', [category, fileId]);
  }

  /**
   * Get files by category
   */
  async getFilesByCategory(projectId: number, category: FileCategory): Promise<any[]> {
    const db = getDatabase();
    return db.all(
      `SELECT * FROM files WHERE project_id = ? AND category = ? AND is_archived = FALSE ORDER BY created_at DESC`,
      [projectId, category]
    );
  }

  // ============================================
  // FILE STATISTICS
  // ============================================

  /**
   * Get file statistics for a project
   */
  async getFileStats(projectId: number): Promise<FileStats> {
    const db = getDatabase();

    const stats = await db.get(
      `SELECT
        COUNT(*) as total_files,
        COALESCE(SUM(file_size), 0) as total_size,
        COUNT(CASE WHEN is_archived = TRUE THEN 1 END) as archived_count,
        COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as recent_uploads,
        COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at <= datetime('now', '+7 days') AND expires_at > datetime('now') THEN 1 END) as expiring_soon
      FROM files
      WHERE project_id = ?`,
      [projectId]
    );

    // Get by category
    const categoryStats = await db.all(
      `SELECT category, COUNT(*) as count FROM files WHERE project_id = ? AND is_archived = FALSE GROUP BY category`,
      [projectId]
    );
    const byCategory: Record<string, number> = {};
    for (const row of categoryStats) {
      byCategory[String(row.category || 'general')] = Number(row.count);
    }

    // Get by type
    const typeStats = await db.all(
      `SELECT file_type, COUNT(*) as count FROM files WHERE project_id = ? AND is_archived = FALSE GROUP BY file_type`,
      [projectId]
    );
    const byType: Record<string, number> = {};
    for (const row of typeStats) {
      byType[String(row.file_type || 'other')] = Number(row.count);
    }

    return {
      total_files: Number(stats?.total_files ?? 0),
      total_size: Number(stats?.total_size ?? 0),
      by_category: byCategory,
      by_type: byType,
      recent_uploads: Number(stats?.recent_uploads ?? 0),
      archived_count: Number(stats?.archived_count ?? 0),
      expiring_soon: Number(stats?.expiring_soon ?? 0)
    };
  }

  /**
   * Search files
   */
  async searchFiles(
    projectId: number,
    query: string,
    options: {
      folder_id?: number;
      category?: FileCategory;
      include_archived?: boolean;
      limit?: number;
    } = {}
  ): Promise<any[]> {
    const db = getDatabase();
    const searchPattern = `%${query}%`;

    let sql = `
      SELECT f.*, ff.name as folder_name
      FROM files f
      LEFT JOIN file_folders ff ON f.folder_id = ff.id
      WHERE f.project_id = ?
      AND (f.original_filename LIKE ? OR f.description LIKE ?)
    `;
    const params: (string | number)[] = [projectId, searchPattern, searchPattern];

    if (!options.include_archived) {
      sql += ' AND f.is_archived = FALSE';
    }

    if (options.folder_id !== undefined) {
      sql += ' AND f.folder_id = ?';
      params.push(options.folder_id);
    }

    if (options.category) {
      sql += ' AND f.category = ?';
      params.push(options.category);
    }

    sql += ` ORDER BY f.created_at DESC LIMIT ?`;
    params.push(options.limit || 50);

    return db.all(sql, params);
  }

  // ============================================
  // DELIVERABLE WORKFLOW METHODS
  // ============================================

  /**
   * Deliverable workflow status types
   */
  static readonly DELIVERABLE_STATUSES = [
    'draft',
    'pending_review',
    'in_review',
    'changes_requested',
    'approved',
    'rejected'
  ] as const;

  /**
   * Create or get deliverable workflow for a file
   */
  async getOrCreateDeliverableWorkflow(fileId: number, projectId: number): Promise<any> {
    const db = getDatabase();

    // Check if workflow exists
    let workflow = await db.get(
      'SELECT * FROM deliverable_workflows WHERE file_id = ?',
      [fileId]
    );

    if (!workflow) {
      // Create new workflow
      const result = await db.run(
        `INSERT INTO deliverable_workflows (file_id, project_id, status) VALUES (?, ?, 'draft')`,
        [fileId, projectId]
      );
      workflow = await db.get(
        'SELECT * FROM deliverable_workflows WHERE id = ?',
        [result.lastID]
      );
    }

    return workflow;
  }

  /**
   * Get deliverable workflow by file ID
   */
  async getDeliverableWorkflow(fileId: number): Promise<any> {
    const db = getDatabase();
    return db.get('SELECT * FROM deliverable_workflows WHERE file_id = ?', [fileId]);
  }

  /**
   * Get all deliverables for a project with workflow status
   */
  async getProjectDeliverables(projectId: number, status?: string): Promise<any[]> {
    const db = getDatabase();
    let sql = `
      SELECT f.*, dw.status as workflow_status, dw.submitted_at, dw.reviewed_at,
             dw.approved_at, dw.reviewed_by, dw.approved_by, dw.rejection_reason, dw.version
      FROM files f
      LEFT JOIN deliverable_workflows dw ON f.id = dw.file_id
      WHERE f.project_id = ? AND f.category = 'deliverable' AND f.is_archived = FALSE
    `;
    const params: (string | number)[] = [projectId];

    if (status) {
      sql += ' AND dw.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY f.created_at DESC';
    return db.all(sql, params);
  }

  /**
   * Submit deliverable for review
   */
  async submitForReview(fileId: number, submittedBy: string, notes?: string): Promise<any> {
    const db = getDatabase();
    const file = await this.getFileById(fileId);
    if (!file) throw new Error('File not found');

    // Get or create workflow
    const workflow = await this.getOrCreateDeliverableWorkflow(fileId, file.project_id);

    // Update status
    await db.run(
      `UPDATE deliverable_workflows
       SET status = 'pending_review', submitted_at = CURRENT_TIMESTAMP, submitted_by = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [submittedBy, notes || null, workflow.id]
    );

    // Log history
    await this.logDeliverableHistory(workflow.id, workflow.status, 'pending_review', submittedBy, notes);

    return this.getDeliverableWorkflow(fileId);
  }

  /**
   * Start review of deliverable
   */
  async startReview(fileId: number, reviewerEmail: string): Promise<any> {
    const db = getDatabase();
    const workflow = await this.getDeliverableWorkflow(fileId);
    if (!workflow) throw new Error('Deliverable workflow not found');

    await db.run(
      `UPDATE deliverable_workflows
       SET status = 'in_review', reviewed_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reviewerEmail, workflow.id]
    );

    await this.logDeliverableHistory(workflow.id, workflow.status, 'in_review', reviewerEmail);

    return this.getDeliverableWorkflow(fileId);
  }

  /**
   * Request changes to deliverable
   */
  async requestChanges(fileId: number, reviewerEmail: string, feedback: string): Promise<any> {
    const db = getDatabase();
    const workflow = await this.getDeliverableWorkflow(fileId);
    if (!workflow) throw new Error('Deliverable workflow not found');

    await db.run(
      `UPDATE deliverable_workflows
       SET status = 'changes_requested', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reviewerEmail, feedback, workflow.id]
    );

    // Add review comment
    await this.addReviewComment(workflow.id, reviewerEmail, 'admin', feedback, 'revision_request');

    await this.logDeliverableHistory(workflow.id, workflow.status, 'changes_requested', reviewerEmail, feedback);

    return this.getDeliverableWorkflow(fileId);
  }

  /**
   * Approve deliverable
   */
  async approveDeliverable(fileId: number, approverEmail: string, comment?: string): Promise<any> {
    const db = getDatabase();
    const workflow = await this.getDeliverableWorkflow(fileId);
    if (!workflow) throw new Error('Deliverable workflow not found');

    await db.run(
      `UPDATE deliverable_workflows
       SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [approverEmail, workflow.id]
    );

    if (comment) {
      await this.addReviewComment(workflow.id, approverEmail, 'admin', comment, 'approval');
    }

    await this.logDeliverableHistory(workflow.id, workflow.status, 'approved', approverEmail, comment);

    return this.getDeliverableWorkflow(fileId);
  }

  /**
   * Reject deliverable
   */
  async rejectDeliverable(fileId: number, reviewerEmail: string, reason: string): Promise<any> {
    const db = getDatabase();
    const workflow = await this.getDeliverableWorkflow(fileId);
    if (!workflow) throw new Error('Deliverable workflow not found');

    await db.run(
      `UPDATE deliverable_workflows
       SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reviewerEmail, reason, workflow.id]
    );

    await this.addReviewComment(workflow.id, reviewerEmail, 'admin', reason, 'rejection');
    await this.logDeliverableHistory(workflow.id, workflow.status, 'rejected', reviewerEmail, reason);

    return this.getDeliverableWorkflow(fileId);
  }

  /**
   * Resubmit deliverable (after changes requested)
   */
  async resubmitDeliverable(fileId: number, submittedBy: string, notes?: string): Promise<any> {
    const db = getDatabase();
    const workflow = await this.getDeliverableWorkflow(fileId);
    if (!workflow) throw new Error('Deliverable workflow not found');

    await db.run(
      `UPDATE deliverable_workflows
       SET status = 'pending_review', submitted_at = CURRENT_TIMESTAMP, submitted_by = ?,
           version = version + 1, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [submittedBy, notes || null, workflow.id]
    );

    await this.logDeliverableHistory(workflow.id, workflow.status, 'pending_review', submittedBy, notes);

    return this.getDeliverableWorkflow(fileId);
  }

  /**
   * Add review comment
   */
  async addReviewComment(
    workflowId: number,
    authorEmail: string,
    authorType: 'admin' | 'client',
    comment: string,
    commentType: 'feedback' | 'approval' | 'rejection' | 'revision_request' = 'feedback',
    authorName?: string
  ): Promise<any> {
    const db = getDatabase();
    const result = await db.run(
      `INSERT INTO deliverable_review_comments
       (workflow_id, author_email, author_name, author_type, comment, comment_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [workflowId, authorEmail, authorName || null, authorType, comment, commentType]
    );
    return db.get('SELECT * FROM deliverable_review_comments WHERE id = ?', [result.lastID]);
  }

  /**
   * Get review comments for a deliverable
   */
  async getReviewComments(fileId: number): Promise<any[]> {
    const db = getDatabase();
    return db.all(
      `SELECT drc.*
       FROM deliverable_review_comments drc
       JOIN deliverable_workflows dw ON drc.workflow_id = dw.id
       WHERE dw.file_id = ?
       ORDER BY drc.created_at DESC`,
      [fileId]
    );
  }

  /**
   * Get deliverable history
   */
  async getDeliverableHistory(fileId: number): Promise<any[]> {
    const db = getDatabase();
    return db.all(
      `SELECT dh.*
       FROM deliverable_history dh
       JOIN deliverable_workflows dw ON dh.workflow_id = dw.id
       WHERE dw.file_id = ?
       ORDER BY dh.created_at DESC`,
      [fileId]
    );
  }

  /**
   * Log deliverable status change
   */
  private async logDeliverableHistory(
    workflowId: number,
    fromStatus: string | null,
    toStatus: string,
    changedBy: string,
    notes?: string
  ): Promise<void> {
    const db = getDatabase();
    await db.run(
      `INSERT INTO deliverable_history (workflow_id, from_status, to_status, changed_by, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [workflowId, fromStatus, toStatus, changedBy, notes || null]
    );
  }

  /**
   * Get deliverables pending review (for admin dashboard)
   */
  async getPendingReviewDeliverables(): Promise<any[]> {
    const db = getDatabase();
    return db.all(
      `SELECT f.*, dw.status as workflow_status, dw.submitted_at, dw.submitted_by,
              p.project_name, c.company_name as client_name
       FROM files f
       JOIN deliverable_workflows dw ON f.id = dw.file_id
       JOIN projects p ON f.project_id = p.id
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE dw.status IN ('pending_review', 'in_review')
       ORDER BY dw.submitted_at ASC`
    );
  }

  /**
   * Get deliverable stats for a project
   */
  async getDeliverableStats(projectId: number): Promise<{
    total: number;
    draft: number;
    pending_review: number;
    in_review: number;
    changes_requested: number;
    approved: number;
    rejected: number;
  }> {
    const db = getDatabase();
    const stats = await db.all(
      `SELECT dw.status, COUNT(*) as count
       FROM files f
       JOIN deliverable_workflows dw ON f.id = dw.file_id
       WHERE f.project_id = ? AND f.category = 'deliverable' AND f.is_archived = FALSE
       GROUP BY dw.status`,
      [projectId]
    );

    const result = {
      total: 0,
      draft: 0,
      pending_review: 0,
      in_review: 0,
      changes_requested: 0,
      approved: 0,
      rejected: 0
    };

    for (const row of stats) {
      const status = String(row.status) as keyof typeof result;
      const count = Number(row.count);
      if (status in result) {
        result[status] = count;
      }
      result.total += count;
    }

    return result;
  }
}

// Export singleton instance
export const fileService = new FileService();
