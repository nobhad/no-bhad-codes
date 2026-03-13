/**
 * ===============================================
 * API TYPES — FILES
 * ===============================================
 */

// ============================================
// File Upload API Types
// ============================================

/**
 * File upload request
 */
export interface FileUploadRequest {
  filename: string;
  fileType: AllowedMimeType;
  fileSize: number;
}

export type AllowedMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'application/pdf'
  | 'text/plain';

/**
 * File upload response
 */
export interface FileUploadResponse {
  id: number;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}


// ============================================
// File Management Enhancement API Types
// ============================================

/**
 * File category types
 */
export type FileCategory =
  | 'general'
  | 'deliverable'
  | 'source'
  | 'asset'
  | 'document'
  | 'contract'
  | 'invoice';

/**
 * File version
 */
export interface FileVersion {
  id: number;
  fileId: number;
  versionNumber: number;
  filename: string;
  originalFilename: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedBy: string | null;
  comment: string | null;
  isCurrent: boolean;
  createdAt: string;
}

/**
 * File version response (snake_case for API)
 */
export interface FileVersionResponse {
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

/**
 * File folder
 */
export interface FileFolder {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  parentFolderId: number | null;
  color: string;
  icon: string;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  fileCount?: number;
  subfolderCount?: number;
}

/**
 * File folder response (snake_case for API)
 */
export interface FileFolderResponse {
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

/**
 * File comment
 */
export interface FileComment {
  id: number;
  fileId: number;
  authorEmail: string;
  authorType: 'admin' | 'client';
  authorName: string | null;
  content: string;
  isInternal: boolean;
  parentCommentId: number | null;
  createdAt: string;
  updatedAt: string;
  replies?: FileComment[];
}

/**
 * File comment response (snake_case for API)
 */
export interface FileCommentResponse {
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
  replies?: FileCommentResponse[];
}

/**
 * File access log entry
 */
export interface FileAccessLog {
  id: number;
  fileId: number;
  userEmail: string;
  userType: 'admin' | 'client';
  accessType: 'view' | 'download' | 'preview';
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/**
 * File access log response (snake_case for API)
 */
export interface FileAccessLogResponse {
  id: number;
  file_id: number;
  user_email: string;
  user_type: 'admin' | 'client';
  access_type: 'view' | 'download' | 'preview';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/**
 * File access statistics
 */
export interface FileAccessStats {
  totalViews: number;
  totalDownloads: number;
  uniqueViewers: number;
  lastAccessed: string | null;
}

/**
 * File access stats response (snake_case for API)
 */
export interface FileAccessStatsResponse {
  total_views: number;
  total_downloads: number;
  unique_viewers: number;
  last_accessed: string | null;
}

/**
 * File statistics for a project
 */
export interface FileStats {
  totalFiles: number;
  totalSize: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  recentUploads: number;
  archivedCount: number;
  expiringSoon: number;
}

/**
 * File stats response (snake_case for API)
 */
export interface FileStatsResponse {
  total_files: number;
  total_size: number;
  by_category: Record<string, number>;
  by_type: Record<string, number>;
  recent_uploads: number;
  archived_count: number;
  expiring_soon: number;
}

/**
 * Enhanced file with new management fields
 */
export interface EnhancedFile {
  id: number;
  projectId: number;
  folderId: number | null;
  filename: string;
  originalFilename: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  fileType: string;
  description: string | null;
  uploadedBy: string | null;
  version: number;
  isArchived: boolean;
  archivedAt: string | null;
  archivedBy: string | null;
  expiresAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  downloadCount: number;
  checksum: string | null;
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: string | null;
  category: FileCategory;
  createdAt: string;
}

/**
 * Enhanced file response (snake_case for API)
 */
export interface EnhancedFileResponse {
  id: number;
  project_id: number;
  folder_id: number | null;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  file_type: string;
  description: string | null;
  uploaded_by: string | null;
  version: number;
  is_archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
  expires_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  download_count: number;
  checksum: string | null;
  is_locked: boolean;
  locked_by: string | null;
  locked_at: string | null;
  category: FileCategory;
  created_at: string;
}

/**
 * Create folder request
 */
export interface CreateFolderRequest {
  name: string;
  description?: string;
  parent_folder_id?: number;
  color?: string;
  icon?: string;
}

/**
 * Update folder request
 */
export interface UpdateFolderRequest {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}

/**
 * Move file request
 */
export interface MoveFileRequest {
  folder_id: number | null;
}

/**
 * Move folder request
 */
export interface MoveFolderRequest {
  parent_folder_id: number | null;
}

/**
 * Set file expiration request
 */
export interface SetFileExpirationRequest {
  expires_at: string | null;
}

/**
 * Set file category request
 */
export interface SetFileCategoryRequest {
  category: FileCategory;
}

/**
 * Add file comment request
 */
export interface AddFileCommentRequest {
  content: string;
  is_internal?: boolean;
  parent_comment_id?: number;
  author_name?: string;
}

/**
 * Log file access request
 */
export interface LogFileAccessRequest {
  access_type: 'view' | 'download' | 'preview';
}

/**
 * File search options
 */
export interface FileSearchOptions {
  folder_id?: number;
  category?: FileCategory;
  include_archived?: boolean;
  limit?: number;
}

/**
 * Upload file version request
 */
export interface UploadFileVersionRequest {
  comment?: string;
}
