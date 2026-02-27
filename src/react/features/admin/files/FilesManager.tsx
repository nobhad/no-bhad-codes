import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Upload,
  Download,
  Trash2,
  Eye,
  Folder,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  Grid,
  List,
  Inbox,
  FolderPlus,
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { formatDateShort } from '@react/utils/formatDate';
import { PortalButton } from '@react/components/portal/PortalButton';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { TablePagination } from '@react/components/portal/TablePagination';
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

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  mimeType?: string;
  size?: number;
  projectId?: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
  url?: string;
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
  default: <File className="cell-icon" />,
};

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'folder', label: 'Folders' },
  { value: 'image', label: 'Images' },
  { value: 'document', label: 'Documents' },
  { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
];

interface FilesManagerProps {
  projectId?: string;
  clientId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function FilesManager({ projectId, clientId, onNavigate }: FilesManagerProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [stats, setStats] = useState<FileStats>({
    totalFiles: 0,
    totalFolders: 0,
    totalSize: 0,
  });

  // View state
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [currentPath, setCurrentPath] = useState<string[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Sorting
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>({
    column: 'name',
    direction: 'asc',
  });

  useEffect(() => {
    loadFiles();
  }, [projectId, clientId]);

  async function loadFiles() {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      if (clientId) params.set('clientId', clientId);

      const response = await fetch(`/api/admin/files?${params}`);
      if (!response.ok) throw new Error('Failed to load files');

      const data = await response.json();
      setFiles(data.files || []);
      setStats(data.stats || {
        totalFiles: 0,
        totalFolders: 0,
        totalSize: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  }

  // Filter and sort files
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (file) =>
          file.name.toLowerCase().includes(query) ||
          file.projectName?.toLowerCase().includes(query) ||
          file.clientName?.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter((file) => {
        if (typeFilter === 'folder') return file.type === 'folder';
        if (typeFilter === 'image') return file.mimeType?.startsWith('image/');
        if (typeFilter === 'document')
          return (
            file.mimeType?.includes('pdf') ||
            file.mimeType?.includes('document') ||
            file.mimeType?.includes('text')
          );
        if (typeFilter === 'video') return file.mimeType?.startsWith('video/');
        if (typeFilter === 'audio') return file.mimeType?.startsWith('audio/');
        return true;
      });
    }

    // Sort - folders first, then by column
    if (sort) {
      result.sort((a, b) => {
        // Folders always first
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;

        let aVal: string | number = '';
        let bVal: string | number = '';

        switch (sort.column) {
          case 'name':
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case 'size':
            aVal = a.size || 0;
            bVal = b.size || 0;
            break;
          case 'updatedAt':
            aVal = a.updatedAt;
            bVal = b.updatedAt;
            break;
        }

        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [files, searchQuery, typeFilter, sort]);

  const pagination = usePagination({ totalItems: filteredFiles.length });
  const paginatedFiles = filteredFiles.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  function toggleSort(column: string) {
    setSort((prev) => {
      if (prev?.column === column) {
        return prev.direction === 'asc' ? { column, direction: 'desc' } : null;
      }
      return { column, direction: 'asc' };
    });
  }

  function getFileIcon(file: FileItem): React.ReactNode {
    if (file.type === 'folder') return FILE_ICONS.folder;
    if (file.mimeType?.startsWith('image/')) return FILE_ICONS.image;
    if (file.mimeType?.startsWith('video/')) return FILE_ICONS.video;
    if (file.mimeType?.startsWith('audio/')) return FILE_ICONS.audio;
    if (
      file.mimeType?.includes('pdf') ||
      file.mimeType?.includes('document') ||
      file.mimeType?.includes('text')
    )
      return FILE_ICONS.document;
    return FILE_ICONS.default;
  }

  async function handleDelete(fileId: string) {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const response = await fetch(`/api/admin/files/${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete file');

      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  }

  const hasActiveFilters = Boolean(searchQuery) || typeFilter !== 'all';

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="FILES"
      stats={
        <TableStats
          items={[
            { value: stats.totalFiles, label: 'files' },
            { value: stats.totalFolders, label: 'folders', hideIfZero: true },
            { value: formatFileSize(stats.totalSize), label: 'total' },
          ]}
          tooltip={`${stats.totalFiles} Files • ${stats.totalFolders} Folders • ${formatFileSize(stats.totalSize)} Total`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search files..."
          />
          <FilterDropdown
            sections={[
              { key: 'type', label: 'TYPE', options: TYPE_FILTER_OPTIONS },
            ]}
            values={{ type: typeFilter }}
            onChange={(key, value) => setTypeFilter(value)}
          />
          <button
            className={cn('icon-btn', viewMode === 'list' && 'active')}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <List />
          </button>
          <button
            className={cn('icon-btn', viewMode === 'grid' && 'active')}
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >
            <Grid />
          </button>
          <PortalButton variant="secondary" size="sm">
            <FolderPlus className="btn-icon" />
            New Folder
          </PortalButton>
          <PortalButton variant="primary" size="sm">
            <Upload className="btn-icon" />
            Upload
          </PortalButton>
        </>
      }
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={loadFiles}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
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
        <AdminTable>
          <AdminTableHeader>
            <AdminTableRow>
              <AdminTableHead
                sortable
                sortDirection={sort?.column === 'name' ? sort.direction : null}
                onClick={() => toggleSort('name')}
              >
                Name
              </AdminTableHead>
              <AdminTableHead>Project</AdminTableHead>
              <AdminTableHead
                className="text-right"
                sortable
                sortDirection={sort?.column === 'size' ? sort.direction : null}
                onClick={() => toggleSort('size')}
              >
                Size
              </AdminTableHead>
              <AdminTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'updatedAt' ? sort.direction : null}
                onClick={() => toggleSort('updatedAt')}
              >
                Modified
              </AdminTableHead>
              <AdminTableHead className="actions-col">Actions</AdminTableHead>
            </AdminTableRow>
          </AdminTableHeader>

          <AdminTableBody animate={!isLoading}>
            {isLoading ? (
              <AdminTableLoading colSpan={5} rows={5} />
            ) : paginatedFiles.length === 0 ? (
              <AdminTableEmpty
                colSpan={5}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No files match your filters' : 'No files yet'}
              />
            ) : (
              paginatedFiles.map((file) => (
                <AdminTableRow key={file.id} clickable>
                  <AdminTableCell className="primary-cell">
                    <div className="cell-with-icon">
                      {getFileIcon(file)}
                      <span className="cell-title">{file.name}</span>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    {file.projectName ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate?.('projects', file.projectId);
                        }}
                        className="link-btn"
                      >
                        {file.projectName}
                      </button>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </AdminTableCell>
                  <AdminTableCell className="text-right">
                    {file.type === 'folder' ? '-' : formatFileSize(file.size || 0)}
                  </AdminTableCell>
                  <AdminTableCell className="date-cell">{formatDateShort(file.updatedAt)}</AdminTableCell>
                  <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="table-actions">
                      {file.type !== 'folder' && (
                        <>
                          <button className="icon-btn" title="Preview">
                            <Eye size={18} />
                          </button>
                          <button className="icon-btn" title="Download">
                            <Download size={18} />
                          </button>
                        </>
                      )}
                      <button
                        className="icon-btn"
                        title="Delete"
                        onClick={() => handleDelete(file.id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminTable>
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
  hasActiveFilters,
}: {
  files: FileItem[];
  isLoading: boolean;
  getFileIcon: (file: FileItem) => React.ReactNode;
  onDelete: (id: string) => void;
  hasActiveFilters: boolean;
}) {
  if (isLoading) {
    return (
      <div className="files-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="file-card file-card-skeleton" />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="empty-state">
        <Inbox className="empty-state-icon" />
        <p className="empty-state-text">
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
            <button
              className="icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file.id);
              }}
            >
              <Trash2 size={18} />
            </button>
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

export default FilesManager;
