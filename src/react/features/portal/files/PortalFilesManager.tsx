/**
 * PortalFilesManager
 * Main files component for the client portal with upload, list, and folder navigation
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Folder,
  File,
  Image,
  FileText
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableRow,
  PortalTableHead,
  PortalTableCell,
  PortalTableEmpty
} from '@react/components/portal/PortalTable';
import { IconButton } from '@react/factories';
import { FormDropdown } from '@react/components/portal/FormDropdown';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { PORTAL_FILES_FILTER_CONFIG } from '../shared/filterConfigs';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { FileUploadDropzone } from './FileUploadDropzone';
import type { PortalViewProps } from '../types';
import { formatCardDate, formatFileSize } from '@react/utils/cardFormatters';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { createLogger } from '@/utils/logger';
import { getCsrfToken, CSRF_HEADER_NAME } from '@/utils/api-client';
import { downloadFile } from '@/utils/file-download';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { formatErrorMessage } from '@/utils/error-utils';

const logger = createLogger('PortalFilesManager');

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
    projectName: (apiFile.project_name || apiFile.projectName) as string | undefined
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

/** Combined response shape from the files endpoint */
interface FilesApiResponse {
  files: PortalFile[];
  projects: Project[];
}

/**
 * Transform raw API response to FilesApiResponse.
 * Converts snake_case file records to camelCase PortalFile interface.
 */
function transformFilesResponse(raw: unknown): FilesApiResponse {
  const data = raw as { files?: Record<string, unknown>[]; projects?: Project[] };
  return {
    files: (data.files || []).map(transformFile),
    projects: data.projects || []
  };
}

export interface PortalFilesProps extends PortalViewProps {
  /** Filter files by project ID */
  projectId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

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
  receipt: 'documents'
};

// Folder display names
const FOLDER_NAMES: Record<string, string> = {
  all: 'All Files',
  site: 'Site',
  forms: 'Forms',
  documents: 'Documents',
  client_uploads: 'Client Uploads'
};

// ============================================================================
// UTILITIES
// ============================================================================

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
    client_uploads: 0
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
      count
    }));
}

/**
 * Get icon for file type
 */
function getFileIcon(mimetype: string): React.ReactNode {
  if (mimetype.startsWith('image/')) {
    return <Image className="icon-xs" />;
  }
  if (mimetype.includes('pdf') || mimetype.includes('document') || mimetype.includes('text')) {
    return <FileText className="icon-xs" />;
  }
  return <File className="icon-xs" />;
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

const FolderTree = React.memo(({ folders, selectedFolder, totalCount, onSelectFolder }: FolderTreeProps) => {
  return (
    <div className="folder-tree">
      {/* All Files */}
      <button
        type="button"
        className={cn('folder-item', selectedFolder === 'all' && 'active')}
        onClick={() => onSelectFolder('all')}
      >
        <Folder className="icon-sm" />
        <span className="flex-1">All Files</span>
        <span className="text-muted">{totalCount}</span>
      </button>

      {/* Folder categories */}
      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          className={cn('folder-item folder-item-nested', selectedFolder === folder.id && 'active')}
          onClick={() => onSelectFolder(folder.id)}
        >
          <Folder className="icon-sm" />
          <span className="flex-1">{folder.name}</span>
          <span className="text-muted">{folder.count}</span>
        </button>
      ))}
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * PortalFilesManager Component
 */
export function PortalFilesManager({
  projectId: initialProjectId,
  getAuthToken,
  showNotification
}: PortalFilesProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  // Primary data fetch via shared hook (handles auth, abort, error/loading state)
  const {
    data: filesData,
    isLoading,
    error,
    refetch: fetchFiles,
    portalFetch
  } = usePortalData<FilesApiResponse>({
    getAuthToken,
    url: API_ENDPOINTS.FILES_CLIENT,
    transform: transformFilesResponse
  });

  // Exclude intake files — they appear in the Documents tab instead
  const files = useMemo(() => (filesData?.files ?? []).filter((f) => f.category !== 'intake'), [filesData?.files]);
  const projects = useMemo(() => filesData?.projects ?? [], [filesData?.projects]);

  // Local state for upload, filters, and delete
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Filters
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({
    project: initialProjectId ? [initialProjectId] : [],
    fileType: []
  });

  const setFilter = useCallback((key: string, value: string) => {
    setFilterValues((prev) => {
      if (value === 'all') return { ...prev, [key]: [] };
      const current = prev[key] ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
  }, []);

  // Delete confirmation
  const deleteDialog = useConfirmDialog();
  const [fileToDelete, setFileToDelete] = useState<PortalFile | null>(null);

  // Compute folder categories
  const folderCategories = useMemo(() => countFilesByFolder(files), [files]);

  // Build filter sections — project section only when multiple projects
  const filterSections = useMemo(() => {
    const sections = [...PORTAL_FILES_FILTER_CONFIG];
    if (projects.length > 1) {
      sections.unshift({
        key: 'project',
        label: 'PROJECT',
        options: [
          { value: 'all', label: 'All Projects' },
          ...projects.map((p) => ({ value: String(p.id), label: p.name }))
        ]
      });
    }
    return sections;
  }, [projects]);

  // Filter files based on current selections
  const filteredFiles = useMemo(() => {
    let result = files;

    // Search filter
    if (searchQuery) {
      const s = searchQuery.toLowerCase();
      result = result.filter(
        (file) =>
          file.filename?.toLowerCase().includes(s) ||
          file.originalName?.toLowerCase().includes(s) ||
          file.projectName?.toLowerCase().includes(s)
      );
    }

    // Filter by folder
    if (selectedFolder !== 'all') {
      result = result.filter((file) => getFileFolder(file) === selectedFolder);
    }

    // Filter by project
    const projectFilter = filterValues.project ?? [];
    if (projectFilter.length > 0) {
      result = result.filter((file) => projectFilter.includes(String(file.projectId)));
    }

    // Filter by file type
    const fileTypeFilter = filterValues.fileType ?? [];
    if (fileTypeFilter.length > 0) {
      result = result.filter((file) => {
        return fileTypeFilter.some((selectedFileType) => {
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
      });
    }

    return result;
  }, [files, searchQuery, selectedFolder, filterValues]);

  // Pagination
  const pagination = usePagination({
    totalItems: filteredFiles.length,
    storageKey: 'portal_files',
    defaultPageSize: 25
  });

  const paginatedFiles = pagination.paginate(filteredFiles);

  // Check if any filters are active
  const hasActiveFilters = searchQuery !== '' || Object.values(filterValues).some((v) => Array.isArray(v) && v.length > 0);

  // fetchFiles is provided by usePortalData as refetch

  // Handle file upload (FormData requires raw fetch — portalFetch JSON-serializes the body)
  const handleUpload = useCallback(
    async (filesToUpload: File[]) => {
      setIsUploading(true);
      setUploadProgress(0);

      try {
        const formData = new FormData();
        filesToUpload.forEach((file) => {
          formData.append('files', file);
        });

        // Raw fetch for FormData — add CSRF protection manually
        const csrfToken = getCsrfToken();
        const headers: Record<string, string> = {};
        if (csrfToken) headers[CSRF_HEADER_NAME] = csrfToken;

        const response = await fetch(API_ENDPOINTS.FILES_MULTIPLE, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Upload failed');
        }

        setUploadProgress(100);
        showNotification?.(`${filesToUpload.length} file(s) uploaded successfully`, 'success');

        // Refresh file list
        fetchFiles();
      } catch (err) {
        logger.error('[PortalFilesManager] Upload error:', err);
        showNotification?.(formatErrorMessage(err, 'Upload failed'), 'error');
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
    window.open(buildEndpoint.fileView(file.id), '_blank', 'noopener');
  }, []);

  // Handle file download
  const handleDownload = useCallback((file: PortalFile) => {
    downloadFile(file.id, file.originalName || file.filename).catch(() => {
      showNotification?.('Failed to download file', 'error');
    });
  }, [showNotification]);

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
      await portalFetch(buildEndpoint.fileDelete(fileToDelete.id), { method: 'DELETE' });
      showNotification?.('File deleted successfully', 'success');

      // Refresh file list after successful delete
      fetchFiles();
    } catch (err) {
      logger.error('[PortalFilesManager] Delete error:', err);
      showNotification?.(formatErrorMessage(err, 'Failed to delete file'), 'error');
    }

    setFileToDelete(null);
  }, [fileToDelete, showNotification, portalFetch, fetchFiles]);

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterValues({ project: [], fileType: [] });
  }, []);

  return (
    <div className="section">
      {/* Upload dropzone */}
      <FileUploadDropzone
        onUpload={handleUpload}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
      />

      {/* Files table */}
      <TableLayout
        containerRef={containerRef}
        title="FILES"
        stats={
          <TableStats items={[
            { value: files.length, label: 'total' },
            { value: filteredFiles.length, label: 'shown' }
          ]} />
        }
        actions={
          <>
            <SearchFilter value={searchQuery} onChange={setSearchQuery} placeholder="Search files..." />
            <FilterDropdown
              sections={filterSections}
              values={filterValues}
              onChange={(key, value) => setFilter(key, value)}
            />
            {hasActiveFilters && (
              <IconButton action="close" onClick={handleClearFilters} title="Clear filters" />
            )}
            <IconButton action="refresh" onClick={fetchFiles} loading={isLoading} title="Refresh" />
          </>
        }
      >
        {isLoading ? (
          <LoadingState message="Loading files..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchFiles} />
        ) : (
          <div className="files-browser-layout">
            {/* Folder Tree Sidebar */}
            <div className="portal-files-sidebar" id="folder-sidebar">
              <FolderTree
                folders={folderCategories}
                selectedFolder={selectedFolder}
                totalCount={files.length}
                onSelectFolder={setSelectedFolder}
              />
            </div>

            {/* Files Content Area */}
            <div className="files-content-area">
              {/* Mobile folder selector */}
              <div className="files-mobile-select">
                <FormDropdown
                  value={selectedFolder}
                  onChange={setSelectedFolder}
                  options={[
                    { value: 'all', label: `All Files (${files.length})` },
                    ...folderCategories.map((folder) => ({
                      value: folder.id,
                      label: `${folder.name} (${folder.count})`
                    }))
                  ]}
                  aria-label="Select folder"
                />
              </div>

              {/* Files Table */}
              <PortalTable>
                <PortalTableHeader>
                  <PortalTableRow>
                    <PortalTableHead className="name-col">File</PortalTableHead>
                    <PortalTableHead className="size-col">Size</PortalTableHead>
                    <PortalTableHead className="date-col">Uploaded</PortalTableHead>
                    <PortalTableHead className="col-actions">Actions</PortalTableHead>
                  </PortalTableRow>
                </PortalTableHeader>
                <PortalTableBody animate>
                  {paginatedFiles.length === 0 ? (
                    <PortalTableEmpty
                      colSpan={4}
                      icon={<File className="icon-lg" />}
                      message={
                        files.length === 0
                          ? 'No files uploaded yet. Use the upload area above to add files.'
                          : 'No files match the current filters.'
                      }
                    />
                  ) : (
                    paginatedFiles.map((file) => {
                      // Always show delete button - server enforces permissions (returns 403 if unauthorized)
                      const canDelete = true;
                      const displayName = file.originalName || file.filename || 'File';

                      return (
                        <PortalTableRow key={file.id}>
                          <PortalTableCell className="name-cell" label="File">
                            <div className="file-cell-name">
                              <span className="text-muted">
                                {getFileIcon(file.mimetype)}
                              </span>
                              <span className="file-name" title={displayName}>
                                {displayName}
                              </span>
                            </div>
                          </PortalTableCell>
                          <PortalTableCell className="size-cell" label="Size">
                            <span className="text-muted">
                              {formatFileSize(file.size)}
                            </span>
                          </PortalTableCell>
                          <PortalTableCell className="date-cell" label="Uploaded">
                            <span className="text-muted">
                              {formatCardDate(file.uploadedAt)}
                            </span>
                          </PortalTableCell>
                          <PortalTableCell className="col-actions">
                            <div className="table-actions">
                              <IconButton
                                action="view"
                                onClick={() => handlePreview(file)}
                                title="Preview"
                              />
                              <IconButton
                                action="download"
                                onClick={() => handleDownload(file)}
                                title="Download"
                              />
                              {canDelete && (
                                <IconButton
                                  action="delete"
                                  onClick={() => handleDeleteClick(file)}
                                  title="Delete"
                                />
                              )}
                            </div>
                          </PortalTableCell>
                        </PortalTableRow>
                      );
                    })
                  )}
                </PortalTableBody>
              </PortalTable>

              {/* Pagination */}
              {filteredFiles.length > 0 && (
                <div className="files-pagination">
                  <span className="text-muted">{pagination.pageInfo}</span>
                  <div className="files-pagination-controls">
                    <PortalButton
                      variant="ghost"
                      onClick={pagination.prevPage}
                      disabled={!pagination.canGoPrev}
                    >
                          Previous
                    </PortalButton>
                    <span className="text-muted files-pagination-page">
                          Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <PortalButton
                      variant="ghost"
                      onClick={pagination.nextPage}
                      disabled={!pagination.canGoNext}
                    >
                          Next
                    </PortalButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </TableLayout>

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
