import * as React from 'react';
import { useCallback, useState, useRef } from 'react';
import {
  Upload,
  Download,
  Trash2,
  Lock,
  Share2,
  FileText,
  Image,
  File,
  FileArchive,
  Inbox,
  ChevronDown
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import { EmptyState } from '@react/components/portal/EmptyState';
import type { ProjectFile } from '../../types';
import { FILE_CATEGORY_OPTIONS } from '../../types';
import { formatDate, formatFileSize } from '@/utils/format-utils';
import { NOTIFICATIONS, fileUploadMessage } from '@/constants/notifications';
import { KEYS } from '@/constants/keyboard';

interface FilesTabProps {
  files: ProjectFile[];
  onUploadFile: (file: File, category?: string) => Promise<boolean>;
  onDeleteFile: (id: number) => Promise<boolean>;
  onToggleSharing: (id: number) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Get file icon based on type
 */
function getFileIcon(fileType: string): React.ReactNode {
  if (fileType.startsWith('image/')) {
    return <Image className="icon-lg text-brand" />;
  }
  if (fileType === 'application/pdf') {
    return <FileText className="icon-lg text-status-danger" />;
  }
  if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('archive')) {
    return <FileArchive className="icon-lg text-status-warning" />;
  }
  return <File className="icon-lg text-secondary" />;
}

/**
 * FilesTab
 * File management for project
 */
export function FilesTab({
  files,
  onUploadFile,
  onDeleteFile,
  onToggleSharing,
  showNotification
}: FilesTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [togglingFileId, setTogglingFileId] = useState<number | null>(null);

  const deleteDialog = useConfirmDialog();

  // Handle file selection
  const handleFileSelect = useCallback(
    async (selectedFiles: FileList | null) => {
      if (!selectedFiles || selectedFiles.length === 0) return;

      setIsUploading(true);
      let successCount = 0;
      let failCount = 0;

      for (const file of Array.from(selectedFiles)) {
        const success = await onUploadFile(file, selectedCategory || undefined);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      setIsUploading(false);

      const uploadType = failCount === 0 ? 'success' : successCount > 0 ? 'warning' : 'error';
      showNotification?.(fileUploadMessage(successCount, failCount), uploadType);

      // Reset
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onUploadFile, selectedCategory, showNotification]
  );

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (deletingFileId === null) return;

    const success = await onDeleteFile(deletingFileId);
    if (success) {
      showNotification?.(NOTIFICATIONS.file.DELETED, 'success');
    } else {
      showNotification?.(NOTIFICATIONS.file.DELETE_FAILED, 'error');
    }
    setDeletingFileId(null);
  }, [deletingFileId, onDeleteFile, showNotification]);

  // Handle toggle sharing
  const handleToggleSharing = useCallback(
    async (id: number) => {
      setTogglingFileId(id);
      const success = await onToggleSharing(id);
      setTogglingFileId(null);

      if (success) {
        const file = files.find((f) => f.id === id);
        showNotification?.(
          file?.is_shared ? NOTIFICATIONS.file.NOW_PRIVATE : NOTIFICATIONS.file.NOW_SHARED,
          'success'
        );
      } else {
        showNotification?.(NOTIFICATIONS.file.SHARE_FAILED, 'error');
      }
    },
    [files, onToggleSharing, showNotification]
  );

  // Handle download
  const handleDownload = useCallback((file: ProjectFile) => {
    if (file.download_url) {
      window.open(file.download_url, '_blank');
    }
  }, []);

  return (
    <div className="subsection">
      {/* Upload Section */}
      <div
        className={cn(
          'panel files-dropzone',
          isDragging && 'is-dragging'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === KEYS.ENTER || e.key === KEYS.SPACE) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-label="Upload files - drag and drop or click to select"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />

        <div className="files-dropzone-content">
          <p className="pd-highlight-value files-upload-primary-text">
            {isDragging ? 'Drop files here' : 'Drag and drop files here, or click to select'}
          </p>

          {/* Browse button */}
          <button
            type="button"
            className="btn-secondary"
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          >
            <Upload className="icon-sm" />
            Browse Files
          </button>

          <p className="text-secondary pd-hint">
            Supports images, PDFs, documents, and archives
          </p>

          {/* Category Selector */}
          <div className="layout-row gap-2 pd-mt-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-secondary pd-hint">Category:</span>
            <PortalDropdown>
              <PortalDropdownTrigger asChild>
                <button className="files-category-trigger dropdown-trigger" type="button">
                  {selectedCategory
                    ? FILE_CATEGORY_OPTIONS.find((o) => o.value === selectedCategory)?.label || selectedCategory
                    : 'None'}
                  <ChevronDown className="dropdown-caret" />
                </button>
              </PortalDropdownTrigger>
              <PortalDropdownContent align="start">
                <PortalDropdownItem
                  className={cn(!selectedCategory && 'is-active')}
                  onSelect={() => setSelectedCategory('')}
                >
                  None
                </PortalDropdownItem>
                {FILE_CATEGORY_OPTIONS.map((opt) => (
                  <PortalDropdownItem
                    key={opt.value}
                    className={cn(selectedCategory === opt.value && 'is-active')}
                    onSelect={() => setSelectedCategory(opt.value)}
                  >
                    {opt.label}
                  </PortalDropdownItem>
                ))}
              </PortalDropdownContent>
            </PortalDropdown>
          </div>

          {isUploading && (
            <div className="files-upload-status">
              <div className="files-spinner" />
              Uploading...
            </div>
          )}
        </div>
      </div>

      {/* Files List */}
      {files.length === 0 ? (
        <EmptyState
          icon={<Inbox className="icon-lg" />}
          message="No files uploaded yet."
        />
      ) : (
        <div className="panel contract-panel-no-padding">
          <table className="pd-full-width">
            <colgroup>
              <col className="files-col-name" />
              <col className="files-col-size" />
              <col className="files-col-date" />
              <col className="files-col-shared" />
              <col className="files-col-actions" />
            </colgroup>
            <thead>
              <tr className="files-table-header">
                <th scope="col" className="label pd-table-cell pd-cell-left">
                  File
                </th>
                <th scope="col" className="label pd-table-cell pd-cell-left">
                  Size
                </th>
                <th scope="col" className="label pd-table-cell pd-cell-left">
                  Uploaded
                </th>
                <th scope="col" className="label pd-table-cell pd-cell-center">
                  Shared
                </th>
                <th scope="col" className="label pd-table-cell pd-cell-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.id}
                  className="files-table-row"
                >
                  <td className="pd-table-cell">
                    <div className="layout-row">
                      {getFileIcon(file.file_type)}
                      <div className="layout-stack gap-1">
                        <span className="pd-highlight-value pd-truncate-filename">
                          {file.original_name}
                        </span>
                        {file.category && (
                          <span className="text-secondary pd-hint">
                            {FILE_CATEGORY_OPTIONS.find((c) => c.value === file.category)?.label || file.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="pd-table-cell text-secondary">
                    {formatFileSize(file.file_size)}
                  </td>
                  <td className="pd-table-cell text-secondary">
                    {formatDate(file.created_at)}
                  </td>
                  <td className="pd-table-cell pd-cell-center">
                    <button
                      className="icon-btn"
                      onClick={() => handleToggleSharing(file.id)}
                      title={file.is_shared ? 'Shared with client - click to make private' : 'Private - click to share'}
                      aria-label={file.is_shared ? 'Make private' : 'Share with client'}
                      disabled={togglingFileId === file.id}
                    >
                      {file.is_shared ? (
                        <Share2 className="icon-md" />
                      ) : (
                        <Lock className="icon-md" />
                      )}
                    </button>
                  </td>
                  <td className="pd-table-cell pd-cell-right">
                    <div className="action-group">
                      {file.download_url && (
                        <button
                          className="icon-btn"
                          onClick={() => handleDownload(file)}
                          title="Download"
                          aria-label="Download file"
                        >
                          <Download className="icon-md" />
                        </button>
                      )}
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setDeletingFileId(file.id);
                          deleteDialog.open();
                        }}
                        title="Delete"
                        aria-label="Delete file"
                      >
                        <Trash2 className="icon-md" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete File"
        description="Are you sure you want to delete this file? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </div>
  );
}
