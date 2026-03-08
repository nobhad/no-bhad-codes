import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  Folder,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  Inbox
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { formatDateShort } from '@react/utils/formatDate';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { TablePagination } from '@react/components/portal/TablePagination';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableRow,
  PortalTableHead,
  PortalTableCell,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from '@react/components/portal/PortalTable';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { useListFetch } from '@react/factories/useDataFetch';
import { FILES_FILTER_CONFIG } from '../shared/filterConfigs';
import type { SortConfig } from '../types';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';

const logger = createLogger('FilesManager');

const DEFAULT_FILE_STATS: FileStats = {
  totalFiles: 0,
  totalFolders: 0,
  totalSize: 0
};

interface FileItem {
  id: number;
  name: string;
  type: 'file' | 'folder';
  mimeType?: string;
  size?: number;
  projectId?: number;
  projectName?: string;
  clientId?: number;
  clientName?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
  url?: string;
  sharedWithClient?: boolean | number;
  sharedAt?: string;
  sharedBy?: string;
}

interface FileStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  folder: <Folder className="cell-icon status-pending" />,
  image: <FileImage className="cell-icon status-active" />,
  video: <FileVideo className="cell-icon status-cancelled" />,
  audio: <FileAudio className="cell-icon status-qualified" />,
  document: <FileText className="cell-icon status-primary" />,
  default: <File className="cell-icon" />
};

interface FilesManagerProps {
  projectId?: string;
  clientId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

function filterFile(
  file: FileItem,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const query = search.toLowerCase();
    if (
      !file.name.toLowerCase().includes(query) &&
      !file.projectName?.toLowerCase().includes(query) &&
      !file.clientName?.toLowerCase().includes(query)
    ) {
      return false;
    }
  }

  if (filters.type && filters.type !== 'all') {
    const typeFilter = filters.type;
    if (typeFilter === 'folder' && file.type !== 'folder') return false;
    if (typeFilter === 'image' && !file.mimeType?.startsWith('image/')) return false;
    if (typeFilter === 'document' && !(
      file.mimeType?.includes('pdf') ||
      file.mimeType?.includes('document') ||
      file.mimeType?.includes('text')
    )) return false;
    if (typeFilter === 'video' && !file.mimeType?.startsWith('video/')) return false;
    if (typeFilter === 'audio' && !file.mimeType?.startsWith('audio/')) return false;
  }

  return true;
}

function sortFiles(a: FileItem, b: FileItem, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  // Folders always first
  if (a.type === 'folder' && b.type !== 'folder') return -1;
  if (a.type !== 'folder' && b.type === 'folder') return 1;

  switch (column) {
  case 'name':
    return multiplier * a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  case 'size':
    return multiplier * ((a.size || 0) - (b.size || 0));
  case 'updatedAt':
    return multiplier * a.updatedAt.localeCompare(b.updatedAt);
  default:
    return 0;
  }
}

export function FilesManager({ projectId, clientId, onNavigate, getAuthToken, showNotification }: FilesManagerProps) {
  const containerRef = useFadeIn();

  // View state
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [_currentPath, _setCurrentPath] = useState<string[]>([]);

  // Build dynamic endpoint with query params
  const filesEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (clientId) params.set('clientId', clientId);
    return `${API_ENDPOINTS.ADMIN.FILES}?${params}`;
  }, [projectId, clientId]);

  const { data, isLoading, error, refetch, setData } = useListFetch<FileItem, FileStats>({
    endpoint: filesEndpoint,
    getAuthToken,
    defaultStats: DEFAULT_FILE_STATS,
    itemsKey: 'files',
    deps: [filesEndpoint]
  });
  const files = useMemo(() => data?.items ?? [], [data]);
  const stats = useMemo(() => data?.stats ?? DEFAULT_FILE_STATS, [data]);

  // Auth headers helper (kept for mutation calls)
  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<FileItem>({
    storageKey: 'admin_files',
    filters: FILES_FILTER_CONFIG,
    filterFn: filterFile,
    sortFn: sortFiles,
    defaultSort: { column: 'name', direction: 'asc' }
  });

  const filteredFiles = useMemo(() => applyFilters(files), [applyFilters, files]);

  const pagination = usePagination({ storageKey: 'admin_files_pagination', totalItems: filteredFiles.length });
  const paginatedFiles = filteredFiles.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  function getFileIcon(file: FileItem): React.ReactNode {
    if (file.type === 'folder') return FILE_ICONS.folder;
    if (file.mimeType?.startsWith('image/')) return FILE_ICONS.image;
    if (file.mimeType?.startsWith('video/')) return FILE_ICONS.video;
    if (file.mimeType?.startsWith('audio/')) return FILE_ICONS.audio;
    if (
      file.mimeType?.includes('pdf') ||
      file.mimeType?.includes('document') ||
      file.mimeType?.includes('text')
    ) {return FILE_ICONS.document;}
    return FILE_ICONS.default;
  }

  async function handleDelete(fileId: number) {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const response = await fetch(buildEndpoint.adminFile(fileId), {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to delete file');

      setData((prev) => prev ? { ...prev, items: prev.items.filter((f) => f.id !== fileId) } : prev);
      showNotification?.('File deleted successfully', 'success');
    } catch (err) {
      logger.error('Failed to delete file:', err);
      showNotification?.('Failed to delete file', 'error');
    }
  }

  async function handleToggleShare(file: FileItem) {
    const isCurrentlyShared = file.sharedWithClient === true || file.sharedWithClient === 1;
    const action = isCurrentlyShared ? 'unshare' : 'share';

    try {
      const response = await fetch(buildEndpoint.fileAction(file.id, action), {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) throw new Error(`Failed to ${action} file`);

      // Update local state
      setData((prev) => prev ? {
        ...prev,
        items: prev.items.map((f) =>
          f.id === file.id
            ? {
              ...f,
              sharedWithClient: !isCurrentlyShared,
              sharedAt: !isCurrentlyShared ? new Date().toISOString() : undefined
            }
            : f
        )
      } : prev);

      showNotification?.(
        isCurrentlyShared ? 'File access revoked from client' : 'File shared with client',
        'success'
      );
    } catch (err) {
      logger.error(`Failed to ${action} file:`, err);
      showNotification?.(`Failed to ${action} file`, 'error');
    }
  }

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="FILES"
      stats={
        <TableStats
          items={[
            { value: stats.totalFiles, label: 'files' },
            { value: stats.totalFolders, label: 'folders' },
            { value: formatFileSize(stats.totalSize), label: 'total' }
          ]}
          tooltip={`${stats.totalFiles} Files • ${stats.totalFolders} Folders • ${formatFileSize(stats.totalSize)} Total`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search files..."
          />
          <FilterDropdown
            sections={FILES_FILTER_CONFIG}
            values={filterValues}
            onChange={setFilter}
          />
          <IconButton
            icon="list"
            title="List view"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'active' : undefined}
          />
          <IconButton
            icon="list"
            title="Grid view"
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? 'active' : undefined}
          />
          <IconButton action="folder" title="New Folder" />
          <IconButton action="upload" title="Upload" />
        </>
      }
      pagination={
        !isLoading && filteredFiles.length > 0 ? (
          <TablePagination
            pageInfo={pagination.pageInfo}
            page={pagination.page}
            pageSize={pagination.pageSize}
            pageSizeOptions={pagination.pageSizeOptions}
            canGoPrev={pagination.canGoPrev}
            canGoNext={pagination.canGoNext}
            onPageSizeChange={pagination.setPageSize}
            onFirstPage={pagination.firstPage}
            onPrevPage={pagination.prevPage}
            onNextPage={pagination.nextPage}
            onLastPage={pagination.lastPage}
          />
        ) : undefined
      }
    >
      {viewMode === 'list' ? (
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead
                sortable
                sortDirection={sort?.column === 'name' ? sort.direction : null}
                onClick={() => toggleSort('name')}
              >
                Name
              </PortalTableHead>
              <PortalTableHead>Project</PortalTableHead>
              <PortalTableHead className="text-center">Shared</PortalTableHead>
              <PortalTableHead
                className="text-right"
                sortable
                sortDirection={sort?.column === 'size' ? sort.direction : null}
                onClick={() => toggleSort('size')}
              >
                Size
              </PortalTableHead>
              <PortalTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'updatedAt' ? sort.direction : null}
                onClick={() => toggleSort('updatedAt')}
              >
                Modified
              </PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={6} message={error} onRetry={refetch} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={6} rows={5} />
            ) : paginatedFiles.length === 0 ? (
              <PortalTableEmpty
                colSpan={6}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No files match your filters' : 'No files yet'}
              />
            ) : (
              paginatedFiles.map((file) => (
                <PortalTableRow key={file.id} clickable>
                  <PortalTableCell className="primary-cell">
                    <div className="cell-with-icon">
                      {getFileIcon(file)}
                      <span className="cell-title">{file.name}</span>
                    </div>
                  </PortalTableCell>
                  <PortalTableCell>
                    {file.projectName && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate?.('projects', file.projectId != null ? String(file.projectId) : undefined);
                        }}
                        className="link-btn"
                      >
                        {file.projectName}
                      </button>
                    )}
                  </PortalTableCell>
                  <PortalTableCell className="text-center">
                    {file.type !== 'folder' && file.projectId && (
                      <span
                        className={`status-badge ${file.sharedWithClient ? 'status-active' : 'status-muted'}`}
                        title={file.sharedWithClient && file.sharedAt ? `Shared on ${formatDateShort(file.sharedAt)}` : 'Not shared'}
                      >
                        {file.sharedWithClient ? 'Yes' : 'No'}
                      </span>
                    )}
                  </PortalTableCell>
                  <PortalTableCell className="text-right">
                    {file.type !== 'folder' && formatFileSize(file.size || 0)}
                  </PortalTableCell>
                  <PortalTableCell className="date-cell">{formatDateShort(file.updatedAt)}</PortalTableCell>
                  <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="table-actions">
                      {file.type !== 'folder' && (
                        <>
                          <IconButton action="preview" />
                          <IconButton action="download" />
                          {file.projectId && (
                            <IconButton
                              icon={file.sharedWithClient ? 'unshare' : 'share'}
                              title={file.sharedWithClient ? 'Revoke client access' : 'Share with client'}
                              onClick={() => handleToggleShare(file)}
                              className={file.sharedWithClient ? 'status-active' : undefined}
                            />
                          )}
                        </>
                      )}
                      <IconButton action="delete" onClick={() => handleDelete(file.id)} />
                    </div>
                  </PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      ) : (
        <FilesGrid
          files={paginatedFiles}
          isLoading={isLoading}
          getFileIcon={getFileIcon}
          onDelete={handleDelete}
          hasActiveFilters={hasActiveFilters}
        />
      )}
    </TableLayout>
  );
}

function FilesGrid({
  files,
  isLoading,
  getFileIcon,
  onDelete,
  hasActiveFilters
}: {
  files: FileItem[];
  isLoading: boolean;
  getFileIcon: (file: FileItem) => React.ReactNode;
  onDelete: (id: number) => void;
  hasActiveFilters: boolean;
}) {
  if (isLoading) {
    return (
      <div className="files-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={`skeleton-${i}`} className="file-card file-card-skeleton" />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="empty-state">
        <Inbox className="empty-icon" />
        <p className="empty-message">
          {hasActiveFilters ? 'No files match your filters' : 'No files yet'}
        </p>
      </div>
    );
  }

  return (
    <div className="files-grid">
      {files.map((file) => (
        <div key={file.id} className="file-card">
          <div className="file-card-content">
            <div className="file-card-icon">{getFileIcon(file)}</div>
            <span className="file-card-name">{file.name}</span>
            {file.type !== 'folder' && (
              <span className="file-card-size">{formatFileSize(file.size || 0)}</span>
            )}
          </div>

          {/* Hover Actions */}
          <div className="file-card-actions">
            <IconButton
              action="delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file.id);
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
