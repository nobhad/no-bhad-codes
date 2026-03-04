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
  Inbox
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import type { ProjectFile } from '../../types';
import { FILE_CATEGORY_OPTIONS } from '../../types';

interface FilesTabProps {
  files: ProjectFile[];
  onUploadFile: (file: File, category?: string) => Promise<boolean>;
  onDeleteFile: (id: number) => Promise<boolean>;
  onToggleSharing: (id: number) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

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
function formatDate(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Get file icon based on type
 */
function getFileIcon(fileType: string): React.ReactNode {
  if (fileType.startsWith('image/')) {
    return <Image className="icon-lg tw-text-[var(--color-brand-primary)]" />;
  }
  if (fileType === 'application/pdf') {
    return <FileText className="icon-lg tw-text-[var(--status-cancelled)]" />;
  }
  if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('archive')) {
    return <FileArchive className="icon-lg tw-text-[var(--status-warning)]" />;
  }
  return <File className="icon-lg tw-text-[var(--portal-text-muted)]" />;
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

      if (failCount === 0) {
        showNotification?.(
          `Uploaded ${successCount} file${successCount !== 1 ? 's' : ''}`,
          'success'
        );
      } else if (successCount > 0) {
        showNotification?.(
          `Uploaded ${successCount}, failed ${failCount}`,
          'warning'
        );
      } else {
        showNotification?.('Failed to upload files', 'error');
      }

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
      showNotification?.('File deleted', 'success');
    } else {
      showNotification?.('Failed to delete file', 'error');
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
          file?.is_shared ? 'File is now private' : 'File is now shared with client',
          'success'
        );
      } else {
        showNotification?.('Failed to update sharing', 'error');
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
    <div className="tw-section">
      {/* Upload Section */}
      <div
        className={cn(
          'tw-panel tw-border-2 tw-border-dashed tw-cursor-pointer tw-transition-colors ',
          isDragging
            ? 'tw-border-primary tw-bg-[var(--portal-bg-hover)]'
            : 'tw-border-[var(--portal-border-color)] hover:tw-border-primary'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="tw-hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />

        <div className="tw-flex tw-flex-col tw-items-center tw-gap-3">
          <Upload
            className={cn(
              'tw-h-8 tw-w-8',
              isDragging && 'tw-text-primary'
            )}
          />
          <div className="tw-text-center">
            <p className="tw-text-primary ">
              {isDragging ? 'Drop files here' : 'Drag and drop files here, or click to select'}
            </p>
            <p className="text-muted tw-mt-1 tw-text-sm">
              Supports images, PDFs, documents, and archives
            </p>
          </div>

          {/* Category Selector */}
          <div className="tw-flex tw-items-center tw-gap-2 tw-mt-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-muted tw-text-sm">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="tw-input files-category-select"
            >
              <option value="">None</option>
              {FILE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {isUploading && (
            <div className="tw-flex tw-items-center tw-gap-2 tw-text-primary ">
              <div className="tw-animate-spin tw-h-4 tw-w-4 tw-border-2 tw-border-current tw-border-t-transparent files-spinner" />
              Uploading...
            </div>
          )}
        </div>
      </div>

      {/* Files List */}
      {files.length === 0 ? (
        <div className="empty-state">
          <Inbox className="icon-xl tw-mb-2" />
          <span>No files uploaded yet</span>
        </div>
      ) : (
        <div className="tw-panel contract-panel-no-padding">
          <table className="tw-w-full">
            <thead>
              <tr className="files-table-header">
                <th className="label tw-text-left tw-px-4 tw-py-3">
                  File
                </th>
                <th className="label tw-text-left tw-px-4 tw-py-3">
                  Size
                </th>
                <th className="label tw-text-left tw-px-4 tw-py-3">
                  Uploaded
                </th>
                <th className="label tw-text-left tw-px-4 tw-py-3">
                  Shared
                </th>
                <th className="label tw-text-right tw-px-4 tw-py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.id}
                  className="tw-list-item files-table-row"
                >
                  <td className="tw-px-4 tw-py-3">
                    <div className="tw-flex tw-items-center tw-gap-3">
                      {getFileIcon(file.file_type)}
                      <div className="tw-flex tw-flex-col">
                        <span className="tw-text-primary tw-truncate tw-max-w-[300px] ">
                          {file.original_name}
                        </span>
                        {file.category && (
                          <span className="text-muted tw-text-sm">
                            {FILE_CATEGORY_OPTIONS.find((c) => c.value === file.category)?.label || file.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="tw-px-4 tw-py-3 text-muted ">
                    {formatFileSize(file.file_size)}
                  </td>
                  <td className="tw-px-4 tw-py-3 text-muted ">
                    {formatDate(file.created_at)}
                  </td>
                  <td className="tw-px-4 tw-py-3">
                    <button
                      className="btn-icon"
                      onClick={() => handleToggleSharing(file.id)}
                      title={file.is_shared ? 'Shared with client - click to make private' : 'Private - click to share'}
                      disabled={togglingFileId === file.id}
                    >
                      {file.is_shared ? (
                        <Share2 className="icon-md" />
                      ) : (
                        <Lock className="icon-md" />
                      )}
                    </button>
                  </td>
                  <td className="tw-px-4 tw-py-3">
                    <div className="tw-flex tw-items-center tw-justify-end tw-gap-1">
                      {file.download_url && (
                        <button
                          className="btn-icon"
                          onClick={() => handleDownload(file)}
                          title="Download"
                        >
                          <Download className="icon-md" />
                        </button>
                      )}
                      <button
                        className="btn-icon"
                        onClick={() => {
                          setDeletingFileId(file.id);
                          deleteDialog.open();
                        }}
                        title="Delete"
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
