/**
 * PortalFilesManager
 * Main files component for the client portal with upload, list, and folder navigation
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Eye,
  Download,
  Trash2,
  Folder,
  File,
  Image,
  FileText,
  RefreshCw,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableLoading,
} from '@react/components/portal/AdminTable';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { FileUploadDropzone } from './FileUploadDropzone';

// ============================================================================
// TYPES
// ============================================================================

interface PortalFile {
  id: number;
  filename: string;
  originalName?: string;
  size: number;
  mimetype: string;
  fileType?: string;
  category?: string;
  uploadedAt: string;
  uploadedBy?: string;
  projectId?: number;
  projectName?: string;
}

/**
 * Transform API response to PortalFile interface
 * Maps snake_case API fields to camelCase component fields
 */
function transformFile(apiFile: Record<string, unknown>): PortalFile {
  return {
    id: apiFile.id as number,
    filename: (apiFile.filename || apiFile.original_filename || '') as string,
    originalName: (apiFile.original_filename || apiFile.originalName) as string | undefined,
    size: (apiFile.file_size || apiFile.size || 0) as number,
    mimetype: (apiFile.mime_type || apiFile.mimetype || '') as string,
    fileType: (apiFile.file_type || apiFile.fileType) as string | undefined,
    category: apiFile.category as string | undefined,
    uploadedAt: (apiFile.uploaded_at || apiFile.uploadedAt || apiFile.created_at || '') as string,
    uploadedBy: (apiFile.uploaded_by || apiFile.uploadedBy) as string | undefined,
    projectId: (apiFile.project_id || apiFile.projectId) as number | undefined,
    projectName: (apiFile.project_name || apiFile.projectName) as string | undefined,
  };
}

interface Project {
  id: number;
  name: string;
}

interface FolderCategory {
  id: string;
  name: string;
  count: number;
}

export interface PortalFilesProps {
  /** Filter files by project ID */
  projectId?: string;
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FILES_API_BASE = '/api/uploads';

// File type to folder category mapping
const FILE_TYPE_TO_FOLDER: Record<string, string> = {
  wireframe: 'site',
  mockup: 'site',
  asset: 'site',
  content: 'site',
  reference: 'site',
  intake: 'forms',
  proposal: 'forms',
  contract: 'forms',
  invoice: 'documents',
  receipt: 'documents',
};

// Folder display names
const FOLDER_NAMES: Record<string, string> = {
  all: 'All Files',
  site: 'Site',
  forms: 'Forms',
  documents: 'Documents',
  client_uploads: 'Client Uploads',
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get folder category for a file
 */
function getFileFolder(file: {
  fileType?: string;
  category?: string;
  uploadedBy?: string;
}): string {
  if (file.uploadedBy?.includes('client') || file.category === 'client_upload') {
    return 'client_uploads';
  }
  if (file.fileType && FILE_TYPE_TO_FOLDER[file.fileType]) {
    return FILE_TYPE_TO_FOLDER[file.fileType];
  }
  return 'site';
}

/**
 * Count files per folder category
 */
function countFilesByFolder(files: PortalFile[]): FolderCategory[] {
  const counts: Record<string, number> = {
    site: 0,
    forms: 0,
    documents: 0,
    client_uploads: 0,
  };

  files.forEach((file) => {
    const folder = getFileFolder(file);
    counts[folder] = (counts[folder] || 0) + 1;
  });

  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({
      id,
      name: FOLDER_NAMES[id] || id,
      count,
    }));
}

/**
 * Get icon for file type
 */
function getFileIcon(mimetype: string): React.ReactNode {
  if (mimetype.startsWith('image/')) {
    return <Image className="tw-h-3.5 tw-w-3.5" />;
  }
  if (mimetype.includes('pdf') || mimetype.includes('document') || mimetype.includes('text')) {
    return <FileText className="tw-h-3.5 tw-w-3.5" />;
  }
  return <File className="tw-h-3.5 tw-w-3.5" />;
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface FolderTreeProps {
  folders: FolderCategory[];
  selectedFolder: string;
  totalCount: number;
  onSelectFolder: (folderId: string) => void;
}

function FolderTree({ folders, selectedFolder, totalCount, onSelectFolder }: FolderTreeProps) {
  return (
    <div className="tw-section tw-gap-1">
      {/* All Files */}
      <button
        type="button"
        className={cn('tw-list-item folder-item', selectedFolder === 'all' && 'tw-table-row-selected')}
        onClick={() => onSelectFolder('all')}
      >
        <Folder className="tw-h-4 tw-w-4" />
        <span className="tw-flex-1">All Files</span>
        <span className="tw-text-muted tw-text-xs">{totalCount}</span>
      </button>

      {/* Folder categories */}
      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          className={cn('tw-list-item folder-item folder-item-nested', selectedFolder === folder.id && 'tw-table-row-selected')}
          onClick={() => onSelectFolder(folder.id)}
        >
          <Folder className="tw-h-4 tw-w-4" />
          <span className="tw-flex-1">{folder.name}</span>
          <span className="tw-text-muted tw-text-xs">{folder.count}</span>
        </button>
      ))}
    </div>
  );
}

interface FiltersBarProps {
  projects: Project[];
  selectedProject: string;
  selectedFileType: string;
  onProjectChange: (projectId: string) => void;
  onFileTypeChange: (fileType: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

function FiltersBar({
  projects,
  selectedProject,
  selectedFileType,
  onProjectChange,
  onFileTypeChange,
  onClearFilters,
  hasActiveFilters,
}: FiltersBarProps) {
  return (
    <div className="tw-flex tw-items-center tw-gap-2 tw-flex-wrap">
      <Filter className="tw-h-4 tw-w-4 tw-text-muted" />

      {/* Project filter */}
      <select
        className="tw-select tw-text-sm"
        value={selectedProject}
        onChange={(e) => onProjectChange(e.target.value)}
      >
        <option value="all">All Projects</option>
        {projects.map((project) => (
          <option key={project.id} value={String(project.id)}>
            {project.name}
          </option>
        ))}
      </select>

      {/* File type filter */}
      <select
        className="tw-select tw-text-sm"
        value={selectedFileType}
        onChange={(e) => onFileTypeChange(e.target.value)}
      >
        <option value="all">All Types</option>
        <option value="image">Images</option>
        <option value="document">Documents</option>
        <option value="archive">Archives</option>
      </select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button className="tw-btn-ghost" onClick={onClearFilters}>
          <X className="tw-h-3 tw-w-3" />
          Clear
        </button>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * PortalFilesManager Component
 */
export function PortalFilesManager({
  projectId: initialProjectId,
  getAuthToken,
  showNotification,
}: PortalFilesProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  // State
  const [files, setFiles] = useState<PortalFile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [selectedProject, setSelectedProject] = useState(initialProjectId || 'all');
  const [selectedFileType, setSelectedFileType] = useState('all');

  // Delete confirmation
  const deleteDialog = useConfirmDialog();
  const [fileToDelete, setFileToDelete] = useState<PortalFile | null>(null);

  // AbortController ref for cleanup on unmount
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Compute folder categories
  const folderCategories = useMemo(() => countFilesByFolder(files), [files]);

  // Filter files based on current selections
  const filteredFiles = useMemo(() => {
    let result = files;

    // Filter by folder
    if (selectedFolder !== 'all') {
      result = result.filter((file) => getFileFolder(file) === selectedFolder);
    }

    // Filter by project
    if (selectedProject !== 'all') {
      result = result.filter((file) => String(file.projectId) === selectedProject);
    }

    // Filter by file type
    if (selectedFileType !== 'all') {
      result = result.filter((file) => {
        if (selectedFileType === 'image') return file.mimetype.startsWith('image/');
        if (selectedFileType === 'document') {
          return (
            file.mimetype.includes('pdf') ||
            file.mimetype.includes('document') ||
            file.mimetype.includes('text')
          );
        }
        if (selectedFileType === 'archive') {
          return file.mimetype.includes('zip') || file.mimetype.includes('rar');
        }
        return true;
      });
    }

    return result;
  }, [files, selectedFolder, selectedProject, selectedFileType]);

  // Pagination
  const pagination = usePagination({
    totalItems: filteredFiles.length,
    storageKey: 'portal_files',
    defaultPageSize: 25,
  });

  const paginatedFiles = pagination.paginate(filteredFiles);

  // Check if any filters are active
  const hasActiveFilters = selectedProject !== 'all' || selectedFileType !== 'all';

  // Fetch files
  const fetchFiles = useCallback(async () => {
    // Abort any in-flight request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const token = getAuthToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${FILES_API_BASE}/client`, {
        headers,
        credentials: 'include',
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();
      // Transform API response to match component interface (snake_case to camelCase)
      const transformedFiles = (data.files || []).map(transformFile);
      setFiles(transformedFiles);
      setProjects(data.projects || []);
    } catch (err) {
      // Don't set error state if request was aborted (component unmounted)
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('[PortalFilesManager] Error fetching files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  // Initial fetch
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Handle file upload
  const handleUpload = useCallback(
    async (filesToUpload: File[]) => {
      setIsUploading(true);
      setUploadProgress(0);

      try {
        const formData = new FormData();
        filesToUpload.forEach((file) => {
          formData.append('files', file);
        });

        const response = await fetch(`${FILES_API_BASE}/multiple`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Upload failed');
        }

        setUploadProgress(100);
        showNotification?.(`${filesToUpload.length} file(s) uploaded successfully`, 'success');

        // Refresh file list
        await fetchFiles();
      } catch (err) {
        console.error('[PortalFilesManager] Upload error:', err);
        showNotification?.(err instanceof Error ? err.message : 'Upload failed', 'error');
        throw err;
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [fetchFiles, showNotification]
  );

  // Handle file preview
  const handlePreview = useCallback((file: PortalFile) => {
    const url = `${FILES_API_BASE}/file/${file.id}`;
    window.open(url, '_blank', 'noopener');
  }, []);

  // Handle file download
  const handleDownload = useCallback((file: PortalFile) => {
    const url = `${FILES_API_BASE}/file/${file.id}?download=true`;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.originalName || file.filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // Handle file delete
  const handleDeleteClick = useCallback(
    (file: PortalFile) => {
      setFileToDelete(file);
      deleteDialog.open();
    },
    [deleteDialog]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!fileToDelete) return;

    try {
      const response = await fetch(`${FILES_API_BASE}/file/${fileToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete file');
      }

      // Remove file from state
      setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      showNotification?.('File deleted successfully', 'success');
    } catch (err) {
      console.error('[PortalFilesManager] Delete error:', err);
      showNotification?.(err instanceof Error ? err.message : 'Failed to delete file', 'error');
    }

    setFileToDelete(null);
  }, [fileToDelete, showNotification]);

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setSelectedProject('all');
    setSelectedFileType('all');
  }, []);

  // Get client email for delete permission check
  const clientEmail = typeof window !== 'undefined' ? sessionStorage.getItem('clientEmail') : null;

  // Loading state
  if (isLoading) {
    return (
      <div className="tw-loading">
        <RefreshCw className="tw-h-5 tw-w-5 tw-animate-spin" />
        <span>Loading files...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="tw-error">
        <div className="tw-text-center tw-mb-4">{error}</div>
        <button className="tw-btn-secondary" onClick={fetchFiles}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="tw-section">
      {/* Upload Dropzone */}
      <FileUploadDropzone
        onUpload={handleUpload}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
      />

      {/* Main Content */}
      <div className="tw-flex tw-gap-4">
        {/* Folder Tree Sidebar */}
        <div className="tw-panel files-folder-sidebar" id="folder-sidebar">
          <FolderTree
            folders={folderCategories}
            selectedFolder={selectedFolder}
            totalCount={files.length}
            onSelectFolder={setSelectedFolder}
          />
        </div>
        <style>{`@media (min-width: 768px) { #folder-sidebar { display: block !important; } }`}</style>

        {/* Files List */}
        <div className="tw-flex-1 card-content-truncate">
          {/* Mobile folder selector */}
          <div className="tw-mb-3 md:tw-hidden">
            <select
              className="tw-select tw-w-full"
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
            >
              <option value="all">All Files ({files.length})</option>
              {folderCategories.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name} ({folder.count})
                </option>
              ))}
            </select>
          </div>

          {/* Breadcrumb Path */}
          <div className="tw-flex tw-items-center tw-gap-1 tw-mb-3 tw-text-muted">
            <span className="tw-text-sm">Files</span>
            <ChevronRight className="tw-h-3 tw-w-3" />
            <span className="tw-text-primary tw-text-sm">
              {FOLDER_NAMES[selectedFolder] || selectedFolder}
            </span>
          </div>

          {/* Filters */}
          <div className="tw-mb-3">
            <FiltersBar
              projects={projects}
              selectedProject={selectedProject}
              selectedFileType={selectedFileType}
              onProjectChange={setSelectedProject}
              onFileTypeChange={setSelectedFileType}
              onClearFilters={handleClearFilters}
              hasActiveFilters={hasActiveFilters}
            />
          </div>

          {/* Files Table */}
          <AdminTable>
            <AdminTableHeader>
              <AdminTableRow>
                <AdminTableHead className="tw-w-[40%]">File</AdminTableHead>
                <AdminTableHead className="tw-w-[15%]">Size</AdminTableHead>
                <AdminTableHead className="tw-w-[20%]">Uploaded</AdminTableHead>
                <AdminTableHead className="tw-w-[25%] tw-text-right">Actions</AdminTableHead>
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody animate>
              {isLoading ? (
                <AdminTableLoading colSpan={4} rows={5} />
              ) : paginatedFiles.length === 0 ? (
                <AdminTableEmpty
                  colSpan={4}
                  icon={<File className="tw-h-6 tw-w-6" />}
                  message={
                    files.length === 0
                      ? 'No files uploaded yet. Drag and drop files above to upload.'
                      : 'No files match the current filters.'
                  }
                />
              ) : (
                paginatedFiles.map((file) => {
                  const canDelete =
                    file.uploadedBy === clientEmail || file.uploadedBy === 'client';
                  const displayName = file.originalName || file.filename || 'File';

                  return (
                    <AdminTableRow key={file.id}>
                      <AdminTableCell>
                        <div className="tw-flex tw-items-center tw-gap-2">
                          <span className="tw-text-[var(--portal-text-muted)]">
                            {getFileIcon(file.mimetype)}
                          </span>
                          <span
                            className="tw-truncate tw-max-w-[200px]"
                            title={displayName}
                          >
                            {displayName}
                          </span>
                        </div>
                      </AdminTableCell>
                      <AdminTableCell>
                        <span className="tw-text-[var(--portal-text-secondary)]">
                          {formatFileSize(file.size)}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell>
                        <span className="tw-text-[var(--portal-text-secondary)]">
                          {formatDate(file.uploadedAt)}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell>
                        <div className="tw-flex tw-items-center tw-justify-end tw-gap-1">
                          <PortalButton
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePreview(file)}
                            title="Preview"
                          >
                            <Eye className="tw-h-3.5 tw-w-3.5" />
                          </PortalButton>
                          <PortalButton
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(file)}
                            title="Download"
                          >
                            <Download className="tw-h-3.5 tw-w-3.5" />
                          </PortalButton>
                          {canDelete && (
                            <PortalButton
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(file)}
                              title="Delete"
                              className="hover:tw-text-[var(--status-cancelled)]"
                            >
                              <Trash2 className="tw-h-3.5 tw-w-3.5" />
                            </PortalButton>
                          )}
                        </div>
                      </AdminTableCell>
                    </AdminTableRow>
                  );
                })
              )}
            </AdminTableBody>
          </AdminTable>

          {/* Pagination */}
          {filteredFiles.length > 0 && (
            <div className="tw-flex tw-items-center tw-justify-between tw-mt-3 tw-text-sm">
              <span className="tw-text-muted">{pagination.pageInfo}</span>
              <div className="tw-flex tw-items-center tw-gap-1">
                <button
                  className="tw-btn-ghost"
                  onClick={pagination.prevPage}
                  disabled={!pagination.canGoPrev}
                >
                  Previous
                </button>
                <span className="tw-text-muted tw-px-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  className="tw-btn-ghost"
                  onClick={pagination.nextPage}
                  disabled={!pagination.canGoNext}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete File"
        description={`Are you sure you want to delete "${fileToDelete?.originalName || fileToDelete?.filename || 'this file'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </div>
  );
}
